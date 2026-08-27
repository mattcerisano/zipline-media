-- Create meeting_notes table
CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sentiment TEXT NOT NULL DEFAULT 'neutral',
  attendees JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  scratchpad TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (aligns with existing tables in project)
DROP POLICY IF EXISTS "Allow all for now" ON meeting_notes;
CREATE POLICY "Allow all for now" ON meeting_notes FOR ALL USING (true) WITH CHECK (true);

-- Create index on client_id for performant queries
CREATE INDEX IF NOT EXISTS idx_meeting_notes_client_id ON meeting_notes (client_id);

-- Enable real-time updates for meeting_notes
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_notes;
