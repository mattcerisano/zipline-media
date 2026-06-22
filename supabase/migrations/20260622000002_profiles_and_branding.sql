-- =====================================================================
-- User profiles (#3) + modular org branding (#2)
--
-- Scaling model: each production company is an `organization` row that
-- owns its branding (logo, colors, company name, address). Users get a
-- `profiles` row linked to their org. Today there is one org; the schema
-- is multi-tenant ready so additional companies can be added later
-- without restructuring.
-- =====================================================================

-- 1. Organizations (one per production company) -------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Production Company',
  tagline TEXT,                              -- e.g. "CREATIVE VIDEO PRODUCTION"
  logo_url TEXT,                             -- public URL in the `branding` bucket
  brand_color TEXT NOT NULL DEFAULT '#0077FF',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed a single default organization if none exists.
INSERT INTO public.organizations (name, tagline, brand_color)
SELECT 'Zipline Media', 'Creative Video Production', '#0077FF'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations);

-- 2. Profiles (per auth user) ------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT,
  position TEXT,
  phone TEXT,
  address TEXT,
  email TEXT,
  avatar_url TEXT,                           -- public URL in the `avatars` bucket
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);

-- 3. RLS ---------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read org branding (needed to render exports).
DROP POLICY IF EXISTS "Authenticated can read organizations" ON public.organizations;
CREATE POLICY "Authenticated can read organizations"
  ON public.organizations FOR SELECT TO authenticated USING (true);

-- Only admins can change branding.
DROP POLICY IF EXISTS "Admins manage organizations" ON public.organizations;
CREATE POLICY "Admins manage organizations"
  ON public.organizations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin')
  );

-- Profiles: anyone authenticated can read (so crew can see each other);
-- a user can insert/update only their own row.
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;
CREATE POLICY "Authenticated can read profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Storage buckets for avatars + logos -------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for both buckets.
DROP POLICY IF EXISTS "Public read avatars and branding" ON storage.objects;
CREATE POLICY "Public read avatars and branding"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'branding'));

-- Authenticated users can upload/update/remove in these buckets.
DROP POLICY IF EXISTS "Authenticated write avatars and branding" ON storage.objects;
CREATE POLICY "Authenticated write avatars and branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'branding'));

DROP POLICY IF EXISTS "Authenticated update avatars and branding" ON storage.objects;
CREATE POLICY "Authenticated update avatars and branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars', 'branding'));

DROP POLICY IF EXISTS "Authenticated delete avatars and branding" ON storage.objects;
CREATE POLICY "Authenticated delete avatars and branding"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('avatars', 'branding'));
