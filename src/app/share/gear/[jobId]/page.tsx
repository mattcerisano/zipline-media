'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  FileDown, 
  Package, 
  X, 
  Check, 
  FolderOpen, 
  RefreshCw, 
  ExternalLink,
  Wrench,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';

// Define structures matching the main catalog
interface InventoryItem {
  id?: string;
  name: string;
  category: string;
  qty: number;
  replacement: number;
  image?: string;
  owner?: string;
}

interface Job {
  id: string;
  title: string;
  shoot_date: string;
  client_name?: string;
  production_company?: string;
  gear_manifest?: Record<string, number>;
  notes_general?: string;
}

const ALL_CATEGORIES = [
  "Camera",
  "Lens",
  "Lens Accessories",
  "Grip/Support",
  "Lighting",
  "Modifiers",
  "Stands/Grip",
  "Audio",
  "Playback & Wireless Video",
  "Power",
  "Comms",
  "Carts/Cases",
  "Computing",
  "Backdrops",
  "Specialty"
];

export default function ShareGearPage() {
  const params = useParams();
  const jobId = params?.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [manifest, setManifest] = useState<Record<string, number>>({});
  
  // Custom items created during this share session
  const [customGear, setCustomGear] = useState<InventoryItem[]>([]);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState(ALL_CATEGORIES[0]);
  const [customQty, setCustomQty] = useState(1);
  const [customValue, setCustomValue] = useState(0);
  const [customOwner, setCustomOwner] = useState('');

  // UI filters & loading state
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'Synced' | 'Saving' | 'Error'>('Synced');

  // Track database-saved manifest to prevent redundant API triggers
  const lastSavedManifestRef = useRef<string>('');

  // Fetch initial job and catalog details
  useEffect(() => {
    if (!jobId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [jobRes, catalogRes] = await Promise.all([
          supabase.from('jobs').select('*').eq('id', jobId).single(),
          supabase.from('inventory').select('*').order('name')
        ]);

        if (jobRes.error) throw jobRes.error;
        if (catalogRes.error) throw catalogRes.error;

        const jobData = jobRes.data as Job;
        setJob(jobData);
        setCatalog(catalogRes.data as InventoryItem[]);

        const initialManifest = (jobData.gear_manifest || {}) as Record<string, number>;
        setManifest(initialManifest);
        lastSavedManifestRef.current = JSON.stringify(initialManifest);

        // Auto-recreate missing custom items from the manifest in customGear
        const dbItems = catalogRes.data as InventoryItem[];
        const missingKeys = Object.keys(initialManifest).filter(
          name => !dbItems.some(i => i.name === name)
        );

        if (missingKeys.length > 0) {
          const generatedCustoms = missingKeys.map(name => ({
            name,
            category: 'Specialty',
            qty: 100, // Safe default limit
            replacement: 0,
            owner: 'Custom'
          }));
          setCustomGear(generatedCustoms);
        }

      } catch (err) {
        console.error('[Share Gear] Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [jobId]);

  // Supabase Real-Time Listener to sync edits from other collaborators
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`public:jobs:id=eq.${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => {
          if (payload.new && payload.new.gear_manifest) {
            const newManifest = payload.new.gear_manifest as Record<string, number>;
            const newManifestStr = JSON.stringify(newManifest);
            
            // Only update if changes came from another collaborator
            if (newManifestStr !== JSON.stringify(manifest)) {
              setManifest(newManifest);
              lastSavedManifestRef.current = newManifestStr;
              setSaveStatus('Synced');
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, manifest]);

  // Debounced API updates to Supabase
  useEffect(() => {
    if (!jobId || isLoading) return;

    const manifestStr = JSON.stringify(manifest);
    if (manifestStr === lastSavedManifestRef.current) return;

    setSaveStatus('Saving');

    const delay = setTimeout(async () => {
      try {
        const res = await fetch('/api/share/gear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, gear_manifest: manifest })
        });
        const data = await res.json();
        if (data.success) {
          lastSavedManifestRef.current = manifestStr;
          setSaveStatus('Synced');
        } else {
          setSaveStatus('Error');
        }
      } catch (err) {
        console.error('[Share Gear] Save error:', err);
        setSaveStatus('Error');
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(delay);
  }, [manifest, jobId, isLoading]);

  // Combine DB catalog and custom session gear
  const allInventory = useMemo(() => {
    return [...catalog, ...customGear].sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, customGear]);

  // Filter catalog items by search query & category selection
  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allInventory.filter(item => {
      const catMatch = filterCategory === 'All' || item.category === filterCategory;
      const searchMatch = !term || item.name.toLowerCase().includes(term);
      return catMatch && searchMatch;
    });
  }, [search, filterCategory, allInventory]);

  // Calculate Manifest Organised by Owner
  const manifestByOwner = useMemo(() => {
    const byOwner: Record<string, Record<string, { name: string; count: number }[]>> = {};
    Object.entries(manifest).forEach(([name, count]) => {
      if (count <= 0) return;
      const item = allInventory.find(i => i.name === name);
      const owner = item?.owner || 'Zipline Media';
      const category = item?.category || 'Specialty';

      if (!byOwner[owner]) byOwner[owner] = {};
      if (!byOwner[owner][category]) byOwner[owner][category] = [];
      byOwner[owner][category].push({ name, count });
    });
    return byOwner;
  }, [manifest, allInventory]);

  // Calculate manifest grand total replacement value
  const grandTotal = useMemo(() => {
    return Object.entries(manifest).reduce((total, [name, count]) => {
      const item = allInventory.find(i => i.name === name);
      return total + (item?.replacement || 0) * count;
    }, 0);
  }, [manifest, allInventory]);

  // Quantity updates
  const updateQty = (name: string, dir: number) => {
    const item = allInventory.find(i => i.name === name);
    if (!item) return;

    setManifest(prev => {
      const current = prev[name] || 0;
      const next = Math.max(0, Math.min(item.qty, current + dir));
      
      const newManifest = { ...prev };
      if (next === 0) {
        delete newManifest[name];
      } else {
        newManifest[name] = next;
      }
      return newManifest;
    });
  };

  const removeFromManifest = (name: string) => {
    setManifest(prev => {
      const newManifest = { ...prev };
      delete newManifest[name];
      return newManifest;
    });
  };

  const addCustomItem = () => {
    if (!customName.trim()) return;

    const finalName = customOwner.trim() ? `${customName.trim()} [${customOwner.trim()}]` : customName.trim();
    if (allInventory.some(i => i.name.toLowerCase() === finalName.toLowerCase())) {
      alert('An item with this name already exists.');
      return;
    }

    const newItem: InventoryItem = {
      name: finalName,
      category: customCategory,
      qty: customQty,
      replacement: customValue,
      owner: customOwner.trim() || undefined
    };

    setCustomGear(prev => [...prev, newItem]);
    setManifest(prev => ({ ...prev, [finalName]: 1 }));
    setCustomName('');
    setCustomOwner('');
    setIsCustomModalOpen(false);
  };

  // PDF Export
  const exportPDF = () => {
    if (!job) return;

    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let y = 50;

    const PRIMARY_BLUE = '#0077FF';
    const TEXT_DARK = '#111111';
    const TEXT_GRAY = '#666666';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(PRIMARY_BLUE);
    doc.text('GEAR MANIFEST', margin, y);

    doc.setFontSize(9);
    doc.setTextColor(TEXT_GRAY);
    doc.text(new Date().toLocaleDateString(), pageWidth - margin, y, { align: 'right' });

    y += 25;
    doc.setDrawColor(PRIMARY_BLUE);
    doc.setLineWidth(2);
    doc.line(margin, y, pageWidth - margin, y);

    y += 25;
    doc.setFontSize(14);
    doc.setTextColor(TEXT_DARK);
    doc.text(job.title.toUpperCase(), margin, y);

    doc.setFontSize(10);
    doc.setTextColor(TEXT_GRAY);
    doc.text(`SHOOT DATE: ${job.shoot_date}`, margin, y + 15);

    y += 45;

    Object.keys(manifestByOwner).forEach(owner => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(TEXT_DARK);
      doc.text(owner.toUpperCase(), margin, y);
      y += 15;

      Object.entries(manifestByOwner[owner]).forEach(([cat, items]) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(PRIMARY_BLUE);
        doc.text(cat.toUpperCase(), margin + 10, y);
        y += 12;

        items.forEach(item => {
          if (y > 720) {
            doc.addPage();
            y = 50;
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(TEXT_DARK);
          doc.text(`${item.count}x`, margin + 20, y);
          doc.text(item.name, margin + 45, y);

          const inv = allInventory.find(i => i.name === item.name);
          const replacementVal = ((inv?.replacement || 0) * item.count);
          if (replacementVal > 0) {
            doc.text(`$${replacementVal.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
          }

          y += 16;
        });

        y += 8;
      });

      y += 12;
    });

    if (grandTotal > 0) {
      y += 15;
      doc.setDrawColor(200);
      doc.setLineWidth(1);
      doc.line(margin, y, pageWidth - margin, y);
      y += 20;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TEXT_DARK);
      doc.text('TOTAL REPLACEMENT VALUE:', margin, y);
      doc.text(`$${grandTotal.toLocaleString()}`, pageWidth - margin, y, { align: 'right' });
    }

    doc.save(`${job.title.replace(/\s+/g, '_')}_Gear_Manifest.pdf`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff01_1px,transparent_1px),linear-gradient(to_bottom,#ffffff01_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(0,119,255,0.2)]" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
        <div className="text-center space-y-4 max-w-md bg-zinc-950/80 border border-white/10 p-10 rounded-2xl">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-black uppercase tracking-tighter">Shared Link Invalid</h2>
          <p className="text-xs text-white/50 leading-relaxed">This gear list URL is expired, deleted, or incorrect. Please contact the administrator for a fresh collaboration link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 lg:p-12 relative overflow-hidden flex flex-col">
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff01_1px,transparent_1px),linear-gradient(to_bottom,#ffffff01_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 bg-zinc-950/40 border border-white/10 backdrop-blur-md p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Gear Collaboration Feed</span>
            <div className="flex items-center gap-2 px-2.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
              <div className={`w-1.5 h-1.5 bg-green-500 rounded-full ${saveStatus === 'Saving' ? 'animate-ping' : ''}`} />
              <span className="text-[8px] font-black uppercase tracking-widest text-green-400">
                {saveStatus === 'Saving' ? 'Syncing...' : saveStatus === 'Error' ? 'Sync Failed' : 'Live Sync'}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white">{job.title}</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mt-1">Shoot Date: {job.shoot_date}</p>
        </div>

        <div className="flex gap-2.5 w-full md:w-auto">
          <button 
            onClick={() => setIsCustomModalOpen(true)}
            className="flex-1 md:flex-none bg-white/5 border border-white/10 text-white hover:bg-white hover:text-black py-3.5 px-6 font-black tracking-widest uppercase text-[10px] rounded-xl transition-all"
          >
            + Add Custom Item
          </button>
          <button 
            onClick={exportPDF}
            disabled={Object.keys(manifest).length === 0}
            className="flex-1 md:flex-none bg-accent text-white hover:bg-white hover:text-black disabled:opacity-20 disabled:hover:bg-accent disabled:hover:text-white py-3.5 px-6 font-black tracking-widest uppercase text-[10px] rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
          >
            <FileDown className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 flex-1">
        {/* Left Side: Catalog Browse */}
        <div className="lg:col-span-7 flex flex-col bg-zinc-950/40 border border-white/10 rounded-2xl p-6 h-[calc(100vh-270px)] min-h-[500px]">
          
          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-grow">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text"
                  placeholder="SEARCH CATALOG GEAR..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 p-3.5 pl-10 rounded-xl outline-none focus:border-accent text-xs font-bold uppercase tracking-wider text-white"
                />
              </div>

              {/* Category Dropdown */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-black/50 border border-white/10 px-4 py-3.5 rounded-xl outline-none focus:border-accent text-xs font-bold uppercase tracking-wider text-white"
              >
                <option value="All">All Categories</option>
                {ALL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Listing */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
            {filteredItems.map(item => {
              const currentCount = manifest[item.name] || 0;
              return (
                <div 
                  key={item.name} 
                  className={`flex items-center justify-between p-3.5 bg-white/5 border rounded-xl hover:bg-white/[0.08] transition-all group ${
                    currentCount > 0 ? 'border-accent/40 bg-accent/[0.02]' : 'border-white/5'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <p className={`text-xs font-bold uppercase ${currentCount > 0 ? 'text-accent' : 'text-white'}`}>{item.name}</p>
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mt-1">
                      {item.category} • Qty: {item.qty} {item.owner ? `• ${item.owner}` : ''}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {currentCount > 0 ? (
                      <div className="flex items-center gap-2 bg-black/45 border border-white/10 p-1.5 rounded-lg">
                        <button 
                          onClick={() => updateQty(item.name, -1)}
                          className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-white px-2 min-w-4 text-center">{currentCount}</span>
                        <button 
                          onClick={() => updateQty(item.name, 1)}
                          disabled={currentCount >= item.qty}
                          className="p-1 hover:bg-white/10 rounded text-white/50 hover:text-white transition-colors disabled:opacity-20"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => updateQty(item.name, 1)}
                        className="py-2 px-4 bg-white/5 border border-white/10 text-white hover:bg-accent hover:border-accent hover:text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="py-24 text-center border border-dashed border-white/10 rounded-2xl opacity-30">
                <Wrench className="w-10 h-10 mx-auto mb-3 text-accent animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-widest">No matching gear in catalog.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Manifest Summary */}
        <div className="lg:col-span-5 flex flex-col bg-zinc-950/40 border border-white/10 rounded-2xl p-6 h-[calc(100vh-270px)] min-h-[500px]">
          <h2 className="text-sm font-black uppercase tracking-tighter mb-4 flex items-center justify-between">
            <span>Project Manifest</span>
            <span className="text-[10px] font-black uppercase tracking-widest text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded">
              {Object.keys(manifest).length} Unique Items
            </span>
          </h2>

          {/* Selected Items List */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4 mb-4">
            {Object.keys(manifestByOwner).map(owner => (
              <div key={owner} className="space-y-3">
                <h3 className={`text-[10px] font-black uppercase tracking-widest border-b border-white/5 pb-1 ${
                  owner === 'Zipline Media' ? 'text-white/40' : 'text-red-400'
                }`}>
                  {owner}
                </h3>
                {Object.entries(manifestByOwner[owner]).map(([cat, items]) => (
                  <div key={cat} className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-accent/60 pl-2">{cat}</p>
                    <div className="space-y-1.5">
                      {items.map(item => {
                        const inv = allInventory.find(i => i.name === item.name);
                        return (
                          <div key={item.name} className="flex items-center justify-between p-3 bg-black/45 border border-white/5 rounded-xl group transition-all">
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-xs font-bold uppercase text-white/95 truncate">{item.name}</p>
                              <p className="text-[8px] font-black uppercase tracking-widest text-white/30 mt-0.5">
                                Qty: {item.count} {inv?.replacement ? `• $${(inv.replacement * item.count).toLocaleString()}` : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => updateQty(item.name, -1)}
                                className="p-1 hover:bg-white/10 text-white/40 hover:text-white rounded transition-colors"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => removeFromManifest(item.name)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded transition-all"
                                title="Remove item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {Object.keys(manifest).length === 0 && (
              <div className="py-24 text-center opacity-25 border border-dashed border-white/10 rounded-2xl h-full flex flex-col justify-center items-center">
                <Package className="w-12 h-12 mb-3 text-accent animate-bounce" />
                <p className="text-xs font-bold uppercase tracking-widest">Manifest is empty.</p>
                <p className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-55">Select gear from catalog to add.</p>
              </div>
            )}
          </div>

          {/* Grand Total Footer */}
          {grandTotal > 0 && (
            <div className="border-t border-white/10 pt-4 bg-zinc-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Grand Est. Replacement Value</span>
                <span className="text-lg font-black uppercase tracking-tight text-white">${grandTotal.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Item Modal */}
      <AnimatePresence>
        {isCustomModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsCustomModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                  <Package className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">Add Custom Item</h3>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">Collaborator Custom Gear Builder</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 text-white">Item Name</label>
                  <input 
                    type="text" 
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="E.G. RED KOMODO 6K WRAPPER KIT"
                    className="w-full bg-black/50 border border-white/10 px-4 py-3 outline-none text-xs rounded-xl text-white uppercase font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 text-white">Category</label>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 outline-none text-xs rounded-xl text-white"
                    >
                      {ALL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 text-white">Owner / Source</label>
                    <input 
                      type="text" 
                      value={customOwner}
                      onChange={(e) => setCustomOwner(e.target.value)}
                      placeholder="E.G. COLLABORATOR / CLIENT"
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 outline-none text-xs rounded-xl text-white uppercase font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 text-white">Max Quantity Available</label>
                    <input 
                      type="number" 
                      min={1}
                      value={customQty}
                      onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 outline-none text-xs rounded-xl text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 text-white">Replacement Value ($)</label>
                    <input 
                      type="number" 
                      min={0}
                      value={customValue}
                      onChange={(e) => setCustomValue(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-black/50 border border-white/10 px-4 py-3 outline-none text-xs rounded-xl text-white font-bold"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsCustomModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={addCustomItem}
                    disabled={!customName.trim()}
                    className="flex-1 py-3 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white hover:text-black disabled:opacity-50 transition-all shadow-lg shadow-accent/20"
                  >
                    Add to Manifest
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
