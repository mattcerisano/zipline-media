-- Scope a freelance editor's account to the cards they are actually assigned.
--
-- 20260813000000 added the `editor` role and left the database alone, on the
-- reasoning that what an account can *reach* is decided in the app
-- (src/lib/roles.ts). That holds for the navigation, but not for the data: the
-- anon key ships in the page bundle, so an editor account has always been able
-- to open a console and read — or write — every row the "Authenticated full
-- access" policies cover. For an outside freelancer that means every
-- production, every contact's phone number, the budget, and the vault.
--
-- This migration makes the editor scope a database rule instead of a UI one:
--
--   * jobs         → SELECT/UPDATE only cards assigned to them, and only the
--                    board columns (a trigger enforces the column list)
--   * job_todos    → the delivery checklist on those same cards
--   * contacts     → their own Rolodex row and nothing else
--   * profiles     → their own row (scratch notes, display name)
--   * organizations→ read-only (the board's column definitions live there)
--   * user_roles   → their own row rather than the whole team roster
--   * everything else covered by 20260706000002 → no access at all
--
-- Nothing changes for admin, staff, or client accounts.

-- ---------------------------------------------------------------------------
-- 1. Link an account to a Rolodex contact.
-- ---------------------------------------------------------------------------
-- Assignment on the board is jobs.editor_id → contacts.id, but an account is
-- an auth user. Matching the two by email works until someone signs up with a
-- different address than the one in the Rolodex, and silently hands them an
-- empty board with no way to tell why. The link is now explicit, set when the
-- account is created (Settings → Team), with the email match kept as a
-- fallback so accounts made before this migration keep working.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS user_roles_contact_id_idx ON public.user_roles (contact_id);

-- ---------------------------------------------------------------------------
-- 2. Helpers.
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because these are called from policies on the very tables
-- they read: a plain query would be filtered by the policy being evaluated
-- (contacts) or recurse into it (user_roles). They take no arguments that
-- could widen what they answer for — the identity always comes from auth.uid()
-- — so definer rights cannot be turned into a lookup of someone else's row.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.user_roles WHERE id = auth.uid();
$$;

-- Which Rolodex contact is this account? The explicit link first, then the
-- email match for accounts that predate it. Parameterised so the API route can
-- ask the same question about the caller it just authenticated: the route and
-- the policies have to agree on who someone is, and the only way to guarantee
-- that is for both to read the same definition.
CREATE OR REPLACE FUNCTION public.contact_id_for_user(target_user UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT ur.contact_id FROM public.user_roles ur WHERE ur.id = target_user),
    -- Ordered so the answer is stable when a duplicate contact carries the
    -- same address.
    (SELECT c.id
       FROM public.user_roles ur
       JOIN public.contacts c ON LOWER(c.email) = LOWER(ur.email)
      WHERE ur.id = target_user AND ur.email IS NOT NULL AND ur.email <> ''
      ORDER BY c.created_at NULLS LAST, c.id
      LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_contact_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.contact_id_for_user(auth.uid());
$$;

-- True when the caller is one of the scoped outside accounts. Every "team"
-- policy below is re-issued as "…and not this", so a role added to this
-- function is locked out of everything by default and opened up deliberately.
CREATE OR REPLACE FUNCTION public.is_scoped_editor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- COALESCE, not a bare comparison: an account with no user_roles row yet (a
  -- first sign-in, mid self-provision) would otherwise answer NULL, and every
  -- "NOT is_scoped_editor()" policy below would deny rather than allow. A
  -- missing role has always meant "not scoped", and still does.
  SELECT COALESCE(public.current_app_role() = 'editor', FALSE);
$$;

-- Is this card assigned to the caller? Definer rights matter here: called from
-- job_todos' policy, an invoker-rights lookup would be filtered by the jobs
-- policy and the answer would depend on evaluation order.
CREATE OR REPLACE FUNCTION public.editor_owns_job(target_job UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.jobs j
     WHERE j.id = target_job
       AND j.editor_id IS NOT NULL
       AND j.editor_id = public.current_contact_id()
  );
$$;

REVOKE ALL ON FUNCTION public.contact_id_for_user(UUID) FROM PUBLIC;
-- Only the server may ask about an account other than the caller's own; a
-- signed-in browser gets current_contact_id(), which can only answer for itself.
GRANT EXECUTE ON FUNCTION public.contact_id_for_user(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_contact_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_scoped_editor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.editor_owns_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_contact_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_scoped_editor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.editor_owns_job(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Re-issue the team-wide policies with the editor excluded.
-- ---------------------------------------------------------------------------
-- Permissive policies are OR'd together, so narrowing has to happen inside the
-- existing policy rather than alongside it. Every table listed in
-- 20260706000002 (plus jobs, whose policy was re-created by 20260806000001)
-- keeps exactly the access it has today for everyone who is not an editor.
DO $$
DECLARE
  t TEXT;
  team_tables TEXT[] := ARRAY[
    'jobs', 'contacts', 'clients', 'projects', 'job_roles', 'job_schedules',
    'job_scenes', 'job_shotlist', 'job_todos', 'job_templates',
    'gear_templates', 'organizations', 'profiles', 'notification_channels',
    'notification_events', 'vault_meta', 'vault_items', 'budget_items',
    'calendar_events', 'social_campaigns', 'social_campaign_tasks',
    'social_deliverables', 'social_links', 'social_posts'
  ];
BEGIN
  FOREACH t IN ARRAY team_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Authenticated full access" ON public.%I FOR ALL TO authenticated '
        'USING (NOT public.is_scoped_editor()) WITH CHECK (NOT public.is_scoped_editor())', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Hand the editor back exactly the board.
-- ---------------------------------------------------------------------------

-- Cards assigned to them. No INSERT and no DELETE policy: an editor cannot
-- create or destroy a production. The WITH CHECK repeats the ownership test so
-- an update cannot hand the card to someone else — or to nobody — which would
-- otherwise let it disappear off their board irreversibly.
DROP POLICY IF EXISTS "Editors read their assigned cards" ON public.jobs;
CREATE POLICY "Editors read their assigned cards"
  ON public.jobs FOR SELECT
  TO authenticated
  USING (public.is_scoped_editor() AND editor_id = public.current_contact_id());

DROP POLICY IF EXISTS "Editors update their assigned cards" ON public.jobs;
CREATE POLICY "Editors update their assigned cards"
  ON public.jobs FOR UPDATE
  TO authenticated
  USING (public.is_scoped_editor() AND editor_id = public.current_contact_id())
  WITH CHECK (public.is_scoped_editor() AND editor_id = public.current_contact_id());

-- The delivery checklist on those cards.
DROP POLICY IF EXISTS "Editors work their assigned checklists" ON public.job_todos;
CREATE POLICY "Editors work their assigned checklists"
  ON public.job_todos FOR ALL
  TO authenticated
  USING (public.is_scoped_editor() AND public.editor_owns_job(job_id))
  WITH CHECK (public.is_scoped_editor() AND public.editor_owns_job(job_id));

-- Their own Rolodex row — the board hydrates the assignee on each card, and
-- with this it hydrates to them and stops there. The rest of the Rolodex
-- (every crew member's phone number and address) stays closed.
DROP POLICY IF EXISTS "Editors read their own contact" ON public.contacts;
CREATE POLICY "Editors read their own contact"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (public.is_scoped_editor() AND id = public.current_contact_id());

-- Their own profile row: display name and the per-user scratch pad, which is
-- the one non-tracker widget the role is allowed to mount.
DROP POLICY IF EXISTS "Editors manage their own profile" ON public.profiles;
CREATE POLICY "Editors manage their own profile"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_scoped_editor() AND id = auth.uid())
  WITH CHECK (public.is_scoped_editor() AND id = auth.uid());

-- The board's column definitions and branding live on the org row. Read-only:
-- an editor renaming or deleting a column would do it for the whole studio.
DROP POLICY IF EXISTS "Editors read org settings" ON public.organizations;
CREATE POLICY "Editors read org settings"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (public.is_scoped_editor());

-- ---------------------------------------------------------------------------
-- 5. Stop the roster being readable by an outside account.
-- ---------------------------------------------------------------------------
-- 20260806000000 restricted user_roles to authenticated users, which was the
-- right call for the team but still lets a freelancer enumerate every
-- teammate's email and role. Reads stay open within the team; an editor sees
-- their own row. The email arm keeps the login path's self-healing lookup
-- working, which runs before the account's id is known to the table.
DROP POLICY IF EXISTS "Authenticated read" ON public.user_roles;
CREATE POLICY "Authenticated read"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    NOT public.is_scoped_editor()
    OR id = auth.uid()
    OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- ---------------------------------------------------------------------------
-- 6. Which columns an editor may write.
-- ---------------------------------------------------------------------------
-- RLS decides rows, not columns, so without this an editor could rewrite the
-- client name, the rate, or the share token on a card they happen to be on.
-- The whitelist is the board: stage, notes, labels, deadline, review and
-- delivery links, and the creative fields. Anything else is rejected outright
-- rather than silently dropped, so a UI that starts sending a field it
-- shouldn't fails loudly in testing instead of quietly in production.
CREATE OR REPLACE FUNCTION public.enforce_editor_job_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  editable TEXT[] := ARRAY[
    'edit_status', 'edit_notes', 'edit_labels', 'due_date',
    'review_link', 'drive_folder_url', 'links',
    'creative_brief', 'color_palette', 'updated_at'
  ];
  old_row JSONB;
  new_row JSONB;
  col TEXT;
BEGIN
  -- Checked first so an ordinary team update costs one function call and no
  -- row serialisation.
  IF NOT public.is_scoped_editor() THEN
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);

  FOR col IN SELECT jsonb_object_keys(new_row)
  LOOP
    IF NOT (col = ANY (editable)) AND (new_row -> col) IS DISTINCT FROM (old_row -> col) THEN
      RAISE EXCEPTION 'An editor account may not change jobs.% on an edit card', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_editor_job_columns ON public.jobs;
CREATE TRIGGER enforce_editor_job_columns
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_editor_job_columns();
