import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * QuickBooks Online connection handling.
 *
 * Same shape as google-auth, with one important difference: Intuit **rotates
 * the refresh token on every refresh**. The new one has to be written back or
 * the connection dies on the following call. Refresh tokens also expire after
 * 100 days of inactivity, which is tracked so the UI can warn first.
 *
 * This integration only ever issues reads. Intuit has no read-only accounting
 * scope — `com.intuit.quickbooks.accounting` grants write access too — so the
 * restriction is enforced here, in code, not by the grant.
 */

export const QB_SCOPE = 'com.intuit.quickbooks.accounting';

/** Sandbox until QUICKBOOKS_ENVIRONMENT says otherwise, so nobody's real books are the test bed. */
export function quickbooksApiBase(): string {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

export type QbFailure = 'not_connected' | 'refresh_expired' | 'revoked' | 'server_misconfigured' | 'refresh_failed';

export interface QbTokenResult {
  token: string | null;
  realmId?: string;
  failure?: QbFailure;
  detail?: string;
}

export function describeQbFailure(failure: QbFailure, detail?: string): string {
  switch (failure) {
    case 'not_connected':
      return 'QuickBooks is not connected.';
    case 'refresh_expired':
      return 'The QuickBooks connection expired after 100 days of inactivity — reconnect in Integrations.';
    case 'revoked':
      return 'QuickBooks revoked this connection — reconnect in Integrations.';
    case 'server_misconfigured':
      return 'QuickBooks credentials are not configured on the server — reconnecting will not help.';
    case 'refresh_failed':
    default:
      return `Could not refresh the QuickBooks token${detail ? `: ${detail}` : '.'}`;
  }
}

function basicAuthHeader(): string | null {
  const id = process.env.QUICKBOOKS_CLIENT_ID;
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!id || !secret) return null;
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

export async function getQuickBooksToken(userId: string): Promise<QbTokenResult> {
  const { data, error } = await supabaseAdmin
    .from('quickbooks_tokens')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return { token: null, failure: 'not_connected' };
  }

  const now = Date.now();

  // Still good for another 5 minutes — use it as is.
  if (new Date(data.expires_at).getTime() > now + 5 * 60 * 1000) {
    return { token: data.access_token, realmId: data.realm_id };
  }

  if (data.refresh_token_expires_at && new Date(data.refresh_token_expires_at).getTime() < now) {
    return { token: null, failure: 'refresh_expired' };
  }

  const auth = basicAuthHeader();
  if (!auth) {
    console.error('QuickBooks client credentials are missing; cannot refresh tokens.');
    return { token: null, failure: 'server_misconfigured' };
  }

  try {
    const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('QuickBooks token refresh failed:', errorText);
      const revoked = errorText.includes('invalid_grant');
      return {
        token: null,
        failure: revoked ? 'revoked' : 'refresh_failed',
        detail: errorText.slice(0, 300),
      };
    }

    const tokenData = await res.json();
    // Intuit rotates the refresh token on every refresh. Persisting the new
    // one is not optional — keeping the old value breaks the next call.
    const payload: Record<string, unknown> = {
      id: userId,
      realm_id: data.realm_id,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || data.refresh_token,
      expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (tokenData.x_refresh_token_expires_in) {
      payload.refresh_token_expires_at =
        new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000).toISOString();
    }

    const { error: upsertError } = await supabaseAdmin
      .from('quickbooks_tokens')
      .upsert(payload, { onConflict: 'id' });
    if (upsertError) throw upsertError;

    return { token: tokenData.access_token, realmId: data.realm_id };
  } catch (err: any) {
    console.error('Failed to refresh QuickBooks token:', err.message);
    return { token: null, failure: 'refresh_failed', detail: err?.message };
  }
}

/**
 * Run a QuickBooks query. Read-only by construction: this helper only ever
 * issues GETs against the /query endpoint, so no caller can write through it
 * even though the granted scope technically permits writes.
 */
export async function quickbooksQuery<T = any>(
  token: string,
  realmId: string,
  sql: string,
): Promise<T[]> {
  const url = `${quickbooksApiBase()}/v3/company/${encodeURIComponent(realmId)}/query?query=${encodeURIComponent(sql)}&minorversion=70`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`QuickBooks query failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }

  const body = await res.json();
  const response = body?.QueryResponse || {};
  // The response key is the entity name — Invoice, Estimate, Customer …
  const firstArray = Object.values(response).find(v => Array.isArray(v));
  return (firstArray as T[]) || [];
}
