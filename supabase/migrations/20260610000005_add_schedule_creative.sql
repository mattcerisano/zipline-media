-- Add Creative fields to jobs
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS creative_brief TEXT,
ADD COLUMN IF NOT EXISTS color_palette JSONB DEFAULT '[]'::jsonb;

-- Create Job Schedules table
CREATE TABLE IF NOT EXISTS job_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  start_time TEXT NOT NULL,
  end_time TEXT,
  task TEXT NOT NULL,
  location TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Job Shotlist table
CREATE TABLE IF NOT EXISTS job_shotlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  shot_number TEXT,
  description TEXT NOT NULL,
  framing TEXT,
  equipment TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE job_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON job_schedules FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE job_shotlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON job_shotlist FOR ALL USING (true) WITH CHECK (true);
