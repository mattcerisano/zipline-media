-- Usage tracking, for working out which parts of the app people actually use.
--
-- Deliberately narrow. Each row records that a surface was opened or an action
-- was taken — never what was typed, selected, or saved. There is no field for
-- payloads, so no future call site can quietly start logging a client name or
-- a note into it.
--
-- Vercel Analytics already ships in the layout, but it counts page views and
-- Studio OS is a single route: every tab, every board and every modal is
-- /command-center. It cannot answer "does anyone open the Vault", which is the
-- question this exists for.

CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who. CASCADE so removing a teammate removes their trail with them rather
  -- than leaving orphaned rows attributable by elimination.
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- What kind of thing happened: 'view' (a surface was opened) or 'action'.
  kind TEXT NOT NULL,
  -- Where: a tab id like 'calendar', or a component name.
  surface TEXT NOT NULL,
  -- Which action, when kind = 'action'. A fixed label, never user content.
  label TEXT,
  -- 'mobile' or 'desktop', so layout problems can be told apart by device.
  viewport TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The admin view slices by surface and by day, and prunes by age.
CREATE INDEX IF NOT EXISTS idx_usage_events_created ON public.usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_surface ON public.usage_events (surface);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may record their own activity, and only their own: user_id
-- is pinned to auth.uid() so one account cannot write events attributed to
-- another.
DROP POLICY IF EXISTS "Record your own usage" ON public.usage_events;
CREATE POLICY "Record your own usage"
  ON public.usage_events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Reading is admin-only. Staff should not be able to see what their colleagues
-- clicked, which is a different thing entirely from the owner reviewing usage.
DROP POLICY IF EXISTS "Admins read usage" ON public.usage_events;
CREATE POLICY "Admins read usage"
  ON public.usage_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  );

-- Admins may clear the log — both to reset between test rounds and so there is
-- a way to delete the record of someone's activity on request.
DROP POLICY IF EXISTS "Admins clear usage" ON public.usage_events;
CREATE POLICY "Admins clear usage"
  ON public.usage_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.id = auth.uid() AND user_roles.role = 'admin'
    )
  );
