'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Contact } from '@/components/gearbuilder/types';

type SortField = 'name' | 'primary_role';
type SortOrder = 'asc' | 'desc';

export default function Rolodex() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [selectedContactHistory, setSelectedContactHistory] = useState<{job_title: string, shoot_date: string, position: string, rate?: number, notes?: string}[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');
      if (error) throw error;
      setContacts(data as Contact[]);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContactHistory = async (contactId: string) => {
    try {
      const { data, error } = await supabase
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
      
      if (error) throw error;
      
      const formatted = (data as any[]).map((r) => ({
        job_title: r.job.title,
        shoot_date: r.job.shoot_date,
        position: r.position,
        rate: r.day_rate,
        notes: r.notes
      })).sort((a, b) => new Date(b.shoot_date).getTime() - new Date(a.shoot_date).getTime());
      
      setSelectedContactHistory(formatted);
      setIsHistoryOpen(true);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredContacts = useMemo(() => {
    let result = contacts.filter(c => 
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
  }, [contacts, searchQuery, sortField, sortOrder]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?.name || !editingContact?.email) {
      alert('Name and Email are required');
      return;
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .upsert(editingContact);
      if (error) throw error;
      
      setIsModalOpen(false);
      fetchContacts();
    } catch (err) {
      console.error('Error saving contact:', err);
      alert('Failed to save contact');
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
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', id);
      if (error) throw error;
      setContacts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Error deleting contact:', err);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
          <input 
            type="text"
            placeholder="SEARCH THE ROLODEX..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-900/40 border border-white/10 p-4 pl-12 rounded-2xl outline-none focus:border-accent transition-all uppercase text-xs font-bold tracking-widest text-white"
          />
        </div>
        <button 
          onClick={() => {
            setEditingContact({
              name: '',
              email: '',
              primary_role: '',
              is_favorite: false
            });
            setIsModalOpen(true);
          }}
          className="bg-accent text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 flex items-center gap-3 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      <div className="bg-neutral-900/40 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th 
                className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                   Contact <SortIcon field="name" />
                </div>
              </th>
              <th 
                className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 cursor-pointer hover:opacity-100 transition-opacity"
                onClick={() => handleSort('primary_role')}
              >
                <div className="flex items-center gap-2">
                   Primary Role <SortIcon field="primary_role" />
                </div>
              </th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 hidden md:table-cell text-white">Contact Info</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 hidden lg:table-cell text-white">Tags</th>
              <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest opacity-40 text-white">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredContacts.map(contact => (
              <tr key={contact.id} className="group hover:bg-white/[0.02] transition-colors text-white">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => toggleFavorite(contact)}
                      className={`transition-colors ${contact.is_favorite ? 'text-yellow-500' : 'text-white/10 hover:text-white/40'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${contact.is_favorite ? 'fill-current' : ''}`} />
                    </button>
                    <span className="text-sm font-black uppercase tracking-tight">{contact.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{contact.primary_role || '—'}</span>
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
                      <span key={tag} className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-black uppercase tracking-widest opacity-30">
                        {tag.trim()}
                      </span>
                    )) || '—'}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-1">
                    <button 
                      onClick={() => fetchContactHistory(contact.id)}
                      className="p-2 text-white/10 hover:text-accent hover:bg-accent/5 rounded-lg transition-all"
                      title="Work History"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => { setEditingContact(contact); setIsModalOpen(true); }}
                      className="p-2 text-white/10 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => deleteContact(contact.id)}
                      className="p-2 text-white/10 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Work History</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent mt-1">Contractor Utilization & Rates</p>
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
                          <p className="text-sm font-black uppercase tracking-tight group-hover:text-accent transition-colors">{entry.job_title}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{entry.position}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{entry.shoot_date}</p>
                          {entry.rate && (
                             <div className="flex items-center gap-1 text-green-500 mt-1 justify-end">
                                <DollarSign className="w-3 h-3" />
                                <span className="text-[11px] font-black">{entry.rate}</span>
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
                    <p className="text-xs font-bold uppercase tracking-widest">No previous jobs recorded.</p>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center">
                 <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 text-white">Yearly Summary</p>
                    <p className="text-xs font-black uppercase tracking-widest text-white">
                       Total Jobs: <span className="text-accent">{selectedContactHistory.length}</span>
                    </p>
                 </div>
                 <button 
                   onClick={() => setIsHistoryOpen(false)}
                   className="bg-accent text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all"
                 >
                   Close
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-neutral-900 border border-white/10 rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                  {editingContact?.id ? 'Edit Contact' : 'New Contact'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={editingContact?.name || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, name: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold uppercase text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Email Address</label>
                  <input 
                    required
                    type="email"
                    value={editingContact?.email || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, email: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Phone</label>
                  <input 
                    type="text"
                    value={editingContact?.phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, phone: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold text-sm text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Primary Role</label>
                  <input 
                    type="text"
                    value={editingContact?.primary_role || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, primary_role: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold uppercase text-sm text-white"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1 text-white">Notes</label>
                  <textarea 
                    value={editingContact?.notes_general || ''}
                    onChange={(e) => setEditingContact({ ...editingContact!, notes_general: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-bold text-sm h-32 text-white"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-4 mt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs border border-white/10 hover:bg-white/5 transition-all text-white"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-accent text-white px-12 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20"
                  >
                    Save Contact
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
