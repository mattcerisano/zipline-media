-- A shared Vault for select people, and private personal vaults again.
--
-- Two things in one migration because they are one set of rules.
--
-- 1. Personal vaults stopped being private. 20260622000004 gave vault_meta and
--    vault_items "own rows only" policies, but 20260706000002 swept both tables
--    into its team-wide "Authenticated full access" list and dropped every
--    policy on them first, and 20260822000000 re-issued that for everyone but
--    freelance editors. The secrets themselves stayed safe — they are encrypted
--    in the browser with each person's own passphrase — but every teammate
--    could read the name, username and URL of everyone's entries, and delete
--    or overwrite them. Personal rows go back to their owner alone.
--
-- 2. A shared Vault. The studio wants passwords and other secure information
--    shared with select people, not everyone and not one person. An admin
--    keeps a member list (vault_members); only members can see shared items at
--    all. Shared items are encrypted in the browser like personal ones, with a
--    key derived from a team passphrase the members know — so the database
--    never holds anything readable, and getting into a member's Studio OS
--    account is not enough on its own. vault_shared_meta holds that
--    passphrase's salt and verifier (one row). Changing the passphrase
--    re-encrypts every shared item in one transaction (rotate_shared_vault),
--    which is what to do after removing someone who knew it.
--
-- Shared items live in vault_items with shared = true; user_id stays as
-- whoever created the item. Shared attachments go in the private `vault`
-- bucket under shared/. Like personal attachments, files are protected by
-- these access rules, not encrypted.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.vault_items
  ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_vault_items_shared ON public.vault_items(shared) WHERE shared;

CREATE TABLE IF NOT EXISTS public.vault_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row: the shared passphrase's PBKDF2 salt and a verifier (a known string
-- encrypted with the derived key), exactly as vault_meta holds them for a
-- personal vault. key_version counts passphrase changes.
CREATE TABLE IF NOT EXISTS public.vault_shared_meta (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  salt TEXT NOT NULL,
  verifier TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vault_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_shared_meta ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same reason as the editor helpers in
-- 20260822000000: called from policies on vault_members itself, an
-- invoker-rights lookup would recurse into the policy being evaluated. The
-- identity always comes from auth.uid(), so definer rights can't be turned
-- into a question about someone else. A freelance editor is never a member,
-- whatever the table says.

CREATE OR REPLACE FUNCTION public.is_vault_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT public.is_scoped_editor()
     AND EXISTS (SELECT 1 FROM public.vault_members WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(public.current_app_role() = 'admin', FALSE);
$$;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Every existing policy on the two vault tables goes first: permissive
-- policies are OR'd, so the old team-wide one would otherwise keep the doors
-- open whatever is added beside it.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies
             WHERE schemaname = 'public' AND tablename IN ('vault_items', 'vault_meta')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Personal vault: the owner and nobody else.
CREATE POLICY "Owner manages own vault meta"
  ON public.vault_meta FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Owner manages own personal items"
  ON public.vault_items FOR ALL TO authenticated
  USING (NOT shared AND user_id = auth.uid())
  WITH CHECK (NOT shared AND user_id = auth.uid());

-- Shared vault: any member reads and edits any shared item. New shared items
-- are stamped with their creator, but an edit by another member keeps that
-- original user_id, so the check doesn't pin it to the caller.
CREATE POLICY "Members manage shared items"
  ON public.vault_items FOR ALL TO authenticated
  USING (shared AND public.is_vault_member())
  WITH CHECK (shared AND public.is_vault_member());

-- The member list: members and admins can see it; only an admin changes it.
DROP POLICY IF EXISTS "Members and admins read vault members" ON public.vault_members;
CREATE POLICY "Members and admins read vault members"
  ON public.vault_members FOR SELECT TO authenticated
  USING (public.is_vault_member() OR public.is_app_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "Admins add vault members" ON public.vault_members;
CREATE POLICY "Admins add vault members"
  ON public.vault_members FOR INSERT TO authenticated
  WITH CHECK (public.is_app_admin());

DROP POLICY IF EXISTS "Admins remove vault members" ON public.vault_members;
CREATE POLICY "Admins remove vault members"
  ON public.vault_members FOR DELETE TO authenticated
  USING (public.is_app_admin());

-- The shared passphrase's salt and verifier: readable by members (to unlock)
-- and admins (to see that a shared vault exists); written by admins.
DROP POLICY IF EXISTS "Members and admins read shared vault meta" ON public.vault_shared_meta;
CREATE POLICY "Members and admins read shared vault meta"
  ON public.vault_shared_meta FOR SELECT TO authenticated
  USING (public.is_vault_member() OR public.is_app_admin());

DROP POLICY IF EXISTS "Admins write shared vault meta" ON public.vault_shared_meta;
CREATE POLICY "Admins write shared vault meta"
  ON public.vault_shared_meta FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Shared attachments: the shared/ folder of the private `vault` bucket, for
-- members only. Personal folders keep their per-user policies from
-- 20260622000004.
DROP POLICY IF EXISTS "Members read shared vault files" ON storage.objects;
CREATE POLICY "Members read shared vault files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'shared' AND public.is_vault_member());

DROP POLICY IF EXISTS "Members write shared vault files" ON storage.objects;
CREATE POLICY "Members write shared vault files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'shared' AND public.is_vault_member());

DROP POLICY IF EXISTS "Members update shared vault files" ON storage.objects;
CREATE POLICY "Members update shared vault files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'shared' AND public.is_vault_member());

DROP POLICY IF EXISTS "Members delete shared vault files" ON storage.objects;
CREATE POLICY "Members delete shared vault files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = 'shared' AND public.is_vault_member());

-- ---------------------------------------------------------------------------
-- Changing the shared passphrase
-- ---------------------------------------------------------------------------
-- The browser decrypts every shared item with the old key and re-encrypts it
-- with the new one; this writes all of it — the items and the new salt and
-- verifier — in a single transaction, so a failure part-way can never leave
-- some items under a key nobody can derive. Invoker rights: the caller's own
-- policies decide, which means an admin who is also a member.
CREATE OR REPLACE FUNCTION public.rotate_shared_vault(
  new_salt TEXT,
  new_verifier TEXT,
  items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  item JSONB;
  changed INTEGER := 0;
  total INTEGER;
BEGIN
  IF NOT (public.is_app_admin() AND public.is_vault_member()) THEN
    RAISE EXCEPTION 'Only an admin who is a member of the shared vault can change its passphrase.';
  END IF;

  -- Every shared item has to be in the batch. One left out would stay under
  -- the old key and become unreadable the moment the meta row changes.
  SELECT count(*) INTO total FROM public.vault_items WHERE shared;
  IF jsonb_array_length(items) <> total THEN
    RAISE EXCEPTION 'Expected % shared items, got %. Reload the vault and try again.', total, jsonb_array_length(items);
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    UPDATE public.vault_items
       SET secret_cipher = item->>'secret_cipher',
           notes_cipher = item->>'notes_cipher',
           updated_at = now()
     WHERE id = (item->>'id')::UUID AND shared;
    changed := changed + 1;
  END LOOP;

  UPDATE public.vault_shared_meta
     SET salt = new_salt,
         verifier = new_verifier,
         key_version = key_version + 1,
         updated_by = auth.uid(),
         updated_at = now()
   WHERE id = 1;

  RETURN changed;
END;
$$;

INSERT INTO public.schema_migrations (version) VALUES ('20261019221841_shared_vault')
  ON CONFLICT (version) DO NOTHING;
