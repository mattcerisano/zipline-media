'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, Calendar, Clock, 
  Search, X, Edit2, Users, FileText
} from 'lucide-react';

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  attendees: string; // Comma separated or just text for now
  notes: string;
}

const STORAGE_KEY_MEETINGS = 'zipline_meetings';

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Partial<Meeting>>({});

  // Load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY_MEETINGS);
    if (saved) setMeetings(JSON.parse(saved));
  }, []);

  // Save
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings));
  }, [meetings]);

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.notes.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = () => {
    if (!editingMeeting.title) return;
    
    const payload = { ...editingMeeting } as Meeting;
    if (!payload.id) payload.id = crypto.randomUUID();

    setMeetings(prev => {
        const exists = prev.find(m => m.id === payload.id);
        return exists ? prev.map(m => m.id === payload.id ? payload : m) : [payload, ...prev];
    });
    
    setIsModalOpen(false);
    setEditingMeeting({});
  };

  const handleDelete = (id: string) => {
      if (confirm('Delete this meeting note?')) {
          setMeetings(prev => prev.filter(m => m.id !== id));
          setIsModalOpen(false);
      }
  };

  return (
    <div className="h-[calc(100vh-120px)] grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* List */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="flex justify-between items-center bg-white/5 p-2 rounded-xl border border-white/5">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input 
                  type="text" 
                  placeholder="SEARCH MEETINGS..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent py-2 pl-10 pr-4 outline-none text-sm font-bold uppercase tracking-widest placeholder:opacity-30"
                />
            </div>
            <button 
                onClick={() => { setEditingMeeting({ date: new Date().toISOString().split('T')[0] }); setIsModalOpen(true); }}
                className="bg-white text-black p-2 rounded-lg hover:bg-accent hover:text-white transition-colors"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {filteredMeetings.map(meeting => (
                <div 
                    key={meeting.id}
                    onClick={() => { setEditingMeeting(meeting); setIsModalOpen(true); }}
                    className="group bg-neutral-900/50 border border-white/5 p-4 rounded-xl hover:bg-white/5 hover:border-white/10 transition-all cursor-pointer"
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold tracking-widest opacity-40 font-mono">
                            {new Date(meeting.date).toLocaleDateString()}
                        </span>
                        {meeting.time && (
                            <div className="flex items-center gap-1 text-[10px] font-bold opacity-40">
                                <Clock className="w-3 h-3" /> {meeting.time}
                            </div>
                        )}
                    </div>
                    <h3 className="font-bold text-sm uppercase leading-tight mb-1 group-hover:text-accent transition-colors">{meeting.title}</h3>
                    {meeting.attendees && (
                        <div className="flex items-center gap-2 mt-3 opacity-60">
                            <Users className="w-3 h-3" />
                            <p className="text-[10px] uppercase tracking-wider truncate">{meeting.attendees}</p>
                        </div>
                    )}
                </div>
            ))}
            {filteredMeetings.length === 0 && (
                <div className="text-center py-12 opacity-30">
                    <FileText className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No meetings found</p>
                </div>
            )}
        </div>
      </div>

      {/* Editor / Details (Desktop) - Or just use Modal for simplicity since it's "quick access" */}
      <div className="hidden lg:block lg:col-span-2 bg-neutral-900/30 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center opacity-40">
          <FileText className="w-16 h-16 mb-4" />
          <h2 className="text-xl font-black uppercase tracking-tighter">Select a meeting to view details</h2>
      </div>

      {/* Modal */}
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
                    className="relative bg-neutral-900 border border-white/10 w-full max-w-2xl p-8 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
                >
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black uppercase tracking-tighter">{editingMeeting.id ? 'Edit Meeting' : 'New Meeting'}</h2>
                        <div className="flex gap-2">
                            {editingMeeting.id && (
                                <button onClick={() => handleDelete(editingMeeting.id!)} className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Topic / Title</label>
                            <input 
                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                                value={editingMeeting.title || ''}
                                onChange={e => setEditingMeeting({...editingMeeting, title: e.target.value})}
                                placeholder="MEETING TOPIC"
                                autoFocus
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Date</label>
                                <input 
                                    type="date"
                                    className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                                    value={editingMeeting.date || ''}
                                    onChange={e => setEditingMeeting({...editingMeeting, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Time</label>
                                <input 
                                    type="time"
                                    className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm font-bold"
                                    value={editingMeeting.time || ''}
                                    onChange={e => setEditingMeeting({...editingMeeting, time: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Attendees</label>
                            <input 
                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent uppercase text-sm"
                                value={editingMeeting.attendees || ''}
                                onChange={e => setEditingMeeting({...editingMeeting, attendees: e.target.value})}
                                placeholder="NAMES OR EMAILS"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 ml-1">Notes & Agenda</label>
                            <textarea 
                                rows={12}
                                className="w-full bg-black/50 border border-white/10 py-3 px-4 rounded-lg outline-none focus:border-accent text-sm leading-relaxed resize-none"
                                value={editingMeeting.notes || ''}
                                onChange={e => setEditingMeeting({...editingMeeting, notes: e.target.value})}
                                placeholder="• Agenda Item 1..."
                            />
                        </div>

                        <button 
                            onClick={handleSave}
                            disabled={!editingMeeting.title}
                            className="w-full bg-white text-black py-4 mt-4 font-black tracking-widest uppercase text-xs hover:bg-accent hover:text-white transition-all rounded-xl disabled:opacity-50"
                        >
                            Save Meeting
                        </button>
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
