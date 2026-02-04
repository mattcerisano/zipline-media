'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Phone, Mail, MapPin, 
  Star, Trash2, Edit2, User, Briefcase, 
  Building2, History, X
} from 'lucide-react';
import { Contact, Client, STORAGE_KEY_CONTACTS, STORAGE_KEY_CLIENTS } from './types';
import { CONTACTS_DATA } from '@/data/contacts';

export default function Rolodex() {
  const [activeTab, setActiveTab] = useState<'contacts' | 'clients'>('clients');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  
  // Edit/Create State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);

  // Load Data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const c = localStorage.getItem(STORAGE_KEY_CONTACTS);
    const cl = localStorage.getItem(STORAGE_KEY_CLIENTS);
    
    if (c) setContacts(JSON.parse(c));
    else setContacts(CONTACTS_DATA);
    
    if (cl) setClients(JSON.parse(cl));
  }, []);

  // Save Data
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (contacts.length > 0) localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (clients.length > 0) localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
  }, [clients]);

  // Filtering
  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    if (activeTab === 'contacts') {
      return contacts.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.primary_role?.toLowerCase().includes(term) ||
        c.company_name?.toLowerCase().includes(term)
      ).sort((a, b) => (b.is_favorite === a.is_favorite) ? a.name.localeCompare(b.name) : (b.is_favorite ? 1 : -1));
    } else {
      return clients.filter(c => 
        c.name.toLowerCase().includes(term)
      ).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [activeTab, contacts, clients, search]);

  // Actions
  const handleSave = () => {
    if (activeTab === 'contacts') {
        if (!editingContact?.name) return;
        const payload = { ...editingContact, updated_at: new Date().toISOString() } as Contact;
        if (!payload.id) payload.id = crypto.randomUUID();
        
        setContacts(prev => {
            const exists = prev.find(c => c.id === payload.id);
            return exists ? prev.map(c => c.id === payload.id ? payload : c) : [payload, ...prev];
        });
    } else {
        if (!editingClient?.name) return;
        const payload = { ...editingClient, updated_at: new Date().toISOString() } as Client;
        if (!payload.id) payload.id = crypto.randomUUID();

        setClients(prev => {
            const exists = prev.find(c => c.id === payload.id);
            return exists ? prev.map(c => c.id === payload.id ? payload : c) : [payload, ...prev];
        });
    }
    setIsModalOpen(false);
    setEditingContact(null);
    setEditingClient(null);
  };

  const handleDelete = (id: string) => {
      if (!confirm('Are you sure you want to delete this entry?')) return;
      if (activeTab === 'contacts') {
          setContacts(prev => prev.filter(c => c.id !== id));
      } else {
          setClients(prev => prev.filter(c => c.id !== id));
      }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setContacts(prev => prev.map(c => c.id === id ? { ...c, is_favorite: !c.is_favorite } : c));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex gap-8">
        {/* Left Sidebar - List */}
        <div className="w-80 flex flex-col gap-4 shrink-0">
            <div className="flex gap-2 p-1 bg-white/5 rounded-lg border border-white/5">
                <button 
                    onClick={() => setActiveTab('clients')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'clients' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                >
                    Clients
                </button>
                <button 
                    onClick={() => setActiveTab('contacts')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeTab === 'contacts' ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                >
                    Crew / Contacts
                </button>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input 
                  type="text" 
                  placeholder="SEARCH..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 py-3 pl-10 pr-4 outline-none focus:border-accent transition-colors uppercase text-xs font-bold tracking-widest rounded-lg"
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                {filteredData.map((item: any) => (
                    <div 
                        key={item.id}
                        className="group p-4 rounded-xl border border-white/5 bg-neutral-900/50 hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer relative"
                        onClick={() => activeTab === 'contacts' ? setEditingContact(item) : setEditingClient(item)}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="font-bold text-sm uppercase truncate pr-4">{item.name}</h3>
                            {activeTab === 'contacts' && (
                                <button onClick={(e) => toggleFavorite(item.id, e)} className={`opacity-0 group-hover:opacity-100 transition-opacity ${item.is_favorite ? 'text-yellow-500 opacity-100' : 'text-white/20 hover:text-white'}`}>
                                    <Star className="w-3 h-3 fill-current" />
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] font-medium opacity-40 uppercase tracking-wider">
                            {activeTab === 'contacts' ? item.primary_role : (item.email || 'No Email')}
                        </p>
                    </div>
                ))}
                
                <button 
                    onClick={() => {
                        if (activeTab === 'contacts') setEditingContact({ is_favorite: false });
                        else setEditingClient({});
                        setIsModalOpen(true);
                    }}
                    className="w-full py-4 border border-dashed border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 hover:border-white/30 hover:bg-white/5 transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-4 h-4" /> Add {activeTab === 'contacts' ? 'Contact' : 'Client'}
                </button>
            </div>
        </div>

        {/* Right - Details / Edit */}
        <div className="flex-1 bg-neutral-900/50 border border-white/10 rounded-2xl p-8 overflow-y-auto custom-scrollbar relative">
            {(!editingContact && !editingClient && !isModalOpen) && (
                <div className="h-full flex flex-col items-center justify-center opacity-20">
                    <User className="w-16 h-16 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Select an entry to view details</p>
                </div>
            )}

            {/* View Mode (Quick Edit essentially) - mimicking the "Edit" modal but inline if selected */}
            {((editingContact || editingClient) && !isModalOpen) && (
                <div className="max-w-2xl mx-auto space-y-8">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">{(editingContact || editingClient)?.name}</h2>
                            <div className="flex items-center gap-2 opacity-60">
                                {activeTab === 'contacts' && (
                                    <span className="text-xs font-bold uppercase tracking-widest bg-white/10 px-2 py-1 rounded">
                                        {(editingContact as Contact)?.primary_role || 'Crew'}
                                    </span>
                                )}
                                {(editingContact as Contact)?.company_name && (
                                    <span className="text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Building2 className="w-3 h-3" /> {(editingContact as Contact).company_name}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <Edit2 className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold tracking-[0.2em] opacity-40 uppercase">Contact Info</label>
                                <div className="space-y-3">
                                    {(editingContact || editingClient)?.email && (
                                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                            <Mail className="w-4 h-4 opacity-50" />
                                            <span className="text-sm font-medium">{(editingContact || editingClient)?.email}</span>
                                        </div>
                                    )}
                                    {(editingContact || editingClient)?.phone && (
                                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                            <Phone className="w-4 h-4 opacity-50" />
                                            <span className="text-sm font-medium">{(editingContact || editingClient)?.phone}</span>
                                        </div>
                                    )}
                                    {((editingContact as Contact)?.location_city || (editingClient as Client)?.address) && (
                                        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/5">
                                            <MapPin className="w-4 h-4 opacity-50" />
                                            <span className="text-sm font-medium">
                                                {activeTab === 'contacts' 
                                                    ? `${(editingContact as Contact).location_city || ''} ${(editingContact as Contact).location_state || ''}` 
                                                    : (editingClient as Client).address}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                             {/* Contact History (Job Log) */}
                             {activeTab === 'contacts' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold tracking-[0.2em] opacity-40 uppercase flex items-center gap-2">
                                        <Briefcase className="w-3 h-3" /> Job History
                                    </label>
                                    <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                        {((editingContact as Contact)?.job_history || []).length === 0 ? (
                                            <div className="p-6 text-center opacity-30 text-[10px] font-bold uppercase tracking-widest">No jobs recorded</div>
                                        ) : (
                                            <div className="divide-y divide-white/5">
                                                {(editingContact as Contact).job_history?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((h: any) => (
                                                    <div key={h.job_id} className="p-4 hover:bg-white/5 transition-colors">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-xs font-bold uppercase">{h.job_title}</span>
                                                            <span className="text-[10px] opacity-40 font-mono">{new Date(h.date).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-bold tracking-widest opacity-60 uppercase text-accent">{h.role}</span>
                                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                                                h.status === 'Booked' ? 'bg-green-500/20 border-green-500/30 text-green-500' :
                                                                h.status === 'Hold' ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-500' :
                                                                'bg-white/10 border-white/10 text-white/40'
                                                            }`}>{h.status}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                             )}

                             {/* Client History */}
                             {activeTab === 'clients' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold tracking-[0.2em] opacity-40 uppercase flex items-center gap-2">
                                        <History className="w-3 h-3" /> History
                                    </label>
                                    <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                                        {((editingClient as Client)?.history || []).length === 0 ? (
                                            <div className="p-6 text-center opacity-30 text-[10px] font-bold uppercase tracking-widest">No history recorded</div>
                                        ) : (
                                            <div className="divide-y divide-white/5">
                                                {(editingClient as Client).history?.map((h: any) => (
                                                    <div key={h.id} className="p-4 hover:bg-white/5 transition-colors">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="text-xs font-bold uppercase">{h.title}</span>
                                                            <span className="text-[10px] opacity-40 font-mono">{new Date(h.date).toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[10px] font-bold tracking-widest opacity-60 uppercase">{h.type}</span>
                                                            {h.summary && <span className="text-[10px] opacity-40">{h.summary}</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                             )}

                             {((activeTab === 'contacts' && (editingContact as Contact)?.notes_general) || (activeTab === 'clients' && (editingClient as Client)?.notes)) && (
                                 <div className="space-y-2">
                                     <label className="text-[10px] font-bold tracking-[0.2em] opacity-40 uppercase">Notes</label>
                                     <p className="text-sm opacity-80 leading-relaxed whitespace-pre-wrap">
                                         {activeTab === 'contacts' ? (editingContact as Contact).notes_general : (editingClient as Client).notes}
                                     </p>
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Modal for Creating/Editing */}
        <AnimatePresence>
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsModalOpen(false)}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                        className="relative bg-neutral-900 border border-white/10 w-full max-w-lg p-8 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-xl font-black uppercase tracking-tighter">
                                {(editingContact?.id || editingClient?.id) ? 'Edit Entry' : `New ${activeTab === 'contacts' ? 'Contact' : 'Client'}`}
                            </h2>
                            <div className="flex gap-2">
                                {(editingContact?.id || editingClient?.id) && (
                                    <button 
                                        onClick={() => handleDelete((editingContact?.id || editingClient?.id)!)}
                                        className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {activeTab === 'contacts' ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Name</label>
                                        <input 
                                            className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                                            value={editingContact?.name || ''}
                                            onChange={e => setEditingContact(p => ({ ...p, name: e.target.value }))}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Role</label>
                                            <input 
                                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                                value={editingContact?.primary_role || ''}
                                                onChange={e => setEditingContact(p => ({ ...p, primary_role: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Company</label>
                                            <input 
                                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                                value={editingContact?.company_name || ''}
                                                onChange={e => setEditingContact(p => ({ ...p, company_name: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Email</label>
                                            <input 
                                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                                value={editingContact?.email || ''}
                                                onChange={e => setEditingContact(p => ({ ...p, email: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Phone</label>
                                            <input 
                                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                                value={editingContact?.phone || ''}
                                                onChange={e => setEditingContact(p => ({ ...p, phone: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Location (City, State)</label>
                                        <input 
                                            className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                            value={editingContact?.location_city || ''}
                                            onChange={e => setEditingContact(p => ({ ...p, location_city: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Notes</label>
                                        <textarea 
                                            rows={4}
                                            className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent text-sm resize-none"
                                            value={editingContact?.notes_general || ''}
                                            onChange={e => setEditingContact(p => ({ ...p, notes_general: e.target.value }))}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Client Name</label>
                                        <input 
                                            className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                                            value={editingClient?.name || ''}
                                            onChange={e => setEditingClient(p => ({ ...p, name: e.target.value }))}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Email</label>
                                            <input 
                                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                                value={editingClient?.email || ''}
                                                onChange={e => setEditingClient(p => ({ ...p, email: e.target.value }))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Phone</label>
                                            <input 
                                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                                value={editingClient?.phone || ''}
                                                onChange={e => setEditingClient(p => ({ ...p, phone: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Address</label>
                                        <input 
                                            className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                            value={editingClient?.address || ''}
                                            onChange={e => setEditingClient(p => ({ ...p, address: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40 ml-1">Notes</label>
                                        <textarea 
                                            rows={4}
                                            className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent text-sm resize-none"
                                            value={editingClient?.notes || ''}
                                            onChange={e => setEditingClient(p => ({ ...p, notes: e.target.value }))}
                                        />
                                    </div>
                                </>
                            )}

                            <button 
                                onClick={handleSave}
                                className="w-full bg-white text-black py-4 mt-4 font-black tracking-widest uppercase text-xs hover:bg-accent hover:text-white transition-all rounded-xl"
                            >
                                Save Entry
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
}