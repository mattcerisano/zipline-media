'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Clock, MapPin, User, AlertCircle, X, Save, Loader2, RefreshCw, Plus
} from 'lucide-react';
import { Job, CalendarEvent, CalendarEventPreset } from './types';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';

// Quick-add presets for the Calendar tab. Lightweight markers, not productions.
export const EVENT_PRESETS: { key: CalendarEventPreset; label: string; color: string; dot: string }[] = [
  { key: 'timeout', label: 'Timeout', color: '#f43f5e', dot: 'bg-rose-500' },
  { key: 'booked', label: 'Book to Shoot', color: '#10b981', dot: 'bg-emerald-500' },
  { key: 'planning', label: 'Planning Shoot', color: '#3b82f6', dot: 'bg-blue-500' },
  { key: 'hold', label: 'Hold', color: '#f59e0b', dot: 'bg-amber-500' },
  { key: 'available', label: 'Available', color: '#14b8a6', dot: 'bg-teal-500' },
  { key: 'travel', label: 'Travel Day', color: '#a855f7', dot: 'bg-purple-500' },
  { key: 'edit', label: 'Edit Day', color: '#d946ef', dot: 'bg-fuchsia-500' },
];
const presetOf = (k?: string) => EVENT_PRESETS.find(p => p.key === k) || EVENT_PRESETS[0];

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
}

