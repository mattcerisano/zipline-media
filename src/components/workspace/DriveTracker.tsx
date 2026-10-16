'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HardDrive,
  Plus,
  Search,
  MoreVertical,
  ArrowUpRight,
  CornerDownLeft,
  History,
  Pencil,
  AlertTriangle,
  Archive,
  Trash2,
  Copy,
  Check,
  Users,
  List,
  RotateCcw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { Modal, DropdownMenu, type MenuItem } from '@/components/workspace/Overlay';
import { formatLocalDate, todayLocalISO, addDays } from '@/lib/date';
import {
  DRIVE_MODELS,
  GRACE_DAYS,
  daysOut,
  daysOverdue,
  describeDrive,
  driveTotals,
  formatCapacity,
  groupByHolder,
  reminderMessage,
  type Drive,
  type DriveAction,
  type DriveEvent,
  type DriveKind,
  type DriveStatus,
  type HolderType,
} from '@/lib/drives';

interface JobOption {
  id: string;
  title: string;
  shoot_date: string | null;
}

type View = 'holders' | 'all';
type StatusFilter = 'all' | 'out' | 'overdue' | 'in_office' | 'lost' | 'retired';
type KindFilter = 'all' | DriveKind;

const STATUS_LABEL: Record<DriveStatus, string> = {
  in_office: 'In office',
  out: 'Out',
  lost: 'Lost',
  retired: 'Retired',
};

const HOLDER_TYPE_LABEL: Record<HolderType, string> = {
  editor: 'Editor',
  agency: 'Agency',
  client: 'Client',
  other: 'Other',
};

const ACTION_LABEL: Record<DriveAction, string> = {
  added: 'Added to tracker',
  checked_out: 'Checked out',
  returned: 'Returned',
  lost: 'Marked lost',
  found: 'Found',
  retired: 'Retired',
  note: 'Note',
};

const inputClass =
  'w-full bg-black/40 border border-white/10 px-3 py-2.5 rounded-lg outline-none focus:border-accent text-sm text-white placeholder:text-white/30';
const labelClass = 'block text-[11px] font-medium text-white/50 mb-1.5';

const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Who in the studio is logging a change, for the history trail. */
async function currentActor(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  return (data?.full_name as string | undefined) || user.email || null;
}

