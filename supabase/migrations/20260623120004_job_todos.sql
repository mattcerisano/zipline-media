-- Create job_todos table
CREATE TABLE IF NOT EXISTS job_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE job_todos ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (aligns with existing tables in project)
DROP POLICY IF EXISTS "Allow all for now" ON job_todos;
CREATE POLICY "Allow all for now" ON job_todos FOR ALL USING (true) WITH CHECK (true);

-- Create index on job_id for performant queries
CREATE INDEX IF NOT EXISTS idx_job_todos_job_id ON job_todos (job_id);

-- Enable real-time updates for job_todos
-- Realtime, only if not already a member (so this file can run twice).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['job_todos'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
