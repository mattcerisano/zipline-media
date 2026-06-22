-- Add google_event_id column to jobs table to link with Google Calendar
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS google_event_id TEXT;
