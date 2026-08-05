import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyOAuthState } from '@/lib/oauth-state';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // Intuit returns the company ("realm") the user picked. Every subsequent
  // API call is scoped to it, so it is stored with the tokens.
  const realmId = searchParams.get('realmId');
  const userId = verifyOAuthState(searchParams.get('state'));

  if (!code || !userId || !realmId) {
    console.error('QuickBooks callback rejected:', { code: !!code, validState: !!userId, realmId: !!realmId });
    return NextResponse.redirect(new URL('/command-center?qb_error=invalid_callback', request.url));
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${new URL(request.url).origin}/api/auth/quickbooks/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/command-center?qb_error=credentials_missing', request.url));
  }

  try {
    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = await tokenRes.json();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error } = await supabaseAdmin.from('quickbooks_tokens').upsert(
      {
        id: userId,
        realm_id: realmId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        refresh_token_expires_at: tokenData.x_refresh_token_expires_in
          ? new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );

    if (error) throw error;

    return NextResponse.redirect(new URL('/command-center?qb_success=true', request.url));
  } catch (err: any) {
    console.error('QuickBooks OAuth callback error:', err.message);
    return NextResponse.redirect(
      new URL(`/command-center?qb_error=exchange_failed&details=${encodeURIComponent(err.message)}`, request.url),
    );
  }
}
