-- =====================================================================
-- Link emails to jobs (#6)
-- A job is usually associated with an email contact and/or a specific
-- Gmail thread (review/approval, logistics, etc.). These columns let the
-- inbox and the slate cross-reference each other.
-- =====================================================================
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS email_thread_id TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS email_thread_subject TEXT;

CREATE INDEX IF NOT EXISTS idx_jobs_email_thread_id ON public.jobs(email_thread_id);
