-- Security hardening ahead of multi-user beta.
--
-- Until now most tables carried permissive "allow all" RLS policies. The anon
-- key ships in the browser bundle, so that made the database publicly
-- readable/writable to anyone who inspected the site. This migration:
--   1. Locks google_tokens to the service role only (OAuth tokens must never
--      be client-readable — the UI now checks /api/auth/google/status).
--   2. Requires an authenticated session on all internal tables.
--   3. Keeps anonymous READ on jobs + inventory (the public gear-share page
--      depends on it); writes there require authentication (share-page edits
--      go through /api/share/gear with the service key).
--
-- Because permissive policies are OR'd together, every pre-existing policy on
-- the affected tables is dropped first.

DO $$
DECLARE
  t TEXT;
  pol RECORD;
  internal_tables TEXT[] := ARRAY[
    'contacts', 'clients', 'projects', 'job_roles', 'job_schedules',
    'job_scenes', 'job_shotlist', 'job_todos', 'job_templates',
    'gear_templates', 'organizations', 'profiles', 'notification_channels',
    'notification_events', 'vault_meta', 'vault_items', 'budget_items',
    'calendar_events', 'social_campaigns', 'social_campaign_tasks',
    'social_deliverables', 'social_links', 'social_posts'
  ];
  public_read_tables TEXT[] := ARRAY['jobs', 'inventory'];
BEGIN
  -- 1. google_tokens: drop every policy, leave RLS on with no policies at all
  --    → only the service role (which bypasses RLS) can touch it.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'google_tokens') THEN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'google_tokens'
    LOOP
      EXECUTE format('DROP POLICY %I ON google_tokens', pol.policyname);
    END LOOP;
    EXECUTE 'ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY';
  END IF;

  -- 2. Internal tables: authenticated users only.
  FOREACH t IN ARRAY internal_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY %I ON %I', pol.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY "Authenticated full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;

  -- 3. jobs + inventory: anonymous read (public gear share), authed writes.
  FOREACH t IN ARRAY public_read_tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY %I ON %I', pol.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('CREATE POLICY "Public read" ON %I FOR SELECT USING (true)', t);
      EXECUTE format('CREATE POLICY "Authenticated insert" ON %I FOR INSERT TO authenticated WITH CHECK (true)', t);
      EXECUTE format('CREATE POLICY "Authenticated update" ON %I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', t);
      EXECUTE format('CREATE POLICY "Authenticated delete" ON %I FOR DELETE TO authenticated USING (true)', t);
    END IF;
  END LOOP;

  -- user_roles is intentionally untouched: its policies were purpose-built by
  -- earlier migrations (self-healing login lookup) and remain as-is.
END $$;
