'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  FileDown, 
  RotateCcw, 
  Package,
  X,
  ClipboardList,
  Check
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { INVENTORY, ALL_CATEGORIES } from '@/data/inventory';

interface ManifestItem {
  name: string;
  count: number;
}

export default function Rentals() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [manifest, setManifest] = useState<Record<string, number>>({});
  
  // Job Details
  const [jobTitle, setJobTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [companyName, setCompanyName] = useState('Zipline Media');
  const [companyAddr, setCompanyAddr] = useState('New York, NY');
  const [notes, setNotes] = useState('');
  const [includeReplacementValue, setIncludeReplacementValue] = useState(false);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    return INVENTORY.filter(item => {
      const catMatch = filterCategory === 'All' || item.category === filterCategory;
      const searchMatch = !term || item.name.toLowerCase().includes(term);
      return catMatch && searchMatch;
    });
  }, [search, filterCategory]);

  const manifestGrouped = useMemo(() => {
    const grouped: Record<string, ManifestItem[]> = {};
    Object.entries(manifest).forEach(([name, count]) => {
      if (count <= 0) return;
      const item = INVENTORY.find(i => i.name === name);
      if (!item) return;
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push({ name, count });
    });
    return grouped;
  }, [manifest]);

  const grandTotal = useMemo(() => {
    return Object.entries(manifest).reduce((total, [name, count]) => {
      const item = INVENTORY.find(i => i.name === name);
      return total + (item?.replacement || 0) * count;
    }, 0);
  }, [manifest]);

  const updateManifest = (name: string, dir: number) => {
    const item = INVENTORY.find(i => i.name === name);
    if (!item) return;
    
    setManifest(prev => {
      const current = prev[name] || 0;
      const next = Math.max(0, Math.min(item.qty, current + dir));
      return { ...prev, [name]: next };
    });
  };

  const removeFromManifest = (name: string) => {
    setManifest(prev => {
      const newManifest = { ...prev };
      delete newManifest[name];
      return newManifest;
    });
  };

  const clearManifest = () => setManifest({});
  
  const resetApp = () => {
    clearManifest();
    setJobTitle('');
    setContactEmail('');
    setCompanyName('Zipline Media');
    setCompanyAddr('New York, NY');
    setNotes('');
    setSearch('');
    setFilterCategory('All');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    let y = margin;
    const lineH = 14;
    doc.setLineHeightFactor(1.2);

    const date = new Date().toLocaleDateString();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(companyName || "Gear Manifest", margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    if (jobTitle) { doc.text("Job: " + jobTitle, margin, y); y += lineH; }
    if (contactEmail) { doc.text("Contact: " + contactEmail, margin, y); y += lineH; }
    if (companyAddr) { doc.text(companyAddr, margin, y); y += lineH; }
    doc.text("Date: " + date, margin, y);
    y += 20;

    Object.keys(manifestGrouped).sort().forEach(cat => {
      if (y > 700) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(cat, margin, y);
      y += lineH;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      manifestGrouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(row => {
        const bullet = "- " + row.name + "  (x" + row.count + ")";
        const wrapped = doc.splitTextToSize(bullet, 514);
        wrapped.forEach((ln: string) => {
          if (y > 750) { doc.addPage(); y = margin; }
          doc.text(ln, margin + 12, y);
          y += lineH;
        });
      });
      y += 6;
    });

    if (notes) {
      if (y > 700) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Notes", margin, y);
      y += lineH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(notes, 514);
      wrapped.forEach((ln: string) => {
        if (y > 750) { doc.addPage(); y = margin; }
        doc.text(ln, margin, y);
        y += lineH;
      });
    }

    if (includeReplacementValue) {
      y += 10;
      if (y > 700) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Total Replacement Value: $${grandTotal.toLocaleString()}`, margin, y);
      y += lineH;
    }

    const safeJob = jobTitle ? jobTitle.replace(/[^a-z0-9\-_\s]/gi, "").trim().replace(/\s+/g, "_") : "Gear_Manifest";
    doc.save(`${safeJob || "Gear_Manifest"}.pdf`);
  };

  return (
    <div className="pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Gear Library */}
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-neutral-900/50 border border-white/10 p-8 rounded-2xl">
              <div className="flex flex-col md:flex-row gap-4 mb-8">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  <input 
                    type="text" 
                    placeholder="SEARCH GEAR..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 py-4 pl-12 pr-4 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-xl"
                  />
                </div>
                <select 
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-black/50 border border-white/10 py-4 px-6 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-xl appearance-none cursor-pointer"
                >
                  <option value="All">ALL CATEGORIES</option>
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="py-20 text-center opacity-40">
                    <Package className="w-12 h-12 mx-auto mb-4" />
                    <p className="uppercase text-xs tracking-widest font-bold">No gear found</p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <div 
                      key={item.name}
                      className="group flex items-center justify-between p-4 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="text-sm font-bold uppercase tracking-tight mb-1 truncate">{item.name}</h3>
                        <p className="text-[10px] opacity-40 font-bold uppercase tracking-[0.2em]">
                          {item.category} • QTY: {item.qty} • ${item.replacement.toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => updateManifest(item.name, -1)}
                          disabled={!manifest[item.name]}
                          className="w-8 h-8 flex items-center justify-center border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className={`w-6 text-center text-sm font-black ${manifest[item.name] ? 'text-accent' : 'opacity-20'}`}>
                          {manifest[item.name] || 0}
                        </span>
                        <button 
                          onClick={() => updateManifest(item.name, 1)}
                          disabled={(manifest[item.name] || 0) >= item.qty}
                          className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-lg hover:bg-accent hover:text-white disabled:opacity-20 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Manifest */}
          <div className="lg:col-span-5 space-y-8">
            <section className="bg-neutral-900/80 border border-white/10 p-8 rounded-2xl sticky top-32">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <ClipboardList className="w-5 h-5 text-accent" />
                  <h2 className="text-xl font-black uppercase tracking-tighter">Current Manifest</h2>
                </div>
                {Object.keys(manifest).length > 0 && (
                  <button 
                    onClick={clearManifest}
                    className="text-[10px] font-bold tracking-widest uppercase opacity-40 hover:opacity-100 hover:text-red-500 transition-all flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Job Title</label>
                  <input 
                    type="text" 
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="E.G. NIKE COMMERCIAL"
                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Contact</label>
                  <input 
                    type="text" 
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="EMAIL@CLIENT.COM"
                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Company</label>
                  <input 
                    type="text" 
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Location</label>
                  <input 
                    type="text" 
                    value={companyAddr}
                    onChange={(e) => setCompanyAddr(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1 mb-8">
                <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Production Notes</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="CALL TIME, PARKING, ETC..."
                  className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg resize-none"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {Object.keys(manifestGrouped).length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-20"
                    >
                      <p className="uppercase text-[10px] tracking-[0.3em] font-bold">Manifest is empty</p>
                    </motion.div>
                  ) : (
                    Object.entries(manifestGrouped).map(([cat, items]) => (
                      <motion.div 
                        key={cat}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="mb-6"
                      >
                        <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase text-accent mb-3 ml-1">{cat}</h3>
                        <div className="space-y-2">
                          {items.map((item) => {
                             const invItem = INVENTORY.find(i => i.name === item.name);
                             return (
                              <div key={item.name} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 group">
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="text-xs font-bold uppercase truncate">{item.name}</p>
                                  <p className="text-[10px] opacity-40 font-bold tracking-widest uppercase">
                                    X{item.count} • ${( (invItem?.replacement || 0) * item.count ).toLocaleString()}
                                  </p>
                                </div>
                                <button 
                                  onClick={() => removeFromManifest(item.name)}
                                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-500 transition-all rounded-md"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                             )
                          })}
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-white/10 pt-8 mt-auto space-y-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold tracking-[0.4em] uppercase opacity-40">Total Replacement Value</p>
                    <p className="text-3xl font-black text-accent">${grandTotal.toLocaleString()}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <div className={`w-4 h-4 border border-white/20 rounded flex items-center justify-center transition-all ${includeReplacementValue ? 'bg-accent border-accent' : 'bg-transparent group-hover:border-white/40'}`}>
                      {includeReplacementValue && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Include in PDF</span>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={includeReplacementValue} 
                      onChange={e => setIncludeReplacementValue(e.target.checked)} 
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={resetApp}
                    className="flex items-center justify-center gap-2 border border-white/10 py-4 font-black tracking-widest uppercase text-[10px] hover:bg-white hover:text-black transition-all rounded-xl"
                  >
                    <RotateCcw className="w-3 h-3" /> Reset
                  </button>
                  <button 
                    onClick={exportPDF}
                    disabled={Object.keys(manifest).length === 0}
                    className="flex items-center justify-center gap-2 bg-accent py-4 font-black tracking-widest uppercase text-[10px] hover:bg-white hover:text-black disabled:opacity-20 disabled:hover:bg-accent disabled:hover:text-white transition-all rounded-xl shadow-lg shadow-accent/20"
                  >
                    <FileDown className="w-3 h-3" /> Export PDF
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
        
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--accent);
        }
      `}</style>
    </div>
  );
}
