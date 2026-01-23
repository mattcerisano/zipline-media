'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Edit2, Calendar, MapPin, Sun, 
  FileText, Link as LinkIcon, Download, Users, 
  Clock, Search, ChevronLeft
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  Job, JobRole, Contact, 
  STORAGE_KEY_JOBS, STORAGE_KEY_CONTACTS, 
  DEPARTMENTS, STATUSES 
} from './types';
import { CONTACTS_DATA } from '@/data/contacts';

// Helper: Weather Code to Text
const weatherCodeToText = (code: number) => {
  const map: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain',
    71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
    81: 'Moderate rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm',
    96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  };
  return map[code] || 'Unknown';
};

export default function SlateJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [search, setSearch] = useState('');
  
  // Dialogs
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Job>>({});
  const [editingRole, setEditingRole] = useState<Partial<JobRole>>({});
  
  // External API States
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [hospitalLoading, setHospitalLoading] = useState(false);

  // Load Data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const j = localStorage.getItem(STORAGE_KEY_JOBS);
    const c = localStorage.getItem(STORAGE_KEY_CONTACTS);
    if (j) setJobs(JSON.parse(j));
    // Use saved contacts or fallback to seed data
    if (c) {
        setContacts(JSON.parse(c));
    } else {
        setContacts(CONTACTS_DATA);
    }
  }, []);

  // Save Data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(jobs));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => 
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.client_name?.toLowerCase().includes(search.toLowerCase())
    ).sort((a, b) => new Date(b.shoot_date || 0).getTime() - new Date(a.shoot_date || 0).getTime());
  }, [jobs, search]);

  // --- Logic ---

  const handleSaveJob = () => {
    if (!editingJob.title) return;
    const now = new Date().toISOString();
    const payload = { ...editingJob, updated_at: now, job_roles: editingJob.job_roles || [] } as Job;
    
    if (!payload.id) payload.id = crypto.randomUUID();

    setJobs(prev => {
      const exists = prev.find(j => j.id === payload.id);
      return exists ? prev.map(j => j.id === payload.id ? payload : j) : [payload, ...prev];
    });
    setSelectedJob(payload);
    setIsJobDialogOpen(false);
  };

  const handleDeleteJob = (id: string) => {
    if (!window.confirm('Delete this job?')) return;
    setJobs(prev => prev.filter(j => j.id !== id));
    if (selectedJob?.id === id) setSelectedJob(null);
  };

  const handleSaveRole = () => {
    if (!selectedJob || (!editingRole.name && !editingRole.contact_id)) return;
    
    // If contact selected, hydrate details
    if (editingRole.contact_id) {
        const contact = contacts.find(c => c.id === editingRole.contact_id);
        if (contact) {
            editingRole.name = contact.name;
            editingRole.phone = contact.phone;
            editingRole.email = contact.email;
        }
    }

    const payload = { ...editingRole, job_id: selectedJob.id } as JobRole;
    if (!payload.id) payload.id = crypto.randomUUID();

    const updatedJob = {
        ...selectedJob,
        job_roles: selectedJob.job_roles.some(r => r.id === payload.id) 
            ? selectedJob.job_roles.map(r => r.id === payload.id ? payload : r)
            : [...selectedJob.job_roles, payload]
    };

    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    setSelectedJob(updatedJob);
    setIsRoleDialogOpen(false);
  };

  const handleDeleteRole = (roleId: string) => {
    if (!selectedJob) return;
    const updatedJob = {
        ...selectedJob,
        job_roles: selectedJob.job_roles.filter(r => r.id !== roleId)
    };
    setJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
    setSelectedJob(updatedJob);
  };

  // --- API Integrations ---

  const fetchWeather = async () => {
    if (!editingJob.shoot_date || !editingJob.location_address) {
        alert('Please enter a Location Address and Shoot Date first.');
        return;
    }
    setWeatherLoading(true);
    try {
        // 1. Geocode
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(editingJob.location_address)}`);
        const geoData = await geoRes.json();
        
        if (!geoData[0]) throw new Error('Address not found');
        const { lat, lon } = geoData[0];

        // 2. Weather
        const date = new Date(editingJob.shoot_date).toISOString().slice(0, 10);
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`);
        const wData = await wRes.json();

        if (wData.daily) {
            const code = wData.daily.weathercode[0];
            const temp = wData.daily.temperature_2m_max[0];
            const summary = `${weatherCodeToText(code)} • High: ${temp}°F`;
            setEditingJob(prev => ({ ...prev, weather_summary: summary }));
        }
    } catch (err) {
        console.error(err);
        alert('Could not fetch weather. Check address and date.');
    } finally {
        setWeatherLoading(false);
    }
  };

  const findHospital = async () => {
     if (!editingJob.location_address) {
         alert('Please enter a location address first.');
         return;
     }
     setHospitalLoading(true);
     try {
         // Simple Nominatim search
         const q = `hospital near ${editingJob.location_address}`;
         const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`);
         const data = await res.json();
         
         if (data[0]) {
             setEditingJob(prev => ({
                 ...prev,
                 nearest_hospital_name: data[0].display_name.split(',')[0],
                 nearest_hospital_address: data[0].display_name
             }));
         } else {
             alert('No hospital found nearby.');
         }
     } catch (err) {
         console.error(err);
         alert('Error searching for hospital.');
     } finally {
         setHospitalLoading(false);
     }
  };

  // --- Export ---
  const exportPDF = () => {
    if (!selectedJob) return;
    const doc = new jsPDF();
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(selectedJob.title.toUpperCase(), 20, 20);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`${selectedJob.production_company || 'Zipline Media'}`, 20, 28);
    
    // Meta Grid
    let y = 40;
    doc.setFont('helvetica', 'bold');
    doc.text('SHOOT DATE', 20, y);
    doc.text('CALL TIME', 80, y);
    doc.text('LOCATION', 140, y);
    
    doc.setFont('helvetica', 'normal');
    doc.text(selectedJob.shoot_date ? new Date(selectedJob.shoot_date).toLocaleDateString() : 'TBD', 20, y+5);
    doc.text(selectedJob.call_time || 'TBD', 80, y+5);
    
    const locLines = doc.splitTextToSize(selectedJob.location_name || selectedJob.location_address || 'TBD', 60);
    doc.text(locLines, 140, y+5);

    y += 20;

    // Crew List
    doc.setFillColor(0, 0, 0);
    doc.rect(20, y, 170, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('CREW LIST', 22, y+5.5);
    
    y += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    
    doc.text('POSITION', 20, y);
    doc.text('NAME', 70, y);
    doc.text('CALL', 120, y);
    doc.text('PHONE', 150, y);
    y += 2;
    doc.line(20, y, 190, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    selectedJob.job_roles.forEach(role => {
        doc.text(role.position, 20, y);
        doc.text(role.name || '—', 70, y);
        doc.text(role.call_time || '—', 120, y);
        doc.text(role.phone || '—', 150, y);
        y += 7;
    });

    if (selectedJob.notes_general) {
        y += 10;
        doc.setFont('helvetica', 'bold');
        doc.text('NOTES', 20, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const notes = doc.splitTextToSize(selectedJob.notes_general, 170);
        doc.text(notes, 20, y);
    }

    doc.save(`${selectedJob.title.replace(/\s+/g, '_')}_CallSheet.pdf`);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
      {/* SIDEBAR: Jobs List */}
      <div className={`lg:col-span-4 flex flex-col gap-4 h-full ${selectedJob ? 'hidden lg:flex' : 'flex'}`}>
         <div className="bg-neutral-900/50 border border-white/10 p-4 rounded-xl space-y-4">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input 
                  type="text" 
                  placeholder="SEARCH JOBS..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 py-3 pl-10 pr-4 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg"
                />
            </div>
            <button 
                onClick={() => { setEditingJob({ production_company: 'Zipline Media', job_status: 'Planning' }); setIsJobDialogOpen(true); }}
                className="w-full bg-white text-black py-3 rounded-lg text-xs font-black tracking-[0.2em] uppercase hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
            >
                <Plus className="w-4 h-4" /> New Job
            </button>
         </div>

         <div className="flex-1 overflow-y-auto bg-neutral-900/30 border border-white/10 rounded-xl p-2 custom-scrollbar">
            {filteredJobs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
                    <Clock className="w-8 h-8" />
                    <p className="text-xs uppercase tracking-widest">No jobs found</p>
                </div>
            ) : (
                filteredJobs.map(job => (
                    <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`w-full text-left p-4 mb-2 rounded-lg border transition-all group ${selectedJob?.id === job.id ? 'bg-accent/10 border-accent/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                    >
                         <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-2">
                                <h3 className={`text-sm font-bold uppercase tracking-tight truncate ${selectedJob?.id === job.id ? 'text-white' : 'text-white/80'}`}>{job.title}</h3>
                                <p className="text-xs font-medium tracking-widest uppercase opacity-40 mt-1">
                                    {job.shoot_date ? new Date(job.shoot_date).toLocaleDateString() : 'Date TBD'} • {job.job_status}
                                </p>
                            </div>
                            {job.job_status === 'Booked' && <div className="w-2 h-2 rounded-full bg-green-500 mt-1" />}
                            {job.job_status === 'Hold' && <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1" />}
                         </div>
                    </button>
                ))
            )}
         </div>
      </div>

      {/* DETAIL VIEW */}
      <div className={`lg:col-span-8 h-full overflow-y-auto custom-scrollbar ${selectedJob ? 'block' : 'hidden lg:block'}`}>
         {selectedJob ? (
             <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                key={selectedJob.id}
                className="space-y-6"
             >
                {/* Header */}
                <div className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-2xl relative">
                    <button 
                        onClick={() => setSelectedJob(null)} 
                        className="lg:hidden absolute top-6 left-6 p-2 bg-white/10 rounded-full"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="absolute top-6 right-6 md:top-8 md:right-8 flex gap-2">
                        <button 
                             onClick={exportPDF}
                             className="p-2 bg-white/10 hover:bg-white hover:text-black rounded-lg transition-colors border border-white/10 flex items-center gap-2"
                             title="Export Call Sheet"
                        >
                             <Download className="w-4 h-4" />
                             <span className="hidden md:inline text-[10px] font-bold tracking-widest uppercase">Call Sheet</span>
                        </button>
                        <button 
                             onClick={() => { setEditingJob(selectedJob); setIsJobDialogOpen(true); }}
                             className="p-2 bg-white/10 hover:bg-white hover:text-black rounded-lg transition-colors border border-white/10"
                        >
                             <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                             onClick={() => handleDeleteJob(selectedJob.id)}
                             className="p-2 bg-white/10 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-white/10"
                        >
                             <Trash2 className="w-4 h-4" />
                        </button>
                    </div>

                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 mb-2 mt-8 md:mt-0">{selectedJob.production_company}</p>
                    <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tighter mb-4 pr-24 md:pr-0">{selectedJob.title}</h2>
                    
                    <div className="flex flex-wrap gap-6 text-sm">
                        <div className="flex items-center gap-2 opacity-80">
                            <Calendar className="w-4 h-4" />
                            <span className="font-bold tracking-wide uppercase">{selectedJob.shoot_date ? new Date(selectedJob.shoot_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-80">
                            <Clock className="w-4 h-4" />
                            <span className="font-bold tracking-wide uppercase">{selectedJob.call_time || 'TBD'}</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-80">
                             <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                                 selectedJob.job_status === 'Booked' ? 'bg-green-500/20 text-green-500' :
                                 selectedJob.job_status === 'Hold' ? 'bg-yellow-500/20 text-yellow-500' :
                                 'bg-white/10 text-white/50'
                             }`}>
                                 {selectedJob.job_status}
                             </span>
                        </div>
                    </div>
                </div>

                {/* Logistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-neutral-900/50 border border-white/10 p-6 rounded-2xl space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                             <MapPin className="w-4 h-4 text-accent" />
                             <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40">Location</h3>
                        </div>
                        <div>
                             <p className="font-bold uppercase text-sm">{selectedJob.location_name || 'Location TBD'}</p>
                             <p className="text-xs opacity-60 mt-1">{selectedJob.location_address}</p>
                        </div>
                        {selectedJob.nearest_hospital_name && (
                             <div className="pt-4 border-t border-white/5">
                                 <p className="text-[10px] font-bold tracking-widest uppercase opacity-40 mb-1">Nearest Hospital</p>
                                 <p className="text-xs font-bold">{selectedJob.nearest_hospital_name}</p>
                                 <p className="text-[10px] opacity-60">{selectedJob.nearest_hospital_address}</p>
                             </div>
                        )}
                    </div>
                    
                    <div className="bg-neutral-900/50 border border-white/10 p-6 rounded-2xl space-y-4">
                         <div className="flex items-center gap-2 mb-2">
                             <Sun className="w-4 h-4 text-yellow-500" />
                             <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40">Weather</h3>
                        </div>
                        <p className="text-sm font-medium">{selectedJob.weather_summary || 'No forecast available.'}</p>
                        
                        <div className="pt-4 border-t border-white/5 space-y-2">
                             <div className="flex items-center gap-2 mb-2">
                                 <LinkIcon className="w-4 h-4 opacity-40" />
                                 <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40">Links</h3>
                             </div>
                             {selectedJob.gear_list_url && (
                                 <a href={selectedJob.gear_list_url} target="_blank" className="block text-xs hover:text-accent truncate hover:underline">
                                     Gear List
                                 </a>
                             )}
                             {selectedJob.quote_url && (
                                 <a href={selectedJob.quote_url} target="_blank" className="block text-xs hover:text-accent truncate hover:underline">
                                     Quote / Estimate
                                 </a>
                             )}
                             {!selectedJob.gear_list_url && !selectedJob.quote_url && (
                                 <p className="text-[10px] opacity-30 italic">No links added.</p>
                             )}
                        </div>
                    </div>
                </div>

                {/* Crew List */}
                <div className="bg-neutral-900/50 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <div className="flex items-center gap-2">
                             <Users className="w-4 h-4 text-accent" />
                             <h3 className="text-xs font-bold tracking-[0.2em] uppercase">Crew List</h3>
                        </div>
                        <button 
                            onClick={() => { setEditingRole({ position: 'Crew' }); setIsRoleDialogOpen(true); }}
                            className="px-3 py-1 bg-white text-black text-[10px] font-bold tracking-widest uppercase rounded hover:bg-accent hover:text-white transition-colors"
                        >
                            + Add Person
                        </button>
                    </div>
                    <div className="divide-y divide-white/5 overflow-x-auto">
                        {selectedJob.job_roles.length === 0 ? (
                            <div className="p-8 text-center opacity-30 text-xs font-bold tracking-widest uppercase">
                                No crew added yet.
                            </div>
                        ) : (
                            selectedJob.job_roles.map(role => (
                                <div key={role.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors group min-w-[500px] md:min-w-0">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-black uppercase ${
                                            role.department === 'Production' ? 'bg-blue-500/20 text-blue-500' :
                                            role.department === 'Camera' ? 'bg-red-500/20 text-red-500' :
                                            'bg-white/10 text-white'
                                        }`}>
                                            {role.position.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold uppercase">{role.name || 'TBD'}</p>
                                            <p className="text-[10px] opacity-50 tracking-wider uppercase">{role.position} • {role.department}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {role.call_time && (
                                            <div className="text-right">
                                                <p className="text-[10px] opacity-40 font-bold uppercase">Call</p>
                                                <p className="text-xs font-mono">{role.call_time}</p>
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => handleDeleteRole(role.id)}
                                            className="p-2 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                {/* Notes */}
                {selectedJob.notes_general && (
                    <div className="bg-neutral-900/50 border border-white/10 p-6 rounded-2xl">
                        <div className="flex items-center gap-2 mb-4">
                             <FileText className="w-4 h-4 text-accent" />
                             <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40">General Notes</h3>
                        </div>
                        <p className="text-sm opacity-80 whitespace-pre-wrap leading-relaxed">{selectedJob.notes_general}</p>
                    </div>
                )}

             </motion.div>
         ) : (
             <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                    <Calendar className="w-10 h-10" />
                </div>
                <p className="text-sm font-bold tracking-[0.3em] uppercase">Select a job to view slate</p>
            </div>
         )}
      </div>

      {/* JOB DIALOG */}
      <AnimatePresence>
        {isJobDialogOpen && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsJobDialogOpen(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl"
                >
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">{editingJob.id ? 'Edit Job' : 'New Job'}</h2>
                    
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Job Title *</label>
                                <input 
                                    value={editingJob.title || ''}
                                    onChange={e => setEditingJob(p => ({ ...p, title: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Status</label>
                                <select 
                                    value={editingJob.job_status || 'Planning'}
                                    onChange={e => setEditingJob(p => ({ ...p, job_status: e.target.value as Job['job_status'] }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm appearance-none"
                                >
                                    {STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                </select>
                             </div>
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Shoot Date</label>
                                <input 
                                    type="date"
                                    value={editingJob.shoot_date || ''}
                                    onChange={e => setEditingJob(p => ({ ...p, shoot_date: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm text-white"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">General Call</label>
                                <input 
                                    type="time"
                                    value={editingJob.call_time || ''}
                                    onChange={e => setEditingJob(p => ({ ...p, call_time: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm text-white"
                                />
                             </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Location Address</label>
                            <input 
                                placeholder="FULL ADDRESS FOR WEATHER/HOSPITAL..."
                                value={editingJob.location_address || ''}
                                onChange={e => setEditingJob(p => ({ ...p, location_address: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm"
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={fetchWeather} disabled={weatherLoading} className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    {weatherLoading ? 'Loading...' : <><Sun className="w-3 h-3" /> Get Weather</>}
                                </button>
                                <button onClick={findHospital} disabled={hospitalLoading} className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    {hospitalLoading ? 'Loading...' : <><Plus className="w-3 h-3" /> Find Hospital</>}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">General Notes</label>
                            <textarea 
                                rows={3}
                                value={editingJob.notes_general || ''}
                                onChange={e => setEditingJob(p => ({ ...p, notes_general: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm resize-none"
                            />
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Gear List URL</label>
                                <input 
                                    value={editingJob.gear_list_url || ''}
                                    onChange={e => setEditingJob(p => ({ ...p, gear_list_url: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Quote URL</label>
                                <input 
                                    value={editingJob.quote_url || ''}
                                    onChange={e => setEditingJob(p => ({ ...p, quote_url: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm"
                                />
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                        <button onClick={() => setIsJobDialogOpen(false)} className="px-6 py-3 rounded-lg text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/10 transition-colors">Cancel</button>
                        <button onClick={handleSaveJob} className="px-8 py-3 bg-white text-black rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-accent hover:text-white transition-colors">Save Job</button>
                    </div>
                </motion.div>
             </div>
        )}
      </AnimatePresence>

      {/* ROLE DIALOG */}
      <AnimatePresence>
        {isRoleDialogOpen && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsRoleDialogOpen(false)} />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg p-8 shadow-2xl"
                >
                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">Add Crew</h2>
                    
                    <div className="space-y-6">
                        <div className="space-y-2">
                             <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Select from Rolodex</label>
                             <select 
                                value={editingRole.contact_id || ''}
                                onChange={e => {
                                    const cid = e.target.value;
                                    const c = contacts.find(co => co.id === cid);
                                    if (c) {
                                        setEditingRole(p => ({ 
                                            ...p, 
                                            contact_id: cid, 
                                            name: c.name, 
                                            position: c.primary_role || 'Crew', 
                                            phone: c.phone 
                                        }));
                                    } else {
                                        setEditingRole(p => ({ ...p, contact_id: undefined }));
                                    }
                                }}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm appearance-none"
                             >
                                 <option value="">-- Custom / Manual Entry --</option>
                                 {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                             </select>
                        </div>

                         <div className="space-y-2">
                             <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Name</label>
                             <input 
                                value={editingRole.name || ''}
                                onChange={e => setEditingRole(p => ({ ...p, name: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                             />
                         </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Position</label>
                                <input 
                                    value={editingRole.position || ''}
                                    onChange={e => setEditingRole(p => ({ ...p, position: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Department</label>
                                <select 
                                    value={editingRole.department || 'General'}
                                    onChange={e => setEditingRole(p => ({ ...p, department: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm appearance-none"
                                >
                                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                             </div>
                        </div>

                         <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Individual Call</label>
                                <input 
                                    type="time"
                                    value={editingRole.call_time || ''}
                                    onChange={e => setEditingRole(p => ({ ...p, call_time: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm text-white"
                                />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Phone</label>
                                <input 
                                    value={editingRole.phone || ''}
                                    onChange={e => setEditingRole(p => ({ ...p, phone: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                />
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                        <button onClick={() => setIsRoleDialogOpen(false)} className="px-6 py-3 rounded-lg text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/10 transition-colors">Cancel</button>
                        <button onClick={handleSaveRole} className="px-8 py-3 bg-white text-black rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-accent hover:text-white transition-colors">Add</button>
                    </div>
                </motion.div>
             </div>
        )}
      </AnimatePresence>

       <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--accent); }
      `}</style>
    </div>
  );
}