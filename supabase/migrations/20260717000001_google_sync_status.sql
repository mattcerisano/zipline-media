-- Sync health tracking: every calendar pull (cron, silent, or manual) records
-- its outcome here so the UI can show "last synced X ago / sync failing"
-- instead of letting a dead Google token fail silently in the background.
ALTER TABLE public.google_tokens
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
