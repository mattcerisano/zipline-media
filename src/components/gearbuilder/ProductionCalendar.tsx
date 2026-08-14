'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, AlertCircle, X, Save, Loader2, RefreshCw, Plus
} from 'lucide-react';
import { Job, CalendarEvent, CalendarEventPreset } from './types';
import { supabase } from '@/lib/supabase';
import { todayLocalISO, formatLocalDate } from '@/lib/date';
import { useRealtime } from '@/lib/useRealtime';
import { pushJobToGoogleCalendar, pushEventToGoogleCalendar, removeEventFromGoogleCalendar } from '@/lib/calendar-push';
import { Modal } from '@/components/workspace/Overlay';
import { toast } from '@/components/Feedback';
import { trackAction } from '@/lib/usage';

// Quick-add presets for the Calendar tab. Lightweight markers, not productions.
//
// `quickAdd` marks the four offered in the menu. The others are still listed so
// markers created before the menu was simplified — and the ones the Google
// import writes — keep their own label and colour; dropping them outright would
// have re-coloured existing entries as whatever sat first in this array.
// Colours are Google Calendar's own event palette, by name and hex, with the
// `colorId` the API expects. Picking arbitrary Tailwind colours here meant a
// Hold was amber in Studio OS and the calendar's default blue in Google — the
// same event, two identities. These are the same colour in both places.
export const EVENT_PRESETS: { key: CalendarEventPreset; label: string; color: string; googleColorId: string; quickAdd?: boolean }[] = [
  { key: 'hold',     label: 'Hold',           color: '#f6bf26', googleColorId: '5',  quickAdd: true }, // Banana
  { key: 'timeout',  label: 'Out of Office',  color: '#e67c73', googleColorId: '4',  quickAdd: true }, // Flamingo
  { key: 'booked',   label: 'Booked',         color: '#0b8043', googleColorId: '10', quickAdd: true }, // Basil
  { key: 'meeting',  label: 'Meeting',        color: '#039be5', googleColorId: '7',  quickAdd: true }, // Peacock
  // Legacy — rendered so old markers keep their identity, never offered.
  { key: 'planning',  label: 'Planning Shoot', color: '#7986cb', googleColorId: '1' },  // Lavender
  { key: 'available', label: 'Available',      color: '#33b679', googleColorId: '2' },  // Sage
  { key: 'travel',    label: 'Travel Day',     color: '#3f51b5', googleColorId: '9' },  // Blueberry
  { key: 'edit',      label: 'Edit Day',       color: '#8e24aa', googleColorId: '3' },  // Grape
  // Imported from Google. Graphite reads as "this came from elsewhere".
  { key: 'google',    label: 'Google Calendar', color: '#616161', googleColorId: '8' }, // Graphite
];

/** Productions get their own colour so a shoot never reads as a meeting. */
export const PRODUCTION_COLOR = '#f4511e';      // Tangerine
export const PRODUCTION_COLOR_ID = '6';
const QUICK_ADD_PRESETS = EVENT_PRESETS.filter(p => p.quickAdd);
/**
 * Measured heights of the two things a week row stacks: the date-number track
 * and one lane of bars. The lane budget is divided out of these, so a row is
 * only ever given as many bars as it can actually draw.
 *
 * MIN_WEEK_H is the floor that follows — a date number and one bar. A window
 * too short for six of those scrolls the grid rather than shrinking further,
 * which beats slicing the bars in half.
 */
const DATE_ROW_H = 26;
const LANE_H = 21;
const MIN_WEEK_H = DATE_ROW_H + LANE_H;
const presetOf = (k?: string) => EVENT_PRESETS.find(p => p.key === k) || EVENT_PRESETS[0];

/**
 * Does an entry that runs from `start` through `end` (both inclusive, both
 * "YYYY-MM-DD") cover `date`?
 *
 * Stored dates are zero-padded ISO days, so a plain string comparison orders
 * them correctly — and unlike `new Date(...)` it can't drag a date across a
 * timezone boundary on the way to the answer.
 */
function coversDate(start: string | null | undefined, end: string | null | undefined, date: string): boolean {
  if (!start) return false;
  if (start === date) return true;
  if (!end || end <= start) return false;
  return date > start && date <= end;
}

interface ProductionCalendarProps {
  onSelectDate?: (date: string) => void;
  onSelectJob?: (job: Job) => void;
  onDeleteJob?: (jobId: string) => void;
  onSelectRange?: (start: string, end: string) => void;
  selectionMode?: 'single' | 'range';
  /** When true, clicking an event opens an inline editor that updates Supabase and pushes to Google Calendar. */
  editable?: boolean;
  /** When true, clicking a day opens a preset quick-add (Timeout / Book to Shoot / etc.) backed by calendar_events. */
  enableQuickEvents?: boolean;
  /**
   * Start a full production on this date. The quick-add presets only create
   * markers; this is the escape hatch to Slate's production form for a real
   * shoot. Omit it and the menu item isn't offered.
   */
  onNewProduction?: (date: string) => void;
  /**
   * Size the month grid to its container instead of to a fixed row height, so
   * the whole month is on screen with no page scroll. Only meaningful when the
   * parent gives the calendar a bounded height. Ignored on phones, which keep
   * the taller scrolling rows.
   */
  fitHeight?: boolean;
}

