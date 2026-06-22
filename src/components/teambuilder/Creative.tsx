'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Palette, 
  Film, 
  Type, 
  Plus, 
  Trash2, 
  Save, 
  X, 
  Camera, 
  Sparkles, 
  Link2, 
  ExternalLink,
  FileText,
  Bookmark,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Job, JobShot } from '@/components/gearbuilder/types';
import { generateMasterBrief } from '@/lib/pdf-generator';
import { sanitizeUrl } from '@/lib/sanitize';
import { formatLocalDate } from '@/lib/date';

const PRESET_COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3',
  '#000000', '#FFFFFF', '#808080', '#0077FF', '#FF00FF', '#00FFFF', '#FFD700'
];

function AspectRatioMask({ ratio, children }: { ratio?: string; children: React.ReactNode }) {
  if (!ratio || ratio === '16:9') {
    return <div className="relative w-full overflow-hidden rounded-xl border border-white/5 bg-black">{children}</div>;
  }

  return (
    <div className="relative w-full overflow-hidden bg-black aspect-video flex items-center justify-center rounded-xl border border-white/5">
      <div className="w-full h-full flex items-center justify-center relative">
        {children}
        
        {/* Letterbox for 2.39:1 Anamorphic */}
        {ratio === '2.39:1' && (
          <>
            <div className="absolute top-0 left-0 w-full h-[13%] bg-black/90 border-b border-white/10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-[13%] bg-black/90 border-t border-white/10 pointer-events-none" />
          </>
        )}

        {/* Pillarbox for 9:16 */}
        {ratio === '9:16' && (
          <>
            <div className="absolute top-0 left-0 h-full w-[34.2%] bg-black/90 border-r border-white/10 pointer-events-none" />
            <div className="absolute top-0 right-0 h-full w-[34.2%] bg-black/90 border-l border-white/10 pointer-events-none" />
          </>
        )}

        {/* Pillarbox for 4:3 */}
        {ratio === '4:3' && (
          <>
            <div className="absolute top-0 left-0 h-full w-[12.5%] bg-black/90 border-r border-white/10 pointer-events-none" />
            <div className="absolute top-0 right-0 h-full w-[12.5%] bg-black/90 border-l border-white/10 pointer-events-none" />
          </>
        )}

        {/* Pillarbox for 1:1 */}
        {ratio === '1:1' && (
          <>
            <div className="absolute top-0 left-0 h-full w-[21.9%] bg-black/90 border-r border-white/10 pointer-events-none" />
            <div className="absolute top-0 right-0 h-full w-[21.9%] bg-black/90 border-l border-white/10 pointer-events-none" />
          </>
        )}
      </div>
    </div>
  );
}

interface CreativeProps {
  selectedJobId?: string | null;
}

