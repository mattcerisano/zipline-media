-- Let an editor see the deliverables on the cards they are assigned.
--
-- The Edit Tracker card now lists the deliverables a job was given on Slate,
-- so the producer builds the job once and the editor cuts from the same list.
-- 20260822000000 shut editors out of social_deliverables entirely, which would
-- hand them an empty section on every card.
--
-- Read, plus update so they can move a cut to "delivered". No INSERT and no
-- DELETE: what the client is owed is the producer's call. The WITH CHECK
-- repeats the ownership test so an update cannot re-point a row at another job.

DROP POLICY IF EXISTS "Editors read their assigned deliverables" ON public.social_deliverables;
CREATE POLICY "Editors read their assigned deliverables"
  ON public.social_deliverables FOR SELECT
  TO authenticated
  USING (public.is_scoped_editor() AND public.editor_owns_job(job_id));

DROP POLICY IF EXISTS "Editors update their assigned deliverables" ON public.social_deliverables;
CREATE POLICY "Editors update their assigned deliverables"
  ON public.social_deliverables FOR UPDATE
  TO authenticated
  USING (public.is_scoped_editor() AND public.editor_owns_job(job_id))
  WITH CHECK (public.is_scoped_editor() AND public.editor_owns_job(job_id));

-- RLS decides rows, not columns. Without this an editor could rename a cut,
-- change its format, or move it to another client's list on the Social tab.
-- Status is the one field that is theirs; anything else is rejected outright,
-- the same posture as enforce_editor_job_columns on jobs.
CREATE OR REPLACE FUNCTION public.enforce_editor_deliverable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  editable TEXT[] := ARRAY['status'];
  old_row JSONB;
  new_row JSONB;
  col TEXT;
BEGIN
  IF NOT public.is_scoped_editor() THEN
    RETURN NEW;
  END IF;

  old_row := to_jsonb(OLD);
  new_row := to_jsonb(NEW);

  FOR col IN SELECT jsonb_object_keys(new_row)
  LOOP
    IF NOT (col = ANY (editable)) AND (new_row -> col) IS DISTINCT FROM (old_row -> col) THEN
      RAISE EXCEPTION 'An editor account may not change social_deliverables.%', col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_editor_deliverable_columns ON public.social_deliverables;
CREATE TRIGGER enforce_editor_deliverable_columns
  BEFORE UPDATE ON public.social_deliverables
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_editor_deliverable_columns();

INSERT INTO public.schema_migrations (version) VALUES ('20260921000000_editor_deliverables')
  ON CONFLICT (version) DO NOTHING;