export default function DriveTracker() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [holderSuggestions, setHolderSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [view, setView] = useState<View>('holders');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState<Drive | 'new' | null>(null);
  const [checkingOut, setCheckingOut] = useState<Drive | null>(null);
  const [historyFor, setHistoryFor] = useState<Drive | null>(null);
  const [copiedHolder, setCopiedHolder] = useState<string | null>(null);

  const applyDrives = useCallback(({ data, error }: { data: unknown[] | null; error: { code?: string; message: string } | null }) => {
    if (error) {
      // The table only exists once 20261015000000_drive_tracker.sql is run.
      setLoadError(
        error.code === '42P01' || /does not exist|schema cache/i.test(error.message)
          ? 'The drive tracker table isn’t set up yet. Run supabase/migrations/20261015000000_drive_tracker.sql in the Supabase SQL editor.'
          : error.message
      );
    } else {
      setLoadError(null);
      setDrives((data || []) as Drive[]);
    }
    setLoading(false);
  }, []);

  const load = useCallback(() => {
    supabase.from('drives').select('*').order('label').then(applyDrives);
  }, [applyDrives]);

  useEffect(() => {
    supabase.from('drives').select('*').order('label').then(applyDrives);
    // Pickers: recent productions, and the names a drive usually goes to.
    supabase
      .from('jobs')
      .select('id, title, shoot_date')
      .order('shoot_date', { ascending: false, nullsFirst: false })
      .limit(300)
      .then(({ data }) => setJobs((data || []) as JobOption[]));
    Promise.all([
      supabase.from('contacts').select('name').limit(2000),
      supabase.from('clients').select('name').limit(1000),
    ]).then(([contacts, clients]) => {
      const names = new Set<string>();
      for (const r of [...(contacts.data || []), ...(clients.data || [])]) {
        const n = (r as { name?: string }).name?.trim();
        if (n) names.add(n);
      }
      setHolderSuggestions([...names].sort((a, b) => a.localeCompare(b)));
    });
  }, [applyDrives]);

  useRealtime(['drives'], load);

  const jobTitles = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j.title])), [jobs]);
  const totals = useMemo(() => driveTotals(drives), [drives]);

  const matches = useCallback(
    (d: Drive) => {
      if (kindFilter !== 'all' && d.kind !== kindFilter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [d.label, d.model, d.serial, d.holder_name, d.notes, d.job_id ? jobTitles[d.job_id] : '']
        .some((v) => (v || '').toLowerCase().includes(q));
    },
    [kindFilter, query, jobTitles]
  );

  const listed = useMemo(() => {
    return drives
      .filter(matches)
      .filter((d) => {
        switch (statusFilter) {
          case 'all': return d.status !== 'retired';
          case 'overdue': return daysOverdue(d) !== null;
          default: return d.status === statusFilter;
        }
      })
      .sort((a, b) => {
        // Overdue first, then out (longest first), then the rest by label.
        const oa = daysOverdue(a) ?? -1;
        const ob = daysOverdue(b) ?? -1;
        if (oa !== ob) return ob - oa;
        const da = daysOut(a) ?? -1;
        const db = daysOut(b) ?? -1;
        if (da !== db) return db - da;
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
  }, [drives, matches, statusFilter]);

  const holderGroups = useMemo(() => groupByHolder(drives.filter(matches)), [drives, matches]);

  // ---- Writes ------------------------------------------------------------

  const logEvent = async (drive: Drive, action: DriveAction, extra: Partial<DriveEvent> = {}) => {
    const actor = await currentActor();
    await supabase.from('drive_events').insert({
      drive_id: drive.id,
      action,
      holder_name: extra.holder_name ?? drive.holder_name,
      job_id: extra.job_id ?? drive.job_id,
      note: extra.note ?? null,
      actor,
    });
  };

  const patchDrive = async (drive: Drive, patch: Partial<Drive>, action: DriveAction, extra: Partial<DriveEvent> = {}) => {
    setDrives((prev) => prev.map((d) => (d.id === drive.id ? { ...d, ...patch } : d)));
    const { error } = await supabase.from('drives').update(patch).eq('id', drive.id);
    if (error) {
      alert(`Couldn’t update ${drive.label}: ${error.message}`);
      load();
      return;
    }
    await logEvent(drive, action, extra);
  };

  const clearHolder: Partial<Drive> = { holder_name: null, holder_type: null, job_id: null, checked_out_at: null, expected_back: null };

  const markReturned = (drive: Drive) =>
    patchDrive(drive, { status: 'in_office', ...clearHolder }, 'returned', { holder_name: drive.holder_name, job_id: drive.job_id });

  const markLost = (drive: Drive) => {
    if (!confirm(`Mark ${drive.label} as lost? It stays in the tracker so you can mark it found later.`)) return;
    patchDrive(drive, { status: 'lost' }, 'lost');
  };

  const markFound = (drive: Drive) => patchDrive(drive, { status: 'in_office', ...clearHolder }, 'found');

  const retire = (drive: Drive) => {
    if (!confirm(`Retire ${drive.label}? Use this for a drive that died or was given away. It drops out of the totals.`)) return;
    patchDrive(drive, { status: 'retired', ...clearHolder }, 'retired');
  };

  const remove = async (drive: Drive) => {
    if (!confirm(`Delete ${drive.label} and its whole history? Retire it instead if it ever existed.`)) return;
    setDrives((prev) => prev.filter((d) => d.id !== drive.id));
    const { error } = await supabase.from('drives').delete().eq('id', drive.id);
    if (error) {
      alert(`Couldn’t delete ${drive.label}: ${error.message}`);
      load();
    }
  };

  const returnAll = async (holder: string, list: Drive[]) => {
    if (!confirm(`Mark all ${list.length} drives from ${holder} as returned?`)) return;
    for (const d of list) await markReturned(d);
  };

  const copyReminder = async (holder: string, list: Drive[]) => {
    const text = reminderMessage(holder, list, jobTitles);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHolder(holder);
      setTimeout(() => setCopiedHolder((h) => (h === holder ? null : h)), 2000);
    } catch {
      prompt('Copy this reminder:', text);
    }
  };

  // ---- Render ------------------------------------------------------------

  const menuFor = (d: Drive): MenuItem[] => {
    const items: MenuItem[] = [
      { label: 'Edit details', icon: <Pencil className="w-3.5 h-3.5" />, onSelect: () => setEditing(d) },
      { label: 'History', icon: <History className="w-3.5 h-3.5" />, onSelect: () => setHistoryFor(d), hint: 'Everyone who has had it' },
    ];
    if (d.status === 'out') {
      items.push({ label: 'Change holder or date', icon: <ArrowUpRight className="w-3.5 h-3.5" />, onSelect: () => setCheckingOut(d) });
    }
    if (d.status === 'lost') {
      items.push({ label: 'Mark found', icon: <RotateCcw className="w-3.5 h-3.5" />, onSelect: () => markFound(d) });
    } else if (d.status !== 'retired') {
      items.push({ label: 'Mark lost', icon: <AlertTriangle className="w-3.5 h-3.5" />, onSelect: () => markLost(d) });
    }
    if (d.status === 'retired') {
      items.push({ label: 'Bring back into service', icon: <RotateCcw className="w-3.5 h-3.5" />, onSelect: () => markFound(d) });
    } else {
      items.push({ label: 'Retire', icon: <Archive className="w-3.5 h-3.5" />, onSelect: () => retire(d), hint: 'Dead, wiped for good, or given away' });
    }
    items.push({ label: 'Delete', icon: <Trash2 className="w-3.5 h-3.5" />, onSelect: () => remove(d), danger: true });
    return items;
  };

  const renderRow = (d: Drive, opts: { showHolder: boolean }) => {
    const out = daysOut(d);
    const late = daysOverdue(d);
    const spec = describeDrive(d);
    return (
      <div
        key={d.id}
        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-colors ${
          late !== null ? 'border-red-500/25 bg-red-500/[0.04]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]'
        }`}
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            d.kind === 'transfer' ? 'bg-sky-500/10 text-sky-300' : 'bg-accent/10 text-accent'
          }`}
          title={d.kind === 'transfer' ? 'Transfer drive' : 'Editor drive'}
        >
          <HardDrive className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold tracking-tight text-white">{d.label}</span>
            {spec && <span className="hidden sm:inline text-[11px] text-white/40">{spec}</span>}
            {d.status !== 'out' && <StatusPill status={d.status} />}
            {out !== null && (
              <span className={`sm:hidden px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums ${
                late !== null ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/55'
              }`}>
                {late !== null ? `${late}d overdue` : `${out}d out`}
              </span>
            )}
          </div>
          {spec && <div className="sm:hidden text-[11px] text-white/40 truncate">{spec}</div>}
          <div className="text-[11px] text-white/45 mt-0.5 truncate">
            {d.status === 'out' ? (
              <>
                {opts.showHolder && <span className="text-white/75 font-medium">{d.holder_name || 'Unknown'}</span>}
                {opts.showHolder && d.job_id && jobTitles[d.job_id] && ' · '}
                {d.job_id && jobTitles[d.job_id] && <span>{jobTitles[d.job_id]}</span>}
                {d.expected_back && <span>{(opts.showHolder || d.job_id) ? ' · ' : ''}due {formatLocalDate(d.expected_back, { month: 'short', day: 'numeric' })}</span>}
              </>
            ) : (
              d.notes || (d.serial ? `S/N ${d.serial}` : d.kind === 'transfer' ? 'Transfer drive' : 'Editor drive')
            )}
          </div>
        </div>

        {out !== null && (
          <div className="text-right shrink-0 hidden sm:block">
            <div className={`text-xs font-semibold tabular-nums ${late !== null ? 'text-red-400' : 'text-white/70'}`}>
              {out === 0 ? 'Today' : `${out} day${out === 1 ? '' : 's'}`}
            </div>
            <div className={`text-[10px] ${late !== null ? 'text-red-400/80' : 'text-white/35'}`}>
              {late !== null ? `${late} day${late === 1 ? '' : 's'} overdue` : 'out'}
            </div>
          </div>
        )}

        {d.status === 'in_office' && (
          <button
            onClick={() => setCheckingOut(d)}
            aria-label={`Check out ${d.label}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-accent hover:text-white text-white/80 transition-colors"
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Check out</span>
          </button>
        )}
        {d.status === 'out' && (
          <button
            onClick={() => markReturned(d)}
            aria-label={`Mark ${d.label} returned`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-emerald-500 hover:text-white text-white/80 transition-colors"
          >
            <CornerDownLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Returned</span>
          </button>
        )}

        <DropdownMenu
          align="right"
          items={menuFor(d)}
          trigger={({ onClick, ref, ...aria }) => (
            <button
              ref={ref}
              onClick={onClick}
              {...aria}
              aria-haspopup="menu"
              aria-label={`Actions for ${d.label}`}
              className="p-1.5 -mr-1 shrink-0 text-white/45 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}
        />
      </div>
    );
  };

  const inOfficeShelf = drives.filter((d) => d.status === 'in_office' && matches(d));

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 pt-5 pb-4 shrink-0 border-b border-white/[0.06]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent" /> Drive tracker
            </h1>
            <p className="text-xs text-white/40 mt-0.5">
              Every SSD and transfer drive, who has it, and since when.
            </p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="shrink-0 bg-accent hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> Add drive
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <Stat
            label="Out now"
            value={String(totals.out)}
            detail={totals.tbOut ? `${formatCapacity(totals.tbOut)} of storage` : 'No storage out'}
            onClick={() => { setView('all'); setStatusFilter('out'); }}
          />
          <Stat
            label="Overdue"
            value={String(totals.overdue)}
            detail={totals.overdue ? 'Worth a nudge' : 'All on time'}
            tone={totals.overdue ? 'danger' : undefined}
            onClick={() => { setView('all'); setStatusFilter('overdue'); }}
          />
          <Stat
            label="In the office"
            value={String(totals.inOffice)}
            detail="Ready to hand out"
            onClick={() => { setView('all'); setStatusFilter('in_office'); }}
          />
          <Stat
            label="Value out"
            value={money(totals.valueOut)}
            detail={totals.lost ? `${totals.lost} lost${totals.valueLost ? ` · ${money(totals.valueLost)}` : ''}` : 'Where a price is logged'}
            tone={totals.lost ? 'warn' : undefined}
            onClick={totals.lost ? () => { setView('all'); setStatusFilter('lost'); } : undefined}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-2 mt-4">
          <Segmented
            value={view}
            onChange={(v) => setView(v as View)}
            options={[
              { value: 'holders', label: 'Who has what', icon: <Users className="w-3.5 h-3.5" /> },
              { value: 'all', label: 'All drives', icon: <List className="w-3.5 h-3.5" /> },
            ]}
          />
          <Segmented
            value={kindFilter}
            onChange={(v) => setKindFilter(v as KindFilter)}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'editor', label: 'Editor SSDs' },
              { value: 'transfer', label: 'Transfer' },
            ]}
          />
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search label, person, agency, project, serial…"
              className="w-full bg-white/[0.04] border border-white/10 pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:border-accent placeholder:text-white/30"
            />
          </div>
        </div>
        {view === 'all' && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
            {(['all', 'out', 'overdue', 'in_office', 'lost', 'retired'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  statusFilter === s ? 'bg-white text-black' : 'bg-white/[0.05] text-white/55 hover:text-white'
                }`}
              >
                {s === 'all' ? 'Active' : s === 'overdue' ? 'Overdue' : STATUS_LABEL[s as DriveStatus]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-white/40 gap-2 text-sm">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" /> Loading drives…
          </div>
        ) : loadError ? (
          <div className="max-w-lg mx-auto mt-10 p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] text-sm text-amber-200/90 flex gap-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {loadError}
          </div>
        ) : drives.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <HardDrive className="w-10 h-10 text-white/15 mx-auto" />
            <h3 className="text-sm font-semibold">No drives yet</h3>
            <p className="text-xs text-white/40 max-w-xs mx-auto">
              Add each SSD and transfer drive once with the name written on it. Then check it out whenever it leaves the office.
            </p>
            <button
              onClick={() => setEditing('new')}
              className="mt-2 bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add your first drive
            </button>
          </div>
        ) : view === 'holders' ? (
          <div className="space-y-5 max-w-4xl">
            {holderGroups.length === 0 ? (
              <p className="text-sm text-white/40 py-6 text-center">
                {query || kindFilter !== 'all' ? 'No drives out match that.' : 'Every drive is home. Nice.'}
              </p>
            ) : (
              holderGroups.map((g) => (
                <section key={g.holder} className="rounded-2xl border border-white/[0.07] bg-white/[0.015] p-3">
                  <div className="flex items-center justify-between gap-3 px-1 pb-2.5">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold tracking-tight truncate">
                        {g.holder}
                        {g.holderType && <span className="ml-2 text-[11px] font-normal text-white/35">{HOLDER_TYPE_LABEL[g.holderType]}</span>}
                      </h3>
                      <p className={`text-[11px] ${g.overdue ? 'text-red-400' : 'text-white/40'}`}>
                        {g.drives.length} drive{g.drives.length === 1 ? '' : 's'}
                        {' · '}
                        {formatCapacity(g.drives.reduce((s, d) => s + (Number(d.capacity_tb) || 0), 0)) || 'capacity not logged'}
                        {g.overdue ? ` · ${g.overdue} overdue` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => copyReminder(g.holder, g.drives)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] text-white/80 transition-colors"
                        title="Copy a friendly reminder to paste into a text or email"
                      >
                        {copiedHolder === g.holder ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{copiedHolder === g.holder ? 'Copied' : 'Copy reminder'}</span>
                      </button>
                      {g.drives.length > 1 && (
                        <button
                          onClick={() => returnAll(g.holder, g.drives)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] hover:bg-emerald-500 hover:text-white text-white/80 transition-colors"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">All returned</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">{g.drives.map((d) => renderRow(d, { showHolder: false }))}</div>
                </section>
              ))
            )}

            {inOfficeShelf.length > 0 && (
              <section>
                <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/35 px-1 mb-2">
                  On the shelf · {inOfficeShelf.length}
                </h3>
                <div className="space-y-1.5">{inOfficeShelf.map((d) => renderRow(d, { showHolder: true }))}</div>
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-1.5 max-w-4xl">
            {listed.length === 0 ? (
              <p className="text-sm text-white/40 py-6 text-center">No drives match.</p>
            ) : (
              listed.map((d) => renderRow(d, { showHolder: true }))
            )}
          </div>
        )}
      </div>

      {editing !== null && (
      <DriveForm
        key={editing === 'new' ? 'new' : editing.id}
        drive={editing === 'new' ? null : editing}
        existingLabels={drives.map((d) => d.label)}
        onClose={() => setEditing(null)}
        onSaved={async (saved, isNew) => {
          setEditing(null);
          if (isNew) await logEvent(saved, 'added');
          load();
        }}
      />
      )}

      {checkingOut && (
      <CheckoutForm
        key={checkingOut.id}
        drive={checkingOut}
        jobs={jobs}
        holderSuggestions={holderSuggestions}
        knownHolders={drives}
        onClose={() => setCheckingOut(null)}
        onSubmit={async (patch, note) => {
          const d = checkingOut!;
          setCheckingOut(null);
          await patchDrive(d, { ...patch, status: 'out' }, 'checked_out', {
            holder_name: patch.holder_name,
            job_id: patch.job_id,
            note,
          });
        }}
      />
      )}

      {historyFor && <HistoryPanel key={historyFor.id} drive={historyFor} jobTitles={jobTitles} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

// ---- Pieces ---------------------------------------------------------------

function StatusPill({ status }: { status: DriveStatus }) {
  const tone: Record<DriveStatus, string> = {
    in_office: 'bg-emerald-500/10 text-emerald-300',
    out: 'bg-accent/10 text-accent',
    lost: 'bg-amber-500/10 text-amber-300',
    retired: 'bg-white/5 text-white/40',
  };
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tone[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Stat({ label, value, detail, tone, onClick }: {
  label: string;
  value: string;
  detail: string;
  tone?: 'danger' | 'warn';
  onClick?: () => void;
}) {
  const color = tone === 'danger' ? 'text-red-400' : 'text-white';
  const detailColor = tone === 'warn' ? 'text-amber-300/90' : 'text-white/35';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="text-left rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 enabled:hover:bg-white/[0.05] transition-colors"
    >
      <div className="text-[11px] text-white/40">{label}</div>
      <div className={`text-xl font-semibold tracking-tight tabular-nums ${color}`}>{value}</div>
      <div className={`text-[10px] truncate ${detailColor}`}>{detail}</div>
    </button>
  );
}

function Segmented({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; icon?: React.ReactNode }[];
}) {
  return (
    <div className="flex bg-white/[0.04] border border-white/10 p-0.5 rounded-lg shrink-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            value === o.value ? 'bg-white/[0.12] text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}

function DriveForm({ drive, existingLabels, onClose, onSaved }: {
  drive: Drive | null;
  existingLabels: string[];
  onClose: () => void;
  onSaved: (drive: Drive, isNew: boolean) => void;
}) {
  const [label, setLabel] = useState(drive?.label ?? '');
  const [kind, setKind] = useState<DriveKind>(drive?.kind ?? 'editor');
  const [model, setModel] = useState(drive?.model ?? 'Samsung T9');
  const [capacity, setCapacity] = useState(drive?.capacity_tb != null ? String(drive.capacity_tb) : '2');
  const [serial, setSerial] = useState(drive?.serial ?? '');
  const [price, setPrice] = useState(drive?.purchase_price != null ? String(drive.purchase_price) : '');
  const [notes, setNotes] = useState(drive?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const duplicate =
    label.trim() &&
    existingLabels.some((l) => l.trim().toLowerCase() === label.trim().toLowerCase()) &&
    label.trim().toLowerCase() !== (drive?.label ?? '').trim().toLowerCase();

  const save = async () => {
    if (!label.trim()) return;
    setSaving(true);
    const row = {
      label: label.trim(),
      kind,
      model: model.trim() || null,
      capacity_tb: capacity ? Number(capacity) : null,
      serial: serial.trim() || null,
      purchase_price: price ? Number(price) : null,
      notes: notes.trim() || null,
    };
    const res = drive
      ? await supabase.from('drives').update(row).eq('id', drive.id).select().single()
      : await supabase.from('drives').insert(row).select().single();
    setSaving(false);
    if (res.error) {
      alert(`Couldn’t save the drive: ${res.error.message}`);
      return;
    }
    onSaved(res.data as Drive, !drive);
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-md"
      title={drive ? `Edit ${drive.label}` : 'Add a drive'}
      subtitle="Use the name written on the drive so anyone can match it"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-white/10 hover:bg-white/5">Cancel</button>
          <button
            onClick={save}
            disabled={!label.trim() || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : drive ? 'Save' : 'Add drive'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Label</label>
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ZM-07" className={inputClass} />
          {duplicate && <p className="text-[11px] text-amber-300 mt-1">Another drive already has this label.</p>}
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <Segmented
            value={kind}
            onChange={(v) => {
              setKind(v as DriveKind);
              if (v === 'transfer' && model.startsWith('Samsung')) setModel('Transfer stick');
              if (v === 'editor' && model === 'Transfer stick') setModel('Samsung T9');
            }}
            options={[
              { value: 'editor', label: 'Editor SSD' },
              { value: 'transfer', label: 'Transfer drive' },
            ]}
          />
          <p className="text-[11px] text-white/35 mt-1.5">
            {kind === 'transfer'
              ? `Should come straight back. Flagged after ${GRACE_DAYS.transfer} days if no return date is set.`
              : `Stays with an editor for the job. Flagged after ${GRACE_DAYS.editor} days if no return date is set.`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Model</label>
            <input list="drive-models" value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
            <datalist id="drive-models">{DRIVE_MODELS.map((m) => <option key={m} value={m} />)}</datalist>
          </div>
          <div>
            <label className={labelClass}>Capacity</label>
            <select value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass}>
              <option value="">Unknown</option>
              <option value="0.25">256 GB</option>
              <option value="0.5">500 GB</option>
              <option value="1">1 TB</option>
              <option value="2">2 TB</option>
              <option value="4">4 TB</option>
              <option value="8">8 TB</option>
              {capacity && !['0.25', '0.5', '1', '2', '4', '8'].includes(capacity) && <option value={capacity}>{formatCapacity(Number(capacity))}</option>}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Serial number</label>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>What it cost ($)</label>
            <input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Optional" className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Color, sticker, case, anything that helps spot it" className={`${inputClass} resize-none`} />
        </div>
      </div>
    </Modal>
  );
}

function CheckoutForm({ drive, jobs, holderSuggestions, knownHolders, onClose, onSubmit }: {
  drive: Drive;
  jobs: JobOption[];
  holderSuggestions: string[];
  knownHolders: Drive[];
  onClose: () => void;
  onSubmit: (patch: Pick<Drive, 'holder_name' | 'holder_type' | 'job_id' | 'checked_out_at' | 'expected_back'>, note: string | null) => void;
}) {
  const [holder, setHolder] = useState(drive.holder_name ?? '');
  const [holderType, setHolderType] = useState<HolderType>(drive.holder_type ?? (drive.kind === 'transfer' ? 'agency' : 'editor'));
  const [jobId, setJobId] = useState(drive.job_id ?? '');
  const [outDate, setOutDate] = useState(drive.checked_out_at ? todayLocalISO(new Date(drive.checked_out_at)) : todayLocalISO());
  // Transfer drives should bounce straight back, so they default to a week.
  const [expected, setExpected] = useState(drive.expected_back ?? (drive.kind === 'transfer' ? addDays(todayLocalISO(), 7) : ''));
  const [note, setNote] = useState('');

  const editingExisting = drive.status === 'out';

  // Names that have held a drive before come first; they're the likely ones.
  const names = useMemo(() => {
    const prior = knownHolders.map((d) => d.holder_name?.trim()).filter(Boolean) as string[];
    return [...new Set([...prior, ...holderSuggestions])];
  }, [knownHolders, holderSuggestions]);

  const submit = () => {
    if (!holder.trim()) return;
    onSubmit(
      {
        holder_name: holder.trim(),
        holder_type: holderType,
        job_id: jobId || null,
        checked_out_at: new Date(`${outDate}T12:00:00`).toISOString(),
        expected_back: expected || null,
      },
      note.trim() || null
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-md"
      title={`${editingExisting ? 'Update' : 'Check out'} ${drive.label}`}
      subtitle={describeDrive(drive) || undefined}
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-white/10 hover:bg-white/5">Cancel</button>
          <button onClick={submit} disabled={!holder.trim()} className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white disabled:opacity-40">
            {editingExisting ? 'Save' : 'Check out'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={labelClass}>Who has it</label>
          <input
            autoFocus
            list="drive-holders"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="Editor, agency or person"
            className={inputClass}
          />
          <datalist id="drive-holders">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </div>
        <div>
          <label className={labelClass}>They are a…</label>
          <Segmented
            value={holderType}
            onChange={(v) => setHolderType(v as HolderType)}
            options={(Object.keys(HOLDER_TYPE_LABEL) as HolderType[]).map((t) => ({ value: t, label: HOLDER_TYPE_LABEL[t] }))}
          />
        </div>
        <div>
          <label className={labelClass}>Project</label>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputClass}>
            <option value="">No project</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}{j.shoot_date ? ` · ${formatLocalDate(j.shoot_date, { month: 'short', day: 'numeric', year: '2-digit' })}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Went out</label>
            <input type="date" value={outDate} max={todayLocalISO()} onChange={(e) => setOutDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Expected back</label>
            <input type="date" value={expected} min={outDate} onChange={(e) => setExpected(e.target.value)} className={inputClass} />
          </div>
        </div>
        <p className="text-[11px] text-white/35 -mt-2">
          {expected
            ? 'It’s flagged overdue the day after this date.'
            : `No date: flagged after ${GRACE_DAYS[drive.kind]} days out.`}
        </p>
        <div>
          <label className={labelClass}>Note</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Couriered via Uber, has A-cam card dumps" className={inputClass} />
        </div>
      </div>
    </Modal>
  );
}

function HistoryPanel({ drive, jobTitles, onClose }: { drive: Drive; jobTitles: Record<string, string>; onClose: () => void }) {
  const [events, setEvents] = useState<DriveEvent[] | null>(null);

  useEffect(() => {
    supabase
      .from('drive_events')
      .select('*')
      .eq('drive_id', drive.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setEvents((data || []) as DriveEvent[]));
  }, [drive]);

  return (
    <Modal open onClose={onClose} maxWidth="max-w-md" title={`${drive.label} history`} subtitle={describeDrive(drive) || undefined}>
      {!events ? (
        <p className="text-sm text-white/40 py-4">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-white/40 py-4">Nothing logged yet.</p>
      ) : (
        <ol className="relative border-l border-white/10 ml-1.5 space-y-4 py-1">
          {events.map((e) => (
            <li key={e.id} className="pl-4 relative">
              <span className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${
                e.action === 'checked_out' ? 'bg-accent' : e.action === 'returned' || e.action === 'found' ? 'bg-emerald-400' : e.action === 'lost' ? 'bg-amber-400' : 'bg-white/30'
              }`} />
              <div className="text-sm text-white/85">
                {ACTION_LABEL[e.action]}
                {e.holder_name && (e.action === 'checked_out' || e.action === 'returned') && (
                  <span className="text-white/60">{e.action === 'checked_out' ? ' to ' : ' from '}{e.holder_name}</span>
                )}
              </div>
              <div className="text-[11px] text-white/40">
                {new Date(e.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                {e.actor && ` · ${e.actor}`}
                {e.job_id && jobTitles[e.job_id] && ` · ${jobTitles[e.job_id]}`}
              </div>
              {e.note && <div className="text-xs text-white/55 mt-0.5">{e.note}</div>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
