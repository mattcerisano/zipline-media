import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSameOrigin, withinRateLimit } from '@/lib/api-guard';
import { getAuthedUser, isAdmin, isTeamMember } from '@/lib/api-auth';
import { geocodeWithGoogle, planPlacing, placeText, type GeoPoint, type PlaceableRow } from '@/lib/geocode';
import { COORDINATE_COLUMNS, isMappedProduction } from '@/lib/map-places';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function GET(request: Request) {
  if (!isSameOrigin(request) || !withinRateLimit(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Signed in as well: the origin check can be forged with one header and the
  // throttle only holds within one instance, so on their own they left the
  // studio's Maps budget open to anyone. Every caller is inside the app.
  if (!(await getAuthedUser(request))) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  // `strict=1`: the caller is placing a pin, so a loose match counts as not found.
  const strict = searchParams.get('strict') === '1';

  if (!address || address.length > 300) {
    return NextResponse.json({ error: 'A valid address is required' }, { status: 400 });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
  }

  const result = await geocodeWithGoogle(address, GOOGLE_MAPS_API_KEY, { strict });
  if (result.kind === 'found') return NextResponse.json({ lat: result.lat, lng: result.lng });
  if (result.kind === 'not_found') {
    return NextResponse.json({ error: 'Address not found', status: 'ZERO_RESULTS' }, { status: 404 });
  }
  // A refused key or a network failure isn't the address's fault: 502, so a
  // caller can tell "try again later" from "Google doesn't know this place".
  console.error('Geocode API Error:', result.status, result.message);
  return NextResponse.json({ error: 'Geocoding failed', status: result.status, message: result.message }, { status: 502 });
}

/** Distinct addresses looked up per request: a map visit, and each step of the backfill. */
const VISIT_LOOKUPS = 25;
const BACKFILL_LOOKUPS = 100;
const PARALLEL = 5;

interface Placed {
  table: 'jobs' | 'locations';
  id: string;
  latitude: number | null;
  longitude: number | null;
  geocoded_address: string;
}

/**
 * Places productions and scouted locations on the map: looks up each address
 * that has none (or has changed) once and stores the result on the row.
 *
 * The Locations tab calls this when it finds rows waiting, which covers every
 * way an address gets saved — the Slate, the calendar, a duplicated day —
 * without each of them geocoding on its own. `{ all: true }` is the admin's
 * one-time backfill of rows saved before the map existed, taken in steps the
 * client repeats until `remaining` is 0.
 *
 * Reads and writes run as the caller, so the tables' own RLS decides what they
 * can place. Body: `{ all?: boolean }`.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request) || !withinRateLimit(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!(await isTeamMember(user))) {
    return NextResponse.json({ error: 'Only admin and staff accounts can place locations.' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const all = body?.all === true;
  if (all && !(await isAdmin(user))) {
    return NextResponse.json({ error: 'Only an admin can place every location at once.' }, { status: 403 });
  }
  if (!GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'The Google Maps key isn’t set on the server.' }, { status: 500 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      global: { headers: { Authorization: request.headers.get('authorization') || '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const [jobsRes, locationsRes] = await Promise.all([
    db.from('jobs').select(`id, job_status, type, location_address, ${COORDINATE_COLUMNS}`),
    db.from('locations').select(`id, address, ${COORDINATE_COLUMNS}`),
  ]);
  const readError = jobsRes.error || locationsRes.error;
  if (readError) {
    // 42703: undefined column — 20261020210931_location_coordinates hasn't run.
    const missing = readError.code === '42703' || /latitude|geocoded_address/.test(readError.message);
    return NextResponse.json(
      missing
        ? { error: 'migration', message: 'Run 20261020210931_location_coordinates.sql in Supabase first.' }
        : { error: readError.message },
      { status: missing ? 409 : 500 }
    );
  }

  const rows: PlaceableRow[] = [
    ...(jobsRes.data || []).filter(isMappedProduction).map(j => ({
      table: 'jobs' as const, id: j.id, text: placeText(j.location_address),
      latitude: j.latitude, longitude: j.longitude, geocoded_address: j.geocoded_address,
    })),
    ...(locationsRes.data || []).map(l => ({
      table: 'locations' as const, id: l.id, text: placeText(l.address),
      latitude: l.latitude, longitude: l.longitude, geocoded_address: l.geocoded_address,
    })),
  ];
  const { known, lookups } = planPlacing(rows);

  const placed: Placed[] = [];
  let failed = 0;
  // One write per table and address, however many rows share it.
  const store = async (text: string, point: GeoPoint | null, group: PlaceableRow[]) => {
    for (const table of ['jobs', 'locations'] as const) {
      const ids = group.filter(r => r.table === table).map(r => r.id);
      if (ids.length === 0) continue;
      const values = { latitude: point?.lat ?? null, longitude: point?.lng ?? null, geocoded_address: text };
      const { error } = await db.from(table).update(values).in('id', ids);
      if (error) {
        console.error(`Couldn't store coordinates on ${table}:`, error.message);
        failed += ids.length;
      } else {
        placed.push(...ids.map(id => ({ table, id, ...values })));
      }
    }
  };

  const knownByText = new Map<string, { point: GeoPoint | null; rows: PlaceableRow[] }>();
  for (const { row, point } of known) {
    const entry = knownByText.get(row.text as string) || { point, rows: [] };
    entry.rows.push(row);
    knownByText.set(row.text as string, entry);
  }
  for (const [text, { point, rows: group }] of knownByText) await store(text, point, group);

  const queue = [...lookups.entries()].slice(0, all ? BACKFILL_LOOKUPS : VISIT_LOOKUPS);
  let notFound = 0;
  let stopped: string | null = null;
  const worker = async () => {
    for (let next = queue.shift(); next && !stopped; next = queue.shift()) {
      const [text, group] = next;
      const result = await geocodeWithGoogle(text, GOOGLE_MAPS_API_KEY, { strict: true });
      if (result.kind === 'found') {
        await store(text, { lat: result.lat, lng: result.lng }, group);
      } else if (result.kind === 'not_found') {
        notFound += group.length;
        await store(text, null, group);
      } else {
        failed += group.length;
        if (result.stop) stopped = `Google refused the lookup (${result.status}): ${result.message}`;
      }
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));

  const done = new Set(placed.map(p => `${p.table}:${p.id}`));
  const remaining = rows.filter(r => r.text && r.geocoded_address !== r.text && !done.has(`${r.table}:${r.id}`)).length;
  if (stopped) console.error('Geocode backfill stopped:', stopped);
  return NextResponse.json({ placed, notFound, failed, remaining, ...(stopped ? { error: stopped } : {}) });
}
