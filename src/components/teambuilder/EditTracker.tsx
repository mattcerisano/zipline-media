'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Job, Contact } from '@/components/gearbuilder/types';
import { 
  Film, 
  Scissors, 
  PlayCircle, 
  MessageSquareWarning, 
  CheckCircle2, 
  Archive,
  User,
  MoreVertical,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EDIT_STAGES = [
  { id: 'Filmed', label: 'Filmed / Raw', icon: Film, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  { id: 'WIP', label: 'Work in Progress', icon: Scissors, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
  { id: 'V1', label: 'V1 / Review', icon: PlayCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
  { id: 'Revisions', label: 'Revisions', icon: MessageSquareWarning, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  { id: 'Delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  { id: 'Wrapped', label: 'Wrapped', icon: Archive, color: 'text-neutral-400', bg: 'bg-neutral-400/10', border: 'border-neutral-400/20' }
] as const;

export default function EditTracker() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const updateJobEditStatus = async (jobId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ edit_status: newStatus })
        .eq('id', jobId);

      if (error) throw error;
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, edit_status: newStatus as any } : j));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const updateJobEditor = async (jobId: string, editorId: string) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ editor_id: editorId || null })
        .eq('id', jobId);

      if (error) throw error;
      
      const selectedEditor = contacts.find(c => c.id === editorId);
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, editor_id: editorId, editor: selectedEditor } : j));
    } catch (err) {
      console.error('Error updating editor:', err);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-neutral-900/40 p-6 rounded-2xl border border-white/10">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tighter text-white">Post-Production Pipeline</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-white mt-1">Track edits, revisions, and deliveries</p>
        </div>
        <div className="flex gap-2">
          {/* Quick stats could go here */}
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5">
             <p className="text-[8px] font-black uppercase tracking-widest opacity-40 text-white">Active Edits</p>
             <p className="text-sm font-black text-white">{jobs.filter(j => j.edit_status !== 'Wrapped').length}</p>
          </div>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-6 pb-8 custom-scrollbar snap-x">
        {EDIT_STAGES.map(stage => {
          const stageJobs = jobs.filter(j => (j.edit_status || 'Filmed') === stage.id);
          
          return (
            <div key={stage.id} className="flex-none w-80 flex flex-col snap-start">
              <div className={`flex items-center justify-between p-3 rounded-t-2xl border-t border-x ${stage.border} ${stage.bg}`}>
                <div className="flex items-center gap-2">
                  <stage.icon className={`w-4 h-4 ${stage.color}`} />
                  <h3 className={`text-xs font-black uppercase tracking-widest ${stage.color}`}>{stage.label}</h3>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full bg-black/20 ${stage.color}`}>
                  {stageJobs.length}
                </span>
              </div>
              
              <div className={`flex-1 min-h-[500px] p-3 space-y-3 bg-neutral-900/20 border-x border-b rounded-b-2xl ${stage.border}`}>
                <AnimatePresence>
                  {stageJobs.map(job => (
                    <EditCard 
                      key={job.id} 
                      job={job} 
                      contacts={contacts}
                      stages={EDIT_STAGES}
                      onUpdateStatus={(status) => updateJobEditStatus(job.id, status)}
                      onUpdateEditor={(editorId) => updateJobEditor(job.id, editorId)}
                    />
                  ))}
                  {stageJobs.length === 0 && (
                    <div className="h-24 flex items-center justify-center border border-dashed border-white/5 rounded-xl opacity-20">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white">Empty</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditCard({ 
  job, 
  contacts,
  stages,
  onUpdateStatus, 
  onUpdateEditor 
}: { 
  job: Job, 
  contacts: Contact[],
  stages: typeof EDIT_STAGES,
  onUpdateStatus: (status: string) => void,
  onUpdateEditor: (editorId: string) => void
}) {
  const shootDate = job.shoot_date ? new Date(job.shoot_date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  }) : 'TBD';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-neutral-900 border border-white/10 p-4 rounded-xl shadow-xl group hover:border-accent/30 transition-all relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-black uppercase tracking-tight leading-tight text-white pr-4">{job.title}</h4>
        
        {/* Status Quick-Move Dropdown */}
        <div className="relative group/dropdown">
          <button className="p-1 hover:bg-white/10 rounded transition-colors text-white/40 group-hover:text-white">
            <MoreVertical className="w-3 h-3" />
          </button>
          <div className="absolute right-0 top-full mt-1 w-40 bg-black border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all z-50 overflow-hidden">
            <div className="p-2 border-b border-white/5">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">Move to...</p>
            </div>
            <div className="p-1 max-h-48 overflow-y-auto">
              {stages.map(s => (
                <button
                  key={s.id}
                  onClick={() => onUpdateStatus(s.id)}
                  disabled={job.edit_status === s.id || (!job.edit_status && s.id === 'Filmed')}
                  className="w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors disabled:opacity-20 disabled:hover:bg-transparent"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-white mb-4 line-clamp-1">
        {job.client_name || job.production_company || 'Internal'}
      </p>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-[9px] font-bold text-white/40 bg-white/5 p-2 rounded-lg">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            <span className="uppercase tracking-widest">Shoot: {shootDate}</span>
          </div>
          {job.review_link && (
            <a href={job.review_link} target="_blank" className="flex items-center gap-1 text-accent hover:text-white transition-colors">
              Review <ExternalLink className="w-2 h-2" />
            </a>
          )}
        </div>

        {/* Editor Assignment */}
        <div className="relative">
          <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <select
            value={job.editor_id || ''}
            onChange={(e) => onUpdateEditor(e.target.value)}
            className={`w-full bg-black/50 border border-white/5 py-2 pl-8 pr-3 outline-none focus:border-accent transition-colors uppercase text-[9px] font-black tracking-widest rounded-lg cursor-pointer appearance-none ${!job.editor_id ? 'text-accent' : 'text-white'}`}
          >
            <option value="">+ ASSIGN EDITOR</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );
}
