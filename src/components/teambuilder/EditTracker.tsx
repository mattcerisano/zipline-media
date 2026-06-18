'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Contact, EditLabel, JobLink } from '@/components/gearbuilder/types';
import { 
  Film, 
  Scissors, 
  PlayCircle, 
  MessageSquareWarning, 
  CheckCircle2, 
  Archive,
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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const EDIT_STAGES = [
  { id: 'Filmed', label: 'Filmed / Raw', icon: Film, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  { id: 'WIP', label: 'Work in Progress', icon: Scissors, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  { id: 'V1', label: 'V1 / Review', icon: PlayCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  { id: 'Revisions', label: 'Revisions', icon: MessageSquareWarning, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  { id: 'Delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  { id: 'Wrapped', label: 'Wrapped', icon: Archive, color: 'text-neutral-400', bg: 'bg-neutral-400/10', border: 'border-neutral-400/20' }
] as const;

const AVAILABLE_LABEL_COLORS = [
  { id: 'red', class: 'bg-red-500' },
  { id: 'orange', class: 'bg-orange-500' },
  { id: 'yellow', class: 'bg-yellow-500' },
  { id: 'green', class: 'bg-green-500' },
  { id: 'blue', class: 'bg-blue-500' },
  { id: 'purple', class: 'bg-purple-500' },
  { id: 'pink', class: 'bg-pink-500' },
];

export default function EditTracker() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter States
  const [clientFilter, setClientFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');

  // Modal State
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, contactsRes] = await Promise.all([
        supabase.from('jobs').select('*, editor:contacts(*)').order('shoot_date', { ascending: false }),
        supabase.from('contacts').select('*').order('name')
      ]);

      if (jobsRes.error) throw jobsRes.error;
      if (contactsRes.error) throw contactsRes.error;

      // Filter out jobs that are completely dead/cancelled from the tracker
      const activeJobs = (jobsRes.data as Job[]).filter(j => j.job_status !== 'Cancelled');
      setJobs(activeJobs);
      setContacts(contactsRes.data as Contact[]);
    } catch (err) {
      console.error('Error fetching edit tracker data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const uniqueClients = useMemo(() => {
    const clientsList = jobs.map(j => j.client_name || j.production_company).filter(Boolean);
    return Array.from(new Set(clientsList)).sort();
  }, [jobs]);

  const uniqueYears = useMemo(() => {
    const years = jobs.map(j => j.shoot_date ? j.shoot_date.substring(0, 4) : null).filter(Boolean);
    return Array.from(new Set(years)).sort((a, b) => (b as string).localeCompare(a as string));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      const matchClient = clientFilter === 'All' || (j.client_name === clientFilter || j.production_company === clientFilter);
      const matchYear = yearFilter === 'All' || (j.shoot_date && j.shoot_date.startsWith(yearFilter));
      return matchClient && matchYear;
    });
  }, [jobs, clientFilter, yearFilter]);

  const updateJobEditStatus = async (jobId: string, newStatus: string) => {
    const job = jobs.find(j => j.id === jobId);
    const oldStatus = job?.edit_status || 'Filmed';

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
          alert('Failed to create new card.');
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
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-neutral-900/40 p-6 rounded-2xl border border-white/10 shrink-0 gap-4">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tighter text-white">Post-Production Pipeline</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-white mt-1">Trello-style Edit Tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <select 
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="bg-black/50 border border-white/10 px-4 py-2 outline-none focus:border-accent transition-colors uppercase text-[10px] font-black tracking-widest rounded-xl cursor-pointer appearance-none text-white min-w-[120px]"
            >
              <option value="All">All Clients</option>
              {uniqueClients.map(c => <option key={c as string} value={c as string}>{c}</option>)}
            </select>
            <select 
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="bg-black/50 border border-white/10 px-4 py-2 outline-none focus:border-accent transition-colors uppercase text-[10px] font-black tracking-widest rounded-xl cursor-pointer appearance-none text-white"
            >
              <option value="All">All Years</option>
              {uniqueYears.map(y => <option key={y as string} value={y as string}>{y}</option>)}
            </select>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 hidden md:block">
             <p className="text-[8px] font-black uppercase tracking-widest opacity-40 text-white">Active Edits</p>
             <p className="text-sm font-black text-white">{filteredJobs.filter(j => j.edit_status !== 'Wrapped').length}</p>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex overflow-x-auto gap-4 pb-8 custom-scrollbar items-start flex-1">
          {EDIT_STAGES.map(stage => {
            const stageJobs = filteredJobs.filter(j => (j.edit_status || 'Filmed') === stage.id);
            
            return (
              <div key={stage.id} className="flex-none w-[300px] flex flex-col bg-neutral-900/80 rounded-xl border border-white/5 max-h-full">
                <div className={`flex items-center justify-between p-3 rounded-t-xl border-t-2 ${stage.border.replace('border-', 'border-t-')}`}>
                  <div className="flex items-center gap-2">
                    <stage.icon className={`w-4 h-4 ${stage.color}`} />
                    <h3 className="text-xs font-black uppercase tracking-widest text-white">{stage.label}</h3>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/5 text-white/40">
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
                        <Draggable key={job.id} draggableId={job.id} index={index}>
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
                      {stage.id === 'Filmed' && (
                        <button 
                          onClick={() => openNewCardModal('Filmed')}
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
            stages={EDIT_STAGES}
            isCreatingNew={isCreatingNew}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ----------------------------------------------------------------------
// COMPONENT: CardFront (The compact Trello-style card on the board)
// ----------------------------------------------------------------------
function CardFront({ job, isDragging }: { job: Job, isDragging: boolean }) {
  const hasNotes = !!job.edit_notes?.trim();
  const linkCount = (job.links?.length || 0) + (job.review_link ? 1 : 0) + (job.discord_url ? 1 : 0) + (job.drive_folder_url ? 1 : 0);
  
  // Format dates for badges
  const isOverdue = job.due_date && new Date(job.due_date) < new Date() && job.edit_status !== 'Delivered' && job.edit_status !== 'Wrapped';
  const displayDate = job.due_date ? new Date(job.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;

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
// COMPONENT: CardDetailModal (The "Card Back")
// ----------------------------------------------------------------------
function CardDetailModal({ 
  job, 
  contacts, 
  onClose,
  onUpdate,
  stages,
  isCreatingNew
}: { 
  job: Job, 
  contacts: Contact[], 
  onClose: () => void,
  onUpdate: (job: Job) => void,
  stages: typeof EDIT_STAGES,
  isCreatingNew?: boolean
}) {
  const [title, setTitle] = useState(job.title);
  const [notes, setNotes] = useState(job.edit_notes || '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');

  const currentStage = stages.find(s => s.id === (job.edit_status || 'Filmed'));

  const saveTitle = () => {
    if (title.trim() && title !== job.title) {
      onUpdate({ ...job, title: title.trim() });
    }
  };

  const saveNotes = () => {
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
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 pb-10 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl relative min-h-[600px] flex flex-col"
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
              className="w-full bg-transparent text-xl font-bold text-white outline-none border-2 border-transparent focus:border-accent focus:bg-black/20 rounded px-2 py-1 -ml-2"
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
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Editor</h4>
                  <div className="flex items-center gap-2">
                    {job.editor && (
                      <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-black" title={job.editor.name}>
                        {job.editor.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                      </div>
                    )}
                    <select
                      value={job.editor_id || ''}
                      onChange={(e) => updateEditor(e.target.value)}
                      className="bg-white/5 border border-white/10 py-1.5 px-3 rounded-lg text-xs font-bold text-white outline-none focus:border-accent appearance-none"
                    >
                      <option value="">Unassigned</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Labels */}
              {job.edit_labels && job.edit_labels.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Labels</h4>
                  <div className="flex flex-wrap gap-2">
                    {job.edit_labels.map(l => (
                      <span 
                        key={l.id} 
                        onClick={() => removeLabel(l.id)}
                        className={`px-3 py-1.5 rounded text-[10px] font-bold text-white cursor-pointer hover:opacity-80 transition-opacity ${l.color}`}
                        title="Click to remove"
                      >
                        {l.text}
                      </span>
                    ))}
                    <button 
                      onClick={() => setShowLabelMenu(!showLabelMenu)}
                      className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {/* Due Date */}
              {job.due_date && (
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Due Date</h4>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 py-1.5 px-3 rounded text-xs font-bold text-white">
                    <input 
                      type="date"
                      value={job.due_date}
                      onChange={(e) => updateDueDate(e.target.value)}
                      className="bg-transparent outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
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
                  {job.edit_notes && !isEditingNotes && (
                    <button onClick={() => setIsEditingNotes(true)} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium text-white transition-colors">Edit</button>
                  )}
                </div>
                
                {isEditingNotes || !job.edit_notes ? (
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

            {/* Attachments / Links */}
            <div className="flex gap-4">
              <Paperclip className="w-6 h-6 text-white/40 shrink-0" />
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-4">Project Links & Vault</h3>
                <div className="space-y-3">
                  {job.review_link && (
                    <a href={job.review_link} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg group transition-colors">
                       <div className="w-10 h-10 bg-black/40 rounded flex items-center justify-center"><Eye className="w-5 h-5 text-accent" /></div>
                       <div>
                         <p className="text-sm font-bold text-white">Review Link (Frame.io/Vimeo)</p>
                         <p className="text-xs text-white/40 truncate max-w-sm group-hover:underline">{job.review_link}</p>
                       </div>
                    </a>
                  )}
                  {job.discord_url && (
                    <a href={job.discord_url} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg group transition-colors">
                       <div className="w-10 h-10 bg-black/40 rounded flex items-center justify-center"><MessageSquare className="w-5 h-5 text-purple-400" /></div>
                       <div>
                         <p className="text-sm font-bold text-white">Discord Channel</p>
                         <p className="text-xs text-white/40 truncate max-w-sm group-hover:underline">{job.discord_url}</p>
                       </div>
                    </a>
                  )}
                  {job.drive_folder_url && (
                    <a href={job.drive_folder_url} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg group transition-colors">
                       <div className="w-10 h-10 bg-black/40 rounded flex items-center justify-center"><FolderOpen className="w-5 h-5 text-yellow-500" /></div>
                       <div>
                         <p className="text-sm font-bold text-white">Project Drive Folder</p>
                         <p className="text-xs text-white/40 truncate max-w-sm group-hover:underline">{job.drive_folder_url}</p>
                       </div>
                    </a>
                  )}
                  {job.links?.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg group transition-colors">
                       <div className="w-10 h-10 bg-black/40 rounded flex items-center justify-center"><ExternalLink className="w-5 h-5 text-white/40" /></div>
                       <div>
                         <p className="text-sm font-bold text-white">{link.label}</p>
                         <p className="text-xs text-white/40 truncate max-w-sm group-hover:underline">{link.url}</p>
                       </div>
                    </a>
                  ))}
                  {!job.review_link && !job.discord_url && !job.drive_folder_url && (!job.links || job.links.length === 0) && (
                    <p className="text-sm text-white/40 italic">No links attached to this project.</p>
                  )}
                </div>
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

             <div className="space-y-2">
               <h4 className="text-xs font-bold text-white/60 mb-2">Actions</h4>
               {/* Quick movement buttons could go here */}
               <button onClick={() => onUpdate({ ...job, job_status: 'Cancelled' })} className="w-full flex items-center gap-2 bg-white/10 hover:bg-red-500/20 hover:text-red-500 text-white p-2 rounded transition-colors text-sm font-medium">
                 <Archive className="w-4 h-4" /> Cancel Job
               </button>
             </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
