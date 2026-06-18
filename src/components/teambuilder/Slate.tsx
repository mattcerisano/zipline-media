'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, 
  Search, 
  Plus, 
  Trash2, 
  Calendar, 
  MapPin, 
  Clock,
  ChevronRight,
  ExternalLink,
  Filter,
  CheckCircle2,
  Clock3,
  AlertCircle,
  Link as LinkIcon,
  Copy,
  X,
  Save,
  FolderOpen,
  MessageSquare,
  Eye,
  Settings2,
  Building2,
  Activity,
  FileText,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { Job, STATUSES, JobLink, Client } from '@/components/gearbuilder/types';
import Autocomplete from 'react-google-autocomplete';
import TeamBuilder from '@/components/teambuilder/TeamBuilder';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function Slate() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  
  // Manage Job Modal (Team Builder)
  const [manageJobId, setManageJobId] = useState<string | null>(null);
  
  // Edit Job Modal
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job>>({
    title: '',
    client_name: '',
    production_company: '',
    job_status: 'Planning',
    type: 'production',
    shoot_date: new Date().toISOString().split('T')[0],
    call_time: '08:00 AM',
    location_name: '',
    location_address: '',
    notes_general: '',
    links: []
  });

  const openNewJobModal = () => {
    setEditingJob({
      title: '',
      client_name: '',
      production_company: '',
      job_status: 'Planning',
      type: 'production',
      shoot_date: new Date().toISOString().split('T')[0],
      call_time: '08:00 AM',
      location_name: '',
      location_address: '',
      notes_general: '',
      links: []
    });
    setIsJobModalOpen(true);
  };

  const openEditJobModal = (job: Job) => {
    setEditingJob(job);
    setIsJobModalOpen(true);
  };

  // Link Modal
  const [linkModalJob, setLinkModalJob] = useState<Job | null>(null);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const [jobsRes, clientsRes] = await Promise.all([
        supabase.from('jobs').select('*').order('shoot_date', { ascending: true }),
        supabase.from('clients').select('*')
      ]);

      if (jobsRes.error) throw jobsRes.error;
      setJobs(jobsRes.data as Job[]);
      if (clientsRes.data) setClients(clientsRes.data as Client[]);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob.title) return;

    try {
      let savedJobData;

      if (editingJob.id) {
        const { data, error } = await supabase
          .from('jobs')
          .update(editingJob)
          .eq('id', editingJob.id)
          .select()
          .single();
        if (error) throw error;
        savedJobData = data;
        setJobs(prev => prev.map(j => j.id === editingJob.id ? data as Job : j).sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')));
      } else {
        const { data, error } = await supabase
          .from('jobs')
          .insert([editingJob])
          .select()
          .single();
        if (error) throw error;
        savedJobData = data;
        setJobs(prev => [...prev, data as Job].sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')));
        
        // Trigger Discord Webhook
        try {
          await fetch('/api/integrations/discord', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `🎬 **New Production Added!**`,
              embed: {
                title: editingJob.title,
                color: 3447003, // Blue
                fields: [
                  { name: 'Client / Prod Co', value: editingJob.client_name || editingJob.production_company || 'Internal', inline: true },
                  { name: 'Shoot Date', value: editingJob.shoot_date || 'TBD', inline: true },
                  { name: 'Location', value: editingJob.location_name || 'TBD', inline: true }
                ]
              }
            })
          });
        } catch (discordErr) {
          console.error('Failed to send Discord alert:', discordErr);
        }
      }
      
      // Auto-save client if they entered a client name that doesn't exist
      if (editingJob.client_name && editingJob.client_name.trim()) {
        const clientExists = clients.some(c => c.name.toLowerCase() === editingJob.client_name!.toLowerCase());
        if (!clientExists) {
          const { data: newClientData } = await supabase
            .from('clients')
            .insert([{ name: editingJob.client_name.trim() }])
            .select()
            .single();
          
          if (newClientData) {
             setClients(prev => [...prev, newClientData as Client]);
          }
        }
      }

      setIsJobModalOpen(false);
    } catch (err) {
      console.error('Error saving job:', err);
      alert('Failed to save job');
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Are you sure you want to delete this production? This will remove all associated roles and gear lists.')) return;
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      console.error('Error deleting job:', err);
    }
  };

  const saveAsTemplate = async (job: Job) => {
    try {
      const { data: roles, error: rolesError } = await supabase
        .from('job_roles')
        .select('*')
        .eq('job_id', job.id);

      if (rolesError) throw rolesError;

      const templateData = {
        name: `${job.title} (Template)`,
        description: `Template based on ${job.title} for ${job.client_name}`,
        roles: roles.map(r => ({
          position: r.position,
          department: r.department,
          day_rate: r.day_rate
        }))
      };

      const { error } = await supabase
        .from('job_templates')
        .insert([templateData]);

      if (error) throw error;
      alert('Job structure saved as a reusable template!');
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template. Ensure the job_templates table exists.');
    }
  };

  const generateCallSheet = async (job: Job) => {
    try {
      // Fetch crew roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('job_roles')
        .select('*, contact:contacts(*)')
        .eq('job_id', job.id);

      if (rolesError) throw rolesError;
      const roles = rolesData || [];

      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      
      const ZIPLINE_BLUE = '#0077FF';
      const TEXT_DARK = '#111111';
      const TEXT_GRAY = '#666666';

      // Title & Header (Left)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(TEXT_DARK);
      doc.text(`${job.title.toUpperCase()}`, margin, margin);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Client: ${job.client_name || 'N/A'}`, margin, margin + 15);
      if (job.production_company) {
         doc.text(`Prod Co: ${job.production_company}`, margin, margin + 28);
      }

      // Date & Header (Right)
      const formattedDate = job.shoot_date ? new Date(job.shoot_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
      doc.setFontSize(10);
      doc.text(formattedDate, pageWidth - margin, margin, { align: 'right' });

      // Logistics Table Header Grid
      autoTable(doc, {
        startY: margin + 45,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 4, lineColor: [200, 200, 200], lineWidth: 0.5 },
        columnStyles: {
          0: { cellWidth: 100, fontStyle: 'bold', fillColor: [240, 240, 240] },
          1: { cellWidth: 160 },
          2: { cellWidth: 100, fontStyle: 'bold', fillColor: [240, 240, 240] },
          3: { cellWidth: 'auto' },
        },
        body: [
          ['CALL TIME:', job.call_time || 'TBD', 'WEATHER:', job.weather_summary || 'TBD'],
          ['LOCATION:', job.location_name || 'TBD', 'HOSPITAL:', job.nearest_hospital_name || 'TBD'],
          ['ADDRESS:', job.location_address || '', 'PARKING:', job.nearest_parking_name || 'TBD'],
        ],
        margin: { left: margin, right: margin }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 15;

      // Notes Section
      if (job.notes_general) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('GENERAL NOTES', margin, finalY);
        finalY += 5;
        
        autoTable(doc, {
          startY: finalY,
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 8, fillColor: [250, 250, 250], textColor: TEXT_DARK },
          body: [[job.notes_general]],
          margin: { left: margin, right: margin }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;
      }

      // Crew Section
      if (roles.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(ZIPLINE_BLUE);
        doc.text('CREW & TALENT', margin, finalY);
        finalY += 10;

        const crewData = roles.map(role => [
          (role as any).position.toUpperCase(),
          (role as any).contact?.name || (role as any).name || 'TBD',
          (role as any).contact?.email || '—',
          (role as any).contact?.phone || '—',
          (role as any).call_time || job.call_time || '—'
        ]);

        autoTable(doc, {
          startY: finalY,
          head: [['POSITION', 'NAME', 'EMAIL', 'PHONE', 'IN']],
          body: crewData,
          theme: 'grid',
          headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          styles: { fontSize: 9, textColor: TEXT_DARK },
          margin: { left: margin, right: margin }
        });
        finalY = (doc as any).lastAutoTable.finalY + 20;
      }

      // Gear Manifest Section
      const manifestObj = job.gear_manifest as Record<string, number> | undefined;
      if (manifestObj && Object.keys(manifestObj).length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(ZIPLINE_BLUE);
        doc.text('EQUIPMENT MANIFEST', margin, finalY);
        finalY += 10;

        const gearData = Object.keys(manifestObj).map(itemName => [
          `${manifestObj[itemName]}X`,
          itemName
        ]);

        autoTable(doc, {
          startY: finalY,
          head: [['QTY', 'ITEM']],
          body: gearData,
          theme: 'grid',
          headStyles: { fillColor: [0, 119, 255], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
          styles: { fontSize: 9, textColor: TEXT_DARK },
          columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
          margin: { left: margin, right: margin }
        });
      }

      doc.save(`${job.title.replace(/\s+/g, '_')}_Call_Sheet.pdf`);
    } catch (err) {
      console.error('Error generating call sheet:', err);
      alert('Failed to generate call sheet.');
    }
  };

  const addCustomLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkModalJob || !newLinkLabel || !newLinkUrl) return;

    const updatedLinks = [...(linkModalJob.links || []), { label: newLinkLabel, url: newLinkUrl }];
    
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ links: updatedLinks })
        .eq('id', linkModalJob.id);

      if (error) throw error;
      
      setJobs(prev => prev.map(j => j.id === linkModalJob.id ? { ...j, links: updatedLinks } : j));
      setLinkModalJob(null);
      setNewLinkLabel('');
      setNewLinkUrl('');
    } catch (err) {
      console.error('Error adding link:', err);
      alert('Failed to add link');
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          job.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || job.job_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  const upcomingJobs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return filteredJobs.filter(j => j.shoot_date && j.shoot_date >= today);
  }, [filteredJobs]);

  const pastJobs = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return filteredJobs.filter(j => !j.shoot_date || j.shoot_date < today);
  }, [filteredJobs]);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'Booked': return <CheckCircle2 className="w-3 h-3 text-green-500" />;
      case 'Hold': return <Clock3 className="w-3 h-3 text-yellow-500" />;
      case 'Planning': return <Clock3 className="w-3 h-3 text-blue-500" />;
      case 'Cancelled': return <AlertCircle className="w-3 h-3 text-red-500" />;
      default: return <Clock3 className="w-3 h-3 opacity-20" />;
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
    <div className="space-y-8">
      {/* Filters & Actions Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-neutral-900/40 p-6 rounded-2xl border border-white/10">
        <div className="flex flex-col md:flex-row items-center gap-4 flex-1 w-full max-w-4xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text"
              placeholder="SEARCH JOBS OR CLIENTS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/50 border border-white/10 p-3 pl-12 rounded-xl outline-none focus:border-accent transition-all uppercase text-[10px] font-black tracking-widest text-white"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter className="w-4 h-4 text-white/20 hidden md:block" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 md:flex-none bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-[10px] font-black uppercase tracking-widest cursor-pointer appearance-none min-w-[140px] text-white"
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={openNewJobModal}
          className="bg-accent text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center gap-3 w-full lg:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> New Production
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent whitespace-nowrap">Upcoming Productions</h2>
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest text-white">{upcomingJobs.length} Jobs</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                getStatusIcon={getStatusIcon} 
                onSaveAsTemplate={() => saveAsTemplate(job)}
                onDelete={() => deleteJob(job.id)}
                onAddLink={() => setLinkModalJob(job)}
                onManage={() => setManageJobId(job.id)}
                onExportCallSheet={() => generateCallSheet(job)}
                onEdit={() => openEditJobModal(job)}
              />
            ))}
            {upcomingJobs.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl opacity-40">
                <p className="font-bold uppercase tracking-widest text-xs text-white">No upcoming jobs found.</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6 opacity-60">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 whitespace-nowrap text-white">Completed & Archive</h2>
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest text-white">{pastJobs.length} Jobs</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {pastJobs.map(job => (
              <JobCard 
                key={job.id} 
                job={job} 
                getStatusIcon={getStatusIcon} 
                onSaveAsTemplate={() => saveAsTemplate(job)}
                onDelete={() => deleteJob(job.id)}
                onAddLink={() => setLinkModalJob(job)}
                onManage={() => setManageJobId(job.id)}
                onExportCallSheet={() => generateCallSheet(job)}
                onEdit={() => openEditJobModal(job)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Edit Job Modal */}
      <AnimatePresence>
        {isJobModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl my-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                  {editingJob.id ? 'Edit Production' : 'Create New Production'}
                </h2>
                <button onClick={() => setIsJobModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSaveJob} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Project Title</label>
                  <input 
                    required
                    type="text"
                    placeholder="E.G. BROADWAY OPENING NIGHT"
                    value={editingJob.title}
                    onChange={(e) => setEditingJob({ ...editingJob, title: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Client Name</label>
                  <input 
                    type="text"
                    placeholder="CLIENT NAME"
                    value={editingJob.client_name || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, client_name: e.target.value })}
                    list="slate-clients"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold uppercase text-sm text-white"
                  />
                  <datalist id="slate-clients">
                    {clients.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Production Company</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input 
                      type="text"
                      placeholder="PRODUCTION CO"
                      value={editingJob.production_company || ''}
                      onChange={(e) => setEditingJob({ ...editingJob, production_company: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                    />
                  </div>
                </div>

                {/* Logistics */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Shoot Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                    <input 
                      type="date"
                      value={editingJob.shoot_date}
                      onChange={(e) => setEditingJob({ ...editingJob, shoot_date: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-accent font-bold text-sm text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Call Time</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                    <input 
                      type="time"
                      value={editingJob.call_time || ''}
                      onChange={(e) => setEditingJob({ ...editingJob, call_time: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-accent font-bold text-sm text-white cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:w-8 [&::-webkit-calendar-picker-indicator]:h-8 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Location Name</label>
                  <input 
                    type="text"
                    placeholder="E.G. HUDSON THEATRE"
                    value={editingJob.location_name || ''}
                    onChange={(e) => setEditingJob({ ...editingJob, location_name: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Full Address</label>
                  <div className="relative flex">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 z-10" />
                    <Autocomplete
                      apiKey={GOOGLE_MAPS_API_KEY}
                      onPlaceSelected={(place) => setEditingJob({ ...editingJob, location_address: place.formatted_address || '' })}
                      defaultValue={editingJob.location_address || ''}
                      placeholder="STREET, CITY, STATE, ZIP"
                      className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-accent font-bold text-sm text-white uppercase tracking-widest"
                    />
                  </div>
                </div>

                {/* Additional Logistics overrides */}
                <div className="space-y-2 md:col-span-2">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mb-2">Logistics Overrides (Optional)</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        type="text"
                        placeholder="NEAREST HOSPITAL"
                        value={editingJob.nearest_hospital_name || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, nearest_hospital_name: e.target.value })}
                        className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-xs text-white"
                      />
                      <input 
                        type="text"
                        placeholder="NEAREST PARKING"
                        value={editingJob.nearest_parking_name || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, nearest_parking_name: e.target.value })}
                        className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-xs text-white"
                      />
                      <input 
                        type="text"
                        placeholder="WEATHER OVERRIDE"
                        value={editingJob.weather_summary || ''}
                        onChange={(e) => setEditingJob({ ...editingJob, weather_summary: e.target.value })}
                        className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-xs text-white"
                      />
                   </div>
                   <p className="text-[8px] text-white/30 italic mt-1">If left blank, logistics will auto-fetch in the Gear Builder based on the Full Address.</p>
                </div>

                {/* Status & Type */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Job Status</label>
                  <div className="relative">
                    <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <select 
                      value={editingJob.job_status}
                      onChange={(e) => setEditingJob({ ...editingJob, job_status: e.target.value as any })}
                      className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white appearance-none"
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Production Type</label>
                  <select 
                    value={editingJob.type}
                    onChange={(e) => setEditingJob({ ...editingJob, type: e.target.value as any })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white appearance-none"
                  >
                    <option value="production">PRODUCTION</option>
                    <option value="rental">RENTAL ONLY</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">General Notes</label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 w-4 h-4 text-white/20" />
                    <textarea 
                      placeholder="ADDITIONAL PRODUCTION NOTES..."
                      value={editingJob.notes_general || ''}
                      onChange={(e) => setEditingJob({ ...editingJob, notes_general: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 p-4 pl-12 rounded-xl outline-none focus:border-accent font-bold text-sm text-white h-32"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2 flex justify-end gap-4 mt-8 border-t border-white/5 pt-8">
                   <button 
                    type="button"
                    onClick={() => setIsJobModalOpen(false)}
                    className="px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-accent text-white px-12 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20"
                  >
                    {editingJob.id ? 'Save Changes' : 'Create Production'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Link Modal */}
      <AnimatePresence>
        {linkModalJob && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter text-white">Add Vault Link</h2>
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 text-white mt-1">{linkModalJob.title}</p>
                </div>
                <button onClick={() => setLinkModalJob(null)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={addCustomLink} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black tracking-widest uppercase opacity-40 ml-1 text-white">Link Label</label>
                  <input 
                    required
                    type="text"
                    placeholder="E.G. FRAME.IO REVIEW"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black tracking-widest uppercase opacity-40 ml-1 text-white">URL</label>
                  <input 
                    required
                    type="url"
                    placeholder="HTTPS://..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold text-sm text-white"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-4">
                   <button 
                    type="button"
                    onClick={() => setLinkModalJob(null)}
                    className="px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/5 transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-accent text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all"
                  >
                    Add Link
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Crew Modal (Team Builder) */}
      <AnimatePresence>
        {manageJobId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-6xl bg-black border border-white/10 rounded-3xl p-8 shadow-2xl my-8 min-h-[80vh]"
            >
              <TeamBuilder predefinedJobId={manageJobId} onClose={() => setManageJobId(null)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ 
  job, 
  getStatusIcon, 
  onSaveAsTemplate,
  onDelete,
  onAddLink,
  onManage,
  onExportCallSheet,
  onEdit
}: { 
  job: Job, 
  getStatusIcon: (s?: string) => React.ReactNode,
  onSaveAsTemplate: () => void,
  onDelete: () => void,
  onAddLink: () => void,
  onManage: () => void,
  onExportCallSheet: () => void,
  onEdit: () => void
}) {
  const shootDate = job.shoot_date ? new Date(job.shoot_date).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }) : 'TBD';

  const gearCount = job.gear_manifest ? Object.values(job.gear_manifest as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

  return (
    <div 
      onClick={onEdit}
      className="group bg-neutral-900/40 border border-white/5 p-6 rounded-2xl hover:border-accent/30 hover:bg-neutral-900/60 transition-all relative flex flex-col h-full overflow-hidden cursor-pointer"
    >
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-accent/10 transition-colors" />
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
            {getStatusIcon(job.job_status)}
            <span className="text-[9px] font-black uppercase tracking-widest opacity-70 text-white">{job.job_status || 'Planning'}</span>
          </div>
          {gearCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-accent/10 rounded-full border border-accent/20">
               <Package className="w-3 h-3 text-accent" />
               <span className="text-[8px] font-black uppercase tracking-widest text-accent">{gearCount} Gear</span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onExportCallSheet(); }}
            className="p-2 text-white/10 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            title="Export Call Sheet"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onSaveAsTemplate(); }}
            className="p-2 text-white/10 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
            title="Save as Template"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
            title="Delete Production"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative z-10 text-white">
        <h3 className="text-base font-black uppercase tracking-tight mb-1 group-hover:text-accent transition-colors line-clamp-2">{job.title}</h3>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4">{job.client_name || 'Individual Client'}</p>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-[11px] font-bold text-white/40">
            <Calendar className="w-4 h-4 text-accent/50 shrink-0" />
            <span className="uppercase tracking-widest">{shootDate} {job.call_time && `• ${job.call_time}`}</span>
          </div>
          {(job.location_name || job.location_address) && (
            <div className="flex items-start gap-3 text-[11px] font-bold text-white/40">
              <MapPin className="w-4 h-4 text-accent/50 shrink-0 mt-0.5" />
              <span className="uppercase tracking-widest leading-snug">
                {job.location_name && <span className="block text-white/80">{job.location_name}</span>}
                {job.location_address && <span className="block text-[9px] opacity-60 mt-0.5">{job.location_address}</span>}
              </span>
            </div>
          )}
        </div>

        {job.notes_general && (
           <div className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Notes</p>
              <p className="text-xs text-white/80 line-clamp-3 leading-relaxed">{job.notes_general}</p>
           </div>
        )}

        {/* Links Section */}
        <div className="space-y-2 mb-6">
           <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 flex items-center gap-2">
                <LinkIcon className="w-3 h-3" /> Project Vault
              </p>
              <button 
                onClick={(e) => { e.stopPropagation(); onAddLink(); }}
                className="p-1 hover:bg-white/5 rounded text-white/20 hover:text-accent transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
           </div>
           <div className="grid grid-cols-2 gap-2">
              {job.review_link && (
                <a href={job.review_link} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                  <Eye className="w-3 h-3 text-accent" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover/link:opacity-100">Review</span>
                </a>
              )}
              {job.discord_url && (
                <a href={job.discord_url} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                  <MessageSquare className="w-3 h-3 text-purple-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover/link:opacity-100">Discord</span>
                </a>
              )}
              {job.drive_folder_url && (
                <a href={job.drive_folder_url} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                  <FolderOpen className="w-3 h-3 text-yellow-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover/link:opacity-100">Drive</span>
                </a>
              )}
              {job.links?.map((link, i) => (
                <a key={i} href={link.url} target="_blank" className="flex items-center gap-2 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group/link border border-white/5">
                  <ExternalLink className="w-3 h-3 text-white/30" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-60 group-hover/link:opacity-100 truncate">{link.label}</span>
                </a>
              ))}
              {!job.review_link && !job.discord_url && !job.drive_folder_url && (!job.links || job.links.length === 0) && (
                <div className="col-span-2 text-center py-3 rounded-lg border border-dashed border-white/5 opacity-20">
                   <span className="text-[8px] font-bold uppercase tracking-[0.2em]">No Vault Links</span>
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="pt-4 border-t border-white/5 mt-auto flex items-center justify-between relative z-10">
         <div className="flex -space-x-2">
            <div className="w-7 h-7 rounded-full bg-accent/20 border-2 border-neutral-900 flex items-center justify-center text-[9px] font-black group-hover:bg-accent group-hover:text-white transition-colors">
               <Briefcase className="w-3 h-3 text-accent group-hover:text-white" />
            </div>
         </div>
         <button 
           onClick={(e) => { e.stopPropagation(); onManage(); }}
           className="text-[10px] font-black uppercase tracking-widest text-white/20 hover:text-white transition-all flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-lg"
         >
           Manage <ChevronRight className="w-4 h-4" />
         </button>
      </div>
    </div>
  );
}
