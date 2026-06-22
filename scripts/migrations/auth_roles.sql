-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'client')) DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policies for user_roles
CREATE POLICY "Allow read access to authenticated users" 
  ON public.user_roles FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow write access to admin" 
  ON public.user_roles FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Enable RLS on jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Policies for jobs
CREATE POLICY "Admins and Staff have full access to jobs"
  ON public.jobs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Clients can view their own jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.clients c ON LOWER(c.email) = LOWER(ur.email)
      WHERE ur.id = auth.uid() AND ur.role = 'client'
      AND LOWER(jobs.client_name) = LOWER(c.name)
    )
  );
