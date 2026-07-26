import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Why a Google token could not be produced. These used to be indistinguishable
 * — every failure path returned a bare `null` and the caller guessed "expired
 * or revoked", which sent people to reconnect over and over for problems that
 * reconnecting cannot fix (missing server credentials, for instance).
 */
export type GoogleTokenFailure =
  | 'not_connected'          // no google_tokens row, or it couldn't be read
  | 'no_refresh_token'       // row exists but has nothing to refresh with
  | 'server_not_configured'  // GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing
  | 'refresh_rejected'       // Google refused the refresh token
  | 'token_store_failed';    // refreshed fine, but the new token wouldn't save

export interface GoogleTokenResult {
  token: string | null;
  reason?: GoogleTokenFailure;
  /** Short, safe detail (e.g. Google's `invalid_grant`) for the UI. */
  detail?: string;
}

/** Human-readable cause, written to sync status and shown in Integrations. */
export function describeGoogleTokenFailure(
  reason: GoogleTokenFailure | undefined,
  detail?: string
): string {
  switch (reason) {
    case 'server_not_configured':
      return 'Google OAuth is not configured on this deployment (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are missing). Reconnecting will not help until those are set on the server.';
    case 'no_refresh_token':
      return 'The Google connection has no refresh token stored — disconnect and reconnect in Integrations to grant offline access.';
    case 'refresh_rejected':
      return `Google rejected the saved credentials${detail ? ` (${detail})` : ''} — reconnect in Integrations. Note that OAuth apps still in "Testing" status have refresh tokens that expire after 7 days.`;
    case 'token_store_failed':
      return 'Google issued a new token but it could not be saved to the database — the connection will keep failing until that write succeeds.';
    case 'not_connected':
    default:
      return 'No Google account is connected — connect one in Integrations.';
  }
}

/**
 * Resolve a usable Google access token, refreshing it when needed, and report
 * precisely why when that isn't possible.
 */
export async function resolveGoogleToken(userId: string): Promise<GoogleTokenResult> {
  const { data, error } = await supabaseAdmin
    .from('google_tokens')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { token: null, reason: 'not_connected' };
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
    return { token: null, reason: 'no_refresh_token' };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Google client credentials are missing');
    return { token: null, reason: 'server_not_configured' };
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
      console.error('Failed to refresh Google token:', errorText);
      // Surface only Google's error code, never the raw body — the request
      // echoed back can carry the client_id, and this string is shown in the UI.
      let detail: string | undefined;
      try {
        const parsed = JSON.parse(errorText);
        detail = parsed.error_description || parsed.error;
      } catch {
        /* non-JSON error body — omit the detail entirely */
      }
      return { token: null, reason: 'refresh_rejected', detail };
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
      console.error('Failed to store refreshed Google token:', upsertError.message);
      return { token: null, reason: 'token_store_failed', detail: upsertError.message };
    }

    return { token: tokenData.access_token };
  } catch (err: any) {
    console.error('Failed to refresh Google token:', err?.message);
    return { token: null, reason: 'refresh_rejected', detail: err?.message };
  }
}

/** Token-only helper for callers that just need "can I call Google or not". */
export async function getValidGoogleToken(userId: string): Promise<string | null> {
  return (await resolveGoogleToken(userId)).token;
}
