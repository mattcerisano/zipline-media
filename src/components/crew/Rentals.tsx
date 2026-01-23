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
  Check,
  ChevronDown,
  Layers
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
  const [shootDate, setShootDate] = useState('');
  const [includeReplacementValue, setIncludeReplacementValue] = useState(false);
  const [isMobileManifestOpen, setIsMobileManifestOpen] = useState(false);

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
    setShootDate('');
    setSearch('');
    setFilterCategory('All');
  };

  const exportPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 48;
    const PAGE_BOTTOM = 750;
    let y = margin;
    const lineH = 14;
    doc.setLineHeightFactor(1.2);

    const checkPageBreak = (needed: number) => {
      if (y + needed > PAGE_BOTTOM) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    const date = new Date().toLocaleDateString();
    
    // Header Layout: "Diet Call Sheet" Style
    const rightColX = 350;

    // Row 1: Company Name & Job Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(companyName || "Gear Manifest", margin, y);
    
    if (jobTitle) {
      doc.setFontSize(14);
      doc.text(jobTitle.toUpperCase(), rightColX, y);
    }
    y += 20;

    // Row 2: Address & Shoot Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    if (companyAddr) {
      doc.text(companyAddr, margin, y);
    }
    
    if (shootDate) {
      doc.setFont("helvetica", "bold");
      doc.text("SHOOT DATE: " + shootDate.toUpperCase(), rightColX, y);
      doc.setFont("helvetica", "normal");
    }
    y += 14;

    // Row 3: Contact & Generated Date
    if (contactEmail) {
      doc.text(contactEmail, margin, y);
    }
    
    doc.text("Generated: " + date, rightColX, y);
    y += 30; // Spacing after header

    Object.keys(manifestGrouped).sort().forEach(cat => {
      // Check if we have space for header + 1 item line
      checkPageBreak(30); 

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(cat, margin, y);
      y += 20; // Increased spacing after category header
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      manifestGrouped[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(row => {
        const bullet = "- " + row.name + "  (x" + row.count + ")";
        const wrapped = doc.splitTextToSize(bullet, 514);
        wrapped.forEach((ln: string) => {
          checkPageBreak(lineH);
          doc.text(ln, margin + 12, y);
          y += lineH;
        });
      });
      y += 10; // Increased spacing between categories
    });

    if (notes) {
      checkPageBreak(30); // Ensure space for header + at least one line of notes
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Notes", margin, y);
      y += 16; // Increased spacing after Notes header
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const wrapped = doc.splitTextToSize(notes, 514);
      wrapped.forEach((ln: string) => {
        checkPageBreak(lineH);
        doc.text(ln, margin, y);
        y += lineH;
      });
    }

    if (includeReplacementValue) {
      y += 10;
      checkPageBreak(lineH);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Total Replacement Value: $${grandTotal.toLocaleString()}`, margin, y);
      y += lineH;
    }

    const safeJob = jobTitle ? jobTitle.replace(/[^a-z0-9\-_\s]/gi, "").trim().replace(/\s+/g, "_") : "Gear_Manifest";
    doc.save(`${safeJob || "Gear_Manifest"}.pdf`);
  };

  const ManifestContent = (
    <section className="bg-neutral-900/80 border border-white/10 p-6 md:p-8 rounded-2xl lg:sticky lg:top-32 h-full lg:h-auto flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-black uppercase tracking-tighter">Current Manifest</h2>
        </div>
        <div className="flex items-center gap-4">
          {Object.keys(manifest).length > 0 && (
            <button 
              onClick={clearManifest}
              className="text-[10px] font-bold tracking-widest uppercase opacity-40 hover:opacity-100 hover:text-red-500 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> <span className="hidden md:inline">Clear</span>
            </button>
          )}
          <button 
            onClick={() => setIsMobileManifestOpen(false)}
            className="lg:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
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
          <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Shoot Date</label>
          <input 
            type="text" 
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
            placeholder="MM/DD/YYYY"
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
        <div className="space-y-1 md:col-span-2">
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

      <div className="flex-1 overflow-y-auto min-h-[300px] mb-8 pr-2 custom-scrollbar">
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
  );

  return (
    <div className="pt-8 pb-32 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Gear Library */}
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-neutral-900/50 border border-white/10 p-6 md:p-8 rounded-2xl">
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
                          className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-colors"
                        >
                          <Minus className="w-4 h-4 md:w-3 md:h-3" />
                        </button>
                        <span className={`w-6 text-center text-sm font-black ${manifest[item.name] ? 'text-accent' : 'opacity-20'}`}>
                          {manifest[item.name] || 0}
                        </span>
                        <button 
                          onClick={() => updateManifest(item.name, 1)}
                          disabled={(manifest[item.name] || 0) >= item.qty}
                          className="w-10 h-10 md:w-8 md:h-8 flex items-center justify-center bg-white text-black rounded-lg hover:bg-accent hover:text-white disabled:opacity-20 transition-all"
                        >
                          <Plus className="w-4 h-4 md:w-3 md:h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Desktop Manifest */}
          <div className="hidden lg:block lg:col-span-5 space-y-8">
            {ManifestContent}
          </div>
        </div>

        {/* Mobile Bottom Bar */}
        <AnimatePresence>
          {Object.keys(manifest).length > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-6 left-6 right-6 bg-neutral-900/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl z-40 lg:hidden flex items-center justify-between shadow-2xl ring-1 ring-white/10"
            >
              <div className="flex flex-col">
                <span className="text-[9px] font-bold tracking-[0.2em] uppercase opacity-60 mb-1">Total Value</span>
                <span className="text-xl font-black text-accent">${grandTotal.toLocaleString()}</span>
              </div>
              <button 
                onClick={() => setIsMobileManifestOpen(true)}
                className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-accent hover:text-white transition-all shadow-lg"
              >
                <Layers className="w-4 h-4" /> 
                <span>Manifest ({Object.values(manifest).reduce((a, b) => a + b, 0)})</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Manifest Modal */}
        <AnimatePresence>
          {isMobileManifestOpen && (
            <motion.div 
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-50 bg-neutral-950 lg:hidden flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-4 pt-12 custom-scrollbar">
                {ManifestContent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
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
