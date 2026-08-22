-- Time tracking on an edit card.
--
-- An editor starts a timer on the card they are working, stops it when they
-- stop, and the studio gets an hours figure per production it can invoice or
-- budget against. That makes the table a billing record, so it is built to be
-- one rather than to be a convenience:
--
--   Every timestamp is written by the database. Nothing is taken from the
--   browser's clock, which the person being billed for controls. The API route
--   inserts without timestamps and lets the defaults and the trigger below
--   supply them.
--
--   The table has no INSERT, UPDATE, or DELETE policy. Writes are impossible
--   with the anon key that ships in the page bundle, whoever is signed in; they
--   only happen through /api/edits/time, which proves the caller's identity
--   from their bearer token and checks the card is theirs. Reads are the
--   caller's own entries, plus everything for admin and staff.
--
--   A started entry is append-only. The trigger refuses to move started_at, to
--   re-open a stopped entry, to reassign an entry to another job or another
--   person, or to record a span that ends in the future — and it refuses those
--   for the service role too, so a bug in the route cannot rewrite history.
--
--   One timer per person at a time, enforced by a unique index rather than by
--   the UI, so a second tab or a stale phone cannot double-bill an hour.

CREATE TABLE IF NOT EXISTS public.edit_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The card. CASCADE: a deleted production takes its time log with it.
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  -- Who logged it, as an auth account rather than a Rolodex contact, so the
  -- row is attributable to a login and survives contact edits.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Denormalised for display, so the board can label an entry without reading
  -- the roster (which an editor account cannot).
  user_email TEXT,
  -- The Rolodex contact the account was linked to when the entry was made.
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL means running.
  ended_at TIMESTAMPTZ,
  -- Maintained by the trigger from the two timestamps, never by the caller, so
  -- it can never disagree with them.
  duration_seconds INTEGER,
  -- 'timer' was measured; 'manual' was typed in afterwards. Kept apart so
  -- someone reviewing an invoice can see which is which.
  source TEXT NOT NULL DEFAULT 'timer' CHECK (source IN ('timer', 'manual')),
  note TEXT,
  -- Set when a forgotten timer was closed at the cap rather than by its owner.
  auto_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT edit_time_entries_span CHECK (ended_at IS NULL OR ended_at >= started_at),
  -- Backstop under the 12-hour auto-close: no single entry can ever claim a
  -- day and a half.
  CONSTRAINT edit_time_entries_max_span
    CHECK (ended_at IS NULL OR ended_at <= started_at + INTERVAL '24 hours'),
  CONSTRAINT edit_time_entries_note_len CHECK (note IS NULL OR char_length(note) <= 500)
);

-- One running timer per person, database-side. A second start attempt fails on
-- this index rather than quietly creating an overlapping span.
CREATE UNIQUE INDEX IF NOT EXISTS edit_time_entries_one_running_per_user
  ON public.edit_time_entries (user_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS edit_time_entries_job_idx
  ON public.edit_time_entries (job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS edit_time_entries_user_idx
  ON public.edit_time_entries (user_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- Append-only enforcement.
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER and no role test: this applies to the service role as well,
-- which is the point. The route holds the service key, so the only thing that
-- can stop the route rewriting a stopped entry is a rule below it.
CREATE OR REPLACE FUNCTION public.guard_edit_time_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Small allowance for clock skew between the app server and the database.
  future_slack INTERVAL := INTERVAL '1 minute';
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id
       OR NEW.job_id <> OLD.job_id
       OR NEW.user_id <> OLD.user_id
       OR NEW.started_at <> OLD.started_at
       OR NEW.source <> OLD.source
       OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'A time entry''s card, owner, start, and source are fixed once written'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.ended_at IS NOT NULL AND NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
      RAISE EXCEPTION 'A stopped time entry cannot be re-opened or re-timed'
        USING ERRCODE = '42501';
    END IF;

    NEW.updated_at := NOW();
  END IF;

  IF NEW.started_at > NOW() + future_slack THEN
    RAISE EXCEPTION 'A time entry cannot start in the future' USING ERRCODE = '22007';
  END IF;
  IF NEW.ended_at IS NOT NULL AND NEW.ended_at > NOW() + future_slack THEN
    RAISE EXCEPTION 'A time entry cannot end in the future' USING ERRCODE = '22007';
  END IF;

  NEW.duration_seconds := CASE
    WHEN NEW.ended_at IS NULL THEN NULL
    ELSE GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)))::INTEGER)
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_edit_time_entry ON public.edit_time_entries;
CREATE TRIGGER guard_edit_time_entry
  BEFORE INSERT OR UPDATE ON public.edit_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_edit_time_entry();

