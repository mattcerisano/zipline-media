-- First admin for a fresh Studio OS database.
--
-- Nobody can get into the Command Center until one account is an admin. The
-- running app has no way to grant that from nothing (an admin adds everyone
-- else under Settings → Team), so the very first one is granted here.
--
-- Before running this:
--   1. Supabase → Authentication → Users → Add user → "Create new user".
--      Enter the email and a password, tick "Auto Confirm User".
--   2. Supabase → Authentication → Sign In / Providers → Email: turn
--      "Allow new users to sign up" OFF. Nobody outside the team should be
--      able to create an account; the admin creates them from Settings → Team.
--
-- Then edit the email on the first line, paste the whole file into
-- Supabase → SQL Editor → New query, and run it. Safe to re-run: an existing
-- row is promoted to admin rather than duplicated.
--
-- The alternative is OWNER_EMAIL on Vercel (see docs/INSTALL_NEW_STUDIO.md),
-- which lets that one address in as admin without a row here. Doing both is
-- fine.

DO $$
DECLARE
  admin_email CONSTANT TEXT := 'owner@example.com';   -- ← change this
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(admin_email) LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No auth user with email %. Create it under Authentication → Users first.', admin_email;
  END IF;

  INSERT INTO public.user_roles (id, email, role)
  VALUES (uid, lower(admin_email), 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;

  RAISE NOTICE '% is now an admin.', admin_email;
END $$;
