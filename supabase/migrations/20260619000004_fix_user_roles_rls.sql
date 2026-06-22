-- Allow users to insert their own initial role as 'client' upon first login
CREATE POLICY "Allow users to insert their own client role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND role = 'client');
