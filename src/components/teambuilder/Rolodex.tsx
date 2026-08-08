'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Star,
  Tag,
  Pencil,
  X,
  Check,
  History,
  Briefcase,
  DollarSign,
  ChevronUp,
  ChevronDown,
  Building2,
  Upload,
  MessageSquare,
  Globe,
  Copy,
  ExternalLink,
  Calendar,
  User,
  Building,
  FileText,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/lib/useRealtime';
import { Contact, Client } from '@/components/gearbuilder/types';
import { toast, confirmAction } from '@/components/Feedback';
import { FilterSheet } from '@/components/workspace/FilterSheet';
import ContactSuggest from '@/components/workspace/ContactSuggest';

const STANDARD_ROLES = [
  'Director', 'Producer', 'Director of Photography', 'Camera Operator', '1st AC', '2nd AC',
  'Gaffer', 'Key Grip', 'Grip', 'Audio Mixer', 'Boom Operator', 'Production Assistant',
  'Editor', 'Colorist', 'Motion Graphics', 'Sound Designer', 'Photographer', 'Creative Director'
];

type SortField = 'name' | 'primary_role';
type SortOrder = 'asc' | 'desc';
type RolodexView = 'crew' | 'clients';

// vCard (.vcf) Parser
function parseVCF(text: string) {
  const contacts: { name: string; email: string; phone: string; primary_role: string; tags: string }[] = [];
  const cards = text.split(/END:VCARD/i);
  
  for (const card of cards) {
    if (!card.includes('BEGIN:VCARD')) continue;
    
    let name = '';
    let email = '';
    let phone = '';
    
    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.toUpperCase().startsWith('FN:')) {
        name = cleanLine.substring(3).trim();
      } else if (cleanLine.toUpperCase().startsWith('FN;')) {
        const parts = cleanLine.split(':');
        if (parts.length > 1) name = parts.slice(1).join(':').trim();
      } else if (cleanLine.toUpperCase().startsWith('EMAIL')) {
        const parts = cleanLine.split(':');
        if (parts.length > 1) {
          const emailVal = parts.slice(1).join(':').trim();
          if (emailVal.includes('@')) email = emailVal;
        }
      } else if (cleanLine.toUpperCase().startsWith('TEL')) {
        const parts = cleanLine.split(':');
        if (parts.length > 1) phone = parts.slice(1).join(':').trim();
      }
    }
    
    // Fallback if FN is not defined but N is: e.g. N:LastName;FirstName;;;
    if (!name) {
      const nLine = lines.find(l => l.toUpperCase().startsWith('N:'));
      if (nLine) {
        const parts = nLine.substring(2).split(';');
        const last = parts[0]?.trim() || '';
        const first = parts[1]?.trim() || '';
        name = `${first} ${last}`.trim();
      }
    }
    
    if (name) {
      contacts.push({
        name,
        email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@temporary.com`,
        phone: phone || '',
        primary_role: '',
        tags: 'iPhone Import'
      });
    }
  }
  return contacts;
}

// CSV Parser
function parseCSV(text: string) {
  const contacts: { name: string; email: string; phone: string; primary_role: string; tags: string }[] = [];
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  
  const firstNameIdx = headers.findIndex(h => h.includes('first name') || h === 'first' || h === 'given name');
  const lastNameIdx = headers.findIndex(h => h.includes('last name') || h === 'last' || h === 'family name');
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h.includes('display name'));
  const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail') || h === 'mail');
  const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('tel') || h === 'mobile' || h === 'cell');
  const roleIdx = headers.findIndex(h => h.includes('role') || h.includes('job') || h === 'position' || h === 'title');
  const tagsIdx = headers.findIndex(h => h.includes('tag') || h.includes('group') || h.includes('category'));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = [];
    let currentVal = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentVal.trim().replace(/^["']|["']$/g, ''));
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    values.push(currentVal.trim().replace(/^["']|["']$/g, ''));

    let name = '';
    if (nameIdx >= 0 && values[nameIdx]) {
      name = values[nameIdx];
    } else {
      const first = firstNameIdx >= 0 ? (values[firstNameIdx] || '') : '';
      const last = lastNameIdx >= 0 ? (values[lastNameIdx] || '') : '';
      name = `${first} ${last}`.trim();
    }
    
    const email = emailIdx >= 0 ? (values[emailIdx] || '') : '';
    const phone = phoneIdx >= 0 ? (values[phoneIdx] || '') : '';
    const primary_role = roleIdx >= 0 ? (values[roleIdx] || '') : '';
    const tags = tagsIdx >= 0 ? (values[tagsIdx] || '') : '';

    if (name) {
      contacts.push({
        name,
        email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@temporary.com`,
        phone,
        primary_role,
        tags: tags || 'iCloud Import'
      });
    }
  }
  return contacts;
}