export default function ProductionCalendar({ onSelectDate, onSelectJob, onDeleteJob, onSelectRange, selectionMode = 'single', editable = false, enableQuickEvents = false, onNewProduction, fitHeight = false }: ProductionCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  /**
   * Phones land on the agenda. A month grid needs roughly 100px per column to
   * fit an event label; at 390px each cell is ~55px, which rendered every
   * entry as "Th…", "HO…", "PA…". The grid is still the better way to spot a
   * free week, so it stays a tap away rather than going.
   */
  const [mobileView, setMobileView] = useState<'agenda' | 'month'>('agenda');

  // Quick calendar markers (gated by enableQuickEvents)
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  /** The event being created or edited. Null when the form is closed. */
  const [eventDraft, setEventDraft] = useState<Partial<CalendarEvent> | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Inline event editor state (only used when `editable`)
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [editForm, setEditForm] = useState<Partial<Job>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Detect mobile viewport
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /**
   * Height of the month grid, measured. In fit mode the weeks split it evenly,
   * so how many lanes of bars a week can show is a function of the panel size
   * rather than a constant — anything past that becomes "+N more".
   */
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [gridHeight, setGridHeight] = useState(0);
  const fitGrid = fitHeight && !isMobile;

  React.useEffect(() => {
    const el = gridRef.current;
    if (!fitGrid || !el) { setGridHeight(0); return; }
    const ro = new ResizeObserver(([entry]) => setGridHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitGrid]);

  // Load jobs for the months around the one being viewed. Unbounded, this
  // pulled the whole jobs table on every mount; the ±4-month window keeps the
  // query small forever and refetches as the user pages through months.
  // Multi-day jobs overlapping the window edges are included via end_date.
  const windowKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
  const fetchJobs = React.useCallback(async () => {
    try {
      const base = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const start = new Date(base.getFullYear(), base.getMonth() - 4, 1).toISOString().split('T')[0];
      const end = new Date(base.getFullYear(), base.getMonth() + 5, 0).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .lte('shoot_date', end)
        .or(`end_date.gte.${start},and(end_date.is.null,shoot_date.gte.${start})`);
      if (error) throw error;
      if (data) {
        setJobs(data as Job[]);
      }
    } catch (err) {
      console.error('Error fetching jobs for calendar:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowKey]);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Live team sync: refetch calendar when teammates change jobs
  useRealtime(['jobs'], fetchJobs);

  // Quick calendar markers
  const fetchEvents = React.useCallback(async () => {
    if (!enableQuickEvents) return;
    try {
      // Windowed like the jobs query above. The Google import reaches a year
      // out, so an unbounded select would grow without limit; spans crossing
      // the window edge are kept via end_date.
      const base = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const start = new Date(base.getFullYear(), base.getMonth() - 4, 1).toISOString().split('T')[0];
      const end = new Date(base.getFullYear(), base.getMonth() + 5, 0).toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .lte('event_date', end)
        .or(`end_date.gte.${start},and(end_date.is.null,event_date.gte.${start})`)
        .order('event_date');
      if (error) throw error;
      // Filter tombstones in JS so pre-migration databases (no `hidden`
      // column) keep working unchanged.
      if (data) setEvents((data as CalendarEvent[]).filter(e => !e.hidden));
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableQuickEvents, windowKey]);

  React.useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useRealtime(enableQuickEvents ? ['calendar_events'] : [], fetchEvents);

  /**
   * Open the event form. Picking a preset used to insert a marker immediately,
   * titled with the preset's own label — so every entry read "Hold" or
   * "Meeting" and the date range, notes, and a real name had to be filled in
   * afterwards, if at all. The preset now seeds a form instead.
   */
  const openNewEvent = (date: string, preset: CalendarEventPreset) => {
    trackAction('calendar', 'quick_marker');
    setQuickAddDate(null);
    setEventError(null);
    setEventDraft({ preset, event_date: date, title: presetOf(preset).label, end_date: '', notes: '' });
  };

  const openEditEvent = (ev: CalendarEvent) => {
    setEventError(null);
    setEventDraft({ ...ev, end_date: ev.end_date || '', notes: ev.notes || '' });
  };

  const saveEvent = async () => {
    if (!eventDraft) return;
    const title = (eventDraft.title || '').trim();
    if (!title) { setEventError('Give the event a name.'); return; }
    if (!eventDraft.event_date) { setEventError('Pick a start date.'); return; }
    // A backwards range is a typo, not a span — catching it here beats
    // rendering an event that silently covers only its first day.
    if (eventDraft.end_date && eventDraft.end_date < eventDraft.event_date) {
      setEventError('The end date is before the start date.');
      return;
    }

    setSavingEvent(true);
    setEventError(null);
    const payload = {
      title,
      preset: eventDraft.preset,
      event_date: eventDraft.event_date,
      // Empty string is rejected by a DATE column, and an end equal to the
      // start is a single day rather than a span.
      end_date: eventDraft.end_date && eventDraft.end_date > eventDraft.event_date ? eventDraft.end_date : null,
      notes: (eventDraft.notes || '').trim() || null,
    };

    try {
      let savedId = eventDraft.id;
      if (eventDraft.id) {
        const { error } = await supabase.from('calendar_events').update(payload).eq('id', eventDraft.id);
        if (error) throw error;
        setEvents(prev => prev.map(e => (e.id === eventDraft.id ? { ...e, ...payload } as CalendarEvent : e)));
      } else {
        const { data, error } = await supabase.from('calendar_events').insert([payload]).select().single();
        if (error) throw error;
        savedId = (data as CalendarEvent).id;
        setEvents(prev => [...prev, data as CalendarEvent]);
      }
      setEventDraft(null);

      // Mirror onto Google. Fire-and-forget: the row is already saved, and a
      // push failure shouldn't undo it or block the form from closing. The
      // server ignores markers that came *from* Google.
      if (savedId && eventDraft.preset !== 'google') {
        pushEventToGoogleCalendar(savedId).then(r => {
          // Surfaced, not just logged. A console warning is invisible to
          // anyone not holding devtools open, so a failed push looked
          // identical to a successful one — the event saved locally and
          // simply never appeared on Google.
          if (!r.ok) toast(r.message || 'Saved here, but Google Calendar sync failed.');
          // Pick up the google_event_id the push just stored, so a later
          // delete knows to remove it from Google too.
          fetchEvents();
        });
      }
    } catch (err: any) {
      console.error('Error saving calendar event:', err);
      setEventError(err?.message || 'Could not save the event.');
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteQuickEvent = async (id: string) => {
    const ev = events.find(e => e.id === id);
    setEvents(prev => prev.filter(e => e.id !== id));

    // Markers imported *from* Google get a tombstone — Google still has the
    // event, so a hard delete would just resurrect it on the next sync.
    if (ev?.preset === 'google') {
      const { error } = await supabase.from('calendar_events').update({ hidden: true }).eq('id', id);
      if (!error) return;
    } else if (ev?.google_event_id) {
      // Ours, and mirrored to Google — clear the Google side first so it
      // doesn't outlive the row and get re-imported as a new marker.
      await removeEventFromGoogleCalendar(ev.google_event_id);
    }

    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) console.error('Error deleting calendar event:', error);
  };


  // Open the inline editor for a clicked event
  const openEditor = (job: Job) => {
    setSaveError(null);
    setSyncMsg(null);
    setEditingJob(job);
    setEditForm({
      title: job.title || '',
      client_name: job.client_name || '',
      job_status: job.job_status,
      shoot_date: job.shoot_date || '',
      end_date: job.end_date || '',
      call_time: job.call_time || '',
      location_name: job.location_name || '',
      location_address: job.location_address || '',
      notes_general: job.notes_general || '',
    });
  };

  // Save edits to Supabase, then push the change to Google Calendar
  const handleSaveEdit = async () => {
    if (!editingJob) return;
    setIsSaving(true);
    setSaveError(null);
    setSyncMsg(null);

    // Clean empty strings to null so we don't overwrite with blanks unintentionally
    const updates: Partial<Job> = {
      title: editForm.title?.trim() || editingJob.title,
      client_name: editForm.client_name?.trim() || undefined,
      job_status: editForm.job_status,
      shoot_date: editForm.shoot_date || undefined,
      end_date: editForm.end_date || undefined,
      call_time: editForm.call_time?.trim() || undefined,
      location_name: editForm.location_name?.trim() || undefined,
      location_address: editForm.location_address?.trim() || undefined,
      notes_general: editForm.notes_general?.trim() || undefined,
    };

    try {
      const { error } = await supabase.from('jobs').update(updates).eq('id', editingJob.id);
      if (error) throw error;

      // Push the updated job to Google Calendar (no-op if not connected).
      const push = await pushJobToGoogleCalendar(editingJob.id);
      if (push.ok) {
        setSyncMsg('Saved and synced to Google Calendar.');
      } else if (push.message) {
        setSyncMsg(push.message);
      }

      await fetchJobs();
      // Brief pause so the user can read the sync status before closing
      setTimeout(() => setEditingJob(null), 700);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Initialize selectedDate to today when loaded
  React.useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Local parts, not toISOString — the UTC form marks the wrong cell as today
  // for most of the evening anywhere west of UTC.
  const todayStr = todayLocalISO();

  /** Every visible cell, padded to whole weeks with real dates on both sides.
   *  Padding used to be `{day: null, date: null}`, which meant a span crossing
   *  a month boundary had nowhere to draw. */
  const calendarCells = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const gridStart = new Date(year, month, 1);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    const cells: { date: string; dayNum: number; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      cells.push({
        // Built from local parts, never toISOString — that shifts the day for
        // anyone west of UTC.
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        dayNum: d.getDate(),
        inMonth: d.getMonth() === month,
      });
    }
    // A 6th row that is entirely next month is dead space — Google drops it.
    return cells.slice(0, cells.slice(35).some(c => c.inMonth) ? 42 : 35);
  }, [currentDate]);

  const weekCount = Math.ceil(calendarCells.length / 7);

  /**
   * Lines a week row has room for below the date numbers. A week needing more
   * than this spends its last line on "+N more" instead of a bar, so nothing
   * is ever drawn past the bottom of the row. Fixed when the grid sizes itself
   * to its content; measured when it sizes itself to the panel.
   */
  const slotBudget = useMemo(() => {
    if (!fitGrid || !gridHeight || !weekCount) return 4;
    // MIN_WEEK_H is the floor the rows are given in CSS; below it the grid
    // scrolls rather than shrinking further, so the budget stops shrinking too.
    const rowH = Math.max(MIN_WEEK_H, gridHeight / weekCount);
    return Math.max(1, Math.min(8, Math.floor((rowH - DATE_ROW_H) / LANE_H)));
  }, [fitGrid, gridHeight, weekCount]);

  /**
   * Week rows of positioned bars.
   *
   * A multi-day entry used to be redrawn as a separate chip in every day it
   * covered, so a week-long hold read as seven unrelated blocks. Each week now
   * gets one bar per entry, clipped to that week and stacked into lanes, which
   * is how Google draws it.
   */
  const weeks = useMemo(() => {
    const rows: {
      cells: typeof calendarCells;
      bars: {
        key: string; label: string; color: string; startCol: number; span: number;
        continuesLeft: boolean; continuesRight: boolean; lane: number;
        job?: Job; event?: CalendarEvent; time?: string;
      }[];
      overflow: Record<string, number>;
    }[] = [];

    for (let w = 0; w < calendarCells.length; w += 7) {
      const cells = calendarCells.slice(w, w + 7);
      const weekStart = cells[0].date;
      const weekEnd = cells[cells.length - 1].date;

      type Item = { start: string; end: string; label: string; color: string; job?: Job; event?: CalendarEvent; time?: string };
      const items: Item[] = [];

      for (const j of jobs) {
        if (!j.shoot_date) continue;
        const end = j.end_date && j.end_date > j.shoot_date ? j.end_date : j.shoot_date;
        if (end < weekStart || j.shoot_date > weekEnd) continue;
        items.push({
          start: j.shoot_date, end, label: j.title || 'Untitled',
          color: PRODUCTION_COLOR, job: j, time: j.call_time || undefined,
        });
      }

      if (enableQuickEvents) {
        for (const ev of events) {
          const end = ev.end_date && ev.end_date > ev.event_date ? ev.end_date : ev.event_date;
          if (end < weekStart || ev.event_date > weekEnd) continue;
          const preset = presetOf(ev.preset);
          items.push({
            start: ev.event_date, end, label: ev.title || preset.label,
            color: preset.color, event: ev,
          });
        }
      }

      // Earliest first, longest breaking ties. Sorting purely by length wastes
      // lanes: a long bar starting midweek would claim lane 0 and force an
      // earlier short one onto lane 1 with the space beside it left empty.
      items.sort((a, b) =>
        a.start.localeCompare(b.start) ||
        b.end.localeCompare(a.end) ||
        a.label.localeCompare(b.label));

      const laneEnds: number[] = [];
      const bars: (typeof rows)[number]['bars'] = [];
      const overflow: Record<string, number> = {};
      const placed: ((typeof rows)[number]['bars'][number] & { lastCol: number })[] = [];

      for (const it of items) {
        const startCol = Math.max(0, cells.findIndex(c => c.date === it.start));
        const endIdx = cells.findIndex(c => c.date === it.end);
        const lastCol = endIdx === -1 ? cells.length - 1 : endIdx;
        const span = Math.max(1, lastCol - startCol + 1);

        let lane = laneEnds.findIndex(e => e < startCol);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(lastCol); }
        else laneEnds[lane] = lastCol;

        placed.push({
          key: (it.job?.id || it.event?.id || it.label) + '-' + it.start,
          label: it.label, color: it.color, startCol, span, lane, lastCol,
          continuesLeft: it.start < weekStart,
          continuesRight: it.end > weekEnd,
          job: it.job, event: it.event, time: it.time,
        });
      }

      // A week that fits gets every lane. One that doesn't gives its last line
      // over to "+N more", so the count is never drawn on top of a bar or past
      // the bottom of the row. Dropping the deepest lanes leaves the ones below
      // exactly where they were, so this is safe to decide after packing.
      const cap = laneEnds.length > slotBudget ? Math.max(1, slotBudget - 1) : laneEnds.length;

      for (const b of placed) {
        if (b.lane >= cap) {
          // Counted per day so the "+N more" lands on the days it applies to.
          for (let c = b.startCol; c <= b.lastCol; c++) overflow[cells[c].date] = (overflow[cells[c].date] || 0) + 1;
          continue;
        }
        bars.push(b);
      }

      rows.push({ cells, bars, overflow });
    }
    return rows;
  }, [calendarCells, jobs, events, enableQuickEvents, slotBudget]);

  // Selected Day Jobs Details Helper
  const selectedDateJobs = useMemo(() => {
    if (!selectedDate) return [];
    return jobs.filter(j => coversDate(j.shoot_date, j.end_date, selectedDate));
  }, [selectedDate, jobs]);

  // Markers for the selected day, spans included (mobile drawer).
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate || !enableQuickEvents) return [];
    return events.filter(ev => coversDate(ev.event_date, ev.end_date, selectedDate));
  }, [selectedDate, events, enableQuickEvents]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

  /**
   * Everything on the calendar as one chronological list, from today forward.
   * Multi-day entries appear once on their start date and say where they run
   * to, rather than repeating on each day they cover.
   */
  const agendaDays = useMemo(() => {
    if (!isMobile) return [];
    const today = todayLocalISO();

    type Item = {
      key: string; date: string; title: string; meta: string;
      color: string; when: string; job?: Job; event?: CalendarEvent;
    };
    const items: Item[] = [];

    for (const job of jobs) {
      if (!job.shoot_date || job.shoot_date < today) continue;
      const runsTo = job.end_date && job.end_date > job.shoot_date ? job.end_date : '';
      items.push({
        key: `j-${job.id}`,
        date: job.shoot_date,
        title: job.title || 'Untitled production',
        meta: [job.client_name, job.location_name, runsTo && `runs to ${formatLocalDate(runsTo, { month: 'short', day: 'numeric' }, '')}`]
          .filter(Boolean).join(' · '),
        color: PRODUCTION_COLOR,
        when: job.call_time || 'All day',
        job,
      });
    }

    if (enableQuickEvents) {
      for (const ev of events) {
        if (!ev.event_date || ev.event_date < today) continue;
        const runsTo = ev.end_date && ev.end_date > ev.event_date ? ev.end_date : '';
        items.push({
          key: `e-${ev.id}`,
          date: ev.event_date,
          title: ev.title || presetOf(ev.preset).label,
          meta: [ev.notes, runsTo && `runs to ${formatLocalDate(runsTo, { month: 'short', day: 'numeric' }, '')}`]
            .filter(Boolean).join(' · '),
          color: presetOf(ev.preset).color,
          when: 'All day',
          event: ev,
        });
      }
    }

    items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

    const days: { date: string; label: string; items: Item[] }[] = [];
    for (const it of items) {
      const last = days[days.length - 1];
      if (last && last.date === it.date) last.items.push(it);
      else days.push({
        date: it.date,
        label: formatLocalDate(it.date, { weekday: 'long', month: 'short', day: 'numeric' }, it.date),
        items: [it],
      });
    }
    return days;
  }, [isMobile, jobs, events, enableQuickEvents]);

  const getStatusColor = (job: Job) => {
    if (job.type === 'rental') return 'bg-purple-500';
    switch (job.job_status) {
      case 'Booked': return 'bg-green-500';
      case 'Hold': return 'bg-yellow-500';
      case 'Planning': return 'bg-blue-500';
      default: return 'bg-white/20';
    }
  };

  return (
    <div className={`bg-neutral-900/30 border border-white/10 rounded-2xl p-4 ${fitGrid ? 'md:p-5 h-full min-h-0 flex flex-col' : 'md:p-8'}`}>
      {/* Header */}
      <div className={`flex flex-col md:flex-row justify-between items-center gap-4 ${fitGrid ? 'mb-4 shrink-0' : 'mb-8'}`}>
        <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-accent" />
          {monthYear}
        </h2>
        
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5 w-full md:w-auto justify-between md:justify-start">
          <button aria-label="Previous month" title="Previous month" onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-md transition-colors flex-1 md:flex-none flex justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToToday} className="px-4 py-1 text-xs font-semibold hover:bg-white/10 rounded-md transition-colors border-x border-white/5 flex-1 md:flex-none text-center">
            Today
          </button>
          <button aria-label="Next month" title="Next month" onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-md transition-colors flex-1 md:flex-none flex justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Agenda / Month, phones only. Desktop always gets the grid. */}
      {isMobile && (
        <div className="flex gap-1 mb-4 bg-black/40 p-1 rounded-lg border border-white/5">
          {(['agenda', 'month'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setMobileView(v)}
              aria-pressed={mobileView === v}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                mobileView === v ? 'bg-accent/20 text-accent' : 'text-white/50 hover:text-white'
              }`}
            >
              {v === 'agenda' ? 'Agenda' : 'Month'}
            </button>
          ))}
        </div>
      )}

      {/* Agenda — a phone can show a full title, which the grid cannot. */}
      {isMobile && mobileView === 'agenda' && (
        agendaDays.length === 0 ? (
          <p className="py-16 text-center text-[11px] text-white/35">
            Nothing scheduled from today onwards.
          </p>
        ) : (
          <div className="-mx-4 md:mx-0">
            {agendaDays.map(day => (
              <div key={day.date}>
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-1.5 bg-neutral-900 border-y border-white/5">
                  <span className="text-[10px] font-black uppercase tracking-[0.15em] text-accent/80">{day.label}</span>
                  <span className="text-[10px] text-white/25">{day.items.length}</span>
                </div>
                {day.items.map(it => (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => {
                      if (it.event) openEditEvent(it.event);
                      else if (it.job) { if (editable) openEditor(it.job); else onSelectJob?.(it.job); }
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 border-b border-white/5 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: it.color }} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-white truncate">{it.title}</span>
                      {it.meta && <span className="block text-[11px] text-white/45 truncate">{it.meta}</span>}
                    </span>
                    <span className="text-[10px] text-white/35 shrink-0 tabular-nums pt-0.5">{it.when}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )
      )}

      {/* Weekdays Header */}
      {(!isMobile || mobileView === 'month') && (
      <>
      <div className={`grid grid-cols-7 mb-2 border-b border-white/5 pb-2 ${fitGrid ? 'shrink-0' : ''}`}>
        {(isMobile 
          ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] 
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        ).map((d, idx) => (
          <div key={idx} className="text-center text-[10px] font-semibold uppercase tracking-wider opacity-30">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid — one row per week, bars laid over the day cells so a
          multi-day entry draws as a single unbroken pill. */}
      <div
        ref={gridRef}
        className={`border border-white/5 rounded-lg bg-white/5 space-y-px ${fitGrid ? 'flex-1 min-h-0 flex flex-col overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}
      >
        {weeks.map((week, wi) => {
          const laneCount = Math.max(1, ...week.bars.map(b => b.lane + 1));
          return (
            <div
              key={wi}
              className={`relative grid grid-cols-7 gap-px ${fitGrid ? 'grow shrink-0 basis-0' : ''}`}
              style={{
                gridTemplateRows: `auto repeat(${laneCount}, minmax(0, auto)) 1fr`,
                ...(fitGrid ? { minHeight: MIN_WEEK_H } : null),
              }}
            >
              {/* Day cells. Span every row so they act as the backdrop the
                  bars sit on, and stay the click target for quick-add. */}
              {week.cells.map((c, ci) => {
                const isSelected = selectedDate === c.date;
                return (
                  <div
                    key={c.date}
                    onClick={() => {
                      setSelectedDate(c.date);
                      if (selectionMode === 'range' && onSelectRange) {
                        if (!rangeStart) setRangeStart(c.date);
                        else {
                          const [a, b] = rangeStart < c.date ? [rangeStart, c.date] : [c.date, rangeStart];
                          onSelectRange(a, b);
                          setRangeStart(null);
                        }
                      } else if (enableQuickEvents && !isMobile) {
                        setQuickAddDate(prev => (prev === c.date ? null : c.date));
                      } else {
                        onSelectDate?.(c.date);
                      }
                    }}
                    style={{ gridColumn: ci + 1, gridRow: '1 / -1' }}
                    className={`p-1 md:p-1.5 transition-colors group
                      ${fitGrid ? 'min-h-0' : 'min-h-[76px] md:min-h-[124px]'}
                      ${c.inMonth ? 'bg-black/40' : 'bg-black/60'}
                      ${(onSelectDate || onSelectRange || isMobile || enableQuickEvents) ? 'cursor-pointer hover:bg-white/[0.07]' : ''}
                      ${rangeStart === c.date ? 'ring-2 ring-blue-500 z-20' : ''}
                      ${isSelected ? 'ring-1 ring-accent z-10' : ''}`}
                  />
                );
              })}

              {/* Date numbers */}
              {week.cells.map((c, ci) => {
                const isToday = c.date === todayStr;
                return (
                  <div
                    key={`n-${c.date}`}
                    style={{ gridColumn: ci + 1, gridRow: 1 }}
                    className="pointer-events-none px-1 pt-1 pb-0.5 flex items-center justify-between"
                  >
                    <span
                      className={`text-[10px] md:text-[11px] font-semibold leading-none
                        ${isToday ? 'bg-accent text-white rounded-full w-5 h-5 flex items-center justify-center' : ''}
                        ${!isToday && c.inMonth ? 'opacity-50' : ''}
                        ${!c.inMonth ? 'opacity-20' : ''}`}
                      style={isToday ? { backgroundColor: 'var(--accent)' } : undefined}
                    >
                      {c.dayNum}
                    </span>
                    {enableQuickEvents && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setQuickAddDate(prev => (prev === c.date ? null : c.date)); }}
                        className="pointer-events-auto hidden md:flex w-4 h-4 items-center justify-center rounded bg-white/5 hover:bg-accent/25 text-white/40 hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                        title="Add event"
                        aria-label={`Add event on ${c.date}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Spanning bars */}
              {week.bars.map(b => (
                <button
                  key={b.key}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (b.event) openEditEvent(b.event);
                    else if (b.job) { if (editable) openEditor(b.job); else onSelectJob?.(b.job); }
                  }}
                  style={{
                    gridColumn: `${b.startCol + 1} / span ${b.span}`,
                    gridRow: b.lane + 2,
                    backgroundColor: b.color,
                    // Flat edges where the entry runs on into the next week,
                    // so the eye reads it as continuing rather than stopping.
                    borderTopLeftRadius: b.continuesLeft ? 0 : undefined,
                    borderBottomLeftRadius: b.continuesLeft ? 0 : undefined,
                    borderTopRightRadius: b.continuesRight ? 0 : undefined,
                    borderBottomRightRadius: b.continuesRight ? 0 : undefined,
                  }}
                  className="relative z-10 mx-0.5 mb-0.5 px-1.5 py-[3px] rounded text-left overflow-hidden hover:brightness-110 transition-all"
                  title={b.job ? `${b.label}${b.time ? ` · ${b.time}` : ''}` : b.label}
                >
                  <span className="block text-[11px] md:text-[9px] md:text-[10px] font-semibold text-white truncate leading-tight drop-shadow-sm">
                    {b.continuesLeft && '‹ '}
                    {b.job && '🎥 '}
                    {b.label}
                    {b.time && <span className="font-normal opacity-80"> · {b.time}</span>}
                    {b.continuesRight && ' ›'}
                  </span>
                </button>
              ))}

              {/* Overflow counts, on the days they apply to */}
              {week.cells.map((c, ci) => (
                week.overflow[c.date] ? (
                  <button
                    key={`o-${c.date}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedDate(c.date); onSelectDate?.(c.date); }}
                    style={{ gridColumn: ci + 1, gridRow: laneCount + 2 }}
                    className="relative z-10 mx-0.5 mb-0.5 px-1.5 text-left text-[11px] md:text-[9px] font-semibold text-white/50 hover:text-white transition-colors self-start"
                  >
                    +{week.overflow[c.date]} more
                  </button>
                ) : null
              ))}

              {/* Quick-add popover */}
              {enableQuickEvents && week.cells.map((c, ci) => (
                quickAddDate === c.date ? (
                  <div
                    key={`q-${c.date}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ gridColumn: ci + 1, gridRow: 2 }}
                    className={`absolute z-30 mt-1 w-44 bg-neutral-900 border border-white/15 rounded-xl shadow-2xl p-2 space-y-1 ${ci >= 4 ? 'right-1' : 'left-1'}`}
                  >
                    <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-white/10">
                      <span className="text-[10px] font-semibold text-white/40">Add event</span>
                      <button onClick={() => setQuickAddDate(null)} className="text-white/40 hover:text-white"><X className="w-3 h-3" /></button>
                    </div>
                    {QUICK_ADD_PRESETS.map(pr => (
                      <button
                        key={pr.key}
                        onClick={() => openNewEvent(c.date, pr.key)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pr.color }} />
                        <span className="text-[10px] font-semibold text-white/80">{pr.label}</span>
                      </button>
                    ))}

                    {/* The four above are markers — a coloured block and a note.
                        A real shoot needs client, call time, crew, location, so
                        it hands off to Slate's full form with the date already
                        set, rather than growing a second production form here. */}
                    {onNewProduction && (
                      <>
                        <div className="h-px bg-white/10 my-1" />
                        <button
                          onClick={() => { setQuickAddDate(null); onNewProduction(c.date); }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: PRODUCTION_COLOR }}
                          />
                          <span className="text-[10px] font-semibold text-white/80">New production</span>
                          <span className="ml-auto text-[11px] md:text-[9px] text-white/30">Full details</span>
                        </button>
                      </>
                    )}
                  </div>
                ) : null
              ))}
            </div>
          );
        })}
      </div>
      </>
      )}

      {/* Selected Day Details Drawer (Visible on Mobile only) */}
      <AnimatePresence>
        {isMobile && selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-6 p-4 bg-zinc-950/40 border border-white/5 rounded-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="text-xs font-semibold text-accent">
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <span className="text-[11px] md:text-[9px] font-semibold opacity-40 text-white">
                {selectedDateJobs.length} {selectedDateJobs.length === 1 ? 'Job' : 'Jobs'}
              </span>
            </div>

            {/* Quick-add presets + markers (mobile) */}
            {enableQuickEvents && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ADD_PRESETS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => openNewEvent(selectedDate, p.key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[11px] md:text-[9px] font-semibold text-white/80">{p.label}</span>
                    </button>
                  ))}
                </div>
                {selectedDateEvents.map(ev => {
                  const p = presetOf(ev.preset);
                  return (
                    <div key={ev.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border-l-2" style={{ borderLeftColor: p.color }}>
                      <button
                        type="button"
                        onClick={() => openEditEvent(ev)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                        <span className="text-[10px] font-semibold truncate text-white">{ev.title || p.label}</span>
                      </button>
                      <button onClick={() => deleteQuickEvent(ev.id)} className="p-1 text-white/30 hover:text-red-500 shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedDateJobs.length === 0 ? (
              <p className="text-[10px] font-semibold opacity-30 text-center py-4">No events scheduled for this day</p>
            ) : (
              <div className="space-y-3">
                {selectedDateJobs.map(job => (
                  <div
                    key={job.id}
                    onClick={() => editable ? openEditor(job) : onSelectJob?.(job)}
                    className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-accent/30 transition-all flex items-start justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(job)}`} />
                          <h4 className="text-xs font-semibold truncate text-white">{job.title}</h4>
                        </div>
                        {job.call_time && (
                          <span className="text-[10px] font-semibold text-accent flex items-center gap-1 shrink-0" style={{ color: 'var(--accent)' }}>
                            <Clock className="w-3.5 h-3.5" />
                            {job.call_time}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] md:text-[9px] font-semibold text-white/40 truncate pl-4">
                        {job.client_name || 'No Client'} {job.location_name ? `• ${job.location_name}` : ''}
                      </p>
                    </div>
                    {onDeleteJob && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteJob(job.id);
                        }}
                        className="p-1 hover:text-red-500 text-white/20 transition-all self-center"
                      >
                        <AlertCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend — the actual bar colours, which are Google's. The old one
          listed job statuses in Tailwind colours that appeared nowhere on the
          grid, so it explained nothing you could see. */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 ${fitGrid ? 'mt-3 pt-3 shrink-0' : 'mt-6 pt-5'}`}>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/50">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PRODUCTION_COLOR }} /> Production
        </span>
        {QUICK_ADD_PRESETS.map(p => (
          <span key={p.key} className="flex items-center gap-1.5 text-[10px] font-semibold text-white/50">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} /> {p.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white/50">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: presetOf('google').color }} /> From Google
        </span>
        <span className="text-[11px] md:text-[9px] text-white/25 ml-auto hidden md:block">Colours match your Google Calendar</span>
      </div>

      {/* Calendar event form — create and edit share one sheet. Portalled, so
          it can't end up painting under the sticky page header. */}
      <Modal
        open={!!eventDraft}
        onClose={() => setEventDraft(null)}
        title={eventDraft?.id ? 'Edit Event' : 'New Event'}
        maxWidth="max-w-md"
        footer={
          <div className="flex items-center justify-between gap-2">
            {eventDraft?.id ? (
              <button
                type="button"
                onClick={() => { deleteQuickEvent(eventDraft.id as string); setEventDraft(null); }}
                className="px-3 py-2.5 rounded-lg text-[11px] font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEventDraft(null)}
                className="px-4 py-2.5 rounded-lg font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="calendar-event-form"
                disabled={savingEvent}
                className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-lg font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {savingEvent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingEvent ? 'Saving…' : 'Save Event'}
              </button>
            </div>
          </div>
        }
      >
        {eventDraft && (
          <form
            id="calendar-event-form"
            onSubmit={(e) => { e.preventDefault(); saveEvent(); }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">Event Name</label>
              <input
                autoFocus
                value={eventDraft.title || ''}
                onChange={(e) => setEventDraft({ ...eventDraft, title: e.target.value })}
                placeholder="e.g. Client call — Tony Awards"
                className="w-full bg-black/50 border border-white/10 px-3 py-2.5 rounded-xl outline-none focus:border-accent text-sm font-semibold text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">Type</label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_ADD_PRESETS.map(p => {
                  const active = eventDraft.preset === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setEventDraft({
                        ...eventDraft,
                        preset: p.key,
                        // Retitle only while the name is still the previous
                        // preset's label — never overwrite something typed.
                        title: !eventDraft.title || eventDraft.title === presetOf(eventDraft.preset).label
                          ? p.label
                          : eventDraft.title,
                      })}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-colors ${
                        active ? 'bg-white/10 border-white/25' : 'bg-black/40 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className={`text-[11px] font-semibold ${active ? 'text-white' : 'text-white/60'}`}>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">Starts</label>
                <input
                  type="date"
                  value={eventDraft.event_date || ''}
                  onChange={(e) => setEventDraft({ ...eventDraft, event_date: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 px-3 py-2.5 rounded-xl outline-none focus:border-accent text-sm font-semibold text-white [color-scheme:dark]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">
                  Ends <span className="opacity-50 normal-case tracking-normal font-medium">(optional)</span>
                </label>
                <input
                  type="date"
                  value={eventDraft.end_date || ''}
                  min={eventDraft.event_date || undefined}
                  onChange={(e) => setEventDraft({ ...eventDraft, end_date: e.target.value })}
                  className="w-full bg-black/50 border border-white/10 px-3 py-2.5 rounded-xl outline-none focus:border-accent text-sm font-semibold text-white [color-scheme:dark]"
                />
              </div>
            </div>
            <p className="text-[11px] md:text-[9px] text-white/30 -mt-1 ml-1">
              Leave the end date blank for a single day. A range paints across every day it covers.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/40 ml-1">Notes</label>
              <textarea
                rows={3}
                value={eventDraft.notes || ''}
                onChange={(e) => setEventDraft({ ...eventDraft, notes: e.target.value })}
                placeholder="Anything the team should know"
                className="w-full bg-black/50 border border-white/10 px-3 py-2.5 rounded-xl outline-none focus:border-accent text-xs font-medium text-white leading-relaxed resize-y"
              />
            </div>

            {/* Syncing is invisible otherwise — worth one line so nobody
                wonders whether this reached the shared calendar. */}
            {eventDraft.preset !== 'google' && (
              <p className="text-[10px] text-white/35 leading-relaxed flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 shrink-0" />
                Saving also adds this to your Google Calendar as an all-day event.
              </p>
            )}

            {/* The importer upserts on google_event_id, so a title edited here
                is replaced on the next pull. Worth saying before they type. */}
            {eventDraft.preset === 'google' && (
              <p className="text-[10px] font-semibold text-amber-400/90 leading-relaxed">
                Synced from Google Calendar — edits here are overwritten on the next sync. Change it in Google to make it stick.
              </p>
            )}

            {eventError && (
              <p className="text-[11px] font-bold text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {eventError}
              </p>
            )}
          </form>
        )}
      </Modal>

      {/* Inline Event Editor (two-way Google Calendar sync) */}
      <AnimatePresence>
        {editable && editingJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4"
            onClick={() => !isSaving && setEditingJob(null)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/10 bg-zinc-950">
                <div className="flex items-center gap-2 min-w-0">
                  <CalendarIcon className="w-4 h-4 text-accent shrink-0" />
                  <h3 className="text-sm font-semibold text-white truncate">Edit Event</h3>
                </div>
                <button
                  onClick={() => !isSaving && setEditingJob(null)}
                  className="p-1.5 text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Client</label>
                    <input
                      type="text"
                      value={editForm.client_name || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, client_name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Status</label>
                    <select
                      value={editForm.job_status || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, job_status: (e.target.value || undefined) as Job['job_status'] }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                    >
                      <option value="" className="bg-zinc-900">—</option>
                      <option value="Planning" className="bg-zinc-900">Planning</option>
                      <option value="Hold" className="bg-zinc-900">Hold</option>
                      <option value="Booked" className="bg-zinc-900">Booked</option>
                      <option value="Wrapped" className="bg-zinc-900">Wrapped</option>
                      <option value="Cancelled" className="bg-zinc-900">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Shoot Date</label>
                    <input
                      type="date"
                      value={editForm.shoot_date || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, shoot_date: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/40 mb-1.5">End Date</label>
                    <input
                      type="date"
                      value={editForm.end_date || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Call Time</label>
                    <input
                      type="text"
                      placeholder="8:00 AM"
                      value={editForm.call_time || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, call_time: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Location Name</label>
                  <input
                    type="text"
                    value={editForm.location_name || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, location_name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Location Address</label>
                  <input
                    type="text"
                    value={editForm.location_address || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, location_address: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-white/40 mb-1.5">Notes</label>
                  <textarea
                    rows={3}
                    value={editForm.notes_general || ''}
                    onChange={(e) => setEditForm(f => ({ ...f, notes_general: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:border-accent focus:outline-none transition-colors resize-none"
                  />
                </div>

                {saveError && (
                  <p className="text-[11px] font-bold text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> {saveError}
                  </p>
                )}
                {syncMsg && !saveError && (
                  <p className="text-[11px] font-bold text-green-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> {syncMsg}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-white/10 bg-zinc-950">
                <button
                  onClick={() => setEditingJob(null)}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold text-white/50 hover:text-white transition-colors disabled:opacity-30"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-black text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isSaving ? 'Saving…' : 'Save & Sync'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
