'use client';

import React, { useState, useMemo, useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
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
  Calendar,
  FolderOpen,
  Share2,
  Lock,
  UserPlus,
  Loader2,
  QrCode,
  Wrench,
  Activity,
  Clock
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import Autocomplete from 'react-google-autocomplete';

import { ALL_CATEGORIES, type InventoryItem } from '@/data/inventory';

// Category is optional when adding gear; anything left blank lands here so the
// item still groups somewhere instead of disappearing from the catalog.
const UNCATEGORIZED = 'Uncategorized';
import { STORAGE_KEY_CLIENTS, STORAGE_KEY_JOBS, Client, Job, GearTemplate, Contact } from './types';
import ProductionCalendar from './ProductionCalendar';
import { supabase } from '@/lib/supabase';
import { getBranding } from '@/lib/branding';
import { useRealtime } from '@/lib/useRealtime';
import { caps } from '@/lib/format';

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

// Workspace panels use backdrop-blur + overflow-hidden, which makes them the
// containing block for any `fixed` child. Modals rendered inline get trapped
// (and clipped) inside the panel, so they go to <body> instead.
const subscribeToNothing = () => () => {};
const ModalPortal = ({ children }: { children: React.ReactNode }) => {
  // Hydration-safe mount check: false on the server pass, true once client-side.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  if (!mounted) return null;
  return createPortal(children, document.body);
};



const GearItem = ({ 
  item, 
  manifestCount, 
  onUpdate,
  onEdit
}: { 
  item: InventoryItem, 
  manifestCount: number, 
  onUpdate: (name: string, dir: number) => void,
  onEdit?: (item: InventoryItem) => void
}) => (
  <div className="group flex items-center justify-between p-3 md:p-4 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl">
    <div 
      className="flex-1 min-w-0 pr-2 md:pr-4"
    >
      <h3 className="text-sm font-semibold tracking-tight mb-1 leading-tight">{item.name}</h3>
      <p className="text-[10px] opacity-40 font-semibold leading-relaxed">
        {item.category} • QTY: {item.qty} • ${item.replacement.toLocaleString()}
      </p>
    </div>
    
    <div className="flex items-center gap-1 md:gap-3 shrink-0">
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(item)}
          title="Edit gear record"
          className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-lg text-white/25 hover:text-white hover:bg-white/10 md:opacity-0 md:group-hover:opacity-100 transition-all"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}
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

interface RentalsProps {
  preloadedJob?: Job | null;
  onClearPreload?: () => void;
  selectedJobId?: string | null;
}

export default function Rentals({ preloadedJob, onClearPreload, selectedJobId: selectedJobIdProp }: RentalsProps = {}) {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [manifest, setManifest] = useState<Record<string, number>>({});
  const [savedOwners, setSavedOwners] = useState<string[]>([]);
  
  // Custom Gear State
  const [customGear, setCustomGear] = useState<InventoryItem[]>([]);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [editingItemName, setEditingItemName] = useState<string | null>(null);
  // True when the record being edited lives in the shared `inventory` table
  // rather than in this session's local custom gear.
  const [editingIsDbItem, setEditingIsDbItem] = useState(false);
  // New items: write straight to the studio inventory table instead of local-only.
  const [saveToStudioInventory, setSaveToStudioInventory] = useState(false);
  const [savingGearItem, setSavingGearItem] = useState(false);
  const [gearItemError, setGearItemError] = useState<string | null>(null);

  // Form State
  const [customName, setCustomName] = useState('');
  // Category, quantity and replacement value are all optional. Kept as strings
  // so a blank field stays blank instead of snapping back to 1 / 0; they are
  // coerced to their defaults (Uncategorized / 1 / 0) on save.
  const [customCategory, setCustomCategory] = useState('');
  const [customQty, setCustomQty] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [customOwner, setCustomOwner] = useState('');
  const [customImage, setCustomImage] = useState('');

  // Rolodex contacts (so a rental house / contractor owner can be saved as a contact)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddOwnerContact, setShowAddOwnerContact] = useState(false);
  const [ownerContactEmail, setOwnerContactEmail] = useState('');
  const [ownerContactPhone, setOwnerContactPhone] = useState('');
  const [savingOwnerContact, setSavingOwnerContact] = useState(false);
  const [ownerContactMsg, setOwnerContactMsg] = useState<string | null>(null);

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
  const [activeSidebarTab, setActiveSidebarTab] = useState<'gear' | 'library' | 'templates' | 'scanner' | 'subrentals' | 'maintenance'>('gear');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // QR Scanner States
  const [scanInput, setScanInput] = useState('');
  const [scanHistory, setScanHistory] = useState<{id: string, itemName: string, timestamp: string, status: 'success' | 'not_found', code: string}[]>([]);
  const [scanStatus, setScanStatus] = useState<'success' | 'not_found' | null>(null);
  const [scannedItem, setScannedItem] = useState<string | null>(null);
  const [isScanningSimulated, setIsScanningSimulated] = useState(false);

  // Sub-Rentals States
  const [subRentals, setSubRentals] = useState<{id: string, itemName: string, rentalHouse: string, cost: number, returnDate: string}[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studio_sub_rentals');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [subRentalItem, setSubRentalItem] = useState('');
  const [subRentalHouse, setSubRentalHouse] = useState('');
  const [subRentalCost, setSubRentalCost] = useState('');
  const [subRentalReturnDate, setSubRentalReturnDate] = useState('');

  // Maintenance States
  const [maintenanceLogs, setMaintenanceLogs] = useState<{id: string, itemName: string, serviceType: string, techName: string, serviceDate: string, status: string, notes: string}[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('studio_maintenance_logs');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [maintItem, setMaintItem] = useState('');
  const [maintType, setMaintType] = useState('Sensor Cleaning');
  const [maintTech, setMaintTech] = useState('');
  const [maintDate, setMaintDate] = useState('');
  const [maintNotes, setMaintNotes] = useState('');

  // Persistence Effects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('studio_sub_rentals', JSON.stringify(subRentals));
    }
  }, [subRentals]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('studio_maintenance_logs', JSON.stringify(maintenanceLogs));
    }
  }, [maintenanceLogs]);
  const [copiedLink, setCopiedLink] = useState(false);

  // Templates State
  const [gearTemplates, setGearTemplates] = useState<GearTemplate[]>([]);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');

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

    const fetchGearTemplates = async () => {
      try {
        const { data, error } = await supabase.from('gear_templates').select('*');
        if (error) throw error;
        if (data) setGearTemplates(data as GearTemplate[]);
      } catch (err) {
        console.error('Error fetching gear templates:', err);
      }
    };
    
    fetchInventory();
    fetchJobs();
    fetchGearTemplates();
    fetchContacts();

    // Load saved owners
    const stored = localStorage.getItem('zipline_saved_owners');
    if (stored) {
      try {
        setSavedOwners(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing saved owners:', e);
      }
    }
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.from('contacts').select('*').order('name');
      if (!error && data) setContacts(data as Contact[]);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  // Live team sync: keep the gear catalog, jobs, templates and contacts fresh
  // when a teammate changes them. The embedded calendar live-updates on its own.
  useRealtime(['jobs', 'inventory', 'gear_templates', 'contacts'], async () => {
    const [jobsRes, invRes, tplRes] = await Promise.all([
      supabase.from('jobs').select('*'),
      supabase.from('inventory').select('*'),
      supabase.from('gear_templates').select('*'),
    ]);
    if (!jobsRes.error && jobsRes.data) setJobs(jobsRes.data as Job[]);
    if (!invRes.error && invRes.data) setDbInventory(invRes.data as InventoryItem[]);
    if (!tplRes.error && tplRes.data) setGearTemplates(tplRes.data as GearTemplate[]);
    fetchContacts();
  });

  // Save the current owner/source as a Rolodex contact (rental house / contractor)
  const handleSaveOwnerAsContact = async () => {
    const name = customOwner.trim();
    if (!name) return;
    setSavingOwnerContact(true);
    setOwnerContactMsg(null);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .insert([{
          name,
          company_name: name,
          primary_role: 'Rental House / Vendor',
          email: ownerContactEmail.trim() || '',
          phone: ownerContactPhone.trim() || null,
          is_favorite: false,
        }])
        .select()
        .single();
      if (error) throw error;
      setContacts(prev => [...prev, data as Contact]);
      setOwnerContactMsg(`Added "${name}" to Rolodex.`);
      setShowAddOwnerContact(false);
      setOwnerContactEmail('');
      setOwnerContactPhone('');
    } catch (err: any) {
      setOwnerContactMsg(`Failed: ${err.message}`);
    } finally {
      setSavingOwnerContact(false);
    }
  };

  const allInventory = useMemo(() => {
    return [...dbInventory, ...customGear].sort((a, b) => a.name.localeCompare(b.name));
  }, [dbInventory, customGear]);

  // Standard categories plus any others already present in the catalog (e.g.
  // "Uncategorized" from a quick-add), so nothing is filtered into oblivion.
  const categoryOptions = useMemo(() => {
    const extras = Array.from(new Set(allInventory.map(i => i.category).filter(Boolean)))
      .filter(cat => !ALL_CATEGORIES.includes(cat))
      .sort((a, b) => a.localeCompare(b));
    return [...ALL_CATEGORIES, ...extras];
  }, [allInventory]);

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

  const handleBarcodeScan = (code: string) => {
    if (!code.trim()) return;
    const cleanCode = code.trim();
    const item = allInventory.find(i => i.name.toLowerCase().includes(cleanCode.toLowerCase()));
    
    if (item) {
      setManifest(prev => {
        const current = prev[item.name] || 0;
        const next = Math.min(item.qty, current + 1);
        return { ...prev, [item.name]: next };
      });
      
      const historyItem = {
        id: 'scan_' + Date.now(),
        itemName: item.name,
        timestamp: new Date().toLocaleTimeString(),
        status: 'success' as const,
        code: cleanCode
      };
      setScanHistory(prev => [historyItem, ...prev].slice(0, 30));
      setScanStatus('success');
      setScannedItem(item.name);
      
      setTimeout(() => {
        setScanStatus(null);
        setScannedItem(null);
      }, 3000);
    } else {
      const historyItem = {
        id: 'scan_' + Date.now(),
        itemName: cleanCode,
        timestamp: new Date().toLocaleTimeString(),
        status: 'not_found' as const,
        code: cleanCode
      };
      setScanHistory(prev => [historyItem, ...prev].slice(0, 30));
      setScanStatus('not_found');
      
      setTimeout(() => {
        setScanStatus(null);
      }, 3000);
    }
    setScanInput('');
  };

  const resetOwnerContactUI = () => {
    setShowAddOwnerContact(false);
    setOwnerContactEmail('');
    setOwnerContactPhone('');
    setOwnerContactMsg(null);
  };

  const openAddModal = () => {
    setEditingItemName(null);
    setEditingIsDbItem(false);
    setSaveToStudioInventory(true);
    setGearItemError(null);
    setCustomName('');
    setCustomCategory('');
    setCustomQty('');
    setCustomValue('');
    setCustomOwner('');
    setCustomImage('');
    resetOwnerContactUI();
    setIsCustomModalOpen(true);
  };

  const handleEdit = (item: InventoryItem) => {
    let baseName = item.name;
    const owner = item.owner || '';
    if (owner && baseName.includes(`[${owner}]`)) {
        baseName = baseName.replace(` [${owner}]`, '').trim();
    }
    setEditingItemName(item.name); 
    setEditingIsDbItem(dbInventory.some(i => i.name === item.name));
    setSaveToStudioInventory(false);
    setGearItemError(null);
    setCustomName(baseName);
    setCustomCategory(item.category === UNCATEGORIZED ? '' : (item.category || ''));
    setCustomQty(item.qty ? String(item.qty) : '');
    setCustomValue(item.replacement ? String(item.replacement) : '');
    setCustomOwner(owner);
    setCustomImage(item.image || '');
    resetOwnerContactUI();
    setIsCustomModalOpen(true);
  };

  // The inventory table was created outside of migrations, so only send columns
  // that actually came back from the API rather than guessing the schema.
  const inventoryColumns = useMemo(
    () => (dbInventory[0] ? Object.keys(dbInventory[0]) : null),
    [dbInventory]
  );

  const toInventoryPayload = (item: InventoryItem) => {
    const full: Record<string, any> = {
      name: item.name,
      category: item.category,
      qty: item.qty,
      replacement: item.replacement,
      image: item.image || null,
      owner: item.owner || null,
    };
    if (!inventoryColumns) return full;
    return Object.fromEntries(Object.entries(full).filter(([key]) => inventoryColumns.includes(key)));
  };

  const renameInManifest = (fromName: string | null, toName: string, isNew: boolean) => {
    setManifest(prev => {
        const newManifest = { ...prev };
        if (fromName && fromName !== toName) {
            const count = newManifest[fromName];
            delete newManifest[fromName];
            if (count) newManifest[toName] = count;
        } else if (isNew) {
            newManifest[toName] = 1;
        }
        return newManifest;
    });
  };

  const addCustomItem = async () => {
    if (!customName.trim()) return;
    const finalName = customOwner.trim() ? `${customName.trim()} [${customOwner.trim()}]` : customName.trim();
    if (finalName !== editingItemName && allInventory.find(i => i.name.toLowerCase() === finalName.toLowerCase())) {
      setGearItemError('Item with this name already exists.');
      return;
    }
    const parsedQty = parseInt(customQty, 10);
    const parsedValue = parseFloat(customValue);
    const newItem: InventoryItem = {
      name: finalName,
      category: customCategory.trim() || UNCATEGORIZED,
      qty: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
      replacement: Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0,
      image: customImage.trim() || undefined,
      owner: customOwner.trim() || undefined
    };

    const writesToDb = editingIsDbItem || (!editingItemName && saveToStudioInventory);

    if (writesToDb) {
      setSavingGearItem(true);
      setGearItemError(null);
      try {
        if (editingIsDbItem && editingItemName) {
          const { error } = await supabase
            .from('inventory')
            .update(toInventoryPayload(newItem))
            .eq('name', editingItemName);
          if (error) throw error;
          setDbInventory(prev => prev.map(i => (i.name === editingItemName ? { ...i, ...newItem } : i)));
        } else {
          const { data, error } = await supabase
            .from('inventory')
            .insert([toInventoryPayload(newItem)])
            .select()
            .single();
          if (error) throw error;
          setDbInventory(prev => [...prev, (data as InventoryItem) || newItem]);
        }
      } catch (err: any) {
        setGearItemError(err.message || 'Could not save to the studio inventory.');
        setSavingGearItem(false);
        return;
      }
      setSavingGearItem(false);
    } else {
      setCustomGear(prev => {
          const filtered = prev.filter(i => i.name !== editingItemName);
          return [...filtered, newItem];
      });
    }

    renameInManifest(editingItemName, finalName, !editingItemName);

    // Save owner to list for autofill
    if (customOwner.trim()) {
      const owner = customOwner.trim();
      setSavedOwners(prev => {
        if (!prev.includes(owner)) {
          const next = [...prev, owner];
          localStorage.setItem('zipline_saved_owners', JSON.stringify(next));
          return next;
        }
        return prev;
      });
    }

    setIsCustomModalOpen(false);
  };

  const deleteGearItem = async () => {
    if (!editingItemName) return;
    if (!confirm(`Delete "${editingItemName}"${editingIsDbItem ? ' from the studio inventory database' : ''}? This cannot be undone.`)) return;

    if (editingIsDbItem) {
      setSavingGearItem(true);
      setGearItemError(null);
      try {
        const { error } = await supabase.from('inventory').delete().eq('name', editingItemName);
        if (error) throw error;
        setDbInventory(prev => prev.filter(i => i.name !== editingItemName));
      } catch (err: any) {
        setGearItemError(err.message || 'Could not delete from the studio inventory.');
        setSavingGearItem(false);
        return;
      }
      setSavingGearItem(false);
    } else {
      setCustomGear(prev => prev.filter(i => i.name !== editingItemName));
    }

    setManifest(prev => {
      const next = { ...prev };
      delete next[editingItemName];
      return next;
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
    setSelectedJobId(null);
  };

  const fetchWeather = async () => {
    if (!shootDate || !companyAddr) {
        alert('Please enter a Location and Shoot Date first.');
        return;
    }
    setWeatherLoading(true);
    setWeatherSuccess(false);
    try {
        // 1. Geocode with our internal API to avoid CORS issues
        const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(companyAddr)}`);
        const geoData = await geoRes.json();
        
        if (!geoRes.ok) {
            const msg = geoData.status ? `${geoData.error} (Google: ${geoData.status})` : (geoData.error || 'Address not found');
            throw new Error(msg);
        }
        const { lat, lng } = geoData;

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
    } catch (err: any) {
        console.error(err);
        alert(err.message || 'Could not fetch weather. Check address and date.');
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
             const errorMsg = data.googleStatus ? `${data.error} (Google: ${data.googleStatus})` : (data.error || 'No hospital found nearby.');
             alert(errorMsg);
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
              const errorMsg = data.googleStatus ? `${data.error} (Google: ${data.googleStatus})` : (data.error || 'No legitimate parking found nearby.');
              alert(errorMsg);
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
      title: jobTitle.trim(),
      client_name: contactEmail.trim(),
      production_company: companyName.trim(),
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
        // Store the client name as typed, but dedupe case-insensitively so we
        // don't create "Acme" and "ACME" as separate clients.
        const rawClientName = contactEmail.trim();
        const clientKey = rawClientName.toUpperCase();
        const existingClient = clients.find(c => c.name.trim().toUpperCase() === clientKey);

        if (!existingClient) {
          // Double-check database
          const { data: dbClients } = await supabase
            .from('clients')
            .select('id, name')
            .ilike('name', rawClientName);

          if (!dbClients || dbClients.length === 0) {
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({ name: rawClientName })
              .select();
            
            if (!clientError && newClient) {
              setClients(prev => [...prev, newClient[0] as Client]);
            }
          } else {
            // Client actually exists, add it to our local state
            setClients(prev => {
              const ids = new Set(prev.map(c => c.id));
              const toAdd = (dbClients as Client[]).filter(c => !ids.has(c.id));
              return [...prev, ...toAdd];
            });
          }
        }
      }

      // 2. Handle Job Saving
      // Only write back to the production this manifest is explicitly linked to, and
      // only while the title still matches it. Everything else gets its own row --
      // a double-booked day (two units, two locations) must stay two productions.
      const linkedJob = jobs.find(j => j.id === selectedJobId);
      let existingJob = linkedJob && linkedJob.title.trim().toLowerCase() === dbJob.title.toLowerCase()
        ? linkedJob
        : undefined;

      if (existingJob && existingJob.shoot_date && existingJob.shoot_date !== dbJob.shoot_date) {
        // Same title, different day: usually a second shoot rather than a reschedule.
        const isReschedule = confirm(
          `"${existingJob.title}" is on Slate for ${existingJob.shoot_date}, but this list says ${dbJob.shoot_date}.\n\n` +
          `OK - move that production to ${dbJob.shoot_date}\n` +
          `Cancel - log this as a separate production on ${dbJob.shoot_date}`
        );
        if (!isReschedule) existingJob = undefined;
      }

      if (!existingJob) {
        // A same-name production already on that date is ambiguous: it could be the one
        // we mean to update, or the other team's shoot. Ask instead of silently merging.
        const sameDayTwin = jobs.find(j =>
          j.title.trim().toLowerCase() === dbJob.title.toLowerCase() &&
          j.shoot_date === dbJob.shoot_date
        );
        if (sameDayTwin) {
          const updateTwin = confirm(
            `"${dbJob.title}" is already on Slate for ${dbJob.shoot_date}.\n\n` +
            `OK - update that existing production\n` +
            `Cancel - log this as a SECOND, separate production on the same day`
          );
          if (updateTwin) existingJob = sameDayTwin;
        }
      }

      const targetJob = existingJob;

      let res;
      if (targetJob) {
        res = await supabase.from('jobs').update(dbJob).eq('id', targetJob.id).select();
      } else {
        res = await supabase.from('jobs').insert(dbJob).select();
      }

      if (res.error) throw res.error;

      if (!res.data || res.data.length === 0) {
        throw new Error('No data returned from database');
      }

      if (targetJob) {
        setJobs(prev => prev.map(j => j.id === targetJob.id ? res.data![0] as Job : j));
        setSelectedJobId(res.data![0].id);
        alert('Job updated on Slate successfully!');
      } else {
        setJobs(prev => [...prev, res.data![0] as Job]);
        setSelectedJobId(res.data![0].id);
        alert('Job logged to Slate successfully!');
      }
    } catch (err: any) {
      console.error('Error saving job:', err);
      alert('Failed to save job to Slate: ' + (err.message || 'Unknown error'));
    }
  };

  const loadJob = (job: Job) => {
    setSelectedJobId(job.id);
    setJobTitle(job.title);
    if (job.shoot_date) setShootDate(job.shoot_date);
    if (job.client_name) setContactEmail(job.client_name);
    if (job.location_address) {
        setCompanyAddr(job.location_address);
    }
    
    // Load logistics if present on the job
    if (job.weather_summary) {
        setWeatherSummary(job.weather_summary);
        setWeatherSuccess(true);
    } else {
        setWeatherSummary(null);
        setWeatherSuccess(false);
    }

    if (job.nearest_hospital_name) {
        setNearestHospital({
            name: job.nearest_hospital_name,
            address: job.nearest_hospital_address || ''
        });
        setHospitalSuccess(true);
    } else {
        setNearestHospital(null);
        setHospitalSuccess(false);
    }

    if (job.nearest_parking_name) {
        setNearestParking({
            name: job.nearest_parking_name,
            address: job.nearest_parking_address || ''
        });
        setParkingSuccess(true);
    } else {
        setNearestParking(null);
        setParkingSuccess(false);
    }

    if (job.notes_general) setNotes(job.notes_general);
    if (job.gear_manifest) {
      const manifestObj = job.gear_manifest as Record<string, number>;
      setManifest(manifestObj);
      
      // Auto-recreate missing custom items in customGear so they render correctly in the manifest list!
      const missingKeys = Object.keys(manifestObj).filter(name => !allInventory.some(i => i.name === name));
      if (missingKeys.length > 0) {
        setCustomGear(prev => {
          const newCustoms = missingKeys.map(name => ({
            name,
            category: 'Specialty',
            qty: 100,
            replacement: 0,
            owner: 'Custom'
          }));
          const filtered = prev.filter(p => !missingKeys.includes(p.name));
          return [...filtered, ...newCustoms];
        });
      }
    }
    setIsCalendarOpen(false);
  };

  useEffect(() => {
    if (preloadedJob) {
      loadJob(preloadedJob);
      onClearPreload?.();
    }
  }, [preloadedJob]);

  useEffect(() => {
    if (selectedJobIdProp && jobs.length > 0) {
      const match = jobs.find(j => j.id === selectedJobIdProp);
      if (match) {
        loadJob(match);
      }
    }
  }, [selectedJobIdProp, jobs]);

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

  const saveGearTemplate = async () => {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('gear_templates')
        .insert({
          name: newTemplateName.trim(),
          description: newTemplateDesc.trim() || null,
          items: manifest
        })
        .select()
        .single();

      if (error) throw error;

      setGearTemplates(prev => [...prev, data as GearTemplate].sort((a,b) => a.name.localeCompare(b.name)));
      setIsSaveTemplateModalOpen(false);
      setNewTemplateName('');
      setNewTemplateDesc('');
      alert('Gear package template saved successfully!');
    } catch (err: any) {
      console.error('Error saving template:', err);
      alert('Failed to save template: ' + (err.message || 'Unknown error'));
    }
  };

  const deleteGearTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to permanently delete this gear package template?')) return;

    try {
      const { error } = await supabase
        .from('gear_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setGearTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err: any) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template: ' + (err.message || 'Unknown error'));
    }
  };

  const loadGearTemplate = (template: GearTemplate, mode: 'overwrite' | 'merge') => {
    if (mode === 'overwrite') {
      setManifest(template.items);
    } else {
      setManifest(prev => {
        const next = { ...prev };
        Object.entries(template.items).forEach(([name, qty]) => {
          next[name] = Math.max(next[name] || 0, qty);
        });
        return next;
      });
    }
    setActiveSidebarTab('gear');
    alert(`Loaded template "${template.name}" successfully!`);
  };

  const shareGearList = () => {
    if (!selectedJobId) return;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/share/gear/${selectedJobId}` : '';
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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

    // --- LOAD ASSETS & BRANDING ---
    const branding = await getBranding();
    const logoData = branding.logo_url ? await loadAsset(branding.logo_url) : '';
    const fontData = await loadAsset('/lulo-clean/LuloClean-Bold.otf');

    // Add Font
    if (fontData && fontData.includes('base64')) {
        try {
            const fontBase64 = fontData.split(',')[1];
            doc.addFileToVFS('LuloClean-Bold.otf', fontBase64);
            doc.addFont('LuloClean-Bold.otf', 'LuloClean-Bold', 'normal');
            console.log("Custom font loaded successfully");
        } catch (e) {
            console.error("Error registering custom font:", e);
        }
    }

    // --- COLORS (brand color is org-configurable) ---
    const ZIPLINE_BLUE = branding.brand_color || '#0077FF';
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
        doc.text(branding.name.toUpperCase(), margin, 40);
    }

    // Title (Right)
    const titleX = pageWidth - margin;
    const titleY = 45; 

    // Use standard Helvetica to ensure visibility
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(0, 0, 0); // Black
    doc.text('EQUIPMENT LIST', titleX, titleY, { align: 'right' });

    // Reset color for date
    doc.setTextColor(TEXT_GRAY);
    // Generated Date
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${date}`, pageWidth - margin, 60, { align: 'right' });

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
    doc.text(caps(companyName, branding.name.toUpperCase()), col1X, row1Y + 10);
    doc.text(contactEmail || '—', col2X, row1Y + 10);

    if (companyAddr) {
        const locLines = doc.splitTextToSize(caps(companyAddr), 160);
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

        doc.text(caps(weatherSummary, 'N/A'), col1X, row2Y + 10);

        if (nearestHospital) {
            const hospName = nearestHospital.name.length > 30 ? nearestHospital.name.substring(0, 28) + '...' : nearestHospital.name;
            doc.text(caps(hospName), col2X, row2Y + 10);
            if (nearestHospital.address) {
                doc.setFontSize(7);
                doc.setTextColor(TEXT_GRAY);
                const hospAddr = nearestHospital.address.length > 35 ? nearestHospital.address.substring(0, 33) + '...' : nearestHospital.address;
                doc.text(caps(hospAddr), col2X, row2Y + 18);
                doc.setFontSize(9);
                doc.setTextColor(TEXT_DARK);
            }
        } else {
            doc.text('—', col2X, row2Y + 10);
        }

        if (nearestParking) {
            const parkName = nearestParking.name.length > 30 ? nearestParking.name.substring(0, 28) + '...' : nearestParking.name;
            doc.text(caps(parkName), col3X, row2Y + 10);
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
            doc.text(caps(cat), margin, y);
            doc.setTextColor(TEXT_DARK);
            y += 18;
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            ownerGroup[cat].sort((a, b) => a.name.localeCompare(b.name)).forEach(row => {
                const bullet = "• " + caps(sanitizeText(row.name)) + "  (x" + row.count + ")";
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
                title: jobTitle || 'Equipment List',
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

    const safeJob = jobTitle ? jobTitle.replace(/[^a-z0-9\-_\s]/gi, "").trim().replace(/\s+/g, "_") : "Equipment_List";
    doc.save(`${safeJob || "Equipment_List"}.pdf`);
  };

  // Which saved production "Log to Slate" will write to. Undefined means "create a
  // new production" -- the safe default when two shoots share a date.
  const activeLinkedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : undefined;

  const ManifestContent = (
    <section className="bg-neutral-900/80 border border-white/10 p-6 md:p-8 rounded-2xl lg:sticky lg:top-24 h-full lg:h-[calc(100vh-140px)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold tracking-tight text-white">Current Manifest</h2>
        </div>
        <div className="flex items-center gap-4">
          {Object.keys(manifest).length > 0 && (
            <button 
              onClick={clearManifest}
              className="text-xs font-semibold opacity-40 hover:opacity-100 hover:text-red-500 transition-all flex items-center gap-2"
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
        <div className="space-y-0.5 relative">
          <label className="text-xs font-semibold opacity-40 ml-1 flex items-center gap-1.5">
            Job Title
            {selectedJobIdProp && <Lock className="w-2.5 h-2.5 text-accent opacity-60" />}
            {!selectedJobIdProp && (
              activeLinkedJob ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-accent opacity-80">Updating &quot;{activeLinkedJob.title}&quot;</span>
                  <button
                    type="button"
                    onClick={() => setSelectedJobId(null)}
                    className="underline opacity-60 hover:opacity-100"
                    title="Log this as a separate production instead"
                  >
                    log as new
                  </button>
                </span>
              ) : jobTitle.trim() ? (
                <span className="opacity-60">New production</span>
              ) : null
            )}
          </label>
          <div className="relative">
            <input 
              type="text" 
              value={jobTitle}
              disabled={!!selectedJobIdProp}
              onChange={(e) => {
                  const val = e.target.value;
                  setJobTitle(val);
                  
                  // Autofill attempt
                  const matchedJob = jobs.find(j => j.title.toLowerCase() === val.toLowerCase());
                  if (matchedJob) {
                      setSelectedJobId(matchedJob.id);
                      if (matchedJob.shoot_date) setShootDate(matchedJob.shoot_date);
                      if (matchedJob.client_name) setContactEmail(matchedJob.client_name);
                      if (matchedJob.location_address) {
                          setCompanyAddr(matchedJob.location_address);
                          
                          // Load logistics if present
                          if (matchedJob.weather_summary) {
                              setWeatherSummary(matchedJob.weather_summary);
                              setWeatherSuccess(true);
                          } else {
                              setWeatherSummary(null);
                              setWeatherSuccess(false);
                          }
                          
                          if (matchedJob.nearest_hospital_name) {
                              setNearestHospital({
                                  name: matchedJob.nearest_hospital_name,
                                  address: matchedJob.nearest_hospital_address || ''
                              });
                              setHospitalSuccess(true);
                          } else {
                              setNearestHospital(null);
                              setHospitalSuccess(false);
                          }
                          
                          if (matchedJob.nearest_parking_name) {
                              setNearestParking({
                                  name: matchedJob.nearest_parking_name,
                                  address: matchedJob.nearest_parking_address || ''
                              });
                              setParkingSuccess(true);
                          } else {
                              setNearestParking(null);
                              setParkingSuccess(false);
                          }
                      }
                      if (matchedJob.notes_general) setNotes(matchedJob.notes_general);
                      if (matchedJob.gear_manifest) {
                          setManifest(matchedJob.gear_manifest as Record<string, number>);
                      }
                  } else {
                      // Title no longer matches a saved production, so this is a different
                      // shoot. Drop the link or saving would overwrite the job we were on.
                      setSelectedJobId(null);
                  }
              }}
              placeholder="e.g. Moulin Rouge"
              list="job-list"
              className={`w-full bg-black/50 border py-2.5 px-4 outline-none transition-colors text-sm font-semibold rounded-lg ${
                selectedJobIdProp 
                  ? 'border-accent/20 text-white/40 cursor-not-allowed bg-accent/5' 
                  : 'border-white/10 focus:border-accent'
              }`}
            />
            {selectedJobIdProp && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                <Lock className="w-3.5 h-3.5 text-accent" />
              </div>
            )}
          </div>
          <datalist id="job-list">
            {jobs.map(j => (
                <option key={j.id} value={j.title}>{j.client_name ? `(${caps(j.client_name)})` : ''}</option>
            ))}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold opacity-40 ml-1">Shoot Date</label>
          <div className="flex gap-2">
            <input 
                type="date" 
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="w-full bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg"
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
          <label className="text-xs font-semibold opacity-40 ml-1">Generated For</label>
          <input 
            type="text" 
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Client Name"
            list="client-options"
            className="w-full bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg"
          />
          <datalist id="client-options">
            {clients.map(client => (
                <option key={client.id} value={client.name} />
            ))}
          </datalist>
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold opacity-40 ml-1">Generated By</label>
          <input 
            type="text" 
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg"
          />
        </div>
        <div className="space-y-0.5 md:col-span-2">
          <label className="text-xs font-semibold opacity-40 ml-1">Location</label>
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
            className="w-full bg-black/5 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg"
            placeholder="Search for a location..."
          />
          <div className="flex gap-2 pt-1 relative">
             {hoveredLogistics && (
                <div className="absolute bottom-full left-0 mb-2 w-full bg-neutral-900 border border-white/10 p-3 rounded-xl shadow-xl z-50 pointer-events-none">
                    {hoveredLogistics === 'weather' && (
                        <div>
                            <p className="text-xs font-semibold text-accent mb-1">Weather Forecast</p>
                            <p className="text-xs font-semibold">{weatherSummary || 'No weather data loaded.'}</p>
                        </div>
                    )}
                    {hoveredLogistics === 'hospital' && (
                        <div>
                            <p className="text-xs font-semibold text-red-500 mb-1">Nearest Hospital</p>
                            {nearestHospital ? (
                                <>
                                    <p className="text-xs font-semibold">{nearestHospital.name}</p>
                                    <p className="text-[10px] opacity-60">{nearestHospital.address}</p>
                                </>
                            ) : <p className="text-xs opacity-50">No hospital found.</p>}
                        </div>
                    )}
                    {hoveredLogistics === 'parking' && (
                        <div>
                            <p className="text-xs font-semibold text-blue-500 mb-1">Nearest Parking</p>
                            {nearestParking ? (
                                <>
                                    <p className="text-xs font-semibold">{nearestParking.name}</p>
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
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all ${weatherSuccess ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'opacity-60 hover:opacity-100'}`}
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
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all ${hospitalSuccess ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'opacity-60 hover:opacity-100'}`}
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
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 border border-white/10 rounded-lg text-xs font-semibold hover:bg-white/10 transition-all ${parkingSuccess ? 'text-green-500 border-green-500/20 bg-green-500/10' : 'opacity-60 hover:opacity-100'}`}
             >
                {parkingLoading ? '...' : parkingSuccess ? <Check className="w-3 h-3" /> : <Car className="w-3 h-3" />}
                {parkingSuccess ? 'View' : 'Parking'}
             </button>
          </div>
        </div>
      </div>

      <div className="space-y-0.5 mb-6">
        <label className="text-xs font-semibold opacity-40 ml-1">Production Notes</label>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={1}
          placeholder="Call time, parking, etc..."
          className="w-full bg-black/50 border border-white/10 py-3 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg resize-none"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto mb-6 pr-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {Object.keys(manifestByOwner).length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center border-2 border-dashed border-white/5 rounded-2xl opacity-20"
            >
              <p className="text-xs font-semibold text-white/40">Manifest is empty</p>
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
                        <h2 className={`text-xs font-bold mb-4 pb-2 border-b border-white/10 ${owner === 'Zipline Media' ? 'text-white' : 'text-red-500'}`}>
                            {owner}
                        </h2>
                    )}
                    
                    {Object.entries(manifestByOwner[owner]).map(([cat, items]) => (
                        <div key={cat} className="mb-4 pl-2 border-l border-white/5">
                            <h3 className="text-xs font-semibold text-accent mb-2 ml-1">{cat}</h3>
                            <div className="space-y-2">
                            {items.map((item) => {
                                const invItem = allInventory.find(i => i.name === item.name);
                                
                                return (
                                <div key={item.name} className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 group">
                                    <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-semibold truncate">{item.name}</p>
                                    <p className="text-[10px] opacity-40 font-medium">
                                        X{item.count} • ${( (invItem?.replacement || 0) * item.count ).toLocaleString()}
                                    </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {invItem && (
                                            <button
                                                onClick={() => handleEdit(invItem)}
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
            <p className="text-xs font-semibold opacity-40">Total Replacement Value</p>
            {/* <p className="text-3xl font-black text-accent">${grandTotal.toLocaleString()}</p> */}
          </div>
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <div className={`w-4 h-4 border border-white/20 rounded flex items-center justify-center transition-all ${includeReplacementValue ? 'bg-accent border-accent' : 'bg-transparent group-hover:border-white/40'}`}>
              {includeReplacementValue && <Check className="w-3 h-3 text-black" />}
            </div>
            <span className="text-xs font-semibold opacity-60 group-hover:opacity-100 transition-opacity">Include in PDF</span>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={includeReplacementValue} 
              onChange={e => setIncludeReplacementValue(e.target.checked)} 
            />
          </label>
        </div>
      </div>

        {Object.keys(manifest).length > 0 && (
          <button 
            onClick={() => {
              setNewTemplateName('');
              setNewTemplateDesc('');
              setIsSaveTemplateModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 border border-white/10 hover:border-accent hover:text-accent py-2.5 text-xs font-semibold transition-all rounded-xl"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Save as Gear Package
          </button>
        )}
                <div className="sticky bottom-0 z-20 bg-neutral-900/90 backdrop-blur-md p-4 border-t border-white/10">
            <div className="grid grid-cols-4 gap-1.5">
          <button 
            type="button"
            onClick={resetApp}
            className="flex items-center justify-center gap-1 border border-white/10 py-2.5 text-xs font-semibold hover:bg-white hover:text-black transition-all rounded-xl"
            title="Reset gear list"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
          <button 
            type="button"
            onClick={saveJob}
            disabled={Object.keys(manifest).length === 0}
            className="flex items-center justify-center gap-1 border border-accent/20 bg-accent/5 py-2.5 text-xs font-semibold text-accent hover:bg-accent hover:text-white transition-all rounded-xl shadow-lg shadow-accent/5"
            title="Log gear to Slate"
          >
            <ClipboardList className="w-3.5 h-3.5" /> Slate
          </button>
          <button 
            type="button"
            onClick={exportPDF}
            disabled={Object.keys(manifest).length === 0}
            className="flex items-center justify-center gap-1 bg-accent py-2.5 text-xs font-semibold hover:bg-white hover:text-black disabled:opacity-20 disabled:hover:bg-accent disabled:hover:text-white transition-all rounded-xl shadow-lg shadow-accent/20"
          >
            <FileDown className="w-3.5 h-3.5" /> PDF
          </button>
          <button 
            type="button"
            onClick={shareGearList}
            disabled={!selectedJobId || Object.keys(manifest).length === 0}
            className={`flex items-center justify-center gap-1 py-2.5 text-xs font-semibold border transition-all rounded-xl ${
              copiedLink 
                ? 'bg-green-600 border-green-500 text-white' 
                : 'border-white/10 text-white/60 hover:bg-white hover:text-black disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-white/40'
            }`}
            title="Copy shareable link"
          >
            <Share2 className="w-3.5 h-3.5" /> {copiedLink ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>
    </section>);

    return (
    <div className="pt-8 pb-32 lg:pb-8 px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
          <div className="lg:col-span-7 space-y-8">
            <section className="bg-neutral-900/50 border border-white/10 p-0 md:p-6 md:pb-0 rounded-2xl overflow-hidden flex flex-col h-fit max-h-[75vh] lg:max-h-none lg:h-[calc(100vh-140px)] sticky top-24">
              
              <div className="bg-neutral-900/90 backdrop-blur-md p-4 md:p-0 z-20 sticky top-0 border-b md:border-b-0 border-white/10 space-y-4">
                {/* Double Row Tab Toggle */}
                <div className="space-y-1.5 p-1.5 bg-black/40 border border-white/5 rounded-2xl">
                  {/* Row 1: Core Selection & Building */}
                  <div className="flex gap-1.5">
                    <button 
                      type="button"
                      onClick={() => setActiveSidebarTab('gear')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${activeSidebarTab === 'gear' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40 hover:text-white bg-white/5'}`}
                    >
                      Inventory
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveSidebarTab('library')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${activeSidebarTab === 'library' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40 hover:text-white bg-white/5'}`}
                    >
                      Library
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveSidebarTab('templates')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${activeSidebarTab === 'templates' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40 hover:text-white bg-white/5'}`}
                    >
                      Packages
                    </button>
                  </div>
                  {/* Row 2: Expanded Logistics */}
                  <div className="flex gap-1.5">
                    <button 
                      type="button"
                      onClick={() => setActiveSidebarTab('scanner')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${activeSidebarTab === 'scanner' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white bg-white/5'}`}
                    >
                      QR Scanner
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveSidebarTab('subrentals')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${activeSidebarTab === 'subrentals' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white bg-white/5'}`}
                    >
                      Sub-Rentals
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveSidebarTab('maintenance')}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${activeSidebarTab === 'maintenance' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white bg-white/5'}`}
                    >
                      Maintenance
                    </button>
                  </div>
                </div>

                {activeSidebarTab === 'gear' ? (
                  <>
                    <div className="flex gap-4">
                      <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="flex-1 bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-xl appearance-none cursor-pointer"
                      >
                        <option value="All">ALL CATEGORIES</option>
                        {categoryOptions.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <button
                        onClick={openAddModal}
                        className="bg-white text-black px-4 text-xs font-semibold hover:bg-accent hover:text-white transition-all rounded-xl shadow-lg shadow-white/5 whitespace-nowrap flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="hidden md:inline">Custom</span>
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                      <input 
                        type="text" 
                        placeholder="Search gear..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 py-2.5 pl-10 pr-10 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-xl"
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
                ) : activeSidebarTab === 'library' ? (
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-accent">Saved Production Slates</h3>
                    <p className="text-xs font-semibold opacity-40">{jobs.length} Total</p>
                  </div>
                ) : activeSidebarTab === 'templates' ? (
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-accent">Gear Package Templates</h3>
                    <p className="text-xs font-semibold opacity-40">{gearTemplates.length} Total</p>
                  </div>
                ) : activeSidebarTab === 'scanner' ? (
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-accent">Studio Barcode / QR Scanner</h3>
                    <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold tracking-wider">SIMULATION ON</span>
                  </div>
                ) : activeSidebarTab === 'subrentals' ? (
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-accent">External Sub-Rentals</h3>
                    <span className="text-[9px] bg-accent/20 border border-accent/30 text-accent px-2 py-0.5 rounded font-bold tracking-wider">TRACKER</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-accent">Gear Maintenance Logs</h3>
                    <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded font-bold tracking-wider">HEALTH LOG</span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 md:px-0 custom-scrollbar">
                {activeSidebarTab === 'gear' ? (
                  <>
                    {filteredGroupedItems ? (
                      Object.keys(filteredGroupedItems).sort().map(cat => (
                        <div key={cat} className="mb-8 last:mb-0">
                          <h3 className="sticky top-0 bg-neutral-900/95 backdrop-blur z-10 py-3 text-xs font-bold text-accent mb-2 border-b border-white/10">{cat}</h3>
                          <div className="space-y-2">
                            {filteredGroupedItems[cat].map(item => (
                                <GearItem 
                                  key={item.name} 
                                  item={item} 
                                  manifestCount={manifest[item.name] || 0}
                                  onUpdate={updateManifest} 
                                  onEdit={handleEdit}
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
                            <p className="text-xs font-semibold text-white/40">No gear found</p>
                          </div>
                        ) : (
                          filteredItems.map((item) => (
                            <GearItem 
                              key={item.name} 
                              item={item} 
                              manifestCount={manifest[item.name] || 0}
                              onUpdate={updateManifest}
                              onEdit={handleEdit}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </>
                ) : activeSidebarTab === 'library' ? (
                  <div className="space-y-3 pb-8">
                    {jobs.length === 0 ? (
                      <div className="py-32 text-center opacity-20">
                        <ClipboardList className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-xs font-semibold text-white/40">Slate is empty</p>
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
                            <h4 className="text-sm font-semibold tracking-tight mb-1 group-hover:text-accent transition-colors truncate">{job.title}</h4>
                            <div className="flex items-center gap-3 opacity-40">
                              <p className="text-[10px] font-semibold flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {job.shoot_date}
                              </p>
                              <p className="text-[10px] font-semibold flex items-center gap-1">
                                <User className="w-3 h-3" /> {job.client_name || 'No Client'}
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
                ) : activeSidebarTab === 'templates' ? (
                  // Templates list
                  <div className="space-y-3 pb-8">
                    {gearTemplates.length === 0 ? (
                      <div className="py-32 text-center opacity-20">
                        <Package className="w-16 h-16 mx-auto mb-4" />
                        <p className="text-xs font-semibold text-white/40">No packages saved yet</p>
                      </div>
                    ) : (
                      gearTemplates.map(template => (
                        <div 
                          key={template.id}
                          className="group flex flex-col p-4 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold tracking-tight text-white">{template.name}</h4>
                              {template.description && (
                                <p className="text-[10px] opacity-65 normal-case mt-0.5 line-clamp-2">{template.description}</p>
                              )}
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGearTemplate(template.id);
                              }}
                              className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all shrink-0"
                              title="Delete Package"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-3 max-h-16 overflow-y-auto pr-1 py-0.5 border-t border-b border-white/5">
                            {Object.entries(template.items).map(([name, qty]) => (
                              <span key={name} className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/70 font-semibold">
                                {qty}x {name}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <button
                              type="button"
                              onClick={() => loadGearTemplate(template, 'merge')}
                              className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold rounded-lg text-white/80 transition-all"
                            >
                              Merge List
                            </button>
                            <button
                              type="button"
                              onClick={() => loadGearTemplate(template, 'overwrite')}
                              className="py-2 bg-accent hover:bg-white hover:text-black text-xs font-semibold rounded-lg text-white transition-all shadow-md shadow-accent/10"
                            >
                              Load Package
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : activeSidebarTab === 'scanner' ? (
                  // Barcode & QR Scanner Simulation View
                  <div className="space-y-6 pb-12 text-white px-1">
                    {/* Simulated Cam Feed Viewport */}
                    <div className="relative aspect-video w-full bg-neutral-950 rounded-2xl border border-white/10 overflow-hidden flex flex-col items-center justify-center">
                      <style>{`
                        @keyframes laser-sweep {
                          0% { top: 0%; }
                          50% { top: 100%; }
                          100% { top: 0%; }
                        }
                        .laser-line {
                          position: absolute;
                          left: 0;
                          right: 0;
                          height: 2px;
                          background: linear-gradient(90deg, transparent, #00FF88, transparent);
                          box-shadow: 0 0 12px #00FF88;
                          animation: laser-sweep 4s infinite linear;
                          z-index: 10;
                        }
                      `}</style>
                      
                      {/* Laser Line */}
                      <div className="laser-line" />
                      
                      {/* Neon Targeting Corners */}
                      <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-green-500/60" />
                      <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-green-500/60" />
                      <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-green-500/60" />
                      <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-green-500/60" />

                      <div className="text-center p-6 z-10 flex flex-col items-center">
                        <QrCode className="w-12 h-12 text-green-400 mb-3 animate-pulse" />
                        <span className="text-[8px] font-black text-green-400 tracking-widest bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 uppercase">
                          FEED ACTIVE
                        </span>
                        <p className="text-[9px] text-white/35 mt-2 uppercase tracking-wider font-bold">Hold code or type item name below</p>
                      </div>
                    </div>

                    {/* Alert Toast Notification */}
                    {scanStatus && (
                      <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                        scanStatus === 'success' 
                          ? 'bg-green-500/10 border-green-500/25 text-green-400' 
                          : 'bg-red-500/10 border-red-500/25 text-red-400'
                      }`}>
                        <div className="w-2 h-2 rounded-full bg-current animate-ping" />
                        <div className="flex-1 text-[11px] font-bold uppercase tracking-wider">
                          {scanStatus === 'success' 
                            ? `Scanned Successfully: "${scannedItem}"` 
                            : 'Scan Error: Equipment not found in studio inventory'}
                        </div>
                      </div>
                    )}

                    {/* Quick presets */}
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest">Interactive Presets</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {['RED V-Raptor', 'Sony FX6', 'Arri Signature Prime', 'DJI Ronin 2', 'Aputure 1200d'].map(name => (
                          <button
                            type="button"
                            key={name}
                            onClick={() => handleBarcodeScan(name)}
                            className="bg-white/5 hover:bg-green-500/10 border border-white/5 hover:border-green-500/30 text-[9px] font-bold px-2.5 py-1.5 rounded-lg transition-all text-white/80 cursor-pointer"
                          >
                            Scan {name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Manual entry */}
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest">Manual Barcode Input</h4>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleBarcodeScan(scanInput)}
                          placeholder="ENTER BARCODE OR SEARCH ITEM NAME..."
                          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] font-medium text-white outline-none focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={() => handleBarcodeScan(scanInput)}
                          className="bg-accent hover:bg-white hover:text-black text-white px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-accent"
                        >
                          Scan
                        </button>
                      </div>
                    </div>

                    {/* Scan History */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest">Session History</h4>
                        {scanHistory.length > 0 && (
                          <button 
                            type="button" 
                            onClick={() => setScanHistory([])} 
                            className="text-[8px] font-black text-red-400 hover:underline uppercase tracking-widest"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {scanHistory.length > 0 ? (
                          scanHistory.map((h) => (
                            <div key={h.id} className="flex justify-between items-center bg-black/20 border border-white/5 p-3 rounded-xl">
                              <div>
                                <p className="text-[10px] font-bold text-white uppercase tracking-tight">{h.itemName}</p>
                                <span className="text-[7px] text-white/40 uppercase tracking-widest">{h.timestamp} • CODE: {h.code}</span>
                              </div>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                                h.status === 'success' 
                                  ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                                  : 'bg-red-500/10 border-red-500/20 text-red-400'
                              }`}>
                                {h.status === 'success' ? 'IN' : 'ERR'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-white/30 italic py-4 text-center border border-dashed border-white/10 rounded-xl">
                            Ready to scan studio equipment.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : activeSidebarTab === 'subrentals' ? (
                  // External Sub-Rentals Panel
                  <div className="space-y-6 pb-12 text-white px-1">
                    {/* Add Form */}
                    <div className="bg-black/15 border border-white/5 p-4 rounded-2xl space-y-4">
                      <h4 className="text-[9px] font-black text-accent uppercase tracking-widest">Log External Sub-Rental</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          value={subRentalItem}
                          onChange={(e) => setSubRentalItem(e.target.value)}
                          placeholder="EQUIPMENT ITEM (e.g. 24-70mm f2.8)"
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text"
                            value={subRentalHouse}
                            onChange={(e) => setSubRentalHouse(e.target.value)}
                            placeholder="RENTAL HOUSE (e.g. Adorama)"
                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                          />
                          <input 
                            type="number"
                            value={subRentalCost}
                            onChange={(e) => setSubRentalCost(e.target.value)}
                            placeholder="COST ($)"
                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="date"
                            value={subRentalReturnDate}
                            onChange={(e) => setSubRentalReturnDate(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-accent cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = parseFloat(subRentalCost);
                              if (subRentalItem.trim() && subRentalHouse.trim() && subRentalReturnDate) {
                                const newR = {
                                  id: 'sub_' + Date.now(),
                                  itemName: subRentalItem.trim(),
                                  rentalHouse: subRentalHouse.trim(),
                                  cost: isNaN(val) ? 0 : val,
                                  returnDate: subRentalReturnDate
                                };
                                setSubRentals(prev => [newR, ...prev]);
                                setSubRentalItem('');
                                setSubRentalHouse('');
                                setSubRentalCost('');
                                setSubRentalReturnDate('');
                              }
                            }}
                            className="bg-accent hover:bg-white hover:text-black text-white px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-accent"
                          >
                            Log Rental
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Active Sub-rentals list */}
                    <div className="space-y-3">
                      <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest">Active Sub-rented Gear</h4>
                      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                        {subRentals.length > 0 ? (
                          subRentals.map((r) => {
                            const diffTime = new Date(r.returnDate).getTime() - new Date().setHours(0,0,0,0);
                            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            return (
                              <div key={r.id} className="group flex justify-between items-center bg-black/20 border border-white/5 p-3 rounded-xl hover:border-white/10 transition-all">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-white/50 uppercase tracking-widest">{r.rentalHouse}</span>
                                    <span className="text-[10px] font-black text-green-400">${r.cost.toLocaleString()}</span>
                                  </div>
                                  <p className="text-xs font-bold text-white mt-1 uppercase tracking-tight">{r.itemName}</p>
                                  
                                  {/* Return date countdown */}
                                  <div className="mt-1.5 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-white/30" />
                                    <span className={`text-[8px] font-black uppercase tracking-widest ${
                                      daysLeft < 0 
                                        ? 'text-red-400' 
                                        : daysLeft === 0 
                                          ? 'text-yellow-400 animate-pulse' 
                                          : 'text-white/50'
                                    }`}>
                                      {daysLeft < 0 
                                        ? `OVERDUE BY ${Math.abs(daysLeft)} DAYS` 
                                        : daysLeft === 0 
                                          ? 'DUE TODAY' 
                                          : `${daysLeft} DAYS REMAINING`}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSubRentals(prev => prev.filter(item => item.id !== r.id))}
                                  className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-[10px] text-white/30 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                            No active external sub-rentals logged.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Gear Maintenance Logs Panel
                  <div className="space-y-6 pb-12 text-white px-1">
                    {/* Add Form */}
                    <div className="bg-black/15 border border-white/5 p-4 rounded-2xl space-y-4">
                      <h4 className="text-[9px] font-black text-accent uppercase tracking-widest">Log Maintenance / Service</h4>
                      <div className="space-y-2">
                        <input 
                          type="text"
                          value={maintItem}
                          onChange={(e) => setMaintItem(e.target.value)}
                          placeholder="EQUIPMENT ITEM (e.g. RED Raptor Body)"
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={maintType}
                            onChange={(e) => setMaintType(e.target.value)}
                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-accent cursor-pointer"
                          >
                            <option value="Sensor Cleaning">Sensor Cleaning</option>
                            <option value="Firmware Update">Firmware Update</option>
                            <option value="Lens Calibration">Lens Calibration</option>
                            <option value="Repair / Service">Repair / Service</option>
                            <option value="General Checkup">General Checkup</option>
                          </select>
                          <input 
                            type="text"
                            value={maintTech}
                            onChange={(e) => setMaintTech(e.target.value)}
                            placeholder="TECHNICIAN NAME"
                            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                          />
                        </div>
                        <input 
                          type="text"
                          value={maintNotes}
                          onChange={(e) => setMaintNotes(e.target.value)}
                          placeholder="SERVICE NOTES / COMPLETED TASKS"
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="date"
                            value={maintDate}
                            onChange={(e) => setMaintDate(e.target.value)}
                            className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-accent cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (maintItem.trim() && maintTech.trim() && maintDate) {
                                const newL = {
                                  id: 'maint_' + Date.now(),
                                  itemName: maintItem.trim(),
                                  serviceType: maintType,
                                  techName: maintTech.trim(),
                                  serviceDate: maintDate,
                                  status: 'Completed',
                                  notes: maintNotes.trim() || 'No additional notes'
                                };
                                setMaintenanceLogs(prev => [newL, ...prev]);
                                setMaintItem('');
                                setMaintTech('');
                                setMaintNotes('');
                                setMaintDate('');
                              }
                            }}
                            className="bg-accent hover:bg-white hover:text-black text-white px-4 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-accent"
                          >
                            Log Service
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Maintenance history list */}
                    <div className="space-y-3">
                      <h4 className="text-[9px] font-black text-white/30 uppercase tracking-widest">Equipment Service History</h4>
                      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                        {maintenanceLogs.length > 0 ? (
                          maintenanceLogs.map((l) => (
                            <div key={l.id} className="group flex flex-col bg-black/20 border border-white/5 p-4 rounded-xl hover:border-white/10 transition-all space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-white/50 uppercase tracking-widest">{l.serviceType}</span>
                                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-wider">{l.serviceDate}</span>
                                  </div>
                                  <p className="text-xs font-bold text-white mt-1 uppercase tracking-tight">{l.itemName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-black bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase tracking-wider">
                                    {l.status}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setMaintenanceLogs(prev => prev.filter(item => item.id !== l.id))}
                                    className="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-white/60 bg-black/20 p-2.5 rounded-lg border border-white/5 font-medium leading-relaxed uppercase tracking-tighter">
                                {l.notes}
                              </p>
                              <div className="flex justify-between items-center text-[7px] text-white/30 uppercase tracking-widest font-bold">
                                <span>Tech: {l.techName}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[10px] text-white/30 italic py-6 text-center border border-dashed border-white/10 rounded-xl">
                            No equipment maintenance records logged.
                          </p>
                        )}
                      </div>
                    </div>
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
              className="fixed inset-0 z-[110] bg-neutral-950 lg:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 bg-neutral-900/50 backdrop-blur-lg sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-accent" />
                  <h2 className="text-lg font-bold text-white">Manifest</h2>
                  <span className="bg-accent/20 text-accent text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    {Object.values(manifest).reduce((a, b) => a + b, 0)} items
                  </span>
                </div>
                <button 
                  onClick={() => setIsMobileManifestOpen(false)}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 pb-32 custom-scrollbar">
                {ManifestContent}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Mobile Trigger */}
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[105] lg:hidden w-full px-6">
          <motion.button
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsMobileManifestOpen(true)}
            className="w-full bg-accent text-white py-4 px-6 rounded-2xl shadow-2xl shadow-accent/40 flex items-center justify-between font-semibold text-xs"
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5" />
              <span>Review Manifest</span>
            </div>
            <div className="bg-white/20 px-3 py-1 rounded-full text-[10px]">
              {Object.values(manifest).reduce((a, b) => a + b, 0)}
            </div>
          </motion.button>
        </div>

        <ModalPortal>
        <AnimatePresence>
          {isCalendarOpen && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 md:p-8">
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
                    <h2 className="text-lg font-bold text-white">Select Job or Date</h2>
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
        </ModalPortal>

        <ModalPortal>
        <AnimatePresence>
          {isCustomModalOpen && (
            <div className="fixed inset-0 z-[130] flex items-start md:items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCustomModalOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-2xl w-full max-w-md shadow-2xl my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-start justify-between mb-6 gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">{editingItemName ? 'Edit Gear Record' : 'Add Gear'}</h2>
                    {editingItemName && (
                      <p className="text-[10px] font-semibold mt-1 uppercase tracking-wider opacity-40">
                        {editingIsDbItem ? 'Studio inventory · saves to database' : 'Local custom item · this session only'}
                      </p>
                    )}
                  </div>
                  <button onClick={() => setIsCustomModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors shrink-0">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold opacity-40 ml-1">Owner / Source <span className="opacity-50">(Optional)</span></label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                      <input
                        type="text"
                        value={customOwner}
                        onChange={(e) => { setCustomOwner(e.target.value); setOwnerContactMsg(null); setShowAddOwnerContact(false); }}
                        placeholder="e.g. Rental House A"
                        list="saved-owners"
                        className="w-full bg-black/50 border border-white/10 py-2.5 pl-10 pr-4 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                      />
                      <datalist id="saved-owners">
                        {/* Existing Rolodex contacts + previously used owners */}
                        {Array.from(new Set([...contacts.map(c => c.name), ...savedOwners])).map(owner => (
                          <option key={owner} value={owner} />
                        ))}
                      </datalist>
                    </div>

                    {/* Offer to save a new owner (rental house / contractor) as a contact */}
                    {(() => {
                      const name = customOwner.trim();
                      if (!name) return null;
                      const exists = contacts.some(c => c.name.toLowerCase() === name.toLowerCase());
                      if (exists) {
                        return <p className="text-[10px] font-semibold text-green-400/80 ml-1 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> In Rolodex</p>;
                      }
                      if (ownerContactMsg) {
                        return <p className="text-[10px] font-semibold text-accent ml-1 mt-1">{ownerContactMsg}</p>;
                      }
                      if (!showAddOwnerContact) {
                        return (
                          <button
                            type="button"
                            onClick={() => setShowAddOwnerContact(true)}
                            className="mt-1.5 ml-1 flex items-center gap-1.5 text-[10px] font-semibold text-accent hover:text-white transition-colors"
                          >
                            <UserPlus className="w-3 h-3" /> Add &ldquo;{name}&rdquo; to Rolodex
                          </button>
                        );
                      }
                      return (
                        <div className="mt-2 p-3 bg-black/40 border border-white/10 rounded-lg space-y-2">
                          <p className="text-[10px] font-semibold text-white/50">New Contact · {name}</p>
                          <input
                            type="email"
                            value={ownerContactEmail}
                            onChange={(e) => setOwnerContactEmail(e.target.value)}
                            placeholder="Email (Optional)"
                            className="w-full bg-black/50 border border-white/10 py-1.5 px-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                          />
                          <input
                            type="tel"
                            value={ownerContactPhone}
                            onChange={(e) => setOwnerContactPhone(e.target.value)}
                            placeholder="Phone (Optional)"
                            className="w-full bg-black/50 border border-white/10 py-1.5 px-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSaveOwnerAsContact}
                              disabled={savingOwnerContact}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            >
                              {savingOwnerContact ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                              Save Contact
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowAddOwnerContact(false)}
                              className="px-3 py-1.5 text-xs font-semibold text-white/40 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold opacity-40 ml-1">Item Name</label>
                    <input 
                      type="text" 
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. RED Komodo"
                      autoFocus
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold opacity-40 ml-1">Category <span className="opacity-50">(Optional)</span></label>
                    <select 
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg appearance-none"
                    >
                      <option value="">{UNCATEGORIZED} &mdash; pick later</option>
                      {categoryOptions.filter(cat => cat !== UNCATEGORIZED).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                      <label className="text-xs font-semibold opacity-40 ml-1">Quantity <span className="opacity-50">(Optional)</span></label>
                      <input 
                        type="number" 
                        min="1"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        placeholder="1"
                        className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold opacity-40 ml-1">Value ($) <span className="opacity-50">(Optional)</span></label>
                      <input 
                        type="number" 
                        min="0"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        placeholder="0"
                        className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold opacity-40 ml-1">Image Path <span className="opacity-50">(Optional)</span></label>
                    <input 
                      type="text" 
                      value={customImage}
                      onChange={(e) => setCustomImage(e.target.value)}
                      placeholder="/gear/red_komodo.jpg"
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                    />
                  </div>

                  {!editingItemName && (
                    <button
                      type="button"
                      onClick={() => setSaveToStudioInventory(v => !v)}
                      className="w-full flex items-center gap-3 p-3 bg-black/30 border border-white/10 rounded-lg text-left hover:border-white/20 transition-colors"
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${saveToStudioInventory ? 'bg-accent border-accent' : 'border-white/20'}`}>
                        {saveToStudioInventory && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="text-[11px] font-semibold text-white/70 leading-snug">
                        Save to studio inventory database
                        <span className="block text-[10px] opacity-40 font-medium">Off: the item stays on this manifest only.</span>
                      </span>
                    </button>
                  )}

                  {gearItemError && (
                    <p className="text-[11px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{gearItemError}</p>
                  )}

                  <button 
                    onClick={addCustomItem}
                    disabled={!customName.trim() || savingGearItem}
                    className="w-full flex items-center justify-center gap-2 bg-accent text-white py-2.5 mt-4 font-semibold text-xs hover:bg-white hover:text-black disabled:opacity-50 disabled:hover:bg-accent disabled:hover:text-white transition-all rounded-xl"
                  >
                    {savingGearItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingItemName ? 'Save Changes' : (saveToStudioInventory ? 'Add to Inventory & Manifest' : 'Add to Manifest')}
                  </button>

                  {editingItemName && (
                    <button
                      type="button"
                      onClick={deleteGearItem}
                      disabled={savingGearItem}
                      className="w-full flex items-center justify-center gap-2 py-2.5 font-semibold text-xs text-red-400 border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 disabled:opacity-50 transition-all rounded-xl"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {editingIsDbItem ? 'Delete From Inventory' : 'Delete Custom Item'}
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </ModalPortal>

        <ModalPortal>
        <AnimatePresence>
          {isSaveTemplateModalOpen && (
            <div className="fixed inset-0 z-[130] flex items-start md:items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSaveTemplateModalOpen(false)}
                className="absolute inset-0 bg-black/85 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-2xl w-full max-w-md shadow-2xl my-auto max-h-[92vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Save Gear Package</h2>
                  <button onClick={() => setIsSaveTemplateModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold opacity-40 ml-1">Package Name</label>
                    <input 
                      type="text" 
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g. A-Cam Rig Package"
                      autoFocus
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg text-white"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold opacity-40 ml-1">Description <span className="opacity-50">(Optional)</span></label>
                    <textarea 
                      value={newTemplateDesc}
                      onChange={(e) => setNewTemplateDesc(e.target.value)}
                      placeholder="E.g. RED Komodo body with prime lenses and wireless monitoring"
                      rows={3}
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg text-white resize-none"
                    />
                  </div>

                  <div className="bg-black/30 p-4 border border-white/5 rounded-xl max-h-40 overflow-y-auto">
                    <p className="text-xs font-semibold opacity-45 mb-2">Package Contents ({Object.keys(manifest).length} items)</p>
                    <div className="space-y-1">
                      {Object.entries(manifest).map(([name, qty]) => (
                        <p key={name} className="text-[11px] font-semibold text-white/80">
                          {qty}x {name}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={saveGearTemplate}
                    disabled={!newTemplateName.trim()}
                    className="w-full bg-accent text-white py-2.5 mt-4 font-semibold text-xs hover:bg-white hover:text-black disabled:opacity-50 disabled:hover:bg-accent disabled:hover:text-white transition-all rounded-xl"
                  >
                    Save Template Package
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        </ModalPortal>
        
    </div>
  );
}