-- Close the anonymous read on jobs and inventory.
--
-- 20260706000002 granted "Public read USING (true)" on both tables because the
-- gear-share page reads them straight from the browser with the anon key, and
-- the people it is shared with are not signed in. But a table-wide policy can't
-- scope to one job, so the effect was that anyone holding the anon key — which
-- ships in the page bundle — could read every job: client names, contact
-- emails, locations, notes, creative briefs, and the Drive/Discord/review URLs,
-- which are themselves capability links.
--
-- Each job now carries a share_token. The share page reads through
-- /api/share/gear, which checks the token server-side with the service key, so
-- a share link grants exactly one job and nothing else. The public policies go
-- away entirely.
--
-- Existing /share/gear/<id> links stop working: they carry no token, and there
-- is no way to honour them without keeping the hole open. Re-copy the link from
-- Gear → Share to hand out the new one.

-- 1. Per-job share token. Random per row, so knowing one tells you nothing
--    about another, and NOT NULL so a job can never exist unshareable.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS share_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Lookups come in as (id, token); the id is already the primary key, so this
-- only needs to make the token side cheap to verify.
CREATE INDEX IF NOT EXISTS jobs_share_token_idx ON public.jobs (share_token);

-- 2. Drop anonymous read on both tables and require a session. The writes were
--    already authenticated-only; they are recreated here so the full policy set
--    for these tables lives in one place.
DO $$
DECLARE
  t TEXT;
  pol RECORD;
  tables TEXT[] := ARRAY['jobs', 'inventory'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Permissive policies are OR'd together, so the old "Public read" has to
      -- go rather than simply be joined by a stricter one.
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY %I ON %I', pol.policyname, t);
      END LOOP;

      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format(
        'CREATE POLICY "Authenticated full access" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;
