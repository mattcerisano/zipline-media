import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSameOrigin, withinRateLimit } from '@/lib/api-guard';

// Read and write side of the public gear-share page.
//
// The people this is shared with are not signed in, so the gate is a per-job
// share_token (see 20260806000001_share_token.sql) checked here with the
// service key. That replaces the table-wide anonymous read that used to be
// granted on jobs and inventory: a share link now unlocks exactly one job's
// gear list and nothing else.
//
// GET  → the job's title/date/manifest plus the inventory catalog
// POST → replace the job's manifest
//
// Both require the matching token. The response deliberately carries only the
// three job fields the share page renders — no client name, notes, contact
// email, or Drive/Discord/review links ever cross this boundary.

// Bounds to keep a share link from being used to dump arbitrary data into a job.
const MAX_ITEMS = 500;
const MAX_QTY = 9999;
const MAX_NAME_LEN = 200;

/** Token comparison that doesn't leak position through timing. */
function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function sanitizeManifest(input: Record<string, unknown>): Record<string, number> | null {
  const keys = Object.keys(input);
  if (keys.length > MAX_ITEMS) return null;
  const clean: Record<string, number> = {};
  for (const key of keys) {
    if (typeof key !== 'string' || key.length === 0 || key.length > MAX_NAME_LEN) return null;
    const raw = input[key];
    const qty = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return null;
    if (qty > 0) clean[key] = qty;
  }
  return clean;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Service role: RLS now denies anonymous reads on jobs, and the share page's
// visitors are anonymous by design. The token check above is what stands in
// for a session.
const getServiceSupabase = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are missing on the server.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

/**
 * Look the job up and confirm the token matches. Returns null on any failure —
 * wrong token, missing job, malformed id — so a caller can't tell which job
 * ids exist by probing.
 */
async function authorizeJob(
  supabase: ReturnType<typeof getServiceSupabase>,
  jobId: string,
  token: string,
) {
  if (!jobId || !token) return null;
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, shoot_date, gear_manifest, share_token')
    .eq('id', jobId)
    .maybeSingle();
  if (error || !data?.share_token) return null;
  if (!tokensMatch(token, String(data.share_token))) return null;
  return data;
}

export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request) || !withinRateLimit(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId') || '';
    const token = searchParams.get('token') || '';

    const supabase = getServiceSupabase();
    const job = await authorizeJob(supabase, jobId, token);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const { data: catalog, error: catalogErr } = await supabase
      .from('inventory')
      .select('*')
      .order('name');
    if (catalogErr) {
      return NextResponse.json({ success: false, error: 'Failed to load the gear catalog.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      // Only what the share page renders. share_token is stripped so the page
      // never re-exposes the credential it was opened with.
      job: {
        id: job.id,
        title: job.title,
        shoot_date: job.shoot_date,
        gear_manifest: job.gear_manifest || {},
      },
      catalog: catalog || [],
    });
  } catch (err: any) {
    console.error('[Share Gear API] GET handler crashed:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request) || !withinRateLimit(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { jobId, token, gear_manifest } = body;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ success: false, error: 'Job ID is required.' }, { status: 400 });
    }
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, error: 'A share token is required.' }, { status: 400 });
    }

    if (typeof gear_manifest !== 'object' || gear_manifest === null || Array.isArray(gear_manifest)) {
      return NextResponse.json({ success: false, error: 'Invalid gear manifest format.' }, { status: 400 });
    }

    const cleanManifest = sanitizeManifest(gear_manifest as Record<string, unknown>);
    if (!cleanManifest) {
      return NextResponse.json({ success: false, error: 'Gear manifest failed validation.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const job = await authorizeJob(supabase, jobId, token);
    if (!job) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({
        gear_manifest: cleanManifest,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('id, title')
      .single();

    if (error) {
      console.error('[Share Gear API] Database update error:', error);
      return NextResponse.json({ success: false, error: 'Failed to save the gear list.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Updated gear list for job: ${data.title}` });
  } catch (err: any) {
    console.error('[Share Gear API] POST handler crashed:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
