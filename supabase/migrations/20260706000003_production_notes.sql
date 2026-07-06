-- Production Notes: the team's meeting-notes / docs library. Every note can
-- be tied to a client and/or production so notes sort themselves instead of
-- living in one long Google Doc.
CREATE TABLE IF NOT EXISTS production_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  body TEXT NOT NULL DEFAULT '',
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  tags TEXT,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE production_notes ENABLE ROW LEVEL SECURITY;

-- Authenticated team members only (matches the security-hardening migration).
DROP POLICY IF EXISTS "Authenticated full access" ON production_notes;
CREATE POLICY "Authenticated full access" ON production_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_production_notes_job_id ON production_notes (job_id);
CREATE INDEX IF NOT EXISTS idx_production_notes_client_id ON production_notes (client_id);
CREATE INDEX IF NOT EXISTS idx_production_notes_updated_at ON production_notes (updated_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE production_notes;
