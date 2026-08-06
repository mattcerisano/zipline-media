-- Restore anonymous read on inventory.
--
-- 20260806000001 locked down jobs and inventory together, on the reasoning that
-- both were only public to serve the gear-share page. That was right about jobs
-- and wrong about inventory: /gear/inventory is a public marketing page on
-- zipline.media. It has no auth, reads the catalog straight from the browser,
-- and renders a total replacement value as a selling point. Locking the table
-- left that page empty for every signed-out visitor.
--
-- The two tables deserve different answers. jobs holds client names, contact
-- emails, notes, and capability URLs, and stays authenticated-only behind the
-- per-job share token. inventory holds item name, category, quantity, and
-- replacement cost — the catalog the public page exists to show.
--
-- Writes stay authenticated. Only SELECT opens back up.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'inventory') THEN
    DROP POLICY IF EXISTS "Public read" ON public.inventory;
    CREATE POLICY "Public read"
      ON public.inventory FOR SELECT
      USING (true);
  END IF;
END $$;
