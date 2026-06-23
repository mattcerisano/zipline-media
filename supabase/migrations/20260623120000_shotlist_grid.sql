-- Workstream A: Spreadsheet-style shotlist (Production Bible parity)
-- Adds scene-level metadata and the extra per-shot columns the producer's
-- Google Sheets shotlist uses (timing, subject, movement, lens, animation
-- link, timecode, lyrics, notes, take/best, est takes, priority).

-- Scene / "Setup" metadata: one row per scene within a job.
CREATE TABLE IF NOT EXISTS job_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  setup_number TEXT,
  name TEXT,
  timecode TEXT,
  description TEXT,
  notes TEXT,
  est_minutes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE job_scenes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for now" ON job_scenes;
CREATE POLICY "Allow all for now" ON job_scenes FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_job_scenes_job_id ON job_scenes (job_id);

-- Extend the shotlist with the spreadsheet columns. scene_id links a shot to
-- its job_scenes row; scene_group (existing TEXT) is kept as a label fallback.
ALTER TABLE public.job_shotlist
  ADD COLUMN IF NOT EXISTS scene_id UUID REFERENCES job_scenes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS timing TEXT,
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS movement TEXT,
  ADD COLUMN IF NOT EXISTS lens TEXT,
  ADD COLUMN IF NOT EXISTS animation_link TEXT,
  ADD COLUMN IF NOT EXISTS animation_label TEXT,
  ADD COLUMN IF NOT EXISTS timecode TEXT,
  ADD COLUMN IF NOT EXISTS lyrics TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS take_best TEXT,
  ADD COLUMN IF NOT EXISTS est_takes TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'must';

CREATE INDEX IF NOT EXISTS idx_job_shotlist_scene_id ON public.job_shotlist (scene_id);
