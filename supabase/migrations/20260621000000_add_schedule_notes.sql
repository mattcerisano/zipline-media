-- Add notes column to job_schedules table
ALTER TABLE job_schedules ADD COLUMN IF NOT EXISTS notes TEXT;