-- ---------------------------------------------------------------------------
-- Forgotten timers.
-- ---------------------------------------------------------------------------
-- A timer left running overnight is the common failure, and left alone it both
-- bills a night's sleep and blocks the next day's start through the unique
-- index. Anything still running after the cap is closed at the cap and marked,
-- so the number is visibly a truncation rather than a measurement. The route
-- calls this before it starts or lists a timer, so no scheduler is required.
CREATE OR REPLACE FUNCTION public.close_stale_edit_timers(max_hours INTEGER DEFAULT 12)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  closed INTEGER;
  cap INTERVAL := make_interval(hours => GREATEST(1, LEAST(24, COALESCE(max_hours, 12))));
BEGIN
  UPDATE public.edit_time_entries
     SET ended_at = started_at + cap,
         auto_closed = TRUE
   WHERE ended_at IS NULL
     AND started_at < NOW() - cap;
  GET DIAGNOSTICS closed = ROW_COUNT;
  RETURN closed;
END;
$$;

-- Only the route may run it: no signed-in account can reach in and close, or
-- extend, a running timer.
REVOKE ALL ON FUNCTION public.close_stale_edit_timers(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_stale_edit_timers(INTEGER) TO service_role;

-- ---------------------------------------------------------------------------
-- The three ways an entry is written.
-- ---------------------------------------------------------------------------
-- Timestamps come from NOW() inside these functions, so the recorded time is
-- the database's clock and nothing else — not the browser's, and not the app
-- server's. /api/edits/time decides *whether* a caller may log time (identity
-- from their bearer token, assignment from the card); these decide *what* gets
-- written. Both halves have to agree for a row to exist.
--
-- SECURITY DEFINER, executable by the service role only: a signed-in account
-- cannot call them directly with the anon key.

CREATE OR REPLACE FUNCTION public.start_edit_timer(
  target_job UUID,
  target_user UUID,
  target_email TEXT DEFAULT NULL,
  target_contact UUID DEFAULT NULL
)
RETURNS public.edit_time_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  created public.edit_time_entries;
BEGIN
  INSERT INTO public.edit_time_entries (job_id, user_id, user_email, contact_id, started_at, source)
  VALUES (target_job, target_user, target_email, target_contact, NOW(), 'timer')
  RETURNING * INTO created;
  RETURN created;
END;
$$;

-- Stops the caller's running timer. Scoped by user_id rather than by entry id
-- alone, so passing someone else's entry stops nothing instead of stopping
-- theirs. Returns NULL when there was nothing running.
CREATE OR REPLACE FUNCTION public.stop_edit_timer(
  target_user UUID,
  target_entry UUID DEFAULT NULL
)
RETURNS public.edit_time_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  stopped public.edit_time_entries;
BEGIN
  UPDATE public.edit_time_entries
     SET ended_at = NOW()
   WHERE user_id = target_user
     AND ended_at IS NULL
     AND (target_entry IS NULL OR id = target_entry)
  RETURNING * INTO stopped;
  RETURN stopped;
END;
$$;

-- A span typed in after the fact, for the session someone forgot to time. It
-- still ends at NOW() and is still measured in the database; only its length is
-- the caller's word, which is why it is bounded here as well as in the route
-- and marked 'manual' so an invoice can tell the two apart.
CREATE OR REPLACE FUNCTION public.log_manual_edit_time(
  target_job UUID,
  target_user UUID,
  minutes INTEGER,
  target_email TEXT DEFAULT NULL,
  target_contact UUID DEFAULT NULL,
  entry_note TEXT DEFAULT NULL
)
RETURNS public.edit_time_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  created public.edit_time_entries;
BEGIN
  IF minutes IS NULL OR minutes <= 0 OR minutes > 720 THEN
    RAISE EXCEPTION 'A manual entry must be between 1 minute and 12 hours'
      USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.edit_time_entries (
    job_id, user_id, user_email, contact_id, started_at, ended_at, source, note
  )
  VALUES (
    target_job, target_user, target_email, target_contact,
    NOW() - make_interval(mins => minutes), NOW(), 'manual', NULLIF(entry_note, '')
  )
  RETURNING * INTO created;
  RETURN created;
END;
$$;

REVOKE ALL ON FUNCTION public.start_edit_timer(UUID, UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stop_edit_timer(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_manual_edit_time(UUID, UUID, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_edit_timer(UUID, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.stop_edit_timer(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_manual_edit_time(UUID, UUID, INTEGER, TEXT, UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Access.
-- ---------------------------------------------------------------------------
ALTER TABLE public.edit_time_entries ENABLE ROW LEVEL SECURITY;

-- Your own log, always. Admin and staff see the whole studio's, because that
-- is the number they invoice and budget from. An editor sees only their own —
-- what a colleague bills is not theirs to read.
DROP POLICY IF EXISTS "Read your own time" ON public.edit_time_entries;
CREATE POLICY "Read your own time"
  ON public.edit_time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_app_role() IN ('admin', 'staff')
  );

-- Deliberately no INSERT / UPDATE / DELETE policy. Writes go through
-- /api/edits/time with the service key, which is the only place the assignment
-- check and the bounds live.
