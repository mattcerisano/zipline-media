-- Run this in your Supabase SQL Editor to support the new features

-- 1. Add financial tracking columns to job_roles
ALTER TABLE job_roles 
ADD COLUMN IF NOT EXISTS day_rate NUMERIC,
ADD COLUMN IF NOT EXISTS flat_fee NUMERIC,
ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT false;

-- 2. Create the job_templates table for the Crew Templates feature
CREATE TABLE IF NOT EXISTS job_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable security for the templates table
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON job_templates FOR ALL USING (true) WITH CHECK (true);
