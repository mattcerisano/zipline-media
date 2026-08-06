import { supabase } from '@/lib/supabase';

/**
 * POST to the team-notification dispatch route with the caller's session
 * attached.
 *
 * The route fans messages out to the studio's Discord/Slack/Teams webhooks
 * using the service role, so it must never accept an anonymous caller — an
 * unauthenticated POST would let anyone broadcast arbitrary text into the
 * team's channels. Every call site goes through here so the bearer token can't
 * be forgotten at one of them.
 *
 * Returns the raw Response: callers differ in whether they read the status, the
 * body, or neither, and this keeps that decision with them.
 */
export async function postNotify(body: Record<string, unknown>): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch('/api/integrations/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}
