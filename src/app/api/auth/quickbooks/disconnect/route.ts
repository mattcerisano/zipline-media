import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUserId } from '@/lib/api-auth';

// Disconnect the caller's QuickBooks company. Identity comes from the verified
// session, so a user can only ever disconnect themselves. Also revokes the
// grant with Intuit rather than only dropping our copy of the tokens.
export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data } = await admin
    .from('quickbooks_tokens')
    .select('refresh_token')
    .eq('id', userId)
    .maybeSingle();

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (data?.refresh_token && clientId && clientSecret) {
    try {
      await fetch('https://developer.api.intuit.com/v2/oauth2/tokens/revoke', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ token: data.refresh_token }),
      });
    } catch (err) {
      // Best effort — dropping our tokens is what actually disconnects us.
      console.warn('QuickBooks token revoke failed:', err);
    }
  }

  const { error } = await admin.from('quickbooks_tokens').delete().eq('id', userId);
  if (error) {
    console.error('Failed to disconnect QuickBooks:', error);
    return NextResponse.json({ error: 'Failed to disconnect.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
