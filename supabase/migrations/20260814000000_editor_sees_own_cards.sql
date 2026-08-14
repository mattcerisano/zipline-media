-- Scope a freelance editor's board to the cards assigned to them.
--
-- The Edit Tracker already filters client-side, but a filter in the browser is
-- a convenience, not a boundary: the rows still arrive over the wire and are
-- readable in devtools. Since 20260806000001 closed the anonymous read on jobs,
-- this can be answered where it belongs — the row never leaves Postgres.
--
-- jobs currently carries one policy, "Authenticated full access" FOR ALL
-- USING (true). Permissive policies are OR'd together, so a stricter policy
-- added alongside it would do nothing; it has to be replaced by the four
-- role-aware policies below.
--
-- Only the 'editor' role is narrowed. Every other role — admin, staff, client,
-- and an account with no user_roles row at all (the owner-email bypass) — keeps
-- exactly the access it has today.
--
-- "Assigned to them" means: the job's editor_id points at a Rolodex contact
-- whose email matches the signed-in account's email. That is the same rule the
-- board's existing "My Cards" filter uses, so a freelancer's contact record and
-- their login must carry the same address — if they don't, the board is empty.

-- Reading the caller's role from inside a policy on another table needs to work
-- regardless of what RLS says about user_roles, so it goes through a definer
-- function. STABLE so it is evaluated once per statement rather than per row.
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_app_role() FROM public;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;

-- True when the caller may see every job — i.e. is anything but an editor.
-- IS DISTINCT FROM keeps a NULL role (no user_roles row) on the open side,
-- so the owner-email bypass is not locked out of its own database.
CREATE OR REPLACE FUNCTION public.sees_all_jobs()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IS DISTINCT FROM 'editor';
$$;

REVOKE ALL ON FUNCTION public.sees_all_jobs() FROM public;
GRANT EXECUTE ON FUNCTION public.sees_all_jobs() TO authenticated;

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'jobs'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.jobs', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- SELECT: everyone but an editor sees every job; an editor sees the jobs whose
-- assigned editor contact carries their email.
CREATE POLICY "Read jobs"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (
    public.sees_all_jobs()
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = jobs.editor_id
        AND LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

-- UPDATE: same test on both sides. USING stops an editor writing to a row they
-- cannot see (including one they guessed the id of); WITH CHECK stops them
-- reassigning a card away from themselves, or pulling an unassigned production
-- onto their own board, since the row must still be theirs afterwards.
CREATE POLICY "Update jobs"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (
    public.sees_all_jobs()
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = jobs.editor_id
        AND LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  )
  WITH CHECK (
    public.sees_all_jobs()
    OR EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = jobs.editor_id
        AND LOWER(c.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

-- Creating and deleting productions is not an editor's job in either sense.
CREATE POLICY "Insert jobs"
  ON public.jobs FOR INSERT
  TO authenticated
  WITH CHECK (public.sees_all_jobs());

CREATE POLICY "Delete jobs"
  ON public.jobs FOR DELETE
  TO authenticated
  USING (public.sees_all_jobs());
