'use client';

import React, { useState, useMemo, useEffect } from 'react';

import NextImage from 'next/image';

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

  Layers,

  User,

  Pencil

} from 'lucide-react';

import { jsPDF } from 'jspdf';

import { INVENTORY, ALL_CATEGORIES, type InventoryItem } from '@/data/inventory';



interface ManifestItem {

  name: string;

  count: number;

}



// Optimized Tooltip

const ImageTooltip = ({ src }: { src: string }) => {

  const [pos, setPos] = useState({ x: 0, y: 0 });



  useEffect(() => {

    const handleMove = (e: MouseEvent) => {

      setPos({ x: e.clientX, y: e.clientY });

    };

    window.addEventListener('mousemove', handleMove);

    return () => window.removeEventListener('mousemove', handleMove);

  }, []);



  return (

    <motion.div

      initial={{ opacity: 0, scale: 0.9 }}

      animate={{ opacity: 1, scale: 1 }}

      exit={{ opacity: 0, scale: 0.9 }}

      transition={{ type: "spring", stiffness: 400, damping: 25 }}

      style={{ 

        position: 'fixed', 

        left: pos.x + 20, 

        top: pos.y - 140,

        zIndex: 100 

      }}

      className="pointer-events-none hidden md:block"

    >

      <div className="w-64 h-64 bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 p-2 backdrop-blur-xl">

        <div className="w-full h-full bg-white rounded-xl overflow-hidden relative">

          <NextImage 

            src={src} 

            alt="Gear Preview" 

            fill

            sizes="256px"

            className="object-contain p-2"

          />

        </div>

      </div>

    </motion.div>

  );

};

const GearItem = ({ 
  item, 
  manifestCount, 
  onUpdate, 
  onHover 
}: { 
  item: InventoryItem, 
  manifestCount: number, 
  onUpdate: (name: string, dir: number) => void,
  onHover: (img: string | null) => void 
}) => (
  <div className="group flex items-center justify-between p-3 md:p-4 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl">
    <div 
      onMouseEnter={() => item.image && onHover(item.image)}
      onMouseLeave={() => onHover(null)}
      className="flex-1 min-w-0 pr-2 md:pr-4 cursor-help"
    >
      <h3 className="text-sm font-bold uppercase tracking-tight mb-1 leading-tight">{item.name}</h3>
      <p className="text-[10px] opacity-40 font-bold uppercase tracking-[0.2em] leading-relaxed">
        {item.category} • QTY: {item.qty} • ${item.replacement.toLocaleString()}
      </p>
    </div>
    
    <div className="flex items-center gap-1 md:gap-3 shrink-0">
      <button 
        onClick={() => onUpdate(item.name, -1)}
        disabled={!manifestCount}
        className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-20 transition-colors"
      >
        <Minus className="w-3 h-3" />
      </button>
      <span className={`w-5 md:w-6 text-center text-xs md:text-sm font-black ${manifestCount ? 'text-accent' : 'opacity-20'}`}>
        {manifestCount || 0}
      </span>
      <button 
        onClick={() => onUpdate(item.name, 1)}
        disabled={(manifestCount || 0) >= item.qty}
        className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-white text-black rounded-lg hover:bg-accent hover:text-white disabled:opacity-20 transition-all"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  </div>
);

