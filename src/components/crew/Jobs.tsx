'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  DndContext, 
  closestCorners, 
  rectIntersection,
  pointerWithin,
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
  useDroppable,
  defaultDropAnimationSideEffects, 
  DragStartEvent, 
  DragOverEvent, 
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Plus, 
  Minus,
  Calendar, 
  Clock, 
  MoreHorizontal, 
  Server, 
  CheckCircle2, 
  Film, 
  Eye, 
  AlertCircle,
  Pencil,
  Trash2,
  X,
  Briefcase,
  Layout,
  UserPlus,
  Users,
  Settings,
  Edit2,
  MessageSquare,
  Video,
  HardDrive,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---

type JobStatus = 'queue' | 'editing' | 'review' | 'final' | 'backup' | 'done';

interface Job {
  id: string;
  title: string;
  client: string;
  status: JobStatus;
  shootDate: string;
  dueDate: string;
  revisionRound: number; // 0 = Rough, 1 = V1, 2 = V2, etc.
  notes: string;
  tags: string[];
  // Integrations
  discordUrl?: string;
  reviewLink?: string;
  reviewPassword?: string;
  driveUrl?: string;
}

const COLUMNS: { id: JobStatus; title: string; icon: React.ReactNode; color: string }[] = [
  { id: 'queue', title: 'Ingest / Queue', icon: <Film className="w-4 h-4" />, color: 'border-white/20' },
  { id: 'editing', title: 'In The Cut', icon: <Pencil className="w-4 h-4" />, color: 'border-blue-500' },
  { id: 'review', title: 'Client Review', icon: <Eye className="w-4 h-4" />, color: 'border-yellow-500' },
  { id: 'final', title: 'Final Polish', icon: <CheckCircle2 className="w-4 h-4" />, color: 'border-purple-500' },
  { id: 'backup', title: 'Needs Backup', icon: <Server className="w-4 h-4" />, color: 'border-red-500' },
  { id: 'done', title: 'Archive', icon: <CheckCircle2 className="w-4 h-4" />, color: 'border-green-500' },
];

// --- Mock Data (for initial load) ---
const INITIAL_JOBS: Job[] = [
  {
    id: '1',
    title: 'Spring Campaign 2026',
    client: 'Acme Corp',
    status: 'editing',
    shootDate: '2026-03-10',
    dueDate: '2026-03-20',
    revisionRound: 1,
    notes: 'Focus on the new product line.',
    tags: ['Social', '9:16']
  },
  {
    id: '2',
    title: 'Executive Interview',
    client: 'Stark Industries',
    status: 'review',
    shootDate: '2026-03-01',
    dueDate: '2026-03-15',
    revisionRound: 2,
    notes: 'Waiting for feedback on legal disclaimers.',
    tags: ['Internal']
  },
  {
    id: '3',
    title: 'Event Recap',
    client: 'Oscorp',
    status: 'queue',
    shootDate: '2026-03-14',
    dueDate: '2026-03-25',
    revisionRound: 0,
    notes: 'Footage on Drive A.',
    tags: ['Event']
  }
];

// --- Components ---

