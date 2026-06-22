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
  MapPin,
  AlignLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import { caps } from '@/lib/format';
import { formatLocalDate } from '@/lib/date';
import { Contact, Job, JobRole, DEPARTMENTS, JobTemplate, JobSchedule } from '@/components/gearbuilder/types';

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
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'crew' | 'schedule'>('crew');

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

  // Fetch roles and schedules when job changes
  useEffect(() => {
    if (!selectedJobId) return;

    const fetchJobData = async () => {
      try {
        const [rolesRes, schedulesRes] = await Promise.all([
          supabase.from('job_roles').select('*, contact:contacts(*)').eq('job_id', selectedJobId),
          supabase.from('job_schedules').select('*').eq('job_id', selectedJobId).order('sort_order', { ascending: true })
        ]);

        if (rolesRes.error) throw rolesRes.error;
        if (schedulesRes.error) throw schedulesRes.error;

        setJobRoles(rolesRes.data as JobRole[]);
        setJobSchedules(sortSchedules(schedulesRes.data as JobSchedule[]));
      } catch (err) {
        console.error('Error fetching job details:', err);
      }
    };

    fetchJobData();
  }, [selectedJobId]);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);

  const addRole = () => {
    const newRole: Partial<JobRole> = {
      job_id: selectedJobId,
      position: 'New Position',
      department: 'Production',
    };
    handleSaveRole(newRole as JobRole);
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
      const rolesToInsert = template.roles.map(r => ({
        job_id: selectedJobId,
        position: r.position,
        department: r.department,
        day_rate: r.day_rate
      }));

      const { error } = await supabase
        .from('job_roles')
        .insert(rolesToInsert);

      if (error) throw error;

      // Refresh roles
      const { data: newRoles, error: fetchError } = await supabase
        .from('job_roles')
        .select('*, contact:contacts(*)')
        .eq('job_id', selectedJobId);
      
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
          <button 
            onClick={activeTab === 'crew' ? addRole : addScheduleItem}
            className="flex-1 md:flex-none bg-accent text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3"
          >
            <Plus className="w-4 h-4" /> {activeTab === 'crew' ? 'Add Role' : 'Add Item'}
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
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-4 mb-4 border-b border-white/10 pb-2">
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
          </div>
          
          <div className="space-y-3">
            {activeTab === 'crew' && (
              <AnimatePresence>
                {jobRoles.map((role) => (
                  <RoleItem 
                    key={role.id} 
                    role={role} 
                    onUpdate={handleSaveRole}
                    onDelete={() => deleteRole(role.id)}
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
          </div>
        </div>

        {/* Sidebar: Quick Add / Contact Search */}
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

function RoleItem({ role, onUpdate, onDelete, contacts }: { 
  role: JobRole, 
  onUpdate: (role: JobRole) => void,
  onDelete: () => void,
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
          <button 
            onClick={onDelete}
            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
