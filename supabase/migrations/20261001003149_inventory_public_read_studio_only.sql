-- Keep borrowed gear out of the anonymous catalog read.
--
-- The Gear Builder now saves gear borrowed from friends and rental houses into
-- `inventory` with `owner` set ("Sony A1 [Rob Douthat]"). 20260806000002 gave
-- that table an anonymous SELECT for the public /gear pages, so without this
-- every friend's name and what they lend the studio would be readable by
-- anyone with the anon key in the page bundle. The pages filter borrowed gear
-- out themselves; this makes the database agree.
--
--   anon          → studio-owned gear only (owner empty or "Zipline Media")
--   authenticated → everything, unchanged: "Authenticated full access" from
--                   20260806000001 already covers reads (Gear Builder, Slate,
--                   call sheets). "Public read" used to apply to every role;
--                   it is now scoped to anon so it can't be the wider rule.
--
-- The share page is unaffected: /api/share/gear reads with the service key.
-- The policy keeps the name "Public read" so the schema_migrations check for
-- 20260806000002 (has_policy('inventory','Public read')) stays verified.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory') THEN
    DROP POLICY IF EXISTS "Public read" ON public.inventory;
    CREATE POLICY "Public read"
      ON public.inventory FOR SELECT
      TO anon
      USING (
        owner IS NULL
        OR btrim(owner) = ''
        OR lower(btrim(owner)) = 'zipline media'
      );

  END IF;
END $$;

INSERT INTO public.schema_migrations (version) VALUES ('20261001003149_inventory_public_read_studio_only')
  ON CONFLICT (version) DO NOTHING;
