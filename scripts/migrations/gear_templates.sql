-- Create gear_templates table
CREATE TABLE IF NOT EXISTS public.gear_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  items JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row-Level Security
ALTER TABLE public.gear_templates ENABLE ROW LEVEL SECURITY;

-- Allow anonymous and authenticated read/write access for testing
CREATE POLICY "Allow read access for all" ON public.gear_templates
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access for all" ON public.gear_templates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access for all" ON public.gear_templates
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access for all" ON public.gear_templates
  FOR DELETE USING (true);
