-- Budget line items for the Budget workspace tool. Rows may be tied to a
-- production (job_id) or stand alone (job_id NULL = "General" bucket).
CREATE TABLE IF NOT EXISTS budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Misc',
  description TEXT NOT NULL,
  estimated NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (aligns with existing tables in project)
DROP POLICY IF EXISTS "Allow all for now" ON budget_items;
CREATE POLICY "Allow all for now" ON budget_items FOR ALL USING (true) WITH CHECK (true);

-- Create index on job_id for performant queries
CREATE INDEX IF NOT EXISTS idx_budget_items_job_id ON budget_items (job_id);

-- Enable real-time updates for budget_items
-- Realtime, only if not already a member (so this file can run twice).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['budget_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
