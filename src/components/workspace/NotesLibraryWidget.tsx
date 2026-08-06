'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Loader2,
  FileText,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { toast, confirmAction } from '@/components/Feedback';

// Notes Library — the meeting-notes home that replaces the running Google
// Doc. Every note knows which client and production it belongs to, so the
// library sorts and filters itself: pull up "everything from the Nike job"
// or "all notes for this client" in one tap. Autosaves as you type,
// realtime-syncs across the team, searchable by title/body/tags.

interface Note {
  id: string;
  title: string;
  body: string;
  job_id: string | null;
  client_id: string | null;
  tags: string | null;
  pinned: boolean;
  created_by: string | null;
  updated_at: string;
}

interface Option { id: string; name: string; client_id?: string | null }

/**
 * Narrow a production list to one client.
 *
 * `keepId` is always included even when it doesn't match: a <select> whose
 * current value isn't among its options renders blank, so filtering a list
 * without this would silently wipe the assignment already on a note.
 */
function productionsFor(jobs: Option[], clientId?: string | null, keepId?: string | null): Option[] {
  if (!clientId) return jobs;
  return jobs.filter(j => j.client_id === clientId || (keepId && j.id === keepId));
}

const AUTOSAVE_MS = 900;

export default function NotesLibraryWidget() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [jobs, setJobs] = useState<Option[]>([]);
  const [clients, setClients] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('All');
  const [jobFilter, setJobFilter] = useState('All');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myEmail = useRef<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('production_notes')
        .select('*')
        .order('pinned', { ascending: false })
        .order('updated_at', { ascending: false });
      if (error) {
        setTableMissing(true);
      } else {
        setTableMissing(false);
        setNotes((data as Note[]) || []);
      }
    } catch {
      setTableMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      myEmail.current = session?.user?.email || null;
    });
    const loadRefs = async () => {
      const [jobsRes, clientsRes] = await Promise.all([
        supabase.from('jobs').select('id, title, job_status, client_id').neq('job_status', 'Cancelled').order('shoot_date', { ascending: false }).limit(300),
        supabase.from('clients').select('id, name').order('name').limit(300),
      ]);
      setJobs(((jobsRes.data as any[]) || []).map(j => ({ id: j.id, name: j.title, client_id: j.client_id })));
      setClients(((clientsRes.data as any[]) || []).map(c => ({ id: c.id, name: c.name })));
    };
    loadRefs();
    fetchNotes();
  }, [fetchNotes]);

  // Team sync — but don't clobber the note being edited mid-keystroke.
  useRealtime(['production_notes'], () => {
    if (!saveTimer.current) fetchNotes();
  });

  const active = notes.find(n => n.id === activeId) || null;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return notes.filter(n => {
      const matchClient = clientFilter === 'All' || n.client_id === clientFilter;
      const matchJob = jobFilter === 'All' || n.job_id === jobFilter;
      const matchSearch = !q ||
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.tags || '').toLowerCase().includes(q);
      return matchClient && matchJob && matchSearch;
    });
  }, [notes, search, clientFilter, jobFilter]);

  const createNote = async () => {
    try {
      const { data, error } = await supabase
        .from('production_notes')
        .insert([{
          title: 'Untitled Note',
          body: '',
          job_id: jobFilter !== 'All' ? jobFilter : null,
          client_id: clientFilter !== 'All' ? clientFilter : null,
          created_by: myEmail.current,
        }])
        .select()
        .single();
      if (error) throw error;
      setNotes(prev => [data as Note, ...prev]);
      setActiveId((data as Note).id);
    } catch (err: any) {
      toast(`Couldn't create the note: ${err?.message || 'unknown error'}`);
    }
  };

  // Local-first editing with debounced autosave.
  const patchActive = (patch: Partial<Note>) => {
    if (!active) return;
    const id = active.id;
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      try {
        const current = { ...active, ...patch };
        await supabase
          .from('production_notes')
          .update({
            title: current.title,
            body: current.body,
            job_id: current.job_id,
            client_id: current.client_id,
            tags: current.tags,
            pinned: current.pinned,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1500);
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveState('idle');
      }
    }, AUTOSAVE_MS);
  };

  const togglePin = async (note: Note) => {
    setNotes(prev => prev
      .map(n => (n.id === note.id ? { ...n, pinned: !n.pinned } : n))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated_at.localeCompare(a.updated_at)));
    try {
      await supabase.from('production_notes').update({ pinned: !note.pinned }).eq('id', note.id);
    } catch (err) { console.error(err); }
  };

  const deleteNote = async (note: Note) => {
    if (!(await confirmAction({ message: `Delete "${note.title}"? This can't be undone.`, danger: true, confirmLabel: 'Delete' }))) return;
    setNotes(prev => prev.filter(n => n.id !== note.id));
    if (activeId === note.id) setActiveId(null);
    try {
      await supabase.from('production_notes').delete().eq('id', note.id);
    } catch (err) { console.error(err); }
  };

  const nameOf = (list: Option[], id: string | null) => list.find(o => o.id === id)?.name || null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="h-full p-6">
        <div className="flex items-start gap-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-300">Notes Library storage not set up yet</p>
            <p className="text-[10px] text-white/50 leading-relaxed mt-1">
              Run <span className="font-mono">supabase/migrations/20260706000003_production_notes.sql</span> against your Supabase project, then reload.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectClass = 'bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold text-white/70 outline-none focus:border-accent appearance-none cursor-pointer max-w-[130px]';

  return (
    <div className="h-full flex @container">
      {/* ============ LIST ============ */}
      <div className={`flex flex-col border-r border-white/5 w-full @2xl:w-72 @2xl:shrink-0 ${active ? 'hidden @2xl:flex' : 'flex'}`}>
        <div className="p-3 space-y-2 border-b border-white/5">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="w-full bg-black/40 border border-white/10 rounded-lg py-2 pl-8 pr-2 text-xs text-white outline-none focus:border-accent transition-colors"
              />
            </div>
            <button
              onClick={createNote}
              title="New note"
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5">
            <select
              value={clientFilter}
              onChange={(e) => {
                const next = e.target.value;
                setClientFilter(next);
                // Drop a production filter belonging to a different client —
                // the pair would match nothing and look like an empty library.
                if (next !== 'All' && jobFilter !== 'All') {
                  const job = jobs.find(j => j.id === jobFilter);
                  if (job && job.client_id !== next) setJobFilter('All');
                }
              }}
              className={selectClass}
            >
              <option value="All">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className={selectClass}>
              <option value="All">All Productions</option>
              {productionsFor(jobs, clientFilter === 'All' ? null : clientFilter, jobFilter === 'All' ? null : jobFilter)
                .map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-16 text-center opacity-30">
              <FileText className="w-10 h-10 mx-auto mb-2" />
              <p className="text-[11px] font-semibold text-white/50">{notes.length === 0 ? 'No notes yet — create the first one.' : 'No notes match.'}</p>
            </div>
          ) : (
            filtered.map(note => (
              <button
                key={note.id}
                onClick={() => setActiveId(note.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-white/[0.03] transition-colors ${
                  note.id === activeId ? 'bg-accent/10' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {note.pinned && <Pin className="w-3 h-3 text-accent shrink-0" />}
                  <p className="text-xs font-bold text-white truncate">{note.title || 'Untitled'}</p>
                </div>
                <p className="text-[10px] text-white/35 truncate mt-0.5">{note.body.replace(/\s+/g, ' ').slice(0, 80) || 'Empty note'}</p>
                <div className="flex items-center gap-2 mt-1">
                  {nameOf(clients, note.client_id) && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-accent/70 truncate max-w-[45%]">{nameOf(clients, note.client_id)}</span>
                  )}
                  {nameOf(jobs, note.job_id) && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-white/30 truncate max-w-[45%]">{nameOf(jobs, note.job_id)}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ============ EDITOR ============ */}
      <div className={`flex-1 min-w-0 flex-col ${active ? 'flex' : 'hidden @2xl:flex'}`}>
        {!active ? (
          <div className="flex-1 flex items-center justify-center opacity-25">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-3" />
              <p className="text-xs font-semibold text-white/50">Select a note, or create one.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 p-3 border-b border-white/5">
              <button
                onClick={() => setActiveId(null)}
                className="@2xl:hidden px-2 py-1.5 rounded-lg bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/60"
              >
                Back
              </button>
              <input
                value={active.title}
                onChange={(e) => patchActive({ title: e.target.value })}
                placeholder="Note title"
                className="flex-1 min-w-0 bg-transparent text-base font-bold text-white outline-none border-b border-transparent focus:border-accent/40 transition-colors"
              />
              <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-white/25 w-14 text-right">
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? <span className="text-green-400 inline-flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span> : ''}
              </span>
              <button onClick={() => togglePin(active)} title={active.pinned ? 'Unpin' : 'Pin to top'} className="p-2 text-white/30 hover:text-accent transition-colors shrink-0">
                {active.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
              </button>
              <button onClick={() => deleteNote(active)} title="Delete note" className="p-2 text-white/30 hover:text-red-400 transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Memory: what this note is about */}
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-white/5">
              <select
                value={active.client_id || ''}
                onChange={(e) => {
                  const clientId = e.target.value || null;
                  // A production belonging to someone else can't survive the
                  // change, or the note would claim one client and point at
                  // another's shoot.
                  const job = jobs.find(j => j.id === active.job_id);
                  const keepJob = !clientId || !job || job.client_id === clientId;
                  patchActive(keepJob ? { client_id: clientId } : { client_id: clientId, job_id: null });
                }}
                className={selectClass}
              >
                <option value="">No client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={active.job_id || ''}
                onChange={(e) => {
                  const jobId = e.target.value || null;
                  // Picking a production for an unassigned note fills the
                  // client in from it, rather than asking for it twice.
                  const job = jobs.find(j => j.id === jobId);
                  patchActive(
                    jobId && !active.client_id && job?.client_id
                      ? { job_id: jobId, client_id: job.client_id }
                      : { job_id: jobId },
                  );
                }}
                className={selectClass}
              >
                <option value="">No production</option>
                {productionsFor(jobs, active.client_id, active.job_id)
                  .map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
              <input
                value={active.tags || ''}
                onChange={(e) => patchActive({ tags: e.target.value })}
                placeholder="tags: meeting, budget, casting…"
                className="flex-1 min-w-[120px] bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white/70 outline-none focus:border-accent transition-colors"
              />
            </div>

            <textarea
              value={active.body}
              onChange={(e) => patchActive({ body: e.target.value })}
              placeholder={'Meeting notes, decisions, follow-ups…\n\nEverything autosaves and syncs to the team live.'}
              className="flex-1 w-full bg-transparent p-4 text-sm text-white/85 leading-relaxed outline-none resize-none custom-scrollbar"
            />
          </>
        )}
      </div>
    </div>
  );
}
