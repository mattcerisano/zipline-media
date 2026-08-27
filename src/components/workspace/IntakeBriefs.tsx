'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  FileText, 
  Link, 
  Compass, 
  Monitor, 
  X, 
  Trash2, 
  CheckCircle,
  Inbox,
  LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface ClientIntake {
  id: string;
  client_id: string;
  client_name: string;
  project_title: string;
  creative_brief: string;
  aspect_ratios: string[];
  reference_links: string[];
  status: 'pending_review' | 'approved' | 'pre_production';
  created_at?: string;
}

interface Client {
  id: string;
  name: string;
}

export default function IntakeBriefs() {
  const [intakes, setIntakes] = useState<ClientIntake[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [useLocalStorage, setUseLocalStorage] = useState(false);

  // Form states for new brief modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBrief, setNewBrief] = useState('');
  const [selectedRatios, setSelectedRatios] = useState<string[]>(['16:9']);
  const [newRefLink, setNewRefLink] = useState('');
  const [refLinks, setRefLinks] = useState<string[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch clients & briefs from Supabase or LocalStorage fallback
  const fetchInitialData = async () => {
    setIsLoading(true);
    let loadedClients: Client[] = [];
    let loadedIntakes: ClientIntake[] = [];
    let fallback = false;

    // 1. Fetch Clients
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      loadedClients = data || [];
    } catch (err) {
      console.warn('Clients database query failed in Briefs, using mock:');
      loadedClients = [
        { id: 'client-1', name: 'Zipline Productions' },
        { id: 'client-2', name: 'Broadway Reels Inc' },
        { id: 'client-3', name: 'Showtime Media' }
      ];
    }

    // 2. Fetch Briefs
    try {
      const { data, error } = await supabase
        .from('client_intakes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      loadedIntakes = data || [];
    } catch (err) {
      console.warn('Client intakes table not found. Using local storage fallback.');
      fallback = true;
    }

    if (fallback || loadedIntakes.length === 0) {
      setUseLocalStorage(true);
      const local = localStorage.getItem('studio_client_intakes_local');
      if (local) {
        try {
          loadedIntakes = JSON.parse(local);
        } catch (e) {
          loadedIntakes = [];
        }
      } else {
        // High fidelity mock intakes database
        loadedIntakes = [
          {
            id: 'intake-1',
            client_id: loadedClients[0]?.id || 'client-1',
            client_name: loadedClients[0]?.name || 'Zipline Productions',
            project_title: 'Summer Brand Commercial Campaign',
            creative_brief: 'Create a 30-second high-energy cinematic commercial showcasing our summer apparel. Heavy emphasis on outdoor sports, ocean b-roll, and sun flares. Fast editing style matching licensed EDM soundtrack.',
            aspect_ratios: ['16:9', '9:16'],
            reference_links: ['https://vimeo.com/channels/staffpicks', 'https://vimeo.com/12345678'],
            status: 'pre_production'
          },
          {
            id: 'intake-2',
            client_id: loadedClients[1]?.id || 'client-2',
            client_name: loadedClients[1]?.name || 'Broadway Reels Inc',
            project_title: 'Cast Recording Highlight Reel',
            creative_brief: 'Document the behind-the-scenes recording session of the new Broadway cast album. Capture raw vocal takes, conductor cues, and micro-interviews with the lead vocalists. Focus on the emotional connection of the performers.',
            aspect_ratios: ['16:9', '1:1'],
            reference_links: ['https://youtube.com/watch?v=castreel'],
            status: 'pending_review'
          }
        ];
        localStorage.setItem('studio_client_intakes_local', JSON.stringify(loadedIntakes));
      }
    }

    setClients(loadedClients);
    setIntakes(loadedIntakes);
    setIsLoading(false);
  };

  // Save changes to active brief list
  const saveIntakesList = async (updatedList: ClientIntake[]) => {
    setIntakes(updatedList);
    if (useLocalStorage) {
      localStorage.setItem('studio_client_intakes_local', JSON.stringify(updatedList));
    }
  };

  // Add new intake brief
  const handleAddBrief = async () => {
    if (!selectedClientId || !newTitle.trim() || !newBrief.trim()) return;

    const clientObj = clients.find(c => c.id === selectedClientId);
    const newIntake: ClientIntake = {
      id: 'intake_' + Date.now(),
      client_id: selectedClientId,
      client_name: clientObj?.name || 'Unknown Client',
      project_title: newTitle.trim(),
      creative_brief: newBrief.trim(),
      aspect_ratios: selectedRatios,
      reference_links: refLinks,
      status: 'pending_review'
    };

    const updated = [newIntake, ...intakes];
    await saveIntakesList(updated);

    if (!useLocalStorage) {
      try {
        await supabase
          .from('client_intakes')
          .insert(newIntake);
      } catch (err) {
        console.error('Failed to sync brief to Supabase:', err);
      }
    }

    // Reset form states
    setNewTitle('');
    setNewBrief('');
    setSelectedRatios(['16:9']);
    setRefLinks([]);
    setNewRefLink('');
    setIsModalOpen(false);
  };

  // Delete an intake brief
  const handleDeleteBrief = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brief?')) return;
    const updated = intakes.filter(i => i.id !== id);
    await saveIntakesList(updated);

    if (!useLocalStorage) {
      try {
        await supabase
          .from('client_intakes')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.error('Failed to delete brief from Supabase:', err);
      }
    }
  };

  // Update status of a brief
  const handleUpdateStatus = async (id: string, newStatus: ClientIntake['status']) => {
    const updated = intakes.map(i => i.id === id ? { ...i, status: newStatus } : i);
    await saveIntakesList(updated);

    if (!useLocalStorage) {
      try {
        await supabase
          .from('client_intakes')
          .update({ status: newStatus })
          .eq('id', id);
      } catch (err) {
        console.error('Failed to update brief status in Supabase:', err);
      }
    }
  };

  // Add visual reference link
  const addRefLink = () => {
    if (newRefLink.trim()) {
      let url = newRefLink.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      setRefLinks([...refLinks, url]);
      setNewRefLink('');
    }
  };

  // Remove visual reference link
  const removeRefLink = (idx: number) => {
    setRefLinks(refLinks.filter((_, i) => i !== idx));
  };

  // Filter briefs
  const filteredIntakes = intakes.filter(item => {
    const matchesSearch = 
      item.project_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.creative_brief.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === null || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white overflow-hidden p-6">
      {/* HEADER ACTION BAR */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tighter text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-accent" /> Creative Briefs & Intake
          </h1>
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mt-0.5">
            Collect client requirements, creative mood briefs, and delivery aspect ratios
          </p>
        </div>

        <button
          onClick={() => {
            if (clients.length > 0) {
              setSelectedClientId(clients[0].id);
            }
            setIsModalOpen(true);
          }}
          className="bg-accent hover:bg-white hover:text-black text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/15 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Log Client Brief
        </button>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/40" />
          <input 
            type="text"
            placeholder="Search briefs by client, project title, or description…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/40 border border-white/10 pl-10 pr-4 py-3 rounded-xl text-xs font-semibold outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/40">Status:</span>
          <div className="flex bg-zinc-900/40 border border-white/10 p-1 rounded-xl gap-1">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-[11px] md:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                statusFilter === null ? 'bg-accent text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              All
            </button>
            {[
              { val: 'pending_review', label: 'Pending' },
              { val: 'approved', label: 'Approved' },
              { val: 'pre_production', label: 'In Pre-Prod' }
            ].map(item => (
              <button
                key={item.val}
                onClick={() => setStatusFilter(item.val)}
                className={`px-3 py-1.5 rounded-lg text-[11px] md:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === item.val ? 'bg-accent text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BRIEFS LIST CONTAINER */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/40 gap-2">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs uppercase font-bold tracking-wider">Intake pipeline…</span>
          </div>
        ) : filteredIntakes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredIntakes.map(item => (
              <div 
                key={item.id}
                className="bg-zinc-900/30 border border-white/10 rounded-3xl p-6 flex flex-col gap-4 group transition-all relative overflow-hidden"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-[11px] md:text-[9px] font-black uppercase tracking-widest text-accent">
                      {item.client_name}
                    </span>
                    <h3 className="text-base font-bold tracking-tight text-white uppercase mt-2">{item.project_title}</h3>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateStatus(item.id, e.target.value as any)}
                      className={`text-[11px] md:text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border cursor-pointer outline-none ${
                        item.status === 'pre_production' 
                          ? 'bg-blue-500/15 border-blue-500/20 text-blue-400' 
                          : item.status === 'approved'
                          ? 'bg-green-500/15 border-green-500/20 text-green-400'
                          : 'bg-yellow-500/15 border-yellow-500/20 text-yellow-400'
                      }`}
                    >
                      <option value="pending_review">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="pre_production">In Pre-Prod</option>
                    </select>
                  </div>
                </div>

                {/* Brief details content */}
                <div className="space-y-4 flex-grow">
                  {/* Creative brief text */}
                  <div>
                    <p className="text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> Creative Brief
                    </p>
                    <p className="text-xs text-white/85 leading-relaxed mt-1 whitespace-pre-wrap">{item.creative_brief}</p>
                  </div>

                  {/* Aspect ratios & deliverables */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5" /> Ratios
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.aspect_ratios.map(ratio => (
                          <span key={ratio} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[11px] md:text-[9px] font-black tracking-wide text-white/80">
                            {ratio}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Reference links */}
                    <div>
                      <p className="text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/30 flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5" /> References
                      </p>
                      <div className="space-y-1 mt-1.5">
                        {item.reference_links.length > 0 ? (
                          item.reference_links.map((url, i) => (
                            <a 
                              key={i} 
                              href={url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[11px] md:text-[9px] font-semibold text-accent hover:underline truncate block max-w-[180px]"
                            >
                              {url.replace(/^https?:\/\/(www\.)?/i, '')}
                            </a>
                          ))
                        ) : (
                          <span className="text-[11px] md:text-[9px] text-white/20 italic">No links added</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer action */}
                <div className="border-t border-white/5 pt-4 flex justify-end">
                  <button
                    onClick={() => handleDeleteBrief(item.id)}
                    className="p-2 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-xl text-red-400/60 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex items-center gap-1 text-[11px] md:text-[9px] font-black uppercase tracking-widest"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Brief
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-white/30 space-y-4">
            <Inbox className="w-12 h-12 text-white/10 mx-auto" />
            <h3 className="text-sm font-semibold uppercase tracking-wider">No onboarding briefs found</h3>
            <p className="text-xs text-white/25 max-w-xs mx-auto">Click "Log Client Brief" to document a new project briefing.</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════ NEW BRIEF FORM MODAL ═══════════════════════ */}
      <AnimatePresence>
        {isModalOpen && (
          <div 
            onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl text-white cursor-default relative overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/55 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold tracking-tight text-white mb-6">Log Client Creative Brief</h2>

              <div className="space-y-4">
                {/* Select Client */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Client Association</label>
                  {clients.length > 0 ? (
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white cursor-pointer"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-950 text-white font-bold">{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-red-400 italic">No clients found. Please create one in Rolodex first.</p>
                  )}
                </div>

                {/* Project Title */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Project Title</label>
                  <input 
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Autumn Product Reveal"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30"
                  />
                </div>

                {/* Brief description */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Creative Guidelines & Brief</label>
                  <textarea 
                    required
                    value={newBrief}
                    onChange={(e) => setNewBrief(e.target.value)}
                    placeholder="Provide description of shoot, theme, pacing, style guides..."
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30 h-24 resize-none"
                  />
                </div>

                {/* Aspect Ratio Checks */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Delivery Aspect Ratios</label>
                  <div className="flex gap-4">
                    {['16:9', '9:16', '1:1', '4:5'].map(ratio => {
                      const checked = selectedRatios.includes(ratio);
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setSelectedRatios(
                            checked 
                              ? selectedRatios.filter(r => r !== ratio) 
                              : [...selectedRatios, ratio]
                          )}
                          className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            checked 
                              ? 'bg-accent/15 border-accent/45 text-white' 
                              : 'bg-black/40 border-white/5 text-white/50 hover:text-white'
                          }`}
                        >
                          {ratio}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reference links */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Visual References (Mood boards/Vimeo)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newRefLink}
                      onChange={(e) => setNewRefLink(e.target.value)}
                      placeholder="e.g. vimeo.com/12345"
                      onKeyDown={(e) => e.key === 'Enter' && addRefLink()}
                      className="flex-grow bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs font-semibold outline-none focus:border-accent"
                    />
                    <button 
                      type="button"
                      onClick={addRefLink}
                      className="px-4 bg-white/10 hover:bg-white hover:text-black border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {/* Link list */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {refLinks.map((link, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-white/5 border border-white/5 text-[11px] md:text-[9px] font-bold text-accent flex items-center gap-1.5">
                        {link.replace(/^https?:\/\/(www\.)?/i, '')}
                        <button type="button" onClick={() => removeRefLink(idx)} className="hover:text-red-400 font-bold transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-6">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleAddBrief}
                    disabled={!selectedClientId || !newTitle.trim() || !newBrief.trim()}
                    className="bg-accent text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Save Brief
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
