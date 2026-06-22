-- Drop the recursive policy that caused infinite recursion for authenticated users querying user_roles
DROP POLICY IF EXISTS "Allow write access to admin" ON public.user_roles;

-- Create individual policies for write actions to avoid SELECT recursion
DROP POLICY IF EXISTS "Allow admin to insert user roles" ON public.user_roles;
CREATE POLICY "Allow admin to insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow admin to update user roles" ON public.user_roles;
CREATE POLICY "Allow admin to update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow admin to delete user roles" ON public.user_roles;
CREATE POLICY "Allow admin to delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  );
