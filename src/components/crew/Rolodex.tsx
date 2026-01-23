import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Trash2, Edit2, Star, StarOff, 
  MapPin, Mail, Phone, Building, User, ChevronLeft
} from 'lucide-react';

import { 
  Contact, Client, STORAGE_KEY_CONTACTS, STORAGE_KEY_CLIENTS 
} from './types';
import { CONTACTS_DATA } from '@/data/contacts';

type ViewMode = 'contacts' | 'clients';

const SEED_CONTACTS: Contact[] = CONTACTS_DATA;

const SEED_CLIENTS: Client[] = [];

// --- Components ---

export default function Rolodex() {
  const [viewMode, setViewMode] = useState<ViewMode>('contacts');
  
  const [contacts, setContacts] = useState<Contact[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
    return saved ? JSON.parse(saved) : SEED_CONTACTS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEY_CLIENTS);
    return saved ? JSON.parse(saved) : SEED_CLIENTS;
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Dialog States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Contact | Client> | null>(null);

  // Save on change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
  }, [contacts, clients]);

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    const list = viewMode === 'contacts' ? contacts : clients;
    return list.filter(item => 
      item.name.toLowerCase().includes(term) || 
      (item as Contact).primary_role?.toLowerCase().includes(term) ||
      (item as Contact).company_name?.toLowerCase().includes(term)
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [search, viewMode, contacts, clients]);

  const selectedItem = useMemo(() => {
    return (viewMode === 'contacts' ? contacts : clients).find(i => i.id === selectedId);
  }, [selectedId, viewMode, contacts, clients]);

  // Actions
  const handleSave = (data: Partial<Contact | Client>) => {
    const now = new Date().toISOString();
    if (viewMode === 'contacts') {
      const payload = { ...data, updated_at: now } as Contact;
      if (!payload.id) payload.id = crypto.randomUUID();
      
      setContacts(prev => {
        const exists = prev.find(c => c.id === payload.id);
        return exists ? prev.map(c => c.id === payload.id ? payload : c) : [...prev, payload];
      });
      setSelectedId(payload.id);
    } else {
      const payload = { ...data, updated_at: now } as Client;
      if (!payload.id) payload.id = crypto.randomUUID();
      
      setClients(prev => {
        const exists = prev.find(c => c.id === payload.id);
        return exists ? prev.map(c => c.id === payload.id ? payload : c) : [...prev, payload];
      });
      setSelectedId(payload.id);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    if (viewMode === 'contacts') {
      setContacts(prev => prev.filter(c => c.id !== id));
    } else {
      setClients(prev => prev.filter(c => c.id !== id));
    }
    if (selectedId === id) setSelectedId(null);
  };

  const toggleFavorite = (id: string) => {
    if (viewMode !== 'contacts') return;
    setContacts(prev => prev.map(c => c.id === id ? { ...c, is_favorite: !c.is_favorite } : c));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-200px)]">
      {/* SIDEBAR LIST */}
      <div className={`lg:col-span-4 flex flex-col gap-4 h-full ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
        {/* Controls */}
        <div className="bg-neutral-900/50 border border-white/10 p-4 rounded-xl space-y-4">
          <div className="flex bg-black/50 p-1 rounded-lg border border-white/5">
            {(['contacts', 'clients'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => { setViewMode(mode); setSelectedId(null); }}
                className={`flex-1 py-2 text-xs font-bold tracking-[0.2em] uppercase rounded-md transition-all ${viewMode === mode ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
              >
                {mode}
              </button>
            ))}
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

          <button 
            onClick={() => { setEditingItem({}); setIsDialogOpen(true); }}
            className="w-full bg-white text-black py-3 rounded-lg text-xs font-black tracking-[0.2em] uppercase hover:bg-accent hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New {viewMode === 'contacts' ? 'Contact' : 'Client'}
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto bg-neutral-900/30 border border-white/10 rounded-xl p-2 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2">
              <User className="w-8 h-8" />
              <p className="text-xs uppercase tracking-widest">No results</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full text-left p-4 mb-2 rounded-lg border transition-all group ${selectedId === item.id ? 'bg-accent/10 border-accent/50' : 'bg-transparent border-transparent hover:bg-white/5'}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`text-sm font-bold uppercase tracking-tight ${selectedId === item.id ? 'text-white' : 'text-white/80'}`}>{item.name}</h3>
                    <p className="text-xs font-medium tracking-widest uppercase opacity-40 mt-1">
                      {(item as Contact).primary_role || (item as Contact).company_name || (viewMode === 'clients' ? 'Client' : 'Freelancer')}
                    </p>
                  </div>
                  {viewMode === 'contacts' && (item as Contact).is_favorite && (
                    <Star className="w-3 h-3 text-accent fill-accent" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* DETAIL VIEW */}
      <div className={`lg:col-span-8 h-full overflow-y-auto custom-scrollbar ${selectedId ? 'block' : 'hidden lg:block'}`}>
        {selectedItem ? (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            key={selectedItem.id}
            className="space-y-6"
          >
            {/* Header Card */}
            <div className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-2xl relative overflow-hidden group">
              <button 
                  onClick={() => setSelectedId(null)} 
                  className="lg:hidden absolute top-4 left-4 p-2 bg-white/10 rounded-full z-10"
              >
                  <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="absolute top-0 right-0 p-4 flex gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingItem(selectedItem); setIsDialogOpen(true); }}
                  className="p-2 bg-black/50 hover:bg-white hover:text-black rounded-lg transition-colors border border-white/10"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(selectedItem.id)}
                  className="p-2 bg-black/50 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-white/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mt-8 md:mt-0 text-center md:text-left">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-3xl font-black border border-white/10 shrink-0">
                  {selectedItem.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-2">{selectedItem.name}</h2>
                  <div className="flex flex-wrap justify-center md:justify-start gap-3">
                    {viewMode === 'contacts' && (selectedItem as Contact).primary_role && (
                      <span className="px-3 py-1 bg-accent/20 border border-accent/30 text-accent text-[10px] font-bold tracking-widest uppercase rounded-full">
                        {(selectedItem as Contact).primary_role}
                      </span>
                    )}
                    {viewMode === 'contacts' && (selectedItem as Contact).company_name && (
                      <span className="px-3 py-1 bg-white/5 border border-white/10 text-white/60 text-[10px] font-bold tracking-widest uppercase rounded-full">
                        {(selectedItem as Contact).company_name}
                      </span>
                    )}
                    {viewMode === 'contacts' && (
                        <button 
                            onClick={() => toggleFavorite(selectedItem.id)}
                            className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 hover:bg-yellow-500/20 hover:text-yellow-500 text-white/40 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all"
                        >
                            {(selectedItem as Contact).is_favorite ? <Star className="w-3 h-3 fill-current" /> : <StarOff className="w-3 h-3" />}
                            Favorites
                        </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Info */}
              <div className="bg-neutral-900/50 border border-white/10 p-6 rounded-2xl space-y-4">
                <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40 mb-4">Contact Details</h3>
                
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Mail className="w-4 h-4 opacity-60" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase">Email</p>
                    <p className="text-sm font-medium">{selectedItem.email || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <Phone className="w-4 h-4 opacity-60" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase">Phone</p>
                    <p className="text-sm font-medium">{selectedItem.phone || '—'}</p>
                  </div>
                </div>

                {viewMode === 'contacts' ? (
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      <MapPin className="w-4 h-4 opacity-60" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase">Location</p>
                      <p className="text-sm font-medium">
                        {[(selectedItem as Contact).location_city, (selectedItem as Contact).location_state, (selectedItem as Contact).location_country].filter(Boolean).join(', ') || '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                      <Building className="w-4 h-4 opacity-60" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase">Address</p>
                      <p className="text-sm font-medium whitespace-pre-wrap">{(selectedItem as Client).address || '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags & Meta */}
              <div className="bg-neutral-900/50 border border-white/10 p-6 rounded-2xl space-y-6">
                {viewMode === 'contacts' && (
                    <div>
                        <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40 mb-4">Tags</h3>
                        <div className="flex flex-wrap gap-2">
                        {(selectedItem as Contact).tags ? (selectedItem as Contact).tags!.split(',').map(tag => (
                            <span key={tag} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] uppercase font-bold tracking-wider">
                            {tag.trim()}
                            </span>
                        )) : <p className="text-xs opacity-30 italic">No tags</p>}
                        </div>
                    </div>
                )}
                 <div>
                    <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40 mb-4">Last Updated</h3>
                    <p className="text-xs font-mono opacity-60">
                        {selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleString() : 'Never'}
                    </p>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-neutral-900/50 border border-white/10 p-6 rounded-2xl">
              <h3 className="text-xs font-bold tracking-[0.2em] uppercase opacity-40 mb-4">Notes</h3>
              <div className="bg-black/50 border border-white/5 rounded-xl p-4 min-h-[150px]">
                <p className="whitespace-pre-wrap text-sm leading-relaxed opacity-80">
                  {(viewMode === 'contacts' ? (selectedItem as Contact).notes_general : (selectedItem as Client).notes) || 'No notes available.'}
                </p>
              </div>
            </div>

          </motion.div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-10 h-10" />
            </div>
            <p className="text-sm font-bold tracking-[0.3em] uppercase">Select a {viewMode === 'contacts' ? 'contact' : 'client'} to view details</p>
          </div>
        )}
      </div>

      {/* Edit/Add Modal */}
      <AnimatePresence>
        {isDialogOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsDialogOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-8"
            >
              <h2 className="text-2xl font-black uppercase tracking-tighter mb-8">
                {editingItem?.id ? 'Edit' : 'Add New'} {viewMode === 'contacts' ? 'Contact' : 'Client'}
              </h2>
              
              <form onSubmit={(e) => { e.preventDefault(); if(editingItem) handleSave(editingItem); }}>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Name *</label>
                            <input 
                                required
                                value={editingItem?.name || ''}
                                onChange={e => setEditingItem(p => ({ ...p, name: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Email</label>
                            <input 
                                type="email"
                                value={editingItem?.email || ''}
                                onChange={e => setEditingItem(p => ({ ...p, email: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Phone</label>
                            <input 
                                value={editingItem?.phone || ''}
                                onChange={e => setEditingItem(p => ({ ...p, phone: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm"
                            />
                        </div>
                        {viewMode === 'contacts' ? (
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Company / Studio</label>
                                <input 
                                    value={(editingItem as Contact)?.company_name || ''}
                                    onChange={e => setEditingItem(p => ({ ...p, company_name: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                />
                            </div>
                        ) : null}
                    </div>

                    {viewMode === 'contacts' && (
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Primary Role</label>
                            <input 
                                placeholder="E.G. PRODUCER, EDITOR..."
                                value={(editingItem as Contact)?.primary_role || ''}
                                onChange={e => setEditingItem(p => ({ ...p, primary_role: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                            />
                        </div>
                    )}

                    {viewMode === 'contacts' ? (
                        <div className="grid grid-cols-3 gap-4">
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">City</label>
                                <input 
                                    value={(editingItem as Contact)?.location_city || ''}
                                    onChange={e => setEditingItem(p => ({ ...p, location_city: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                />
                            </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">State</label>
                                <input 
                                    value={(editingItem as Contact)?.location_state || ''}
                                    onChange={e => setEditingItem(p => ({ ...p, location_state: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                />
                            </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Country</label>
                                <input 
                                    value={(editingItem as Contact)?.location_country || ''}
                                    onChange={e => setEditingItem(p => ({ ...p, location_country: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Address</label>
                            <textarea 
                                rows={2}
                                value={(editingItem as Client)?.address || ''}
                                onChange={e => setEditingItem(p => ({ ...p, address: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm resize-none"
                            />
                        </div>
                    )}

                    {viewMode === 'contacts' && (
                         <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">Tags</label>
                            <input 
                                placeholder="COMMA SEPARATED..."
                                value={(editingItem as Contact)?.tags || ''}
                                onChange={e => setEditingItem(p => ({ ...p, tags: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent uppercase text-sm"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-40">General Notes</label>
                        <textarea 
                            rows={4}
                            value={(viewMode === 'contacts' ? (editingItem as Contact)?.notes_general : (editingItem as Client)?.notes) || ''}
                            onChange={e => {
                                const val = e.target.value;
                                if (viewMode === 'contacts') setEditingItem(p => ({ ...p, notes_general: val }));
                                else setEditingItem(p => ({ ...p, notes: val }));
                            }}
                            className="w-full bg-white/5 border border-white/10 p-3 rounded-lg outline-none focus:border-accent text-sm resize-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-white/10">
                    <button 
                        type="button"
                        onClick={() => setIsDialogOpen(false)}
                        className="px-6 py-3 rounded-lg text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        className="px-8 py-3 bg-white text-black rounded-lg text-[10px] font-black tracking-[0.2em] uppercase hover:bg-accent hover:text-white transition-colors"
                    >
                        Save
                    </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--accent); }
      `}</style>
    </div>
  );
}