import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUserId } from '@/lib/api-auth';

// Whether the caller has a QuickBooks connection, plus the 100-day refresh
// deadline so the UI can warn before the connection lapses on its own.
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
  const { data } = await admin
    .from('quickbooks_tokens')
    .select('id, realm_id, refresh_token_expires_at, last_sync_at, last_sync_ok, last_sync_error')
    .eq('id', userId)
    .maybeSingle();

  return NextResponse.json({
    connected: !!data,
    configured: !!process.env.QUICKBOOKS_CLIENT_ID,
    environment: process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
    realmId: data?.realm_id ?? null,
    refreshTokenExpiresAt: data?.refresh_token_expires_at ?? null,
    lastSyncAt: data?.last_sync_at ?? null,
    lastSyncOk: data?.last_sync_ok ?? null,
    lastSyncError: data?.last_sync_error ?? null,
  });
}
