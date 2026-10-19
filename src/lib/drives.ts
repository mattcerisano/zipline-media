/**
 * Drive Tracker rules. The studio hands SSDs to editors and agencies around
 * the city and forgets who has them; these helpers answer the two questions
 * the tracker exists for: who has each drive, and which drives are free.
 *
 * A drive that isn't out is available, and it is always with one of the
 * studio's owners (Matt or Tommy), so "available" also says where to grab it.
 * That keeper is stored in `holder_name`, the same field that names who has a
 * drive while it's out.
 */
import { parseLocalDate } from './date';

/** Kept in the table for older rows; the tracker no longer splits drives by kind. */
export type DriveKind = 'editor' | 'transfer';
export type DriveStatus = 'in_office' | 'out' | 'lost' | 'retired';
export type HolderType = 'editor' | 'agency' | 'client' | 'other';

export interface Drive {
  id: string;
  label: string;
  kind: DriveKind;
  model: string | null;
  capacity_tb: number | null;
  serial: string | null;
  purchase_price: number | null;
  status: DriveStatus;
  /** Who has it: the editor or agency while out, Matt or Tommy while available. */
  holder_name: string | null;
  holder_type: HolderType | null;
  job_id: string | null;
  checked_out_at: string | null;
  /** No longer set by the tracker; return dates were dropped. */
  expected_back: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export type DriveAction = 'added' | 'checked_out' | 'returned' | 'lost' | 'found' | 'retired' | 'note';

export interface DriveEvent {
  id: string;
  drive_id: string;
  action: DriveAction;
  holder_name: string | null;
  job_id: string | null;
  note: string | null;
  actor: string | null;
  created_at: string;
}

/** The studio's owners. An available drive is always with one of them. */
export const OWNERS = ['Matt', 'Tommy'] as const;

/** The drives the studio buys, offered as quick picks in the form. */
export const DRIVE_MODELS = ['Samsung T5', 'Samsung T7', 'Samsung T9', 'Transfer stick'];

const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days since the drive went out; null when it isn't out. */
export function daysOut(drive: Pick<Drive, 'status' | 'checked_out_at'>, now: Date = new Date()): number | null {
  if (drive.status !== 'out' || !drive.checked_out_at) return null;
  const out = parseLocalDate(drive.checked_out_at);
  if (!out) return null;
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(out)) / DAY_MS));
}

/** Which owner an available drive is with, or null if nobody was recorded. */
export function keeperOf(drive: Pick<Drive, 'status' | 'holder_name'>): string | null {
  if (drive.status !== 'in_office') return null;
  const name = (drive.holder_name || '').trim().toLowerCase();
  return OWNERS.find((o) => o.toLowerCase() === name) ?? null;
}

export interface DriveTotals {
  total: number;
  available: number;
  /** Available drives per owner, in OWNERS order. */
  availableBy: Record<string, number>;
  out: number;
  lost: number;
  /** Terabytes currently out of the office. */
  tbOut: number;
  /** What the drives currently out cost, where a price was logged. */
  valueOut: number;
  /** What the lost drives cost, where a price was logged. */
  valueLost: number;
}

export function driveTotals(drives: Drive[]): DriveTotals {
  const t: DriveTotals = {
    total: 0, available: 0, availableBy: Object.fromEntries(OWNERS.map((o) => [o, 0])),
    out: 0, lost: 0, tbOut: 0, valueOut: 0, valueLost: 0,
  };
  for (const d of drives) {
    if (d.status === 'retired') continue;
    t.total++;
    if (d.status === 'in_office') {
      t.available++;
      const k = keeperOf(d);
      if (k) t.availableBy[k]++;
    }
    if (d.status === 'lost') {
      t.lost++;
      t.valueLost += Number(d.purchase_price) || 0;
    }
    if (d.status === 'out') {
      t.out++;
      t.tbOut += Number(d.capacity_tb) || 0;
      t.valueOut += Number(d.purchase_price) || 0;
    }
  }
  return t;
}

export interface HolderGroup {
  holder: string;
  holderType: HolderType | null;
  drives: Drive[];
}

const byLabel = (a: Drive, b: Drive) => a.label.localeCompare(b.label, undefined, { numeric: true });

/**
 * Drives that are out, grouped by who has them, most drives first. Names are
 * matched case-insensitively so "Acme Agency" and "acme agency" merge.
 */
export function groupByHolder(drives: Drive[], now: Date = new Date()): HolderGroup[] {
  const groups = new Map<string, HolderGroup>();
  for (const d of drives) {
    if (d.status !== 'out') continue;
    const name = (d.holder_name || '').trim() || 'Unknown';
    const key = name.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { holder: name, holderType: d.holder_type, drives: [] };
      groups.set(key, g);
    }
    g.drives.push(d);
  }
  const list = [...groups.values()];
  for (const g of list) {
    g.drives.sort((a, b) => (daysOut(b, now) ?? 0) - (daysOut(a, now) ?? 0) || byLabel(a, b));
  }
  return list.sort((a, b) => b.drives.length - a.drives.length || a.holder.localeCompare(b.holder));
}

export interface KeeperGroup {
  /** An owner's name, or null for available drives nobody was recorded against. */
  keeper: string | null;
  drives: Drive[];
}

/**
 * Available drives by which owner has them. Every owner gets a group, even an
 * empty one, so "Tommy has none" is visible rather than missing.
 */
export function groupAvailable(drives: Drive[]): KeeperGroup[] {
  const groups: KeeperGroup[] = OWNERS.map((o) => ({ keeper: o, drives: [] }));
  const unassigned: KeeperGroup = { keeper: null, drives: [] };
  for (const d of drives) {
    if (d.status !== 'in_office') continue;
    const k = keeperOf(d);
    (k ? groups.find((g) => g.keeper === k)! : unassigned).drives.push(d);
  }
  for (const g of groups) g.drives.sort(byLabel);
  unassigned.drives.sort(byLabel);
  return unassigned.drives.length ? [...groups, unassigned] : groups;
}

/** "2 TB", "500 GB", or '' when no capacity was logged. */
export function formatCapacity(tb: number | null | undefined): string {
  const n = Number(tb);
  if (!n || n <= 0) return '';
  if (n < 1) return `${Math.round(n * 1000)} GB`;
  return `${Number.isInteger(n) ? n : n.toFixed(1)} TB`;
}

/** "Samsung T9 · 2 TB" */
export function describeDrive(drive: Pick<Drive, 'model' | 'capacity_tb'>): string {
  return [drive.model?.trim(), formatCapacity(drive.capacity_tb)].filter(Boolean).join(' · ');
}
