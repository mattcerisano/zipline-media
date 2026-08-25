-- A record of which migrations have actually been run.
--
-- Migrations here are applied by hand, pasted into Supabase's SQL editor, and
-- until now nothing wrote down that it happened, so answering "is the database
-- up to date?" meant reading git history and inferring. That is worse than it
-- sounds, because several code paths deliberately fall back when a migration
-- has not run (see the marker push in src/lib/marker-sync.ts): a missing
-- migration does not raise an error, it quietly keeps the old behaviour.
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
  -- How this row knows the migration ran:
  --   'recorded' — the migration inserted this itself, as it ran.
  --   'verified' — the backfill below found the change present in the schema.
  --   'assumed'  — the backfill could not check; see the note in that section.
  basis TEXT NOT NULL DEFAULT 'recorded'
);

-- Defensive, in case an earlier draft of this file created the table.
ALTER TABLE public.schema_migrations
  ADD COLUMN IF NOT EXISTS basis TEXT NOT NULL DEFAULT 'recorded';

ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Probes. Each asks the live schema whether one migration's change is present,
-- rather than taking anyone's word for it. Created in pg_temp so they vanish
-- with the session and leave nothing behind.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.has_rel(name TEXT) RETURNS BOOLEAN
  LANGUAGE sql STABLE AS $$
    -- Tables and indexes both live in pg_class, so this covers both.
    SELECT to_regclass('public.' || quote_ident(name)) IS NOT NULL;
  $$;

CREATE OR REPLACE FUNCTION pg_temp.has_col(tbl TEXT, col TEXT) RETURNS BOOLEAN
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
    );
  $$;

CREATE OR REPLACE FUNCTION pg_temp.has_policy(tbl TEXT, pol TEXT) RETURNS BOOLEAN
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol
    );
  $$;

CREATE OR REPLACE FUNCTION pg_temp.in_realtime(tbl TEXT) RETURNS BOOLEAN
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    );
  $$;

CREATE OR REPLACE FUNCTION pg_temp.google_tokens_locked_down() RETURNS BOOLEAN
  LANGUAGE sql STABLE AS $$
    -- 20260706000002 stripped every policy off google_tokens and turned RLS on,
    -- leaving it service-role only. Nothing since re-adds a policy there, so
    -- "RLS on and no policies" is that migration's durable signature.
    SELECT COALESCE(
      (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.google_tokens')),
      FALSE
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'google_tokens'
    );
  $$;

CREATE OR REPLACE FUNCTION pg_temp.user_roles_allows_editor() RETURNS BOOLEAN
  LANGUAGE sql STABLE AS $$
    -- 20260813000000 rewrote the role CHECK constraint to admit 'editor'.
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'user_roles'
        AND c.contype = 'c' AND pg_get_constraintdef(c.oid) ILIKE '%editor%'
    );
  $$;

-- ---------------------------------------------------------------------------
-- Backfill: the 52 migrations that existed on 2026-08-23.
--
-- Each row is recorded ONLY if its probe finds the change in this database, so
-- this asserts nothing it has not checked. A migration you never ran simply
-- does not get a row, and check-applied.mjs will list it as pending.
--
-- Two rows are 'assumed' rather than verified. Both did nothing but create an
-- RLS policy that a LATER migration dropped and replaced, so there is no trace
-- of their own effect left to look for:
--   20260619000007_public_read_user_roles        (superseded by 20260806000000)
--   20260806000000_user_roles_authenticated_read (superseded by editor_card_scope)
-- They are gated on user_roles.contact_id — the mark of 20260822000000_editor_
-- card_scope, which is what dropped the last of their policies. A database that
-- has reached that point has passed through theirs. That is an inference from a
-- later migration's evidence, not a check of their own, which is why the basis
-- is 'assumed': on a database that never got that far, neither is recorded.
--
-- Safe to run twice: ON CONFLICT DO NOTHING. Re-running after applying a
-- missing migration will pick it up.
-- ---------------------------------------------------------------------------

