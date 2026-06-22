-- Index for calendar date-range lookups and list sorting
CREATE INDEX IF NOT EXISTS idx_jobs_shoot_date ON public.jobs (shoot_date DESC);

-- Index for Google Calendar sync queries
CREATE INDEX IF NOT EXISTS idx_jobs_google_event_id ON public.jobs (google_event_id);

-- Index for Edit Tracker editor relationship joins
CREATE INDEX IF NOT EXISTS idx_jobs_editor_id ON public.jobs (editor_id);

-- Indexes for crew templates and role assignments
CREATE INDEX IF NOT EXISTS idx_job_roles_job_id ON public.job_roles (job_id);
CREATE INDEX IF NOT EXISTS idx_job_roles_contact_id ON public.job_roles (contact_id);

-- Indexes for shotlists and schedules
CREATE INDEX IF NOT EXISTS idx_job_shotlist_job_id ON public.job_shotlist (job_id);
CREATE INDEX IF NOT EXISTS idx_job_schedules_job_id ON public.job_schedules (job_id);
