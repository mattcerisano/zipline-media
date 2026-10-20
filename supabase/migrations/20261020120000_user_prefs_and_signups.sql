-- Personal settings that follow you between devices, and no more
-- self-granted access.
--
-- 1. user_prefs: one row per personal setting (today, your panel layouts),
--    readable and writable only by you. Until this runs, layouts stay saved
--    on each device.
--
-- 2. Unknown sign-ins used to give themselves the client role — the login
--    page inserted it, and 20260806000004 added the policy that let it. Outside
--    clients never log in, so that only ever let in accounts nobody added. The
--    app no longer does it; this removes the policy so it can't be done by
--    hand either. Admins add people under Settings → Team (the service key,
--    which isn't affected).
--
-- Run once in the Supabase SQL editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.user_prefs (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own prefs only" ON public.user_prefs;
CREATE POLICY "Own prefs only"
  ON public.user_prefs FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can self-provision a client role" ON public.user_roles;

INSERT INTO public.schema_migrations (version) VALUES ('20261020120000_user_prefs_and_signups')
  ON CONFLICT (version) DO NOTHING;