INSERT INTO public.schema_migrations (version, basis)
SELECT version, basis
FROM (VALUES
  ('20260610000000_add_job_financials',                     'verified',  pg_temp.has_rel('job_templates')),
  ('20260610000001_add_job_links',                          'verified',  pg_temp.has_col('jobs','links')),
  ('20260610000002_add_edit_tracking',                      'verified',  pg_temp.has_col('jobs','edit_status')),
  ('20260610000003_add_edit_notes',                         'verified',  pg_temp.has_col('jobs','edit_notes')),
  ('20260610000004_add_trello_features',                    'verified',  pg_temp.has_col('jobs','due_date')),
  ('20260610000005_add_schedule_creative',                  'verified',  pg_temp.has_rel('job_schedules')),
  ('20260619000000_gear_templates',                         'verified',  pg_temp.has_rel('gear_templates')),
  ('20260619000001_auth_roles',                             'verified',  pg_temp.has_rel('user_roles')),
  ('20260619000002_google_tokens',                          'verified',  pg_temp.has_rel('google_tokens')),
  ('20260619000003_add_google_event_id',                    'verified',  pg_temp.has_col('jobs','google_event_id')),
  ('20260619000004_fix_user_roles_rls',                     'verified',  pg_temp.has_policy('user_roles','Allow users to insert their own client role')),
  ('20260619000005_add_performance_indexes',                'verified',  pg_temp.has_rel('idx_jobs_shoot_date')),
  ('20260619000006_add_shotlist_special_shots',             'verified',  pg_temp.has_col('job_shotlist','is_special')),
  ('20260619000007_public_read_user_roles',                 'assumed',   pg_temp.has_col('user_roles','contact_id')),
  ('20260620000000_fix_user_roles_recursion',               'verified',  pg_temp.has_policy('user_roles','Allow admin to insert user roles')),
  ('20260621000000_add_schedule_notes',                     'verified',  pg_temp.has_col('job_schedules','notes')),
  ('20260622000000_add_scene_aspect',                       'verified',  pg_temp.has_col('job_shotlist','aspect_ratio')),
  ('20260622000001_add_projects',                           'verified',  pg_temp.has_rel('projects')),
  ('20260622000002_profiles_and_branding',                  'verified',  pg_temp.has_rel('organizations')),
  ('20260622000003_job_email_link',                         'verified',  pg_temp.has_col('jobs','email_thread_id')),
  ('20260622000004_vault',                                  'verified',  pg_temp.has_rel('vault_items')),
  ('20260622000005_enable_realtime',                        'verified',  pg_temp.in_realtime('jobs')),
  ('20260623000000_notification_integrations',              'verified',  pg_temp.has_rel('notification_channels')),
  ('20260623120000_shotlist_grid',                          'verified',  pg_temp.has_rel('job_scenes')),
  ('20260623120001_social_media',                           'verified',  pg_temp.has_rel('social_posts')),
  ('20260623120002_calendar_events',                        'verified',  pg_temp.has_rel('calendar_events')),
  ('20260623120003_calendar_events_realtime',               'verified',  pg_temp.in_realtime('calendar_events')),
  ('20260623120004_job_todos',                              'verified',  pg_temp.has_rel('job_todos')),
  ('20260706000000_budget_items',                           'verified',  pg_temp.has_rel('budget_items')),
  ('20260706000001_org_edit_stages',                        'verified',  pg_temp.has_col('organizations','edit_stages')),
  ('20260706000002_security_hardening',                     'verified',  pg_temp.google_tokens_locked_down()),
  ('20260706000003_production_notes',                       'verified',  pg_temp.has_rel('production_notes')),
  ('20260717000000_crew_order_tracker_optin_google_events', 'verified',  pg_temp.has_col('job_roles','sort_order')),
  ('20260717000001_google_sync_status',                     'verified',  pg_temp.has_col('google_tokens','last_sync_at')),
  ('20260717000002_team_synced_prefs',                      'verified',  pg_temp.has_col('organizations','custom_tabs')),
  ('20260717000003_calendar_marker_tombstones',             'verified',  pg_temp.has_col('calendar_events','hidden')),
  ('20260805000000_quickbooks',                             'verified',  pg_temp.has_rel('quickbooks_tokens')),
  ('20260806000000_user_roles_authenticated_read',          'assumed',   pg_temp.has_col('user_roles','contact_id')),
  ('20260806000001_share_token',                            'verified',  pg_temp.has_col('jobs','share_token')),
  ('20260806000002_restore_inventory_public_read',          'verified',  pg_temp.has_policy('inventory','Public read')),
  ('20260806000003_deliverables_by_job',                    'verified',  pg_temp.has_rel('idx_social_deliverables_job')),
  ('20260806000004_self_provision_client_role',             'verified',  pg_temp.has_policy('user_roles','Users can self-provision a client role')),
  ('20260807000000_job_wrap_time',                          'verified',  pg_temp.has_col('jobs','wrap_time')),
  ('20260807000001_usage_events',                           'verified',  pg_temp.has_rel('usage_events')),
  ('20260813000000_add_editor_role',                        'verified',  pg_temp.user_roles_allows_editor()),
  ('20260814000000_calendar_event_times',                   'verified',  pg_temp.has_col('calendar_events','start_time')),
  ('20260814000001_contact_secondary_roles',                'verified',  pg_temp.has_col('contacts','secondary_roles')),
  ('20260822000000_dismissed_duplicate_pairs',              'verified',  pg_temp.has_col('organizations','dismissed_duplicate_pairs')),
  ('20260822000000_editor_card_scope',                      'verified',  pg_temp.has_col('user_roles','contact_id')),
  ('20260822000000_studio_calendar',                        'verified',  pg_temp.has_col('google_tokens','is_studio_calendar')),
  ('20260822000001_edit_time_tracking',                     'verified',  pg_temp.has_rel('edit_time_entries')),
  ('20260822000001_marker_fanout_and_orphans',              'verified',  pg_temp.has_rel('calendar_event_google_links'))
) AS t(version, basis, present)
WHERE present
ON CONFLICT (version) DO NOTHING;

-- This migration records itself. Every migration from here on ends this way.
INSERT INTO public.schema_migrations (version, basis)
VALUES ('20260823000000_schema_migrations', 'recorded')
ON CONFLICT (version) DO NOTHING;
