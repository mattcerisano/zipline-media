-- Quick calendar markers: lightweight, less-detail-oriented blocks the team
-- can drop on the Calendar tab via presets (Timeout, Book to Shoot, Planning
-- Shoot, Hold, Available, Travel Day, Edit Day) without creating a full Slate
-- production. Optional job_id allows "promote to production" later.
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  preset TEXT NOT NULL DEFAULT 'timeout',
  event_date DATE NOT NULL,
  end_date DATE,
  notes TEXT,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for now" ON calendar_events;
CREATE POLICY "Allow all for now" ON calendar_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events (event_date);
