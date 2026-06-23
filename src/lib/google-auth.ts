import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function getValidGoogleToken(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('google_tokens')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();

  // If token is valid for another 5 minutes, return it
  if (expiresAt > now + 5 * 60 * 1000) {
    return data.access_token;
  }

  // Otherwise, refresh the token
  if (!data.refresh_token) {
    console.warn('Google token expired but no refresh token available for user:', userId);
    return null;
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Google client credentials are missing');
    }

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
      throw new Error(`Token refresh failed: ${errorText}`);
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

    return tokenData.access_token;
  } catch (err: any) {
    console.error('Failed to refresh Google token:', err.message);
    return null;
  }
}
