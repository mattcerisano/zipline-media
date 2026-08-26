'use client';

import React, { useState, useMemo, useEffect, useRef, useSyncExternalStore } from 'react';
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
  Archive,
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
  Loader2
} from 'lucide-react';

import { jsPDF } from 'jspdf';
import Autocomplete from 'react-google-autocomplete';

import { ALL_CATEGORIES, type InventoryItem } from '@/data/inventory';
import { STORAGE_KEY_CLIENTS, STORAGE_KEY_JOBS, Client, Job, GearTemplate, Contact } from './types';
import ProductionCalendar from './ProductionCalendar';
import { supabase } from '@/lib/supabase';
import { getBranding } from '@/lib/branding';
import { fitImageBox } from '@/lib/pdf-image';
import { useRealtime } from '@/lib/useRealtime';
import { caps } from '@/lib/format';
import { toast, confirmAction } from '@/components/Feedback';
import { loadOrgPref, saveOrgPref } from '@/lib/team-prefs';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// A saved gear list drops out of the active library once its shoot date is
// this many days in the past (~2 months). Archived lists stay accessible
// behind a toggle — nothing is ever deleted.
const GEAR_ARCHIVE_DAYS = 60;

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
  const [customCategory, setCustomCategory] = useState(ALL_CATEGORIES[0]);
  const [customQty, setCustomQty] = useState(1);
  const [customValue, setCustomValue] = useState(0);
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
  // Who the list is billed to. A gear list is generated for a *client*, so this
  // picker is backed by the clients table alone — crew, rental houses and the
  // rest of the Rolodex contacts are deliberately not offered here, and free
  // text no longer quietly becomes a client row (that is what turned the list
  // into a copy of the Rolodex).
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const clientPickerRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState('Zipline Media');
  const [companyAddr, setCompanyAddr] = useState('');
  const [notes, setNotes] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [includeReplacementValue, setIncludeReplacementValue] = useState(false);
  const [isMobileManifestOpen, setIsMobileManifestOpen] = useState(false);
  const [isJobPickerOpen, setIsJobPickerOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'gear' | 'library' | 'templates'>('gear');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  // Older shoots auto-drop out of the library so building a new list isn't
  // cluttered with months-old jobs. They're not deleted — a toggle reveals them.
  const [showArchivedLists, setShowArchivedLists] = useState(false);

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
    fetchClients();

    // Load saved owners: this browser instantly, then the team's shared list
    // (authoritative when present — synced across everyone's devices).
    const stored = localStorage.getItem('zipline_saved_owners');
    if (stored) {
      try {
        setSavedOwners(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing saved owners:', e);
      }
    }
    loadOrgPref<string[]>('saved_gear_owners').then((owners) => {
      if (owners && Array.isArray(owners) && owners.length > 0) {
        setSavedOwners(owners);
        localStorage.setItem('zipline_saved_owners', JSON.stringify(owners));
      }
    });
  }, []);

  // Backs the "Generated For" client picker. Without it the picker has nothing
  // to offer and the browser's own autofill answers instead — on a phone, with
  // the device address book, which is how a gear list came to suggest every
  // contact the studio has ever saved.
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('name');
      if (error) throw error;
      if (data) setClients(data as Client[]);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase.from('contacts').select('*').order('name');
      if (!error && data) setContacts(data as Contact[]);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  // Live team sync: keep the gear catalog, jobs, templates, contacts and
  // clients fresh when a teammate changes them. The embedded calendar
  // live-updates on its own.
  useRealtime(['jobs', 'inventory', 'gear_templates', 'contacts', 'clients'], async () => {
    const [jobsRes, invRes, tplRes] = await Promise.all([
      supabase.from('jobs').select('*'),
      supabase.from('inventory').select('*'),
      supabase.from('gear_templates').select('*'),
    ]);
    if (!jobsRes.error && jobsRes.data) setJobs(jobsRes.data as Job[]);
    if (!invRes.error && invRes.data) setDbInventory(invRes.data as InventoryItem[]);
    if (!tplRes.error && tplRes.data) setGearTemplates(tplRes.data as GearTemplate[]);
    fetchContacts();
    fetchClients();
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

  // Split saved gear lists (jobs) into recent vs archived by shoot date, most
  // recent first. A list is "archived" once its shoot is more than
  // GEAR_ARCHIVE_DAYS in the past; lists with no date or upcoming shoots always
  // stay active. Purely time-based and non-destructive — nothing is deleted.
  const { activeJobs, archivedJobs } = useMemo(() => {
    const cutoff = Date.now() - GEAR_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;
    const sorted = [...jobs].sort(
      (a, b) => new Date(b.shoot_date || 0).getTime() - new Date(a.shoot_date || 0).getTime()
    );
    const active: Job[] = [];
    const archived: Job[] = [];
    for (const job of sorted) {
      const t = job.shoot_date ? new Date(job.shoot_date).getTime() : NaN;
      if (!Number.isNaN(t) && t < cutoff) archived.push(job);
      else active.push(job);
    }
    return { activeJobs: active, archivedJobs: archived };
  }, [jobs]);

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
    setCustomCategory(ALL_CATEGORIES[0]);
    setCustomQty(1);
    setCustomValue(0);
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
    setCustomCategory(item.category);
    setCustomQty(item.qty);
    setCustomValue(item.replacement);
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
      toast('Item with this name already exists.');
      return;
    }
    const newItem: InventoryItem = {
      name: finalName,
      category: customCategory,
      qty: customQty,
      replacement: customValue,
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
          saveOrgPref('saved_gear_owners', next);
          return next;
        }
        return prev;
      });
    }

    setIsCustomModalOpen(false);
  };

  const deleteGearItem = async () => {
    if (!editingItemName) return;
    const confirmed = await confirmAction({
      message: editingIsDbItem
        ? `Permanently delete "${editingItemName}" from the studio inventory?`
        : `Remove "${editingItemName}" from this manifest?`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;

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
  
  // --- Client picker (clients only) -------------------------------------
  // Close the dropdown when the click lands anywhere else on the page.
  useEffect(() => {
    if (!isClientPickerOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!clientPickerRef.current?.contains(e.target as Node)) setIsClientPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isClientPickerOpen]);

  const clientQuery = clientName.trim().toLowerCase();

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  // Typing narrows the list; an empty box shows every client, so the field
  // works as a browse-and-pick as well as a search.
  const clientMatches = useMemo(() => {
    if (!clientQuery) return sortedClients;
    return sortedClients.filter(c =>
      c.name.toLowerCase().includes(clientQuery) ||
      (c.email || '').toLowerCase().includes(clientQuery)
    );
  }, [sortedClients, clientQuery]);

  const exactClient = useMemo(
    () => clients.find(c => c.name.trim().toLowerCase() === clientQuery) || null,
    [clients, clientQuery]
  );

  // Jobs offered under Job Title. Once a client is chosen in "Generated For",
  // the list narrows to that client's jobs — the full studio history made the
  // picker useless the moment you already knew whose shoot you were pulling
  // gear for. A half-typed client name that matches nothing leaves the list
  // alone rather than emptying it, so the field stays usable mid-keystroke.
  const jobsForClient = useMemo(() => {
    const selected = clientId ? clients.find(c => c.id === clientId) : null;
    const targetName = (selected?.name || clientName).trim().toLowerCase();
    if (!clientId && !targetName) return jobs;

    const narrowed = jobs.filter(j => {
      if (clientId && j.client_id === clientId) return true;
      const jobClient = (j.client_name || '').trim().toLowerCase();
      return !!jobClient && jobClient === targetName;
    });

    // A chosen client with no jobs yet genuinely has none to offer; a typed
    // name that matched nothing is more likely still being typed.
    if (clientId) return narrowed;
    return narrowed.length > 0 ? narrowed : jobs;
  }, [jobs, clients, clientId, clientName]);

  const isJobListNarrowed = jobsForClient.length !== jobs.length;

  const selectClient = (client: Client) => {
    setClientName(client.name);
    setClientId(client.id);
    setIsClientPickerOpen(false);
  };

  // A name that isn't on the books becomes a client only when someone asks for
  // it here, rather than as a side effect of saving the list.
  const createClientFromInput = async () => {
    const name = clientName.trim();
    if (!name || creatingClient) return;
    if (exactClient) {
      selectClient(exactClient);
      return;
    }
    setCreatingClient(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ name })
        .select()
        .single();
      if (error) throw error;
      const created = data as Client;
      setClients(prev => [...prev, created]);
      selectClient(created);
      toast(`Added "${created.name}" to Clients.`);
    } catch (err: any) {
      console.error('Error creating client:', err);
      toast('Failed to add that client: ' + (err.message || 'Unknown error'));
    } finally {
      setCreatingClient(false);
    }
  };

  // The link the rest of the app filters on. Falls back to a name match so a
  // list loaded from an older job still resolves to its client row.
  const resolveClientId = () => {
    if (clientId) return clientId;
    if (!clientQuery) return null;
    return clients.find(c => c.name.trim().toLowerCase() === clientQuery)?.id || null;
  };

  const resetApp = () => {
    clearManifest();
    setJobTitle('');
    setClientName('');
    setClientId(null);
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
        toast('Please enter a Location and Shoot Date first.');
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
        toast(err.message || 'Could not fetch weather. Check address and date.');
    } finally {
        setWeatherLoading(false);
    }
  };


  const findHospital = async () => {
     if (!companyAddr) {
         toast('Please enter a location address first.');
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
             toast(errorMsg);
         }
     } catch (err) {
         console.error(err);
         toast('Error searching for hospital.');
     } finally {
         setHospitalLoading(false);
     }
  };

  const findParking = async () => {
      if (!companyAddr) {
          toast('Please enter a location address first.');
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
              toast(errorMsg);
          }
      } catch (err) {
          console.error(err);
          toast('Error searching for parking.');
      } finally {
          setParkingLoading(false);
      }
  };

  const saveJob = async () => {
    if (!jobTitle || !shootDate) {
      toast('Please enter a Job Title and Shoot Date to log to Slate.');
      return;
    }

    const resolvedClientId = resolveClientId();

    const dbJob = {
      title: jobTitle.trim(),
      client_name: clientName.trim(),
      // Only ever the id of a real client row — the Client → Project filters
      // across Slate and the Library read this.
      ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
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
      // Save the job itself. Client rows are created from the picker, never
      // as a side effect of saving, so a one-off name typed here stays a name.
      // Check if job with same ID or same title/date exists for updating
      const existingJob = jobs.find(j => j.id === selectedJobId) || jobs.find(j => j.title === dbJob.title && j.shoot_date === dbJob.shoot_date);

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
        setSelectedJobId(res.data![0].id);
        toast('Job updated on Slate successfully!');
      } else {
        setJobs(prev => [...prev, res.data![0] as Job]);
        setSelectedJobId(res.data![0].id);
        toast('Job logged to Slate successfully!');
      }
    } catch (err: any) {
      console.error('Error saving job:', err);
      toast('Failed to save job to Slate: ' + (err.message || 'Unknown error'));
    }
  };

  const loadJob = (job: Job) => {
    setSelectedJobId(job.id);
    setJobTitle(job.title);
    if (job.shoot_date) setShootDate(job.shoot_date);
    if (job.client_name) {
      setClientName(job.client_name);
      setClientId(
        job.client_id ||
        clients.find(c => c.name.trim().toLowerCase() === job.client_name!.trim().toLowerCase())?.id ||
        null
      );
    }
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
    if (!(await confirmAction({ message: 'Permanently delete this job from Slate?', danger: true, confirmLabel: 'Delete' }))) return;
    
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err: any) {
      console.error('Error deleting job:', err);
      toast('Failed to delete job: ' + (err.message || 'Unknown error'));
    }
  };

  const saveGearTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast('Please enter a template name.');
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
      toast('Gear package template saved successfully!');
    } catch (err: any) {
      console.error('Error saving template:', err);
      toast('Failed to save template: ' + (err.message || 'Unknown error'));
    }
  };

  const deleteGearTemplate = async (templateId: string) => {
    if (!(await confirmAction({ message: 'Permanently delete this gear package template?', danger: true, confirmLabel: 'Delete' }))) return;

    try {
      const { error } = await supabase
        .from('gear_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setGearTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err: any) {
      console.error('Error deleting template:', err);
      toast('Failed to delete template: ' + (err.message || 'Unknown error'));
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
    toast(`Loaded template "${template.name}" successfully!`);
  };

  const shareGearList = () => {
    if (!selectedJobId || typeof window === 'undefined') return;

    // The link carries the job's share token. Without it the page can't read
    // anything — the job id on its own stopped granting access when the
    // anonymous read on `jobs` was removed.
    const token = jobs.find(j => j.id === selectedJobId)?.share_token;
    if (!token) {
      toast('Save this job first — it needs a share token before it can be shared.');
      return;
    }

    const url = `${window.location.origin}/share/gear/${selectedJobId}?t=${token}`;
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
        // Fit inside the 120x30 slot rather than stretching to it — a square
        // logo drawn straight into this box came out four times too wide.
        // Left-aligned so it lines up with the margin the rest of the page uses.
        const logo = fitImageBox(doc, logoData, margin, 20, 120, 30, 'left');
        doc.addImage(logoData, 'PNG', logo.x, logo.y, logo.w, logo.h);
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
    doc.text(clientName || '—', col2X, row1Y + 10);

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
    if (clientName) {
        const name = clientName.trim();
        const existingClientIndex = clients.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
        
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

  // Grows to the true height of the manifest rather than scrolling inside a
  // viewport-height box — the list is read by scrolling the page, with the
  // catalog staying pinned alongside it.
  const ManifestContent = (
    <section className="bg-neutral-900/80 border border-white/10 p-6 md:p-8 rounded-2xl flex flex-col">
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
            className="@4xl:hidden p-2 hover:bg-white/10 rounded-full transition-colors"
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
          </label>
          <div className="relative">
            <input 
              type="text" 
              value={jobTitle}
              disabled={!!selectedJobIdProp}
              onChange={(e) => {
                  const val = e.target.value;
                  setJobTitle(val);
                  
                  // Autofill attempt. With a client chosen, only their jobs
                  // count — two clients can run a shoot by the same name, and
                  // matching the other one would rewrite the client field.
                  const matchedJob = (clientId ? jobsForClient : jobs)
                      .find(j => j.title.toLowerCase() === val.toLowerCase());
                  if (matchedJob) {
                      setSelectedJobId(matchedJob.id);
                      if (matchedJob.shoot_date) setShootDate(matchedJob.shoot_date);
                      if (matchedJob.client_name) {
                          setClientName(matchedJob.client_name);
                          setClientId(
                              matchedJob.client_id ||
                              clients.find(c => c.name.trim().toLowerCase() === matchedJob.client_name!.trim().toLowerCase())?.id ||
                              null
                          );
                      }
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
                  } else if (!val.trim()) {
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
            {jobsForClient.map(j => (
                <option key={j.id} value={j.title}>{j.client_name ? `(${caps(j.client_name)})` : ''}</option>
            ))}
          </datalist>
          {isJobListNarrowed && !selectedJobIdProp && (
            <p className="text-[10px] font-semibold text-white/30 ml-1 mt-0.5">
              {jobsForClient.length === 0
                ? `No jobs yet for ${caps(clientName.trim())}`
                : `${jobsForClient.length} job${jobsForClient.length === 1 ? '' : 's'} for ${caps(clientName.trim())}`}
            </p>
          )}
        </div>
        <div className="space-y-0.5">
          <label className="text-xs font-semibold opacity-40 ml-1">Shoot Date</label>
          <div className="flex gap-2">
            <input 
                type="date" 
                value={shootDate}
                onChange={(e) => setShootDate(e.target.value)}
                className="w-full min-w-0 bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg"
            />
            <button 
                onClick={() => setIsCalendarOpen(true)}
                className="shrink-0 bg-white/10 hover:bg-white/20 p-3 rounded-lg transition-colors text-white"
                title="Pick from Production Calendar"
            >
                <Calendar className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="space-y-0.5 relative" ref={clientPickerRef}>
          <label className="text-xs font-semibold opacity-40 ml-1">
            Generated For <span className="opacity-60 font-medium">(client)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={clientName}
              onChange={(e) => {
                setClientName(e.target.value);
                // Typing past a chosen client breaks the link until one is picked again.
                setClientId(null);
                setIsClientPickerOpen(true);
              }}
              onFocus={() => setIsClientPickerOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsClientPickerOpen(false);
                // Enter takes the top match rather than leaving a half-typed
                // name that looks chosen but carries no client link.
                if (e.key === 'Enter' && isClientPickerOpen && clientMatches.length > 0) {
                  e.preventDefault();
                  selectClient(clientMatches[0]);
                }
              }}
              placeholder="Client Name"
              role="combobox"
              aria-expanded={isClientPickerOpen}
              aria-controls="client-picker-list"
              autoComplete="off"
              className="w-full bg-black/50 border border-white/10 py-2.5 pl-4 pr-10 outline-none focus:border-accent transition-colors text-sm font-semibold rounded-lg"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setIsClientPickerOpen(o => !o)}
              aria-label={isClientPickerOpen ? 'Hide client list' : 'Show client list'}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-white transition-colors"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${isClientPickerOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {isClientPickerOpen && (
            <div
              id="client-picker-list"
              role="listbox"
              className="absolute z-30 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-neutral-900 border border-white/10 rounded-lg shadow-2xl"
            >
              <p className="px-3 pt-2.5 pb-1.5 text-[11px] md:text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">
                Clients
              </p>
              {clientMatches.length > 0 ? (
                clientMatches.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    role="option"
                    aria-selected={clientId === client.id}
                    onClick={() => selectClient(client)}
                    title={client.name}
                    className={`w-full text-left px-3 py-2 hover:bg-white/10 transition-colors ${clientId === client.id ? 'bg-accent/10 text-accent' : 'text-white'}`}
                  >
                    {/* Stacked, not side by side: client names are long enough
                        that a contact column beside them left both unreadable. */}
                    <span className="block text-xs font-semibold truncate">{client.name}</span>
                    {(client.email || client.phone) && (
                      <span className="block text-[11px] md:text-[10px] font-medium text-white/30 truncate">
                        {client.email || client.phone}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs font-semibold text-white/40">
                  {clients.length === 0
                    ? 'No clients yet — add one here or in the Rolodex.'
                    : 'No client by that name.'}
                </p>
              )}
              {clientQuery && !exactClient && (
                <button
                  type="button"
                  onClick={createClientFromInput}
                  disabled={creatingClient}
                  className="w-full text-left px-3 py-2.5 border-t border-white/10 text-accent hover:bg-accent/10 disabled:opacity-40 transition-colors flex items-center gap-2 text-xs font-semibold"
                >
                  {creatingClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add &ldquo;{clientName.trim()}&rdquo; as a new client
                </button>
              )}
            </div>
          )}
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

      <div className="mb-6 pr-2">
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
                                <div key={item.name} className="flex items-start justify-between bg-white/5 p-3 rounded-lg border border-white/5 group">
                                    <div className="flex-1 min-w-0 pr-2">
                                    {/* Full name wraps — truncating made long gear names unreadable while building */}
                                    <p className="text-xs font-semibold break-words leading-snug">{item.name}</p>
                                    <p className="text-[10px] opacity-40 font-medium mt-0.5">
                                        X{item.count} • ${( (invItem?.replacement || 0) * item.count ).toLocaleString()}
                                    </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {invItem && (
                                            <button
                                                onClick={() => handleEdit(invItem)}
                                                className="text-white/40 md:text-current md:opacity-0 md:group-hover:opacity-100 p-2 hover:bg-white/10 hover:text-white transition-all rounded-md"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => removeFromManifest(item.name)}
                                            className="text-white/40 md:text-current md:opacity-0 md:group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-500 transition-all rounded-md"
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
    <div className="@container pt-8 pb-32 @4xl:pb-8 px-4 md:px-6">
        <div className="grid grid-cols-1 @4xl:grid-cols-12 gap-6 @4xl:gap-12 items-start">
          {/* self-stretch so the sticky catalog can travel the full height of
              the (now content-sized) manifest instead of scrolling away. */}
          <div className="@4xl:col-span-7 space-y-8 @4xl:self-stretch">
            <section className="bg-neutral-900/50 border border-white/10 p-0 md:p-6 md:pb-0 rounded-2xl overflow-hidden flex flex-col h-fit max-h-[75vh] @4xl:max-h-none @4xl:h-[calc(100vh-140px)] @4xl:sticky @4xl:top-24">
              
              <div className="bg-neutral-900/90 backdrop-blur-md p-4 md:p-0 z-20 sticky top-0 border-b md:border-b-0 border-white/10 space-y-4">
                {/* Tab Toggle */}
                <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-xl">
                  <button 
                    onClick={() => setActiveSidebarTab('gear')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeSidebarTab === 'gear' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40 hover:text-white'}`}
                  >
                    Gear Selection
                  </button>
                  <button 
                    onClick={() => setActiveSidebarTab('library')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeSidebarTab === 'library' ? 'bg-white text-black shadow-lg shadow-white/5' : 'text-white/40 hover:text-white'}`}
                  >
                    Slate Library
                  </button>
                  <button 
                    onClick={() => setActiveSidebarTab('templates')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeSidebarTab === 'templates' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white'}`}
                  >
                    Packages
                  </button>
                </div>

                {activeSidebarTab === 'gear' ? (
                  <>
                    <div className="flex gap-4">
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="flex-1 min-w-0 bg-black/50 border border-white/10 py-2.5 px-4 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-xl appearance-none cursor-pointer"
                      >
                        <option value="All">ALL CATEGORIES</option>
                        {ALL_CATEGORIES.map(cat => (
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
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-accent">Saved Production Slates</h3>
                    <p className="text-xs font-semibold opacity-40">{jobs.length} Total</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-accent">Gear Package Templates</h3>
                    <p className="text-xs font-semibold opacity-40">{gearTemplates.length} Total</p>
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
                      <>
                        {(showArchivedLists ? [...activeJobs, ...archivedJobs] : activeJobs).map(job => (
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
                        ))}

                        {activeJobs.length === 0 && !showArchivedLists && (
                          <div className="py-20 text-center opacity-30">
                            <ClipboardList className="w-12 h-12 mx-auto mb-3" />
                            <p className="text-xs font-semibold text-white/40">No recent gear lists</p>
                            <p className="text-[10px] text-white/30 mt-1">Older lists are archived below</p>
                          </div>
                        )}

                        {archivedJobs.length > 0 && (
                          <button
                            onClick={() => setShowArchivedLists(v => !v)}
                            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            {showArchivedLists
                              ? 'Hide archived lists'
                              : `Show ${archivedJobs.length} archived list${archivedJobs.length === 1 ? '' : 's'}`}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
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
                              <span key={name} className="text-[11px] md:text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/70 font-semibold">
                                {qty}x {name}
                              </span>
                            ))}
                          </div>

                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <button
                              onClick={() => loadGearTemplate(template, 'merge')}
                              className="py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold rounded-lg text-white/80 transition-all"
                            >
                              Merge List
                            </button>
                            <button
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
                )}
              </div>
            </section>
      
          </div>

          <div className="hidden @4xl:block @4xl:col-span-5 space-y-8 min-h-0">
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
              className="fixed inset-0 z-[110] bg-neutral-950 @4xl:hidden flex flex-col"
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[105] @4xl:hidden w-full px-6">
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
                    <label className="text-xs font-semibold opacity-40 ml-1">Category</label>
                    <select 
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg appearance-none"
                    >
                      {ALL_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                      <label className="text-xs font-semibold opacity-40 ml-1">Quantity</label>
                      <input 
                        type="number" 
                        min="1"
                        value={customQty}
                        onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                        className="w-full bg-black/50 border border-white/10 p-3 outline-none focus:border-accent transition-colors text-xs font-semibold rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold opacity-40 ml-1">Replacement Value ($)</label>
                      <input 
                        type="number" 
                        min="0"
                        value={customValue}
                        onChange={(e) => setCustomValue(parseInt(e.target.value) || 0)}
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
                className="fixed inset-0 bg-black/85 backdrop-blur-sm"
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