-- Let freelance editor accounts use the Drive Tracker.
--
-- The drives mostly live with editors, so the studio wants them to log their
-- own hand-offs: check a drive out to themselves, mark one returned, add a
-- drive they were given. 20261015000000 gave the two drive tables the usual
-- team-only posture (NOT is_scoped_editor()); this widens both to every
-- signed-in account. Anon stays shut out.
--
-- Deliberately full access, not "only the drives you hold": the studio chose
-- to give editors the same tab staff have. Their other limits are untouched.
-- They still read only their own jobs and contact, so in the tracker the
-- project picker lists just their jobs, and other people's drives show no
-- project title.

DROP POLICY IF EXISTS "Authenticated full access" ON public.drives;
CREATE POLICY "Authenticated full access" ON public.drives
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.drive_events;
CREATE POLICY "Authenticated full access" ON public.drive_events
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.schema_migrations (version) VALUES ('20261019000000_drive_tracker_editor_access')
  ON CONFLICT (version) DO NOTHING;