export default function Rentals() {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [manifest, setManifest] = useState<Record<string, number>>({});
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);
  
  // Custom Gear State
  const [customGear, setCustomGear] = useState<InventoryItem[]>([]);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingItemName, setEditingItemName] = useState<string | null>(null);

  // Form State
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState(ALL_CATEGORIES[0]);
  const [customQty, setCustomQty] = useState(1);
  const [customValue, setCustomValue] = useState(0);
  const [customOwner, setCustomOwner] = useState('');

  // Job Details State
  const [jobTitle, setJobTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [companyName, setCompanyName] = useState('Zipline Media');
  const [companyAddr, setCompanyAddr] = useState('New York, NY');
  const [notes, setNotes] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [includeReplacementValue, setIncludeReplacementValue] = useState(false);
  const [isMobileManifestOpen, setIsMobileManifestOpen] = useState(false);

  const allInventory = useMemo(() => {
    return [...INVENTORY, ...customGear].sort((a, b) => a.name.localeCompare(b.name));
  }, [customGear]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allInventory.filter(item => {
      const catMatch = filterCategory === 'All' || item.category === filterCategory;
      const searchMatch = !term || item.name.toLowerCase().includes(term);
      return catMatch && searchMatch;
    });
  }, [search, filterCategory, allInventory]);

  const filteredGroupedItems = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (term || filterCategory !== 'All') return null;

    const grouped: Record<string, InventoryItem[]> = {};
    filteredItems.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });
    return grouped;
  }, [filteredItems, search, filterCategory]);

  const manifestByOwner = useMemo(() => {
    const byOwner: Record<string, Record<string, ManifestItem[]>> = {}; 
    Object.entries(manifest).forEach(([name, count]) => {
      if (count <= 0) return;
      const item = allInventory.find(i => i.name === name);
      if (!item) return;
      const owner = item.owner || 'Zipline Media';
      if (!byOwner[owner]) byOwner[owner] = {};
      if (!byOwner[owner][item.category]) byOwner[owner][item.category] = [];
      byOwner[owner][item.category].push({ name, count });
    });
    return byOwner;
  }, [manifest, allInventory]);

  const grandTotal = useMemo(() => {
    return Object.entries(manifest).reduce((total, [name, count]) => {
      const item = allInventory.find(i => i.name === name);
      return total + (item?.replacement || 0) * count;
    }, 0);
  }, [manifest, allInventory]);

  const updateManifest = (name: string, dir: number) => {
    const item = allInventory.find(i => i.name === name);
    if (!item) return;
    setManifest(prev => {
      const current = prev[name] || 0;
      const next = Math.max(0, Math.min(item.qty, current + dir));
      return { ...prev, [name]: next };
    });
  };

  const openAddModal = () => {
    setEditingItemName(null);
    setCustomName('');
    setCustomCategory(ALL_CATEGORIES[0]);
    setCustomQty(1);
    setCustomValue(0);
    setCustomOwner('');
    setIsCustomModalOpen(true);
  };

  const handleEdit = (item: InventoryItem) => {
    let baseName = item.name;
    let owner = item.owner || '';
    if (owner && baseName.includes(`[${owner}]`)) {
        baseName = baseName.replace(` [${owner}]`, '').trim();
    }
    setEditingItemName(item.name); 
    setCustomName(baseName);
    setCustomCategory(item.category);
    setCustomQty(item.qty);
    setCustomValue(item.replacement);
    setCustomOwner(owner);
    setIsCustomModalOpen(true);
  };

  const addCustomItem = () => {
    if (!customName.trim()) return;
    const finalName = customOwner.trim() ? `${customName.trim()} [${customOwner.trim()}]` : customName.trim();
    if (finalName !== editingItemName && allInventory.find(i => i.name.toLowerCase() === finalName.toLowerCase())) {
      alert('Item with this name already exists.');
      return;
    }
    const newItem: InventoryItem = {
      name: finalName,
      category: customCategory,
      qty: customQty,
      replacement: customValue,
      owner: customOwner.trim() || undefined
    };
    setCustomGear(prev => {
        const filtered = prev.filter(i => i.name !== editingItemName);
        return [...filtered, newItem];
    });
    setManifest(prev => {
        const newManifest = { ...prev };
        if (editingItemName && editingItemName !== finalName) {
            const count = newManifest[editingItemName];
            delete newManifest[editingItemName];
            if (count) newManifest[finalName] = count;
        } else if (!editingItemName) {
            newManifest[finalName] = 1;
        }
        return newManifest;
    });
    setIsCustomModalOpen(false);
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
    setCustomGear([]); 
  };

  const exportPDF = async () => {
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

    const sanitizeText = (text: string) => {
      return text.replace(/″/g, '"').replace(/′/g, "'").replace(/×/g, "x").replace(/’/g, "'");
    };

    const date = new Date().toLocaleDateString();
    
    // --- HEADER ---
    const logoUrl = "/Zipline Logo FULL Blue.png";
    const logoImg = new Image();
    logoImg.src = logoUrl;
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve; 
    });

    const logoWidth = 140;
    const logoRatio = logoImg.height && logoImg.width ? logoImg.height / logoImg.width : 0.5;
    const logoHeight = logoWidth * logoRatio;

    if (logoImg.complete && logoImg.naturalWidth > 0) {
      doc.addImage(logoImg, "PNG", margin, y, logoWidth, logoHeight);
    } else {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(companyName || "Gear Manifest", margin, y + 20);
    }

    const rightColX = 320;
    let infoY = y + 10;
    
    const formatDate = (d: string) => {
      if (!d) return "";
      const dateObj = new Date(d + 'T12:00:00');
      return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    if (jobTitle) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(jobTitle.toUpperCase(), rightColX, infoY);
      infoY += 16;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80); 

    const addDetail = (label: string, value: string) => {
      if (!value) return;
      doc.setFont("helvetica", "bold");
      doc.text(label, rightColX, infoY);
      const labelWidth = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.text(value, rightColX + labelWidth + 5, infoY);
      infoY += 12;
    };

    if (shootDate) addDetail("SHOOT DATE:", formatDate(shootDate).toUpperCase());
    if (companyAddr) addDetail("LOC:", companyAddr.toUpperCase());
    if (contactEmail) addDetail("CONTACT:", contactEmail.toUpperCase());
    
    infoY += 4;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Generated: " + date, rightColX, infoY);
    
    doc.setTextColor(0);
    const headerHeight = Math.max(logoHeight, infoY - y) + 10;
    y += headerHeight;

    doc.setDrawColor(0, 119, 255); 
    doc.setLineWidth(2);
    doc.line(margin, y, 612 - margin, y);
    y += 25;

    const CATEGORY_ORDER = [
      "Camera", "Lens", "Lens Accessories", "Grip/Support", "Playback & Wireless Video", 
      "Lighting", "Modifiers", "Stands/Grip", "Audio", "Power", "Comms", 
      "Backdrops", "Carts/Cases", "Computing", "Specialty"
    ];

    const sortedOwners = Object.keys(manifestByOwner).sort((a, b) => {
        if (a === 'Zipline Media') return -1;
        if (b === 'Zipline Media') return 1;
        return a.localeCompare(b);
    });

    sortedOwners.forEach(owner => {
        const ownerGroup = manifestByOwner[owner];
        checkPageBreak(40);
        
        if (sortedOwners.length > 1) {
            y += 10;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.setTextColor(0); 
            doc.text(owner.toUpperCase(), margin, y);
            y += 20;
            doc.setDrawColor(200);
            doc.setLineWidth(0.5);
            doc.line(margin, y - 15, 612 - margin, y - 15);
        }

        Object.keys(ownerGroup).sort((a, b) => {
            const indexA = CATEGORY_ORDER.indexOf(a);
            const indexB = CATEGORY_ORDER.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        }).forEach(cat => {
            checkPageBreak(30); 

            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(0, 119, 255); 
            doc.text(cat, margin, y);
            doc.setTextColor(0); 
            y += 18;
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            ownerGroup[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(row => {
                const bullet = "• " + sanitizeText(row.name) + "  (x" + row.count + ")";
                const wrapped = doc.splitTextToSize(bullet, 514);
                wrapped.forEach((ln: string) => {
                checkPageBreak(lineH);
                doc.text(ln, margin + 10, y);
                y += lineH;
                });
                y += 4; 
            });
            y += 12;
        });
        
        y += 15; 
    });

    if (notes) {
      checkPageBreak(40);
      y += 10;
      doc.setDrawColor(200);
      doc.setLineWidth(1);
      doc.line(margin, y, 612 - margin, y); 
      y += 20;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("NOTES", margin, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(notes, 514);
      wrapped.forEach((ln: string) => {
        checkPageBreak(lineH);
        doc.text(ln, margin, y);
        y += lineH;
      });
    }

    if (includeReplacementValue) {
      y += 20;
      checkPageBreak(lineH);
      
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 10, 516, 30, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("TOTAL REPLACEMENT VALUE:", margin + 10, y + 8);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 119, 255);
      doc.text(`$${grandTotal.toLocaleString()}`, 612 - margin - 10, y + 8, { align: "right" });
      doc.setTextColor(0);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <div className="space-y-0.5">
          <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Job Title</label>
          <input 
            type="text" 
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="E.G. MOULIN ROUGE"
            className="w-full bg-black/50 border border-white/10 py-2 px-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Shoot Date</label>
          <input 
            type="date" 
            value={shootDate}
            onChange={(e) => setShootDate(e.target.value)}
            className="w-full bg-black/50 border border-white/10 py-2 px-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Contact</label>
          <input 
            type="text" 
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="EMAIL@CLIENT.COM"
            className="w-full bg-black/50 border border-white/10 py-2 px-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
          />
        </div>
        <div className="space-y-0.5">
          <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Company</label>
          <input 
            type="text" 
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-black/50 border border-white/10 py-2 px-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
          />
        </div>
        <div className="space-y-0.5 md:col-span-2">
          <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Location</label>
          <input 
            type="text" 
            value={companyAddr}
            onChange={(e) => setCompanyAddr(e.target.value)}
            className="w-full bg-black/50 border border-white/10 py-2 px-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg"
          />
        </div>
      </div>

      <div className="space-y-0.5 mb-6">
        <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Production Notes</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={1}
          placeholder="CALL TIME, PARKING, ETC..."
          className="w-full bg-black/50 border border-white/10 py-2 px-3 outline-none focus:border-accent transition-colors uppercase text-[10px] font-bold tracking-widest rounded-lg resize-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-[300px] mb-8 pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {Object.keys(manifestByOwner).length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-20"
            >
              <p className="uppercase text-[10px] tracking-[0.3em] font-bold">Manifest is empty</p>
            </motion.div>
          ) : (
            // Group by Owner
            Object.keys(manifestByOwner).sort((a, b) => {
                if (a === 'Zipline Media') return -1;
                if (b === 'Zipline Media') return 1;
                return a.localeCompare(b);
            }).map(owner => (
                <motion.div key={owner} className="mb-8">
                    {(owner !== 'Zipline Media' || Object.keys(manifestByOwner).length > 1) && (
                        <h2 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 pb-2 border-b border-white/10 ${owner === 'Zipline Media' ? 'text-white' : 'text-red-500'}`}>
                            {owner}
                        </h2>
                    )}
                    
                    {Object.entries(manifestByOwner[owner]).map(([cat, items]) => (
                        <div key={cat} className="mb-4 pl-2 border-l border-white/5">
                            <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase text-accent mb-2 ml-1">{cat}</h3>
                            <div className="space-y-2">
                            {items.map((item) => {
                                const invItem = allInventory.find(i => i.name === item.name);
                                const isCustom = customGear.some(c => c.name === item.name);
                                
                                return (
                                <div key={item.name} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 group">
                                    <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-bold uppercase truncate">{item.name}</p>
                                    <p className="text-[10px] opacity-40 font-bold tracking-widest uppercase">
                                        X{item.count} • ${( (invItem?.replacement || 0) * item.count ).toLocaleString()}
                                    </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isCustom && (
                                            <button
                                                onClick={() => handleEdit(invItem!)}
                                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/10 hover:text-white transition-all rounded-md"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => removeFromManifest(item.name)}
                                            className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-500 transition-all rounded-md"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                )
                            })}
                            </div>
                        </div>
                    ))}
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
        <AnimatePresence>
          {hoveredImage && <ImageTooltip src={hoveredImage} />}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-neutral-900/50 border border-white/10 p-0 md:p-6 md:pb-0 rounded-2xl overflow-hidden flex flex-col h-[80vh] md:h-[calc(100vh-140px)] sticky top-24">
              
              <div className="bg-neutral-900/90 backdrop-blur-md p-4 md:p-0 z-20 sticky top-0 border-b md:border-b-0 border-white/10 space-y-4">
                <div className="flex gap-4">
                  <select 
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="flex-1 bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-xl appearance-none cursor-pointer"
                  >
                    <option value="All">ALL CATEGORIES</option>
                    {ALL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                  </select>
                  <button
                    onClick={openAddModal}
                    className="bg-white text-black px-4 font-black uppercase text-[10px] tracking-widest hover:bg-accent hover:text-white transition-all rounded-xl shadow-lg shadow-white/5 whitespace-nowrap flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden md:inline">Custom</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  <input 
                    type="text" 
                    placeholder="SEARCH GEAR..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 py-3 pl-10 pr-10 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-xl"
                  />
                  {search && (
                    <button 
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:px-0 custom-scrollbar">
                {filteredGroupedItems ? (
                   Object.keys(filteredGroupedItems).sort().map(cat => (
                     <div key={cat} className="mb-8 last:mb-0">
                       <h3 className="sticky top-0 bg-neutral-900/95 backdrop-blur z-10 py-2 text-[10px] font-bold tracking-[0.4em] uppercase text-accent mb-2 border-b border-white/10">{cat}</h3>
                       <div className="space-y-2">
                         {filteredGroupedItems[cat].map(item => (
                            <GearItem 
                              key={item.name} 
                              item={item} 
                              manifestCount={manifest[item.name] || 0}
                              onUpdate={updateManifest} 
                              onHover={setHoveredImage}
                            />
                         ))}
                       </div>
                     </div>
                   ))
                ) : (
                  <div className="space-y-2">
                    {filteredItems.length === 0 ? (
                      <div className="py-20 text-center opacity-40">
                        <Package className="w-12 h-12 mx-auto mb-4" />
                        <p className="uppercase text-xs tracking-widest font-bold">No gear found</p>
                      </div>
                    ) : (
                      filteredItems.map((item) => (
                        <GearItem 
                          key={item.name} 
                          item={item} 
                          manifestCount={manifest[item.name] || 0}
                          onUpdate={updateManifest}
                          onHover={setHoveredImage} 
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="hidden lg:block lg:col-span-5 space-y-8">
            {ManifestContent}
          </div>
        </div>

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

        <AnimatePresence>
          {isCustomModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCustomModalOpen(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-neutral-900 border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-tighter">{editingItemName ? 'Edit Custom Gear' : 'Add Custom Gear'}</h2>
                  <button onClick={() => setIsCustomModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Owner / Source <span className="opacity-50">(Optional)</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                      <input 
                        type="text" 
                        value={customOwner}
                        onChange={(e) => setCustomOwner(e.target.value)}
                        placeholder="E.G. RENTAL HOUSE A"
                        className="w-full bg-black/50 border border-white/10 py-3 pl-10 pr-4 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Item Name</label>
                    <input 
                      type="text" 
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="E.G. RED KOMODO"
                      autoFocus
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Category</label>
                    <select 
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg appearance-none"
                    >
                      {ALL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                      <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Quantity</label>
                      <input 
                        type="number" 
                        min="1"
                        value={customQty}
                        onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Value ($)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={customValue}
                        onChange={(e) => setCustomValue(parseInt(e.target.value) || 0)}
                        className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={addCustomItem}
                    disabled={!customName.trim()}
                    className="w-full bg-accent text-white py-4 mt-4 font-black tracking-widest uppercase text-xs hover:bg-white hover:text-black disabled:opacity-50 disabled:hover:bg-accent disabled:hover:text-white transition-all rounded-xl"
                  >
                    {editingItemName ? 'Save Changes' : 'Add to Manifest'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
    </div>
  );
}