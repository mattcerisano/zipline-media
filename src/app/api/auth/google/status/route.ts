import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUserId } from '@/lib/api-auth';

// Reports whether the calling user has a Google connection. Runs server-side
// with the service key so the google_tokens table can be locked away from
// client reads entirely (tokens must never be selectable from the browser).
export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ connected: false, configured: false });
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // Sync-health columns may not exist pre-migration — fall back to id-only.
  let data: any = null;
  const withHealth = await admin
    .from('google_tokens')
    .select('id, last_sync_at, last_sync_ok, last_sync_error')
    .eq('id', userId)
    .maybeSingle();
  if (withHealth.error) {
    const idOnly = await admin.from('google_tokens').select('id').eq('id', userId).maybeSingle();
    data = idOnly.data;
  } else {
    data = withHealth.data;
  }

  return NextResponse.json({
    connected: !!data,
    // Lets the UI say "Google isn't configured on the server" instead of a
    // silent dead button when the OAuth env vars are missing.
    configured: !!process.env.GOOGLE_CLIENT_ID,
    // Sync health for the "last synced X ago / failing" chip.
    lastSyncAt: data?.last_sync_at ?? null,
    lastSyncOk: data?.last_sync_ok ?? null,
    lastSyncError: data?.last_sync_error ?? null,
  });
}
