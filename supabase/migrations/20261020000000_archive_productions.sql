-- Archive a production without deleting it.
--
-- An archived production keeps everything — crew, gear list, links, budget —
-- but leaves the Slate's lists (it sits in an Archived folder at the bottom)
-- and the production pickers in the Gear Builder and Edit Tracker. Useful for
-- a project that never got a date, or finished work worth keeping.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_archived_at ON public.jobs (archived_at) WHERE archived_at IS NOT NULL;

INSERT INTO public.schema_migrations (version) VALUES ('20261020000000_archive_productions')
  ON CONFLICT (version) DO NOTHING;
