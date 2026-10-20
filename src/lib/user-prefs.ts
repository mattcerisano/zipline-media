import { supabase } from '@/lib/supabase';

/**
 * Personal settings that follow you between devices — today, your panel
 * layouts. One row per setting in user_prefs, readable and writable only by
 * you. Everything keeps working from this device's localStorage before that
 * table exists; these calls just come back empty or do nothing.
 */

export async function loadUserPref<T>(key: string): Promise<T | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data, error } = await supabase
      .from('user_prefs')
      .select('value')
      .eq('user_id', session.user.id)
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    return data.value as T;
  } catch {
    return null;
  }
}

const pending = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Save (or, with null, clear) a setting. Writes are debounced per key, so
 * dragging a panel divider sends one request rather than dozens.
 */
export function saveUserPref(key: string, value: unknown, delayMs = 800): void {
  const prior = pending.get(key);
  if (prior) clearTimeout(prior);
  pending.set(key, setTimeout(async () => {
    pending.delete(key);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      if (value === null) {
        await supabase.from('user_prefs').delete().eq('user_id', session.user.id).eq('key', key);
      } else {
        await supabase.from('user_prefs').upsert(
          { user_id: session.user.id, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' },
        );
      }
    } catch { /* offline or pre-migration — localStorage still has it */ }
  }, delayMs));
}
