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

  Pencil,

  Sun,

  Car,

  Stethoscope,

  MapPin,

  ExternalLink,

  Calendar

} from 'lucide-react';

import { jsPDF } from 'jspdf';
import Autocomplete from 'react-google-autocomplete';

import { ALL_CATEGORIES, type InventoryItem } from '@/data/inventory';
import { STORAGE_KEY_CLIENTS, STORAGE_KEY_JOBS, Client, Job } from './types';
import ProductionCalendar from './ProductionCalendar';
import { supabase } from '@/lib/supabase';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Helper: Weather Code to Text
const weatherCodeToText = (code: number) => {
  const map: Record<number, string> = {
    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Depositing rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
    55: 'Dense drizzle', 56: 'Light freezing drizzle', 57: 'Dense freezing drizzle',
    61: 'Slight rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Light freezing rain', 67: 'Heavy freezing rain',
    71: 'Slight snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
    85: 'Snow showers', 86: 'Heavy snow showers',
    95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
  };
  return map[code] || `Unknown (${code})`;
};

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
  const [companyAddr, setCompanyAddr] = useState('');
  const [notes, setNotes] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [includeReplacementValue, setIncludeReplacementValue] = useState(false);
  const [isMobileManifestOpen, setIsMobileManifestOpen] = useState(false);
  const [isJobPickerOpen, setIsJobPickerOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'gear' | 'library'>('gear');

  // External API States
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [hospitalLoading, setHospitalLoading] = useState(false);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [weatherSuccess, setWeatherSuccess] = useState(false);
  const [hospitalSuccess, setHospitalSuccess] = useState(false);
  const [parkingSuccess, setParkingSuccess] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [weatherLink, setWeatherLink] = useState<string | null>(null);
  const [nearestHospital, setNearestHospital] = useState<{name: string, address: string} | null>(null);
  const [nearestParking, setNearestParking] = useState<{name: string, address: string} | null>(null);
  const [hoveredLogistics, setHoveredLogistics] = useState<'weather' | 'hospital' | 'parking' | null>(null);
  
  // Rolodex Data
  const [clients, setClients] = useState<Client[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dbInventory, setDbInventory] = useState<InventoryItem[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Fetch clients from Supabase
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) throw error;
        if (data) setClients(data as Client[]);
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };

    const fetchInventory = async () => {
      setIsLoadingInventory(true);
      try {
        const { data, error } = await supabase.from('inventory').select('*');
        if (error) throw error;
        if (data) {
          setDbInventory(data as InventoryItem[]);
        }
      } catch (err) {
        console.error('Error fetching inventory:', err);
      } finally {
        setIsLoadingInventory(false);
      }
    };

    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase.from('jobs').select('*');
        if (error) throw error;
        if (data) {
          // Note: supabase returns job_roles separately or as nested if joined
          // For now, we'll just set the jobs. The schema has job_roles table.
          setJobs(data as Job[]);
        }
      } catch (err) {
        console.error('Error fetching jobs:', err);
      }
    };
    
    fetchInventory();
    fetchJobs();
  }, []);

  const allInventory = useMemo(() => {
    return [...dbInventory, ...customGear].sort((a, b) => a.name.localeCompare(b.name));
  }, [dbInventory, customGear]);

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
    setWeatherSummary(null);
    setWeatherLink(null);
    setNearestHospital(null);
    setNearestParking(null);
    setWeatherSuccess(false);
    setHospitalSuccess(false);
    setParkingSuccess(false);
    setParkingLoading(false);
  };

  const fetchWeather = async () => {
    if (!shootDate || !companyAddr) {
        alert('Please enter a Location and Shoot Date first.');
        return;
    }
    setWeatherLoading(true);
    setWeatherSuccess(false);
    try {
        // 1. Geocode with Google
        const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(companyAddr)}&key=${GOOGLE_MAPS_API_KEY}`);
        const geoData = await geoRes.json();
        
        if (geoData.status !== 'OK' || !geoData.results[0]) throw new Error('Address not found');
        const { lat, lng } = geoData.results[0].geometry.location;

        // 2. Weather
        const date = new Date(shootDate).toISOString().slice(0, 10);
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`);
        const wData = await wRes.json();

        if (wData.daily) {
            const code = wData.daily.weathercode[0];
            const temp = wData.daily.temperature_2m_max[0];
            const summary = `${weatherCodeToText(code)} • High: ${temp}°F`;
            setWeatherSummary(summary);
            setWeatherLink(`https://www.wunderground.com/weather/${lat},${lng}`);
            setWeatherSuccess(true);
        }
    } catch (err) {
        console.error(err);
        alert('Could not fetch weather. Check address and date.');
    } finally {
        setWeatherLoading(false);
    }
  };


  const findHospital = async () => {
     if (!companyAddr) {
         alert('Please enter a location address first.');
         return;
     }
     setHospitalLoading(true);
     setHospitalSuccess(false);
     try {
         const res = await fetch(`/api/hospital?address=${encodeURIComponent(companyAddr)}`);
         const data = await res.json();
         
         if (res.ok && data) {
             setNearestHospital({ name: data.name, address: data.address });
             setHospitalSuccess(true);
         } else {
             alert(data.error || 'No hospital found nearby.');
         }
     } catch (err) {
         console.error(err);
         alert('Error searching for hospital.');
     } finally {
         setHospitalLoading(false);
     }
  };

  const findParking = async () => {
      if (!companyAddr) {
          alert('Please enter a location address first.');
          return;
      }
      setParkingLoading(true);
      setParkingSuccess(false);
      try {
          const res = await fetch(`/api/parking?address=${encodeURIComponent(companyAddr)}`);
          const data = await res.json();
          
          if (res.ok && data && data.place_id) {
              setNearestParking({ name: data.name, address: data.address });
              setParkingSuccess(true);
          } else {
              alert(data.error || 'No legitimate parking found nearby.');
          }
      } catch (err) {
          console.error(err);
          alert('Error searching for parking.');
      } finally {
          setParkingLoading(false);
      }
  };

  const saveJob = async () => {
    if (!jobTitle || !shootDate) {
      alert('Please enter a Job Title and Shoot Date to log to Slate.');
      return;
    }

    const dbJob = {
      title: jobTitle.toUpperCase(),
      client_name: contactEmail.toUpperCase(),
      production_company: companyName.toUpperCase(),
      job_status: 'Planning' as const,
      type: 'production',
      shoot_date: shootDate,
      location_name: '', 
      location_address: companyAddr,
      nearest_hospital_name: nearestHospital?.name || '',
      nearest_hospital_address: nearestHospital?.address || '',
      nearest_parking_name: nearestParking?.name || '',
      nearest_parking_address: nearestParking?.address || '',
      weather_summary: weatherSummary || '',
      gear_manifest: manifest,
      notes_general: notes,
      updated_at: new Date().toISOString()
    };

    try {
      // 1. Handle Client Saving (for autofill future situation)
      if (contactEmail) {
        const clientName = contactEmail.trim().toUpperCase();
        const existingClient = clients.find(c => c.name.toUpperCase() === clientName);
        
        if (!existingClient) {
          const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({ name: clientName })
            .select();
          
          if (!clientError && newClient) {
            setClients(prev => [...prev, newClient[0] as Client]);
          }
        }
      }

      // 2. Handle Job Saving
      // Check if job with same title and date exists for updating
      const existingJob = jobs.find(j => j.title === dbJob.title && j.shoot_date === dbJob.shoot_date);

      let res;
      if (existingJob) {
        res = await supabase.from('jobs').update(dbJob).eq('id', existingJob.id).select();
      } else {
        res = await supabase.from('jobs').insert(dbJob).select();
      }

      if (res.error) throw res.error;

      if (!res.data || res.data.length === 0) {
        throw new Error('No data returned from database');
      }

      if (existingJob) {
        setJobs(prev => prev.map(j => j.id === existingJob.id ? res.data![0] as Job : j));
        alert('Job updated on Slate successfully!');
      } else {
        setJobs(prev => [...prev, res.data![0] as Job]);
        alert('Job logged to Slate successfully!');
      }
    } catch (err: any) {
      console.error('Error saving job:', err);
      alert('Failed to save job to Slate: ' + (err.message || 'Unknown error'));
    }
  };

  const loadJob = (job: Job) => {
    setJobTitle(job.title);
    if (job.shoot_date) setShootDate(job.shoot_date);
    if (job.client_name) setContactEmail(job.client_name);
    if (job.location_address) {
        setCompanyAddr(job.location_address);
        setWeatherSuccess(false);
        setHospitalSuccess(false);
        setParkingSuccess(false);
        setWeatherSummary(null);
        setNearestHospital(null);
        setNearestParking(null);
    }
    if (job.notes_general) setNotes(job.notes_general);
    if (job.gear_manifest) {
      setManifest(job.gear_manifest as Record<string, number>);
    }
    setIsCalendarOpen(false);
  };

  const deleteJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to permanently delete this job from Slate?')) return;
    
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err: any) {
      console.error('Error deleting job:', err);
      alert('Failed to delete job: ' + (err.message || 'Unknown error'));
    }
  };

  const exportPDF = async () => {
    // Helper to load assets
    const loadAsset = async (path: string): Promise<string> => {
        try {
            const res = await fetch(path);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Error loading asset:", path, e);
            return '';
        }
    };

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 30; // Adjusted to match Call Sheet margin approx (12mm approx 34pt, let's use 30pt)
    const contentWidth = pageWidth - (margin * 2);
    const PAGE_BOTTOM = 750;
    let y = 30;
    const lineH = 14;
    doc.setLineHeightFactor(1.2);

    // --- LOAD ASSETS ---
    const logoData = await loadAsset('/Zipline Logo FULL Blue.png');
    const fontData = await loadAsset('/Webrush Demo.ttf');

    // Add Font
    if (fontData) {
        const fontBase64 = fontData.split(',')[1];
        doc.addFileToVFS('Webrush.ttf', fontBase64);
        doc.addFont('Webrush.ttf', 'Webrush', 'normal');
    }

    // --- COLORS ---
    const ZIPLINE_BLUE = '#0077FF';
    const TEXT_DARK = '#111111';
    const TEXT_GRAY = '#666666';

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
    // Logo (Left)
    if (logoData) {
        doc.addImage(logoData, 'PNG', margin, 20, 120, 30); 
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(ZIPLINE_BLUE);
        doc.text('ZIPLINE MEDIA', margin, 40);
    }

    // Title (Right)
    doc.setTextColor(TEXT_DARK);
    if (fontData) {
        doc.setFont('Webrush', 'normal');
        doc.setFontSize(40);
        doc.text('Gear Manifest', pageWidth - margin, 45, { align: 'right' });
    } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(30);
        doc.text('GEAR MANIFEST', pageWidth - margin, 45, { align: 'right' });
    }

    // Generated Date
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_GRAY);
    doc.text(`Generated: ${date}`, pageWidth - margin, 58, { align: 'right' });

    y = 70;

    // --- HERO BAR ---
    doc.setFillColor(TEXT_DARK);
    doc.rect(0, y, pageWidth, 24, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    
    // Date (Left)
    doc.setFontSize(12);
    const dateStr = shootDate ? new Date(shootDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase() : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    doc.text(`SHOOT DATE: ${dateStr}`, margin, y + 16);

    // Job Title (Right)
    if (jobTitle) {
        doc.text(jobTitle.toUpperCase(), pageWidth - margin, y + 16, { align: 'right' });
    }

    y += 40;

    // --- INFO GRID (3x2 Compact) ---
    const col1X = margin;
    const col2X = margin + 180;
    const col3X = margin + 360;
    
    const row1Y = y;
    const row2Y = y + 35; // Tighter row spacing

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT_GRAY);

    // Row 1 Headers
    doc.text('GENERATED BY', col1X, row1Y);
    doc.text('GENERATED FOR', col2X, row1Y);
    doc.text('LOCATION', col3X, row1Y);

    // Values
    doc.setFontSize(9); // Slightly smaller for compactness
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_DARK);

    // Row 1 Values
    doc.text(companyName || 'Zipline Media', col1X, row1Y + 10);
    doc.text(contactEmail || '—', col2X, row1Y + 10);
    
    if (companyAddr) {
        const locLines = doc.splitTextToSize(companyAddr, 160);
        doc.text(locLines[0] + (locLines.length > 1 ? '...' : ''), col3X, row1Y + 10);
    } else {
        doc.text('—', col3X, row1Y + 10);
    }

    // Row 2 Values
    // Check if any Row 2 data exists
    const hasLogistics = weatherSummary || nearestHospital || nearestParking;

    if (hasLogistics) {
        doc.text('WEATHER', col1X, row2Y);
        doc.text('HOSPITAL', col2X, row2Y);
        doc.text('PARKING', col3X, row2Y);

        doc.text(weatherSummary || 'N/A', col1X, row2Y + 10);

        if (nearestHospital) {
            const hospName = nearestHospital.name.length > 30 ? nearestHospital.name.substring(0, 28) + '...' : nearestHospital.name;
            doc.text(hospName, col2X, row2Y + 10);
        } else {
            doc.text('—', col2X, row2Y + 10);
        }

        if (nearestParking) {
            const parkName = nearestParking.name.length > 30 ? nearestParking.name.substring(0, 28) + '...' : nearestParking.name;
            doc.text(parkName, col3X, row2Y + 10);
        } else {
            doc.text('—', col3X, row2Y + 10);
        }
        
        y = row2Y + 30;
    } else {
        // If no logistics, Row 1 ended at row1Y + 10 approx.
        // We can just set y to be closer to Row 1.
        y = row1Y + 30; 
    }

    // --- NOTES (Moved to Header) ---
    if (notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TEXT_GRAY);
      doc.text("NOTES", margin, y);
      y += 12;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(TEXT_DARK);
      const wrapped = doc.splitTextToSize(notes, contentWidth);
      wrapped.forEach((ln: string) => {
        // checkPageBreak in header might be tricky if notes are huge, 
        // but typically header notes are brief. 
        // Ideally we don't break page in header, but if we must:
        if (y + lineH > PAGE_BOTTOM) {
            doc.addPage();
            y = margin;
        }
        doc.text(ln, margin, y);
        y += lineH;
      });
      y += 10; // Spacing after notes
    }

    // --- LINE SEPARATOR ---
    doc.setDrawColor(ZIPLINE_BLUE);
    doc.setLineWidth(2);
    doc.line(margin, y, pageWidth - margin, y);
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
            doc.setTextColor(TEXT_DARK); 
            doc.text(owner.toUpperCase(), margin, y);
            y += 20;
            doc.setDrawColor(200);
            doc.setLineWidth(0.5);
            doc.line(margin, y - 15, pageWidth - margin, y - 15);
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
            doc.setTextColor(ZIPLINE_BLUE); 
            doc.text(cat, margin, y);
            doc.setTextColor(TEXT_DARK); 
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

    if (includeReplacementValue) {
      y += 20;
      checkPageBreak(lineH);
      
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 10, contentWidth, 30, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("TOTAL REPLACEMENT VALUE:", margin + 10, y + 8);
      
      doc.setFontSize(12);
      doc.setTextColor(ZIPLINE_BLUE);
      doc.text(`$${grandTotal.toLocaleString()}`, pageWidth - margin - 10, y + 8, { align: "right" });
      doc.setTextColor(TEXT_DARK);
      y += lineH;
    }

    // Update local client list for immediate UI feedback if needed
    if (contactEmail) {
        const clientName = contactEmail.trim();
        const existingClientIndex = clients.findIndex(c => c.name.toLowerCase() === clientName.toLowerCase());
        
        if (existingClientIndex >= 0) {
            const updatedClients = [...clients];
            const newEntry = {
                id: crypto.randomUUID(),
                type: 'gear' as const,
                date: shootDate || new Date().toISOString(),
                title: jobTitle || 'Gear Manifest',
                summary: `Value: $${grandTotal.toLocaleString()}`
            };
            
            const client = updatedClients[existingClientIndex];
            client.history = [newEntry, ...(client.history || [])];
            client.updated_at = new Date().toISOString();
            
            setClients(updatedClients);
            // Client history persistent in Supabase requires updating the 'clients' table record
            // For now we'll skip the localStorage sync as we are moving to DB
        }
    }

    const safeJob = jobTitle ? jobTitle.replace(/[^a-z0-9\-_\s]/gi, "").trim().replace(/\s+/g, "_") : "Gear_Manifest";
    doc.save(`${safeJob || "Gear_Manifest"}.pdf`);
  };

  const ManifestContent = (
    <section className="bg-neutral-900/80 border border-white/10 p-6 md:p-8 rounded-2xl lg:sticky lg:top-32 h-full lg:h-auto flex flex-col">
      <div className="flex items-center justify-between mb-6">
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
            onChange={(e) => {
                const val = e.target.value;
                setJobTitle(val);
                
                // Autofill attempt
                const matchedJob = jobs.find(j => j.title.toLowerCase() === val.toLowerCase());
                if (matchedJob) {
                    if (matchedJob.shoot_date) setShootDate(matchedJob.shoot_date);
                    if (matchedJob.client_name) setContactEmail(matchedJob.client_name);
                    if (matchedJob.location_address) {
                        setCompanyAddr(matchedJob.location_address);
                        // Reset logistics to trigger re-fetch if needed (or could pre-fill if we saved them in Job)
                        setWeatherSuccess(false);
                        setHospitalSuccess(false);
                        setParkingSuccess(false);
                        setWeatherSummary(null);
                        setNearestHospital(null);
                        setNearestParking(null);
                    }
                    if (matchedJob.notes_general) setNotes(matchedJob.notes_general);
                }
            }}
            placeholder="E.G. MOULIN ROUGE"
            list="job-list"
            className="w-full bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-lg"
          />
          <datalist id="job-list">
            {jobs.map(j => (
                <option key={j.id} value={j.title}>{j.client_name ? `(${j.client_name})` : ''}</option>
            ))}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Shoot Date</label>
          <div className="flex gap-2">
            <input 
                type="date" 
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="w-full bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-lg"
            />
            <button 
                onClick={() => setIsCalendarOpen(true)}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-colors text-white"
                title="Pick from Production Calendar"
            >
                <Calendar className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Generated For</label>
          <input 
            type="text" 
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="CLIENT NAME"
            list="client-options"
            className="w-full bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-lg"
          />
          <datalist id="client-options">
            {clients.map(client => (
                <option key={client.id} value={client.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Generated By</label>
          <input 
            type="text" 
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-lg"
          />
        </div>
        <div className="space-y-0.5 md:col-span-2">
          <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Location</label>
          <Autocomplete
            apiKey={GOOGLE_MAPS_API_KEY}
            onPlaceSelected={(place) => {
                if (!place) return;
                setCompanyAddr(place.formatted_address || '');
                setWeatherSuccess(false);
                setHospitalSuccess(false);
                setParkingSuccess(false);
                setWeatherLink(null);
                setNearestHospital(null);
                setNearestParking(null);
            }}
            options={{
                types: ['geocode', 'establishment'],
                fields: ['formatted_address', 'geometry'],
                componentRestrictions: { country: 'us' }
            }}
            defaultValue={companyAddr}
            onChange={(e: any) => {
                setCompanyAddr(e.target.value);
                setWeatherSuccess(false);
                setHospitalSuccess(false);
                setParkingSuccess(false);
                setWeatherSummary(null);
                setWeatherLink(null);
                setNearestHospital(null);
                setNearestParking(null);
            }}
            className="w-full bg-black/5 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-lg"
            placeholder="SEARCH FOR A LOCATION..."
          />
          <div className="flex gap-2 pt-1 relative">
             {hoveredLogistics && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-neutral-900 border border-white/10 p-3 rounded-xl shadow-xl z-50 pointer-events-none">
                    {hoveredLogistics === 'weather' && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Weather Forecast</p>
                            <p className="text-xs font-bold">{weatherSummary || 'No weather data loaded.'}</p>
                        </div>
                    )}
                    {hoveredLogistics === 'hospital' && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Nearest Hospital</p>
                            {nearestHospital ? (
                                <>
                                    <p className="text-xs font-bold">{nearestHospital.name}</p>
                                    <p className="text-[10px] opacity-60">{nearestHospital.address}</p>
                                </>
                            ) : <p className="text-xs opacity-50">No hospital found.</p>}
                        </div>
                    )}
                    {hoveredLogistics === 'parking' && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Nearest Parking</p>
                            {nearestParking ? (
                                <>
                                    <p className="text-xs font-bold">{nearestParking.name}</p>
                                    <p className="text-[10px] opacity-60">{nearestParking.address}</p>
                                </>
                            ) : <p className="text-xs opacity-50">No parking found.</p>}
                        </div>
                    )}
                </div>
             )}

             <button 
                onClick={() => {
                    if (weatherSuccess && weatherLink) {
                        window.open(weatherLink, '_blank');
                    } else {
                        fetchWeather();
                    }
                }}
                onMouseEnter={() => setHoveredLogistics('weather')}
                onMouseLeave={() => setHoveredLogistics(null)}
                disabled={weatherLoading}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all ${weatherSuccess ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'opacity-60 hover:opacity-100'}`}
             >
                {weatherLoading ? '...' : weatherSuccess ? <Check className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                {weatherSuccess ? 'View' : 'Weather'}
             </button>
             <button 
                onClick={() => {
                    if (hospitalSuccess && nearestHospital) {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nearestHospital.name + ' ' + nearestHospital.address)}`, '_blank');
                    } else {
                        findHospital();
                    }
                }}
                onMouseEnter={() => setHoveredLogistics('hospital')}
                onMouseLeave={() => setHoveredLogistics(null)}
                disabled={hospitalLoading}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all ${hospitalSuccess ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'opacity-60 hover:opacity-100'}`}
             >
                {hospitalLoading ? '...' : hospitalSuccess ? <Check className="w-3 h-3" /> : <Stethoscope className="w-3 h-3" />}
                {hospitalSuccess ? 'View' : 'Hospital'}
             </button>
             <button 
                onClick={() => {
                    if (parkingSuccess && nearestParking) {
                        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nearestParking.name + ' ' + nearestParking.address)}`, '_blank');
                    } else {
                        findParking();
                    }
                }}
                onMouseEnter={() => setHoveredLogistics('parking')}
                onMouseLeave={() => setHoveredLogistics(null)}
                disabled={parkingLoading}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all ${parkingSuccess ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'opacity-60 hover:opacity-100'}`}
             >
                {parkingLoading ? '...' : parkingSuccess ? <Check className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                {parkingSuccess ? 'View' : 'Parking'}
             </button>
          </div>
        </div>
      </div>

      <div className="space-y-0.5 mb-6">
        <label className="text-[8px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Production Notes</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={1}
          placeholder="CALL TIME, PARKING, ETC..."
          className="w-full bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-lg resize-none"
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
            {/* <p className="text-3xl font-black text-accent">${grandTotal.toLocaleString()}</p> */}
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

        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={resetApp}
            className="flex items-center justify-center gap-1 border border-white/10 py-4 font-black tracking-widest uppercase text-[9px] hover:bg-white hover:text-black transition-all rounded-xl"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button 
            onClick={saveJob}
            disabled={Object.keys(manifest).length === 0}
            className="flex items-center justify-center gap-1 border border-accent/20 bg-accent/5 py-4 font-black tracking-widest uppercase text-[9px] text-accent hover:bg-accent hover:text-white transition-all rounded-xl shadow-lg shadow-accent/5"
          >
            <ClipboardList className="w-3 h-3" /> Slate
          </button>
          <button 
            onClick={exportPDF}
            disabled={Object.keys(manifest).length === 0}
            className="flex items-center justify-center gap-1 bg-accent py-4 font-black tracking-widest uppercase text-[9px] hover:bg-white hover:text-black disabled:opacity-20 disabled:hover:bg-accent disabled:hover:text-white transition-all rounded-xl shadow-lg shadow-accent/20"
          >
            <FileDown className="w-3 h-3" /> PDF
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
                {/* Tab Toggle */}
                <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-xl">
                  <button 
                    onClick={() => setActiveSidebarTab('gear')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all ${activeSidebarTab === 'gear' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40 hover:text-white'}`}
                  >
                    Gear Selection
                  </button>
                  <button 
                    onClick={() => setActiveSidebarTab('library')}
                    className={`flex-1 py-2 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all ${activeSidebarTab === 'library' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white'}`}
                  >
                    Slate Library
                  </button>
                </div>

                {activeSidebarTab === 'gear' ? (
                  <>
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
                        className="w-full bg-black/50 border border-white/10 py-3 pl-10 pr-10 outline-none focus:border-accent transition-colors uppercase text-sm font-bold rounded-xl"
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
                  </>
                ) : (
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-accent">Saved Production Slates</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{jobs.length} Total</p>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:px-0 custom-scrollbar">
                {activeSidebarTab === 'gear' ? (
                  <>
                    {filteredGroupedItems ? (
                      Object.keys(filteredGroupedItems).sort().map(cat => (
                        <div key={cat} className="mb-8 last:mb-0">
                          <h3 className="sticky top-0 bg-neutral-900/95 backdrop-blur z-10 py-3 text-sm font-bold tracking-[0.4em] uppercase text-accent mb-2 border-b border-white/10">{cat}</h3>
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
                  </>
                ) : (
                  <div className="space-y-3 pb-8">
                    {jobs.length === 0 ? (
                      <div className="py-32 text-center opacity-20">
                        <ClipboardList className="w-16 h-16 mx-auto mb-4" />
                        <p className="uppercase text-xs tracking-[0.3em] font-black">Slate is empty</p>
                      </div>
                    ) : (
                      [...jobs].sort((a,b) => new Date(b.shoot_date || 0).getTime() - new Date(a.shoot_date || 0).getTime()).map(job => (
                        <div 
                          key={job.id}
                          className="group flex items-center justify-between p-4 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl cursor-pointer"
                          onClick={() => {
                            loadJob(job);
                            setActiveSidebarTab('gear');
                          }}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <h4 className="text-sm font-black uppercase tracking-tight mb-1 group-hover:text-accent transition-colors truncate">{job.title}</h4>
                            <div className="flex items-center gap-3 opacity-40">
                              <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {job.shoot_date}
                              </p>
                              <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                                <User className="w-3 h-3" /> {job.client_name || 'NO CLIENT'}
                              </p>
                            </div>
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteJob(job.id);
                            }}
                            className="p-3 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
          {isCalendarOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCalendarOpen(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-neutral-900 border border-white/10 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-6"
              >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-black uppercase tracking-tighter">Select Job or Date</h2>
                    <button onClick={() => setIsCalendarOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <ProductionCalendar 
                    onSelectDate={(date) => {
                        setShootDate(date);
                        setIsCalendarOpen(false);
                    }}
                    onSelectJob={loadJob}
                    onDeleteJob={deleteJob}
                />
              </motion.div>
            </div>
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