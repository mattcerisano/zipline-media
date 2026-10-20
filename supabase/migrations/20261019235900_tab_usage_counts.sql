-- Team-wide tab totals, so the sidebar can put the most-used tabs first.
--
-- usage_events is readable by admins only — staff shouldn't see what their
-- colleagues clicked — but ordering everyone's sidebar needs the totals. This
-- returns exactly that and nothing more: one count of opens per surface over
-- the last `days` days (1–365). No user ids, no timestamps, no labels.
--
-- Run once in the Supabase SQL editor. Safe to re-run. Until it runs, admins
-- still get a ranked sidebar (they can read the events); everyone else keeps
-- the saved order.

CREATE OR REPLACE FUNCTION public.tab_usage_counts(days INTEGER DEFAULT 30)
RETURNS TABLE (surface TEXT, opens BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.surface, count(*)::BIGINT
    FROM public.usage_events e
   WHERE e.kind = 'view'
     AND e.created_at >= now() - make_interval(days => LEAST(GREATEST(COALESCE(tab_usage_counts.days, 30), 1), 365))
   GROUP BY e.surface;
$$;

REVOKE ALL ON FUNCTION public.tab_usage_counts(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tab_usage_counts(INTEGER) TO authenticated;

INSERT INTO public.schema_migrations (version) VALUES ('20261019235900_tab_usage_counts')
  ON CONFLICT (version) DO NOTHING;
