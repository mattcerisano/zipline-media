'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Clapperboard, Scissors, HardDrive, ClipboardCheck, ChevronRight, CheckCircle2, Film, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { postNotify } from '@/lib/notify';
import { pushJobToGoogleCalendar } from '@/lib/calendar-push';
import { addDays, formatLocalDate, todayLocalISO } from '@/lib/date';
import { DEFAULT_STAGE_DEFS, sanitizeStageDefs, stageLabel, type EditStageDef } from '@/lib/edit-stages';
import {
  drivesOutLongest,
  editsDue,
  lastDayOf,
  needsClosingOut,
  upcomingShootDays,
  type WeekDrive,
  type WeekJob,
} from '@/lib/week-ahead';
import { DropdownMenu, Modal } from '@/components/workspace/Overlay';
import { toast } from '@/components/Feedback';

/**
 * The dashboard's "This week": the shoots coming up, the edits that are late
 * or due, the past shoots nobody closed out, and the drives gone longest.
 *
 * The dashboard used to open on totals, a webhook test box and integration
 * diagnostics — nothing that said what the studio is doing this week. Every
 * row here opens the thing it's about. One load feeds all four sections, and
 * any of them can be hidden from the dashboard's Customize menu.
 */

export interface ThisWeekSections {
  shoots: boolean;
  edits: boolean;
  closeOut: boolean;
  drives: boolean;
}

/** Rows shown before a section says "and N more". */
const CLOSE_OUT_LIMIT = 5;

