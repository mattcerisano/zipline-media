'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { Job, Contact, EditLabel, JobLink, Client, Project } from '@/components/gearbuilder/types';
import { sanitizeUrl } from '@/lib/sanitize';
import { parseLocalDate, formatLocalDate } from '@/lib/date';
import { caps } from '@/lib/format';
import { authHeader } from '@/lib/api-client';
import { 
  Film, 
  Scissors, 
  PlayCircle, 
  MessageSquareWarning, 
  CheckCircle2, 
  Archive,
  MinusCircle,
  User,
  Calendar,
  ExternalLink,
  AlignLeft,
  Paperclip,
  Tag,
  Clock,
  LayoutDashboard,
  Eye,
  MessageSquare,
  FolderOpen,
  Plus,
  X,
  Trash2,
  SlidersHorizontal,
  UserCheck,
  ChevronUp,
  ChevronDown,
  Download,
  UploadCloud,
  Check,
  Copy,
  Search,
  FileVideo,
  FileAudio,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast, confirmAction } from '@/components/Feedback';

// Columns are customizable: definitions are { id, label, color } where color
// is a token from STAGE_COLORS. Custom definitions live org-wide in
// organizations.edit_stages (JSONB, see migration 20260706000001) with a
// localStorage fallback for deployments that haven't run the migration yet.
export interface EditStageDef {
  id: string;
  label: string;
  color: string;
}

