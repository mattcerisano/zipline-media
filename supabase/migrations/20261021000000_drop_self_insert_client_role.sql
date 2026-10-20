-- Drop the last way for an account to grant itself a role.
--
-- 20261020120000 dropped "Users can self-provision a client role" (from
-- 20260806000004), but 20260619000004 had created an older policy with the
-- same effect under a different name, "Allow users to insert their own client
-- role", and nothing ever removed it. 20260823000000 recorded it as present.
--
-- Risk today is low — sign-ups are off and removing a member deletes their
-- login — but the database only checks "signed in", not "has a role", so any
-- stray account could have inserted a client row for itself. Roles are
-- granted by admins only (the "Allow admin to insert user roles" policy).

DROP POLICY IF EXISTS "Allow users to insert their own client role" ON public.user_roles;

INSERT INTO public.schema_migrations (version) VALUES ('20261021000000_drop_self_insert_client_role')
  ON CONFLICT (version) DO NOTHING;
