import { supabase } from '@/lib/supabase';

/**
 * Authorization header for calls to our own /api integration routes.
 *
 * The server verifies this bearer token and derives the user id from it, so the
 * client no longer needs to send (and the server no longer trusts) a userId in
 * the query string or body. Returns an empty object when there is no session.
 */
export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
