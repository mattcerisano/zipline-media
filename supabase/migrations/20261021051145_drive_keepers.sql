-- Who available drives live with, as a team setting.
--
-- The Drive Tracker used to hard-code the studio's two owners as the people a
-- returned drive lands with. Another studio running Studio OS has different
-- people, so the names now come from the organization row and are edited in
-- Settings → Team → Drive keepers. NULL means the original pair (see
-- DEFAULT_DRIVE_KEEPERS in src/lib/drives.ts), so nothing changes until
-- someone saves a list.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS drive_keepers JSONB;

INSERT INTO public.schema_migrations (version) VALUES ('20261021051145_drive_keepers')
  ON CONFLICT (version) DO NOTHING;
