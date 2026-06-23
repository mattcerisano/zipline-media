-- Add calendar_events to the realtime publication so quick calendar markers
-- sync across teammates' open tabs (mirrors 20260622000005_enable_realtime).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'calendar_events')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'calendar_events'
     )
  THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events';
  END IF;
END $$;
