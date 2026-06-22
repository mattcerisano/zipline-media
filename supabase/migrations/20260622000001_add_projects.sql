-- =====================================================================
-- Client → Project → Job hierarchy
-- A production company works for several clients (agencies/shows). Each
-- client can have multiple long-running projects (e.g. "Moulin Rouge"),
-- and each project contains many jobs (the individual videos/shoots).
-- This migration is additive: existing jobs keep working with a flat
-- client_name string; project_id / client_id are optional links.
-- =====================================================================

-- 1. Projects table -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On Hold', 'Completed', 'Archived')),
  color TEXT, -- optional hex used for calendar/badge tinting
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Link jobs to a client and a project (both optional / additive) ------
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 3. Indexes for the common "filter by client, then project" queries -----
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON public.jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON public.jobs(project_id);

-- 4. RLS: mirror the jobs policy (admins/staff full access, clients read) -
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Staff have full access to projects" ON public.projects;
CREATE POLICY "Admins and Staff have full access to projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role IN ('admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read projects" ON public.projects;
CREATE POLICY "Authenticated users can read projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

-- 5. Backfill: link jobs whose client_name matches an existing client ----
UPDATE public.jobs j
SET client_id = c.id
FROM public.clients c
WHERE j.client_id IS NULL
  AND j.client_name IS NOT NULL
  AND lower(trim(j.client_name)) = lower(trim(c.name));
