-- Drop the authenticated-only read policy
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.user_roles;

-- Allow read access to anyone (public) for user roles table to prevent client-side token latency issues
DROP POLICY IF EXISTS "Allow read access to everyone" ON public.user_roles;
CREATE POLICY "Allow read access to everyone"
  ON public.user_roles FOR SELECT
  USING (true);
