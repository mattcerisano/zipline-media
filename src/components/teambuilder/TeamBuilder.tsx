'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Save, 
  Search, 
  Phone, 
  Mail, 
  Briefcase,
  ChevronDown,
  Plus,
  Check,
  X,
  AlertCircle,
  FileDown,
  Clock,
  Calendar,
  DollarSign,
  ClipboardList,
  LayoutTemplate,
  ChevronRight,
  ChevronUp,
  MapPin,
  AlignLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import { caps } from '@/lib/format';
import { formatLocalDate } from '@/lib/date';
import { Contact, Job, JobRole, DEPARTMENTS, JobTemplate, JobSchedule, JobTodo } from '@/components/gearbuilder/types';

// Helper function to sort schedule items chronologically
const sortSchedules = (schedules: JobSchedule[]) => {
  return [...schedules].sort((a, b) => {
    const timeA = a.start_time || '';
    const timeB = b.start_time || '';
    
    // TBD (empty string) goes to the bottom
    if (!timeA && timeB) return 1;
    if (timeA && !timeB) return -1;
    if (!timeA && !timeB) return a.sort_order - b.sort_order;
    
    const timeCompare = timeA.localeCompare(timeB);
    if (timeCompare !== 0) return timeCompare;
    return a.sort_order - b.sort_order;
  });
};

