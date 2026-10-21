-- Drive Tracker: what is on each drive.
--
-- The notes column was doing two jobs — "black drive, green tape" and
-- "Currently: Fantasticks Press Day, 860 B-roll" in the same box. Notes stays
-- the physical description; this holds the projects and footage on the drive,
-- so it can be searched and read at a glance on the card.
ALTER TABLE public.drives ADD COLUMN IF NOT EXISTS contents TEXT;

INSERT INTO public.schema_migrations (version) VALUES ('20261021010000_drive_contents')
  ON CONFLICT (version) DO NOTHING;
