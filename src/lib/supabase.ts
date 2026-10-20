import { createClient } from '@supabase/supabase-js';

// Trimmed: the production values were saved with a trailing line break.
// Ordinary requests send the key as a header, where fetch strips whitespace,
// so everything loaded — but live updates put the key in the websocket URL,
// where the line break became part of the key and every connection was
// refused. The app retried every few seconds and never got a live update.
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
