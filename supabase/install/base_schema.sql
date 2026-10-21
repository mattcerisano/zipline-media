-- The five tables everything else builds on: inventory, clients, contacts,
-- jobs, job_roles. They predate the migrations folder (the original database
-- was created from scripts/migrations/supabase_schema.sql by hand in 2026),
-- so no migration creates them. This is that file made safe to re-run; the
-- migrations that follow add every later column and replace these permissive
-- policies with the real ones (20260706000002_security_hardening and on).
--
-- Part of supabase/install/install.sql — see docs/INSTALL_NEW_STUDIO.md.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  replacement DECIMAL(10, 2) NOT NULL DEFAULT 0,
  image TEXT,
  owner TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  primary_role TEXT,
  location_city TEXT,
  location_state TEXT,
  location_country TEXT,
  tags TEXT,
  notes_general TEXT,
  is_favorite BOOLEAN DEFAULT false,
  job_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  client_name TEXT,
  production_company TEXT,
  job_status TEXT DEFAULT 'Planning',
  type TEXT DEFAULT 'production',
  shoot_date DATE,
  end_date DATE,
  call_time TEXT,
  location_name TEXT,
  location_address TEXT,
  nearest_hospital_name TEXT,
  nearest_hospital_address TEXT,
  nearest_hospital_phone TEXT,
  nearest_parking_name TEXT,
  nearest_parking_address TEXT,
  weather_summary TEXT,
  gear_list_url TEXT,
  gear_manifest JSONB DEFAULT '{}'::jsonb,
  quote_url TEXT,
  estimate_url TEXT,
  notes_general TEXT,
  discord_url TEXT,
  review_link TEXT,
  review_password TEXT,
  drive_folder_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.job_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  name TEXT, -- Fallback if no contact_id
  position TEXT NOT NULL,
  department TEXT,
  phone TEXT,
  email TEXT,
  call_time TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_roles ENABLE ROW LEVEL SECURITY;

-- The original "anyone can do anything" policies. Kept so the migrations see
-- the database they were written against; 20260706000002 drops them.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventory', 'clients', 'contacts', 'jobs', 'job_roles'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Allow public read access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Allow public read access" ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all for now" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Allow all for now" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
