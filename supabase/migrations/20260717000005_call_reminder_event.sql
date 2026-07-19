-- =====================================================================
-- Call-time reminders in team channels
--
-- The call-reminder cron already pushes to individual phones; this adds an
-- opt-in notification_events rule so the same reminder can also land in the
-- team's Discord/Slack/Teams channels one hour before the production's call
-- time (once per job per shoot day). Ships disabled — toggle it on under
-- Integrations → Team Notifications.
-- =====================================================================

INSERT INTO public.notification_events (org_id, event_key, enabled, message_template)
SELECT o.id, 'call_reminder', false,
  '⏰ **Call time {call_time}** — {title} for {client} @ {location}'
FROM (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) o
ON CONFLICT (org_id, event_key) DO NOTHING;
