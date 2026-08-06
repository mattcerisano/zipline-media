-- Close the anonymous read on user_roles.
--
-- 20260619000007 opened SELECT to everyone ("USING (true)" with no role
-- restriction) to work around a client-side race: the role lookup fired before
-- the Supabase session was attached, so an authenticated-only policy returned
-- nothing and the app fell back to no role. The anon key ships in the browser
-- bundle, so the side effect was that anyone could enumerate every teammate's
-- email address and role.
--
-- The lookup now always runs after a session exists (it needs session.user.id
-- to query by), so restricting to `authenticated` fixes the leak without
-- reintroducing the race. Reads stay unrestricted *within* the signed-in team:
-- the login path's self-healing fallback looks a row up by email before it
-- knows the id, so a strict "only your own row" policy would break it.

DROP POLICY IF EXISTS "Allow read access to everyone" ON public.user_roles;
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.user_roles;
-- Drop our own policy too, so running this file a second time is a no-op
-- rather than a "policy already exists" error.
DROP POLICY IF EXISTS "Authenticated read" ON public.user_roles;

CREATE POLICY "Authenticated read"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);
