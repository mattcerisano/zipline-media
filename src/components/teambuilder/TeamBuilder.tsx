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
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import { Contact, Job, JobRole, DEPARTMENTS, JobTemplate } from '@/components/gearbuilder/types';

export default function TeamBuilder({ predefinedJobId, onClose }: { predefinedJobId?: string, onClose?: () => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(predefinedJobId || '');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

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

  // Fetch roles when job changes
  useEffect(() => {
    if (!selectedJobId) return;

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('job_roles')
          .select('*, contact:contacts(*)')
          .eq('job_id', selectedJobId);

        if (error) throw error;
        setJobRoles(data as JobRole[]);
      } catch (err) {
        console.error('Error fetching job roles:', err);
      }
    };

    fetchRoles();
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
    doc.text(`DATE: ${selectedJob.shoot_date}`, margin, y + 15);
    
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
      doc.text(role.contact?.name || role.name || 'TBD', margin + 180, y);
      
      doc.setFontSize(8);
      doc.text(role.contact?.email || '—', margin + 350, y);
      doc.text(role.contact?.phone || '—', margin + 350, y + 10);
      
      doc.setFontSize(9);
      doc.text(role.call_time || '—', margin + 480, y);
      
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
              <label className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40 ml-1">Managing Crew For:</label>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-white mt-1">{selectedJob?.title}</h2>
            </div>
          )}
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setIsTemplateModalOpen(true)}
            className="flex-1 md:flex-none bg-white/5 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all border border-white/10 flex items-center justify-center gap-2"
          >
            <LayoutTemplate className="w-4 h-4" /> Templates
          </button>
          <button 
            onClick={exportPDF}
            disabled={!selectedJobId || jobRoles.length === 0}
            className="flex-1 md:flex-none bg-white/10 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all border border-white/10 flex items-center justify-center gap-2 disabled:opacity-20"
          >
            <FileDown className="w-4 h-4" /> Export
          </button>
          <button 
            onClick={addRole}
            className="flex-1 md:flex-none bg-accent text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3"
          >
            <UserPlus className="w-4 h-4" /> Add Role
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
        {/* Roles List */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-black uppercase tracking-tighter mb-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-accent" />
            Crew Manifest
          </h3>
          
          <div className="space-y-3">
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
            </AnimatePresence>
            {jobRoles.length === 0 && (
              <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40">
                <p className="font-bold uppercase tracking-widest text-xs">No roles assigned to this job yet.</p>
                <button 
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="mt-4 text-accent text-[10px] font-black uppercase tracking-widest hover:underline"
                >
                  Apply a crew template
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Quick Add / Contact Search */}
        <div className="space-y-6">
          <div className="bg-neutral-900/60 border border-white/10 p-6 rounded-2xl">
            <h3 className="text-sm font-black uppercase tracking-tighter mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-accent" />
              Quick Search
            </h3>
            <input 
              type="text"
              placeholder="SEARCH CONTACTS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-xs font-bold uppercase tracking-widest mb-4"
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
                  <p className="text-[10px] font-black uppercase tracking-tight group-hover:text-accent transition-colors">{contact.name}</p>
                  <p className="text-[8px] font-bold uppercase tracking-widest opacity-40">{contact.primary_role || 'No Role Set'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Template Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
             >
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h2 className="text-2xl font-black uppercase tracking-tighter">Crew Templates</h2>
                   <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent mt-1">Reusable Crew Structures</p>
                 </div>
                 <button onClick={() => setIsTemplateModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
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
                        <p className="text-sm font-black uppercase tracking-tight group-hover:text-accent transition-colors">{template.name}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{template.roles.length} Roles defined</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-accent" />
                    </button>
                  ))}
                  {templates.length === 0 && (
                    <div className="text-center py-12 opacity-30 border border-dashed border-white/10 rounded-2xl">
                      <p className="text-xs font-bold uppercase tracking-widest">No templates created yet.</p>
                      <p className="text-[10px] mt-2 italic">Save a live job as a template from the Slate tab.</p>
                    </div>
                  )}
               </div>

               <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                 <button 
                   onClick={() => setIsTemplateModalOpen(false)}
                   className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/5 transition-all"
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
      className={`bg-neutral-900/40 border border-white/5 rounded-2xl overflow-hidden transition-all ${isEditing ? 'ring-1 ring-accent' : ''}`}
    >
      <div className="p-4 flex items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-30">Position</label>
            <input 
              type="text"
              value={localRole.position}
              onChange={(e) => handleChange('position', e.target.value)}
              onBlur={handleSave}
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black uppercase tracking-tight placeholder:opacity-20"
              placeholder="E.G. DIRECTOR OF PHOTOGRAPHY"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-30">Department</label>
            <select
              value={localRole.department || ''}
              onChange={(e) => {
                handleChange('department', e.target.value);
                onUpdate({ ...localRole, department: e.target.value });
              }}
              className="w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] font-bold uppercase tracking-widest cursor-pointer appearance-none"
            >
              <option value="">Select Dept</option>
              {DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
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
                className={`w-full bg-transparent border-none p-0 focus:ring-0 text-[10px] font-black uppercase tracking-tight cursor-pointer appearance-none ${!localRole.contact_id ? 'text-accent' : ''}`}
              >
                <option value="">+ UNASSIGNED</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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
              className="bg-transparent border-none p-0 focus:ring-0 text-[9px] font-bold uppercase tracking-widest w-full"
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
              className="bg-transparent border-none p-0 focus:ring-0 text-[9px] font-bold uppercase tracking-widest w-full"
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
              <span className="text-[8px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100">OT</span>
            </label>
         </div>
      </div>
    </motion.div>
  );
}