// Parse a QuickBooks customer-list CSV export into client rows. Handles the
// common QuickBooks header variants (Customer / Display Name, Company, Email,
// Phone, and either a single Bill-to Address or split Street/City/State/ZIP).
function parseClientCSV(text: string) {
  const rows: { name: string; email: string; phone: string; address: string }[] = [];
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const nameIdx = headers.findIndex(h => h === 'customer' || h.includes('display name') || h === 'full name' || h === 'name');
  const companyIdx = headers.findIndex(h => h === 'company' || h.includes('company name'));
  const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
  const phoneIdx = headers.findIndex(h => h.includes('phone') || h === 'mobile' || h === 'tel');
  const billIdx = headers.findIndex(h => (h.includes('bill') && h.includes('address')) || h === 'billing address');
  const addrIdx = headers.findIndex(h => h === 'address' || h === 'full address');
  const streetIdx = headers.findIndex(h => h.includes('street') || h.includes('address line 1') || h.includes('addr 1'));
  const cityIdx = headers.findIndex(h => h.includes('city'));
  const stateIdx = headers.findIndex(h => h === 'state' || h.includes('province'));
  const zipIdx = headers.findIndex(h => h.includes('zip') || h.includes('postal'));

  const splitLine = (line: string) => {
    const values: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"' || ch === "'") inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) { values.push(cur.trim().replace(/^["']|["']$/g, '')); cur = ''; }
      else cur += ch;
    }
    values.push(cur.trim().replace(/^["']|["']$/g, ''));
    return values;
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const v = splitLine(line);
    let name = nameIdx >= 0 ? (v[nameIdx] || '') : '';
    if (!name && companyIdx >= 0) name = v[companyIdx] || '';
    const email = emailIdx >= 0 ? (v[emailIdx] || '') : '';
    const phone = phoneIdx >= 0 ? (v[phoneIdx] || '') : '';
    let address = '';
    if (billIdx >= 0 && v[billIdx]) address = v[billIdx];
    else if (addrIdx >= 0 && v[addrIdx]) address = v[addrIdx];
    else {
      const parts = [streetIdx, cityIdx, stateIdx, zipIdx].map(idx => (idx >= 0 ? (v[idx] || '') : '')).filter(Boolean);
      address = parts.join(', ');
    }
    if (name) rows.push({ name, email, phone, address });
  }
  return rows;
}

export default function Rolodex() {
  const [activeView, setActiveView] = useState<RolodexView>('crew');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  // Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportOptionsOpen, setIsImportOptionsOpen] = useState(false);
  const [parsedContacts, setParsedContacts] = useState<{ name: string; email: string; phone: string; primary_role: string; tags: string }[]>([]);
  const [selectedImportIdxs, setSelectedImportIdxs] = useState<number[]>([]);
  const [isImportLoading, setIsImportLoading] = useState(false);

  // QuickBooks client CSV import states
  const [isClientImportOpen, setIsClientImportOpen] = useState(false);
  const [parsedClients, setParsedClients] = useState<{ name: string; email: string; phone: string; address: string }[]>([]);
  const [selectedClientIdxs, setSelectedClientIdxs] = useState<number[]>([]);
  const [isClientImportLoading, setIsClientImportLoading] = useState(false);

  // History
  const [selectedContactHistory, setSelectedContactHistory] = useState<{type: 'On-Set' | 'Post', job_title: string, shoot_date: string, position: string, rate?: number, notes?: string}[]>([]);
  const [selectedClientHistory, setSelectedClientHistory] = useState<{job_title: string, shoot_date: string, crew: {name: string, position: string}[]}[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);
  const [activeClientName, setActiveClientName] = useState('');

  // Contact Detail Card
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isContactDetailOpen, setIsContactDetailOpen] = useState(false);
  const [contactDetailHistory, setContactDetailHistory] = useState<{type: 'On-Set' | 'Post', job_title: string, shoot_date: string, position: string, rate?: number, notes?: string}[]>([]);
  const [isDetailHistoryLoading, setIsDetailHistoryLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Client Detail Card
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isClientDetailOpen, setIsClientDetailOpen] = useState(false);
  const [clientDetailHistory, setClientDetailHistory] = useState<{job_title: string, shoot_date: string, crew: {name: string, position: string}[]}[]>([]);
  const [isClientDetailHistoryLoading, setIsClientDetailHistoryLoading] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Filter states
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState('');

  // Reset filters when switching views
  useEffect(() => {
    setShowFavoritesOnly(false);
    setSelectedRoleFilter('');
  }, [activeView]);

  useEffect(() => {
    fetchData();
  }, []);

  // Live team sync: refresh contacts/clients when teammates make changes
  useRealtime(['contacts', 'clients'], () => fetchData());

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [contactsRes, clientsRes] = await Promise.all([
        supabase.from('contacts').select('*').order('name').limit(2000),
        supabase.from('clients').select('*').order('name')
      ]);
      if (contactsRes.error) throw contactsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      
      setContacts(contactsRes.data as Contact[]);
      setClients(clientsRes.data as Client[]);
    } catch (err) {
      console.error('Error fetching rolodex data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContactHistory = async (contactId: string) => {
    try {
      // Fetch On-Set Roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('job_roles')
        .select(`
          position,
          day_rate,
          notes,
          job:jobs (
            title,
            shoot_date
          )
        `)
        .eq('contact_id', contactId);
      
      if (rolesError) throw rolesError;

      // Fetch Post-Production Roles
      const { data: editsData, error: editsError } = await supabase
        .from('jobs')
        .select('title, shoot_date, edit_status')
        .eq('editor_id', contactId);

      if (editsError) throw editsError;
      
      const formattedRoles = (rolesData as any[]).map((r) => ({
        type: 'On-Set' as const,
        job_title: r.job?.title || 'Unknown',
        shoot_date: r.job?.shoot_date,
        position: r.position,
        rate: r.day_rate,
        notes: r.notes
      }));

      const formattedEdits = (editsData as any[]).map((e) => ({
        type: 'Post' as const,
        job_title: e.title,
        shoot_date: e.shoot_date,
        position: `Editor (${e.edit_status || 'Assigned'})`,
      }));

      const combined = [...formattedRoles, ...formattedEdits].sort((a, b) => new Date(b.shoot_date).getTime() - new Date(a.shoot_date).getTime());
      
      setSelectedContactHistory(combined);
      setIsHistoryOpen(true);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchClientHistory = async (clientName: string) => {
    try {
      // Find all jobs for this client
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          shoot_date,
          job_roles (
            position,
            contact:contacts(name)
          )
        `)
        .ilike('client_name', clientName);
      
      if (error) throw error;

      const formatted = (jobs as any[]).map(j => ({
        job_title: j.title,
        shoot_date: j.shoot_date,
        crew: j.job_roles.map((r: any) => ({
          position: r.position,
          name: r.contact?.name || 'TBD'
        }))
      })).sort((a, b) => new Date(b.shoot_date).getTime() - new Date(a.shoot_date).getTime());

      setActiveClientName(clientName);
      setSelectedClientHistory(formatted);
      setIsClientHistoryOpen(true);
    } catch (err) {
      console.error('Error fetching client history:', err);
    }
  };

  // Open contact detail card
  const openContactDetail = useCallback(async (contact: Contact) => {
    setSelectedContact(contact);
    setIsContactDetailOpen(true);
    setContactDetailHistory([]);
    setIsDetailHistoryLoading(true);
    
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('job_roles')
        .select(`position, day_rate, notes, job:jobs(title, shoot_date)`)
        .eq('contact_id', contact.id);
      if (rolesError) throw rolesError;

      const { data: editsData, error: editsError } = await supabase
        .from('jobs')
        .select('title, shoot_date, edit_status')
        .eq('editor_id', contact.id);
      if (editsError) throw editsError;

      const formattedRoles = (rolesData as any[]).map((r) => ({
        type: 'On-Set' as const,
        job_title: r.job?.title || 'Unknown',
        shoot_date: r.job?.shoot_date,
        position: r.position,
        rate: r.day_rate,
        notes: r.notes
      }));
      const formattedEdits = (editsData as any[]).map((e) => ({
        type: 'Post' as const,
        job_title: e.title,
        shoot_date: e.shoot_date,
        position: `Editor (${e.edit_status || 'Assigned'})`,
      }));
      setContactDetailHistory(
        [...formattedRoles, ...formattedEdits].sort((a, b) => new Date(b.shoot_date).getTime() - new Date(a.shoot_date).getTime())
      );
    } catch (err) {
      console.error('Error fetching contact detail history:', err);
    } finally {
      setIsDetailHistoryLoading(false);
    }
  }, []);

  // Open client detail card
  const openClientDetail = useCallback(async (client: Client) => {
    setSelectedClient(client);
    setIsClientDetailOpen(true);
    setClientDetailHistory([]);
    setIsClientDetailHistoryLoading(true);
    
    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`id, title, shoot_date, job_roles(position, contact:contacts(name))`)
        .ilike('client_name', client.name);
      if (error) throw error;

      setClientDetailHistory(
        (jobs as any[]).map(j => ({
          job_title: j.title,
          shoot_date: j.shoot_date,
          crew: j.job_roles.map((r: any) => ({ position: r.position, name: r.contact?.name || 'TBD' }))
        })).sort((a, b) => new Date(b.shoot_date).getTime() - new Date(a.shoot_date).getTime())
      );
    } catch (err) {
      console.error('Error fetching client detail history:', err);
    } finally {
      setIsClientDetailHistoryLoading(false);
    }
  }, []);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Windowed render: big rosters made the table paint hundreds of rows at
  // once. Filtering/search still runs over the full set; only the DOM is
  // capped, with a Show More escape hatch.
  const [visibleCount, setVisibleCount] = useState(150);
  useEffect(() => {
    setVisibleCount(150);
  }, [searchQuery, selectedRoleFilter, showFavoritesOnly, sortField, sortOrder]);

  const filteredContacts = useMemo(() => {
    let result = contacts;

    if (showFavoritesOnly) {
      result = result.filter(c => c.is_favorite);
    }

    if (selectedRoleFilter) {
      result = result.filter(c => c.primary_role === selectedRoleFilter);
    }

    result = result.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.primary_role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.tags?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      const valA = (a[sortField] || '').toLowerCase();
      const valB = (b[sortField] || '').toLowerCase();
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [contacts, searchQuery, sortField, sortOrder, showFavoritesOnly, selectedRoleFilter]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery]);

  const handleNativeContactImport = async () => {
    if (typeof window === 'undefined') return;
    
    // Check if contacts manager API is supported
    const isSupported = 'contacts' in navigator && 'ContactsManager' in window;
    
    if (!isSupported) {
      toast(
        "Direct Contact Picker is not supported on this browser or device.\n\n" +
        "Please use the standard method below: Export your contacts from your iPhone as a .vcf file and upload it."
      );
      return;
    }

    try {
      const props = ['name', 'email', 'tel'];
      const contacts = await (navigator as any).contacts.select(props, { multiple: true });
      
      if (contacts && contacts.length > 0) {
        const formatted = contacts.map((c: any) => {
          const rawName = c.name?.[0] || 'Unknown Contact';
          const name = rawName.trim();
          const email = c.email?.[0] || `${name.toLowerCase().replace(/\s+/g, '.')}@temporary.com`;
          const phone = c.tel?.[0] || '';
          
          return {
            name,
            email,
            phone,
            primary_role: '',
            tags: 'iPhone Direct Import'
          };
        });
        
        setParsedContacts(formatted);
        setSelectedImportIdxs(formatted.map((_: any, idx: number) => idx));
        setIsImportModalOpen(true);
        setIsImportOptionsOpen(false);
      }
    } catch (err: any) {
      console.error('Contact Picker error:', err);
      // Cancelled by user is not an error we need to alert, but other failures are
      if (err.name !== 'AbortError') {
        toast('Could not retrieve contacts: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      let contactsList: { name: string; email: string; phone: string; primary_role: string; tags: string }[] = [];
      
      if (file.name.toLowerCase().endsWith('.vcf')) {
        contactsList = parseVCF(text);
      } else if (file.name.toLowerCase().endsWith('.csv')) {
        contactsList = parseCSV(text);
      } else {
        toast('Please upload a .vcf (vCard) or .csv file.');
        return;
      }

      if (contactsList.length === 0) {
        toast('No valid contacts found in the file.');
        return;
      }

      setParsedContacts(contactsList);
      setSelectedImportIdxs(contactsList.map((_: any, idx: number) => idx));
      setIsImportModalOpen(true);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    setIsImportLoading(true);
    try {
      const contactsToInsert = parsedContacts
        .filter((_, idx) => selectedImportIdxs.includes(idx))
        .map(c => ({
          name: c.name.trim(),
          email: c.email.trim(),
          phone: c.phone.trim() || null,
          primary_role: c.primary_role.trim() || null,
          tags: c.tags.trim() || null,
          is_favorite: false
        }));

      if (contactsToInsert.length === 0) {
        toast('No contacts selected for import.');
        setIsImportLoading(false);
        return;
      }

      const { error } = await supabase
        .from('contacts')
        .insert(contactsToInsert);

      if (error) throw error;

      toast(`Successfully imported ${contactsToInsert.length} contacts!`);
      setIsImportModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error importing contacts:', err);
      toast('Failed to import contacts. Please verify that all emails are unique.');
    } finally {
      setIsImportLoading(false);
    }
  };

  // QuickBooks customer CSV → clients
  const handleClientImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast('Please upload a .csv export from QuickBooks.');
        return;
      }
      const rows = parseClientCSV(text);
      if (rows.length === 0) {
        toast('No clients found. Make sure the CSV has a Customer/Company column.');
        return;
      }
      setParsedClients(rows);
      setSelectedClientIdxs(rows.map((_, idx) => idx));
      setIsClientImportOpen(true);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleConfirmClientImport = async () => {
    setIsClientImportLoading(true);
    try {
      const existing = new Set(clients.map(c => c.name.trim().toLowerCase()));
      const toInsert = parsedClients
        .filter((_, idx) => selectedClientIdxs.includes(idx))
        .map(c => ({
          name: c.name.trim(),
          email: c.email.trim() || null,
          phone: c.phone.trim() || null,
          address: c.address.trim() || null,
        }))
        .filter(c => c.name && !existing.has(c.name.toLowerCase()));

      if (toInsert.length === 0) {
        toast('Nothing to import — those clients already exist (matched by name).');
        setIsClientImportLoading(false);
        return;
      }

      const { error } = await supabase.from('clients').insert(toInsert);
      if (error) throw error;

      toast(`Imported ${toInsert.length} client${toInsert.length === 1 ? '' : 's'} from QuickBooks.`);
      setIsClientImportOpen(false);
      const { data } = await supabase.from('clients').select('*').order('name');
      if (data) setClients(data as Client[]);
    } catch (err) {
      console.error('Error importing clients:', err);
      toast('Failed to import clients.');
    } finally {
      setIsClientImportLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?.name?.trim()) {
      toast('Name is required');
      return;
    }

    try {
      // Email is optional (lots of crew don't have one on hand), but the column
      // is NOT NULL — send an empty string rather than null for blank emails.
      const payload = { ...editingContact, email: editingContact.email?.trim() || '' };
      const { error } = await supabase
        .from('contacts')
        .upsert(payload);
      if (error) throw error;

      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving contact:', err);
      toast(`Failed to save contact: ${(err as any)?.message || 'unknown error'}`);
    }
  };

  const toggleFavorite = async (contact: Contact) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ is_favorite: !contact.is_favorite })
        .eq('id', contact.id);
      if (error) throw error;
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_favorite: !c.is_favorite } : c));
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const deleteContact = async (id: string) => {
    if (!(await confirmAction({ message: 'Delete this contact?', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting contact:', err);
    }
  };

  const handleClientSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient?.name) {
      toast('Client Name is required');
      return;
    }

    // Check if client name already exists (case-insensitive) for another client
    const nameExists = clients.some(c => 
      c.name.trim().toLowerCase() === editingClient.name!.trim().toLowerCase() && 
      c.id !== editingClient.id
    );
    if (nameExists) {
      toast('A client with this name already exists.');
      return;
    }

    try {
      const { error } = await supabase
        .from('clients')
        .upsert(editingClient);
      if (error) throw error;
      
      setIsClientModalOpen(false);
      const { data } = await supabase.from('clients').select('*').order('name');
      if (data) setClients(data as Client[]);
    } catch (err) {
      console.error('Error saving client:', err);
      toast('Failed to save client');
    }
  };

  const deleteClient = async (id: string) => {
    if (!(await confirmAction({ title: 'Delete this client?', message: 'Jobs associated with this client will remain, but the client record will be removed.', danger: true, confirmLabel: 'Delete' }))) return;
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting client:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 w-fit mb-6">
        <button 
          onClick={() => setActiveView('crew')}
          className={`px-6 py-2.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${activeView === 'crew' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white'}`}
        >
          Crew & Contractors
        </button>
        <button 
          onClick={() => setActiveView('clients')}
          className={`px-6 py-2.5 rounded-lg text-xs font-semibold tracking-tight transition-all ${activeView === 'clients' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white'}`}
        >
          Clients
        </button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-3 flex-1 w-full">
          {/* Search leads — it's what the toolbar is for. The two filters sit
              behind a chip on a phone and inline from md up. */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              placeholder={`Search ${activeView === 'crew' ? 'contractors' : 'clients'}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900/40 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-accent transition-all text-xs font-semibold text-white"
            />
          </div>

          {activeView === 'crew' && (
            <FilterSheet
              activeCount={(showFavoritesOnly ? 1 : 0) + (selectedRoleFilter ? 1 : 0)}
            >
              {/* Favorites Toggle */}
              <button
                onClick={() => setShowFavoritesOnly(prev => !prev)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-center gap-2 font-semibold text-xs tracking-tight ${
                  showFavoritesOnly 
                    ? 'bg-yellow-500/25 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/30' 
                    : 'bg-neutral-900/40 border-white/10 text-white/40 hover:text-white hover:border-white/20'
                }`}
                title="Filter Favorites Only"
              >
                <Star className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                <span className="hidden sm:inline">Favorites</span>
              </button>

              {/* Role Dropdown Filter */}
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="bg-neutral-900/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-accent transition-all text-xs font-semibold text-white cursor-pointer"
              >
                <option value="" className="bg-neutral-950 text-white">— All Roles —</option>
                {STANDARD_ROLES.map(role => (
                  <option key={role} value={role} className="bg-neutral-950 text-white">{role}</option>
                ))}
              </select>
            </FilterSheet>
          )}
        </div>
        {activeView === 'crew' && (
          <>
            <button
              onClick={() => setIsImportOptionsOpen(true)}
              className="bg-zinc-900 hover:bg-zinc-800 text-white/80 hover:text-white px-6 py-4 rounded-xl border border-white/10 rounded-xl font-semibold text-xs transition-all flex items-center gap-3 whitespace-nowrap cursor-pointer hover:border-accent/40"
            >
              <Upload className="w-4 h-4 text-accent" /> Import
            </button>
            <input
              type="file"
              id="import-contacts-input"
              accept=".vcf,.csv"
              onChange={handleImportFile}
              className="hidden"
            />
          </>
        )}
        {activeView === 'clients' && (
          <>
            <label
              htmlFor="import-clients-input"
              title="Import customers from a QuickBooks CSV export"
              className="bg-zinc-900 hover:bg-zinc-800 text-white/80 hover:text-white px-6 py-4 rounded-xl border border-white/10 font-semibold text-xs transition-all flex items-center gap-3 whitespace-nowrap cursor-pointer hover:border-accent/40"
            >
              <Upload className="w-4 h-4 text-accent" /> Import from QuickBooks
            </label>
            <input
              type="file"
              id="import-clients-input"
              accept=".csv"
              onChange={handleClientImportFile}
              className="hidden"
            />
          </>
        )}
        <button
          onClick={() => {
            if (activeView === 'crew') {
              setEditingContact({ name: '', email: '', primary_role: '', is_favorite: false });
              setIsModalOpen(true);
            } else {
              setEditingClient({ name: '', email: '', phone: '', address: '', notes: '' });
              setIsClientModalOpen(true);
            }
          }}
          className="bg-accent text-white px-8 py-4 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center gap-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add {activeView === 'crew' ? 'Contact' : 'Client'}
        </button>
      </div>

      <div className="bg-neutral-900/40 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th 
                className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                   {activeView === 'crew' ? 'Contact' : 'Client Name'} <SortIcon field="name" />
                </div>
              </th>
              {activeView === 'crew' && (
                <th 
                  className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => handleSort('primary_role')}
                >
                  <div className="flex items-center gap-2">
                     Primary Role <SortIcon field="primary_role" />
                  </div>
                </th>
              )}
              <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 hidden md:table-cell text-white">Contact Info</th>
              {activeView === 'crew' && <th className="px-6 py-4 text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 hidden lg:table-cell text-white">Tags</th>}
              <th className="px-6 py-4 text-right text-[10px] font-medium uppercase tracking-[0.12em] opacity-40 text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {activeView === 'crew' ? (
              filteredContacts.slice(0, visibleCount).map(contact => (
                <tr key={contact.id} onClick={() => openContactDetail(contact)} className="group hover:bg-white/[0.02] transition-colors text-white cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(contact); }}
                        className={`transition-colors ${contact.is_favorite ? 'text-yellow-500' : 'text-white/10 hover:text-white/40'}`}
                      >
                        <Star className={`w-3.5 h-3.5 ${contact.is_favorite ? 'fill-current' : ''}`} />
                      </button>
                      <span className="text-sm font-semibold tracking-tight">{contact.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-semibold text-accent">{contact.primary_role || '—'}</span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-white/40">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40">
                          <Phone className="w-3 h-3" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags?.split(',').map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-medium opacity-30 text-white">
                          {tag.trim()}
                        </span>
                      )) || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); fetchContactHistory(contact.id); }}
                        className="p-2 text-white/10 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                        title="Work History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingContact(contact); setIsModalOpen(true); }}
                        className="p-2 text-white/10 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteContact(contact.id); }}
                        className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )).concat(
                filteredContacts.length > visibleCount ? [(
                  <tr key="__show_more__">
                    <td colSpan={6} className="px-6 py-3">
                      <button
                        onClick={() => setVisibleCount(c => c + 150)}
                        className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-semibold uppercase tracking-widest text-white/50 hover:text-white transition-all"
                      >
                        Show more ({filteredContacts.length - visibleCount} remaining)
                      </button>
                    </td>
                  </tr>
                )] : []
              )
            ) : (
              filteredClients.map(client => (
                <tr key={client.id} onClick={() => openClientDetail(client)} className="group hover:bg-white/[0.02] transition-colors text-white cursor-pointer">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-accent/50" />
                      <span className="text-sm font-semibold tracking-tight">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <div className="space-y-1">
                      {client.email && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40">
                          <Phone className="w-3 h-3" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={(e) => { e.stopPropagation(); fetchClientHistory(client.name); }}
                        className="p-2 text-white/10 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                        title="Client Production History"
                      >
                        <Briefcase className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setEditingClient(client); setIsClientModalOpen(true); }}
                        className="p-2 text-white/10 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteClient(client.id); }}
                        className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════ CONTACT DETAIL CARD ═══════════════════════ */}
      <AnimatePresence>
        {isContactDetailOpen && selectedContact && (
          <div 
            onClick={(e) => { if (e.target === e.currentTarget) setIsContactDetailOpen(false); }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-neutral-950 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 cursor-default overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header / Avatar Area */}
              <div className="relative bg-gradient-to-b from-accent/15 via-accent/5 to-transparent pt-10 pb-6 px-6 text-center">
                <button 
                  onClick={() => setIsContactDetailOpen(false)} 
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Avatar */}
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-accent to-accent/60 flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-accent/20 mb-4">
                  {getInitials(selectedContact.name)}
                </div>
                
                <h2 className="text-xl font-semibold tracking-tight text-white mb-1">{selectedContact.name}</h2>
                {selectedContact.primary_role && (
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent">{selectedContact.primary_role}</p>
                )}
                {selectedContact.company_name && (
                  <p className="text-[10px] font-medium text-white/40 mt-1 flex items-center justify-center gap-1.5">
                    <Building className="w-3 h-3" /> {selectedContact.company_name}
                  </p>
                )}
                
                {/* Favorite Badge */}
                {selectedContact.is_favorite && (
                  <div className="absolute top-4 left-4">
                    <Star className="w-5 h-5 text-yellow-500 fill-current" />
                  </div>
                )}
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-3 gap-2 px-6 -mt-1 mb-4">
                <a 
                  href={selectedContact.phone ? `tel:${selectedContact.phone}` : undefined}
                  onClick={(e) => { if (!selectedContact.phone) e.preventDefault(); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all ${
                    selectedContact.phone 
                      ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 cursor-pointer' 
                      : 'bg-white/[0.02] border-white/5 text-white/15 cursor-not-allowed'
                  }`}
                >
                  <Phone className="w-5 h-5" />
                  <span className="text-[11px] md:text-[9px] font-semibold tracking-tight">Call</span>
                </a>
                <a 
                  href={selectedContact.phone ? `sms:${selectedContact.phone}` : undefined}
                  onClick={(e) => { if (!selectedContact.phone) e.preventDefault(); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all ${
                    selectedContact.phone 
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 cursor-pointer' 
                      : 'bg-white/[0.02] border-white/5 text-white/15 cursor-not-allowed'
                  }`}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-[11px] md:text-[9px] font-semibold tracking-tight">Message</span>
                </a>
                <a 
                  href={`mailto:${selectedContact.email}`}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border bg-accent/10 border-accent/20 text-accent hover:bg-accent/20 transition-all cursor-pointer"
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-[11px] md:text-[9px] font-semibold tracking-tight">Email</span>
                </a>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
                
                {/* Contact Info Section */}
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  {/* Phone */}
                  <button 
                    onClick={() => selectedContact.phone && copyToClipboard(selectedContact.phone, 'phone')}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                      <Phone className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/30">Phone</p>
                      <p className="text-sm font-bold text-white truncate">{selectedContact.phone || 'Not set'}</p>
                    </div>
                    {selectedContact.phone && (
                      <div className="text-white/20 group-hover:text-white/60 transition-colors">
                        {copiedField === 'phone' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </div>
                    )}
                  </button>

                  {/* Email */}
                  <button 
                    onClick={() => copyToClipboard(selectedContact.email, 'email')}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors text-left group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Mail className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/30">Email</p>
                      <p className="text-sm font-bold text-white truncate">{selectedContact.email}</p>
                    </div>
                    <div className="text-white/20 group-hover:text-white/60 transition-colors">
                      {copiedField === 'email' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </div>
                  </button>

                  {/* Location */}
                  {(selectedContact.location_city || selectedContact.location_state) && (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/30">Location</p>
                        <p className="text-sm font-bold text-white">
                          {[selectedContact.location_city, selectedContact.location_state, selectedContact.location_country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Role & Tags Section */}
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  {selectedContact.primary_role && (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Briefcase className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/30">Primary Role</p>
                        <p className="text-sm font-semibold text-white">{selectedContact.primary_role}</p>
                      </div>
                    </div>
                  )}
                  
                  {selectedContact.tags && (
                    <div className="flex items-start gap-4 p-4">
                      <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Tag className="w-4 h-4 text-orange-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/30 mb-2">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedContact.tags.split(',').map(tag => (
                            <span key={tag} className="px-2.5 py-1 bg-white/5 rounded-lg text-[10px] font-semibold text-white/60 border border-white/5">
                              {tag.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes Section */}
                {selectedContact.notes_general && (
                  <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-3.5 h-3.5 text-white/30" />
                      <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/30">Notes</p>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{selectedContact.notes_general}</p>
                  </div>
                )}

                {/* Work History Section */}
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <History className="w-3.5 h-3.5 text-accent" />
                      <p className="text-[11px] md:text-[9px] font-medium uppercase tracking-[0.12em] text-white/40">Work History</p>
                    </div>
                    <span className="text-[10px] font-semibold tracking-tight text-accent">
                      {contactDetailHistory.length} Jobs
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar">
                    {isDetailHistoryLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : contactDetailHistory.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {contactDetailHistory.map((entry, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors">
                            <span className={`px-1.5 py-0.5 rounded text-[11px] md:text-[8px] font-semibold tracking-wide shrink-0 ${
                              entry.type === 'On-Set' ? 'bg-blue-500/15 text-blue-400' : 'bg-purple-500/15 text-purple-400'
                            }`}>
                              {entry.type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold tracking-tight text-white truncate">{entry.job_title}</p>
                              <p className="text-[11px] md:text-[9px] font-semibold text-white/30">{entry.position}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[11px] md:text-[9px] font-bold text-white/30">{entry.shoot_date || 'TBD'}</p>
                              {entry.rate && (
                                <p className="text-[10px] font-black text-green-400">${entry.rate}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-[10px] font-semibold text-white/20">No jobs recorded</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setIsContactDetailOpen(false);
                      setEditingContact(selectedContact);
                      setIsModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button 
                    onClick={() => {
                      setIsContactDetailOpen(false);
                      deleteContact(selectedContact.id);
                    }}
                    className="flex items-center justify-center gap-2 py-3.5 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-xl text-xs font-semibold text-red-400/60 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════ CLIENT DETAIL CARD ═══════════════════════ */}
      <AnimatePresence>
        {isClientDetailOpen && selectedClient && (
          <div 
            onClick={(e) => { if (e.target === e.currentTarget) setIsClientDetailOpen(false); }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/90 backdrop-blur-lg cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="w-full max-w-md bg-neutral-950 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 cursor-default overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header / Avatar Area */}
              <div className="relative bg-gradient-to-b from-blue-500/10 via-blue-500/5 to-transparent pt-10 pb-6 px-6 text-center">
                <button 
                  onClick={() => setIsClientDetailOpen(false)} 
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500/30 to-accent/20 border border-white/10 flex items-center justify-center mb-4">
                  <Building2 className="w-9 h-9 text-white/60" />
                </div>
                
                <h2 className="text-xl font-bold tracking-tight text-white mb-1">{selectedClient.name}</h2>
                <p className="text-[10px] font-semibold text-blue-400/80">Client</p>
              </div>

              {/* Quick Action Buttons */}
              <div className="grid grid-cols-2 gap-2 px-6 -mt-1 mb-4">
                <a 
                  href={selectedClient.phone ? `tel:${selectedClient.phone}` : undefined}
                  onClick={(e) => { if (!selectedClient.phone) e.preventDefault(); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all ${
                    selectedClient.phone 
                      ? 'bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 cursor-pointer' 
                      : 'bg-white/[0.02] border-white/5 text-white/15 cursor-not-allowed'
                  }`}
                >
                  <Phone className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-wide">Call</span>
                </a>
                <a 
                  href={selectedClient.email ? `mailto:${selectedClient.email}` : undefined}
                  onClick={(e) => { if (!selectedClient.email) e.preventDefault(); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all ${
                    selectedClient.email 
                      ? 'bg-accent/10 border-accent/20 text-accent hover:bg-accent/20 cursor-pointer' 
                      : 'bg-white/[0.02] border-white/5 text-white/15 cursor-not-allowed'
                  }`}
                >
                  <Mail className="w-5 h-5" />
                  <span className="text-[10px] font-semibold tracking-wide">Email</span>
                </a>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
                
                {/* Contact Info */}
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  {selectedClient.phone && (
                    <button 
                      onClick={() => copyToClipboard(selectedClient.phone!, 'client-phone')}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                        <Phone className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white/40">Phone</p>
                        <p className="text-sm font-semibold text-white">{selectedClient.phone}</p>
                      </div>
                      <div className="text-white/20 group-hover:text-white/60 transition-colors">
                        {copiedField === 'client-phone' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </div>
                    </button>
                  )}
                  {selectedClient.email && (
                    <button 
                      onClick={() => copyToClipboard(selectedClient.email!, 'client-email')}
                      className="w-full flex items-center gap-4 p-4 hover:bg-white/[0.03] transition-colors text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white/40">Email</p>
                        <p className="text-sm font-semibold text-white truncate">{selectedClient.email}</p>
                      </div>
                      <div className="text-white/20 group-hover:text-white/60 transition-colors">
                        {copiedField === 'client-email' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </div>
                    </button>
                  )}
                  {selectedClient.address && (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white/40">Billing Address</p>
                        <p className="text-sm font-semibold text-white">{selectedClient.address}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {selectedClient.notes && (
                  <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-3.5 h-3.5 text-white/30" />
                      <p className="text-[10px] font-medium text-white/40">Notes</p>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed whitespace-pre-wrap">{selectedClient.notes}</p>
                  </div>
                )}

                {/* Production History */}
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-3.5 h-3.5 text-accent" />
                      <p className="text-[10px] font-medium text-white/40">Production History</p>
                    </div>
                    <span className="text-[10px] font-semibold text-accent">
                      {clientDetailHistory.length} Jobs
                    </span>
                  </div>
                  <div className="max-h-56 overflow-y-auto custom-scrollbar">
                    {isClientDetailHistoryLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : clientDetailHistory.length > 0 ? (
                      <div className="divide-y divide-white/5">
                        {clientDetailHistory.map((entry, i) => (
                          <div key={i} className="p-3 hover:bg-white/[0.02] transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[11px] font-semibold text-white">{entry.job_title}</p>
                              <p className="text-[11px] md:text-[9px] font-medium text-white/30">{entry.shoot_date || 'TBD'}</p>
                            </div>
                            {entry.crew.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {entry.crew.map((c, j) => (
                                  <span key={j} className="text-[11px] md:text-[9px] bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-white/50 font-medium">
                                    {c.name} • {c.position}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-[10px] font-semibold text-white/20">No jobs recorded</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button 
                    onClick={() => {
                      setIsClientDetailOpen(false);
                      setEditingClient(selectedClient);
                      setIsClientModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button 
                    onClick={() => {
                      setIsClientDetailOpen(false);
                      deleteClient(selectedClient.id);
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-red-500/5 hover:bg-red-500/15 border border-red-500/10 rounded-xl text-xs font-semibold text-red-400/60 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsHistoryOpen(false);
              }
            }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl cursor-default"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Work History</h2>
                  <p className="text-[10px] font-medium text-accent mt-1">Contractor Utilization & Rates</p>
                </div>
                <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedContactHistory.length > 0 ? (
                  selectedContactHistory.map((entry, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-6 group hover:border-accent/30 transition-all text-white">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[11px] md:text-[9px] font-semibold ${entry.type === 'On-Set' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                              {entry.type}
                            </span>
                            <p className="text-sm font-semibold group-hover:text-accent transition-colors">{entry.job_title}</p>
                          </div>
                          <p className="text-[10px] font-medium opacity-40">{entry.position}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-medium text-white/40">{entry.shoot_date || 'TBD'}</p>
                          {entry.rate && (
                             <div className="flex items-center gap-1 text-green-500 mt-1 justify-end">
                                <DollarSign className="w-3 h-3" />
                                <span className="text-[11px] font-semibold">{entry.rate}</span>
                             </div>
                          )}
                        </div>
                      </div>
                      {entry.notes && (
                         <div className="pt-4 border-t border-white/5">
                            <p className="text-[10px] font-medium text-white/30 italic">"{entry.notes}"</p>
                         </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 opacity-40 border border-dashed border-white/10 rounded-2xl text-white">
                    <p className="text-xs font-semibold text-white/40">No previous jobs recorded.</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[10px] font-semibold opacity-40 text-white">Yearly Summary</p>
                    <p className="text-xs font-semibold text-white">
                       Total Jobs: <span className="text-accent">{selectedContactHistory.length}</span>
                    </p>
                 </div>
                 <button 
                   onClick={() => setIsHistoryOpen(false)}
                   className="bg-accent text-white px-6 py-2.5 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all"
                 >
                   Close
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Options & Instructions Modal */}
      <AnimatePresence>
        {isImportOptionsOpen && (
          <div className="fixed inset-0 z-[150] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl my-auto text-white relative animate-in fade-in zoom-in-95 duration-200"
            >
              <button 
                onClick={() => setIsImportOptionsOpen(false)} 
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">Import Contacts</h2>
                <p className="text-[11px] md:text-[9px] font-bold uppercase tracking-widest opacity-40 text-white mt-1">Select your preferred method to import crew</p>
              </div>

              <div className="space-y-4">
                {/* Method 1: Web Contact Picker */}
                <button
                  type="button"
                  onClick={handleNativeContactImport}
                  className="w-full p-4 bg-white/5 hover:bg-accent/15 border border-white/5 hover:border-accent/40 rounded-xl transition-all text-left group flex items-start gap-4 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 group-hover:bg-accent/25 group-hover:border-accent/45 transition-colors">
                    <Phone className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-white">Direct iPhone / Device Picker</span>
                      <span className="text-[7px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">Instant</span>
                    </div>
                    <p className="text-[10px] text-white/50 mt-1 leading-relaxed">
                      Select contacts directly from your native iOS, iPadOS, or Android contacts list using your mobile web browser.
                    </p>
                  </div>
                </button>

                {/* Method 2: File Upload */}
                <div className="w-full p-4 bg-white/5 border border-white/5 rounded-xl flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    <Upload className="w-5 h-5 text-white/60" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <span className="text-xs font-black uppercase tracking-wider text-white block">Upload vCard (.vcf) or CSV</span>
                    <p className="text-[10px] text-white/50 mt-1 leading-relaxed mb-3">
                      Select an exported vCard file from your phone, or upload a custom CSV contact list.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsImportOptionsOpen(false);
                        document.getElementById('import-contacts-input')?.click();
                      }}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] md:text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-white/10"
                    >
                      Choose File
                    </button>
                  </div>
                </div>

                {/* Section C: iPhone Export Instructions */}
                <div className="border-t border-white/5 pt-5 mt-5">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-accent mb-3">How to export contacts from your iPhone</h3>
                  <div className="bg-black/25 border border-white/5 rounded-xl p-4 space-y-3.5 text-[11px] leading-relaxed text-white/70">
                    <div className="flex gap-3">
                      <span className="text-accent font-black select-none shrink-0 w-4">1.</span>
                      <p>Open the native <strong className="text-white">Contacts</strong> app on your iPhone.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-accent font-black select-none shrink-0 w-4">2.</span>
                      <p>Tap <strong className="text-white">Lists</strong> in the top-left corner to view your account groups.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-accent font-black select-none shrink-0 w-4">3.</span>
                      <p>Press and hold <strong className="text-white">All iCloud</strong> (or the list you want to copy), then select <strong className="text-white">Export</strong>.</p>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-accent font-black select-none shrink-0 w-4">4.</span>
                      <p>Tap <strong className="text-white">Save to Files</strong> (or AirDrop/email it to your computer) to download the <strong className="text-white">.vcf</strong> file.</p>
                    </div>
                    <div className="flex gap-3 pt-1 border-t border-white/5">
                      <span className="text-green-400 font-black select-none shrink-0 w-4">5.</span>
                      <p>Select <strong className="text-white">Choose File</strong> above and select the saved <strong className="text-white">.vcf</strong> file to import them here instantly!</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import Contacts Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsImportModalOpen(false);
              }
            }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-neutral-950 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] text-white cursor-default"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Import Preview</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">Review, edit, and select crew contacts to import</p>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-x-auto border border-white/5 rounded-xl mb-6 max-h-[45vh] custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 uppercase tracking-wider text-[11px] md:text-[9px] font-black opacity-60">
                      <th className="p-4 w-12 text-center">
                        <input 
                          type="checkbox"
                          checked={selectedImportIdxs.length === parsedContacts.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                               setSelectedImportIdxs(parsedContacts.map((_: any, idx: number) => idx));
                            } else {
                              setSelectedImportIdxs([]);
                            }
                          }}
                          className="rounded border-white/10 text-accent focus:ring-accent bg-black"
                        />
                      </th>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4 w-44">Primary Role</th>
                      <th className="p-4">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {parsedContacts.map((contact, idx) => {
                      const isSelected = selectedImportIdxs.includes(idx);
                      const isPlaceholderEmail = contact.email.includes('@temporary.com');
                      
                      return (
                        <tr key={idx} className={`hover:bg-white/[0.01] transition-colors ${isSelected ? 'text-white' : 'text-white/30'}`}>
                          <td className="p-4 text-center">
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setSelectedImportIdxs(selectedImportIdxs.filter(i => i !== idx));
                                } else {
                                  setSelectedImportIdxs([...selectedImportIdxs, idx]);
                                }
                              }}
                              className="rounded border-white/10 text-accent focus:ring-accent bg-black"
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="text" 
                              value={contact.name}
                              onChange={(e) => {
                                const updated = [...parsedContacts];
                                updated[idx].name = e.target.value;
                                setParsedContacts(updated);
                              }}
                              className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-accent outline-none p-2 rounded-lg text-xs font-bold uppercase tracking-wide text-white"
                              disabled={!isSelected}
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="email" 
                              value={contact.email}
                              onChange={(e) => {
                                const updated = [...parsedContacts];
                                updated[idx].email = e.target.value;
                                setParsedContacts(updated);
                              }}
                              className={`w-full bg-black/40 border outline-none p-2 rounded-lg text-xs font-bold text-white ${
                                isPlaceholderEmail ? 'border-yellow-500/30 focus:border-yellow-500' : 'border-white/5 hover:border-white/10 focus:border-accent'
                              }`}
                              title={isPlaceholderEmail ? 'Temporary email generated' : ''}
                              disabled={!isSelected}
                            />
                          </td>
                          <td className="p-3">
                            <input 
                              type="text" 
                              value={contact.phone}
                              placeholder="—"
                              onChange={(e) => {
                                const updated = [...parsedContacts];
                                updated[idx].phone = e.target.value;
                                setParsedContacts(updated);
                              }}
                              className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-accent outline-none p-2 rounded-lg text-xs font-bold text-white animate-fade-in"
                              disabled={!isSelected}
                            />
                          </td>
                          <td className="p-3">
                            <select
                              value={contact.primary_role}
                              onChange={(e) => {
                                const updated = [...parsedContacts];
                                updated[idx].primary_role = e.target.value;
                                setParsedContacts(updated);
                              }}
                              className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-accent outline-none p-2 rounded-lg text-[10px] font-bold text-white uppercase cursor-pointer"
                              disabled={!isSelected}
                            >
                              <option value="">— SELECT ROLE —</option>
                              {STANDARD_ROLES.map(role => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <input 
                              type="text" 
                              value={contact.tags}
                              onChange={(e) => {
                                const updated = [...parsedContacts];
                                updated[idx].tags = e.target.value;
                                setParsedContacts(updated);
                              }}
                              className="w-full bg-black/40 border border-white/5 hover:border-white/10 focus:border-accent outline-none p-2 rounded-lg text-xs font-bold text-white uppercase"
                              disabled={!isSelected}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center bg-black/40 border border-white/5 p-4 rounded-2xl mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Total Contacts Found: <span className="text-white font-black">{parsedContacts.length}</span> | Selected: <span className="text-accent font-black">{selectedImportIdxs.length}</span>
                </span>
                <span className="text-[11px] md:text-[9px] font-bold text-yellow-500 uppercase tracking-widest animate-pulse">
                  ⚠️ Verify highlighted fields before importing
                </span>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmImport}
                  disabled={isImportLoading || selectedImportIdxs.length === 0}
                  className="flex-grow py-4 bg-accent hover:bg-white hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-accent/25 font-bold"
                >
                  {isImportLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : `Confirm Import (${selectedImportIdxs.length})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QuickBooks Client Import Preview */}
      <AnimatePresence>
        {isClientImportOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Import Clients from QuickBooks</h2>
                <button onClick={() => setIsClientImportOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white/60 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-[11px] text-white/40 mb-5 font-medium">
                Review the customers parsed from your CSV. Existing clients (matched by name) are skipped. Edit any field before importing.
              </p>

              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setSelectedClientIdxs(selectedClientIdxs.length === parsedClients.length ? [] : parsedClients.map((_, i) => i))}
                  className="text-[10px] font-black uppercase tracking-widest text-accent hover:text-white cursor-pointer"
                >
                  {selectedClientIdxs.length === parsedClients.length ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{selectedClientIdxs.length} of {parsedClients.length} selected</span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl">
                <table className="w-full text-left">
                  <thead className="bg-white/[0.03] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 w-10"></th>
                      {['Client / Company', 'Email', 'Phone', 'Bill-to Address'].map(h => (
                        <th key={h} className="px-3 py-2 text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedClients.map((c, idx) => {
                      const checked = selectedClientIdxs.includes(idx);
                      const set = (patch: Partial<typeof c>) => setParsedClients(prev => prev.map((x, i) => i === idx ? { ...x, ...patch } : x));
                      return (
                        <tr key={idx} className={`border-t border-white/5 ${checked ? '' : 'opacity-40'}`}>
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedClientIdxs(checked ? selectedClientIdxs.filter(i => i !== idx) : [...selectedClientIdxs, idx])}
                              className="w-4 h-4 accent-accent cursor-pointer"
                            />
                          </td>
                          <td className="px-2 py-1"><input className="w-full bg-transparent outline-none text-[11px] text-white/90 px-1 py-1 focus:bg-accent/5 rounded" value={c.name} onChange={(e) => set({ name: e.target.value })} /></td>
                          <td className="px-2 py-1"><input className="w-full bg-transparent outline-none text-[11px] text-white/70 px-1 py-1 focus:bg-accent/5 rounded" value={c.email} onChange={(e) => set({ email: e.target.value })} /></td>
                          <td className="px-2 py-1"><input className="w-full bg-transparent outline-none text-[11px] text-white/70 px-1 py-1 focus:bg-accent/5 rounded" value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></td>
                          <td className="px-2 py-1"><input className="w-full bg-transparent outline-none text-[11px] text-white/70 px-1 py-1 focus:bg-accent/5 rounded" value={c.address} onChange={(e) => set({ address: e.target.value })} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button onClick={() => setIsClientImportOpen(false)} className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer">Cancel</button>
                <button
                  onClick={handleConfirmClientImport}
                  disabled={isClientImportLoading || selectedClientIdxs.length === 0}
                  className="bg-accent text-white px-10 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isClientImportLoading ? 'Importing…' : `Import ${selectedClientIdxs.length}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsModalOpen(false);
              }
            }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] cursor-default"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {editingContact?.id ? 'Edit Contact' : 'New Contact'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={editingContact?.name || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, name: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Email Address <span className="opacity-60 normal-case tracking-normal font-medium">(optional)</span></label>
                  <input
                    type="email"
                    value={editingContact?.email || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, email: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Phone</label>
                  <input 
                    type="text"
                    value={editingContact?.phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, phone: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Primary Role</label>
                  <input 
                    type="text"
                    value={editingContact?.primary_role || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, primary_role: e.target.value })}
                    list="standard-roles"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                  <datalist id="standard-roles">
                    {STANDARD_ROLES.map(role => <option key={role} value={role} />)}
                  </datalist>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Tags <span className="opacity-50 font-medium">(comma-separated)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. steadicam, local-nyc, owns-fx6"
                    value={editingContact?.tags || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, tags: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Notes</label>
                  <textarea 
                    value={editingContact?.notes_general || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, notes_general: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm h-32 text-white"
                  />
                </div>

                {/* Claude suggestion — proposes a role and tags from the fields
                    above; applies only to the form, saving stays manual. */}
                {editingContact && (
                  <ContactSuggest
                    contact={editingContact}
                    onApply={(fields) => setEditingContact({ ...editingContact!, ...fields })}
                  />
                )}

                <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-accent text-white px-8 py-2.5 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20"
                  >
                    Save Contact
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Client Modal */}
      <AnimatePresence>
        {isClientModalOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsClientModalOpen(false);
              }
            }}
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] cursor-default"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {editingClient?.id ? 'Edit Client' : 'New Client'}
                </h2>
                <button onClick={() => setIsClientModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleClientSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Company / Client Name</label>
                  <input 
                    required
                    type="text"
                    value={editingClient?.name || ''}
                    onChange={(e) => setEditingClient({ ...editingClient!, name: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Primary Email</label>
                  <input 
                    type="email"
                    value={editingClient?.email || ''}
                    onChange={(e) => setEditingClient({ ...editingClient!, email: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Phone</label>
                  <input 
                    type="text"
                    value={editingClient?.phone || ''}
                    onChange={(e) => setEditingClient({ ...editingClient!, phone: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Billing Address</label>
                  <input 
                    type="text"
                    value={editingClient?.address || ''}
                    onChange={(e) => setEditingClient({ ...editingClient!, address: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Notes</label>
                  <textarea 
                    value={editingClient?.notes || ''}
                    onChange={(e) => setEditingClient({ ...editingClient!, notes: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm h-32 text-white"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-accent text-white px-8 py-2.5 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20"
                  >
                    Save Client
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Client History Modal */}
      <AnimatePresence>
        {isClientHistoryOpen && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsClientHistoryOpen(false);
              }
            }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-3xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl cursor-default"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">Client Portfolio</h2>
                  <p className="text-xs font-semibold text-accent mt-1">{activeClientName}</p>
                </div>
                <button onClick={() => setIsClientHistoryOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedClientHistory.length > 0 ? (
                  selectedClientHistory.map((entry, i) => (
                    <div key={i} className="bg-white/5 border border-white/5 rounded-2xl p-6 group transition-all text-white">
                      <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-4">
                        <div>
                          <p className="text-base font-semibold tracking-tight">{entry.job_title}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-medium text-white/40">Shoot Date</p>
                          <p className="text-xs font-semibold">{entry.shoot_date || 'TBD'}</p>
                        </div>
                      </div>
                      <div>
                         <p className="text-[10px] font-medium opacity-50 mb-3">Assigned Crew</p>
                         {entry.crew.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                             {entry.crew.map((c, j) => (
                               <div key={j} className="flex items-center gap-2 p-2 bg-black/20 rounded border border-white/5">
                                 <Users className="w-3 h-3 text-accent" />
                                 <p className="text-xs font-semibold text-white/90">{c.name}</p>
                                 <p className="text-[10px] opacity-40 ml-auto">{c.position}</p>
                               </div>
                             ))}
                           </div>
                         ) : (
                           <p className="text-[10px] italic opacity-30">No crew recorded for this job.</p>
                         )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 opacity-40 border border-dashed border-white/10 rounded-2xl text-white">
                    <p className="text-xs font-semibold text-white/40">No jobs recorded for this client.</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-white/40">Yearly Summary</p>
                    <p className="text-xs font-semibold text-white">
                       Total Jobs: <span className="text-accent">{selectedClientHistory.length}</span>
                    </p>
                 </div>
                 <button 
                   onClick={() => setIsClientHistoryOpen(false)}
                   className="bg-accent text-white px-6 py-2.5 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all"
                 >
                   Close
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
