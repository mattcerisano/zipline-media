-- Removes everything supabase/install/sample_data.sql added, and nothing else.
-- Rows are matched by the fixed ids that file uses (a5a5a5a5-0000-4000-8000-…),
-- so your own productions, clients and crew are untouched even if they share
-- a name. Safe to run twice.
--
-- Supabase → SQL Editor → New query → paste → run.

DELETE FROM public.drive_events WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.drives       WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.job_todos    WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.job_schedules WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.job_roles    WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.jobs         WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.projects     WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.contacts     WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.clients      WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
DELETE FROM public.inventory    WHERE id::text LIKE 'a5a5a5a5-0000-4000-8000-%';
