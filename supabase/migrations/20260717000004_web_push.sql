-- =====================================================================
-- Web push notifications — call-time reminders + @mention pings
--
--   * push_subscriptions — one row per browser/device push endpoint,
--     owned by an auth user. The user_email column (verified server-side
--     at subscribe time) is the bridge to Rolodex contacts and job_roles,
--     which identify people by email rather than auth id.
--   * push_prefs         — per-user toggles: call reminders on/off + lead
--     time, mention pings on/off. Missing row = defaults (everything on).
--   * push_sent_log      — dedupe ledger so the reminder cron, which runs
--     every 10 minutes, sends each reminder exactly once.
--   * organizations.timezone — call times are stored as wall-clock text
--     ("07:30 AM"); the cron needs a zone to know when that moment is.
-- =====================================================================

-- 1. Subscriptions ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email
  ON public.push_subscriptions(user_email);

-- 2. Per-user preferences ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  call_reminders BOOLEAN NOT NULL DEFAULT true,
  call_reminder_lead_minutes INTEGER NOT NULL DEFAULT 60,
  mention_pings BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Sent ledger (dedupe) ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_sent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Org timezone for wall-clock call times ----------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

-- 5. RLS ----------------------------------------------------------------
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_sent_log ENABLE ROW LEVEL SECURITY;

-- A push endpoint is a capability URL — anyone who knows it can send that
-- device a notification — so each user can only see/manage their own rows.
-- Server-side senders use the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own push prefs" ON public.push_prefs;
CREATE POLICY "Users manage own push prefs"
  ON public.push_prefs FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- push_sent_log has no client policies on purpose: only the reminder cron
-- (service role) reads and writes it.
