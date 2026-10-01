-- Close the anonymous access the 2026-08-27 migrations opened.
--
-- 20260827000000_meeting_notes and 20260827000001_agency_expansion created
-- four tables with an "Allow all for now" policy: FOR ALL USING (true), with no
-- role. That covers `anon`, and the anon key ships in the page bundle, so
-- anyone could read — or write — meeting notes, client onboarding briefs,
-- review comments and scouted locations from a browser console. It "matched
-- other project tables" only as they were before 20260706000002 hardened them.
--
-- The tables are in production (and empty as of 2026-09-30), so the policy is
-- live even though neither file was recorded in schema_migrations. This
-- replaces it with the posture every other internal table has: signed-in team
-- accounts, not freelance editors (20260822000000). Client accounts keep
-- access, which the Client Review and Client Onboarding tabs rely on.
--
-- Safe to run whether or not the two August files were ever pasted in: every
-- table is guarded by an existence check. Running it also records those two
-- files, since their tables and jobs columns already exist; paste them only
-- if the tables below turn out to be missing.

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  agency_tables TEXT[] := ARRAY['meeting_notes', 'locations', 'client_intakes', 'video_reviews'];
BEGIN
  FOREACH t IN ARRAY agency_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Permissive policies are OR'd, so every existing one has to go, not
      -- just the one this migration knows the name of.
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated '
        'USING (NOT public.is_scoped_editor()) WITH CHECK (NOT public.is_scoped_editor())', t);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.schema_migrations (version) VALUES
  ('20260827000000_meeting_notes'),
  ('20260827000001_agency_expansion'),
  ('20260930235620_lock_down_agency_tables')
  ON CONFLICT (version) DO NOTHING;
