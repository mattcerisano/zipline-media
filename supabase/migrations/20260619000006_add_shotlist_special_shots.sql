-- Add is_special column to job_shotlist table to distinguish specialty shots
ALTER TABLE public.job_shotlist 
ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT false;
