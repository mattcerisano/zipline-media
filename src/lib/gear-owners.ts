/**
 * Gear that belongs to someone else — a friend's camera, a rental house's
 * lenses. It lives in the same `inventory` table as the studio's own kit, with
 * `owner` set, and its name carries the owner in brackets ("Sony A1 [Rob
 * Douthat]"). The bracket isn't decoration: saved gear lists key items by
 * name, so it's what keeps Rob's A1 and the studio's A1 apart on a manifest.
 */
import type { InventoryItem } from '@/data/inventory';

/** Who a manifest groups unowned gear under. */
export const STUDIO_OWNER = 'Zipline Media';

const OWNED_NAME = /^(.*\S)\s*\[([^\[\]]+)\]\s*$/;

/** "Sony A1 [Rob Douthat]" → { base: "Sony A1", owner: "Rob Douthat" }. */
export function parseOwnedName(name: string): { base: string; owner: string | null } {
  const m = (name || '').match(OWNED_NAME);
  if (!m) return { base: (name || '').trim(), owner: null };
  return { base: m[1].trim(), owner: m[2].trim() };
}

export function ownedName(base: string, owner?: string | null): string {
  const b = base.trim();
  const o = (owner || '').trim();
  return o ? `${b} [${o}]` : b;
}

/** Someone else's gear: an owner is set and it isn't the studio itself. */
export function isBorrowed(item: Pick<InventoryItem, 'owner'>): boolean {
  const owner = (item.owner || '').trim();
  return !!owner && owner.toLowerCase() !== STUDIO_OWNER.toLowerCase();
}

export interface RentalJob {
  id: string;
  title: string;
  shoot_date?: string | null;
  job_status?: string | null;
  gear_manifest?: Record<string, number> | null;
}

export interface RentalLogItem {
  /** Full catalog / manifest name, bracket included. */
  name: string;
  base: string;
  category: string | null;
  /** False when the item is only known from an old gear list. */
  inCatalog: boolean;
  jobs: { id: string; title: string; date: string | null; count: number }[];
}

export interface RentalLogOwner {
  owner: string;
  items: RentalLogItem[];
  /** Distinct shoots anything was borrowed from them for. */
  jobCount: number;
  lastDate: string | null;
}

const byDateDesc = (a: string | null, b: string | null) => (b || '').localeCompare(a || '');

/**
 * Everything each person has lent the studio: their gear in the catalog, plus
 * anything on a saved gear list that names them in brackets but never made it
 * into the catalog (lists built before borrowed gear was saved). Owners with
 * the most recent loan first.
 */
export function buildRentalLog(inventory: InventoryItem[], jobs: RentalJob[]): RentalLogOwner[] {
  const items = new Map<string, RentalLogItem & { owner: string }>();
  // Every catalog name, borrowed or not. An older row can carry the owner only
  // in its bracket; it's still in the catalog and must not be offered for
  // saving again, which would duplicate it.
  const catalogNames = new Set(inventory.map(i => i.name));

  for (const inv of inventory) {
    if (!isBorrowed(inv)) continue;
    items.set(inv.name, {
      name: inv.name,
      base: parseOwnedName(inv.name).base,
      owner: inv.owner!.trim(),
      category: inv.category || null,
      inCatalog: true,
      jobs: [],
    });
  }

  for (const job of jobs) {
    // A cancelled shoot never actually borrowed anything.
    if (job.job_status === 'Cancelled') continue;
    for (const [name, count] of Object.entries(job.gear_manifest || {})) {
      if (!count || count <= 0) continue;
      let entry = items.get(name);
      if (!entry) {
        const { base, owner } = parseOwnedName(name);
        if (!owner || owner.toLowerCase() === STUDIO_OWNER.toLowerCase()) continue;
        entry = { name, base, owner, category: null, inCatalog: catalogNames.has(name), jobs: [] };
        items.set(name, entry);
      }
      entry.jobs.push({ id: job.id, title: job.title, date: job.shoot_date || null, count });
    }
  }

  // Keyed case-insensitively so "rob douthat" and "Rob Douthat" are one person.
  const owners = new Map<string, RentalLogOwner>();
  for (const { owner, ...item } of items.values()) {
    item.jobs.sort((a, b) => byDateDesc(a.date, b.date));
    const key = owner.toLowerCase();
    const group = owners.get(key) || { owner, items: [], jobCount: 0, lastDate: null };
    group.items.push(item);
    owners.set(key, group);
  }

  const result: RentalLogOwner[] = [];
  for (const group of owners.values()) {
    const jobIds = new Set<string>();
    for (const item of group.items) for (const j of item.jobs) jobIds.add(j.id);
    group.jobCount = jobIds.size;
    group.lastDate = group.items.flatMap(i => i.jobs.map(j => j.date)).sort(byDateDesc)[0] || null;
    // Most-borrowed first, then alphabetical.
    group.items.sort((a, b) => b.jobs.length - a.jobs.length || a.base.localeCompare(b.base));
    result.push(group);
  }
  return result.sort((a, b) => byDateDesc(a.lastDate, b.lastDate) || a.owner.localeCompare(b.owner));
}