// 1. Sortable Item (The Card)
function SortableJobCard({ job, onClick }: { job: Job; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: job.id, data: { type: 'Job', job } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none',
  };

  // Status color helpers
  const getRevisionColor = (round: number) => {
    if (round === 0) return 'bg-white/10 text-white/60';
    if (round === 1) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (round === 2) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (round >= 3) return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-white/10';
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-neutral-900 border border-white/10 p-4 rounded-xl shadow-lg cursor-grab active:cursor-grabbing hover:border-white/30 transition-colors group relative"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold tracking-widest uppercase opacity-50">{job.client}</span>
        {job.status === 'review' || job.status === 'editing' ? (
           <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${getRevisionColor(job.revisionRound)}`}>
             {job.revisionRound === 0 ? 'Rough Cut' : `V${job.revisionRound}`}
           </span>
        ) : null}
      </div>
      
      <h3 className="text-sm font-bold uppercase leading-tight mb-4 group-hover:text-accent transition-colors">{job.title}</h3>
      
      <div className="flex items-center gap-4 text-[10px] font-medium opacity-60">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>{new Date(job.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </div>
        {job.tags.length > 0 && (
          <div className="flex items-center gap-1">
             <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
             <span>{job.tags[0]}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// 2. Main Board
export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  
  const [activeId, setActiveId] = useState<string | null>(null); // For drag overlay
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  
  // Client Management State
  const [selectedClient, setSelectedClient] = useState<string | null>(null); // null = All Jobs
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');
  const [originalWorkspaceName, setOriginalWorkspaceName] = useState<string | null>(null); // Null if creating new

  // Load initial data
  useEffect(() => {
    // In a real app, load from DB or LocalStorage
    const savedJobs = localStorage.getItem('zipline_jobs');
    const savedWorkspaces = localStorage.getItem('zipline_workspaces');
    
    let loadedJobs = INITIAL_JOBS;
    if (savedJobs) {
        loadedJobs = JSON.parse(savedJobs);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJobs(loadedJobs);
    } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJobs(INITIAL_JOBS);
    }

    if (savedWorkspaces) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWorkspaces(JSON.parse(savedWorkspaces));
    } else {
        // Migration: Derive from jobs if no workspaces saved
        const derived = Array.from(new Set(loadedJobs.map(j => j.client).filter(Boolean))).sort();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWorkspaces(derived);
    }
  }, []);

  // Save on change
  useEffect(() => {
    if (jobs.length > 0) {
        localStorage.setItem('zipline_jobs', JSON.stringify(jobs));
    }
  }, [jobs]);

  useEffect(() => {
      if (workspaces.length > 0) {
        localStorage.setItem('zipline_workspaces', JSON.stringify(workspaces));
      }
  }, [workspaces]);

  const filteredJobs = useMemo(() => {
    if (!selectedClient) return jobs;
    return jobs.filter(j => j.client === selectedClient);
  }, [jobs, selectedClient]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- Actions ---

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeJob = jobs.find(j => j.id === activeId);
    const overJob = jobs.find(j => j.id === overId);
    
    if (!activeJob) return;

    // Case 1: Dragging over another Job
    if (overJob) {
        if (activeJob.status !== overJob.status) {
            setJobs(items => {
                const activeIndex = items.findIndex(j => j.id === activeId);
                const overIndex = items.findIndex(j => j.id === overId);
                
                if (items[activeIndex].status !== items[overIndex].status) {
                    const newItems = [...items];
                    const overColumnId = items[overIndex].status;
                    
                    // Logic for status change
                    let newRound = newItems[activeIndex].revisionRound;
                    if (overColumnId === 'review' && newItems[activeIndex].status === 'editing') {
                        newRound += 1;
                    }

                    newItems[activeIndex] = { 
                        ...newItems[activeIndex], 
                        status: overColumnId,
                        revisionRound: newRound
                    };
                    
                    // Simplify: Just update status, let DragEnd handle final sort if needed
                    // or let standard sortable context handle visual placement based on array order
                    return arrayMove(newItems, activeIndex, overIndex);
                }
                return items;
            });
        }
    } 
    // Case 2: Dragging over a Column (empty area)
    else {
        const overColumnId = overId as JobStatus;
        // Check if overId corresponds to a column
        if (COLUMNS.some(c => c.id === overColumnId)) {
            if (activeJob.status !== overColumnId) {
                setJobs(items => {
                    const activeIndex = items.findIndex(j => j.id === activeId);
                    const newItems = [...items];
                    
                    let newRound = newItems[activeIndex].revisionRound;
                    if (overColumnId === 'review' && newItems[activeIndex].status === 'editing') {
                        newRound += 1;
                    }

                    newItems[activeIndex] = { 
                        ...newItems[activeIndex], 
                        status: overColumnId,
                        revisionRound: newRound
                    };
                    
                    // Don't arrayMove here, just update status to move it to that column visually
                    return newItems;
                });
            }
        }
    }
  };

  const notifyDiscord = async (job: Job, newStatus: JobStatus) => {
      const statusLabels: Record<string, string> = {
          queue: 'Ingest',
          editing: 'In The Cut',
          review: 'Client Review',
          final: 'Final Polish',
          backup: 'Backup',
          done: 'Archive'
      };
      
      const message = `🚀 **Job Status Update**\n**${job.title}** moved to **${statusLabels[newStatus]}**`;
      
      try {
          await fetch('/api/integrations/discord', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  message,
                  embed: {
                      title: job.title,
                      description: `Client: ${job.client}\nRound: V${job.revisionRound}`,
                      color: 5763719 // Blue-ish
                  }
              })
          });
      } catch (e) {
          console.error('Webhook failed', e);
      }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeJobSnapshot = active.data.current?.job as Job | undefined;
    
    // Resolve final column/status
    let finalStatus: JobStatus | undefined;
    const overJob = jobs.find(j => j.id === overId);
    if (overJob) {
        finalStatus = overJob.status;
    } else {
        if (COLUMNS.some(c => c.id === overId)) {
            finalStatus = overId as JobStatus;
        }
    }

    if (activeJobSnapshot && finalStatus && activeJobSnapshot.status !== finalStatus) {
        if (finalStatus === 'review' || finalStatus === 'final' || finalStatus === 'editing') {
            // Trigger webhook on significant moves
            notifyDiscord(activeJobSnapshot, finalStatus);
        }
    }

    const activeJob = jobs.find(j => j.id === activeId);
    // const overJob = jobs.find(j => j.id === overId); // Redundant if we used finalStatus logic above but needed for arrayMove

    if (activeJob && overJob && activeJob.status === overJob.status) {
        // Reordering within same column
        const activeIndex = jobs.indexOf(activeJob);
        const overIndex = jobs.indexOf(overJob);
        setJobs(arrayMove(jobs, activeIndex, overIndex));
    }
  };

  const saveJob = (job: Job) => {
    if (jobs.find(j => j.id === job.id)) {
        setJobs(prev => prev.map(j => j.id === job.id ? job : j));
    } else {
        setJobs(prev => [...prev, job]);
    }
    setIsModalOpen(false);
    setEditingJob(null);
  };

  const deleteJob = (id: string) => {
      if (confirm('Delete this job?')) {
          setJobs(prev => prev.filter(j => j.id !== id));
          setIsModalOpen(false);
      }
  }

  const openNewJob = () => {
      setEditingJob({
          id: Math.random().toString(36).substr(2, 9),
          title: '',
          client: selectedClient || '',
          status: 'queue',
          shootDate: new Date().toISOString().split('T')[0],
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +7 days
          revisionRound: 0,
          notes: '',
          tags: []
      });
      setIsModalOpen(true);
  }

  const openEditJob = (job: Job) => {
      setEditingJob(job);
      setIsModalOpen(true);
  }

  const handleSaveWorkspace = () => {
    if (!editingWorkspaceName.trim()) return;
    
    if (originalWorkspaceName) {
        // Rename
        if (originalWorkspaceName !== editingWorkspaceName) {
            setWorkspaces(prev => prev.map(w => w === originalWorkspaceName ? editingWorkspaceName : w));
            setJobs(prev => prev.map(j => j.client === originalWorkspaceName ? { ...j, client: editingWorkspaceName } : j));
            if (selectedClient === originalWorkspaceName) setSelectedClient(editingWorkspaceName);
        }
    } else {
        // Create
        if (!workspaces.includes(editingWorkspaceName)) {
            setWorkspaces(prev => [...prev, editingWorkspaceName].sort());
            setSelectedClient(editingWorkspaceName);
        }
    }
    setIsWorkspaceModalOpen(false);
    setEditingWorkspaceName('');
    setOriginalWorkspaceName(null);
  };

  const handleDeleteWorkspace = () => {
      if (!originalWorkspaceName) return;
      
      const jobCount = jobs.filter(j => j.client === originalWorkspaceName).length;
      if (jobCount > 0) {
          if (!confirm(`This workspace contains ${jobCount} active jobs. Are you sure you want to delete it? The jobs will remain but will be unassigned.`)) {
              return;
          }
          // Unassign jobs (or we could delete them, but unassigning is safer)
          setJobs(prev => prev.map(j => j.client === originalWorkspaceName ? { ...j, client: 'Unassigned' } : j));
      }
      
      setWorkspaces(prev => prev.filter(w => w !== originalWorkspaceName));
      if (selectedClient === originalWorkspaceName) setSelectedClient(null);
      
      setIsWorkspaceModalOpen(false);
      setEditingWorkspaceName('');
      setOriginalWorkspaceName(null);
  };

  const openWorkspaceModal = (name?: string) => {
      setOriginalWorkspaceName(name || null);
      setEditingWorkspaceName(name || '');
      setIsWorkspaceModalOpen(true);
  }

  return (
    <div className="h-[calc(100vh-120px)] flex gap-6">
      {/* Sidebar - Client List */}
      <div className="w-64 shrink-0 flex flex-col gap-4">
        <div className="flex justify-between items-center mb-2">
           <h3 className="text-xs font-black uppercase tracking-widest opacity-50">Workspaces</h3>
           <button 
             onClick={() => openWorkspaceModal()}
             className="p-1.5 hover:bg-white/10 rounded-md transition-colors" 
             title="Add Workspace"
           >
             <UserPlus className="w-4 h-4" />
           </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto flex-1 custom-scrollbar pr-2">
            <button
                onClick={() => setSelectedClient(null)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 group ${
                    selectedClient === null 
                    ? 'bg-white text-black border-white' 
                    : 'bg-neutral-900 border-white/5 text-white/60 hover:text-white hover:bg-white/5'
                }`}
            >
                <Layout className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">All Jobs</span>
            </button>

            {workspaces.map(client => (
                <div 
                    key={client}
                    className={`group/item relative w-full rounded-lg border transition-all flex items-center ${
                        selectedClient === client 
                        ? 'bg-white border-white' 
                        : 'bg-neutral-900 border-white/5 hover:bg-white/5'
                    }`}
                >
                    <button
                        onClick={() => setSelectedClient(client)}
                        className={`flex-1 flex items-center gap-3 p-3 text-left min-w-0 ${selectedClient === client ? 'text-black' : 'text-white/60 group-hover/item:text-white'}`}
                    >
                        <Briefcase className="w-4 h-4 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-widest truncate">{client}</span>
                    </button>
                    
                    {/* Hover Actions */}
                    <div className={`absolute right-2 flex gap-1 ${selectedClient === client ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'} transition-opacity`}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); openWorkspaceModal(client); }}
                            className={`p-1.5 rounded-md transition-colors ${selectedClient === client ? 'hover:bg-black/10 text-black/50 hover:text-black' : 'hover:bg-white/20 text-white/40 hover:text-white'}`}
                        >
                            <Edit2 className="w-3 h-3" />
                        </button>
                    </div>
                    
                    {/* Badge (Hidden on hover if selected to show actions, or just pushed left) */}
                    <span className={`absolute right-3 pointer-events-none text-[9px] px-1.5 rounded-full ${selectedClient === client ? 'bg-black/10 opacity-0' : 'bg-white/10 group-hover/item:opacity-0'} transition-opacity`}>
                        {jobs.filter(j => j.client === client).length}
                    </span>
                </div>
            ))}
        </div>
      </div>

      {/* Main Board Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                    {selectedClient ? <Briefcase className="w-5 h-5" /> : <Layout className="w-5 h-5" />}
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter">
                        {selectedClient || 'Production Overview'}
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">
                        {filteredJobs.length} Active Jobs
                    </p>
                </div>
            </div>
            
            <button 
                onClick={openNewJob}
                className="bg-white text-black px-4 py-2 font-black uppercase text-[10px] tracking-widest hover:bg-accent hover:text-white transition-all rounded-lg flex items-center gap-2"
            >
                <Plus className="w-4 h-4" /> New Job
            </button>
        </div>

        {/* Board */}
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 h-full overflow-x-auto pb-4 custom-scrollbar">
            {COLUMNS.map(col => (
                <div key={col.id} className="flex-shrink-0 w-80 flex flex-col bg-neutral-900/50 rounded-2xl border border-white/5 h-full">
                {/* Column Header */}
                <div className={`p-4 border-b ${col.color} border-opacity-20 flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white/5 ${col.color.replace('border', 'text')}`}>
                            {col.icon}
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest">{col.title}</h3>
                    </div>
                    <span className="text-[10px] font-bold opacity-40 bg-white/10 px-2 py-0.5 rounded">
                        {filteredJobs.filter(j => j.status === col.id).length}
                    </span>
                </div>

                {/* Droppable Area */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar relative">
                    <SortableContext 
                        items={filteredJobs.filter(j => j.status === col.id).map(j => j.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div ref={(node) => {
                            // We use a Droppable generic container trick if sorting items directly is tricky, 
                            // but SortableContext handles the items. 
                            // We also need to make the *column itself* droppable for empty columns.
                            // dnd-kit SortableContext handles the items, but if empty, we need a target.
                        }} id={col.id} className="min-h-[100px]">
                            {filteredJobs.filter(j => j.status === col.id).map(job => (
                                <SortableJobCard key={job.id} job={job} onClick={() => openEditJob(job)} />
                            ))}
                        </div>
                    </SortableContext>
                    {/* We create a droppable zone for the column ID to catch drops when empty */}
                    <ColumnDroppable id={col.id} />
                </div>
                </div>
            ))}
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
            {activeId ? (
                <div className="bg-neutral-800 border border-white/20 p-4 rounded-xl shadow-2xl opacity-90 rotate-3 cursor-grabbing w-80">
                    {(() => {
                        const job = jobs.find(j => j.id === activeId);
                        if (!job) return null;
                        return (
                            <>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold tracking-widest uppercase opacity-50">{job.client}</span>
                                </div>
                                <h3 className="text-sm font-bold uppercase leading-tight mb-4">{job.title}</h3>
                            </>
                        )
                    })()}
                </div>
            ) : null}
            </DragOverlay>
        </DndContext>
      </div>

      {/* Edit/New Modal */}
      <AnimatePresence>
        {isModalOpen && editingJob && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setIsModalOpen(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-neutral-900 border border-white/10 w-full max-w-lg p-8 rounded-2xl shadow-2xl"
                >
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black uppercase tracking-tighter">Job Details</h2>
                        <div className="flex gap-2">
                            {jobs.find(j => j.id === editingJob.id) && (
                                <button onClick={() => deleteJob(editingJob.id)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Title</label>
                            <input 
                                className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-sm font-bold rounded-lg"
                                value={editingJob.title}
                                onChange={e => setEditingJob({...editingJob, title: e.target.value})}
                                placeholder="PROJECT NAME"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Client</label>
                                {/* Replaced simple input with select/datalist for convenience, but kept text input for flexibility */}
                                <input 
                                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-xs font-bold rounded-lg"
                                    value={editingJob.client}
                                    onChange={e => setEditingJob({...editingJob, client: e.target.value})}
                                    placeholder="CLIENT NAME"
                                    list="workspace-list"
                                />
                                <datalist id="workspace-list">
                                    {workspaces.map(w => <option key={w} value={w} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Status</label>
                                <select 
                                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-xs font-bold rounded-lg appearance-none"
                                    value={editingJob.status}
                                    onChange={e => setEditingJob({...editingJob, status: e.target.value as JobStatus})}
                                >
                                    {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Shoot Date</label>
                                <input 
                                    type="date"
                                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-xs font-bold rounded-lg"
                                    value={editingJob.shootDate}
                                    onChange={e => setEditingJob({...editingJob, shootDate: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Due Date</label>
                                <input 
                                    type="date"
                                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-xs font-bold rounded-lg"
                                    value={editingJob.dueDate}
                                    onChange={e => setEditingJob({...editingJob, dueDate: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Revision Round</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingJob(p => p ? ({...p, revisionRound: Math.max(0, p.revisionRound - 1)}) : null)} className="p-1 hover:bg-white/10 rounded"><Minus className="w-3 h-3" /></button>
                                    <span className="text-xs font-black w-4 text-center">{editingJob.revisionRound}</span>
                                    <button onClick={() => setEditingJob(p => p ? ({...p, revisionRound: p.revisionRound + 1}) : null)} className="p-1 hover:bg-white/10 rounded"><Plus className="w-3 h-3" /></button>
                                </div>
                            </div>
                            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all ${editingJob.revisionRound === 0 ? 'bg-white/20' : editingJob.revisionRound === 1 ? 'bg-blue-500' : editingJob.revisionRound === 2 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, (editingJob.revisionRound + 1) * 20)}%` }}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Notes</label>
                            <textarea 
                                rows={3}
                                className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-xs font-bold rounded-lg resize-none"
                                value={editingJob.notes}
                                onChange={e => setEditingJob({...editingJob, notes: e.target.value})}
                                placeholder="LINKS, PASSWORDS, ETC..."
                            />
                        </div>

                        <div className="pt-4 border-t border-white/5 space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest opacity-50">Integrations</h3>
                            
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1 flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Discord Channel</label>
                                <div className="flex gap-2">
                                    <input 
                                        className="flex-1 bg-black/50 border border-white/10 p-3 outline-none focus:border-accent text-xs rounded-lg"
                                        value={editingJob.discordUrl || ''}
                                        onChange={e => setEditingJob({...editingJob, discordUrl: e.target.value})}
                                        placeholder="https://discord.com/channels/..."
                                    />
                                    {editingJob.discordUrl && (
                                        <a href={editingJob.discordUrl} target="_blank" rel="noreferrer" className="p-3 bg-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-colors">
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1 flex items-center gap-2"><Video className="w-3 h-3" /> Frame.io / Vimeo Review</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        className="bg-black/50 border border-white/10 p-3 outline-none focus:border-accent text-xs rounded-lg"
                                        value={editingJob.reviewLink || ''}
                                        onChange={e => setEditingJob({...editingJob, reviewLink: e.target.value})}
                                        placeholder="Review URL"
                                    />
                                    <input 
                                        className="bg-black/50 border border-white/10 p-3 outline-none focus:border-accent text-xs rounded-lg"
                                        value={editingJob.reviewPassword || ''}
                                        onChange={e => setEditingJob({...editingJob, reviewPassword: e.target.value})}
                                        placeholder="Password (Optional)"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1 flex items-center gap-2"><HardDrive className="w-3 h-3" /> Google Drive</label>
                                <input 
                                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent text-xs rounded-lg"
                                    value={editingJob.driveUrl || ''}
                                    onChange={e => setEditingJob({...editingJob, driveUrl: e.target.value})}
                                    placeholder="Folder URL"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={() => saveJob(editingJob!)}
                            className="w-full bg-white text-black py-4 mt-4 font-black tracking-widest uppercase text-xs hover:bg-accent hover:text-white transition-all rounded-xl"
                        >
                            Save Job
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>

      {/* Manage Workspace Modal */}
      <AnimatePresence>
        {isWorkspaceModalOpen && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => setIsWorkspaceModalOpen(false)}
                    className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                />
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-neutral-900 border border-white/10 w-full max-w-sm p-6 rounded-2xl shadow-2xl"
                >
                    <h2 className="text-xl font-black uppercase tracking-tighter mb-4">{originalWorkspaceName ? 'Edit Workspace' : 'New Workspace'}</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Workspace Name</label>
                            <input 
                                autoFocus
                                value={editingWorkspaceName}
                                onChange={e => setEditingWorkspaceName(e.target.value)}
                                placeholder="CLIENT / PROJECT NAME"
                                className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-sm font-bold rounded-lg"
                                onKeyDown={e => e.key === 'Enter' && handleSaveWorkspace()}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between mt-6">
                        <div>
                            {originalWorkspaceName && (
                                <button 
                                    onClick={handleDeleteWorkspace}
                                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                    title="Delete Workspace"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsWorkspaceModalOpen(false)} className="px-4 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase hover:bg-white/10">Cancel</button>
                            <button onClick={handleSaveWorkspace} className="px-6 py-2 bg-white text-black rounded-lg text-[10px] font-black tracking-widest uppercase hover:bg-accent hover:text-white transition-colors">
                                {originalWorkspaceName ? 'Save' : 'Create'}
                            </button>
                        </div>
                    </div>
                </motion.div>
             </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper for empty columns
function ColumnDroppable({ id }: { id: string }) {
    const { setNodeRef } = useDroppable({ id, data: { type: 'Column' } });
    return <div ref={setNodeRef} className="absolute inset-0 -z-10" />
}