export default function Creative({ selectedJobId: selectedJobIdProp }: CreativeProps = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('creative_active_job_id') || '';
    }
    return '';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Creative State
  const [briefConcept, setBriefConcept] = useState('');
  const [briefLighting, setBriefLighting] = useState('');
  const [briefCamera, setBriefCamera] = useState('');
  const [briefAudio, setBriefAudio] = useState('');
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [jobLinks, setJobLinks] = useState<any[]>([]);
  const [shotlist, setShotlist] = useState<JobShot[]>([]);
  
  // Custom links form state
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  // Add shot form state
  const [isAddingShot, setIsAddingShot] = useState(false);
  const [newShot, setNewShot] = useState<Partial<JobShot>>({
    shot_number: '',
    description: '',
    framing: '',
    equipment: '',
    image_url: '',
    is_special: false,
    aspect_ratio: '16:9',
    lighting_setup: '',
    scene_group: 'Scene 1'
  });

  // Edit shot form state
  const [isEditingShot, setIsEditingShot] = useState(false);
  const [editingShot, setEditingShot] = useState<JobShot | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (selectedJobIdProp) {
      setSelectedJobId(selectedJobIdProp);
    }
  }, [selectedJobIdProp]);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('shoot_date', { ascending: false });

      if (error) throw error;
      const fetchedJobs = ((data || []) as Job[]).filter(j => j.job_status !== 'Wrapped' && j.job_status !== 'Cancelled');
      setJobs(fetchedJobs);

      if (fetchedJobs.length > 0) {
        let activeTab = selectedJobIdProp || selectedJobId;
        const activeIds = fetchedJobs.map(j => j.id);

        if (!activeTab || !activeIds.includes(activeTab)) {
          activeTab = fetchedJobs[0].id;
        }
        
        setSelectedJobId(activeTab);
        if (!selectedJobIdProp) {
          localStorage.setItem('creative_active_job_id', activeTab);
        }
      } else {
        setSelectedJobId('');
      }
    } catch (err) {
      console.error('Error fetching jobs for Creative:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectTab = (jobId: string) => {
    setSelectedJobId(jobId);
    localStorage.setItem('creative_active_job_id', jobId);
  };

  useEffect(() => {
    if (!selectedJobId) return;

    const fetchCreativeData = async () => {
      try {
        const { data: job, error: jobError } = await supabase
          .from('jobs')
          .select('creative_brief, color_palette, links')
          .eq('id', selectedJobId)
          .single();

        if (jobError) throw jobError;
        if (job) {
          const briefRaw = job.creative_brief || '';
          let concept = '';
          let lighting = '';
          let camera = '';
          let audio = '';
          
          try {
            if (briefRaw.trim().startsWith('{')) {
              const parsed = JSON.parse(briefRaw);
              concept = parsed.concept || '';
              lighting = parsed.lighting || '';
              camera = parsed.camera || '';
              audio = parsed.audio || '';
            } else {
              concept = briefRaw;
            }
          } catch (e) {
            concept = briefRaw;
          }

          setBriefConcept(concept);
          setBriefLighting(lighting);
          setBriefCamera(camera);
          setBriefAudio(audio);
          setColorPalette(job.color_palette || []);
          setJobLinks(Array.isArray(job.links) ? job.links : []);
        }

        const { data: shots, error: shotError } = await supabase
          .from('job_shotlist')
          .select('*')
          .eq('job_id', selectedJobId)
          .order('sort_order', { ascending: true });

        if (shotError) throw shotError;
        setShotlist((shots || []) as JobShot[]);
      } catch (err) {
        console.error('Error fetching creative data:', err);
      }
    };

    fetchCreativeData();
  }, [selectedJobId]);

  const saveCreativeBoard = async () => {
    setIsSaving(true);
    try {
      const briefData = JSON.stringify({
        concept: briefConcept,
        lighting: briefLighting,
        camera: briefCamera,
        audio: briefAudio
      });

      const { error } = await supabase
        .from('jobs')
        .update({ creative_brief: briefData, color_palette: colorPalette })
        .eq('id', selectedJobId);
      
      if (error) throw error;
      alert('Creative Board saved successfully!');
    } catch (err) {
      console.error('Error saving brief:', err);
      alert('Failed to save Creative Board.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedJobId) return;
    setIsExporting(true);
    try {
      await generateMasterBrief(selectedJobId);
    } catch (err) {
      console.error(err);
      alert('Failed to export Production Brief PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const addCreativeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkLabel || !newLinkUrl) return;

    const newLink = {
      label: newLinkLabel,
      url: newLinkUrl.startsWith('http') ? newLinkUrl : `https://${newLinkUrl}`,
      category: 'Creative'
    };

    const currentLinks = Array.isArray(jobLinks) ? jobLinks : [];
    const updatedLinks = [...currentLinks, newLink];

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ links: updatedLinks })
        .eq('id', selectedJobId);

      if (error) throw error;
      setJobLinks(updatedLinks);
      setNewLinkLabel('');
      setNewLinkUrl('');
    } catch (err) {
      console.error('Error adding link:', err);
      alert('Failed to add link');
    }
  };

  const deleteCreativeLink = async (indexToDelete: number) => {
    if (!Array.isArray(jobLinks)) return;
    const updatedLinks = jobLinks.filter((_, i) => i !== indexToDelete);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ links: updatedLinks })
        .eq('id', selectedJobId);

      if (error) throw error;
      setJobLinks(updatedLinks);
    } catch (err) {
      console.error('Error deleting link:', err);
      alert('Failed to delete link');
    }
  };

  const addShot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShot.description) return;

    try {
      const shotData = {
        ...newShot,
        job_id: selectedJobId,
        sort_order: shotlist.length,
        aspect_ratio: newShot.aspect_ratio || '16:9',
        scene_group: newShot.scene_group || 'Scene 1'
      };

      const { data, error } = await supabase
        .from('job_shotlist')
        .insert([shotData])
        .select()
        .single();

      if (error) throw error;
      setShotlist([...shotlist, data as JobShot]);
      setNewShot({
        shot_number: '',
        description: '',
        framing: '',
        equipment: '',
        image_url: '',
        is_special: false,
        aspect_ratio: '16:9',
        lighting_setup: '',
        scene_group: 'Scene 1'
      });
      setIsAddingShot(false);
    } catch (err) {
      console.error('Error adding shot:', err);
      alert('Failed to add shot.');
    }
  };

  const saveShotEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShot || !editingShot.description) return;

    try {
      const { data, error } = await supabase
        .from('job_shotlist')
        .update({
          shot_number: editingShot.shot_number,
          description: editingShot.description,
          framing: editingShot.framing,
          equipment: editingShot.equipment,
          image_url: editingShot.image_url,
          is_special: editingShot.is_special,
          aspect_ratio: editingShot.aspect_ratio || '16:9',
          lighting_setup: editingShot.lighting_setup || '',
          scene_group: editingShot.scene_group || 'Scene 1'
        })
        .eq('id', editingShot.id)
        .select()
        .single();

      if (error) throw error;
      setShotlist(shotlist.map(s => s.id === editingShot.id ? (data as JobShot) : s));
      setIsEditingShot(false);
      setEditingShot(null);
    } catch (err) {
      console.error('Error saving shot edit:', err);
      alert('Failed to save shot edits.');
    }
  };

  const deleteShot = async (id: string) => {
    if (!confirm('Delete this shot?')) return;
    try {
      const { error } = await supabase.from('job_shotlist').delete().eq('id', id);
      if (error) throw error;
      setShotlist(shotlist.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting shot:', err);
      alert('Failed to delete shot.');
    }
  };

  const toggleColor = (color: string) => {
    if (colorPalette.includes(color)) {
      setColorPalette(colorPalette.filter(c => c !== color));
    } else {
      if (colorPalette.length < 5) {
        setColorPalette([...colorPalette, color]);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCreativeLinks = Array.isArray(jobLinks)
    ? jobLinks.filter(link => link && typeof link === 'object' && link.category === 'Creative')
    : [];

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-4 max-w-md mx-auto h-full p-4 md:p-6 text-white">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
          <Palette className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">No Active Projects</h3>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-relaxed">
            All projects are wrapped or archived. Go to the Production Slate to create or reactivate a project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full flex flex-col p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-zinc-950/40 backdrop-blur-md p-6 rounded-2xl border border-white/10 shrink-0">
        <div className="flex-1 w-full lg:w-auto space-y-2 min-w-0">
          {selectedJobIdProp ? (
            <div className="flex items-center gap-3 py-1 select-none">
              <span className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/20 flex items-center justify-center text-accent">
                <Palette className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <label className="text-[8px] font-black uppercase tracking-[0.3em] opacity-40 block text-accent mb-0.5">Creative Board Project</label>
                <span className="font-black uppercase tracking-wider text-sm text-white">
                  {jobs.find(j => j.id === selectedJobIdProp)?.title || 'Loading Project...'}
                </span>
              </div>
            </div>
          ) : (
            <>
              <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 ml-1 text-white">Active Projects</label>
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-1 select-none">
                {jobs.map(job => {
                  const isActive = selectedJobId === job.id;
                  return (
                    <div 
                      key={job.id}
                      onClick={() => handleSelectTab(job.id)}
                      className={`flex flex-col items-start gap-1 px-4 py-2.5 rounded-xl border cursor-pointer transition-all duration-300 relative shrink-0 min-w-[160px]
                        ${isActive 
                          ? 'bg-accent/15 border-accent text-white shadow-lg shadow-accent/10' 
                          : 'bg-black/30 border-white/5 text-white/50 hover:text-white/80 hover:bg-black/50 hover:border-white/10'
                        }`}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span className="font-black uppercase tracking-wider text-[10px] truncate max-w-[100px] text-white">
                          {job.title}
                        </span>
                        {job.job_status && (
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0
                            ${job.job_status === 'Booked' ? 'bg-green-500/10 border-green-500/20 text-green-500' :
                              job.job_status === 'Hold' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' :
                              'bg-blue-500/10 border-blue-500/20 text-blue-500'}`}
                          >
                            {job.job_status}
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">
                        {formatLocalDate(job.shoot_date, { month: 'short', day: 'numeric', year: 'numeric' }, 'TBD Date')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-zinc-900 border border-white/10 text-white px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all flex items-center gap-2.5 justify-center cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5 text-accent" />}
            Export Production Brief (PDF)
          </button>
          <button 
            onClick={saveCreativeBoard}
            disabled={isSaving}
            className="bg-accent text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center gap-2.5 justify-center cursor-pointer disabled:opacity-50"
          >
            {isSaving ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Creative Board
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
        {/* Left Column: Brief & Palette & Links */}
        <div className="xl:col-span-4 space-y-8">
          
          {/* Creative Brief */}
          <section className="bg-zinc-950/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl space-y-5 shadow-xl">
             <div className="flex items-center gap-3 border-b border-white/5 pb-2">
               <Sparkles className="w-4.5 h-4.5 text-accent" />
               <h3 className="text-xs font-black uppercase tracking-widest text-white">Creative Pillars</h3>
             </div>
             
             {/* Core Concept & Theme */}
             <div className="space-y-1.5">
               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block ml-0.5">1. Core Concept & Theme</label>
               <textarea 
                 value={briefConcept}
                 onChange={(e) => setBriefConcept(e.target.value)}
                 placeholder="What is the story, narrative hook, or overarching theme?"
                 className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
               />
             </div>

             {/* Lighting & Color Direction */}
             <div className="space-y-1.5">
               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block ml-0.5">2. Lighting & Color Direction</label>
               <textarea 
                 value={briefLighting}
                 onChange={(e) => setBriefLighting(e.target.value)}
                 placeholder="High key, moody low key, neon contrast, golden hour warmth..."
                 className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
               />
             </div>

             {/* Camera & Movement Style */}
             <div className="space-y-1.5">
               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block ml-0.5">3. Camera & Movement Style</label>
               <textarea 
                 value={briefCamera}
                 onChange={(e) => setBriefCamera(e.target.value)}
                 placeholder="Handheld kinetic, smooth gimbal, static anamorphic framing..."
                 className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
               />
             </div>

             {/* Audio & Soundscape Vibe */}
             <div className="space-y-1.5">
               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 block ml-0.5">4. Audio & Soundscape Vibe</label>
               <textarea 
                 value={briefAudio}
                 onChange={(e) => setBriefAudio(e.target.value)}
                 placeholder="Driving synth, ambient drones, crisp sound design, punchy VO..."
                 className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
               />
             </div>
          </section>

          {/* Color Palette */}
          <section className="bg-zinc-950/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
             <div className="flex items-center gap-3">
               <Palette className="w-4.5 h-4.5 text-accent" />
               <h3 className="text-xs font-black uppercase tracking-widest text-white">Color Palette swatches</h3>
             </div>
             <div className="flex flex-wrap gap-2.5 mb-4">
                {colorPalette.map((color, i) => (
                  <div key={i} className="relative group">
                    <div 
                      className="w-10 h-10 rounded-lg shadow-inner border border-white/10 cursor-pointer hover:scale-105 transition-transform"
                      style={{ backgroundColor: color }}
                      onClick={() => toggleColor(color)}
                      title={`Click to remove ${color}`}
                    />
                    <div className="absolute -top-1 -right-1 hidden group-hover:flex bg-red-500 rounded-full p-0.5 pointer-events-none">
                       <X className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                ))}
                {colorPalette.length < 5 && (
                  <div className="w-10 h-10 rounded-lg border border-dashed border-white/20 flex items-center justify-center opacity-30">
                     <Plus className="w-4 h-4 text-white" />
                  </div>
                )}
             </div>
             <div className="grid grid-cols-7 gap-1.5">
                {PRESET_COLORS.map(color => (
                  <button 
                    key={color} 
                    onClick={() => toggleColor(color)}
                    className={`w-full aspect-square rounded-md border border-white/5 hover:scale-110 transition-transform cursor-pointer ${colorPalette.includes(color) ? 'ring-2 ring-accent' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
             </div>
          </section>

          {/* Creative References / Pitch Decks (Option B) */}
          <section className="bg-zinc-950/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl space-y-4 shadow-xl">
             <div className="flex items-center gap-3">
               <Link2 className="w-4.5 h-4.5 text-accent" />
               <h3 className="text-xs font-black uppercase tracking-widest text-white">Decks & Creative Links</h3>
             </div>
             
             {/* List existing links */}
             <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
               {activeCreativeLinks.map((link, i) => {
                 // Find index in overall jobLinks array to delete properly
                 const indexInJobLinks = Array.isArray(jobLinks)
                   ? jobLinks.findIndex(jl => jl && typeof jl === 'object' && jl.label === link?.label && jl.url === link?.url)
                   : -1;
                 return (
                   <div key={i} className="flex items-center justify-between p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs hover:border-accent/20 transition-colors group">
                     <a 
                       href={sanitizeUrl(link.url)} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-2 text-white/80 hover:text-accent font-bold truncate pr-2"
                     >
                       <ExternalLink className="w-3 h-3 shrink-0" />
                       <span className="truncate">{link.label}</span>
                     </a>
                     <button 
                       onClick={() => deleteCreativeLink(indexInJobLinks)}
                       className="text-white/20 hover:text-red-500 p-1 rounded transition-colors"
                       title="Delete link"
                     >
                       <Trash2 className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 );
               })}
               {activeCreativeLinks.length === 0 && (
                 <p className="text-[10px] text-white/30 italic py-2 text-center">No reference decks or treatments attached.</p>
               )}
             </div>

             {/* Add link form */}
             <form onSubmit={addCreativeLink} className="space-y-2 pt-2 border-t border-white/5">
                <input 
                  type="text"
                  placeholder="DECK OR MOODBOARD LABEL (E.G. MOODBOARD)"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/15 px-3 py-2 text-[10px] text-white outline-none rounded-lg focus:border-accent font-black uppercase"
                />
                <div className="flex gap-1.5">
                  <input 
                    type="text"
                    placeholder="URL (E.G. PINTEREST.COM/...)"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    required
                    className="flex-grow bg-black/50 border border-white/15 px-3 py-2 text-[10px] text-white outline-none rounded-lg focus:border-accent font-bold"
                  />
                  <button 
                    type="submit"
                    className="bg-accent/20 border border-accent/30 text-accent hover:bg-accent hover:text-white px-3 text-[10px] font-black uppercase rounded-lg transition-colors cursor-pointer"
                  >
                    Add
                  </button>
                </div>
             </form>
          </section>

        </div>

        {/* Right Column: Shotlist & References */}
        <div className="xl:col-span-8 bg-zinc-950/40 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col shadow-xl">
           <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
             <div className="flex items-center gap-3">
               <Film className="w-4.5 h-4.5 text-accent" />
               <h3 className="text-xs font-black uppercase tracking-widest text-white">Production Shotlist & previs</h3>
             </div>
             <button 
               onClick={() => setIsAddingShot(true)}
               className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-1.5 cursor-pointer"
             >
               <Plus className="w-3 h-3" /> Add Shot
             </button>
           </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
              {shotlist.length === 0 ? (
                <div className="py-24 text-center opacity-20 border border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center h-full min-h-[300px]">
                   <Camera className="w-12 h-12 mb-4 opacity-40 text-accent animate-pulse" />
                   <p className="text-xs font-black uppercase tracking-widest">No production storyboard shots mapped.</p>
                </div>
              ) : (
                <div className="space-y-10">
                  {Object.entries(
                    shotlist.reduce((groups: { [key: string]: JobShot[] }, shot) => {
                      const scene = shot.scene_group || 'Scene 1';
                      if (!groups[scene]) groups[scene] = [];
                      groups[scene].push(shot);
                      return groups;
                    }, {})
                  ).map(([sceneName, sceneShots]) => (
                    <div key={sceneName} className="space-y-4">
                      <div className="flex items-center gap-3 border-b border-white/5 pb-2 ml-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{sceneName}</span>
                        <span className="text-[9px] font-bold text-white/30 uppercase">({sceneShots.length} {sceneShots.length === 1 ? 'shot' : 'shots'})</span>
                      </div>
                      
                      <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
                        {sceneShots.map((shot, idx) => (
                          <div 
                            key={shot.id} 
                            className={`break-inside-avoid bg-zinc-950/40 border rounded-2xl p-4 flex flex-col group transition-all duration-300 relative hover:border-accent/40 hover:shadow-[0_10px_30px_rgba(0,119,255,0.08)] mb-6 ${
                              shot.is_special 
                                ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/[0.02] to-transparent shadow-[0_0_20px_rgba(245,158,11,0.05)]' 
                                : 'border-white/5'
                            }`}
                          >
                            {/* Aspect Ratio Composition Overlay */}
                            <AspectRatioMask ratio={shot.aspect_ratio}>
                              {shot.image_url ? (
                                <div className="relative w-full h-full overflow-hidden cursor-pointer">
                                  <img 
                                    src={shot.image_url} 
                                    alt="Previs reference" 
                                    className="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-500"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 gap-2">
                                    <a 
                                      href={shot.image_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="p-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white transition-all hover:scale-110"
                                      title="View Full Image"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  </div>
                                  
                                  {/* Aspect Ratio Badge overlay */}
                                  <span className="absolute bottom-2 left-2 bg-black/70 border border-white/15 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white/90 tracking-widest z-10 pointer-events-none">
                                    {shot.aspect_ratio || '16:9'}
                                  </span>
                                </div>
                              ) : (
                                <div className="h-28 w-full bg-gradient-to-br from-accent/5 to-purple-500/5 border border-dashed border-white/10 flex flex-col items-center justify-center relative">
                                  <Camera className="w-6 h-6 text-white/20 group-hover:text-accent/40 transition-colors" />
                                  <span className="absolute bottom-2 left-2 bg-black/70 border border-white/15 px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-white/90 tracking-widest pointer-events-none">
                                    {shot.aspect_ratio || '16:9'}
                                  </span>
                                </div>
                              )}
                            </AspectRatioMask>

                            {/* Content */}
                            <div className="space-y-3 mt-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black text-accent uppercase bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                                  {shot.shot_number || `#${idx + 1}`}
                                </span>
                                {shot.framing && (
                                  <span className="text-[8px] font-black text-white/50 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded border border-white/10 truncate max-w-[120px]" title={shot.framing}>
                                    {shot.framing}
                                  </span>
                                )}
                              </div>

                              <p className="text-xs font-bold text-white/80 leading-relaxed whitespace-pre-wrap">{shot.description}</p>

                              {shot.equipment && (
                                <div className="flex items-center gap-1.5 pt-2.5 border-t border-white/5">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-white/30 shrink-0">Lens/Rig:</span>
                                  <span className="text-[9px] font-bold text-white/60 truncate uppercase" title={shot.equipment}>{shot.equipment}</span>
                                </div>
                              )}

                              {shot.lighting_setup && (
                                <div className="flex items-center gap-1.5 pt-1">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-white/30 shrink-0">Lighting:</span>
                                  <span className="text-[9px] font-bold text-white/60 truncate uppercase" title={shot.lighting_setup}>{shot.lighting_setup}</span>
                                </div>
                              )}

                              {shot.is_special && (
                                <div className="flex items-center gap-1.5 text-amber-400 text-[8px] font-black uppercase tracking-widest pt-1">
                                  <Bookmark className="w-3 h-3 fill-amber-400" /> Key Visual Shot
                                </div>
                              )}
                            </div>

                            {/* Hover Overlay Buttons */}
                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingShot(shot);
                                  setIsEditingShot(true);
                                }}
                                className="p-1.5 bg-black/60 hover:bg-accent/20 hover:text-accent border border-white/10 rounded-lg text-white/40 transition-colors cursor-pointer"
                                title="Edit shot"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteShot(shot.id);
                                }}
                                className="p-1.5 bg-black/60 hover:bg-red-500/20 hover:text-red-500 border border-white/10 rounded-lg text-white/40 transition-colors cursor-pointer"
                                title="Delete shot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Add Shot Modal */}
      <AnimatePresence>
        {isAddingShot && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative"
             >
               <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                 <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Add Production Shot</h2>
                 <button onClick={() => setIsAddingShot(false)} className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white cursor-pointer">
                   <X className="w-5 h-5" />
                 </button>
               </div>

               <form onSubmit={addShot} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Shot # (Optional)</label>
                   <input 
                     type="text"
                     value={newShot.shot_number || ''}
                     placeholder="E.G. A1"
                     onChange={(e) => setNewShot({ ...newShot, shot_number: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Framing (E.G. MCU / Wide)</label>
                   <input 
                     type="text"
                     value={newShot.framing || ''}
                     placeholder="E.G. MED CLOSE-UP"
                     onChange={(e) => setNewShot({ ...newShot, framing: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Scene / Setup (E.G. Scene 1)</label>
                   <input 
                     type="text"
                     value={newShot.scene_group || ''}
                     placeholder="E.G. SCENE 1"
                     onChange={(e) => setNewShot({ ...newShot, scene_group: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Aspect Ratio</label>
                   <select 
                     value={newShot.aspect_ratio || '16:9'}
                     onChange={(e) => setNewShot({ ...newShot, aspect_ratio: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white cursor-pointer"
                   >
                     <option value="16:9">16:9 (WIDESCREEN)</option>
                     <option value="9:16">9:16 (VERTICAL)</option>
                     <option value="2.39:1">2.39:1 (ANAMORPHIC)</option>
                     <option value="4:3">4:3 (CLASSIC / VINTAGE)</option>
                     <option value="1:1">1:1 (SQUARE)</option>
                   </select>
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Description / Action</label>
                   <textarea 
                     required
                     value={newShot.description || ''}
                     placeholder="E.G. Camera tracks actor across stage as lighting shifts."
                     onChange={(e) => setNewShot({ ...newShot, description: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-sm text-white h-20"
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Specific Equipment / Lenses</label>
                   <input 
                     type="text"
                     value={newShot.equipment || ''}
                     placeholder="E.G. RED V-RAPTOR + 35MM CINE PRIME"
                     onChange={(e) => setNewShot({ ...newShot, equipment: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Lighting Setup / Rig Notes</label>
                   <input 
                     type="text"
                     value={newShot.lighting_setup || ''}
                     placeholder="E.G. APUTURE 600D KEY + 120D BACKLIGHT"
                     onChange={(e) => setNewShot({ ...newShot, lighting_setup: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Reference Screenshot URL</label>
                   <input 
                     type="text"
                     value={newShot.image_url || ''}
                     placeholder="E.G. HTTPS://IMAGE-HOST.COM/IMAGE.PNG"
                     onChange={(e) => setNewShot({ ...newShot, image_url: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-xs text-white"
                   />
                 </div>

                 {/* Special shot toggle (Option B) */}
                 <div className="md:col-span-2 flex items-center gap-3 bg-black/40 border border-white/5 p-4 rounded-xl">
                   <input 
                     type="checkbox"
                     id="specialShotCheck"
                     checked={newShot.is_special || false}
                     onChange={(e) => setNewShot({ ...newShot, is_special: e.target.checked })}
                     className="w-4.5 h-4.5 accent-accent cursor-pointer"
                   />
                   <label htmlFor="specialShotCheck" className="text-xs font-bold text-white/80 cursor-pointer select-none flex items-center gap-1.5">
                     <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                     Mark as &quot;Special Shot&quot; (highlights in storyboard and production brief)
                   </label>
                 </div>

                 <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                   <button 
                     type="button"
                     onClick={() => setIsAddingShot(false)}
                     className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer"
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit"
                     className="bg-accent text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 cursor-pointer"
                   >
                     Add Shot to List
                   </button>
                 </div>
               </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Shot Modal */}
      <AnimatePresence>
        {isEditingShot && editingShot && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="w-full max-w-xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative"
             >
               <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                 <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Edit Production Shot</h2>
                 <button onClick={() => {
                   setIsEditingShot(false);
                   setEditingShot(null);
                 }} className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white cursor-pointer">
                   <X className="w-5 h-5" />
                 </button>
               </div>

               <form onSubmit={saveShotEdit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Shot # (Optional)</label>
                   <input 
                     type="text"
                     value={editingShot.shot_number || ''}
                     placeholder="E.G. A1"
                     onChange={(e) => setEditingShot({ ...editingShot, shot_number: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Framing (E.G. MCU / Wide)</label>
                   <input 
                     type="text"
                     value={editingShot.framing || ''}
                     placeholder="E.G. MED CLOSE-UP"
                     onChange={(e) => setEditingShot({ ...editingShot, framing: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Scene / Setup (E.G. Scene 1)</label>
                   <input 
                     type="text"
                     value={editingShot.scene_group || ''}
                     placeholder="E.G. SCENE 1"
                     onChange={(e) => setEditingShot({ ...editingShot, scene_group: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Aspect Ratio</label>
                   <select 
                     value={editingShot.aspect_ratio || '16:9'}
                     onChange={(e) => setEditingShot({ ...editingShot, aspect_ratio: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white cursor-pointer"
                   >
                     <option value="16:9">16:9 (WIDESCREEN)</option>
                     <option value="9:16">9:16 (VERTICAL)</option>
                     <option value="2.39:1">2.39:1 (ANAMORPHIC)</option>
                     <option value="4:3">4:3 (CLASSIC / VINTAGE)</option>
                     <option value="1:1">1:1 (SQUARE)</option>
                   </select>
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Description / Action</label>
                   <textarea 
                     required
                     value={editingShot.description || ''}
                     placeholder="E.G. Camera tracks actor across stage as lighting shifts."
                     onChange={(e) => setEditingShot({ ...editingShot, description: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-sm text-white h-20"
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Specific Equipment / Lenses</label>
                   <input 
                     type="text"
                     value={editingShot.equipment || ''}
                     placeholder="E.G. RED V-RAPTOR + 35MM CINE PRIME"
                     onChange={(e) => setEditingShot({ ...editingShot, equipment: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Lighting Setup / Rig Notes</label>
                   <input 
                     type="text"
                     value={editingShot.lighting_setup || ''}
                     placeholder="E.G. APUTURE 600D KEY + 120D BACKLIGHT"
                     onChange={(e) => setEditingShot({ ...editingShot, lighting_setup: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-black uppercase text-sm text-white"
                   />
                 </div>
                 <div className="space-y-2 md:col-span-2">
                   <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Reference Screenshot URL</label>
                   <input 
                     type="text"
                     value={editingShot.image_url || ''}
                     placeholder="E.G. HTTPS://IMAGE-HOST.COM/IMAGE.PNG"
                     onChange={(e) => setEditingShot({ ...editingShot, image_url: e.target.value })}
                     className="w-full bg-black/50 border border-white/10 p-3 rounded-xl outline-none focus:border-accent font-bold text-xs text-white"
                   />
                 </div>

                 {/* Special shot toggle */}
                 <div className="md:col-span-2 flex items-center gap-3 bg-black/40 border border-white/5 p-4 rounded-xl">
                   <input 
                     type="checkbox"
                     id="editSpecialShotCheck"
                     checked={editingShot.is_special || false}
                     onChange={(e) => setEditingShot({ ...editingShot, is_special: e.target.checked })}
                     className="w-4.5 h-4.5 accent-accent cursor-pointer"
                   />
                   <label htmlFor="editSpecialShotCheck" className="text-xs font-bold text-white/80 cursor-pointer select-none flex items-center gap-1.5">
                     <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                     Mark as &quot;Special Shot&quot; (highlights in storyboard and production brief)
                   </label>
                 </div>

                 <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                   <button 
                     type="button"
                     onClick={() => {
                       setIsEditingShot(false);
                       setEditingShot(null);
                     }}
                     className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer"
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit"
                     className="bg-accent text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 cursor-pointer"
                   >
                     Save Changes
                   </button>
                 </div>
               </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
