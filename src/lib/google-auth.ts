import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Why a token lookup failed. Every one of these used to collapse into a bare
 * `null`, so the UI reported "expired or revoked" no matter what actually went
 * wrong — including cases reconnecting cannot fix, like the server missing its
 * Google credentials.
 */
export type TokenFailure =
  | 'not_connected'
  | 'no_refresh_token'
  | 'revoked'
  | 'server_misconfigured'
  | 'refresh_failed';

export interface TokenResult {
  token: string | null;
  failure?: TokenFailure;
  /** Detail for the logs, including Google's own error text. */
  detail?: string;
}

/** The message shown to the user for each failure mode. */
export function describeTokenFailure(failure: TokenFailure, detail?: string): string {
  switch (failure) {
    case 'not_connected':
      return 'Google account not connected.';
    case 'no_refresh_token':
      return 'Google connection is missing offline access — disconnect and reconnect in Integrations to re-grant it.';
    case 'revoked':
      // The most common cause of a connection dying on its own: while the
      // OAuth consent screen is in "Testing", Google expires every refresh
      // token after 7 days whether or not it is being used.
      return 'Google revoked this connection — reconnect in Integrations. If it keeps dying every few days, publish the OAuth consent screen: Google expires refresh tokens after 7 days while it is in Testing mode.';
    case 'server_misconfigured':
      return 'Google credentials are not configured on the server — reconnecting will not help.';
    case 'refresh_failed':
    default:
      return `Could not refresh the Google token${detail ? `: ${detail}` : '.'}`;
  }
}

/**
 * Resolve a usable Google access token for a user, refreshing it when stale,
 * and report *why* when that isn't possible.
 */
export async function getGoogleToken(userId: string): Promise<TokenResult> {
  const { data, error } = await supabaseAdmin
    .from('google_tokens')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { token: null, failure: 'not_connected' };
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();

  // If token is valid for another 5 minutes, return it
  if (expiresAt > now + 5 * 60 * 1000) {
    return { token: data.access_token };
  }

  // Otherwise, refresh the token
  if (!data.refresh_token) {
    console.warn('Google token expired but no refresh token available for user:', userId);
    return { token: null, failure: 'no_refresh_token' };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Google client credentials are missing; cannot refresh tokens.');
    return { token: null, failure: 'server_misconfigured' };
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: data.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Google token refresh failed:', errorText);
      // invalid_grant is Google's answer for a refresh token that has been
      // revoked, has expired, or belongs to a different OAuth client. It is
      // terminal: retrying never succeeds, only reconnecting does.
      const isRevoked = errorText.includes('invalid_grant');
      return {
        token: null,
        failure: isRevoked ? 'revoked' : 'refresh_failed',
        detail: errorText.slice(0, 300),
      };
    }

    const tokenData = await res.json();
    const expiresIn = tokenData.expires_in || 3600;
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const upsertPayload: any = {
      id: userId,
      access_token: tokenData.access_token,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    };

    if (tokenData.refresh_token) {
      upsertPayload.refresh_token = tokenData.refresh_token;
    }

    const { error: upsertError } = await supabaseAdmin
      .from('google_tokens')
      .upsert(upsertPayload, { onConflict: 'id' });

    if (upsertError) {
      throw upsertError;
    }

    return { token: tokenData.access_token };
  } catch (err: any) {
    console.error('Failed to refresh Google token:', err.message);
    return { token: null, failure: 'refresh_failed', detail: err?.message };
  }
}

/** Token-or-null form, for callers that only need to know whether it worked. */
export async function getValidGoogleToken(userId: string): Promise<string | null> {
  const { token } = await getGoogleToken(userId);
  return token;
}
