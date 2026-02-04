import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Calendar, Clock,
  Search, X, Edit2, Users, FileText, Briefcase
} from 'lucide-react';
import { STORAGE_KEY_CLIENTS, Client } from './types';

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  client_name: string;
  notes: string;
}

const STORAGE_KEY_MEETINGS = 'zipline_meetings';

export default function Meetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);

  // Load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Load Meetings
    const savedMeetings = localStorage.getItem(STORAGE_KEY_MEETINGS);
    if (savedMeetings) {
        const loaded = JSON.parse(savedMeetings);
        setMeetings(loaded);
        if (loaded.length > 0 && !selectedMeetingId) {
            setSelectedMeetingId(loaded[0].id);
        }
    }

    // Load Clients
    const savedClients = localStorage.getItem(STORAGE_KEY_CLIENTS);
    if (savedClients) {
        setClients(JSON.parse(savedClients));
    }
  }, []);

  // Save
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (meetings.length > 0) {
        localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(meetings));
    }
  }, [meetings]);

  const filteredMeetings = meetings.filter(m => 
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.notes.toLowerCase().includes(search.toLowerCase()) ||
    m.client_name?.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeMeeting = useMemo(() => {
      return meetings.find(m => m.id === selectedMeetingId) || null;
  }, [meetings, selectedMeetingId]);

  const createMeeting = () => {
      const now = new Date();
      const newMeeting: Meeting = {
          id: crypto.randomUUID(),
          title: '',
          date: now.toISOString().split('T')[0],
          time: now.toTimeString().split(' ')[0].substring(0, 5),
          client_name: '',
          notes: ''
      };
      setMeetings(prev => [newMeeting, ...prev]);
      setSelectedMeetingId(newMeeting.id);
  };

  const updateMeeting = (id: string, updates: Partial<Meeting>) => {
      setMeetings(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDelete = (id: string) => {
      if (confirm('Delete this meeting note?')) {
          setMeetings(prev => prev.filter(m => m.id !== id));
          if (selectedMeetingId === id) setSelectedMeetingId(null);
      }
  };

  return (
    <div className="h-[calc(100vh-120px)] grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar List (Left) */}
      <div className="lg:col-span-4 flex flex-col gap-4 bg-neutral-900/30 border border-white/5 rounded-2xl p-4">
        <div className="flex justify-between items-center gap-2">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input 
                  type="text" 
                  placeholder="SEARCH NOTES..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 outline-none text-xs font-bold uppercase tracking-widest focus:border-accent transition-colors"
                />
            </div>
            <button 
                onClick={createMeeting}
                className="bg-white text-black p-3 rounded-xl hover:bg-accent hover:text-white transition-colors shadow-lg"
                title="New Meeting"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {filteredMeetings.length === 0 ? (
                <div className="text-center py-12 opacity-30 flex flex-col items-center">
                    <FileText className="w-8 h-8 mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No meetings found</p>
                </div>
            ) : (
                filteredMeetings.map(meeting => (
                    <div 
                        key={meeting.id}
                        onClick={() => setSelectedMeetingId(meeting.id)}
                        className={`group p-4 rounded-xl border transition-all cursor-pointer relative ${selectedMeetingId === meeting.id ? 'bg-white text-black border-white' : 'bg-neutral-900 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className={`font-bold text-sm truncate pr-6 ${selectedMeetingId === meeting.id ? 'text-black' : 'text-white group-hover:text-accent'}`}>{meeting.title || 'Untitled Meeting'}</h3>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(meeting.id); }}
                                className={`opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all absolute top-2 right-2 ${selectedMeetingId === meeting.id ? 'hover:bg-black/10 text-black/50' : 'hover:bg-white/20 text-white/40'}`}
                            >
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                        <div className={`flex items-center gap-3 text-[10px] font-bold tracking-widest ${selectedMeetingId === meeting.id ? 'opacity-60' : 'opacity-40'}`}>
                            <span className="font-mono">{new Date(meeting.date).toLocaleDateString()}</span>
                            {meeting.time && (
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {meeting.time}</span>
                            )}
                        </div>
                        {meeting.client_name && (
                            <div className={`flex items-center gap-1 mt-2 opacity-60`}>
                                <Briefcase className="w-3 h-3" />
                                <p className={`text-[10px] uppercase tracking-wider truncate`}>
                                    {meeting.client_name}
                                </p>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Editor (Right) */}
      <div className="lg:col-span-8 bg-neutral-900 border border-white/10 rounded-2xl p-8 flex flex-col h-full overflow-hidden">
          {activeMeeting ? (
              <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
                  {/* Metadata Header */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-white/5 pb-6">
                        <div className="col-span-2">
                            <input 
                                className="w-full bg-transparent text-3xl font-black uppercase tracking-tight outline-none placeholder:opacity-20"
                                value={activeMeeting.title}
                                onChange={(e) => updateMeeting(activeMeeting.id, { title: e.target.value })}
                                placeholder="Meeting Topic"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 opacity-40 shrink-0" />
                                <input 
                                    type="date"
                                    className="bg-transparent outline-none text-sm font-bold uppercase tracking-wider opacity-80 focus:opacity-100 w-full"
                                    value={activeMeeting.date}
                                    onChange={(e) => updateMeeting(activeMeeting.id, { date: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="w-4 h-4 opacity-40 shrink-0" />
                                <input 
                                    type="time"
                                    className="bg-transparent outline-none text-sm font-bold uppercase tracking-wider opacity-80 focus:opacity-100 w-full"
                                    value={activeMeeting.time}
                                    onChange={(e) => updateMeeting(activeMeeting.id, { time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Briefcase className="w-4 h-4 opacity-40 shrink-0" />
                                <select 
                                    className="bg-transparent outline-none text-sm font-medium opacity-80 focus:opacity-100 w-full appearance-none cursor-pointer"
                                    value={activeMeeting.client_name}
                                    onChange={(e) => updateMeeting(activeMeeting.id, { client_name: e.target.value })}
                                >
                                    <option value="" className="bg-neutral-900">-- Select Client --</option>
                                    {clients.map(c => (
                                        <option key={c.id} value={c.name} className="bg-neutral-900">{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                  </div>

                  {/* Notes Editor Area */}
                  <div className="flex-1 relative">
                      <textarea 
                          className="w-full h-full bg-transparent outline-none text-base leading-relaxed resize-none custom-scrollbar placeholder:opacity-20"
                          value={activeMeeting.notes}
                          onChange={(e) => updateMeeting(activeMeeting.id, { notes: e.target.value })}
                          placeholder="Start typing meeting notes..."
                      />
                  </div>
              </div>
          ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Select a meeting or create new</p>
              </div>
          )}
      </div>
    </div>
  );
}