export default function ThisWeek({
  show,
  onSwitchTab,
}: {
  show: ThisWeekSections;
  onSwitchTab: (target: unknown) => void;
}) {
  const [jobs, setJobs] = useState<WeekJob[]>([]);
  const [drives, setDrives] = useState<WeekDrive[]>([]);
  const [stageDefs, setStageDefs] = useState<EditStageDef[]>(DEFAULT_STAGE_DEFS);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // "Close out all": one sheet listing every stale shoot with what to do to
  // each, instead of 38 trips through the one-at-a-time menu.
  type CloseOutChoice = 'wrapped' | 'wrapped_post' | 'cancelled' | 'skip';
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPlan, setBulkPlan] = useState<Record<string, CloseOutChoice>>({});
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    const [jobsRes, drivesRes, orgRes] = await Promise.all([
      supabase
        .from('jobs')
        // `*` rather than a column list, so archived_at is read once it exists
        // without breaking this query before the archive migration runs.
        .select('*, editor:contacts(name)')
        .limit(2000),
      // Fails soft where the Drive Tracker migration hasn't run.
      supabase.from('drives').select('id, label, holder_name, status, checked_out_at').eq('status', 'out'),
      supabase.from('organizations').select('edit_stages').order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (!jobsRes.error && jobsRes.data) {
      setJobs((jobsRes.data as any[])
        // Archived productions are kept, but they aren't this week's business.
        .filter(j => !j.archived_at)
        .map(({ editor, ...j }) => ({ ...j, editor_name: editor?.name ?? null })));
    }
    if (!drivesRes.error && drivesRes.data) setDrives(drivesRes.data as WeekDrive[]);
    setStageDefs(sanitizeStageDefs((orgRes.data as any)?.edit_stages) || DEFAULT_STAGE_DEFS);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void (async () => { await load(); })();
  }, [load]);

  // Live: a teammate booking, wrapping or returning a drive shows up here.
  useRealtime(['jobs', 'drives'], load);

  const today = todayLocalISO();
  const shootDays = useMemo(() => upcomingShootDays(jobs, today), [jobs, today]);
  const due = useMemo(() => editsDue(jobs, today), [jobs, today]);
  const stale = useMemo(() => needsClosingOut(jobs, today), [jobs, today]);
  const drivesOut = useMemo(() => drivesOutLongest(drives), [drives]);

  const dayLabel = (date: string) =>
    date === today ? 'Today'
      : date === addDays(today, 1) ? 'Tomorrow'
      : formatLocalDate(date, { weekday: 'long', month: 'short', day: 'numeric' });

  /**
   * Close out a past shoot in one step: wrapped, wrapped and onto the edit
   * board, or cancelled. The same write, alert and Google push a status change
   * on its Slate card makes — a cancelled one comes off the studio calendar.
   */
  /** The write itself, plus the Google Calendar push. Returns the error message, or null. */
  const writeCloseOut = async (job: WeekJob, action: 'wrapped' | 'wrapped_post' | 'cancelled'): Promise<string | null> => {
    const status = action === 'cancelled' ? 'Cancelled' : 'Wrapped';
    const patch: Record<string, unknown> = { job_status: status };
    if (action === 'wrapped_post' && !job.edit_status) patch.edit_status = stageDefs[0]?.id || 'Filmed';

    const { error } = await supabase.from('jobs').update(patch).eq('id', job.id);
    if (error) return error.message;
    setJobs(prev => prev.map(j => (j.id === job.id ? { ...j, ...patch } as WeekJob : j)));
    if (job.shoot_date) {
      pushJobToGoogleCalendar(job.id).then(result => {
        if (!result.ok && result.message) toast(result.message, 'error');
      });
    }
    return null;
  };

  const closeOut = async (job: WeekJob, action: 'wrapped' | 'wrapped_post' | 'cancelled') => {
    const status = action === 'cancelled' ? 'Cancelled' : 'Wrapped';

    setBusyId(job.id);
    const message = await writeCloseOut(job, action);
    setBusyId(null);
    if (message) {
      toast(`Couldn't update "${job.title}": ${message}`, 'error');
      return;
    }

    toast(
      action === 'cancelled' ? `"${job.title}" marked cancelled.`
        : action === 'wrapped_post' ? `"${job.title}" wrapped and added to the edit board.`
        : `"${job.title}" marked wrapped.`,
      'success',
    );
    postNotify({
      event_key: `status_${status.toLowerCase()}`,
      variables: {
        title: job.title,
        client: job.client_name || job.production_company || 'Internal',
        production_company: job.production_company || '',
        shoot_date: job.shoot_date || '',
        location: job.location_name || '',
        old_status: job.job_status || '',
        new_status: status,
      },
    }).catch(() => { /* an alert hiccup never undoes the change */ });
  };

  const openBulk = () => {
    // A hold that passed didn't happen; anything booked or planned did.
    const plan: Record<string, CloseOutChoice> = {};
    for (const j of stale) plan[j.id] = j.job_status === 'Hold' ? 'cancelled' : 'wrapped';
    setBulkPlan(plan);
    setBulkOpen(true);
  };

  /**
   * Run the sheet. One summary toast rather than one per shoot, and no team
   * alerts — closing out a season of old shoots is housekeeping, not news.
   */
  const runBulk = async () => {
    const todo = stale.filter(j => (bulkPlan[j.id] || 'skip') !== 'skip');
    if (todo.length === 0) { setBulkOpen(false); return; }
    setBulkBusy(true);
    const failed: string[] = [];
    for (const j of todo) {
      const message = await writeCloseOut(j, bulkPlan[j.id] as 'wrapped' | 'wrapped_post' | 'cancelled');
      if (message) failed.push(`${j.title} (${message})`);
    }
    setBulkBusy(false);
    setBulkOpen(false);
    const done = todo.length - failed.length;
    if (failed.length === 0) {
      toast(`Closed out ${done} shoot${done === 1 ? '' : 's'}.`, 'success');
    } else {
      toast(`Closed out ${done}; ${failed.length} failed: ${failed.join(', ')}`, 'error');
    }
  };

  const bulkCount = stale.filter(j => (bulkPlan[j.id] || 'skip') !== 'skip').length;

  const anyShown = show.shoots || show.edits || show.closeOut || show.drives;
  if (!anyShown) return null;

  const cardClass = 'bg-zinc-950/40 border border-white/10 rounded-2xl p-4 flex flex-col min-w-0';
  const rowClass = 'w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-white/[0.05] transition-colors min-w-0';

  const header = (icon: React.ReactNode, title: string, count?: number, action?: { label: string; onClick: () => void }) => (
    <div className="flex items-center justify-between gap-2 mb-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white min-w-0">
        {icon}
        <span className="truncate">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[11px] font-medium text-white/40 tabular-nums">{count}</span>
        )}
      </h3>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 flex items-center gap-0.5 text-[11px] font-medium text-white/40 hover:text-white transition-colors"
        >
          {action.label} <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  const empty = (text: string) => <p className="px-2.5 py-3 text-[12px] text-white/35">{text}</p>;
  const shootCount = shootDays.reduce((n, d) => n + d.shoots.length, 0);

  return (
    <div className="md:col-span-2 lg:col-span-3 mt-5" data-tour="this-week">
      <h2 className="text-base font-semibold tracking-tight text-white mb-3">This week</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coming up */}
        {show.shoots && (
          <section className={cardClass}>
            {header(<Clapperboard className="w-4 h-4 text-accent" />, 'Coming up', shootCount, { label: 'Calendar', onClick: () => onSwitchTab('calendar') })}
            {!loaded ? empty('Loading…') : shootDays.length === 0 ? empty('Nothing on the calendar for the next 7 days.') : (
              <div className="space-y-2.5">
                {shootDays.map(day => (
                  <div key={day.date}>
                    <p className={`px-2.5 mb-0.5 text-[11px] font-medium ${day.date === today ? 'text-accent' : 'text-white/45'}`}>{dayLabel(day.date)}</p>
                    {day.shoots.map(s => (
                      <button
                        key={`${day.date}-${s.id}`}
                        type="button"
                        onClick={() => onSwitchTab({ selectCalendarJob: s.id })}
                        title="Open on the Slate"
                        className={rowClass}
                      >
                        <span className="w-16 shrink-0 text-[11px] font-medium text-white/50 tabular-nums">
                          {s.continuing ? 'Continues' : s.call_time || 'All day'}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-medium text-white truncate">{s.title}</span>
                          <span className="block text-[11px] text-white/40 truncate">
                            {[s.client_name, s.location_name].filter(Boolean).join(' · ') || ' '}
                          </span>
                        </span>
                        {s.job_status && s.job_status !== 'Booked' && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/5 text-white/50">{s.job_status}</span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Edits due */}
        {show.edits && (
          <section className={cardClass}>
            {header(<Scissors className="w-4 h-4 text-accent" />, 'Edits due', due.length, { label: 'Edit Tracker', onClick: () => onSwitchTab('edits') })}
            {!loaded ? empty('Loading…') : due.length === 0 ? empty('No edits late or due in the next 7 days.') : (
              <div className="space-y-0.5">
                {due.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSwitchTab({ openEditCard: e.id })}
                    title="Open this card on the Edit Tracker"
                    className={rowClass}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-white truncate">{e.title}</span>
                      <span className="block text-[11px] text-white/40 truncate">
                        {[stageLabel(stageDefs, e.edit_status), e.editor_name || 'No editor'].join(' · ')}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      e.overdue ? 'bg-red-500/15 text-red-300' : e.due_date === today ? 'bg-amber-500/15 text-amber-300' : 'bg-white/5 text-white/55'
                    }`}>
                      {e.overdue ? `Late · ${formatLocalDate(e.due_date, { month: 'short', day: 'numeric' })}`
                        : e.due_date === today ? 'Due today'
                        : `Due ${formatLocalDate(e.due_date, { weekday: 'short' })}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Close out past shoots — hidden when there's nothing to close. */}
        {show.closeOut && loaded && stale.length > 0 && (
          <section className={cardClass}>
            {header(<ClipboardCheck className="w-4 h-4 text-amber-400" />, 'Close out past shoots', stale.length, stale.length > 1 ? { label: 'Close out all', onClick: openBulk } : undefined)}
            <p className="px-2.5 -mt-1 mb-2 text-[11px] text-white/40 leading-relaxed">
              These have finished but still read Booked, Hold or Planning, so they count as upcoming everywhere.
            </p>
            <div className="space-y-0.5">
              {stale.slice(0, CLOSE_OUT_LIMIT).map(j => (
                <div key={j.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04] min-w-0">
                  <button
                    type="button"
                    onClick={() => onSwitchTab({ selectCalendarJob: j.id })}
                    title="Open on the Slate"
                    className="flex-1 min-w-0 text-left"
                  >
                    <span className="block text-[13px] font-medium text-white truncate">{j.title}</span>
                    <span className="block text-[11px] text-white/40 truncate">
                      {formatLocalDate(lastDayOf(j), { month: 'short', day: 'numeric' })} · {j.job_status}
                      {j.client_name ? ` · ${j.client_name}` : ''}
                    </span>
                  </button>
                  <DropdownMenu
                    align="right"
                    trigger={({ onClick, ref, ...aria }) => (
                      <button
                        ref={ref}
                        onClick={onClick}
                        {...aria}
                        aria-haspopup="menu"
                        disabled={busyId === j.id}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
                      >
                        Close out
                      </button>
                    )}
                    items={[
                      { label: 'Mark wrapped', icon: <CheckCircle2 className="w-3.5 h-3.5" />, onSelect: () => void closeOut(j, 'wrapped') },
                      ...(!j.edit_status ? [{
                        label: 'Wrapped, add to edit board',
                        hint: 'Starts it in post',
                        icon: <Film className="w-3.5 h-3.5" />,
                        onSelect: () => void closeOut(j, 'wrapped_post'),
                      }] : []),
                      { label: "Didn't happen — cancel", icon: <XCircle className="w-3.5 h-3.5" />, onSelect: () => void closeOut(j, 'cancelled'), danger: true },
                    ]}
                  />
                </div>
              ))}
            </div>
            {stale.length > CLOSE_OUT_LIMIT && (
              <button
                type="button"
                onClick={() => onSwitchTab('slate')}
                className="mt-2 px-2.5 text-left text-[11px] font-medium text-white/40 hover:text-white transition-colors"
              >
                {stale.length - CLOSE_OUT_LIMIT} more on the Slate
              </button>
            )}
          </section>
        )}

        <Modal
          open={bulkOpen}
          onClose={() => { if (!bulkBusy) setBulkOpen(false); }}
          title={`Close out ${stale.length} past shoot${stale.length === 1 ? '' : 's'}`}
          subtitle="Booked and planned shoots are marked wrapped; holds that passed are marked cancelled and come off the calendar. Change any row, or skip it."
          maxWidth="max-w-2xl"
          footer={(
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-3 text-[11px]">
                <button type="button" onClick={() => setBulkPlan(Object.fromEntries(stale.map(j => [j.id, 'wrapped' as CloseOutChoice])))} className="text-white/50 hover:text-white transition-colors">All wrapped</button>
                <button type="button" onClick={() => setBulkPlan(Object.fromEntries(stale.map(j => [j.id, 'skip' as CloseOutChoice])))} className="text-white/50 hover:text-white transition-colors">Skip all</button>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setBulkOpen(false)} disabled={bulkBusy} className="px-4 py-2 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void runBulk()}
                  disabled={bulkBusy || bulkCount === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {bulkBusy ? 'Closing out…' : `Close out ${bulkCount}`}
                </button>
              </div>
            </div>
          )}
        >
          <div className="space-y-1">
            {stale.map(j => (
              <div key={j.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] min-w-0">
                <div className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-white truncate">{j.title}</span>
                  <span className="block text-[11px] text-white/40 truncate">
                    {formatLocalDate(lastDayOf(j), { month: 'short', day: 'numeric' })} · {j.job_status}
                    {j.client_name ? ` · ${j.client_name}` : ''}
                  </span>
                </div>
                <select
                  value={bulkPlan[j.id] || 'skip'}
                  onChange={e => setBulkPlan(prev => ({ ...prev, [j.id]: e.target.value as CloseOutChoice }))}
                  disabled={bulkBusy}
                  aria-label={`What to do with ${j.title}`}
                  className={`shrink-0 bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-[11px] font-semibold outline-none focus:border-accent cursor-pointer ${
                    (bulkPlan[j.id] || 'skip') === 'skip' ? 'text-white/40' : (bulkPlan[j.id] === 'cancelled' ? 'text-red-400' : 'text-white')
                  }`}
                >
                  <option value="wrapped" className="bg-zinc-950 text-white">Wrapped</option>
                  {!j.edit_status && <option value="wrapped_post" className="bg-zinc-950 text-white">Wrapped, add to edit board</option>}
                  <option value="cancelled" className="bg-zinc-950 text-white">Didn't happen</option>
                  <option value="skip" className="bg-zinc-950 text-white">Skip</option>
                </select>
              </div>
            ))}
          </div>
        </Modal>

        {/* Drives out longest */}
        {show.drives && (
          <section className={cardClass}>
            {header(<HardDrive className="w-4 h-4 text-accent" />, 'Drives out longest', drivesOut.length, { label: 'Drive Tracker', onClick: () => onSwitchTab('drives') })}
            {!loaded ? empty('Loading…') : drivesOut.length === 0 ? empty('Every drive is back in.') : (
              <div className="space-y-0.5">
                {drivesOut.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onSwitchTab('drives')}
                    title="Open the Drive Tracker"
                    className={rowClass}
                  >
                    <span className="w-24 shrink-0 text-[13px] font-semibold text-white truncate">{d.label}</span>
                    <span className="flex-1 min-w-0 text-[12px] text-white/60 truncate">{d.holder_name || 'Unknown'}</span>
                    <span className={`shrink-0 text-[11px] font-medium tabular-nums ${d.days !== null && d.days >= 30 ? 'text-amber-300' : 'text-white/45'}`}>
                      {d.days === null ? '—' : d.days === 0 ? 'Today' : `${d.days} day${d.days === 1 ? '' : 's'}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
