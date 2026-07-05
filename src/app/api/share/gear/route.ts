import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isSameOrigin } from '@/lib/api-guard';

// Bounds to keep a share link from being used to dump arbitrary data into a
// job. NOTE: this endpoint is still capability-by-URL (anyone with the job's
// UUID can edit its manifest). The complete fix is a per-job share_token
// column checked here, which needs a DB migration — tracked as a follow-up.
const MAX_ITEMS = 500;
const MAX_QTY = 9999;
const MAX_NAME_LEN = 200;

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

// Create a Supabase client that uses the service role key to bypass RLS policies
const getServiceSupabase = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables are missing on the server.');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
};

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { jobId, gear_manifest } = body;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ success: false, error: 'Job ID is required.' }, { status: 400 });
    }

    if (typeof gear_manifest !== 'object' || gear_manifest === null || Array.isArray(gear_manifest)) {
      return NextResponse.json({ success: false, error: 'Invalid gear manifest format.' }, { status: 400 });
    }

    const cleanManifest = sanitizeManifest(gear_manifest as Record<string, unknown>);
    if (!cleanManifest) {
      return NextResponse.json({ success: false, error: 'Gear manifest failed validation.' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Perform update on jobs table
    const { data, error } = await supabase
      .from('jobs')
      .update({
        gear_manifest: cleanManifest,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select('id, title')
      .single();

    if (error) {
      console.error('[Share Gear API] Database update error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Updated gear list for job: ${data.title}` });
  } catch (err: any) {
    console.error('[Share Gear API] POST handler crashed:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
