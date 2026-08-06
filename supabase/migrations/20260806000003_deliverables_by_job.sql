-- Deliverables pinned to a production.
--
-- social_deliverables has carried a job_id column since it was created, but
-- nothing ever set it — the Social tab only ever links a deliverable to a
-- client. Slate cards now read and write that column, so a shoot carries the
-- list of cutdowns it owes.
--
-- Deliberately the same table rather than a new job_deliverables one: a
-- deliverable is the same object whichever screen you reached it from, and two
-- competing lists would drift the first time someone edited the "wrong" one.
--
-- Only the index is new. The Slate board queries by job_id for every card on
-- screen at once, which without this is a sequential scan per board load.

CREATE INDEX IF NOT EXISTS idx_social_deliverables_job
  ON public.social_deliverables (job_id);
