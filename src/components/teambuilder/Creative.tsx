'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Palette,
  Film,
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  X,
  Sparkles,
  Link2,
  ExternalLink,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Job } from '@/components/gearbuilder/types';
import ShotlistGrid from '@/components/teambuilder/ShotlistGrid';
import { generateMasterBrief } from '@/lib/pdf-generator';
import { sanitizeUrl } from '@/lib/sanitize';
import { todayLocalISO } from '@/lib/date';
import { orderProductions, productionLabel } from '@/lib/production-order';
import { toast } from '@/components/Feedback';

const PRESET_COLORS = [
  '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3',
  '#000000', '#FFFFFF', '#808080', '#0077FF', '#FF00FF', '#00FFFF', '#FFD700'
];

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
  const [isExporting, setIsExporting] = useState(false);

  // Autosave. The board used to save only on its button, so picking another
  // production — or another tab — dropped everything typed since, and the
  // brief PDF printed whatever was last saved. Edits now save themselves a
  // moment after typing stops, and any pending save is flushed before a
  // switch, an export, or the board closing.
  type BriefData = { concept: string; lighting: string; camera: string; audio: string; palette: string[] };
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  /** What the database holds for the loaded production, to tell an edit from a load. */
  const savedSnapshot = useRef<{ jobId: string; json: string } | null>(null);
  /** The edit waiting out the debounce, tied to the production it was made on. */
  const pendingSave = useRef<{ jobId: string; data: BriefData } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistBrief = useCallback(async (jobId: string, data: BriefData) => {
    setSaveState('saving');
    const { error } = await supabase
      .from('jobs')
      .update({
        creative_brief: JSON.stringify({ concept: data.concept, lighting: data.lighting, camera: data.camera, audio: data.audio }),
        color_palette: data.palette,
      })
      .eq('id', jobId);
    if (error) {
      console.error('Error saving brief:', error);
      setSaveState('error');
      return false;
    }
    if (savedSnapshot.current?.jobId === jobId) savedSnapshot.current = { jobId, json: JSON.stringify(data) };
    setSaveState('saved');
    return true;
  }, []);

  /** Save whatever is waiting now, rather than when the debounce ends. */
  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingSave.current;
    pendingSave.current = null;
    if (pending) return persistBrief(pending.jobId, pending.data);
    return true;
  }, [persistBrief]);
  
  // Creative State
  const [briefConcept, setBriefConcept] = useState('');
  const [briefLighting, setBriefLighting] = useState('');
  const [briefCamera, setBriefCamera] = useState('');
  const [briefAudio, setBriefAudio] = useState('');
  const [colorPalette, setColorPalette] = useState<string[]>([]);
  const [jobLinks, setJobLinks] = useState<any[]>([]);

  // Custom links form state
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

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
      // Soonest shoot first, then past newest first, then undated — the old
      // strip ran newest date first, so it opened on whichever had no date.
      const fetchedJobs = orderProductions(((data || []) as Job[]).filter(j => j.job_status !== 'Wrapped' && j.job_status !== 'Cancelled'), todayLocalISO());
      setJobs(fetchedJobs);

      if (fetchedJobs.length > 0) {
        let activeTab = selectedJobIdProp || selectedJobId;
        const activeIds = fetchedJobs.map(j => j.id);

        // No saved choice: open on the next upcoming shoot.
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
    // The pending save carries its own production id, so it lands on the
    // board it was typed on even though the switch happens first.
    void flushSave();
    setSaveState('idle');
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
          savedSnapshot.current = {
            jobId: selectedJobId,
            json: JSON.stringify({ concept, lighting, camera, audio, palette: job.color_palette || [] }),
          };
          setJobLinks(Array.isArray(job.links) ? job.links : []);
        }
        // Shotlist data is loaded by <ShotlistGrid/> itself.
      } catch (err) {
        console.error('Error fetching creative data:', err);
      }
    };

    fetchCreativeData();
  }, [selectedJobId]);

  // Queue an edit. Skipped until the production's saved brief has loaded,
  // and when the fields still match it, so a load is never mistaken for an edit.
  useEffect(() => {
    const snapshot = savedSnapshot.current;
    if (!selectedJobId || !snapshot || snapshot.jobId !== selectedJobId) return;
    const data: BriefData = { concept: briefConcept, lighting: briefLighting, camera: briefCamera, audio: briefAudio, palette: colorPalette };
    if (JSON.stringify(data) === snapshot.json) return;
    pendingSave.current = { jobId: selectedJobId, data };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushSave(); }, 1200);
  }, [briefConcept, briefLighting, briefCamera, briefAudio, colorPalette, selectedJobId, flushSave]);

  // Leaving the board (another tab, closing the panel) saves what's pending.
  useEffect(() => () => { void flushSave(); }, [flushSave]);

  // The button now means "save this right now", or "try again" after a failure.
  const saveCreativeBoard = async () => {
    if (!selectedJobId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingSave.current = null;
    const ok = await persistBrief(selectedJobId, {
      concept: briefConcept, lighting: briefLighting, camera: briefCamera, audio: briefAudio, palette: colorPalette,
    });
    if (!ok) toast('Failed to save Creative Board.');
  };

  const handleExportPDF = async () => {
    if (!selectedJobId) return;
    setIsExporting(true);
    try {
      // The PDF is built from the database, so unsaved typing has to land first.
      if (!(await flushSave())) {
        toast('Could not save the latest edits, so the brief was not exported.');
        return;
      }
      await generateMasterBrief(selectedJobId);
    } catch (err) {
      console.error(err);
      toast('Failed to export Production Brief PDF.');
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
      toast('Failed to add link');
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
      toast('Failed to delete link');
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
          <h3 className="text-xs font-semibold tracking-tight text-white">No Active Projects</h3>
          <p className="text-[12px] font-medium text-white/30 tracking-tight leading-relaxed">
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
                <label className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] opacity-40 block text-accent mb-0.5">Creative Board Project</label>
                <span className="font-semibold tracking-tight text-lg text-white">
                  {jobs.find(j => j.id === selectedJobIdProp)?.title || 'Loading Project...'}
                </span>
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="creative-production" className="text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 ml-1 text-white">Production</label>
              <select
                id="creative-production"
                value={selectedJobId}
                onChange={(e) => handleSelectTab(e.target.value)}
                className="w-full lg:max-w-xl bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg cursor-pointer text-white"
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{productionLabel(job)}</option>
                ))}
              </select>
            </>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <button 
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-zinc-900 border border-white/10 text-white px-6 py-4 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all flex items-center gap-2.5 justify-center cursor-pointer disabled:opacity-50"
          >
            {isExporting ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileText className="w-3.5 h-3.5 text-accent" />}
            Export Production Brief (PDF)
          </button>
          {/* Saves itself; the button reports where that stands and saves on
              demand — or retries, after a failure. */}
          <button
            onClick={saveCreativeBoard}
            disabled={saveState === 'saving' || !selectedJobId}
            title="Changes save automatically"
            className={`px-6 py-4 rounded-xl font-semibold text-xs transition-all flex items-center gap-2.5 justify-center cursor-pointer disabled:cursor-default ${
              saveState === 'error'
                ? 'bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25'
                : 'bg-zinc-900 border border-white/10 text-white/70 hover:text-white hover:border-white/25'
            }`}
          >
            {saveState === 'saving' ? <Sparkles className="w-3.5 h-3.5 animate-spin" />
              : saveState === 'error' ? <AlertCircle className="w-3.5 h-3.5" />
              : saveState === 'saved' ? <Check className="w-3.5 h-3.5 text-green-400" />
              : <Save className="w-3.5 h-3.5" />}
            {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved — retry' : saveState === 'saved' ? 'All changes saved' : 'Saves automatically'}
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
                <h3 className="text-xs font-semibold tracking-tight text-white">Creative Pillars</h3>
             </div>
             
             {/* Core Concept & Theme */}
             <div className="space-y-1.5">
                <label className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/40 block ml-0.5">1. Core Concept & Theme</label>
                <textarea 
                  value={briefConcept}
                  onChange={(e) => setBriefConcept(e.target.value)}
                  placeholder="What is the story, narrative hook, or overarching theme?"
                  className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
                />
              </div>

              {/* Lighting & Color Direction */}
              <div className="space-y-1.5">
                <label className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/40 block ml-0.5">2. Lighting & Color Direction</label>
                <textarea 
                  value={briefLighting}
                  onChange={(e) => setBriefLighting(e.target.value)}
                  placeholder="High key, moody low key, neon contrast, golden hour warmth..."
                  className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
                />
              </div>

              {/* Camera & Movement Style */}
              <div className="space-y-1.5">
                <label className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/40 block ml-0.5">3. Camera & Movement Style</label>
                <textarea 
                  value={briefCamera}
                  onChange={(e) => setBriefCamera(e.target.value)}
                  placeholder="Handheld kinetic, smooth gimbal, static anamorphic framing..."
                  className="w-full bg-black/40 border border-white/5 p-3 rounded-2xl text-xs text-white/80 outline-none focus:border-accent h-24 resize-none leading-relaxed custom-scrollbar focus:ring-1 focus:ring-accent/30 transition-all duration-300"
                />
              </div>

              {/* Audio & Soundscape Vibe */}
              <div className="space-y-1.5">
                <label className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/40 block ml-0.5">4. Audio & Soundscape Vibe</label>
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
                <h3 className="text-xs font-semibold tracking-tight text-white">Color Palette Swatches</h3>
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
                <h3 className="text-xs font-semibold tracking-tight text-white">Decks & Creative Links</h3>
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
                   placeholder="Deck or moodboard label (e.g. Moodboard)"
                   value={newLinkLabel}
                   onChange={(e) => setNewLinkLabel(e.target.value)}
                   required
                   className="w-full bg-black/50 border border-white/15 px-3 py-2 text-[10px] text-white outline-none rounded-lg focus:border-accent font-semibold"
                 />
                 <div className="flex gap-1.5">
                   <input 
                     type="text"
                     placeholder="URL (e.g. pinterest.com/...)"
                     value={newLinkUrl}
                     onChange={(e) => setNewLinkUrl(e.target.value)}
                     required
                     className="flex-grow bg-black/50 border border-white/15 px-3 py-2 text-[10px] text-white outline-none rounded-lg focus:border-accent font-semibold"
                   />
                   <button 
                     type="submit"
                     className="bg-accent/20 border border-accent/30 text-accent hover:bg-accent hover:text-white px-3 text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
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
                <h3 className="text-xs font-semibold tracking-tight text-white">Production Shotlist & Previs</h3>
              </div>
              <span className="text-[10px] font-medium text-white/30 tracking-tight">Spreadsheet view</span>
            </div>

             <ShotlistGrid jobId={selectedJobId} />
         </div>
       </div>
    </div>
  );
}
