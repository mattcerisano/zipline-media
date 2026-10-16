/**
 * Drive Tracker rules. The studio hands SSDs to editors and agencies around
 * the city and forgets who has them; these helpers decide which drives to
 * chase and how much storage is sitting outside the office.
 *
 * A drive is overdue when its expected-back date has passed. Without a date it
 * still gets flagged after a grace period: transfer drives are meant to come
 * straight back once an agency has copied the footage, so two weeks is long;
 * editor drives stay out for a whole edit, so they get three months.
 */
import { parseLocalDate, formatLocalDate } from './date';

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
  holder_name: string | null;
  holder_type: HolderType | null;
  job_id: string | null;
  checked_out_at: string | null;
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

/** Days a drive with no expected-back date may stay out before it's flagged. */
export const GRACE_DAYS: Record<DriveKind, number> = { editor: 90, transfer: 14 };

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

/** Days past the date it should have been back (0 or more), or null if it isn't overdue. */
export function daysOverdue(
  drive: Pick<Drive, 'status' | 'checked_out_at' | 'expected_back' | 'kind'>,
  now: Date = new Date()
): number | null {
  if (drive.status !== 'out') return null;
  const today = startOfDay(now);
  const due = parseLocalDate(drive.expected_back);
  if (due) {
    const late = Math.round((today - startOfDay(due)) / DAY_MS);
    return late > 0 ? late : null;
  }
  const out = daysOut(drive, now);
  if (out === null) return null;
  const late = out - GRACE_DAYS[drive.kind];
  return late > 0 ? late : null;
}

export function isOverdue(
  drive: Pick<Drive, 'status' | 'checked_out_at' | 'expected_back' | 'kind'>,
  now: Date = new Date()
): boolean {
  return daysOverdue(drive, now) !== null;
}

export interface DriveTotals {
  total: number;
  inOffice: number;
  out: number;
  overdue: number;
  lost: number;
  /** Terabytes currently out of the office. */
  tbOut: number;
  /** What the drives currently out cost, where a price was logged. */
  valueOut: number;
  /** What the lost drives cost, where a price was logged. */
  valueLost: number;
}

export function driveTotals(drives: Drive[], now: Date = new Date()): DriveTotals {
  const t: DriveTotals = { total: 0, inOffice: 0, out: 0, overdue: 0, lost: 0, tbOut: 0, valueOut: 0, valueLost: 0 };
  for (const d of drives) {
    if (d.status === 'retired') continue;
    t.total++;
    if (d.status === 'in_office') t.inOffice++;
    if (d.status === 'lost') {
      t.lost++;
      t.valueLost += Number(d.purchase_price) || 0;
    }
    if (d.status === 'out') {
      t.out++;
      t.tbOut += Number(d.capacity_tb) || 0;
      t.valueOut += Number(d.purchase_price) || 0;
      if (isOverdue(d, now)) t.overdue++;
    }
  }
  return t;
}

export interface HolderGroup {
  holder: string;
  holderType: HolderType | null;
  drives: Drive[];
  overdue: number;
}

/**
 * Drives that are out, grouped by who has them — the "who do I need to call"
 * view. Holders with an overdue drive come first, then by most drives held.
 * Names are matched case-insensitively so "Acme Agency" and "acme agency" merge.
 */
export function groupByHolder(drives: Drive[], now: Date = new Date()): HolderGroup[] {
  const groups = new Map<string, HolderGroup>();
  for (const d of drives) {
    if (d.status !== 'out') continue;
    const name = (d.holder_name || '').trim() || 'Unknown';
    const key = name.toLowerCase();
    let g = groups.get(key);
    if (!g) {
      g = { holder: name, holderType: d.holder_type, drives: [], overdue: 0 };
      groups.set(key, g);
    }
    g.drives.push(d);
    if (isOverdue(d, now)) g.overdue++;
  }
  const list = [...groups.values()];
  for (const g of list) {
    g.drives.sort((a, b) => (daysOut(b, now) ?? 0) - (daysOut(a, now) ?? 0));
  }
  return list.sort((a, b) => b.overdue - a.overdue || b.drives.length - a.drives.length || a.holder.localeCompare(b.holder));
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

/**
 * A friendly chaser to paste into a text or email. One message covers every
 * drive the person has, so an editor holding three drives gets one nudge.
 */
export function reminderMessage(
  holder: string,
  drives: Pick<Drive, 'label' | 'model' | 'capacity_tb' | 'checked_out_at' | 'job_id'>[],
  jobTitles: Record<string, string> = {}
): string {
  const first = holder.trim().split(/\s+/)[0] || 'there';
  const lines = drives.map((d) => {
    const bits = [describeDrive(d)];
    if (d.job_id && jobTitles[d.job_id]) bits.push(`from ${jobTitles[d.job_id]}`);
    if (d.checked_out_at) bits.push(`out since ${formatLocalDate(d.checked_out_at, { month: 'short', day: 'numeric' })}`);
    return `• ${d.label}${bits.filter(Boolean).length ? ` (${bits.filter(Boolean).join(', ')})` : ''}`;
  });
  const which = drives.length === 1 ? 'a drive' : `${drives.length} drives`;
  const it = drives.length === 1 ? 'it' : 'them';
  return [
    `Hi ${first}, quick check from Zipline: our records show you still have ${which} of ours:`,
    ...lines,
    `If you're done with ${it}, could we arrange to get ${it} back? If you still need ${it}, no problem, just let us know roughly when. Thanks!`,
  ].join('\n');
}
