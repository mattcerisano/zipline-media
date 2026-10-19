'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { postNotify } from '@/lib/notify';
import { useRealtime } from '@/lib/useRealtime';
import { Job, Contact, EditLabel, JobLink, Client, Project } from '@/components/gearbuilder/types';
import { sanitizeUrl } from '@/lib/sanitize';
import { parseLocalDate, formatLocalDate } from '@/lib/date';
import { extractDraftUrl, groupDrafts, isDraft, latestDraftLinks, makeDraft, nextDraftVersion, withPostedDraft } from '@/lib/drafts';
import { hasAnyRole, POST_ROLES } from '@/lib/crew-roles';
import { authHeader } from '@/lib/api-client';
import { formatDuration } from '@/lib/edit-time';
import { pushJobToGoogleCalendar } from '@/lib/calendar-push';
import CardTimeTracker from './CardTimeTracker';
import {
  type Deliverable,
  DELIVERABLE_FORMATS,
  nextDeliverableStatus,
  deliverableStatusLabel,
  deliverableStatusTone,
} from '@/lib/deliverables';
import { 
  Film, 
  Scissors, 
  PlayCircle, 
  MessageSquareWarning, 
  CheckCircle2, 
  Archive,
  MinusCircle,
  User,
  ExternalLink,
  AlignLeft,
  Paperclip,
  Tag,
  Clock,
  Timer,
  LayoutDashboard,
  FolderOpen,
  Plus,
  X,
  Trash2,
  SlidersHorizontal,
  UserCheck,
  ChevronUp,
  ChevronDown,
  Check,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast, confirmAction } from '@/components/Feedback';
import { Portal, EscapeToClose } from '@/components/workspace/Overlay';
import { CONTROL_H, CONTROL_SELECT, CONTROL_SELECT_MAX, CONTROL_BUTTON, CONTROL_GAP, TOOLBAR_CARD } from '@/lib/controls';
import { FilterSheet } from '@/components/workspace/FilterSheet';
import { DEFAULT_STAGE_DEFS, sanitizeStageDefs, type EditStageDef } from '@/lib/edit-stages';

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

const AVAILABLE_LABEL_COLORS = [
  { id: 'red', class: 'bg-red-500' },
  { id: 'orange', class: 'bg-orange-500' },
  { id: 'yellow', class: 'bg-yellow-500' },
  { id: 'green', class: 'bg-green-500' },
  { id: 'blue', class: 'bg-blue-500' },
  { id: 'purple', class: 'bg-purple-500' },
  { id: 'pink', class: 'bg-pink-500' },
];

