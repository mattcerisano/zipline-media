-- QuickBooks Online connection (read-only usage).
--
-- Mirrors google_tokens: one row per connected user, service-role access only,
-- never selectable from the browser. realm_id is the QuickBooks company id and
-- is required on every API call, so it is stored alongside the tokens.
--
-- Intuit refresh tokens rotate on every use — the new one must be persisted or
-- the connection dies — and expire after 100 days of inactivity, so
-- refresh_token_expires_at is tracked to let the UI warn before that happens.
CREATE TABLE IF NOT EXISTS public.quickbooks_tokens (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ,
  -- Sync health, same shape as google_tokens, for the Integrations chip.
  last_sync_at TIMESTAMPTZ,
  last_sync_ok BOOLEAN,
  last_sync_error TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.quickbooks_tokens ENABLE ROW LEVEL SECURITY;

-- No policy is granted deliberately: every read goes through the service role
-- in an API route. Tokens must never be readable from the client.

-- Link a Studio OS client to its QuickBooks customer. Nullable: matching is
-- best-effort by name and can be corrected by hand later.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS quickbooks_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_quickbooks_customer_id
  ON public.clients (quickbooks_customer_id);
