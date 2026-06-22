-- =====================================================================
-- Vault (#10): encrypted storage for subscriptions, licenses, product
-- keys, and passwords.
--
-- Security model: secret values are encrypted IN THE BROWSER (AES-GCM
-- with a PBKDF2 key derived from a vault passphrase) before being stored.
-- The database only ever holds ciphertext, so even with DB access the
-- secrets are unreadable without the passphrase. The passphrase is never
-- stored — only a verifier (a known string encrypted with the same key)
-- so we can confirm the passphrase on unlock.
-- =====================================================================

-- 1. Per-user vault unlock metadata (salt + verifier, never the passphrase)
CREATE TABLE IF NOT EXISTS public.vault_meta (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt TEXT NOT NULL,        -- base64 PBKDF2 salt
  verifier TEXT NOT NULL,    -- base64 iv:ciphertext of a known plaintext
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Vault items
CREATE TABLE IF NOT EXISTS public.vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'password'
    CHECK (category IN ('subscription', 'license', 'product_key', 'password', 'other')),
  name TEXT NOT NULL,
  username TEXT,             -- not secret (account/email)
  url TEXT,                  -- not secret
  secret_cipher TEXT,        -- base64 iv:ciphertext of the password/key
  notes_cipher TEXT,         -- base64 iv:ciphertext of free-form notes
  file_path TEXT,            -- path in the private `vault` bucket (optional)
  file_name TEXT,
  expires_at DATE,           -- e.g. subscription/license renewal date
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON public.vault_items(user_id);

-- 3. RLS: a user can only ever see/manage their own vault rows.
ALTER TABLE public.vault_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own vault_meta" ON public.vault_meta;
CREATE POLICY "Users manage own vault_meta"
  ON public.vault_meta FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users manage own vault_items" ON public.vault_items;
CREATE POLICY "Users manage own vault_items"
  ON public.vault_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Private storage bucket for attached license/subscription files.
INSERT INTO storage.buckets (id, name, public)
VALUES ('vault', 'vault', false)
ON CONFLICT (id) DO NOTHING;

-- Only the owning user can read/write their files (path is prefixed with
-- their user id: `${auth.uid()}/...`).
DROP POLICY IF EXISTS "Users read own vault files" ON storage.objects;
CREATE POLICY "Users read own vault files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users write own vault files" ON storage.objects;
CREATE POLICY "Users write own vault files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own vault files" ON storage.objects;
CREATE POLICY "Users update own vault files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own vault files" ON storage.objects;
CREATE POLICY "Users delete own vault files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vault' AND (storage.foldername(name))[1] = auth.uid()::text);
