import { supabase } from '@/lib/supabase';

/**
 * Merging duplicate projects and clients.
 *
 * Imports and the old free-text client box left the Library with two "860"s,
 * two "Fantasticks" and a "FinEvents - Rob" beside "FinEvents UK Ltd". Deleting
 * one loses whatever pointed at it; merging repoints everything at the row that
 * survives, then removes the rest. Nothing on a production changes except the
 * id (and, for clients, the name) it carries.
 */

export interface MergeRow {
  id: string;
  name: string;
  client_id?: string | null;
  /** How many productions point at it — the row with the most keeps its id. */
  usage?: number | null;
}

/** The duplicate that keeps its id: most productions, then one with a client, then the first. */
export function pickSurvivor<T extends MergeRow>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) =>
    (b.usage || 0) - (a.usage || 0)
    || (b.client_id ? 1 : 0) - (a.client_id ? 1 : 0)
    || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )[0];
}

/** The rows that go, in the same order they were given. */
export function losersOf<T extends MergeRow>(rows: T[], keepId: string): T[] {
  return rows.filter(r => r.id !== keepId);
}

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/** Tables that may not exist yet (their migration unrun). A missing table is not a failed merge. */
const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || ''));

async function repoint(table: string, column: string, keepId: string, loserIds: string[]) {
  const { error } = await supabase.from(table).update({ [column]: keepId }).in(column, loserIds);
  if (error && !isMissingTable(error)) fail(`Couldn't move ${table}`, error);
}

/**
 * Fold `losers` into `keep`. Productions move to the surviving project; if
 * the survivor has no client and a duplicate does, it inherits that client.
 */
export async function mergeProjects(keep: MergeRow, losers: MergeRow[]): Promise<{ moved: number }> {
  const loserIds = losers.map(l => l.id);
  if (loserIds.length === 0) return { moved: 0 };

  const moved = await supabase.from('jobs').update({ project_id: keep.id }).in('project_id', loserIds).select('id');
  fail("Couldn't move the productions", moved.error);

  const inherited = losers.find(l => l.client_id)?.client_id;
  if (!keep.client_id && inherited) {
    const { error } = await supabase.from('projects').update({ client_id: inherited }).eq('id', keep.id);
    fail("Couldn't carry the client over", error);
  }

  const { error } = await supabase.from('projects').delete().in('id', loserIds);
  fail("Couldn't remove the duplicates", error);
  return { moved: moved.data?.length || 0 };
}

/**
 * Fold `losers` into `keep`. Everything that referenced a duplicate —
 * productions (by id, and by the old free-text name), projects, meeting
 * notes, intake briefs, production notes and social planner rows — now
 * references the survivor, and productions take its name.
 */
export async function mergeClients(keep: MergeRow, losers: MergeRow[]): Promise<{ moved: number }> {
  const loserIds = losers.map(l => l.id);
  if (loserIds.length === 0) return { moved: 0 };

  const byId = await supabase.from('jobs')
    .update({ client_id: keep.id, client_name: keep.name })
    .in('client_id', loserIds)
    .select('id');
  fail("Couldn't move the productions", byId.error);

  // Productions from before the client picker carry only the typed name.
  const loserNames = losers.map(l => l.name.trim()).filter(Boolean);
  let byName = 0;
  if (loserNames.length > 0) {
    const res = await supabase.from('jobs')
      .update({ client_id: keep.id, client_name: keep.name })
      .is('client_id', null)
      .in('client_name', loserNames)
      .select('id');
    fail("Couldn't move the productions", res.error);
    byName = res.data?.length || 0;
  }

  await repoint('projects', 'client_id', keep.id, loserIds);
  for (const table of ['meeting_notes', 'client_intakes', 'production_notes', 'social_posts', 'social_campaigns', 'social_deliverables', 'social_links']) {
    await repoint(table, 'client_id', keep.id, loserIds);
  }

  const { error } = await supabase.from('clients').delete().in('id', loserIds);
  fail("Couldn't remove the duplicates", error);
  return { moved: (byId.data?.length || 0) + byName };
}