export default function EditTracker({
  userRole,
  selectedJobId,
  openCardId,
  onCardOpened,
}: {
  userRole?: string;
  /** A tab bound to one production: its card opens when the board loads. */
  selectedJobId?: string;
  /** A card another screen (My Work) asked to open, once. */
  openCardId?: string | null;
  onCardOpened?: () => void;
} = {}) {
  const isClient = userRole === 'client';
  // A freelance editor's board is already filtered before it reaches the
  // browser — row-level security hands their account the cards assigned to them
  // and nothing else (migration 20260822000000). What the app adds is a UI that
  // matches: the controls that would fail on the way back aren't shown.
  const isEditor = userRole === 'editor';
  const canManageBoard = !isClient && !isEditor;
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

  // How a draft posted from this account is signed: the Rolodex name when the
  // email matches a contact, else the part of the address before the @.
  const myName = useMemo(() => {
    if (!myEmail) return null;
    const contact = contacts.find(c => (c.email || '').toLowerCase() === myEmail);
    return contact?.name?.split(/\s+/)[0] || myEmail.split('@')[0];
  }, [myEmail, contacts]);

  // Hours logged per card, for the badge on the card face. Read through the
  // API rather than the table: the entries themselves are only readable there,
  // and staff see the studio's total where an editor sees their own.
  const [timeTotals, setTimeTotals] = useState<Record<string, number>>({});

  const loadTimeTotals = useCallback(async () => {
    try {
      const res = await fetch('/api/edits/time', { headers: await authHeader() });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data?.totals) setTimeTotals(data.totals as Record<string, number>);
    } catch {
      // The board is not worth failing over a missing badge.
    }
  }, []);

  useEffect(() => { loadTimeTotals(); }, [loadTimeTotals]);

  // Called when a card's own tracker settles on a new figure, so the badge
  // behind the modal is right the moment it closes. Skipped when unchanged so a
  // running timer doesn't re-render the board every second.
  const noteCardTime = useCallback((jobId: string, seconds: number) => {
    setTimeTotals(prev => (prev[jobId] === seconds ? prev : { ...prev, [jobId]: seconds }));
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

  // Live team sync: refetch the board when teammates change relevant data.
  // In the background — the spinner replaces the whole board, which unmounted
  // an open card and threw away a half-typed description every time anyone
  // saved anything, this tab's own saves included (they echo back here).
  useRealtime(['jobs', 'contacts', 'clients', 'projects'], () => fetchData({ background: true }));

  // A tab bound to one production opens its card once. This ran on every
  // change to `jobs`, so after closing the card any refresh — a teammate's
  // save, this tab's own — popped it open again.
  const openedBoundCard = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedJobId || openedBoundCard.current === selectedJobId || jobs.length === 0) return;
    const match = jobs.find(j => j.id === selectedJobId);
    if (match) {
      openedBoundCard.current = selectedJobId;
      setActiveJob(match);
    }
  }, [selectedJobId, jobs]);

  // Same, for a card handed over from another screen; the hand-off is cleared
  // once used so closing the card keeps it closed.
  useEffect(() => {
    if (!openCardId || jobs.length === 0) return;
    const match = jobs.find(j => j.id === openCardId);
    if (match) setActiveJob(match);
    onCardOpened?.();
  }, [openCardId, jobs, onCardOpened]);

  const fetchData = async ({ background = false }: { background?: boolean } = {}) => {
    if (!background) setIsLoading(true);
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
      // Keep an open card on the fresh row, so the next change on it is made
      // against what's saved now rather than what was there when it opened.
      // A card still being created has no row yet and is left alone.
      setActiveJob(cur => {
        if (!cur || cur.id.startsWith('draft-')) return cur;
        return activeJobs.find(j => j.id === cur.id) ?? cur;
      });
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
      // Optimistic update for UI feel — the board and, when it's open, the card.
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, edit_status: newStatus as any } : j));
      setActiveJob(cur => (cur && cur.id === jobId ? { ...cur, edit_status: newStatus as any } : cur));
      
      const { error } = await supabase
        .from('jobs')
        .update({ edit_status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      // Tell the team when a cut is ready for review or delivered. These went
      // straight to one Discord webhook from the server's environment — which
      // had been deleted, so every alert failed quietly — instead of the
      // channels the studio configures under Integrations. They now go through
      // the same dispatch as every other alert, as events that can be switched
      // off or reworded there.
      if (job && oldStatus !== newStatus && (newStatus === 'V1' || newStatus === 'Delivered')) {
        const stageLabel = stages.find(st => st.id === newStatus)?.label || newStatus;
        postNotify({
          event_key: newStatus === 'V1' ? 'edit_review' : 'edit_delivered',
          variables: {
            title: job.title || '',
            client: job.client_name || job.production_company || 'Internal',
            editor: job.editor?.name || 'Unassigned',
            review_link: job.review_link || '',
            stage: stageLabel,
          },
        }).catch(err => console.error('Failed to send the edit alert:', err));
      }
    } catch (err) {
      console.error('Error updating status:', err);
      // Put the card back where it was. Left in the new column, a failed move
      // looked done until the next refresh quietly moved it back.
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, edit_status: (job?.edit_status ?? null) as any } : j));
      setActiveJob(cur => (cur && cur.id === jobId ? { ...cur, edit_status: (job?.edit_status ?? null) as any } : cur));
      toast("Couldn't move that card — it's back where it was.");
    }
  };

  // Cancelling is a Slate status change with consequences beyond this board:
  // the card leaves, and the shoot comes off the studio's Google Calendar. It
  // used to be one unconfirmed click in the card's sidebar.
  const cancelJob = async (job: Job) => {
    const ok = await confirmAction({
      title: `Cancel "${job.title}"?`,
      message: 'The production is marked Cancelled in Slate, leaves this board, and comes off Google Calendar. You can set its status back from Slate.',
      confirmLabel: 'Cancel production',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!ok) return;
    if ((await handleJobUpdate({ ...job, job_status: 'Cancelled' })) === false) return;
    setActiveJob(null);
    setJobs(prev => prev.filter(j => j.id !== job.id));
    if (job.shoot_date) {
      pushJobToGoogleCalendar(job.id).then(result => {
        if (!result.ok && result.message) toast(result.message, 'error');
      });
    }
  };

  // Match a typed client name to a clients row, creating it when the name is
  // new. Same contract Slate uses when saving a shoot, so a card and a shoot
  // that name the same client end up pointing at one row rather than two.
  const resolveOrCreateClient = async (name?: string): Promise<Client | null> => {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const existing = clients.find(c => c.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name: trimmed }])
      .select()
      .single();
    if (error) {
      console.error('Error creating client:', error);
      return null;
    }
    const created = data as Client;
    setClients(prev => [...prev, created]);
    return created;
  };

  const createProject = async (name: string, clientId?: string): Promise<Project | null> => {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name: name.trim(), client_id: clientId || null }])
      .select()
      .single();
    if (error) {
      console.error('Error creating project:', error);
      toast(`Failed to create project: ${error.message || 'unknown error'}`);
      return null;
    }
    const created = data as Project;
    setProjects(prev => [...prev, created]);
    return created;
  };

  const handleJobUpdate = async (updatedJob: Job, opts?: { newProjectName?: string }) => {
    // If it's a new job being created from the modal
    if (isCreatingNew) {
       try {
          const { editor, id, ...dbData } = updatedJob; // Remove the dummy 'draft-' ID so Supabase generates a valid UUID

          // A card can name a client the Rolodex hasn't got yet; create it so
          // the card, its project and any later shoot share the same client.
          const client = await resolveOrCreateClient(dbData.client_name);
          dbData.client_id = client?.id;
          if (client) dbData.client_name = client.name;

          // A brand new project is only written once the card actually gets
          // created — an abandoned modal leaves no empty project behind.
          const pendingProject = opts?.newProjectName?.trim();
          if (pendingProject) {
            const project = await createProject(pendingProject, client?.id);
            if (!project) return; // createProject surfaced the reason already
            dbData.project_id = project.id;
          }

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

    // Every change on the card arrives as "the card, with one thing different".
    // Only that difference is written: sending the whole row put back whatever
    // the card held when it opened, undoing a teammate's edit to the same
    // production — and for a freelance editor it tripped the column guard on
    // fields they never touched, so the save failed outright.
    const base = activeJob && activeJob.id === updatedJob.id ? activeJob : jobs.find(j => j.id === updatedJob.id);
    const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    const changes: Record<string, unknown> = Object.fromEntries(
      Object.entries(updatedJob)
        .filter(([key, value]) => key !== 'editor' && !same(value, base ? (base as any)[key] : undefined))
        // A cleared date input hands back "", which a DATE column rejects, and
        // undefined is dropped from the request — both mean "clear it".
        .map(([key, value]) => [key, value === undefined || (value === '' && /_date$/.test(key)) ? null : value])
    );
    if (Object.keys(changes).length === 0) return true;

    // Update local state immediately for existing jobs, merging the change
    // into the freshest copy rather than replacing it with the card's.
    const before = jobs.find(j => j.id === updatedJob.id);
    const merge = (j: Job): Job => ({ ...j, ...changes, ...('editor_id' in changes ? { editor: updatedJob.editor } : {}) } as Job);
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? merge(j) : j));
    setActiveJob(cur => (cur && cur.id === updatedJob.id ? merge(cur) : cur));

    try {
      const { error } = await supabase
        .from('jobs')
        .update(changes)
        .eq('id', updatedJob.id);

      if (error) throw error;
      return true;
    } catch (err) {
      // Used to fail silently — the card showed the change until the next
      // reload quietly took it away. Say so, and put the saved row back
      // (locally — a full refetch would blank the board under the open card).
      console.error('Error saving job updates:', err);
      toast("Couldn't save that change to the card.");
      if (before) {
        setJobs(prev => prev.map(j => (j.id === before.id ? before : j)));
        setActiveJob(cur => (cur && cur.id === before.id ? before : cur));
      }
      return false;
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
      {/* One row: view, my cards, filters, then the two board actions. The
          page header already names the screen, so the second title and the
          Active Edits readout (each column shows its own count) are gone, and
          client/project/year live behind one Filters button. */}
      <div className={`flex flex-wrap items-center ${CONTROL_GAP} ${TOOLBAR_CARD} shrink-0`}>
        <div className={`flex items-center gap-1 p-1 bg-black/50 border border-white/10 rounded-xl ${CONTROL_H}`}>
          <button
            onClick={() => setViewMode('board')}
            className={`h-full px-3.5 text-[13px] font-medium tracking-tight rounded-lg transition-colors ${viewMode === 'board' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
            title="Kanban board grouped by stage"
          >
            Board
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`h-full px-3.5 text-[13px] font-medium tracking-tight rounded-lg transition-colors ${viewMode === 'timeline' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white'}`}
            title="Agenda view grouped by due date"
          >
            Timeline
          </button>
        </div>
        {canManageBoard && myEmail && (
          <button
            onClick={() => setMyCardsOnly(v => !v)}
            className={`inline-flex items-center justify-center gap-2 border ${CONTROL_H} rounded-xl px-4 text-[13px] font-medium tracking-tight transition-colors ${
              myCardsOnly
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-black/50 border-white/10 text-white/60 hover:text-white hover:border-white/25'
            }`}
            title="Show only cards where the assigned editor matches your account email"
          >
            <UserCheck className="w-3.5 h-3.5" /> My cards
          </button>
        )}
        <FilterSheet
          collapsed
          activeCount={
            (clientFilter !== 'All' ? 1 : 0) +
            (projectFilter !== 'All' ? 1 : 0) +
            (yearFilter !== 'All' ? 1 : 0)
          }
        >
          <select
            value={clientFilter}
            onChange={(e) => { setClientFilter(e.target.value); setProjectFilter('All'); }}
            className={`${CONTROL_SELECT} ${CONTROL_SELECT_MAX} flex-1 min-w-[120px] sm:flex-none sm:min-w-[130px]`}
          >
            <option value="All">All clients</option>
            {uniqueClients.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            disabled={projectsForFilter.length === 0}
            className={`${CONTROL_SELECT} ${CONTROL_SELECT_MAX} flex-1 min-w-[120px] sm:flex-none sm:min-w-[130px] disabled:opacity-30`}
          >
            <option value="All">All projects</option>
            {projectsForFilter.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className={`${CONTROL_SELECT} ${CONTROL_SELECT_MAX} min-w-[110px]`}
          >
            <option value="All">All years</option>
            {uniqueYears.map(y => <option key={y as string} value={y as string}>{y}</option>)}
          </select>
        </FilterSheet>
        <div className={`flex items-center ${CONTROL_GAP} ml-auto`}>
          {canManageBoard && availableJobs.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) updateJobEditStatus(e.target.value, firstStageId);
              }}
              className={`${CONTROL_H} rounded-xl border border-accent/30 bg-accent/10 text-accent px-4 text-[13px] font-medium tracking-tight outline-none focus:border-accent transition-colors cursor-pointer appearance-none w-full sm:w-auto sm:min-w-[190px] sm:max-w-[240px]`}
              title="Pull a Slate production onto the post-production board"
            >
              <option value="">+ Add production</option>
              {availableJobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.title}{j.client_name ? ` — ${j.client_name}` : ''}
                </option>
              ))}
            </select>
          )}
          {canManageBoard && (
            <button
              onClick={() => setIsColumnsModalOpen(true)}
              className={`${CONTROL_BUTTON} hover:border-white/25`}
              title="Rename, recolor, add, or remove board columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Columns
            </button>
          )}
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
                              <CardFront job={job} isDragging={snapshot.isDragging} loggedSeconds={timeTotals[job.id] || 0} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {stage.id === firstStageId && canManageBoard && (
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
            clients={clients}
            projects={projects}
            onClose={() => {
              setActiveJob(null);
              setIsCreatingNew(false);
            }}
            onUpdate={handleJobUpdate}
            onRemoveFromBoard={removeFromBoard}
            onCancelJob={cancelJob}
            onMoveStage={updateJobEditStatus}
            stages={stages}
            isCreatingNew={isCreatingNew}
            isClient={isClient}
            isEditor={isEditor}
            myName={myName}
            onTimeChange={noteCardTime}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardDeliverables — the cutdowns this job owes the client.
// The same social_deliverables rows the Slate card edits, so a job built on
// Slate arrives here with its list and a change on either screen is the
// same change. Producers can add, rename, reformat and remove; an editor can
// only move status (the line migration 20260921000000 draws); a client reads.
// ----------------------------------------------------------------------
function CardDeliverables({
  job,
  isClient,
  isEditor,
}: {
  job: Job;
  isClient: boolean;
  isEditor: boolean;
}) {
  const [items, setItems] = useState<Deliverable[]>([]);
  const [loaded, setLoaded] = useState(false);
  const canManage = !isClient && !isEditor;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('social_deliverables')
        .select('*')
        .eq('job_id', job.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('Failed to load deliverables:', error);
      else setItems((data || []) as Deliverable[]);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [job.id]);

  // The same insert Slate makes: inherits the job's client so it also lands
  // under the right name on the Social tab, and leaves sort_order at its
  // default so both screens order the list by created_at alike.
  const add = async () => {
    const { data, error } = await supabase
      .from('social_deliverables')
      .insert([{ job_id: job.id, client_id: job.client_id || null, label: '', format: '16:9', status: 'todo' }])
      .select()
      .single();
    if (error || !data) { toast('Could not add the deliverable.'); return; }
    setItems(prev => [...prev, data as Deliverable]);
  };

  // A failed save rolls back only the row it touched, so it can't undo an
  // unrelated edit that landed while the request was in flight.
  const patch = async (id: string, change: Partial<Deliverable>) => {
    const prior = items.find(d => d.id === id);
    if (!prior) return;
    setItems(prev => prev.map(d => (d.id === id ? { ...d, ...change } : d)));
    const { error } = await supabase.from('social_deliverables').update(change).eq('id', id);
    if (error) {
      toast('Could not save that change.');
      setItems(prev => prev.map(d => (d.id === id ? prior : d)));
    }
  };

  const remove = async (id: string) => {
    const index = items.findIndex(d => d.id === id);
    if (index < 0) return;
    const prior = items[index];
    setItems(prev => prev.filter(d => d.id !== id));
    const { error } = await supabase.from('social_deliverables').delete().eq('id', id);
    if (error) {
      toast('Could not remove that deliverable.');
      setItems(prev => [...prev.slice(0, index), prior, ...prev.slice(index)]);
    }
  };

  if (!loaded) return null;
  // Nothing to show an editor or client, and nothing they could add.
  if (items.length === 0 && !canManage) return null;

  const delivered = items.filter(d => d.status === 'delivered').length;

  return (
    <div className="flex gap-4">
      <Film className="w-6 h-6 text-white/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-bold text-white">Deliverables</h3>
          {items.length > 0 && (
            <span className="text-[10px] font-bold text-white/40">{delivered}/{items.length} delivered</span>
          )}
        </div>

        {items.length === 0 && (
          <p className="text-xs text-white/35 mb-2">None yet. Deliverables added on Slate show up here too.</p>
        )}

        <div className="space-y-1">
          {items.map(d => (
            // On a phone the name takes its own line; inline it was squeezed
            // to a few characters by the format, status and remove controls.
            <div key={d.id} className="group flex flex-wrap sm:flex-nowrap items-center gap-x-2.5 gap-y-1 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              {canManage ? (
                <input
                  // Keyed on the saved label so a rolled-back rename resets
                  // the field instead of leaving the unsaved text in it.
                  key={`${d.id}:${d.label || ''}`}
                  defaultValue={d.label || ''}
                  placeholder="e.g. 60s hero cut"
                  aria-label="Deliverable name"
                  onBlur={e => {
                    const value = e.target.value;
                    if (value !== (d.label || '')) void patch(d.id, { label: value });
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="basis-full sm:basis-auto flex-1 min-w-0 bg-transparent outline-none text-sm text-white/80 rounded px-1.5 py-0.5 -my-0.5 focus:bg-white/10 placeholder:text-white/25"
                />
              ) : (
                <span className="basis-full sm:basis-auto flex-1 min-w-0 text-sm text-white/80 truncate">{d.label || 'Untitled'}</span>
              )}

              {canManage ? (
                <select
                  value={d.format || '16:9'}
                  aria-label="Aspect ratio"
                  onChange={e => void patch(d.id, { format: e.target.value })}
                  className="bg-transparent outline-none text-xs text-white/45 cursor-pointer shrink-0 hover:text-white/70"
                >
                  {DELIVERABLE_FORMATS.map(f => (
                    <option key={f} value={f} className="bg-zinc-900">{f}</option>
                  ))}
                </select>
              ) : (
                d.format && <span className="text-xs text-white/45 shrink-0">{d.format}</span>
              )}

              <button
                type="button"
                disabled={isClient}
                onClick={() => void patch(d.id, { status: nextDeliverableStatus(d.status) })}
                title={isClient ? undefined : 'Change status'}
                className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-widest shrink-0 transition-colors ${deliverableStatusTone(d.status)} ${isClient ? '' : 'cursor-pointer'}`}
              >
                {deliverableStatusLabel(d.status)}
              </button>

              {canManage && (
                <button
                  type="button"
                  aria-label={`Remove ${d.label || 'deliverable'}`}
                  onClick={() => void remove(d.id)}
                  className="p-1 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <button
            type="button"
            onClick={add}
            className="mt-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
          >
            + Deliverable
          </button>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardDrafts — where an editor posts a cut instead of Discord.
// Title + link, and the version number counts itself. No embed: the studio's
// Vimeo uploads are private, so a player couldn't load them anyway. Stored in
// jobs.links (category 'Draft'), which an editor may already write. The
// newest post also becomes the card's review_link, so the Discord alert on V1,
// the Slate card and the calendar event all point at the latest cut.
// ----------------------------------------------------------------------
function CardDrafts({
  job,
  onUpdate,
  isClient,
  isEditor,
  myName,
  stages,
  onMoveStage,
}: {
  job: Job;
  /** Resolves false when the save failed (and was rolled back). */
  onUpdate: (job: Job) => void | Promise<boolean | void>;
  isClient: boolean;
  isEditor: boolean;
  myName?: string | null;
  stages: ResolvedStage[];
  onMoveStage: (jobId: string, stageId: string) => void;
}) {
  const [title, setTitle] = useState('');
  // Set right after a post when the card is still short of the review stage.
  // Posting a cut and moving the card were two separate steps, and only the
  // move tells the producer (V1 is what sends the "ready for review" alert).
  const [offerReview, setOfferReview] = useState(false);
  const reviewIndex = stages.findIndex(st => st.id === 'V1');
  const reviewStage = reviewIndex === -1 ? null : stages[reviewIndex];
  const currentIndex = stages.findIndex(st => st.id === job.edit_status);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [deliverableTitles, setDeliverableTitles] = useState<string[]>([]);

  // Offer the card's deliverables as titles, so "60s hero cut" is one tap.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('social_deliverables')
      .select('label')
      .eq('job_id', job.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setDeliverableTitles(data.map(d => (d.label || '').trim()).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, [job.id]);

  const links = job.links || [];
  const groups = useMemo(() => groupDrafts(job.links), [job.links]);
  const defaultTitle = groups[0]?.title || 'Draft';
  const suggestions = useMemo(
    () => [...new Set([...groups.map(g => g.title), ...deliverableTitles])],
    [groups, deliverableTitles]
  );

  // Everything else attached to the card: older review/Drive/Discord fields and
  // non-draft links. Shown so nothing already saved disappears; not added to
  // here any more. The review link is skipped when it's just the newest draft.
  const draftUrls = new Set(links.filter(isDraft).map(l => l.url));
  const otherLinks: { key: string; label: string; url: string; remove?: () => void }[] = [
    ...(job.review_link && !draftUrls.has(job.review_link)
      ? [{ key: 'review', label: 'Review link', url: job.review_link, remove: () => onUpdate({ ...job, review_link: null as unknown as string }) }]
      : []),
    ...(job.drive_folder_url
      ? [{ key: 'drive', label: 'Drive folder', url: job.drive_folder_url, remove: () => onUpdate({ ...job, drive_folder_url: null as unknown as string }) }]
      : []),
    // discord_url isn't on the editor's column whitelist, so only the studio can clear it.
    ...(job.discord_url
      ? [{ key: 'discord', label: 'Discord', url: job.discord_url, remove: isEditor ? undefined : () => onUpdate({ ...job, discord_url: null as unknown as string }) }]
      : []),
    ...links
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l && !isDraft(l) && l.url)
      .map(({ l, i }) => ({
        key: `link-${i}`,
        label: l.label || 'Link',
        url: l.url,
        remove: () => onUpdate({ ...job, links: links.filter((_, j) => j !== i) }),
      })),
  ];

  const post = async () => {
    const url = extractDraftUrl(link);
    if (!url) {
      setError(link.trim() ? "That doesn't look like a link." : 'Paste a link first.');
      return;
    }
    const draft = makeDraft(links, title.trim() || defaultTitle, url, myName);
    setError(null);
    // Keep what was typed if the save fails, so it isn't pasted twice.
    if ((await onUpdate({ ...job, ...withPostedDraft(job.links, job.review_link, draft) })) === false) return;
    setLink('');
    setTitle('');
    if (reviewStage && currentIndex !== -1 && currentIndex < reviewIndex) setOfferReview(true);
  };

  const removeVersion = async (target: JobLink) => {
    const ok = await confirmAction({
      title: `Remove ${target.label} v${target.version || 1}?`,
      message: 'Only the link on this card goes. The video itself is untouched.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    const remaining = links.filter(l => l !== target);
    // If that was the card's review link, fall back to the newest draft left.
    const newest = groupDrafts(remaining)[0]?.versions[0]?.url;
    onUpdate({
      ...job,
      links: remaining,
      ...(job.review_link === target.url ? { review_link: (newest || null) as unknown as string } : {}),
    });
  };

  const copy = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(c => (c === url ? null : c)), 1500);
    }).catch(() => toast('Could not copy the link.'));
  };

  const when = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const versionRow = (v: JobLink, latest: boolean, key?: string) => (
    <div key={key} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
      <span className={`shrink-0 w-9 text-center text-[10px] font-black rounded px-1 py-0.5 ${latest ? 'bg-accent/20 text-accent' : 'bg-white/5 text-white/40'}`}>
        v{v.version || 1}
      </span>
      <a
        href={sanitizeUrl(v.url)}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex-1 min-w-0 truncate text-xs hover:underline ${latest ? 'text-white' : 'text-white/50'}`}
        title={[v.url, when(v.added_at), v.added_by].filter(Boolean).join(' · ')}
      >
        {v.url.replace(/^https?:\/\/(www\.)?/, '')}
      </a>
      <span className="hidden sm:inline shrink-0 text-[10px] text-white/35">
        {[when(v.added_at), v.added_by].filter(Boolean).join(' · ')}
      </span>
      <button
        type="button"
        onClick={() => copy(v.url)}
        aria-label="Copy link"
        title="Copy link"
        className="p-1 text-white/30 hover:text-white transition-colors"
      >
        {copied === v.url ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      {!isClient && (
        <button
          type="button"
          onClick={() => void removeVersion(v)}
          aria-label={`Remove v${v.version || 1}`}
          className="p-1 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="flex gap-4">
      <PlayCircle className="w-6 h-6 text-white/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-white mb-2">Drafts</h3>

        {groups.length === 0 && (
          <p className="text-xs text-white/35 mb-2">
            {isClient ? 'No drafts posted yet.' : 'No drafts yet. Paste a Vimeo or Frame.io link below when a cut is ready.'}
          </p>
        )}

        <div className="space-y-3">
          {groups.map(g => {
            const [latest, ...older] = g.versions;
            const open = !!openHistory[g.title];
            return (
              <div key={g.title} className="bg-white/[0.03] border border-white/5 rounded-xl p-2">
                <p className="text-xs font-bold text-white px-2 pt-1 pb-1">{g.title}</p>
                {versionRow(latest, true)}
                {older.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenHistory(prev => ({ ...prev, [g.title]: !open }))}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white/40 hover:text-white transition-colors"
                    >
                      {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {open ? 'Hide' : 'Show'} {older.length} earlier version{older.length === 1 ? '' : 's'}
                    </button>
                    {open && older.map((v, i) => versionRow(v, false, `${v.url}-${i}`))}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {!isClient && (
          <form
            onSubmit={e => { e.preventDefault(); void post(); }}
            className="mt-3 flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onPaste={e => {
                // A web address pasted into the title box almost always meant
                // the link box. Only a real http(s) one — a title like
                // "teaser.final" must stay a title.
                const text = e.clipboardData.getData('text');
                const url = /https?:\/\//i.test(text) ? extractDraftUrl(text) : null;
                if (url && !link.trim()) { e.preventDefault(); setLink(url); setError(null); }
              }}
              list={`draft-titles-${job.id}`}
              placeholder={defaultTitle}
              aria-label="Draft title"
              className="sm:w-40 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs font-semibold text-white outline-none focus:border-accent placeholder:text-white/30"
            />
            <datalist id={`draft-titles-${job.id}`}>
              {suggestions.map(s => <option key={s} value={s} />)}
            </datalist>
            <input
              type="text"
              inputMode="url"
              value={link}
              onChange={e => { setLink(e.target.value); setError(null); }}
              onPaste={e => {
                // Pasting a whole Discord message keeps just the link.
                const url = extractDraftUrl(e.clipboardData.getData('text'));
                if (url) { e.preventDefault(); setLink(url); setError(null); }
              }}
              placeholder="Paste link"
              aria-label="Draft link"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 px-3 py-2 rounded-lg text-xs text-white outline-none focus:border-accent placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={!link.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-white text-xs font-bold hover:bg-white hover:text-black disabled:opacity-40 disabled:hover:bg-accent disabled:hover:text-white transition-colors"
            >
              Post v{nextDraftVersion(links, title.trim() || defaultTitle)}
            </button>
          </form>
        )}
        {error && <p className="text-[11px] text-red-400 mt-1.5 ml-1">{error}</p>}

        {offerReview && reviewStage && (
          <div className="mt-3 flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/25">
            <span className="flex-1 min-w-[160px] text-xs text-white/80">
              Draft posted. Move this card to {reviewStage.label} and let the team know it&apos;s ready?
            </span>
            <button
              type="button"
              onClick={() => { onMoveStage(job.id, reviewStage.id); setOfferReview(false); }}
              className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Move to {reviewStage.label}
            </button>
            <button
              type="button"
              onClick={() => setOfferReview(false)}
              className="px-2 py-1.5 rounded-lg text-xs text-white/50 hover:text-white transition-colors"
            >
              Not now
            </button>
          </div>
        )}

        {otherLinks.length > 0 && (
          <div className="mt-5">
            <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-1.5">Other links</h4>
            <div className="space-y-0.5">
              {otherLinks.map(o => (
                <div key={o.key} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5 text-white/30 shrink-0" />
                  <a
                    href={sanitizeUrl(o.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-xs text-white/70 hover:underline"
                    title={o.url}
                  >
                    <span className="font-semibold text-white/80">{o.label}</span>
                    <span className="text-white/35"> · {o.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  </a>
                  {!isClient && o.remove && (
                    <button
                      type="button"
                      onClick={o.remove}
                      aria-label={`Remove ${o.label}`}
                      className="p-1 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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

  // Click an item's text to reword it. Enter or blur saves, Escape backs out.
  // Clearing the text is not a delete — the X is — so an empty save reverts.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // Escape unmounts the input, and some browsers fire blur on the way out —
  // which would save the draft the user just abandoned.
  const cancelled = React.useRef(false);

  const startEdit = (item: { id: string; task: string }) => {
    cancelled.current = false;
    setEditingId(item.id);
    setDraft(item.task);
  };

  const commitEdit = async () => {
    const id = editingId;
    if (!id || cancelled.current) return;
    setEditingId(null);
    const task = draft.trim();
    const prior = items.find(i => i.id === id);
    if (!prior || !task || task === prior.task) return;
    setItems(prev => prev.map(i => (i.id === id ? { ...i, task } : i)));
    const { error } = await supabase.from('job_todos').update({ task }).eq('id', id);
    if (error) {
      toast('Could not save that change.');
      setItems(prev => prev.map(i => (i.id === id ? { ...i, task: prior.task } : i)));
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
            {editingId === item.id ? (
              <input
                autoFocus
                value={draft}
                aria-label="Checklist item"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { e.stopPropagation(); cancelled.current = true; setEditingId(null); }
                }}
                className="flex-1 min-w-0 bg-white/10 rounded px-1.5 py-0.5 -my-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <span
                onClick={isClient ? undefined : () => startEdit(item)}
                title={isClient ? undefined : 'Click to edit'}
                className={`flex-1 text-sm ${isClient ? '' : 'cursor-text'} ${item.completed ? 'text-white/35 line-through' : 'text-white/80'}`}
              >
                {item.task}
              </span>
            )}
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
      { key: 'done', label: 'Done', accentClass: 'text-green-400/70', jobs: [] },
    ];
    const byKey = Object.fromEntries(groups.map(g => [g.key, g]));

    const sorted = [...jobs].sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    for (const job of sorted) {
      // Delivered and wrapped work is done, not late or upcoming — the board's
      // own card badge already says so; this list filed it under Overdue.
      if (job.edit_status === 'Delivered' || job.edit_status === 'Wrapped') { byKey.done.jobs.push(job); continue; }
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
                    <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] md:text-[9px] font-black uppercase tracking-widest ${stage.bg} ${stage.colorClass}`}>
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
    <Portal>
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9010] flex justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto cursor-pointer"
    >
      <EscapeToClose onClose={onClose} />
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl my-auto p-6 cursor-default"
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold tracking-tight text-white">Board Columns</h3>
          <button aria-label="Close" title="Close" onClick={onClose} className="p-1.5 text-white/40 hover:text-white transition-colors">
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
              <span className="text-[11px] md:text-[9px] text-white/25 w-12 text-right shrink-0">
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
    </Portal>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardFront (The compact Trello-style card on the board)
// ----------------------------------------------------------------------
function CardFront({ job, isDragging, loggedSeconds = 0 }: { job: Job, isDragging: boolean, loggedSeconds?: number }) {
  const hasNotes = !!job.edit_notes?.trim();
  // Drafts count once each (newest cut), and the review link isn't counted
  // again when it's just that newest draft.
  const cardLinks = latestDraftLinks(job.links);
  const reviewIsDraft = cardLinks.some(l => l.category === 'Draft' && l.url === job.review_link);
  const linkCount = cardLinks.length + (job.review_link && !reviewIsDraft ? 1 : 0) + (job.discord_url ? 1 : 0) + (job.drive_folder_url ? 1 : 0);
  
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

          {loggedSeconds > 0 && (
             <div className="flex items-center gap-1" title="Time logged against this card">
               <Timer className="w-3 h-3" />
               <span className="text-[10px] font-bold tabular-nums">{formatDuration(loggedSeconds)}</span>
             </div>
          )}
        </div>

        {/* Editor Avatar */}
        {job.editor && (
          <div className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[11px] md:text-[9px] font-black shadow-sm" title={`Assigned to: ${job.editor.name}`}>
            {job.editor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardDetailModal (The "Card Back")
// ----------------------------------------------------------------------
function CardDetailModal({
  job,
  contacts,
  clients,
  projects,
  onClose,
  onUpdate,
  onRemoveFromBoard,
  onCancelJob,
  onMoveStage,
  stages,
  isCreatingNew,
  isClient,
  isEditor,
  myName,
  onTimeChange
}: {
  job: Job,
  contacts: Contact[],
  clients: Client[],
  projects: Project[],
  onClose: () => void,
  onUpdate: (job: Job, opts?: { newProjectName?: string }) => void | Promise<boolean | void>,
  onRemoveFromBoard: (jobId: string) => void,
  onCancelJob: (job: Job) => void,
  onMoveStage: (jobId: string, stageId: string) => void,
  stages: ResolvedStage[],
  isCreatingNew?: boolean,
  isClient: boolean,
  isEditor?: boolean,
  myName?: string | null,
  onTimeChange?: (jobId: string, seconds: number) => void
}) {
  // A card carries the production's own details as well as the board's. An
  // editor works the board half — stage, notes, labels, deadline, links — and
  // the rest is read-only for them, which is the same line the database draws
  // (the column whitelist in migration 20260822000000). Locking the inputs
  // here means they see why rather than watching a save quietly fail.
  const isBoardOnly = isClient || !!isEditor;
  const [title, setTitle] = useState(job.title);
  const [notes, setNotes] = useState(job.edit_notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // Client + project, filled in while a card is being created. Nothing is
  // written until Create Card, so backing out costs no rows.
  const [clientName, setClientName] = useState(job.client_name || '');
  const [projectId, setProjectId] = useState(job.project_id || '');
  const [newProjectName, setNewProjectName] = useState('');
  const NEW_PROJECT = '__new__';

  // The client this card is being filed under, matched by name the way Slate
  // matches it — used to scope the project list to that client's projects.
  const matchedClient = useMemo(
    () => clients.find(c => c.name.trim().toLowerCase() === clientName.trim().toLowerCase()),
    [clients, clientName]
  );
  // No client named yet: every project is fair game. A client that isn't in
  // the Rolodex yet owns no projects, so the only honest option is a new one.
  const projectsForClient = useMemo(() => {
    if (!clientName.trim()) return projects;
    if (!matchedClient) return [];
    return projects.filter(p => p.client_id === matchedClient.id);
  }, [projects, matchedClient, clientName]);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');

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
      postNotify({
        message: `💬 ${names} mentioned on "${job.title}" (Edit Tracker):\n${excerpt}`,
      }).catch(err => console.error('Mention notification failed:', err));
    }

    onUpdate({ ...job, edit_notes: notes });
    setIsEditingNotes(false);
  };

  const addLabel = (colorClass: string) => {
    const newLabel: EditLabel = {
      id: crypto.randomUUID().slice(0, 9),
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

  // Portalled out of the workspace panel: rendered in place, the panel's
  // stacking context kept it under the sticky page header, which then
  // covered the top of the card however high its z-index went.
  return (
    <Portal>
    <div 
      onClick={onClose}
      className="fixed inset-0 z-[9000] flex justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto cursor-pointer"
    >
      <EscapeToClose onClose={onClose} />
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl relative min-h-[600px] my-auto flex flex-col cursor-default"
      >
        <button aria-label="Close" title="Close" onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors">
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
              disabled={isBoardOnly}
              className="w-full bg-transparent text-xl font-bold text-white outline-none border-2 border-transparent focus:border-accent focus:bg-black/20 rounded px-2 py-1 -ml-2 disabled:bg-transparent disabled:border-transparent disabled:-ml-2"
            />
            {/* A stage control inside the card. Dragging between columns was the
                only way to move one, which on a phone means dragging across a
                stack of full-width lists. Same move as a drop on the board. */}
            {isCreatingNew || isClient ? (
              <p className="text-[11px] text-white/40 mt-1 pl-1">
                in list <span className="underline">{currentStage?.label}</span>
              </p>
            ) : (
              <label className="flex items-center gap-1.5 mt-1 pl-1 text-[11px] text-white/40">
                Stage
                <select
                  value={currentStage?.id || ''}
                  onChange={(e) => onMoveStage(job.id, e.target.value)}
                  aria-label="Move this card to a stage"
                  className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-[11px] font-semibold text-white outline-none focus:border-accent cursor-pointer"
                >
                  {stages.map(st => <option key={st.id} value={st.id} className="bg-zinc-900">{st.label}</option>)}
                </select>
              </label>
            )}
          </div>
          {isCreatingNew && (
            <button 
              onClick={() => onUpdate(
                {
                  ...job,
                  title: title.trim() || 'Untitled Task',
                  edit_notes: notes,
                  client_name: clientName.trim() || undefined,
                  client_id: matchedClient?.id,
                  project_id: projectId === NEW_PROJECT ? undefined : (projectId || undefined),
                },
                { newProjectName: projectId === NEW_PROJECT ? newProjectName : undefined }
              )}
              disabled={projectId === NEW_PROJECT && !newProjectName.trim()}
              title={projectId === NEW_PROJECT && !newProjectName.trim() ? 'Name the new project first' : undefined}
              className="px-6 py-2 bg-accent text-white rounded-lg font-bold text-xs hover:bg-white hover:text-black transition-all h-fit mt-1 disabled:opacity-40 disabled:hover:bg-accent disabled:hover:text-white"
            >
              Create Card
            </button>
          )}
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-6 pt-2 gap-8">
          
          {/* Main Content Column. min-w-0 so a long draft link truncates
              instead of widening the column and shoving the sidebar out. */}
          <div className="flex-1 min-w-0 space-y-8">

            {/* Client + project, on new cards only. A card started here is
                post-production work that may have no shoot behind it, so it
                files itself under a client and project directly. */}
            {isCreatingNew && (
              <div className="pl-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-2">Client</h4>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => { setClientName(e.target.value); setProjectId(''); }}
                      list="edit-tracker-clients"
                      placeholder="Client name"
                      className="w-full bg-white/5 border border-white/10 py-1.5 pl-9 pr-3 rounded-lg text-xs font-bold text-white outline-none focus:border-accent"
                    />
                    <datalist id="edit-tracker-clients">
                      {clients.map(c => <option key={c.id} value={c.name} />)}
                    </datalist>
                  </div>
                  {clientName.trim() && !matchedClient && (
                    <p className="text-[10px] text-accent/80 mt-1 ml-1">New client — will be added to the Rolodex.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/40 mb-2">Project</h4>
                  <div className="relative">
                    <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 py-1.5 pl-9 pr-3 rounded-lg text-xs font-bold text-white outline-none focus:border-accent appearance-none cursor-pointer"
                    >
                      <option value="">No project</option>
                      {projectsForClient.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value={NEW_PROJECT}>+ New project…</option>
                    </select>
                  </div>
                  {projectId === NEW_PROJECT && (
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      placeholder="Project name"
                      autoFocus
                      className="w-full bg-white/5 border border-white/10 py-1.5 px-3 mt-2 rounded-lg text-xs font-bold text-white outline-none focus:border-accent"
                    />
                  )}
                </div>
              </div>
            )}
            
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
                      disabled={isBoardOnly}
                      title={isEditor ? 'Only the studio can reassign a card' : undefined}
                      className="bg-white/5 border border-white/10 py-1.5 px-3 rounded-lg text-xs font-bold text-white outline-none focus:border-accent appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">Unassigned</option>
                      {/* Anyone who lists a post role, primary or secondary.
                          Matching on the primary role alone meant a producer
                          who also cuts had to be *retitled* an editor to be
                          assignable — and was then billed as the editor on
                          every call sheet. Whoever is already assigned stays
                          listed even if their roles have since changed, so
                          the select can't silently blank itself. */}
                      {contacts
                        .filter(c => hasAnyRole(c, POST_ROLES) || c.id === job.editor_id)
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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

            {/* Deliverables, as built on Slate */}
            {!isCreatingNew && (
              <CardDeliverables job={job} isClient={isClient} isEditor={!!isEditor} />
            )}

            {/* Delivery Checklist */}
            {!isCreatingNew && (
              <div className="flex gap-4">
                <CheckCircle2 className="w-6 h-6 text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardChecklist jobId={job.id} isClient={isClient} />
                </div>
              </div>
            )}

            {/* Time logged against this card. Not shown to a client: the
                studio's hours on their production are not theirs to read, and
                the API would hand them an empty list anyway. */}
            {!isCreatingNew && !isClient && (
              <div className="flex gap-4">
                <Timer className="w-6 h-6 text-white/40 shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardTimeTracker
                    jobId={job.id}
                    canLog
                    onTotalChange={(seconds) => onTimeChange?.(job.id, seconds)}
                  />
                </div>
              </div>
            )}

            {/* Drafts — the cut links editors used to post in Discord */}
            {!isCreatingNew && (
              <CardDrafts job={job} onUpdate={onUpdate} isClient={isClient} isEditor={!!isEditor} myName={myName} stages={stages} onMoveStage={onMoveStage} />
            )}

          </div>

          {/* Right Sidebar (Actions) */}
          <div className="w-full md:w-48 md:shrink-0 space-y-6">
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

             {!isBoardOnly && !isCreatingNew && (
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
                 <button onClick={() => onCancelJob(job)} className="w-full flex items-center gap-2 bg-white/10 hover:bg-red-500/20 hover:text-red-500 text-white p-2 rounded transition-colors text-sm font-medium">
                   <Archive className="w-4 h-4" /> Cancel Job
                 </button>
               </div>
             )}
          </div>

        </div>
      </motion.div>
    </div>
    </Portal>
  );
}