export default function ProductionCalendar({ onSelectDate, onSelectJob, onDeleteJob, onSelectRange, selectionMode = 'single', editable = false, enableQuickEvents = false }: ProductionCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Quick calendar markers (gated by enableQuickEvents)
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

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

  // Load jobs from Supabase
  const fetchJobs = React.useCallback(async () => {
    try {
      const { data, error } = await supabase.from('jobs').select('*');
      if (error) throw error;
      if (data) {
        setJobs(data as Job[]);
      }
    } catch (err) {
      console.error('Error fetching jobs for calendar:', err);
    }
  }, []);

  React.useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Live team sync: refetch calendar when teammates change jobs
  useRealtime(['jobs'], fetchJobs);

  // Quick calendar markers
  const fetchEvents = React.useCallback(async () => {
    if (!enableQuickEvents) return;
    try {
      const { data, error } = await supabase.from('calendar_events').select('*').order('event_date');
      if (error) throw error;
      if (data) setEvents(data as CalendarEvent[]);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    }
  }, [enableQuickEvents]);

  React.useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useRealtime(enableQuickEvents ? ['calendar_events'] : [], fetchEvents);

  const addQuickEvent = async (date: string, preset: CalendarEventPreset) => {
    const label = presetOf(preset).label;
    const optimistic: CalendarEvent = { id: `temp-${Date.now()}`, title: label, preset, event_date: date };
    setEvents(prev => [...prev, optimistic]);
    setQuickAddDate(null);
    const { data, error } = await supabase
      .from('calendar_events')
      .insert([{ title: label, preset, event_date: date }])
      .select()
      .single();
    if (error) {
      console.error('Error adding calendar event:', error);
      setEvents(prev => prev.filter(e => e.id !== optimistic.id));
      return;
    }
    setEvents(prev => prev.map(e => (e.id === optimistic.id ? (data as CalendarEvent) : e)));
  };

  const deleteQuickEvent = async (id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) console.error('Error deleting calendar event:', error);
  };

  const renameQuickEvent = async (id: string, title: string) => {
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, title } : e)));
    await supabase.from('calendar_events').update({ title }).eq('id', id);
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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch('/api/integrations/calendar', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action: 'push', jobId: editingJob.id }),
          });
          const data = await res.json();
          if (data.success) {
            setSyncMsg('Saved and synced to Google Calendar.');
          } else {
            setSyncMsg(data.message || 'Saved. Google Calendar not connected.');
          }
        }
      } catch (syncErr) {
        console.error('Google Calendar push failed:', syncErr);
        setSyncMsg('Saved locally, but Google Calendar sync failed.');
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

  // Calendar Helpers
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const monthYear = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysCount = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    const days = [];
    
    // Padding for previous month
    for (let i = 0; i < startDay; i++) {
      days.push({ day: null, date: null });
    }
    
    // Actual days
    for (let i = 1; i <= daysCount; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      const dayJobs = jobs.filter(j => {
          if (!j.shoot_date) return false;
          // Simple string comparison for single day matches first
          if (j.shoot_date === dateStr) return true;
          
          // Range check
          if (j.end_date) {
              const start = new Date(j.shoot_date);
              const end = new Date(j.end_date);
              const current = new Date(dateStr);
              // Normalize times to avoid timezone issues
              start.setHours(0,0,0,0);
              end.setHours(0,0,0,0);
              current.setHours(0,0,0,0);
              return current >= start && current <= end;
          }
          return false;
      });

      days.push({ day: i, date: dateStr, jobs: dayJobs });
    }
    
    return days;
  }, [currentDate, jobs]);

  // Selected Day Jobs Details Helper
  const selectedDateJobs = useMemo(() => {
    if (!selectedDate) return [];
    return jobs.filter(j => {
      if (!j.shoot_date) return false;
      if (j.shoot_date === selectedDate) return true;
      if (j.end_date) {
        const start = new Date(j.shoot_date);
        const end = new Date(j.end_date);
        const current = new Date(selectedDate);
        start.setHours(0,0,0,0);
        end.setHours(0,0,0,0);
        current.setHours(0,0,0,0);
        return current >= start && current <= end;
      }
      return false;
    });
  }, [selectedDate, jobs]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().split('T')[0]);
  };

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
    <div className="bg-neutral-900/30 border border-white/10 rounded-2xl p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-accent" />
          {monthYear}
        </h2>
        
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5 w-full md:w-auto justify-between md:justify-start">
          <button onClick={prevMonth} className="p-2 hover:bg-white/10 rounded-md transition-colors flex-1 md:flex-none flex justify-center">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={goToToday} className="px-4 py-1 text-xs font-semibold hover:bg-white/10 rounded-md transition-colors border-x border-white/5 flex-1 md:flex-none text-center">
            Today
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-white/10 rounded-md transition-colors flex-1 md:flex-none flex justify-center">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 mb-2 border-b border-white/5 pb-2">
        {(isMobile 
          ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] 
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        ).map((d, idx) => (
          <div key={idx} className="text-center text-[10px] font-semibold uppercase tracking-wider opacity-30">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden">
        {calendarDays.map((d, i) => {
          const isToday = d.date === new Date().toISOString().split('T')[0];
          const dayEvents = enableQuickEvents && d.date ? events.filter(ev => ev.event_date === d.date) : [];

          return (
            <div 
              key={i} 
              onClick={() => {
                  if (d.date) {
                      setSelectedDate(d.date);
                      if (selectionMode === 'range' && onSelectRange) {
                          if (!rangeStart) {
                              setRangeStart(d.date);
                          } else {
                              // Ensure start is before end
                              const start = new Date(rangeStart) < new Date(d.date) ? rangeStart : d.date;
                              const end = new Date(rangeStart) < new Date(d.date) ? d.date : rangeStart;
                              onSelectRange(start, end);
                              setRangeStart(null);
                          }
                      } else if (enableQuickEvents && !isMobile) {
                          setQuickAddDate(prev => (prev === d.date ? null : d.date));
                      } else {
                          onSelectDate?.(d.date);
                      }
                  }
              }}
              className={`min-h-[60px] md:min-h-[140px] bg-black/40 p-1.5 md:p-2 transition-colors relative group
                ${!d.day ? 'opacity-20 pointer-events-none' : ''}
                ${(onSelectDate || onSelectRange || isMobile || enableQuickEvents) ? 'cursor-pointer hover:bg-white/10' : 'hover:bg-black/60'}
                ${rangeStart === d.date ? 'bg-blue-500/20 ring-2 ring-blue-500 inset-0 z-10' : ''}
                ${selectedDate === d.date && d.day ? 'bg-accent/[0.08] ring-1 ring-accent z-10' : ''}
              `}
            >
              {d.day && (
                <>
                  <span className={`text-[10px] md:text-xs font-semibold mb-1 md:mb-2 block ${isToday ? 'text-accent' : 'opacity-40'}`}>
                    {d.day}
                  </span>

                  {/* Quick-add "+" affordance (desktop, calendar tab only) */}
                  {enableQuickEvents && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setQuickAddDate(prev => (prev === d.date ? null : d.date)); }}
                      className="hidden md:flex absolute top-1.5 right-1.5 w-5 h-5 items-center justify-center rounded-md bg-white/5 hover:bg-accent/20 text-white/40 hover:text-accent opacity-0 group-hover:opacity-100 transition-all z-20"
                      title="Quick add"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Desktop Layout: Job Badges list */}
                  <div className="hidden md:block space-y-1">
                    {d.jobs?.map(job => (
                      <motion.div 
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={job.id}
                        onClick={(e) => {
                            if (editable) {
                                e.stopPropagation();
                                openEditor(job);
                            } else if (onSelectJob) {
                                e.stopPropagation();
                                onSelectJob(job);
                            }
                        }}
                        className={`group/job-item p-1.5 rounded bg-white/5 border-l-2 border-accent group/job hover:bg-white/10 cursor-pointer overflow-hidden transition-all flex items-center justify-between ${(onSelectJob || editable) ? 'hover:scale-105 active:scale-95' : ''}`}
                        style={{ borderLeftColor: `var(--accent)` }}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-[10px] font-semibold leading-tight truncate">{job.title}</p>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <div className="flex items-center gap-1 min-w-0 opacity-40">
                               <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(job)}`} />
                               <p className="text-[8px] font-medium tracking-tight truncate">{job.client_name || 'No Client'}</p>
                            </div>
                            {job.call_time && (
                              <span className="text-[7.5px] font-bold text-accent shrink-0 flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
                                <Clock className="w-2 h-2" />
                                {job.call_time}
                              </span>
                            )}
                          </div>
                        </div>
                        {onDeleteJob && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteJob(job.id);
                            }}
                            className="opacity-0 group-hover/job-item:opacity-100 p-1 hover:text-red-500 transition-all"
                          >
                            <AlertCircle className="w-3 h-3" />
                          </button>
                        )}
                      </motion.div>
                    ))}

                    {/* Quick calendar markers (events) */}
                    {dayEvents.map(ev => {
                      const p = presetOf(ev.preset);
                      return (
                        <div
                          key={ev.id}
                          onClick={(e) => e.stopPropagation()}
                          className="group/ev p-1.5 rounded bg-white/5 border-l-2 hover:bg-white/10 overflow-hidden transition-all flex items-center justify-between"
                          style={{ borderLeftColor: p.color }}
                        >
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${p.dot} shrink-0`} />
                            <input
                              value={ev.title || ''}
                              onChange={(e) => setEvents(prev => prev.map(x => x.id === ev.id ? { ...x, title: e.target.value } : x))}
                              onBlur={(e) => renameQuickEvent(ev.id, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent outline-none text-[10px] font-medium leading-tight truncate w-full focus:bg-white/5 rounded"
                            />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteQuickEvent(ev.id); }}
                            className="opacity-0 group-hover/ev:opacity-100 p-0.5 hover:text-red-500 transition-all shrink-0"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile Layout: Row of tiny colored dots */}
                  <div className="flex md:hidden flex-wrap gap-0.5 mt-1 justify-center">
                    {d.jobs?.map(job => (
                      <div
                        key={job.id}
                        className={`w-1 h-1 rounded-full ${getStatusColor(job)} shrink-0`}
                        title={job.title}
                      />
                    ))}
                    {dayEvents.map(ev => (
                      <div key={ev.id} className={`w-1 h-1 rounded-full ${presetOf(ev.preset).dot} shrink-0`} title={ev.title || presetOf(ev.preset).label} />
                    ))}
                  </div>

                  {/* Quick-add preset popover */}
                  {enableQuickEvents && quickAddDate === d.date && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute z-30 top-8 ${i % 7 >= 4 ? 'right-1' : 'left-1'} w-44 bg-neutral-900 border border-white/15 rounded-xl shadow-2xl p-2 space-y-1`}
                    >
                      <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-white/10">
                        <span className="text-[10px] font-semibold text-white/40">Quick add</span>
                        <button onClick={() => setQuickAddDate(null)} className="text-white/40 hover:text-white"><X className="w-3 h-3" /></button>
                      </div>
                      {EVENT_PRESETS.map(p => (
                        <button
                          key={p.key}
                          onClick={() => addQuickEvent(d.date, p.key)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 text-left transition-colors"
                        >
                          <span className={`w-2 h-2 rounded-full ${p.dot} shrink-0`} />
                          <span className="text-[10px] font-semibold text-white/80">{p.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

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
              <span className="text-[9px] font-semibold opacity-40 text-white">
                {selectedDateJobs.length} {selectedDateJobs.length === 1 ? 'Job' : 'Jobs'}
              </span>
            </div>

            {/* Quick-add presets + markers (mobile) */}
            {enableQuickEvents && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_PRESETS.map(p => (
                    <button
                      key={p.key}
                      onClick={() => addQuickEvent(selectedDate, p.key)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                      <span className="text-[9px] font-semibold text-white/80">{p.label}</span>
                    </button>
                  ))}
                </div>
                {events.filter(ev => ev.event_date === selectedDate).map(ev => {
                  const p = presetOf(ev.preset);
                  return (
                    <div key={ev.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border-l-2" style={{ borderLeftColor: p.color }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${p.dot} shrink-0`} />
                        <span className="text-[10px] font-semibold truncate text-white">{ev.title || p.label}</span>
                      </div>
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
                      <p className="text-[9px] font-semibold text-white/40 truncate pl-4">
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

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-4 md:gap-6 border-t border-white/5 pt-6 opacity-40 justify-center md:justify-start">
        <div className="flex items-center gap-2 text-[10px] font-semibold">
          <div className="w-2 h-2 rounded-full bg-green-500" /> Booked
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold">
          <div className="w-2 h-2 rounded-full bg-yellow-500" /> Hold
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Planning
        </div>
        <div className="flex items-center gap-2 text-[10px] font-semibold">
          <div className="w-2 h-2 rounded-full bg-purple-500" /> Rental
        </div>
      </div>

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