// Literal class strings (including the top-border variants) so Tailwind's
// scanner compiles every color a custom column can use.
const STAGE_COLORS: Record<string, { color: string; bg: string; border: string; borderT: string }> = {
  blue:    { color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/20',    borderT: 'border-t-blue-400/20' },
  yellow:  { color: 'text-yellow-400',  bg: 'bg-yellow-400/10',  border: 'border-yellow-400/20',  borderT: 'border-t-yellow-400/20' },
  purple:  { color: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/20',  borderT: 'border-t-purple-400/20' },
  orange:  { color: 'text-orange-400',  bg: 'bg-orange-400/10',  border: 'border-orange-400/20',  borderT: 'border-t-orange-400/20' },
  green:   { color: 'text-green-400',   bg: 'bg-green-400/10',   border: 'border-green-400/20',   borderT: 'border-t-green-400/20' },
  red:     { color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/20',     borderT: 'border-t-red-400/20' },
  pink:    { color: 'text-pink-400',    bg: 'bg-pink-400/10',    border: 'border-pink-400/20',    borderT: 'border-t-pink-400/20' },
  teal:    { color: 'text-teal-400',    bg: 'bg-teal-400/10',    border: 'border-teal-400/20',    borderT: 'border-t-teal-400/20' },
  neutral: { color: 'text-neutral-400', bg: 'bg-neutral-400/10', border: 'border-neutral-400/20', borderT: 'border-t-neutral-400/20' },
};

// Icons for the built-in stage ids; custom columns get the generic tag icon.
const STAGE_ICONS: Record<string, any> = {
  Filmed: Film,
  WIP: Scissors,
  V1: PlayCircle,
  Revisions: MessageSquareWarning,
  Delivered: CheckCircle2,
  Wrapped: Archive,
};

const DEFAULT_STAGE_DEFS: EditStageDef[] = [
  { id: 'Filmed', label: 'Filmed / Raw', color: 'blue' },
  { id: 'WIP', label: 'Work in Progress', color: 'yellow' },
  { id: 'V1', label: 'V1 / Review', color: 'purple' },
  { id: 'Revisions', label: 'Revisions', color: 'orange' },
  { id: 'Delivered', label: 'Delivered', color: 'green' },
  { id: 'Wrapped', label: 'Wrapped', color: 'neutral' },
];

const STAGES_STORAGE_KEY = 'studio_edit_stages';

export interface ResolvedStage extends EditStageDef {
  icon: any;
  colorClass: string;
  bg: string;
  border: string;
  borderT: string;
}

function resolveStages(defs: EditStageDef[]): ResolvedStage[] {
  return defs.map(d => {
    const c = STAGE_COLORS[d.color] || STAGE_COLORS.neutral;
    return { ...d, icon: STAGE_ICONS[d.id] || Tag, colorClass: c.color, bg: c.bg, border: c.border, borderT: c.borderT };
  });
}

function sanitizeStageDefs(raw: unknown): EditStageDef[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const defs = raw.filter(
    (d: any) => d && typeof d.id === 'string' && d.id && typeof d.label === 'string' && d.label
  ).map((d: any) => ({ id: d.id, label: d.label, color: typeof d.color === 'string' ? d.color : 'neutral' }));
  return defs.length > 0 ? defs : null;
}

const AVAILABLE_LABEL_COLORS = [
  { id: 'red', class: 'bg-red-500' },
  { id: 'orange', class: 'bg-orange-500' },
  { id: 'yellow', class: 'bg-yellow-500' },
  { id: 'green', class: 'bg-green-500' },
  { id: 'blue', class: 'bg-blue-500' },
  { id: 'purple', class: 'bg-purple-500' },
  { id: 'pink', class: 'bg-pink-500' },
];

export default function EditTracker({ userRole, selectedJobId }: { userRole?: string; selectedJobId?: string } = {}) {
  const isClient = userRole === 'client';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // Board columns — org-customizable, defaulting to the classic pipeline.
  const [stageDefs, setStageDefs] = useState<EditStageDef[]>(DEFAULT_STAGE_DEFS);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);

  // Board vs timeline (agenda-by-deadline) presentation of the same cards.
  const [viewMode, setViewMode] = useState<'board' | 'timeline'>('board');
  // "My Cards" filter — only cards assigned to the signed-in user, matched to
  // their Rolodex contact by email.
  const [myCardsOnly, setMyCardsOnly] = useState(false);
  const [myEmail, setMyEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setMyEmail(session?.user?.email?.toLowerCase() || null);
    });
  }, []);

  // Filter States
  const [clientFilter, setClientFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');

  // Modal State
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Live team sync: refetch the board when teammates change relevant data
  useRealtime(['jobs', 'contacts', 'clients', 'projects'], () => fetchData());

  useEffect(() => {
    if (selectedJobId && jobs.length > 0) {
      const match = jobs.find(j => j.id === selectedJobId);
      if (match) {
        setActiveJob(match);
      }
    }
  }, [selectedJobId, jobs]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, contactsRes, clientsRes, projectsRes] = await Promise.all([
        supabase.from('jobs').select('*, editor:contacts(*)').order('shoot_date', { ascending: false }),
        supabase.from('contacts').select('*').order('name'),
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*').order('name')
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      // Filter out jobs that are completely dead/cancelled from the tracker
      const activeJobs = (jobsRes.data as Job[]).filter(j => j.job_status !== 'Cancelled');
      setJobs(activeJobs);
      setContacts(contactsRes.data as Contact[]);
      if (!clientsRes.error && clientsRes.data) setClients(clientsRes.data as Client[]);
      // projects table may not exist on older deployments — fail soft
      if (!projectsRes.error && projectsRes.data) setProjects(projectsRes.data as Project[]);

      // Custom board columns: org-wide definitions win, then this browser's
      // saved set, then the built-in defaults. All paths fail soft.
      try {
        const { data: org } = await supabase
          .from('organizations')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (org?.id) setOrgId(org.id);
        const fromOrg = sanitizeStageDefs((org as any)?.edit_stages);
        if (fromOrg) {
          setStageDefs(fromOrg);
        } else {
          const local = sanitizeStageDefs(JSON.parse(localStorage.getItem(STAGES_STORAGE_KEY) || 'null'));
          if (local) setStageDefs(local);
        }
      } catch { /* defaults stay */ }
    } catch (err) {
      console.error('Error fetching edit tracker data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Only productions that were deliberately added to the post pipeline live on
  // the board. Jobs created on Slate no longer auto-appear as cards — they sit
  // in the "Add to Board" picker until someone pulls them in.
  const boardJobs = useMemo(() => jobs.filter(j => !!j.edit_status), [jobs]);
  const availableJobs = useMemo(() => jobs.filter(j => !j.edit_status), [jobs]);

  // Resolved columns for rendering. Any card whose status doesn't match a
  // defined column (e.g. a column was deleted after cards used it) gets its
  // own auto-column so cards can never silently vanish from the board.
  const stages = useMemo(() => {
    const resolved = resolveStages(stageDefs);
    const known = new Set(resolved.map(s => s.id));
    const orphaned = Array.from(
      new Set(boardJobs.map(j => j.edit_status as string).filter(s => s && !known.has(s)))
    );
    return [
      ...resolved,
      ...resolveStages(orphaned.map(id => ({ id, label: id, color: 'neutral' }))),
    ];
  }, [stageDefs, boardJobs]);

  const firstStageId = stageDefs[0]?.id || 'Filmed';

  // Persist column edits: this browser immediately, the org table when the
  // migration has been run (fails soft when it hasn't).
  const saveStageDefs = async (defs: EditStageDef[]) => {
    setStageDefs(defs);
    try { localStorage.setItem(STAGES_STORAGE_KEY, JSON.stringify(defs)); } catch { /* ignore */ }
    if (orgId) {
      try {
        await supabase.from('organizations').update({ edit_stages: defs }).eq('id', orgId);
      } catch { /* column may not exist yet — localStorage still applies */ }
    }
  };

  const uniqueClients = useMemo(() => {
    const clientsList = boardJobs.map(j => j.client_name || j.production_company).filter(Boolean);
    return Array.from(new Set(clientsList)).sort();
  }, [boardJobs]);

  const uniqueYears = useMemo(() => {
    const years = boardJobs.map(j => j.shoot_date ? j.shoot_date.substring(0, 4) : null).filter(Boolean);
    return Array.from(new Set(years)).sort((a, b) => (b as string).localeCompare(a as string));
  }, [boardJobs]);

  // Projects scoped to the client currently selected (by name → id)
  const projectsForFilter = useMemo(() => {
    if (clientFilter === 'All') return projects;
    const client = clients.find(c => c.name === clientFilter);
    if (!client) return [];
    return projects.filter(p => p.client_id === client.id);
  }, [projects, clients, clientFilter]);

  const filteredJobs = useMemo(() => {
    return boardJobs.filter(j => {
      const matchClient = clientFilter === 'All' || (j.client_name === clientFilter || j.production_company === clientFilter);
      const matchProject = projectFilter === 'All' || j.project_id === projectFilter;
      const matchYear = yearFilter === 'All' || (j.shoot_date && j.shoot_date.startsWith(yearFilter));
      const matchMine = !myCardsOnly || (!!myEmail && (j.editor?.email || '').toLowerCase() === myEmail);
      return matchClient && matchProject && matchYear && matchMine;
    });
  }, [boardJobs, clientFilter, projectFilter, yearFilter, myCardsOnly, myEmail]);

  const updateJobEditStatus = async (jobId: string, newStatus: string) => {
    const job = jobs.find(j => j.id === jobId);
    const oldStatus = job?.edit_status || firstStageId;

    try {
      // Optimistic update for UI feel
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, edit_status: newStatus as any } : j));
      
      const { error } = await supabase
        .from('jobs')
        .update({ edit_status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // Trigger Discord Webhook on key stage changes
      if (job && oldStatus !== newStatus && (newStatus === 'V1' || newStatus === 'Delivered')) {
        let message = '';
        if (newStatus === 'V1') message = `✂️ **Edit Ready for Review:** ${job.title}`;
        if (newStatus === 'Delivered') message = `✅ **Final Delivery Complete:** ${job.title}`;

        await fetch('/api/integrations/discord', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            embed: {
              title: 'View Project Details',
              url: job.review_link || undefined,
              color: newStatus === 'V1' ? 10181046 : 3066993, // Purple for V1, Green for Delivered
              fields: [
                { name: 'Client', value: job.client_name || job.production_company || 'Internal', inline: true },
                { name: 'Editor', value: job.editor?.name || 'Unassigned', inline: true }
              ]
            }
          })
        }).catch(err => console.error('Failed to send Discord alert:', err));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      // Revert if error (omitted for brevity, but good practice)
    }
  };

  const handleJobUpdate = async (updatedJob: Job) => {
    // If it's a new job being created from the modal
    if (isCreatingNew) {
       try {
          const { editor, id, ...dbData } = updatedJob; // Remove the dummy 'draft-' ID so Supabase generates a valid UUID
          const { data, error } = await supabase
            .from('jobs')
            .insert([dbData])
            .select('*, editor:contacts(*)')
            .single();

          if (error) throw error;
          
          setJobs(prev => [...prev, data as Job]);
          setActiveJob(null);
          setIsCreatingNew(false);
       } catch (err) {
          console.error('Error creating standalone edit:', err);
          toast('Failed to create new card.');
       }
       return;
    }

    // Update local state immediately for existing jobs
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    setActiveJob(updatedJob);

    // Filter out hydrated fields before saving to Supabase
    const { editor, ...dbData } = updatedJob;

    try {
      const { error } = await supabase
        .from('jobs')
        .update(dbData)
        .eq('id', updatedJob.id);

      if (error) throw error;
    } catch (err) {
      console.error('Error saving job updates:', err);
    }
  };

  // Remove a card from the post-production board WITHOUT touching the Slate
  // job. Clearing edit_status drops it from boardJobs and returns it to the
  // "Add to Board" picker — for shoots that never go through editing. The job,
  // its gear, crew, and schedule all remain intact in Slate.
  const removeFromBoard = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    const label = job?.title ? `"${job.title}"` : 'this production';
    if (!(await confirmAction({ title: `Remove ${label} from the edit board?`, message: 'This only clears its post-production status — the shoot stays in Slate with all its details.', confirmLabel: 'Remove' }))) {
      return;
    }
    // Optimistic: null edit_status so boardJobs immediately drops the card.
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, edit_status: null as any } : j));
    setActiveJob(null);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ edit_status: null })
        .eq('id', jobId);
      if (error) throw error;
    } catch (err) {
      console.error('Error removing card from board:', err);
      // Re-fetch to resync if the write failed.
      fetchData();
    }
  };

  const openNewCardModal = (stageId: string) => {
    setActiveJob({
      id: `draft-${Date.now()}`, // Temporary ID for the modal
      title: 'New Edit Task',
      job_status: 'Planning',
      edit_status: stageId as any,
      type: 'production'
    } as Job);
    setIsCreatingNew(true);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      updateJobEditStatus(draggableId, destination.droppableId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-neutral-900/40 p-6 rounded-2xl border border-white/10 shrink-0 gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Post-Production Pipeline</h2>
          <p className="text-[12px] font-medium tracking-tight opacity-50 text-white mt-1">Trello-style edit tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-0.5 p-0.5 bg-black/50 border border-white/10 rounded-xl">
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${viewMode === 'board' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              title="Kanban board grouped by stage"
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${viewMode === 'timeline' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
              title="Agenda view grouped by due date"
            >
              Timeline
            </button>
          </div>
          {!isClient && myEmail && (
            <button
              onClick={() => setMyCardsOnly(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold tracking-tight rounded-xl border transition-colors ${
                myCardsOnly
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:border-white/25'
              }`}
              title="Show only cards where the assigned editor matches your account email"
            >
              <UserCheck className="w-3.5 h-3.5" /> My Cards
            </button>
          )}
          {!isClient && (
            <button
              onClick={() => setIsColumnsModalOpen(true)}
              className="flex items-center gap-1.5 bg-black/50 border border-white/10 px-4 py-2 text-[12px] font-medium tracking-tight rounded-xl text-white/60 hover:text-white hover:border-white/25 transition-colors"
              title="Rename, recolor, add, or remove board columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Columns
            </button>
          )}
          {!isClient && availableJobs.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) updateJobEditStatus(e.target.value, firstStageId);
              }}
              className="bg-accent/10 border border-accent/30 text-accent px-4 py-2 outline-none focus:border-accent transition-colors text-[12px] font-semibold tracking-tight rounded-xl cursor-pointer appearance-none min-w-[180px]"
              title="Pull a Slate production onto the post-production board"
            >
              <option value="">+ Add Production to Board</option>
              {availableJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title}{j.client_name ? ` — ${j.client_name}` : ''}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2">
            <select
              value={clientFilter}
              onChange={(e) => { setClientFilter(e.target.value); setProjectFilter('All'); }}
              className="bg-black/50 border border-white/10 px-4 py-2 outline-none focus:border-accent transition-colors text-[12px] font-medium tracking-tight rounded-xl cursor-pointer appearance-none text-white min-w-[120px]"
            >
              <option value="All">All Clients</option>
              {uniqueClients.map(c => <option key={c as string} value={c as string}>{caps(c as string)}</option>)}
            </select>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              disabled={projectsForFilter.length === 0}
              className="bg-black/50 border border-white/10 px-4 py-2 outline-none focus:border-accent transition-colors text-[12px] font-medium tracking-tight rounded-xl cursor-pointer appearance-none text-white min-w-[120px] disabled:opacity-30"
            >
              <option value="All">All Projects</option>
              {projectsForFilter.map(p => <option key={p.id} value={p.id}>{caps(p.name)}</option>)}
            </select>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-black/50 border border-white/10 px-4 py-2 outline-none focus:border-accent transition-colors text-[12px] font-medium tracking-tight rounded-xl cursor-pointer appearance-none text-white"
            >
              <option value="All">All Years</option>
              {uniqueYears.map(y => <option key={y as string} value={y as string}>{y}</option>)}
            </select>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 hidden md:block">
             <p className="text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 text-white">Active Edits</p>
             <p className="text-sm font-semibold text-white">{filteredJobs.filter(j => j.edit_status !== 'Wrapped').length}</p>
          </div>
        </div>
      </div>

      {viewMode === 'timeline' ? (
        <TimelineView jobs={filteredJobs} stages={stages} onOpen={(job) => setActiveJob(job)} />
      ) : (
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex flex-col overflow-y-auto md:flex-row md:overflow-x-auto md:overflow-y-visible gap-4 pb-8 custom-scrollbar items-stretch md:items-start flex-1">
          {stages.map(stage => {
            const stageJobs = filteredJobs.filter(j => (j.edit_status || firstStageId) === stage.id);
            
            return (
              <div key={stage.id} className="flex-none w-full md:w-[300px] flex flex-col bg-neutral-900/80 rounded-xl border border-white/5 max-h-[70vh] md:max-h-full">
                <div className={`flex items-center justify-between p-3 rounded-t-xl border-t-2 ${stage.borderT}`}>
                  <div className="flex items-center gap-2">
                    <stage.icon className={`w-4 h-4 ${stage.colorClass}`} />
                    <h3 className="text-xs font-semibold tracking-tight text-white">{stage.label}</h3>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/40">
                    {stageJobs.length}
                  </span>
                </div>
                
                <Droppable droppableId={stage.id}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                    >
                      {stageJobs.map((job, index) => (
                        <Draggable key={job.id} draggableId={job.id} index={index} isDragDisabled={isClient}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{ 
                                ...provided.draggableProps.style,
                              }}
                              className="mb-2"
                              onClick={() => setActiveJob(job)}
                            >
                              <CardFront job={job} isDragging={snapshot.isDragging} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {stage.id === firstStageId && !isClient && (
                        <button 
                          onClick={() => openNewCardModal(firstStageId)}
                          className="w-full text-left p-3 text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add a card
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      )}

      <AnimatePresence>
        {isColumnsModalOpen && (
          <ColumnsEditorModal
            defs={stageDefs}
            cardCounts={boardJobs.reduce<Record<string, number>>((acc, j) => {
              const k = j.edit_status as string;
              acc[k] = (acc[k] || 0) + 1;
              return acc;
            }, {})}
            onSave={(defs) => { saveStageDefs(defs); setIsColumnsModalOpen(false); }}
            onClose={() => setIsColumnsModalOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeJob && (
          <CardDetailModal
            job={activeJob}
            contacts={contacts}
            onClose={() => {
              setActiveJob(null);
              setIsCreatingNew(false);
            }}
            onUpdate={handleJobUpdate}
            onRemoveFromBoard={removeFromBoard}
            stages={stages}
            isCreatingNew={isCreatingNew}
            isClient={isClient}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardChecklist — delivery-spec checklist on a tracker card.
// Backed by job_todos (shared with the Slate prep checklist and the Task
// List tool), so checking off "4K master uploaded" here reflects everywhere.
// ----------------------------------------------------------------------
function CardChecklist({ jobId, isClient }: { jobId: string; isClient: boolean }) {
  const [items, setItems] = useState<{ id: string; task: string; completed: boolean }[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from('job_todos')
          .select('id, task, completed')
          .eq('job_id', jobId)
          .order('sort_order')
          .order('created_at');
        if (!cancelled && data) setItems(data as any);
      } catch { /* table may not exist on older deployments */ }
      if (!cancelled) setLoaded(true);
    };
    load();
    return () => { cancelled = true; };
  }, [jobId]);

  const add = async () => {
    const task = newItem.trim();
    if (!task) return;
    setNewItem('');
    try {
      const { data, error } = await supabase
        .from('job_todos')
        .insert([{ job_id: jobId, task, completed: false, sort_order: items.length }])
        .select('id, task, completed')
        .single();
      if (!error && data) setItems(prev => [...prev, data as any]);
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  };

  const toggle = async (id: string, completed: boolean) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, completed } : i)));
    try {
      await supabase.from('job_todos').update({ completed }).eq('id', id);
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    }
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await supabase.from('job_todos').delete().eq('id', id);
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    }
  };

  const done = items.filter(i => i.completed).length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  if (!loaded) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-white">Checklist</h3>
        {items.length > 0 && (
          <span className="text-[10px] font-bold text-white/40">{done}/{items.length}</span>
        )}
      </div>

      {items.length > 0 && (
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-green-500' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <input
              type="checkbox"
              checked={item.completed}
              disabled={isClient}
              onChange={(e) => toggle(item.id, e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-accent focus:ring-accent bg-black cursor-pointer"
            />
            <span className={`flex-1 text-sm ${item.completed ? 'text-white/35 line-through' : 'text-white/80'}`}>
              {item.task}
            </span>
            {!isClient && (
              <button
                onClick={() => remove(item.id)}
                className="p-1 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!isClient && (
        <div className="flex gap-2 mt-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="Add an item — e.g. 4K master uploaded"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={add}
            disabled={!newItem.trim()}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: TimelineView — the same cards as the board, grouped by due
// date instead of stage, so post deadlines read like an agenda.
// ----------------------------------------------------------------------
function TimelineView({
  jobs,
  stages,
  onOpen,
}: {
  jobs: Job[];
  stages: ResolvedStage[];
  onOpen: (job: Job) => void;
}) {
  const buckets = useMemo(() => {
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const today = startOfDay(new Date());
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in14 = new Date(today); in14.setDate(in14.getDate() + 14);

    const groups: { key: string; label: string; accentClass: string; jobs: Job[] }[] = [
      { key: 'overdue', label: 'Overdue', accentClass: 'text-red-400', jobs: [] },
      { key: 'today', label: 'Due Today', accentClass: 'text-orange-400', jobs: [] },
      { key: 'week', label: 'This Week', accentClass: 'text-yellow-400', jobs: [] },
      { key: 'next', label: 'Next Week', accentClass: 'text-accent', jobs: [] },
      { key: 'later', label: 'Later', accentClass: 'text-white/50', jobs: [] },
      { key: 'none', label: 'No Due Date', accentClass: 'text-white/30', jobs: [] },
    ];
    const byKey = Object.fromEntries(groups.map(g => [g.key, g]));

    const sorted = [...jobs].sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    for (const job of sorted) {
      const due = parseLocalDate(job.due_date);
      if (!due) { byKey.none.jobs.push(job); continue; }
      const d = startOfDay(due);
      if (d < today) byKey.overdue.jobs.push(job);
      else if (d.getTime() === today.getTime()) byKey.today.jobs.push(job);
      else if (d < in7) byKey.week.jobs.push(job);
      else if (d < in14) byKey.next.jobs.push(job);
      else byKey.later.jobs.push(job);
    }
    return groups.filter(g => g.jobs.length > 0);
  }, [jobs]);

  if (jobs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 opacity-30">
        <p className="text-xs font-semibold text-white/50">No cards match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar pb-8 space-y-6">
      {buckets.map(bucket => (
        <div key={bucket.key}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <h3 className={`text-[11px] font-black uppercase tracking-widest ${bucket.accentClass}`}>{bucket.label}</h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/5 text-white/40">{bucket.jobs.length}</span>
          </div>
          <div className="space-y-1.5">
            {bucket.jobs.map(job => {
              const stage = stages.find(s => s.id === job.edit_status);
              return (
                <button
                  key={job.id}
                  onClick={() => onOpen(job)}
                  className="w-full flex items-center gap-3 bg-neutral-900/60 border border-white/5 hover:border-accent/30 rounded-xl px-4 py-3 text-left transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{job.title}</p>
                    <p className="text-[10px] text-white/40 truncate">{job.client_name || job.production_company || 'Internal'}</p>
                  </div>
                  {job.editor && (
                    <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-black shrink-0" title={job.editor.name}>
                      {job.editor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                  )}
                  {stage && (
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${stage.bg} ${stage.colorClass}`}>
                      <stage.icon className="w-3 h-3" /> {stage.label}
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] font-bold text-white/40 w-20 text-right">
                    {formatLocalDate(job.due_date, { month: 'short', day: 'numeric' }, '—')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: ColumnsEditorModal — rename, recolor, reorder, add, remove
// board columns. Deleting a column with cards on it is blocked so cards
// can never be stranded silently.
// ----------------------------------------------------------------------
function ColumnsEditorModal({
  defs,
  cardCounts,
  onSave,
  onClose,
}: {
  defs: EditStageDef[];
  cardCounts: Record<string, number>;
  onSave: (defs: EditStageDef[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EditStageDef[]>(defs.map(d => ({ ...d })));
  const [newLabel, setNewLabel] = useState('');

  const update = (i: number, patch: Partial<EditStageDef>) =>
    setDraft(prev => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const move = (i: number, dir: -1 | 1) =>
    setDraft(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (i: number) => {
    const stage = draft[i];
    const count = cardCounts[stage.id] || 0;
    if (count > 0) {
      toast(`"${stage.label}" still has ${count} card${count === 1 ? '' : 's'} on it. Drag those cards to another column first, then remove it.`);
      return;
    }
    if (draft.length <= 1) {
      toast('The board needs at least one column.');
      return;
    }
    setDraft(prev => prev.filter((_, idx) => idx !== i));
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    // Stable unique id from the label; cards store this id as their status.
    let id = label.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Stage';
    while (draft.some(d => d.id === id)) id = `${id}_`;
    setDraft(prev => [...prev, { id, label, color: 'teal' }]);
    setNewLabel('');
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[160] flex justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto cursor-pointer"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl my-auto p-6 cursor-default"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold tracking-tight text-white">Board Columns</h3>
          <button onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-white/40 mb-4 leading-relaxed">
          Rename, recolor, reorder, add, or remove pipeline stages. Changes apply to the whole team&apos;s board.
        </p>

        <div className="space-y-2 mb-4">
          {draft.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-xl px-2.5 py-2">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-white/20 hover:text-white disabled:opacity-20 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="p-0.5 text-white/20 hover:text-white disabled:opacity-20 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={d.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="flex-1 min-w-0 bg-transparent border border-transparent focus:border-accent rounded-lg px-2 py-1.5 text-xs font-bold text-white outline-none transition-colors"
              />
              <select
                value={STAGE_COLORS[d.color] ? d.color : 'neutral'}
                onChange={(e) => update(i, { color: e.target.value })}
                className={`bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none appearance-none cursor-pointer ${(STAGE_COLORS[d.color] || STAGE_COLORS.neutral).color}`}
              >
                {Object.keys(STAGE_COLORS).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="text-[9px] text-white/25 w-12 text-right shrink-0">
                {(cardCounts[d.id] || 0)} card{(cardCounts[d.id] || 0) === 1 ? '' : 's'}
              </span>
              <button onClick={() => remove(i)} className="p-1.5 text-white/15 hover:text-red-400 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-5">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="New column name — e.g. Color Grade"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={add}
            disabled={!newLabel.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/70 hover:text-white transition-colors disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setDraft(DEFAULT_STAGE_DEFS.map(d => ({ ...d })))}
            className="text-[10px] font-black uppercase tracking-widest text-white/35 hover:text-accent transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={() => onSave(draft)}
              className="px-5 py-2.5 rounded-xl bg-accent text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Save Columns
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardFront (The compact Trello-style card on the board)
// ----------------------------------------------------------------------
function CardFront({ job, isDragging }: { job: Job, isDragging: boolean }) {
  const hasNotes = !!job.edit_notes?.trim();
  const linkCount = (job.links?.length || 0) + (job.review_link ? 1 : 0) + (job.discord_url ? 1 : 0) + (job.drive_folder_url ? 1 : 0);
  
  // Format dates for badges. Date-only strings must be parsed as local dates,
  // otherwise UTC parsing shifts them a day in negative-offset timezones.
  const dueDate = parseLocalDate(job.due_date);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isOverdue = !!dueDate && dueDate < todayStart && job.edit_status !== 'Delivered' && job.edit_status !== 'Wrapped';
  const displayDate = dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

  return (
    <div className={`bg-neutral-800 rounded-lg shadow-sm border p-3 cursor-pointer hover:border-white/20 transition-all ${isDragging ? 'rotate-2 scale-105 border-accent shadow-2xl' : 'border-white/5'}`}>
      
      {/* Labels Row */}
      {job.edit_labels && job.edit_labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {job.edit_labels.map(l => (
            <div key={l.id} className={`h-2 w-10 rounded-full ${l.color}`} title={l.text} />
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-medium text-white mb-2 leading-tight">{job.title}</h4>

      {/* Badges & Avatar Row */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-white/40">
          
          {displayDate && (
             <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500 text-white' : job.edit_status === 'Delivered' || job.edit_status === 'Wrapped' ? 'bg-green-500/20 text-green-500' : 'bg-white/5'}`}>
               <Clock className="w-3 h-3" />
               <span>{displayDate}</span>
             </div>
          )}

          {hasNotes && (
             <div className="flex items-center" title="This card has a description.">
               <AlignLeft className="w-3.5 h-3.5" />
             </div>
          )}

          {linkCount > 0 && (
             <div className="flex items-center gap-1" title="Attachments">
               <Paperclip className="w-3 h-3" />
               <span className="text-[10px] font-bold">{linkCount}</span>
             </div>
          )}
        </div>

        {/* Editor Avatar */}
        {job.editor && (
          <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[9px] font-black shadow-sm" title={`Assigned to: ${job.editor.name}`}>
            {job.editor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// HELPER: Parse Vimeo/Frame.io URLs
// ----------------------------------------------------------------------
const getEmbedDetails = (url: string) => {
  if (!url) return null;
  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`,
    };
  }
  // Frame.io
  if (url.includes('frame.io')) {
    const uuidMatch = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const embedUrl = uuidMatch ? `https://iframe.frame.io/player/${uuidMatch[0]}?v=2` : url;
    return {
      type: 'Frame.io',
      embedUrl,
    };
  }
  return null;
};

// ----------------------------------------------------------------------
// COMPONENT: CardDetailModal (The "Card Back")
// ----------------------------------------------------------------------
function CardDetailModal({
  job,
  contacts,
  onClose,
  onUpdate,
  onRemoveFromBoard,
  stages,
  isCreatingNew,
  isClient
}: {
  job: Job,
  contacts: Contact[],
  onClose: () => void,
  onUpdate: (job: Job) => void,
  onRemoveFromBoard: (jobId: string) => void,
  stages: ResolvedStage[],
  isCreatingNew?: boolean,
  isClient: boolean
}) {
  const [title, setTitle] = useState(job.title);
  const [notes, setNotes] = useState(job.edit_notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');

  // Links editing states
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [tempReviewLink, setTempReviewLink] = useState(job.review_link || '');
  const [tempDriveUrl, setTempDriveUrl] = useState(job.drive_folder_url || '');
  const [tempDiscordUrl, setTempDiscordUrl] = useState(job.discord_url || '');
  const [tempCustomLinks, setTempCustomLinks] = useState<JobLink[]>(job.links || []);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const resetTempLinkStates = () => {
    setTempReviewLink(job.review_link || '');
    setTempDriveUrl(job.drive_folder_url || '');
    setTempDiscordUrl(job.discord_url || '');
    setTempCustomLinks(job.links || []);
    setNewLinkName('');
    setNewLinkUrl('');
  };

  const handleAddCustomLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) return;
    setTempCustomLinks([...tempCustomLinks, { label: newLinkName.trim(), url: newLinkUrl.trim() }]);
    setNewLinkName('');
    setNewLinkUrl('');
  };

  const handleRemoveCustomLink = (index: number) => {
    setTempCustomLinks(tempCustomLinks.filter((_, i) => i !== index));
  };

  const handleSaveLinks = () => {
    onUpdate({
      ...job,
      review_link: tempReviewLink.trim() || undefined,
      drive_folder_url: tempDriveUrl.trim() || undefined,
      discord_url: tempDiscordUrl.trim() || undefined,
      links: tempCustomLinks
    });
    setIsEditingLinks(false);
  };

  // Vimeo / Frame.io Embed Details
  const embedDetails = useMemo(() => getEmbedDetails(job.review_link || ''), [job.review_link]);

  // Comments State (Vimeo/Frame.io Mock stream)
  const [comments, setComments] = useState<{ id: string; timecode: string; author: string; role: string; text: string; date: string }[]>([
    { id: '1', timecode: '00:15', author: 'Matt', role: 'Director', text: 'Color grading feels slightly warm. Can we cool down the shadows?', date: '2 days ago' },
    { id: '2', timecode: '01:05', author: 'Sarah', role: 'Producer', text: "Love the speed ramp here, it perfectly matches the client's brand energy!", date: '1 day ago' },
    { id: '3', timecode: '02:18', author: 'Client (Qualcomm)', role: 'Client', text: 'The text reveal timing is perfect. Approved!', date: '3 hours ago' },
  ]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentTimecode, setNewCommentTimecode] = useState('00:00');
  const [newCommentAuthor, setNewCommentAuthor] = useState('Zipline Editor');

  // Video Integration State
  const [videoStats, setVideoStats] = useState<{
    resolution: string;
    completionRate: string;
    views: number;
    platform?: string;
  } | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  useEffect(() => {
    if (!job.review_link) {
      setVideoStats(null);
      return;
    }
    
    let active = true;
    setIsLoadingVideo(true);
    fetch(`/api/integrations/video?url=${encodeURIComponent(job.review_link)}`)
      .then(res => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then(data => {
        if (active) {
          setVideoStats({
            resolution: data.resolution,
            completionRate: data.completionRate,
            views: data.views,
            platform: data.platform
          });
          if (data.comments && data.comments.length > 0) {
            setComments(data.comments);
          }
        }
      })
      .catch(err => {
        console.warn("Failed to fetch live video details, using simulated fallback:", err);
      })
      .finally(() => {
        if (active) setIsLoadingVideo(false);
      });

    return () => {
      active = false;
    };
  }, [job.review_link]);

  // Drive Files State
  const [driveFiles, setDriveFiles] = useState<{ name: string; size: string; type: string; date: string; url: string }[]>([
    { name: '01_Director_Cut_V2.mp4', size: '1.4 GB', type: 'video', date: '3 days ago', url: job.drive_folder_url || '#' },
    { name: 'Audio_Mix_Stems_Master.zip', size: '320 MB', type: 'archive', date: '2 days ago', url: job.drive_folder_url || '#' },
    { name: 'Zipline_Creative_Brief.pdf', size: '12 MB', type: 'document', date: '5 days ago', url: job.drive_folder_url || '#' },
    { name: 'Client_Feedback_Grid.xlsx', size: '4.8 MB', type: 'document', date: 'Yesterday', url: job.drive_folder_url || '#' },
  ]);
  const [isLiveDrive, setIsLiveDrive] = useState(false);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoadingDrive(true);

    const loadDriveFiles = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setIsLoadingDrive(false);
          return;
        }

        const driveUrl = job.drive_folder_url || '';
        const res = await fetch(`/api/integrations/drive?url=${encodeURIComponent(driveUrl)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error('API failed');

        const data = await res.json();
        if (active) {
          setDriveFiles(data.files);
          setIsLiveDrive(!!data.isLive);
        }
      } catch (err) {
        console.warn('Failed to load Google Drive files:', err);
      } finally {
        if (active) setIsLoadingDrive(false);
      }
    };

    if (job.drive_folder_url) {
      loadDriveFiles();
    } else {
      setIsLoadingDrive(false);
      setIsLiveDrive(false);
    }

    return () => {
      active = false;
    };
  }, [job.drive_folder_url]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsUploading(false);
            const sizeStr = file.size > 1024 * 1024 * 1024
              ? `${(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB`
              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
              
            setDriveFiles((prevFiles) => [
              {
                name: file.name,
                size: sizeStr,
                type: file.type.includes('video') ? 'video' : file.type.includes('audio') ? 'audio' : 'document',
                date: 'Just now',
                url: job.drive_folder_url || '#',
              },
              ...prevFiles,
            ]);
          }, 500);
          return 100;
        }
        return prev + 20;
      });
    }, 150);
  };

  const currentStage = stages.find(s => s.id === job.edit_status) || stages[0];

  const saveTitle = () => {
    if (title.trim() && title !== job.title) {
      onUpdate({ ...job, title: title.trim() });
    }
  };

  // Find @mentions of Rolodex contacts in a notes string. Matches @First or
  // @First_Last (case-insensitive) against contact names.
  const findMentions = (text: string): Contact[] => {
    const tokens = Array.from(text.matchAll(/@([\w.]+)/g)).map(m => m[1].toLowerCase());
    if (tokens.length === 0) return [];
    return contacts.filter(c => {
      const first = (c.name || '').split(/\s+/)[0]?.toLowerCase();
      const full = (c.name || '').replace(/\s+/g, '_').toLowerCase();
      return tokens.some(t => t === first || t === full);
    });
  };

  const saveNotes = () => {
    // Ping teammates who are newly @mentioned (present in the new text but
    // not the old) through every enabled team channel. Fire-and-forget.
    const before = new Set(findMentions(job.edit_notes || '').map(c => c.id));
    const added = findMentions(notes).filter(c => !before.has(c.id));
    if (added.length > 0) {
      const excerpt = notes.trim().length > 160 ? `${notes.trim().slice(0, 160)}…` : notes.trim();
      const names = added.map(c => `**${c.name}**`).join(', ');
      fetch('/api/integrations/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `💬 ${names} mentioned on "${job.title}" (Edit Tracker):\n${excerpt}`,
        }),
      }).catch(err => console.error('Mention notification failed:', err));

      // Also push straight to the mentioned teammates' phones (matched by
      // Rolodex email → account email; respects their mention-pings pref).
      const emails = added.map(c => c.email).filter(Boolean);
      if (emails.length > 0) {
        authHeader()
          .then(headers =>
            fetch('/api/push/mention', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({
                emails,
                title: `💬 Mentioned on "${job.title}"`,
                body: excerpt,
                url: '/command-center',
              }),
            })
          )
          .catch(err => console.error('Mention push failed:', err));
      }
    }

    onUpdate({ ...job, edit_notes: notes });
    setIsEditingNotes(false);
  };

  const addLabel = (colorClass: string) => {
    const newLabel: EditLabel = {
      id: Math.random().toString(36).substr(2, 9),
      color: colorClass,
      text: newLabelText.trim()
    };
    const updatedLabels = [...(job.edit_labels || []), newLabel];
    onUpdate({ ...job, edit_labels: updatedLabels });
    setShowLabelMenu(false);
    setNewLabelText('');
  };

  const removeLabel = (id: string) => {
    const updatedLabels = (job.edit_labels || []).filter(l => l.id !== id);
    onUpdate({ ...job, edit_labels: updatedLabels });
  };

  const updateEditor = (editorId: string) => {
    const editor = contacts.find(c => c.id === editorId);
    onUpdate({ ...job, editor_id: editorId || undefined, editor });
  };

  const updateDueDate = (date: string) => {
    onUpdate({ ...job, due_date: date });
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[150] flex justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto cursor-pointer"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl relative min-h-[600px] my-auto flex flex-col cursor-default"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-2 flex gap-4">
          <LayoutDashboard className="w-6 h-6 text-white/40 mt-1" />
          <div className="flex-1">
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              autoFocus={isCreatingNew}
              placeholder="Enter task title..."
              disabled={isClient}
              className="w-full bg-transparent text-xl font-bold text-white outline-none border-2 border-transparent focus:border-accent focus:bg-black/20 rounded px-2 py-1 -ml-2 disabled:bg-transparent disabled:border-transparent disabled:-ml-2"
            />
            <p className="text-[11px] text-white/40 mt-1 pl-1">
              in list <span className="underline">{currentStage?.label}</span>
            </p>
          </div>
          {isCreatingNew && (
            <button 
              onClick={() => onUpdate({ ...job, title: title.trim() || 'Untitled Task', edit_notes: notes })}
              className="px-6 py-2 bg-accent text-white rounded-lg font-bold text-xs hover:bg-white hover:text-black transition-all h-fit mt-1"
            >
              Create Card
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-6 pt-2 gap-8">
          
          {/* Main Content Column */}
          <div className="flex-1 space-y-8">
            
            {/* Metadata Row (Members, Labels, Due Date) */}
            <div className="flex flex-wrap gap-6 pl-10">
              {/* Members */}
              {(job.editor || contacts.length > 0) && (
                <div>
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-2">Editor</h4>
                  <div className="flex items-center gap-2">
                    {job.editor && (
                      <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-black" title={job.editor.name}>
                        {job.editor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                    )}
                    <select
                      value={job.editor_id || ''}
                      onChange={(e) => updateEditor(e.target.value)}
                      disabled={isClient}
                      className="bg-white/5 border border-white/10 py-1.5 px-3 rounded-lg text-xs font-bold text-white outline-none focus:border-accent appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Unassigned</option>
                      {contacts
                        .filter(c => ['Editor', 'Colorist', 'Motion Graphics', 'Sound Designer'].includes(c.primary_role || ''))
                        .map(c => <option key={c.id} value={c.id}>{caps(c.name)}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Labels */}
              {job.edit_labels && job.edit_labels.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-2">Labels</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.edit_labels.map(l => (
                      <span 
                        key={l.id} 
                        onClick={isClient ? undefined : () => removeLabel(l.id)}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold text-white transition-opacity ${l.color} ${isClient ? '' : 'cursor-pointer hover:opacity-80'}`}
                        title={isClient ? undefined : "Click to remove"}
                      >
                        {l.text}
                      </span>
                    ))}
                    {!isClient && (
                      <button 
                        onClick={() => setShowLabelMenu(!showLabelMenu)}
                        className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Due Date */}
              {job.due_date && (
                <div>
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-2">Due Date</h4>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 py-1.5 px-3 rounded text-xs font-bold text-white">
                    <input 
                      type="date" 
                      value={job.due_date}
                      onChange={(e) => updateDueDate(e.target.value)}
                      disabled={isClient}
                      className="bg-transparent outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:invert disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Description / Notes */}
            <div className="flex gap-4">
              <AlignLeft className="w-6 h-6 text-white/40 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-3">
                  <h3 className="text-base font-bold text-white">Description</h3>
                  {job.edit_notes && !isEditingNotes && !isClient && (
                    <button onClick={() => setIsEditingNotes(true)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium text-white transition-colors">Edit</button>
                  )}
                </div>
                
                {isClient ? (
                  <div className="text-sm text-white/80 bg-white/5 p-4 rounded-xl whitespace-pre-wrap">
                    {job.edit_notes || 'No description provided.'}
                  </div>
                ) : isEditingNotes || !job.edit_notes ? (
                  <div className="space-y-2">
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add a more detailed description..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-accent focus:bg-black/40 min-h-[120px]"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <button onClick={saveNotes} className="px-4 py-2 bg-accent text-white rounded font-bold text-sm hover:bg-accent/80 transition-colors">Save</button>
                      <button onClick={() => { setNotes(job.edit_notes || ''); setIsEditingNotes(false); }} className="p-2 hover:bg-white/10 rounded text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setIsEditingNotes(true)}
                    className="text-sm text-white/80 bg-white/5 hover:bg-white/10 p-4 rounded-xl cursor-pointer transition-colors whitespace-pre-wrap"
                  >
                    {job.edit_notes}
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Checklist */}
            {!isCreatingNew && (
              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-white/40 shrink-0" />
                <div className="flex-1">
                  <CardChecklist jobId={job.id} isClient={isClient} />
                </div>
              </div>
            )}

            {/* Attachments / Links & Live Integrations */}
            <div className="flex gap-4">
              <Paperclip className="w-6 h-6 text-white/40 shrink-0" />
              <div className="flex-1 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-white">Project Links & Integration Suite</h3>
                    {!isClient && (
                      <button 
                        onClick={() => {
                          if (isEditingLinks) {
                            resetTempLinkStates();
                          }
                          setIsEditingLinks(!isEditingLinks);
                        }}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-bold text-white transition-colors"
                      >
                        {isEditingLinks ? 'Cancel' : 'Manage Links'}
                      </button>
                    )}
                  </div>

                  {isEditingLinks && (
                    <div className="bg-black/45 border border-white/10 p-4 rounded-xl space-y-4 mb-6">
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-medium tracking-[0.12em] uppercase opacity-40 text-white">Vimeo / Frame.io Review Link</label>
                        <input 
                          type="text" 
                          value={tempReviewLink}
                          onChange={(e) => setTempReviewLink(e.target.value)}
                          placeholder="https://vimeo.com/... or https://frame.io/..."
                          className="w-full bg-black/50 border border-white/10 px-3 py-2 outline-none text-xs rounded-lg text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-medium tracking-[0.12em] uppercase opacity-40 text-white">Google Drive Folder URL</label>
                        <input 
                          type="text" 
                          value={tempDriveUrl}
                          onChange={(e) => setTempDriveUrl(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="w-full bg-black/50 border border-white/10 px-3 py-2 outline-none text-xs rounded-lg text-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-medium tracking-[0.12em] uppercase opacity-40 text-white">Discord Webhook / Channel URL</label>
                        <input 
                          type="text" 
                          value={tempDiscordUrl}
                          onChange={(e) => setTempDiscordUrl(e.target.value)}
                          placeholder="https://discord.com/channels/..."
                          className="w-full bg-black/50 border border-white/10 px-3 py-2 outline-none text-xs rounded-lg text-white"
                        />
                      </div>

                      {/* Custom Links List & Add New */}
                      <div className="border-t border-white/5 pt-4 space-y-3">
                        <label className="text-[9px] font-medium tracking-[0.12em] uppercase opacity-40 text-white block">Custom Links</label>
                        
                        {/* Existing Custom Links */}
                        {tempCustomLinks.length > 0 && (
                          <div className="space-y-2">
                            {tempCustomLinks.map((link, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-black/20 p-2 rounded border border-white/5">
                                <span className="text-[11px] font-bold text-white truncate max-w-[80%]">
                                  {link.label}: <span className="opacity-40 font-normal">{link.url}</span>
                                </span>
                                <button 
                                  onClick={() => handleRemoveCustomLink(idx)}
                                  className="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Custom Link Input Row */}
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Label (e.g. YouTube)" 
                            value={newLinkName}
                            onChange={(e) => setNewLinkName(e.target.value)}
                            className="w-1/3 bg-black/50 border border-white/10 px-2 py-1.5 outline-none text-[10px] rounded text-white"
                          />
                          <input 
                            type="text" 
                            placeholder="URL" 
                            value={newLinkUrl}
                            onChange={(e) => setNewLinkUrl(e.target.value)}
                            className="flex-grow bg-black/50 border border-white/10 px-2 py-1.5 outline-none text-[10px] rounded text-white"
                          />
                          <button 
                            type="button"
                            onClick={handleAddCustomLink}
                            className="bg-accent px-3 text-[10px] font-medium text-white rounded hover:bg-white hover:text-black transition-colors"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Save Buttons */}
                      <div className="flex gap-2 pt-2">
                        <button 
                          onClick={handleSaveLinks}
                          className="bg-green-600 hover:bg-green-700 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors"
                        >
                          Save Links
                        </button>
                        <button 
                          onClick={() => {
                            resetTempLinkStates();
                            setIsEditingLinks(false);
                          }}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 text-xs font-medium text-white rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {job.review_link && (
                      <a href={sanitizeUrl(job.review_link)} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl group transition-colors border border-white/5">
                         <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center"><Eye className="w-5 h-5 text-accent animate-pulse" /></div>
                         <div className="min-w-0 flex-1">
                           <p className="text-xs font-semibold text-white">Review Platform Link</p>
                           <p className="text-[10px] text-white/40 truncate group-hover:underline">{job.review_link}</p>
                         </div>
                      </a>
                    )}
                    {job.discord_url && (
                      <a href={sanitizeUrl(job.discord_url)} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl group transition-colors border border-white/5">
                         <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center"><MessageSquare className="w-5 h-5 text-purple-400" /></div>
                         <div className="min-w-0 flex-1">
                           <p className="text-xs font-semibold text-white">Discord Feed</p>
                           <p className="text-[10px] text-white/40 truncate group-hover:underline">{job.discord_url}</p>
                         </div>
                      </a>
                    )}
                    {job.drive_folder_url && (
                      <a href={sanitizeUrl(job.drive_folder_url)} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl group transition-colors border border-white/5">
                         <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center"><FolderOpen className="w-5 h-5 text-yellow-500" /></div>
                         <div className="min-w-0 flex-1">
                           <p className="text-xs font-semibold text-white">Drive Folder</p>
                           <p className="text-[10px] text-white/40 truncate group-hover:underline">{job.drive_folder_url}</p>
                         </div>
                      </a>
                    )}
                    {job.links?.map((link, i) => (
                      <a key={i} href={sanitizeUrl(link.url)} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl group transition-colors border border-white/5">
                         <div className="w-10 h-10 bg-black/40 rounded-lg flex items-center justify-center"><ExternalLink className="w-5 h-5 text-white/40" /></div>
                         <div className="min-w-0 flex-1">
                           <p className="text-xs font-semibold text-white truncate">{link.label}</p>
                           <p className="text-[10px] text-white/40 truncate group-hover:underline">{link.url}</p>
                         </div>
                      </a>
                    ))}
                    {!job.review_link && !job.discord_url && !job.drive_folder_url && (!job.links || job.links.length === 0) && (
                      <p className="text-xs text-white/40 italic col-span-2">No custom links attached to this project.</p>
                    )}
                  </div>
                </div>

                {/* 1. Vimeo / Frame.io Player Embed & Telemetry */}
                {embedDetails && (
                  <div className="bg-neutral-900/60 border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PlayCircle className="w-4 h-4 text-accent" />
                        <span className="text-xs font-semibold tracking-tight text-white">{embedDetails.type} Review Monitor</span>
                      </div>
                      <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-500 text-[8px] font-semibold tracking-wide rounded-full">
                        Live Embed
                      </span>
                    </div>

                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/5 bg-black">
                      <iframe 
                        src={embedDetails.embedUrl} 
                        className="w-full h-full" 
                        allowFullScreen 
                        allow="autoplay; fullscreen; picture-in-picture"
                      />
                    </div>

                    {/* Telemetry Dashboard */}
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                      <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-3 mb-3">
                        <div>
                          <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-white/40">Resolution</p>
                          <p className="text-xs font-black text-white mt-0.5">{videoStats?.resolution || '4K UHD (2160p)'}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-white/40">Completion Rate</p>
                          <p className="text-xs font-black text-green-400 mt-0.5">{videoStats?.completionRate || '88.5%'}</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-white/40">Total Views</p>
                          <p className="text-xs font-black text-white mt-0.5">{videoStats?.views ?? (142 + comments.length * 3)}</p>
                        </div>
                      </div>

                      {/* Comments stream */}
                      <div className="space-y-3">
                        <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-accent mb-2">Review Feed ({comments.length})</p>
                        <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                          {comments.map((c) => (
                            <div key={c.id} className="text-xs border-l-2 border-accent pl-2.5 py-0.5 bg-white/5 rounded-r p-1.5">
                              <div className="flex items-center justify-between text-[10px] font-medium text-white/60 mb-0.5">
                                <span>{c.author} <span className="text-[8px] opacity-40 font-normal">({c.role})</span></span>
                                <span className="text-[8px] text-accent font-black">{c.timecode}</span>
                              </div>
                              <p className="text-white/80 leading-normal">{c.text}</p>
                            </div>
                          ))}
                        </div>

                        {/* Add Comment Form */}
                        <div className="pt-2 border-t border-white/5 space-y-2">
                          <div className="grid grid-cols-3 gap-2">
                            <input 
                              type="text"
                              value={newCommentAuthor}
                              onChange={(e) => setNewCommentAuthor(e.target.value)}
                              placeholder="Name"
                              className="col-span-2 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-accent"
                            />
                            <input 
                              type="text"
                              value={newCommentTimecode}
                              onChange={(e) => setNewCommentTimecode(e.target.value)}
                              placeholder="Time (0:00)"
                              className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-accent text-center"
                            />
                          </div>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newCommentText}
                              onChange={(e) => setNewCommentText(e.target.value)}
                              placeholder="Type review note..."
                              className="flex-grow bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-accent"
                            />
                            <button 
                              onClick={() => {
                                if (!newCommentText.trim()) return;
                                setComments([...comments, {
                                  id: Math.random().toString(),
                                  timecode: newCommentTimecode,
                                  author: newCommentAuthor || 'Anonymous',
                                  role: 'Reviewer',
                                  text: newCommentText,
                                  date: 'Just now'
                                }]);
                                setNewCommentText('');
                              }}
                              className="bg-accent px-3 py-1 text-[10px] font-medium text-white rounded hover:bg-white hover:text-black transition-colors"
                            >
                              Post
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Google Drive Vault Explorer */}
                {job.drive_folder_url && (
                  <div className="bg-neutral-900/60 border border-white/10 rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-yellow-500" />
                        <span className="text-xs font-semibold tracking-tight text-white">Google Drive Vault</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isLiveDrive ? (
                          <span className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 text-green-500 text-[8px] font-semibold tracking-wide rounded-full">
                            Live Sync
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-white/40 text-[8px] font-semibold tracking-wide rounded-full">
                            Simulated Vault
                          </span>
                        )}
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(job.drive_folder_url || '');
                            setLinkCopied(true);
                            setTimeout(() => setLinkCopied(false), 2000);
                          }}
                          className="text-[10px] font-semibold text-white/40 hover:text-white transition-colors"
                        >
                          {linkCopied ? 'Copied Link' : 'Copy Folder Link'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                      {/* Search & Upload */}
                      <div className="flex flex-col sm:flex-row gap-2 mb-3">
                        <div className="relative flex-grow">
                          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-white/30" />
                          <input 
                            type="text"
                            placeholder="Search Vault files..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-accent"
                          />
                        </div>
                        <div className="relative">
                          <input 
                            type="file" 
                            id="vault-upload" 
                            className="hidden" 
                            onChange={handleFileUpload}
                            disabled={isUploading}
                          />
                          <label 
                            htmlFor="vault-upload" 
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 bg-accent/20 border border-accent/30 text-accent hover:bg-accent hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            <UploadCloud className="w-4 h-4" /> Upload
                          </label>
                        </div>
                      </div>

                      {/* Upload Progress Bar */}
                      {isUploading && (
                        <div className="bg-white/5 p-2 rounded-lg border border-white/5 mb-3">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-accent mb-1">
                            <span>Uploading Deliverable...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-accent h-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Files list */}
                      <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                        {isLoadingDrive ? (
                          <div className="text-center py-6 text-[10px] text-white/40 italic">
                            Loading vault files from Google Drive...
                          </div>
                        ) : driveFiles.length === 0 ? (
                          <div className="text-center py-6 text-[10px] text-white/40 italic">
                            No files found in this vault folder.
                          </div>
                        ) : (
                          driveFiles
                            .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
                            .map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg border border-transparent hover:border-white/5 transition-all">
                              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                <div className="w-7 h-7 bg-white/5 rounded flex items-center justify-center">
                                  {file.type === 'video' ? (
                                    <FileVideo className="w-4 h-4 text-blue-400" />
                                  ) : file.type === 'audio' ? (
                                    <FileAudio className="w-4 h-4 text-purple-400" />
                                  ) : (
                                    <FileText className="w-4 h-4 text-yellow-500" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold text-white truncate leading-tight">{file.name}</p>
                                  <p className="text-[8px] text-white/40 font-medium mt-0.5">{file.size} • {file.date}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(file.url);
                                    setCopiedIndex(idx);
                                    setTimeout(() => setCopiedIndex(null), 2000);
                                  }}
                                  className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                                  title="Copy File Link"
                                >
                                  {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <a 
                                  href={sanitizeUrl(file.url)}
                                  target="_blank"
                                  className="p-1.5 hover:bg-white/10 rounded text-white/40 hover:text-white transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          )))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Right Sidebar (Actions) */}
          <div className="w-full md:w-48 space-y-6">
             <div className="space-y-2">
               <h4 className="text-xs font-bold text-white/60 mb-2">Add to card</h4>
               
               <div className="relative">
                 <button onClick={() => setShowLabelMenu(!showLabelMenu)} className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors text-sm font-medium">
                   <Tag className="w-4 h-4" /> Labels
                 </button>
                 
                 {/* Label Popover Menu */}
                 {showLabelMenu && (
                   <div className="absolute right-0 top-full mt-2 w-64 bg-neutral-800 border border-white/10 shadow-2xl rounded-lg p-3 z-50">
                     <p className="text-xs font-bold text-white/60 text-center border-b border-white/10 pb-2 mb-3">Labels</p>
                     <input 
                       type="text" 
                       placeholder="Label title..." 
                       value={newLabelText}
                       onChange={(e) => setNewLabelText(e.target.value)}
                       className="w-full bg-black/50 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-accent mb-3"
                     />
                     <div className="grid grid-cols-4 gap-2">
                        {AVAILABLE_LABEL_COLORS.map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => addLabel(c.class)}
                            className={`h-8 rounded cursor-pointer hover:opacity-80 transition-opacity ${c.class}`}
                          />
                        ))}
                     </div>
                   </div>
                 )}
               </div>

               <div className="relative">
                 <label className="w-full flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white p-2 rounded transition-colors text-sm font-medium cursor-pointer">
                   <Clock className="w-4 h-4" /> Dates
                   <input 
                     type="date" 
                     className="absolute inset-0 opacity-0 cursor-pointer"
                     onChange={(e) => updateDueDate(e.target.value)}
                   />
                 </label>
               </div>
             </div>

             {!isClient && !isCreatingNew && (
               <div className="space-y-2">
                 <h4 className="text-xs font-bold text-white/60 mb-2">Actions</h4>
                 <button
                   onClick={() => onRemoveFromBoard(job.id)}
                   title="Take this off the edit board but keep the shoot in Slate"
                   className="w-full flex items-center gap-2 bg-white/10 hover:bg-amber-500/20 hover:text-amber-400 text-white p-2 rounded transition-colors text-sm font-medium"
                 >
                   <MinusCircle className="w-4 h-4" /> Remove from Board
                 </button>
                 <p className="text-[10px] text-white/30 leading-snug px-0.5">
                   Clears post-production status only. The shoot stays in Slate with all its details.
                 </p>
                 <button onClick={() => onUpdate({ ...job, job_status: 'Cancelled' })} className="w-full flex items-center gap-2 bg-white/10 hover:bg-red-500/20 hover:text-red-500 text-white p-2 rounded transition-colors text-sm font-medium">
                   <Archive className="w-4 h-4" /> Cancel Job
                 </button>
               </div>
             )}
          </div>

        </div>
      </motion.div>
    </div>
  );
}
