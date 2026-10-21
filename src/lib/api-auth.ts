import { createClient } from '@supabase/supabase-js';
import { isOwnerEmail } from '@/lib/api-owner';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Admin client validates the caller's JWT and, in isTeamMember, reads their
// role. A service key isn't strictly required for auth.getUser(jwt), so fall
// back to the anon key so sign-in checks still work where only the public key
// is configured (role lookups then find nothing and fail closed).
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

/** The studio's own people, as opposed to freelance editors and clients. */
const TEAM_ROLES = new Set(['admin', 'staff']);

/**
 * True for admin and staff accounts (and the owner, who can predate
 * user_roles). Signed in is not enough for actions that reach past the
 * caller's own data — a freelance editor's session is just as valid.
 */
export async function isTeamMember(user: { id: string; email: string | null }): Promise<boolean> {
  if (isOwnerEmail(user.email)) return true;
  const { data } = await authClient.from('user_roles').select('role').eq('id', user.id).maybeSingle();
  return !!data?.role && TEAM_ROLES.has(data.role as string);
}

/** Admin accounts (and the owner): for team-wide one-off jobs like a backfill. */
export async function isAdmin(user: { id: string; email: string | null }): Promise<boolean> {
  if (isOwnerEmail(user.email)) return true;
  const { data } = await authClient.from('user_roles').select('role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin';
}
