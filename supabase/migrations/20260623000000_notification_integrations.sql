-- =====================================================================
-- Team notification integrations
--
-- Generalizes the single hard-coded Discord webhook into a per-org
-- notification engine:
--   * notification_channels  — connected platforms (Discord/Slack/Teams)
--   * notification_events     — per-event toggle + editable message template
--
-- Job status transitions (e.g. Hold -> Booked) and new-job creation fan
-- out to every enabled channel using the matching event's template.
-- Org is treated as a singleton today (first organizations row), matching
-- how branding is loaded elsewhere; schema stays multi-tenant ready.
-- =====================================================================

-- 1. Channels ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('discord', 'slack', 'teams')),
  label TEXT,
  webhook_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (org_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_org_id
  ON public.notification_channels(org_id);

-- 2. Event rules -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  message_template TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (org_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_notification_events_org_id
  ON public.notification_events(org_id);

-- 3. Seed default channels (disabled, no URL) + event rules ------------
-- One channel placeholder per platform so the settings UI has a row to
-- edit. If a DISCORD_WEBHOOK_URL was used before, paste it into the
-- Discord channel from Settings -> Integrations.
INSERT INTO public.notification_channels (org_id, platform, label, enabled)
SELECT o.id, p.platform, p.label, false
FROM (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) o
CROSS JOIN (VALUES
  ('discord', 'Discord'),
  ('slack',   'Slack'),
  ('teams',   'Microsoft Teams')
) AS p(platform, label)
ON CONFLICT (org_id, platform) DO NOTHING;

-- Event rules. Only job_created + status_booked ship enabled; the rest
-- are available but off until a team toggles them on in the app.
INSERT INTO public.notification_events (org_id, event_key, enabled, message_template)
SELECT o.id, e.event_key, e.enabled, e.message_template
FROM (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) o
CROSS JOIN (VALUES
  ('job_created',      true,  '🎬 **New Production Added!** {title} for {client} — shoot {shoot_date} @ {location}'),
  ('status_planning',  false, '📝 **{title}** moved to Planning (was {old_status}).'),
  ('status_hold',      false, '⏳ **{title}** is now on Hold (was {old_status}).'),
  ('status_booked',    true,  '✅ **BOOKED!** {title} for {client} is confirmed for {shoot_date} @ {location}. (was {old_status})'),
  ('status_wrapped',   false, '🎉 **{title}** is Wrapped! Great work team.'),
  ('status_cancelled', false, '❌ **{title}** for {client} was Cancelled (was {old_status}).')
) AS e(event_key, enabled, message_template)
ON CONFLICT (org_id, event_key) DO NOTHING;

-- 4. RLS ---------------------------------------------------------------
-- Mirror the organizations pattern: any authenticated user can read,
-- only admins can write. Webhook URLs are sensitive, so no public read.
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read notification_channels" ON public.notification_channels;
CREATE POLICY "Authenticated can read notification_channels"
  ON public.notification_channels FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage notification_channels" ON public.notification_channels;
CREATE POLICY "Admins manage notification_channels"
  ON public.notification_channels FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin')
  );

DROP POLICY IF EXISTS "Authenticated can read notification_events" ON public.notification_events;
CREATE POLICY "Authenticated can read notification_events"
  ON public.notification_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage notification_events" ON public.notification_events;
CREATE POLICY "Admins manage notification_events"
  ON public.notification_events FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin')
  );
