import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';
import { isOwnerEmail } from '@/lib/api-owner';
import { AUTO_CLOSE_HOURS, MAX_MANUAL_MINUTES, MAX_NOTE_LEN } from '@/lib/edit-time';

// Time logged against an edit card.
//
// Every write to edit_time_entries comes through here. The table has no write
// policy at all, so the anon key in the page bundle cannot touch it: a person
// cannot insert a span, extend one, or backdate one by talking to the database
// directly, whatever their role. What they can do is ask this route, which
//
//   1. takes their identity from the bearer token — never from the body, so a
//      caller cannot log time as someone else;
//   2. checks the card is actually theirs (assigned to their Rolodex contact),
//      or that they are staff;
//   3. hands the write to a database function that stamps the time from the
//      database's own clock.
//
// The caller's clock is never read. A browser with its system time moved
// forward, or a patched bundle sending whatever it likes, still produces an
// entry that starts and ends when the database says it did.
//
// GET    ?jobId=<uuid> → that card's entries the caller may see, plus totals
// GET                  → per-card totals for the board, plus the running timer
// POST   {action:'start'|'stop'|'manual', …}
// DELETE {entryId}

const TEAM_ROLES = new Set(['admin', 'staff']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ceiling on rows read for the board totals. Well past a year of real logging;
// it exists so a runaway table can't turn one board load into a full scan.
const MAX_ROWS = 5000;
const MAX_ENTRIES_PER_CARD = 200;

// Best-effort per-account throttle on writes. Serverless has no shared state,
// so this only holds within a warm instance — the real bounds are the
// one-running-timer index and the 12-hour cap, which hold everywhere.
const WRITE_WINDOW_MS = 60_000;
const MAX_WRITES_PER_WINDOW = 60;
const writes = new Map<string, { count: number; resetAt: number }>();

function withinWriteLimit(userId: string): boolean {
  const now = Date.now();
  const entry = writes.get(userId);
  if (!entry || now > entry.resetAt) {
    writes.set(userId, { count: 1, resetAt: now + WRITE_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_WRITES_PER_WINDOW;
}

function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface Caller {
  id: string;
  email: string | null;
  role: string | null;
  contactId: string | null;
  /** Staff and admin see and log against every card. */
  isTeam: boolean;
}

type Gate = { caller: Caller; admin: SupabaseClient } | { error: NextResponse };

async function resolveCaller(request: Request): Promise<Gate> {
  const user = await getAuthedUser(request);
  if (!user) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  const admin = getAdminClient();
  if (!admin) {
    return { error: NextResponse.json({ error: 'Server is not configured.' }, { status: 500 }) };
  }

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // Asked of the database rather than worked out here, so the route's idea of
  // whose card this is cannot drift from the row-level policies' — they call
  // the same function.
  const { data: contactId } = await admin.rpc('contact_id_for_user', { target_user: user.id });

  const role = (roleRow?.role as string | null) ?? null;
  return {
    admin,
    caller: {
      id: user.id,
      email: user.email,
      role,
      contactId: (contactId as string | null) ?? null,
      isTeam: (role ? TEAM_ROLES.has(role) : false) || isOwnerEmail(user.email),
    },
  };
}

/** May this caller see, and log against, this card? */
async function cardAccess(admin: SupabaseClient, caller: Caller, jobId: string) {
  const { data: job, error } = await admin
    .from('jobs')
    .select('id, editor_id')
    .eq('id', jobId)
    .maybeSingle();

  if (error) return { error: NextResponse.json({ error: 'Failed to load the card.' }, { status: 500 }) };
  if (!job) return { error: NextResponse.json({ error: 'Card not found.' }, { status: 404 }) };

  const assigned = !!caller.contactId && job.editor_id === caller.contactId;
  if (!caller.isTeam && !assigned) {
    // Same answer whether the card exists and isn't theirs or the id is a
    // guess: the response must not confirm that a production exists.
    return { error: NextResponse.json({ error: 'Card not found.' }, { status: 404 }) };
  }
  return { job, assigned };
}

/** Close anything left running past the cap before reading or starting. */
async function closeStaleTimers(admin: SupabaseClient) {
  try {
    await admin.rpc('close_stale_edit_timers', { max_hours: AUTO_CLOSE_HOURS });
  } catch {
    // A forgotten timer staying open is not a reason to fail the request.
  }
}

export async function GET(request: Request) {
  const gate = await resolveCaller(request);
  if ('error' in gate) return gate.error;
  const { admin, caller } = gate;

  await closeStaleTimers(admin);

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  const { data: running } = await admin
    .from('edit_time_entries')
    .select('*')
    .eq('user_id', caller.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobId) {
    if (!UUID_RE.test(jobId)) {
      return NextResponse.json({ error: 'A valid jobId is required.' }, { status: 400 });
    }
    const access = await cardAccess(admin, caller, jobId);
    if ('error' in access) return access.error;

    // Staff read the card's whole log — it is what they invoice from. Everyone
    // else reads their own hours and no one else's.
    let query = admin
      .from('edit_time_entries')
      .select('*')
      .eq('job_id', jobId)
      .order('started_at', { ascending: false })
      .limit(MAX_ENTRIES_PER_CARD);
    if (!caller.isTeam) query = query.eq('user_id', caller.id);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Failed to load the time log.' }, { status: 500 });
    }
    return NextResponse.json({ entries: data || [], running: running || null });
  }

  // Board view: one number per card.
  let totalsQuery = admin
    .from('edit_time_entries')
    .select('job_id, duration_seconds, started_at, ended_at')
    .order('started_at', { ascending: false })
    .limit(MAX_ROWS);
  if (!caller.isTeam) totalsQuery = totalsQuery.eq('user_id', caller.id);

  const { data: rows, error: totalsError } = await totalsQuery;
  if (totalsError) {
    return NextResponse.json({ error: 'Failed to load logged time.' }, { status: 500 });
  }

  const totals: Record<string, number> = {};
  for (const row of rows || []) {
    const seconds =
      typeof row.duration_seconds === 'number'
        ? row.duration_seconds
        : Math.max(0, Math.floor((Date.now() - Date.parse(row.started_at)) / 1000));
    totals[row.job_id] = (totals[row.job_id] || 0) + seconds;
  }
  return NextResponse.json({ totals, running: running || null });
}

export async function POST(request: Request) {
  const gate = await resolveCaller(request);
  if ('error' in gate) return gate.error;
  const { admin, caller } = gate;

  if (!withinWriteLimit(caller.id)) {
    return NextResponse.json({ error: 'Too many requests — try again in a minute.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  if (action === 'stop') {
    const entryId = typeof body.entryId === 'string' ? body.entryId : null;
    if (entryId && !UUID_RE.test(entryId)) {
      return NextResponse.json({ error: 'A valid entryId is required.' }, { status: 400 });
    }
    // Scoped to the caller inside the function, so passing someone else's
    // entry id stops nothing rather than stopping theirs.
    const { data, error } = await admin.rpc('stop_edit_timer', {
      target_user: caller.id,
      target_entry: entryId,
    });
    if (error) {
      console.error('Failed to stop a timer:', error);
      return NextResponse.json({ error: 'Failed to stop the timer.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'No timer is running.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, entry: data });
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId : '';
  if (!UUID_RE.test(jobId)) {
    return NextResponse.json({ error: 'A valid jobId is required.' }, { status: 400 });
  }
  const access = await cardAccess(admin, caller, jobId);
  if ('error' in access) return access.error;

  if (action === 'start') {
    await closeStaleTimers(admin);

    const { data, error } = await admin.rpc('start_edit_timer', {
      target_job: jobId,
      target_user: caller.id,
      target_email: caller.email,
      target_contact: caller.contactId,
    });
    if (error) {
      // The one-running-timer index is what rejects a second start, including
      // one from a second tab or a phone left open on another card.
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A timer is already running. Stop it before starting another.' },
          { status: 409 }
        );
      }
      console.error('Failed to start a timer:', error);
      return NextResponse.json({ error: 'Failed to start the timer.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, entry: data });
  }

  if (action === 'manual') {
    const minutes = Number(body.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MANUAL_MINUTES) {
      return NextResponse.json(
        { error: `A manual entry must be between 1 minute and ${MAX_MANUAL_MINUTES / 60} hours.` },
        { status: 400 }
      );
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE_LEN) : null;

    const { data, error } = await admin.rpc('log_manual_edit_time', {
      target_job: jobId,
      target_user: caller.id,
      minutes,
      target_email: caller.email,
      target_contact: caller.contactId,
      entry_note: note,
    });
    if (error) {
      console.error('Failed to log manual time:', error);
      return NextResponse.json({ error: 'Failed to log the time.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, entry: data });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}

// Removing an entry is deletion, not correction: a stopped span can never be
// re-timed (the database refuses), so a mis-started timer is fixed by dropping
// it and logging the real one. You may drop your own; staff may drop any,
// because they are the ones who have to sign off the invoice it feeds.
export async function DELETE(request: Request) {
  const gate = await resolveCaller(request);
  if ('error' in gate) return gate.error;
  const { admin, caller } = gate;

  if (!withinWriteLimit(caller.id)) {
    return NextResponse.json({ error: 'Too many requests — try again in a minute.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const entryId = typeof body.entryId === 'string' ? body.entryId : '';
  if (!UUID_RE.test(entryId)) {
    return NextResponse.json({ error: 'A valid entryId is required.' }, { status: 400 });
  }

  let query = admin.from('edit_time_entries').delete().eq('id', entryId);
  if (!caller.isTeam) query = query.eq('user_id', caller.id);

  const { data, error } = await query.select('id');
  if (error) {
    console.error('Failed to delete a time entry:', error);
    return NextResponse.json({ error: 'Failed to delete the entry.' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
