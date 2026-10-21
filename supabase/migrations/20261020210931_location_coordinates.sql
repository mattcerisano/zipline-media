-- Coordinates for the map on the Locations tab.
--
-- The map pins every production (jobs.location_address) and every scouted
-- location (locations.address). Looking an address up with Google costs a
-- request, so it is done once and kept here rather than on every map view:
--
--   latitude, longitude — where the address is. Null until it has been looked
--                         up, or when Google couldn't find it.
--   geocoded_address    — the exact text those coordinates came from. When the
--                         address is edited it no longer matches, so the row
--                         is looked up again; an address Google couldn't find
--                         keeps its text with no coordinates, so it isn't
--                         retried on every visit.
--
-- Existing rows have no coordinates until an admin presses "Place on map" on
-- the Locations tab (a one-time backfill); new and edited addresses are placed
-- as they're saved or the next time the map opens.
--
-- No new policies: the columns fall under each table's existing RLS.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_address TEXT;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_address TEXT;

INSERT INTO public.schema_migrations (version) VALUES ('20261020210931_location_coordinates')
  ON CONFLICT (version) DO NOTHING;
