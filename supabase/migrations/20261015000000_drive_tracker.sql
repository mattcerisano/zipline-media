-- Drive Tracker: every SSD and transfer drive the studio owns, who has it now,
-- and the trail of everyone who has had it.
--
-- Editor drives (Samsung T5/T7/T9, 1–4 TB) live with a freelance editor for
-- the length of a job. Transfer drives are small sticks couriered to an agency
-- that should come straight back once the footage is on their server. Both get
-- forgotten, and at current storage prices a forgotten drive is real money, so
-- the row carries what it cost and when it went out.
--
-- `drives` holds the current state; `drive_events` is append-only history
-- (checked out, returned, marked lost…) written by the app on every change.
--
-- Access matches the other internal tables (20260930235620): any signed-in
-- team account reads and writes, freelance editor accounts and anon do not.

CREATE TABLE IF NOT EXISTS public.drives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What's written on the drive: "ZM-07", "Blue T9", "Transfer 3".
  label TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'editor' CHECK (kind IN ('editor', 'transfer')),
  model TEXT,
  capacity_tb NUMERIC(6, 2),
  serial TEXT,
  purchase_price NUMERIC(10, 2),
  status TEXT NOT NULL DEFAULT 'in_office' CHECK (status IN ('in_office', 'out', 'lost', 'retired')),
  -- Who has it while status = 'out'. Free text so an agency, a courier or a
  -- one-off editor doesn't need a Rolodex entry first.
  holder_name TEXT,
  holder_type TEXT CHECK (holder_type IN ('editor', 'agency', 'client', 'other')),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  checked_out_at TIMESTAMPTZ,
  expected_back DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drives_status ON public.drives(status);

CREATE TABLE IF NOT EXISTS public.drive_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id UUID NOT NULL REFERENCES public.drives(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('added', 'checked_out', 'returned', 'lost', 'found', 'retired', 'note')),
  holder_name TEXT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  note TEXT,
  -- Who in the studio logged it.
  actor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drive_events_drive ON public.drive_events(drive_id, created_at DESC);

ALTER TABLE public.drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated full access" ON public.drives;
CREATE POLICY "Authenticated full access" ON public.drives
  FOR ALL TO authenticated
  USING (NOT public.is_scoped_editor()) WITH CHECK (NOT public.is_scoped_editor());

DROP POLICY IF EXISTS "Authenticated full access" ON public.drive_events;
CREATE POLICY "Authenticated full access" ON public.drive_events
  FOR ALL TO authenticated
  USING (NOT public.is_scoped_editor()) WITH CHECK (NOT public.is_scoped_editor());

CREATE OR REPLACE FUNCTION public.touch_drives_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_drives_updated_at ON public.drives;
CREATE TRIGGER touch_drives_updated_at
  BEFORE UPDATE ON public.drives
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_drives_updated_at();

-- Live updates, so a drive checked in on one laptop flips on everyone's screen.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'drives') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drives;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'drive_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.drive_events;
  END IF;
END $$;

INSERT INTO public.schema_migrations (version) VALUES ('20261015000000_drive_tracker')
  ON CONFLICT (version) DO NOTHING;
