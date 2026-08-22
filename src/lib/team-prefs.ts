import { supabase } from '@/lib/supabase';

// Preferences that should follow the user (or the whole team) across devices
// instead of living in one browser's localStorage. Pattern mirrors the
// org-wide edit stages: localStorage stays the instant, always-works layer;
// the database is the source of truth when reachable. Every call fails soft —
// deployments that haven't run the migration just keep localStorage behavior.

type OrgPrefColumn = 'custom_tabs' | 'saved_gear_owners' | 'dismissed_duplicate_pairs';

let orgIdCache: string | null = null;

async function getOrgId(): Promise<string | null> {
  if (orgIdCache) return orgIdCache;
  try {
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    orgIdCache = data?.id ?? null;
  } catch {
    orgIdCache = null;
  }
  return orgIdCache;
}

/** Read a team-wide preference. Null when unset, unreachable, or pre-migration. */
export async function loadOrgPref<T>(column: OrgPrefColumn): Promise<T | null> {
  try {
    const { data } = await supabase
      .from('organizations')
      .select(`id, ${column}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.id) orgIdCache = data.id;
    return ((data as any)?.[column] as T) ?? null;
  } catch {
    return null;
  }
}

/** Persist a team-wide preference. Fire-and-forget; callers keep localStorage in sync. */
export async function saveOrgPref(column: OrgPrefColumn, value: unknown): Promise<void> {
  const orgId = await getOrgId();
  if (!orgId) return;
  try {
    await supabase.from('organizations').update({ [column]: value }).eq('id', orgId);
  } catch { /* pre-migration or offline — localStorage still applies */ }
}

/** Read the signed-in user's scratch notes from their profile. */
export async function loadMyScratchNotes(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('scratch_notes')
      .eq('id', user.id)
      .maybeSingle();
    const notes = (data as any)?.scratch_notes;
    return typeof notes === 'string' ? notes : null;
  } catch {
    return null;
  }
}

/** Persist the signed-in user's scratch notes to their profile. */
export async function saveMyScratchNotes(notes: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('profiles').upsert({ id: user.id, scratch_notes: notes }, { onConflict: 'id' });
  } catch { /* fail soft */ }
}
