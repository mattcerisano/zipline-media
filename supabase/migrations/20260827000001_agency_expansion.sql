-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  permit_details TEXT,
  power_specs TEXT,
  parking_capacity TEXT,
  rating INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create client_intakes table
CREATE TABLE IF NOT EXISTS client_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  creative_brief TEXT NOT NULL,
  aspect_ratios TEXT[] DEFAULT ARRAY['16:9'],
  reference_links TEXT[] DEFAULT ARRAY[]::text[],
  status TEXT DEFAULT 'pending_review',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create video_reviews table
CREATE TABLE IF NOT EXISTS video_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  version_number INT DEFAULT 1,
  video_url TEXT NOT NULL,
  comments JSONB DEFAULT '[]'::jsonb,
  approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_reviews ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now, matching other project tables)
DROP POLICY IF EXISTS "Allow all for now" ON locations;
CREATE POLICY "Allow all for now" ON locations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for now" ON client_intakes;
CREATE POLICY "Allow all for now" ON client_intakes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for now" ON video_reviews;
CREATE POLICY "Allow all for now" ON video_reviews FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_intakes_client_id ON client_intakes (client_id);
CREATE INDEX IF NOT EXISTS idx_video_reviews_job_id ON video_reviews (job_id);

-- Enable real-time updates for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE locations, client_intakes, video_reviews;

-- 6. Add financial tracking columns to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS gear_budget NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS actual_expenses JSONB DEFAULT '[]'::jsonb;
