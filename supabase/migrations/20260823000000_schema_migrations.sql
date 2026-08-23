-- A record of which migrations have actually been run.
--
-- Migrations here are applied by hand, pasted into Supabase's SQL editor, and
-- until now nothing wrote down that it happened. The only evidence a migration
-- had been applied was prose in a merge commit ("Both migrations are applied"),
-- which means answering "is the database up to date?" meant reading git history
-- and inferring. That is worse than it sounds, because several code paths
-- deliberately fall back when a migration has not run (see the marker push in
-- src/lib/marker-sync.ts): a missing migration does not raise an error, it
-- quietly keeps the old behaviour.
--
-- `version` is the filename without `.sql`, not the timestamp prefix. Three
-- files share the prefix 20260822000000 and two share 20260822000001, because
-- parallel branches each picked the same timestamp; the descriptive half is
-- what actually distinguishes them. See docs/MIGRATIONS.md.
--
-- No policies are granted. Only the service role reads this, the same posture
-- as google_tokens and calendar_event_google_links.

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- TRUE for rows written by the backfill below, whose applied_at is the date
  -- this table was created rather than the date the migration really ran.
  backfilled BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Backfill: every migration in the repo as of 2026-08-23.
--
-- READ THIS BEFORE RUNNING. This assumes you have applied all of them, which
-- is true if the corresponding features work. It cannot be verified from the
-- repo. If you know you skipped one, delete its line before running -- a row
-- here is a claim the migration ran, and a wrong claim is worse than no
-- record, because the checker will report it as done.
--
-- ON CONFLICT DO NOTHING makes the whole file safe to run twice.
-- ---------------------------------------------------------------------------

INSERT INTO public.schema_migrations (version, backfilled) VALUES
  ('20260610000000_add_job_financials', TRUE),
  ('20260610000001_add_job_links', TRUE),
  ('20260610000002_add_edit_tracking', TRUE),
  ('20260610000003_add_edit_notes', TRUE),
  ('20260610000004_add_trello_features', TRUE),
  ('20260610000005_add_schedule_creative', TRUE),
  ('20260619000000_gear_templates', TRUE),
  ('20260619000001_auth_roles', TRUE),
  ('20260619000002_google_tokens', TRUE),
  ('20260619000003_add_google_event_id', TRUE),
  ('20260619000004_fix_user_roles_rls', TRUE),
  ('20260619000005_add_performance_indexes', TRUE),
  ('20260619000006_add_shotlist_special_shots', TRUE),
  ('20260619000007_public_read_user_roles', TRUE),
  ('20260620000000_fix_user_roles_recursion', TRUE),
  ('20260621000000_add_schedule_notes', TRUE),
  ('20260622000000_add_scene_aspect', TRUE),
  ('20260622000001_add_projects', TRUE),
  ('20260622000002_profiles_and_branding', TRUE),
  ('20260622000003_job_email_link', TRUE),
  ('20260622000004_vault', TRUE),
  ('20260622000005_enable_realtime', TRUE),
  ('20260623000000_notification_integrations', TRUE),
  ('20260623120000_shotlist_grid', TRUE),
  ('20260623120001_social_media', TRUE),
  ('20260623120002_calendar_events', TRUE),
  ('20260623120003_calendar_events_realtime', TRUE),
  ('20260623120004_job_todos', TRUE),
  ('20260706000000_budget_items', TRUE),
  ('20260706000001_org_edit_stages', TRUE),
  ('20260706000002_security_hardening', TRUE),
  ('20260706000003_production_notes', TRUE),
  ('20260717000000_crew_order_tracker_optin_google_events', TRUE),
  ('20260717000001_google_sync_status', TRUE),
  ('20260717000002_team_synced_prefs', TRUE),
  ('20260717000003_calendar_marker_tombstones', TRUE),
  ('20260805000000_quickbooks', TRUE),
  ('20260806000000_user_roles_authenticated_read', TRUE),
  ('20260806000001_share_token', TRUE),
  ('20260806000002_restore_inventory_public_read', TRUE),
  ('20260806000003_deliverables_by_job', TRUE),
  ('20260806000004_self_provision_client_role', TRUE),
  ('20260807000000_job_wrap_time', TRUE),
  ('20260807000001_usage_events', TRUE),
  ('20260813000000_add_editor_role', TRUE),
  ('20260814000000_calendar_event_times', TRUE),
  ('20260814000001_contact_secondary_roles', TRUE),
  ('20260822000000_dismissed_duplicate_pairs', TRUE),
  ('20260822000000_editor_card_scope', TRUE),
  ('20260822000000_studio_calendar', TRUE),
  ('20260822000001_edit_time_tracking', TRUE),
  ('20260822000001_marker_fanout_and_orphans', TRUE)
ON CONFLICT (version) DO NOTHING;

-- This migration records itself -- not backfilled, since it is running now.
-- Every migration from here on ends with a line like this one.
INSERT INTO public.schema_migrations (version) VALUES ('20260823000000_schema_migrations')
  ON CONFLICT (version) DO NOTHING;
