-- =====================================================================
-- Enable Supabase Realtime for live team collaboration.
-- A table only emits postgres_changes events if it belongs to the
-- `supabase_realtime` publication. `jobs` was already enabled (used by the
-- public share page); this adds the remaining shared tables so every
-- teammate's open tabs update within ~1s when anyone makes a change.
--
-- Idempotent: each table is added only if not already a publication member.
-- Realtime still respects RLS, so users only receive rows they can read.
-- =====================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['jobs', 'clients', 'projects', 'contacts', 'inventory', 'gear_templates'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
