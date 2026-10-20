/**
 * Sidebar order by use: the tabs the team opened most in the last
 * USAGE_RANK_DAYS days come first. Ties — including every tab nobody opened —
 * keep the order an admin set, so a quiet month or a brand-new tab still
 * lands somewhere deliberate rather than alphabetically or at random.
 */

export const USAGE_RANK_DAYS = 30;

export function rankTabsByUse<T extends { id: string }>(tabs: T[], opens: Record<string, number>): T[] {
  return tabs
    .map((tab, index) => ({ tab, index, n: opens[tab.id] || 0 }))
    .sort((a, b) => b.n - a.n || a.index - b.index)
    .map(x => x.tab);
}

/** Opens per surface from raw view rows. */
export function countOpens(rows: { surface: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) if (r.surface) out[r.surface] = (out[r.surface] || 0) + 1;
  return out;
}
