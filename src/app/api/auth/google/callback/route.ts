import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyOAuthState } from '@/lib/oauth-state';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // The user id is recovered from the HMAC-signed state we issued at the start
  // of the flow. A forged or expired state yields null and is rejected, so
  // tokens can never be bound to an id the caller didn't prove they own.
  const userId = verifyOAuthState(searchParams.get('state'));

  if (!code || !userId) {
    console.error('Callback rejected:', { code: !!code, validState: !!userId });
    return NextResponse.redirect(new URL('/command-center?google_error=invalid_callback', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    console.error('Google client credentials are not configured in environment variables');
    return NextResponse.redirect(new URL('/command-center?google_error=credentials_missing', request.url));
  }

  try {
    // Exchange auth code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData = await tokenRes.json();
    const expiresIn = tokenData.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Create Supabase Admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build payload for upsert
    const upsertPayload: any = {
      id: userId,
      access_token: tokenData.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    // Google only sends a refresh_token on the first consent request
    if (tokenData.refresh_token) {
      upsertPayload.refresh_token = tokenData.refresh_token;
    }

    const { error: upsertError } = await supabaseAdmin
      .from('google_tokens')
      .upsert(upsertPayload, { onConflict: 'id' });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.redirect(new URL('/command-center?google_success=true', request.url));
  } catch (err: any) {
    console.error('Google OAuth callback error:', err.message);
    return NextResponse.redirect(new URL(`/command-center?google_error=exchange_failed&details=${encodeURIComponent(err.message)}`, request.url));
  }
}
