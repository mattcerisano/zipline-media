-- Let a new sign-in create its own role row.
--
-- The login path (command-center/page.tsx) looks a user up in user_roles and,
-- finding nothing, inserts { id, email, role: 'client' }. But the only INSERT
-- policy on the table — from 20260620000000 — requires the caller to already
-- be an admin in user_roles:
--
--   WITH CHECK (EXISTS (SELECT 1 FROM user_roles
--                       WHERE id = auth.uid() AND role = 'admin'))
--
-- A brand-new user is by definition not in that table, so the insert is always
-- denied. The error is caught and they fall through to client access for the
-- session, which is why nobody is locked out and nobody is over-privileged —
-- but no row is ever written. They never appear in the Team tab, and the
-- lookup re-runs from scratch on every login.
--
-- This grants exactly the insert the login path attempts and nothing more:
-- your own id, and only the 'client' role. Self-promotion is impossible —
-- role = 'client' is checked, so an attempt to insert 'admin' is refused, and
-- id = auth.uid() stops anyone writing a row for someone else. Admins keep
-- their broader policy for creating teammates at other roles.
--
-- Accounts made through Settings → Team are unaffected either way: that route
-- writes with the service key, which bypasses RLS entirely.

DROP POLICY IF EXISTS "Users can self-provision a client role" ON public.user_roles;

CREATE POLICY "Users can self-provision a client role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'client');