export default function TeamBuilder({ predefinedJobId, onClose }: { predefinedJobId?: string, onClose?: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(predefinedJobId || '');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [jobSchedules, setJobSchedules] = useState<JobSchedule[]>([]);
  const [jobTodos, setJobTodos] = useState<JobTodo[]>([]);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  
  const [activeTab, setActiveTab] = useState<'crew' | 'schedule' | 'preprod'>('crew');

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [jobsRes, contactsRes, templatesRes] = await Promise.all([
          supabase.from('jobs').select('*').order('shoot_date', { ascending: false }),
          supabase.from('contacts').select('*').order('name'),
          supabase.from('job_templates').select('*').order('name')
        ]);

        if (jobsRes.error) throw jobsRes.error;
        if (contactsRes.error) throw contactsRes.error;
        if (templatesRes.error) {
           console.warn('Job templates table might not exist yet:', templatesRes.error);
        }

        setJobs(jobsRes.data as Job[]);
        setContacts(contactsRes.data as Contact[]);
        setTemplates((templatesRes.data || []) as JobTemplate[]);

        // Auto-select latest job if none selected and no predefined ID
        if (jobsRes.data && jobsRes.data.length > 0 && !selectedJobId && !predefinedJobId) {
          setSelectedJobId(jobsRes.data[0].id);
        }
      } catch (err) {
        console.error('Error fetching Team Builder data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch roles, schedules, and todos when job changes
  useEffect(() => {
    if (!selectedJobId) return;

    const fetchJobData = async () => {
      try {
        const [rolesRes, schedulesRes, todosRes] = await Promise.all([
          supabase.from('job_roles').select('*, contact:contacts(*)').eq('job_id', selectedJobId).order('sort_order', { ascending: true, nullsFirst: false }),
          supabase.from('job_schedules').select('*').eq('job_id', selectedJobId).order('sort_order', { ascending: true }),
          supabase.from('job_todos').select('*').eq('job_id', selectedJobId).order('sort_order', { ascending: true })
        ]);

        if (rolesRes.error) throw rolesRes.error;
        if (schedulesRes.error) throw schedulesRes.error;
        if (todosRes.error) {
          console.warn('job_todos table might not be initialized or synced yet:', todosRes.error);
        }

        setJobRoles(rolesRes.data as JobRole[]);
        setJobSchedules(sortSchedules(schedulesRes.data as JobSchedule[]));
        setJobTodos((todosRes.data || []) as JobTodo[]);
      } catch (err) {
        console.error('Error fetching job details:', err);
      }
    };

    fetchJobData();
  }, [selectedJobId]);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);

  const addRole = () => {
    const maxSortOrder = jobRoles.reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1);
    const newRole: Partial<JobRole> = {
      job_id: selectedJobId,
      position: 'New Position',
      department: 'Production',
      sort_order: maxSortOrder + 1,
    };
    handleSaveRole(newRole as JobRole);
  };

  // Move a crew member up/down the manifest. The on-screen order is the order
  // used by the Call Sheet and Master Brief exports, so persist the whole
  // sequence (index = sort_order) after the swap.
  const moveRole = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= jobRoles.length) return;
    const next = [...jobRoles];
    [next[index], next[target]] = [next[target], next[index]];
    const renumbered = next.map((r, i) => ({ ...r, sort_order: i }));
    setJobRoles(renumbered);
    try {
      await Promise.all(
        renumbered.map(r =>
          supabase.from('job_roles').update({ sort_order: r.sort_order }).eq('id', r.id)
        )
      );
    } catch (err) {
      console.error('Error saving crew order:', err);
      alert('Failed to save the new crew order. If this persists, the sort_order migration may not have been applied.');
    }
  };

  const addScheduleItem = () => {
    let defaultStart = '';
    if (jobSchedules.length > 0) {
      const sorted = sortSchedules(jobSchedules);
      const lastItem = sorted[sorted.length - 1];
      if (lastItem) {
        if (lastItem.end_time) {
          defaultStart = lastItem.end_time;
        } else if (lastItem.start_time) {
          defaultStart = lastItem.start_time;
        } else {
          defaultStart = '';
        }
      }
    } else {
      defaultStart = '09:00';
    }

    const maxSortOrder = jobSchedules.reduce((max, s) => Math.max(max, s.sort_order), -1);

    const newSchedule: Partial<JobSchedule> = {
      job_id: selectedJobId,
      start_time: defaultStart,
      task: 'New Task',
      sort_order: maxSortOrder + 1
    };
    handleSaveSchedule(newSchedule as JobSchedule);
  };

  const addTodoItem = () => {
    const maxSortOrder = jobTodos.reduce((max, t) => Math.max(max, t.sort_order), -1);
    const newTodo: Partial<JobTodo> = {
      job_id: selectedJobId,
      task: 'New Prep Task',
      completed: false,
      sort_order: maxSortOrder + 1
    };
    handleSaveTodo(newTodo as JobTodo);
  };

  const handleSaveSchedule = async (schedule: JobSchedule) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('job_schedules')
        .upsert(schedule)
        .select()
        .single();

      if (error) throw error;
      
      setJobSchedules(prev => {
        const exists = prev.find(s => s.id === data.id);
        const next = exists 
          ? prev.map(s => s.id === data.id ? data : s)
          : [...prev, data];
        return sortSchedules(next);
      });
    } catch (err: any) {
      console.error('Error saving schedule:', err);
      const errMsg = err?.message || JSON.stringify(err) || 'Unknown error';
      if (errMsg.includes('notes') || errMsg.includes('column') || errMsg.includes('schema cache')) {
        alert('Database schema update required. Please run the SQL commands in database_updates.sql in your Supabase dashboard.');
      } else {
        alert(`Failed to save schedule: ${errMsg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm('Remove this schedule item?')) return;
    try {
      const { error } = await supabase.from('job_schedules').delete().eq('id', scheduleId);
      if (error) throw error;
      setJobSchedules(prev => prev.filter(s => s.id !== scheduleId));
    } catch (err) {
      console.error('Error deleting schedule:', err);
    }
  };

  const applyTemplate = async (template: JobTemplate) => {
    if (!selectedJobId) return;
    setIsSaving(true);
    
    try {
      const baseSortOrder = jobRoles.reduce((max, r) => Math.max(max, r.sort_order ?? -1), -1) + 1;
      const rolesToInsert = template.roles.map((r, i) => ({
        job_id: selectedJobId,
        position: r.position,
        department: r.department,
        day_rate: r.day_rate,
        sort_order: baseSortOrder + i
      }));

      const { error } = await supabase
        .from('job_roles')
        .insert(rolesToInsert);

      if (error) throw error;

      // Refresh roles
      const { data: newRoles, error: fetchError } = await supabase
        .from('job_roles')
        .select('*, contact:contacts(*)')
        .eq('job_id', selectedJobId)
        .order('sort_order', { ascending: true, nullsFirst: false });
      
      if (fetchError) throw fetchError;
      setJobRoles(newRoles as JobRole[]);
      setIsTemplateModalOpen(false);
      alert(`Applied ${template.name} structure to this job.`);
    } catch (err) {
      console.error('Error applying template:', err);
      alert('Failed to apply template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRole = async (role: JobRole) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('job_roles')
        .upsert({
          ...role,
          contact: undefined // Don't send hydrated contact back
        })
        .select('*, contact:contacts(*)')
        .single();

      if (error) throw error;
      
      setJobRoles(prev => {
        const exists = prev.find(r => r.id === data.id);
        if (exists) {
          return prev.map(r => r.id === data.id ? data : r);
        }
        return [...prev, data];
      });
    } catch (err: any) {
      console.error('Error saving role:', err);
      const errMsg = err?.message || JSON.stringify(err) || 'Unknown error';
      if (errMsg.includes('day_rate') || errMsg.includes('schema cache')) {
        alert('Database schema update required. Please run the SQL commands in database_updates.sql in your Supabase dashboard.');
      } else {
        alert(`Failed to save role: ${errMsg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to remove this role?')) return;
    
    try {
      const { error } = await supabase.from('job_roles').delete().eq('id', roleId);
      if (error) throw error;
      setJobRoles(prev => prev.filter(r => r.id !== roleId));
    } catch (err) {
      console.error('Error deleting role:', err);
      alert('Failed to delete role');
    }
  };

  const handleSaveTodo = async (todo: JobTodo) => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('job_todos')
        .upsert(todo)
        .select()
        .single();

      if (error) throw error;
      
      setJobTodos(prev => {
        const exists = prev.find(t => t.id === data.id);
        if (exists) {
          return prev.map(t => t.id === data.id ? data : t);
        }
        return [...prev, data].sort((a, b) => a.sort_order - b.sort_order);
      });
    } catch (err: any) {
      console.error('Error saving todo:', err);
      alert('Failed to save prep task.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      const { error } = await supabase.from('job_todos').delete().eq('id', todoId);
      if (error) throw error;
      setJobTodos(prev => prev.filter(t => t.id !== todoId));
    } catch (err) {
      console.error('Error deleting todo:', err);
      alert('Failed to delete prep task.');
    }
  };

  const handleToggleTodo = async (todo: JobTodo) => {
    const updated = { ...todo, completed: !todo.completed };
    // Optimistic update
    setJobTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
    
    try {
      const { error } = await supabase
        .from('job_todos')
        .update({ completed: updated.completed })
        .eq('id', todo.id);
      
      if (error) throw error;
    } catch (err) {
      console.error('Error toggling todo:', err);
      // Revert on error
      setJobTodos(prev => prev.map(t => t.id === todo.id ? todo : t));
      alert('Failed to update prep task status.');
    }
  };

  const handleLoadPresets = async () => {
    if (!selectedJobId) return;
    setIsSaving(true);
    
    const presets = [
      'Draft Call Sheet & Logistics',
      'Verify Equipment Manifest & Charging',
      'Secure Location Permits & COI',
      'Confirm Crew Booking Agreements',
      'Order Catering & Crafty',
      'Check Weather & Transit Details'
    ];

    const todosToInsert = presets.map((task, idx) => ({
      job_id: selectedJobId,
      task,
      completed: false,
      sort_order: idx
    }));

    try {
      const { data, error } = await supabase
        .from('job_todos')
        .insert(todosToInsert)
        .select();

      if (error) throw error;

      if (data) {
        setJobTodos(prev => [...prev, ...data].sort((a, b) => a.sort_order - b.sort_order));
      }
    } catch (err) {
      console.error('Error loading presets:', err);
      alert('Failed to load standard prep tasks.');
    } finally {
      setIsSaving(false);
    }
  };

  const exportPDF = async () => {
    if (!selectedJob) return;

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 40;

    const ZIPLINE_BLUE = '#0077FF';
    const TEXT_DARK = '#111111';
    const TEXT_GRAY = '#666666';

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(ZIPLINE_BLUE);
    doc.text('CREW MANIFEST', margin, y);
    
    doc.setFontSize(10);
    doc.setTextColor(TEXT_GRAY);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin, y, { align: 'right' });
    
    y += 30;
    doc.setDrawColor(ZIPLINE_BLUE);
    doc.setLineWidth(2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 30;

    // Job Info
    doc.setFontSize(14);
    doc.setTextColor(TEXT_DARK);
    doc.text(selectedJob.title.toUpperCase(), margin, y);
    
    doc.setFontSize(10);
    doc.setTextColor(TEXT_GRAY);
    doc.text(`DATE: ${formatLocalDate(selectedJob.shoot_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}`, margin, y + 15);
    
    y += 50;

    // Roles Table Header
    doc.setFillColor(TEXT_DARK);
    doc.rect(margin, y, pageWidth - (margin * 2), 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text('POSITION', margin + 10, y + 13);
    doc.text('NAME', margin + 180, y + 13);
    doc.text('CONTACT', margin + 350, y + 13);
    doc.text('CALL', margin + 480, y + 13);
    
    y += 35;
    doc.setTextColor(TEXT_DARK);
    doc.setFont('helvetica', 'normal');

    jobRoles.forEach(role => {
      doc.setFont('helvetica', 'bold');
      doc.text(role.position.toUpperCase(), margin + 10, y);
      
      doc.setFont('helvetica', 'normal');
      doc.text(caps(role.contact?.name || role.name, 'TBD'), margin + 180, y);

      doc.setFontSize(8);
      doc.text(role.contact?.email || '—', margin + 350, y);
      doc.text(role.contact?.phone || '—', margin + 350, y + 10);

      doc.setFontSize(9);
      doc.text(caps(role.call_time, '—'), margin + 480, y);
      
      y += 25;
      doc.setDrawColor(230);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 15, pageWidth - margin, y - 15);
      
      if (y > 700) {
        doc.addPage();
        y = 40;
      }
    });

    doc.save(`${selectedJob.title.replace(/\s+/g, '_')}_Crew_Manifest.pdf`);
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.primary_role?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [contacts, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Job Selector & Actions */}
      <div className="flex flex-col md:flex-row items-end gap-6 bg-neutral-900/40 p-6 rounded-2xl border border-white/10">
        <div className="flex-1 space-y-2">
          {!predefinedJobId ? (
            <>
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 ml-1">Active Job</label>
              <select 
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full bg-black/50 border border-white/10 p-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-xl appearance-none text-white"
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} ({job.shoot_date})
                  </option>
                ))}
              </select>
            </>
          ) : (
            <div className="pt-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 ml-1">Managing Job:</label>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white mt-1">{selectedJob?.title}</h2>
            </div>
          )}
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {activeTab === 'crew' && (
            <button 
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex-1 md:flex-none bg-white/5 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all border border-white/10 flex items-center justify-center gap-2"
            >
              <LayoutTemplate className="w-4 h-4" /> Templates
            </button>
          )}
          {activeTab === 'preprod' && jobTodos.length === 0 && (
            <button 
              onClick={handleLoadPresets}
              className="flex-1 md:flex-none bg-white/5 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all border border-white/10 flex items-center justify-center gap-2"
            >
              <LayoutTemplate className="w-4 h-4" /> Load Presets
            </button>
          )}
          <button 
            onClick={activeTab === 'crew' ? addRole : activeTab === 'schedule' ? addScheduleItem : addTodoItem}
            className="flex-1 md:flex-none bg-accent text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3"
          >
            <Plus className="w-4 h-4" /> {activeTab === 'crew' ? 'Add Role' : activeTab === 'schedule' ? 'Add Item' : 'Add Task'}
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none bg-white/5 text-white p-4 rounded-xl hover:bg-red-500/20 hover:text-red-500 transition-all flex items-center justify-center border border-white/10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className={`${activeTab === 'preprod' ? 'lg:col-span-3' : 'lg:col-span-2'} space-y-4`}>
          <div className="flex flex-wrap items-center gap-4 mb-4 border-b border-white/10 pb-2">
            <button 
              onClick={() => setActiveTab('crew')}
              className={`flex items-center gap-2 pb-2 text-lg font-black uppercase tracking-tighter transition-colors border-b-2 ${activeTab === 'crew' ? 'text-accent border-accent' : 'text-white/40 border-transparent hover:text-white'}`}
            >
              <Users className="w-5 h-5" /> Crew Manifest
            </button>
            <button 
              onClick={() => setActiveTab('schedule')}
              className={`flex items-center gap-2 pb-2 text-lg font-black uppercase tracking-tighter transition-colors border-b-2 ${activeTab === 'schedule' ? 'text-accent border-accent' : 'text-white/40 border-transparent hover:text-white'}`}
            >
              <Clock className="w-5 h-5" /> Schedule Builder
            </button>
            <button 
              onClick={() => setActiveTab('preprod')}
              className={`flex items-center gap-2 pb-2 text-lg font-black uppercase tracking-tighter transition-colors border-b-2 ${activeTab === 'preprod' ? 'text-accent border-accent' : 'text-white/40 border-transparent hover:text-white'}`}
            >
              <ClipboardList className="w-5 h-5" /> Prep Checklist
            </button>
          </div>
          
          <div className="space-y-3">
            {activeTab === 'crew' && (
              <AnimatePresence>
                {jobRoles.map((role, index) => (
                  <RoleItem
                    key={role.id}
                    role={role}
                    onUpdate={handleSaveRole}
                    onDelete={() => deleteRole(role.id)}
                    onMoveUp={index > 0 ? () => moveRole(index, -1) : undefined}
                    onMoveDown={index < jobRoles.length - 1 ? () => moveRole(index, 1) : undefined}
                    contacts={contacts}
                  />
                ))}
                {jobRoles.length === 0 && (
                  <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40 text-white">
                    <p className="font-bold uppercase tracking-widest text-xs">No roles assigned to this job yet.</p>
                    <button 
                      onClick={() => setIsTemplateModalOpen(true)}
                      className="mt-4 text-accent text-[10px] font-black uppercase tracking-widest hover:underline"
                    >
                      Apply a crew template
                    </button>
                  </div>
                )}
              </AnimatePresence>
            )}

            {activeTab === 'schedule' && (
              <AnimatePresence>
                {jobSchedules.map((schedule) => (
                  <ScheduleItem 
                    key={schedule.id} 
                    schedule={schedule} 
                    onUpdate={handleSaveSchedule}
                    onDelete={() => deleteSchedule(schedule.id)}
                  />
                ))}
                {jobSchedules.length === 0 && (
                  <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40 text-white">
                    <p className="font-bold uppercase tracking-widest text-xs">Schedule is empty.</p>
                    <p className="text-[10px] mt-2 italic">Build the day's timeline here to include it in the Call Sheet export.</p>
                  </div>
                )}
              </AnimatePresence>
            )}

            {activeTab === 'preprod' && (
              <div className="space-y-6">
                {/* Progress Bar */}
                {jobTodos.length > 0 && (
                  <div className="bg-neutral-900/40 border border-white/5 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/50">
                      <span>Preproduction Progress</span>
                      <span className="text-accent">
                        {jobTodos.filter(t => t.completed).length} / {jobTodos.length} Tasks ({Math.round((jobTodos.filter(t => t.completed).length / jobTodos.length) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-accent h-full transition-all duration-300"
                        style={{ 
                          width: `${(jobTodos.filter(t => t.completed).length / jobTodos.length) * 100}%`,
                          backgroundColor: 'var(--accent)'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Quick Add Todo Field */}
                <div className="flex gap-3 items-center bg-neutral-900/40 p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-all focus-within:border-accent/40 focus-within:bg-black/30">
                  <input 
                    type="text"
                    value={newTodoText}
                    onChange={(e) => setNewTodoText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTodoText.trim()) {
                        const maxSortOrder = jobTodos.reduce((max, t) => Math.max(max, t.sort_order), -1);
                        handleSaveTodo({
                          job_id: selectedJobId,
                          task: newTodoText.trim(),
                          completed: false,
                          sort_order: maxSortOrder + 1
                        } as JobTodo);
                        setNewTodoText('');
                      }
                    }}
                    placeholder="ADD A PREPRODUCTION PREP TASK (PRESS ENTER TO SAVE)..."
                    className="flex-1 bg-transparent border-none outline-none text-xs font-bold uppercase tracking-wider text-white placeholder:text-white/20 pl-2"
                  />
                  <button 
                    onClick={() => {
                      if (newTodoText.trim()) {
                        const maxSortOrder = jobTodos.reduce((max, t) => Math.max(max, t.sort_order), -1);
                        handleSaveTodo({
                          job_id: selectedJobId,
                          task: newTodoText.trim(),
                          completed: false,
                          sort_order: maxSortOrder + 1
                        } as JobTodo);
                        setNewTodoText('');
                      }
                    }}
                    disabled={!newTodoText.trim()}
                    className="p-2 bg-accent/15 text-accent hover:bg-accent hover:text-black disabled:opacity-20 disabled:hover:bg-accent/15 disabled:hover:text-accent rounded-xl transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Tasks List */}
                <div className="space-y-3">
                  <AnimatePresence>
                    {jobTodos.map((todo) => (
                      <TodoItem 
                        key={todo.id}
                        todo={todo}
                        onToggle={() => handleToggleTodo(todo)}
                        onUpdate={(text) => handleSaveTodo({ ...todo, task: text })}
                        onDelete={() => handleDeleteTodo(todo.id)}
                      />
                    ))}
                    {jobTodos.length === 0 && (
                      <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40 text-white">
                        <p className="font-bold uppercase tracking-widest text-xs">No prep tasks defined for this job.</p>
                        <p className="text-[10px] mt-2 italic">Get started by loading standard prep tasks or adding custom ones.</p>
                        <button 
                          onClick={handleLoadPresets}
                          className="mt-4 bg-accent/10 hover:bg-accent hover:text-black text-accent text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl border border-accent/20 hover:border-transparent transition-all"
                        >
                          Load Standard Prep Tasks
                        </button>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Quick Add / Contact Search */}
        {activeTab !== 'preprod' && (
          <div className="space-y-6">
            <div className="bg-neutral-900/60 border border-white/10 p-6 rounded-2xl">
              <h3 className="text-sm font-black uppercase tracking-tighter mb-4 flex items-center gap-2 text-white">
                <Search className="w-4 h-4 text-accent" />
                Quick Search
              </h3>
            <input 
              type="text"
              placeholder="SEARCH CONTACTS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-xs font-bold uppercase tracking-widest mb-4 text-white"
            />
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => {
                    const emptyRole = jobRoles.find(r => !r.contact_id);
                    if (emptyRole) {
                      handleSaveRole({ ...emptyRole, contact_id: contact.id });
                    } else {
                      handleSaveRole({
                        job_id: selectedJobId,
                        position: contact.primary_role || 'Crew',
                        contact_id: contact.id,
                        department: 'General'
                      } as JobRole);
                    }
                  }}
                  className="w-full text-left p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all group"
                >
                  <p className="text-[10px] font-black uppercase tracking-tight group-hover:text-accent transition-colors text-white">{contact.name}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest opacity-40 text-white">{contact.primary_role || 'No Role Set'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsTemplateModalOpen(false);
              }
            }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl cursor-default"
             >
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Crew Templates</h2>
                   <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent mt-1">Reusable Crew Structures</p>
                 </div>
                 <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                   <X className="w-6 h-6" />
                 </button>
               </div>

               <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => applyTemplate(template)}
                      className="w-full text-left p-6 bg-white/5 border border-white/5 rounded-2xl hover:border-accent/30 transition-all group flex justify-between items-center"
                    >
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight group-hover:text-accent transition-colors text-white">{template.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 text-white">{template.roles.length} Roles defined</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-accent" />
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="text-center py-12 opacity-30 border border-dashed border-white/10 rounded-2xl text-white">
                      <p className="text-xs font-bold uppercase tracking-widest">No templates created yet.</p>
                      <p className="text-[10px] mt-2 italic">Save a live job as a template from the Slate tab.</p>
                    </div>
                  )}
               </div>

               <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                 <button 
                   onClick={() => setIsTemplateModalOpen(false)}
                   className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/5 transition-all text-white"
                 >
                   Cancel
                 </button>
               </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleItem({ role, onUpdate, onDelete, onMoveUp, onMoveDown, contacts }: {
  role: JobRole,
  onUpdate: (role: JobRole) => void,
  onDelete: () => void,
  onMoveUp?: () => void,
  onMoveDown?: () => void,
  contacts: Contact[]
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localRole, setLocalRole] = useState(role);

  useEffect(() => {
    setLocalRole(role);
  }, [role]);

  const handleChange = (field: keyof JobRole, value: any) => {
    setLocalRole(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localRole);
    setIsEditing(false);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`group bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden transition-all ${isEditing ? 'ring-1 ring-accent' : ''}`}
    >
      <div className="p-4 flex items-center justify-between gap-4 text-white">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-30">Position</label>
            <input 
              type="text"
              value={localRole.position}
              onChange={(e) => handleChange('position', e.target.value)}
              onBlur={handleSave}
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black uppercase tracking-tight placeholder:opacity-20 text-white"
              placeholder="E.G. DIRECTOR OF PHOTOGRAPHY"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-30">Assigned To</label>
            <div className="flex items-center gap-2">
              <select
                value={localRole.contact_id || ''}
                onChange={(e) => {
                  const contact = contacts.find(c => c.id === e.target.value);
                  handleChange('contact_id', e.target.value);
                  onUpdate({ 
                    ...localRole, 
                    contact_id: e.target.value,
                    email: contact?.email,
                    phone: contact?.phone
                  });
                }}
                className={`w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] font-black uppercase tracking-tight cursor-pointer appearance-none ${!localRole.contact_id ? 'text-accent' : 'text-white'}`}
              >
                <option value="">+ UNASSIGNED</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{caps(c.name)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Manifest order = Call Sheet order, so the arrows live on every row.
              Always visible on touch screens — hover reveal is desktop-only. */}
          <div className="flex flex-col md:opacity-0 md:group-hover:opacity-100 transition-all">
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              className="p-1 hover:bg-white/10 hover:text-accent rounded transition-all disabled:opacity-20 disabled:hover:bg-transparent"
              title="Move up the call sheet"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              className="p-1 hover:bg-white/10 hover:text-accent rounded transition-all disabled:opacity-20 disabled:hover:bg-transparent"
              title="Move down the call sheet"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onDelete}
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all text-white/40 md:text-current md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-white/5 pt-4">
         <div className="flex items-center gap-2 opacity-60">
            <Clock className="w-3 h-3 text-accent" />
            <input 
              type="text"
              value={localRole.call_time || ''}
              onChange={(e) => handleChange('call_time', e.target.value)}
              onBlur={handleSave}
              placeholder="CALL TIME"
              className="bg-transparent border-none p-0 focus:ring-0 text-[9px] font-bold uppercase tracking-widest w-full text-white"
            />
         </div>
         
         <div className="flex items-center gap-2 opacity-60">
            <ClipboardList className="w-3 h-3 text-blue-500" />
            <input 
              type="text"
              value={localRole.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              onBlur={handleSave}
              placeholder="ROLE NOTES"
              className="bg-transparent border-none p-0 focus:ring-0 text-[9px] font-bold uppercase tracking-widest w-full text-white"
            />
         </div>

         <div className="flex items-center gap-4 justify-end">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input 
                type="checkbox"
                checked={localRole.is_overtime || false}
                onChange={(e) => {
                  handleChange('is_overtime', e.target.checked);
                  onUpdate({ ...localRole, is_overtime: e.target.checked });
                }}
                className="w-3 h-3 bg-black border-white/10 rounded focus:ring-accent"
              />
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 text-white">OT</span>
            </label>
         </div>
      </div>
    </motion.div>
  );
}

function TodoItem({ 
  todo, 
  onToggle, 
  onUpdate, 
  onDelete 
}: { 
  todo: JobTodo, 
  onToggle: () => void, 
  onUpdate: (text: string) => void, 
  onDelete: () => void 
}) {
  const [localTask, setLocalTask] = useState(todo.task);

  useEffect(() => {
    setLocalTask(todo.task);
  }, [todo.task]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`bg-neutral-900/40 border rounded-2xl overflow-hidden transition-all group flex items-center gap-4 p-4 text-white
        ${todo.completed ? 'border-white/5 opacity-60' : 'border-white/5 hover:border-white/10'}
      `}
    >
      <button 
        onClick={onToggle}
        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0
          ${todo.completed 
            ? 'bg-accent border-accent text-black' 
            : 'border-white/20 hover:border-accent/50 hover:bg-accent/10 text-transparent'
          }
        `}
        style={{ 
          backgroundColor: todo.completed ? 'var(--accent)' : 'transparent',
          borderColor: todo.completed ? 'var(--accent)' : ''
        }}
      >
        <Check className="w-3.5 h-3.5 stroke-[3px]" />
      </button>

      <input 
        type="text"
        value={localTask}
        onChange={(e) => setLocalTask(e.target.value)}
        onBlur={() => {
          if (localTask.trim() && localTask.trim() !== todo.task) {
            onUpdate(localTask.trim());
          } else {
            setLocalTask(todo.task);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className={`flex-1 bg-transparent border border-transparent px-1.5 py-0.5 rounded text-sm font-bold uppercase tracking-wide outline-none focus:bg-black/30 focus:border-accent/30 transition-all
          ${todo.completed ? 'line-through text-white/40' : 'text-white'}
        `}
      />

      <button 
        onClick={onDelete}
        className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-white/20 transition-all opacity-0 group-hover:opacity-100 shrink-0"
        title="Delete task"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function ScheduleItem({ 
  schedule, 
  onUpdate,
  onDelete
}: { 
  schedule: JobSchedule, 
  onUpdate: (s: JobSchedule) => void,
  onDelete: () => void
}) {
  const [localSchedule, setLocalSchedule] = useState(schedule);
  const [showNotes, setShowNotes] = useState(!!schedule.notes);

  useEffect(() => {
    setLocalSchedule(schedule);
  }, [schedule]);

  const handleChange = (field: keyof JobSchedule, value: any) => {
    setLocalSchedule(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localSchedule);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden transition-all group hover:border-white/10"
    >
      <div className="p-4 flex flex-col md:flex-row items-stretch md:items-start justify-between gap-4 text-white">
        
        {/* Time Selectors Column */}
        <div className="w-full md:w-32 shrink-0 flex items-center md:flex-col gap-2 md:border-r border-white/5 md:pr-4">
          
          {/* Start Time Select */}
          <div className="relative flex-1 md:w-full flex items-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 focus-within:border-accent/50 focus-within:bg-black/30 transition-all px-2.5 py-1.5 group/select">
            <span className="text-[8px] font-black uppercase tracking-widest text-accent select-none mr-1.5">START:</span>
            <select
              value={localSchedule.start_time || ''}
              onChange={(e) => {
                handleChange('start_time', e.target.value);
                onUpdate({ ...localSchedule, start_time: e.target.value });
              }}
              className="w-full bg-transparent border-none p-0 pr-5 focus:ring-0 text-[10px] font-black uppercase tracking-wider cursor-pointer text-white appearance-none outline-none select-none"
            >
              <option value="" className="bg-neutral-900 text-white/40">TBD</option>
              {Array.from({ length: 48 }).map((_, i) => {
                const hour = Math.floor(i / 2);
                const min = i % 2 === 0 ? '00' : '30';
                const hourStr = hour.toString().padStart(2, '0');
                const timeValue = `${hourStr}:${min}`;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                const displayStr = `${displayHour}:${min} ${ampm}`;
                return (
                  <option key={timeValue} value={timeValue} className="bg-neutral-900 text-white">
                    {displayStr}
                  </option>
                );
              })}
              {localSchedule.start_time && !Array.from({ length: 48 }).some((_, i) => {
                const hour = Math.floor(i / 2);
                const min = i % 2 === 0 ? '00' : '30';
                const hourStr = hour.toString().padStart(2, '0');
                return `${hourStr}:${min}` === localSchedule.start_time;
              }) && (
                <option value={localSchedule.start_time} className="bg-neutral-900 text-white">
                  {localSchedule.start_time}
                </option>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 group-hover/select:text-white/60 pointer-events-none transition-colors" />
          </div>

          {/* End Time Select */}
          <div className="relative flex-1 md:w-full flex items-center bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-white/20 focus-within:border-accent/50 focus-within:bg-black/30 transition-all px-2.5 py-1.5 group/select opacity-85 hover:opacity-100">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/40 select-none mr-1.5">END:</span>
            <select
              value={localSchedule.end_time || ''}
              onChange={(e) => {
                handleChange('end_time', e.target.value);
                onUpdate({ ...localSchedule, end_time: e.target.value });
              }}
              className="w-full bg-transparent border-none p-0 pr-5 focus:ring-0 text-[10px] font-black uppercase tracking-wider cursor-pointer text-white appearance-none outline-none select-none"
            >
              <option value="" className="bg-neutral-900 text-white/40">TBD</option>
              {Array.from({ length: 48 }).map((_, i) => {
                const hour = Math.floor(i / 2);
                const min = i % 2 === 0 ? '00' : '30';
                const hourStr = hour.toString().padStart(2, '0');
                const timeValue = `${hourStr}:${min}`;
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour % 12 === 0 ? 12 : hour % 12;
                const displayStr = `${displayHour}:${min} ${ampm}`;
                return (
                  <option key={timeValue} value={timeValue} className="bg-neutral-900 text-white">
                    {displayStr}
                  </option>
                );
              })}
              {localSchedule.end_time && !Array.from({ length: 48 }).some((_, i) => {
                const hour = Math.floor(i / 2);
                const min = i % 2 === 0 ? '00' : '30';
                const hourStr = hour.toString().padStart(2, '0');
                return `${hourStr}:${min}` === localSchedule.end_time;
              }) && (
                <option value={localSchedule.end_time} className="bg-neutral-900 text-white">
                  {localSchedule.end_time}
                </option>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 group-hover/select:text-white/60 pointer-events-none transition-colors" />
          </div>

          {/* Delete Button (Mobile) */}
          <button 
            onClick={onDelete}
            className="md:hidden p-2 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded-lg transition-all shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs Column */}
        <div className="flex-1 space-y-2 w-full">
          <div className="flex items-center justify-between gap-2">
            <input 
              type="text"
              value={localSchedule.task}
              onChange={(e) => handleChange('task', e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              placeholder="TASK DESCRIPTION (E.G. CREW CALL / LOAD IN)"
              className="flex-1 bg-transparent border border-transparent px-2.5 py-1.5 rounded-lg text-sm font-black uppercase tracking-tight placeholder:opacity-20 text-white transition-all hover:bg-white/5 hover:border-white/10 focus:bg-black/30 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 outline-none"
            />
            <button
              onClick={() => setShowNotes(!showNotes)}
              className={`p-1.5 rounded-lg border transition-all ${showNotes ? 'bg-accent/20 border-accent/20 text-accent' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
              title={showNotes ? "Hide notes" : "Add detailed notes"}
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
             <MapPin className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />
             <input 
               type="text"
               value={localSchedule.location || ''}
               onChange={(e) => handleChange('location', e.target.value)}
               onBlur={handleSave}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   e.currentTarget.blur();
                 }
               }}
               placeholder="SPECIFIC LOCATION (E.G. STAGE A)"
               className="w-full bg-transparent border border-transparent px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white placeholder:text-white/20 transition-all hover:bg-white/5 hover:border-white/10 focus:bg-black/30 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 outline-none"
             />
          </div>
          
          {showNotes && (
            <textarea
              value={localSchedule.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              onBlur={handleSave}
              placeholder="ADD DETAILED NOTES OR ACTIVITIES ABOUT THIS SCHEDULE BLOCK (SORT OF LIKE A TRELLO CARD DESCRIPTION)..."
              className="w-full min-h-[60px] bg-black/30 border border-white/10 rounded-xl p-3 text-[10px] font-bold uppercase tracking-wide leading-relaxed text-white placeholder:text-white/20 focus:border-accent/40 focus:ring-1 focus:ring-accent/20 outline-none resize-none"
            />
          )}
        </div>

        {/* Delete Button (Desktop) */}
        <button 
          onClick={onDelete}
          className="hidden md:block p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
