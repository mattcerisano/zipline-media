import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUserId } from '@/lib/api-auth';
import { resolveStudioCalendarUserId } from '@/lib/studio-calendar';

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

  // Which account owns the studio calendar — the one every production is
  // pushed to. Resolved the same way the push itself resolves it, so the UI
  // can't claim a calendar the sync wouldn't actually use. Best-effort: a
  // database without the column reports "nobody yet" rather than failing.
  let studioPick: { userId: string | null; source: string } = { userId: null, source: 'acting' };
  try {
    studioPick = await resolveStudioCalendarUserId(null);
  } catch { /* leave it undecided */ }

  return NextResponse.json({
    connected: !!data,
    // Lets the UI say "Google isn't configured on the server" instead of a
    // silent dead button when the OAuth env vars are missing.
    configured: !!process.env.GOOGLE_CLIENT_ID,
    // Sync health for the "last synced X ago / failing" chip.
    lastSyncAt: data?.last_sync_at ?? null,
    lastSyncOk: data?.last_sync_ok ?? null,
    lastSyncError: data?.last_sync_error ?? null,
    // True when productions pushed from Slate land on *this* user's calendar.
    isStudioCalendar: !!studioPick.userId && studioPick.userId === userId,
    // False means nothing has been chosen and pushes still follow whoever
    // saved the job — the state the UI needs to prompt about.
    studioCalendarSet: studioPick.userId !== null && studioPick.source !== 'acting',
  });
}
