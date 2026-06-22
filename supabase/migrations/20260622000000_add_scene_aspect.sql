-- Migration to add Scene Grouping, Aspect Ratio composition, and Lighting Setup fields to job_shotlist
ALTER TABLE public.job_shotlist 
ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(20) DEFAULT '16:9',
ADD COLUMN IF NOT EXISTS lighting_setup VARCHAR(200),
ADD COLUMN IF NOT EXISTS scene_group VARCHAR(100) DEFAULT 'Scene 1';
