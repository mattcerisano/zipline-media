'use client';

import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors, 
  DragOverlay,
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
  X
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
  const [activeId, setActiveId] = useState<string | null>(null); // For drag overlay
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Load initial data
  useEffect(() => {
    // In a real app, load from DB or LocalStorage
    const saved = localStorage.getItem('zipline_jobs');
    if (saved) {
        setJobs(JSON.parse(saved));
    } else {
        setJobs(INITIAL_JOBS);
    }
  }, []);

  // Save on change
  useEffect(() => {
    if (jobs.length > 0) {
        localStorage.setItem('zipline_jobs', JSON.stringify(jobs));
    }
  }, [jobs]);

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

    const activeId = active.id;
    const overId = over.id;

    // Find containers
    const activeJob = jobs.find(j => j.id === activeId);
    const overJob = jobs.find(j => j.id === overId);
    
    if (!activeJob) return;

    // If dragging over a column (not a job)
    if (!overJob) {
        // Check if over is a column ID
        const overColumnId = over.id as JobStatus;
        if (COLUMNS.find(c => c.id === overColumnId)) {
            if (activeJob.status !== overColumnId) {
                setJobs(items => {
                    return items.map(j => {
                        if (j.id === activeId) {
                            // Auto-increment revision if moving to Review
                            let newRound = j.revisionRound;
                            if (overColumnId === 'review' && j.status === 'editing') {
                                newRound += 1;
                            }
                            return { ...j, status: overColumnId, revisionRound: newRound };
                        }
                        return j;
                    });
                });
            }
        }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeJob = jobs.find(j => j.id === activeId);
    const overJob = jobs.find(j => j.id === overId);

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
          client: '',
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

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black uppercase tracking-tighter">Production Tracker</h2>
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
        collisionDetection={closestCorners}
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
                    {jobs.filter(j => j.status === col.id).length}
                </span>
              </div>

              {/* Droppable Area */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                <SortableContext 
                    items={jobs.filter(j => j.status === col.id).map(j => j.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div ref={(node) => {
                        // We use a Droppable generic container trick if sorting items directly is tricky, 
                        // but SortableContext handles the items. 
                        // We also need to make the *column itself* droppable for empty columns.
                        // dnd-kit SortableContext handles the items, but if empty, we need a target.
                    }} id={col.id} className="min-h-[100px]">
                        {jobs.filter(j => j.status === col.id).map(job => (
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
                                <input 
                                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent uppercase text-xs font-bold rounded-lg"
                                    value={editingJob.client}
                                    onChange={e => setEditingJob({...editingJob, client: e.target.value})}
                                    placeholder="CLIENT NAME"
                                />
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
    </div>
  );
}

// Helper for empty columns
function ColumnDroppable({ id }: { id: string }) {
    const { setNodeRef } = useSortable({ id, data: { type: 'Column' } });
    return <div ref={setNodeRef} className="absolute inset-0 -z-10" />
}