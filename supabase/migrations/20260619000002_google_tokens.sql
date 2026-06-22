-- Create google_tokens table to store Google API credentials for users
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on google_tokens
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for google_tokens
CREATE POLICY "Users can manage their own Google tokens"
  ON public.google_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
