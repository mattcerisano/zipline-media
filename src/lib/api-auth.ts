import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Admin client is only used to validate the caller's JWT. A service key isn't
// strictly required for auth.getUser(jwt), so fall back to the anon key so the
// helper still works in environments where only the public key is configured.
const authClient = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseServiceKey || supabaseAnonKey || 'placeholder-key',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Resolve the authenticated user for an API request from its bearer token.
 *
 * Every integration route previously trusted a `userId` supplied in the query
 * string or JSON body, which let any signed-in user read another user's Gmail
 * or push to their calendar just by swapping the id. Routes should instead call
 * this and use the returned id, so the identity is proven by the caller's
 * Supabase session rather than asserted.
 *
 * Returns the verified user id, or null when the token is missing/invalid.
 */
export async function getAuthedUserId(request: Request): Promise<string | null> {
  const user = await getAuthedUser(request);
  return user?.id || null;
}

/** Like getAuthedUserId but returns id + email for callers that need both. */
export async function getAuthedUser(request: Request): Promise<{ id: string; email: string | null } | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';
  if (!token) return null;

  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) return null;
    return { id: data.user.id, email: data.user.email?.toLowerCase() || null };
  } catch {
    return null;
  }
}
