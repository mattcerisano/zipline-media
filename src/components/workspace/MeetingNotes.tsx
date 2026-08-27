'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Sparkles, 
  Mic, 
  MicOff, 
  Square, 
  Check, 
  Calendar, 
  MapPin, 
  Users, 
  Smile, 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Save, 
  Cloud, 
  CloudOff, 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  CheckSquare, 
  X,
  SmilePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// Note Type Definition
interface MeetingNote {
  id: string;
  client_id: string;
  title: string;
  content: string;
  meeting_date: string;
  sentiment: 'great' | 'neutral' | 'challenging' | 'outstanding';
  attendees: string[];
  action_items: { id: string; text: string; completed: boolean; due_date?: string }[];
  metadata: {
    platform?: string;
    objective?: string;
    ai_summary?: string;
  };
  scratchpad: string;
  created_at?: string;
}

interface Client {
  id: string;
  name: string;
}

export default function MeetingNotes() {
  // State variables
  const [clients, setClients] = useState<Client[]>([]);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [useLocalStorage, setUseLocalStorage] = useState(false);
  
  // Client selection for new note modal
  const [isNewNoteModalOpen, setIsNewNoteModalOpen] = useState(false);
  const [selectedClientForNewNote, setSelectedClientForNewNote] = useState<string>('');
  const [newNoteTitle, setNewNoteTitle] = useState('');

  // Sidebar expanded clients state
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});

  // Widget States for active note
  const [newAttendee, setNewAttendee] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  
  // AI summarizer state
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioTranscript, setAudioTranscript] = useState<string | null>(null);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for note content text area for inserting formatting
  const editorRef = useRef<HTMLTextAreaElement | null>(null);

  // Load clients and notes on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Sync active note changes back to DB / local storage
  const activeNote = notes.find(n => n.id === selectedNoteId) || null;

  // Auto-save effect
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (activeNote) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveNoteToStorage(activeNote);
      }, 800); // Debounce saves by 800ms
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [
    activeNote?.title, 
    activeNote?.content, 
    activeNote?.meeting_date, 
    activeNote?.sentiment, 
    activeNote?.attendees, 
    activeNote?.action_items, 
    activeNote?.metadata, 
    activeNote?.scratchpad
  ]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  // Fetch clients & notes from Supabase or LocalStorage fallback
  const fetchInitialData = async () => {
    setIsLoading(true);
    let loadedClients: Client[] = [];
    let loadedNotes: MeetingNote[] = [];
    let fallbackToLocal = false;

    // 1. Fetch Clients
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      
      if (clientError) throw clientError;
      loadedClients = clientData || [];
    } catch (err) {
      console.warn('Failed to fetch clients from database, using local mock/fallback:', err);
      // Fallback local mock clients if Supabase fails
      loadedClients = [
        { id: 'client-1', name: 'Zipline Productions' },
        { id: 'client-2', name: 'Broadway Reels Inc' },
        { id: 'client-3', name: 'Showtime Media' },
        { id: 'client-4', name: 'Revelations Marketing' }
      ];
    }

    // 2. Fetch Notes from Supabase
    try {
      const { data: noteData, error: noteError } = await supabase
        .from('meeting_notes')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (noteError) throw noteError;
      loadedNotes = noteData || [];
      setUseLocalStorage(false);
    } catch (err) {
      console.warn('Meeting notes table not found or query failed. Falling back to local storage.');
      fallbackToLocal = true;
      setUseLocalStorage(true);
    }

    if (fallbackToLocal) {
      const localNotesStr = localStorage.getItem('studio_meeting_notes_local');
      if (localNotesStr) {
        try {
          loadedNotes = JSON.parse(localNotesStr);
        } catch (e) {
          loadedNotes = [];
        }
      } else {
        // Populate default notes if empty
        loadedNotes = [
          {
            id: 'note-default-1',
            client_id: loadedClients[0]?.id || 'client-1',
            title: 'Q3 Brand Kickoff Meeting',
            content: `# Q3 Kickoff & Strategy Session\n\nWe aligned on the production timeline for the Q3 brand commercials. The client wants a premium, cinematic feel with dynamic camera movement.\n\n## Discussion Points\n- Brand objectives and target audience definition.\n- Choosing locations (on-set studio vs. downtown b-roll).\n- Script iterations and storyboards approval deadline.\n\n## Creative Mood\n- Sleek dark theme look\n- High-contrast neon lighting accents`,
            meeting_date: new Date().toISOString(),
            sentiment: 'outstanding',
            attendees: ['Matt Cerisano', 'Sarah Jenkins (Client)', 'David Miller (DP)'],
            action_items: [
              { id: 'act-1', text: 'Lock script draft v3', completed: true, due_date: '2026-06-25' },
              { id: 'act-2', text: 'Confirm location rental scouting', completed: false, due_date: '2026-06-28' },
              { id: 'act-3', text: 'Send crew gear templates', completed: false, due_date: '2026-06-30' }
            ],
            metadata: {
              platform: 'Zoom',
              objective: 'Establish Q3 creative vision and secure production shoot dates.',
              ai_summary: '**Summary:** A productive kickoff meeting where the core creative direction for the Q3 brand reel was locked.\n\n**Key Decisions:**\n- Theme: Cinematic High-Contrast Dark Mode.\n- Locations: 1 Day Studio, 1 Day Outdoor Downtown.\n\n**Next Steps:** Confirm DP availability and finalize location scout.'
            },
            scratchpad: 'DP Contact: 555-0192 (David)\nNeed to crosscheck rental inventory for ARRI Alexa 35.'
          }
        ];
        localStorage.setItem('studio_meeting_notes_local', JSON.stringify(loadedNotes));
      }
    }

    setClients(loadedClients);
    setNotes(loadedNotes);
    
    // Auto-expand clients that have notes
    const expansions: Record<string, boolean> = {};
    loadedNotes.forEach(note => {
      expansions[note.client_id] = true;
    });
    setExpandedClients(expansions);

    if (loadedNotes.length > 0) {
      setSelectedNoteId(loadedNotes[0].id);
    }

    setIsLoading(false);
  };

  // Save a single note back to Supabase or Local Storage
  const saveNoteToStorage = async (updatedNote: MeetingNote) => {
    setIsSaving(true);
    
    if (useLocalStorage) {
      // Save to localStorage
      const updatedNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
      localStorage.setItem('studio_meeting_notes_local', JSON.stringify(updatedNotes));
      setIsSaving(false);
    } else {
      // Save to Supabase
      try {
        const { error } = await supabase
          .from('meeting_notes')
          .upsert({
            id: updatedNote.id,
            client_id: updatedNote.client_id,
            title: updatedNote.title,
            content: updatedNote.content,
            meeting_date: updatedNote.meeting_date,
            sentiment: updatedNote.sentiment,
            attendees: updatedNote.attendees,
            action_items: updatedNote.action_items,
            metadata: updatedNote.metadata,
            scratchpad: updatedNote.scratchpad,
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      } catch (err) {
        console.error('Failed to sync note to Supabase. Gracefully falling back to local storage update:', err);
        // Fall back to updating local storage as safety net
        const updatedNotes = notes.map(n => n.id === updatedNote.id ? updatedNote : n);
        localStorage.setItem('studio_meeting_notes_local', JSON.stringify(updatedNotes));
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Create a new note
  const handleCreateNote = async () => {
    if (!selectedClientForNewNote) return;

    const newNote: MeetingNote = {
      id: 'note_' + Date.now(),
      client_id: selectedClientForNewNote,
      title: newNoteTitle.trim() || 'New Meeting Note',
      content: `# ${newNoteTitle.trim() || 'New Meeting Note'}\n\n*Write your meeting details here…*`,
      meeting_date: new Date().toISOString(),
      sentiment: 'neutral',
      attendees: [],
      action_items: [],
      metadata: {
        platform: 'Google Meet',
        objective: ''
      },
      scratchpad: ''
    };

    const updatedNotes = [newNote, ...notes];
    setNotes(updatedNotes);
    setSelectedNoteId(newNote.id);

    // Expand the client in sidebar
    setExpandedClients(prev => ({ ...prev, [newNote.client_id]: true }));

    // Persist immediately
    await saveNoteToStorage(newNote);

    // Reset form states
    setNewNoteTitle('');
    setIsNewNoteModalOpen(false);
  };

  // Delete a note
  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this meeting note?')) return;

    const updatedNotes = notes.filter(n => n.id !== id);
    setNotes(updatedNotes);

    if (selectedNoteId === id) {
      setSelectedNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null);
    }

    if (useLocalStorage) {
      localStorage.setItem('studio_meeting_notes_local', JSON.stringify(updatedNotes));
    } else {
      try {
        await supabase
          .from('meeting_notes')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.error('Failed to delete note from Supabase:', err);
      }
    }
  };

  // Update fields on the currently active note
  const updateActiveNote = (patch: Partial<MeetingNote>) => {
    if (!selectedNoteId) return;
    setNotes(prev => prev.map(n => {
      if (n.id === selectedNoteId) {
        return { ...n, ...patch };
      }
      return n;
    }));
  };

  const updateActiveNoteMetadata = (patch: Record<string, any>) => {
    if (!activeNote) return;
    updateActiveNote({
      metadata: {
        ...activeNote.metadata,
        ...patch
      }
    });
  };

  // Inline styling toggle helpers for markdown editor
  const insertFormatting = (syntaxStart: string, syntaxEnd: string = '') => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = syntaxStart + selectedText + syntaxEnd;

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    updateActiveNote({ content: newContent });

    // Refocus and reselect text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + syntaxStart.length, start + syntaxStart.length + selectedText.length);
    }, 0);
  };

  // Attendee Handlers
  const addAttendee = () => {
    if (!activeNote || !newAttendee.trim()) return;
    const trimmed = newAttendee.trim();
    if (!activeNote.attendees.includes(trimmed)) {
      updateActiveNote({
        attendees: [...activeNote.attendees, trimmed]
      });
    }
    setNewAttendee('');
  };

  const removeAttendee = (name: string) => {
    if (!activeNote) return;
    updateActiveNote({
      attendees: activeNote.attendees.filter(a => a !== name)
    });
  };

  // Action Item Handlers
  const addActionItem = () => {
    if (!activeNote || !newActionItem.trim()) return;
    const newItem = {
      id: 'act_' + Date.now(),
      text: newActionItem.trim(),
      completed: false,
      due_date: newActionDueDate || undefined
    };
    updateActiveNote({
      action_items: [...activeNote.action_items, newItem]
    });
    setNewActionItem('');
    setNewActionDueDate('');
  };

  const toggleActionItem = (id: string) => {
    if (!activeNote) return;
    updateActiveNote({
      action_items: activeNote.action_items.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    });
  };

  const removeActionItem = (id: string) => {
    if (!activeNote) return;
    updateActiveNote({
      action_items: activeNote.action_items.filter(item => item.id !== id)
    });
  };

  // Simulated AI Summarizer logic
  const handleAISummarize = () => {
    if (!activeNote) return;
    setIsSummarizing(true);
    
    // Simulate thinking delay
    setTimeout(() => {
      const text = activeNote.content || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      
      // Extraction heuristics
      const headings = lines.filter(l => l.startsWith('#')).map(l => l.replace(/#/g, '').trim());
      const bullets = lines.filter(l => l.startsWith('-') || l.startsWith('*')).map(l => l.substring(1).trim());
      
      const topic = activeNote.title || 'the client briefing';
      let summary = `**AI Meeting Summary for ${topic}**\n\n`;
      summary += `*Generated automatically from note context.*\n\n`;
      
      summary += `### Key Themes & Focus:\n`;
      if (headings.length > 0) {
        headings.slice(0, 3).forEach(h => {
          summary += `- **${h}**: Addressed core guidelines and creative criteria.\n`;
        });
      } else {
        summary += `- **Creative Sync**: Aligned on project deliverables and execution roadmap.\n`;
        summary += `- **Strategic Review**: Discussed client feedback and visual objectives.\n`;
      }
      
      summary += `\n### Key Takeaways:\n`;
      if (bullets.length > 0) {
        bullets.slice(0, 3).forEach(b => {
          summary += `- Aligned on: *"${b}"*\n`;
        });
      } else {
        summary += `- Locked down the stylistic theme and branding requirements.\n`;
        summary += `- Clarified deadlines for post-production and final delivery review.\n`;
      }

      summary += `\n### Decisions & Actions:\n`;
      const uncompletedItems = activeNote.action_items.filter(i => !i.completed);
      if (uncompletedItems.length > 0) {
        uncompletedItems.forEach(item => {
          summary += `- [ ] **Pending Action**: ${item.text} ${item.due_date ? `(Due ${item.due_date})` : ''}\n`;
        });
      } else {
        summary += `- [ ] Finalize production contract paperwork.\n`;
        summary += `- [ ] Book technical equipment and scheduling.\n`;
      }

      updateActiveNoteMetadata({ ai_summary: summary });
      setIsSummarizing(false);
    }, 2000);
  };

  // Simulated Audio Voice Recorder & Transcript Generator
  const startVoiceRecording = () => {
    setIsRecording(true);
    setAudioTranscript(null);
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    
    // Simulate generation of a highly relevant transcript based on note title/content
    const topic = activeNote?.title || 'the production';
    setTimeout(() => {
      const mockTranscripts = [
        `"Hey team, let's make sure we lock in the crew schedules by Friday. The client is really keen on getting the cinematic dark mode lighting absolutely perfect for the A-roll. We should also check the rentals and confirm the ARRI Alexa kit availability. Let's touch base tomorrow."`,
        `"Alright, so the client approved the script concept. They want the b-roll to feel fast-paced, urban, and modern. We need to scout locations in the downtown plaza. Sarah mentioned they need the first cuts by the end of next week, so let's push the edits quickly."`,
        `"Regarding the budget, we are on track. Let's follow up on the outstanding invoices before we kick off the second day of the shoot. Also, let's schedule a pre-production meeting with the DP next Tuesday at ten AM."`
      ];
      const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
      setAudioTranscript(randomTranscript);
      setShowTranscriptModal(true);
    }, 600);
  };

  const appendTranscriptToNote = () => {
    if (!activeNote || !audioTranscript) return;
    const divider = activeNote.content ? '\n\n' : '';
    updateActiveNote({
      content: activeNote.content + divider + `> 🎙️ **Voice Memo Transcript:**\n> *${audioTranscript}*`
    });
    setAudioTranscript(null);
    setShowTranscriptModal(false);
  };

  // Word & Character counters
  const getWordCount = (str: string) => {
    if (!str.trim()) return 0;
    return str.trim().split(/\s+/).length;
  };

  const getCharacterCount = (str: string) => {
    return str.length;
  };

  // Format time in mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Filter clients and notes based on search query
  const filteredClients = clients.filter(client => {
    const matchesClientName = client.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Check if any note of this client matches title or content
    const clientNotes = notes.filter(n => n.client_id === client.id);
    const matchesNotes = clientNotes.some(note => 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return matchesClientName || matchesNotes;
  });

  return (
    <div className="flex h-full bg-neutral-950 text-white font-sans overflow-hidden">
      {/* ═══════════════════════ SIDEBAR: CLIENTS & NOTES ═══════════════════════ */}
      <div className="w-80 border-r border-white/10 bg-zinc-900/30 flex flex-col h-full shrink-0">
        {/* Search & Action Area */}
        <div className="p-4 border-b border-white/10 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input 
              type="text"
              placeholder="Search notes or clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 pl-9 pr-4 py-2 rounded-xl text-xs font-semibold outline-none focus:border-accent text-white"
            />
          </div>
          <button
            onClick={() => {
              if (clients.length > 0) {
                setSelectedClientForNewNote(clients[0].id);
              }
              setIsNewNoteModalOpen(true);
            }}
            className="w-full bg-accent hover:bg-white hover:text-black text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent/10 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Meeting Note
          </button>
        </div>

        {/* Dynamic Client Note Tree */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-white/40 gap-2">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Syncing workspaces…</span>
            </div>
          ) : filteredClients.length > 0 ? (
            filteredClients.map(client => {
              const clientNotes = notes.filter(n => n.client_id === client.id).filter(note => 
                note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.name.toLowerCase().includes(searchQuery.toLowerCase())
              );
              const isExpanded = !!expandedClients[client.id];
              const hasNotes = clientNotes.length > 0;

              return (
                <div key={client.id} className="bg-white/[0.01] border border-white/5 rounded-xl overflow-hidden transition-all">
                  {/* Client Header Item */}
                  <button
                    onClick={() => setExpandedClients(prev => ({ ...prev, [client.id]: !isExpanded }))}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="w-4 h-4 text-accent shrink-0" />
                      <span className="text-xs font-black tracking-tight text-white uppercase truncate">{client.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] md:text-[9px] font-black bg-white/5 border border-white/5 text-white/50 px-1.5 py-0.5 rounded-full shrink-0">
                        {clientNotes.length}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                    </div>
                  </button>

                  {/* Note Subtree */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden bg-black/20 border-t border-white/5"
                      >
                        <div className="p-1.5 space-y-1">
                          {hasNotes ? (
                            clientNotes.map(note => {
                              const isSelected = note.id === selectedNoteId;
                              return (
                                <div
                                  key={note.id}
                                  onClick={() => setSelectedNoteId(note.id)}
                                  className={`group w-full px-3 py-2.5 rounded-lg flex items-center justify-between transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'bg-accent/15 border border-accent/25 text-white' 
                                      : 'border border-transparent hover:bg-white/5 text-white/65'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold truncate tracking-tight">{note.title || 'Untitled Note'}</p>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      <Clock className="w-3 h-3 text-white/30 shrink-0" />
                                      <span className="text-[11px] md:text-[9px] font-bold text-white/30 shrink-0">
                                        {new Date(note.meeting_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => handleDeleteNote(note.id, e)}
                                    className="p-1 hover:bg-red-500/10 rounded text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0 ml-2"
                                    title="Delete meeting note"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="py-3 px-4 text-[10px] text-white/30 italic font-medium">
                              No meeting notes recorded.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-white/30 text-xs font-semibold uppercase tracking-wider">
              No matching clients found
            </div>
          )}
        </div>

        {/* Sync Status Banner */}
        <div className="p-3 bg-black/40 border-t border-white/10 flex items-center justify-between text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/40">
          <div className="flex items-center gap-1.5">
            {useLocalStorage ? <CloudOff className="w-3.5 h-3.5 text-yellow-500" /> : <Cloud className="w-3.5 h-3.5 text-green-400" />}
            <span>{useLocalStorage ? 'Local Sandbox Mode' : 'Cloud Synchronized'}</span>
          </div>
          {isSaving && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
              <span>Saving…</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════ MAIN NOTE WORKSPACE AREA ═══════════════════════ */}
      <div className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden relative">
        {activeNote ? (
          <div className="flex-1 flex overflow-hidden">
            {/* COLUMN 1: MARKDOWN NOTE EDITOR (60% Width) */}
            <div className="flex-1 flex flex-col border-r border-white/10 h-full overflow-hidden">
              {/* Editor Header */}
              <div className="p-6 border-b border-white/10 flex flex-col gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-accent/15 border border-accent/20 text-[11px] md:text-[9px] font-black uppercase tracking-widest text-accent shrink-0">
                    {clients.find(c => c.id === activeNote.client_id)?.name || 'Client'}
                  </span>
                  <span className="text-[10px] font-medium text-white/30 shrink-0">|</span>
                  <div className="flex items-center gap-1 text-[11px] md:text-[9px] font-bold text-white/40 uppercase tracking-wider">
                    <Save className="w-3.5 h-3.5 text-white/30" />
                    <span>Autosaved</span>
                  </div>
                </div>

                <input 
                  type="text"
                  value={activeNote.title}
                  onChange={(e) => updateActiveNote({ title: e.target.value })}
                  placeholder="Note Title"
                  className="w-full bg-transparent text-2xl font-black tracking-tight text-white outline-none border-b border-transparent focus:border-white/10 pb-1"
                />
              </div>

              {/* Formatting Toolbar */}
              <div className="px-6 py-2 border-b border-white/10 bg-black/20 flex items-center gap-1 flex-wrap shrink-0">
                <button 
                  onClick={() => insertFormatting('# ', '\n')}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Header 1"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => insertFormatting('## ', '\n')}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Header 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button 
                  onClick={() => insertFormatting('**', '**')}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => insertFormatting('*', '*')}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <button 
                  onClick={() => insertFormatting('- ', '\n')}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Bulleted List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => insertFormatting('- [ ] ', '\n')}
                  className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
                  title="Task Checklist"
                >
                  <CheckSquare className="w-4 h-4" />
                </button>
              </div>

              {/* Text Writing Area */}
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col bg-neutral-900/10">
                <textarea
                  ref={editorRef}
                  value={activeNote.content}
                  onChange={(e) => updateActiveNote({ content: e.target.value })}
                  placeholder="Start jotting down meeting minutes here (supports markdown headers and bullet styles)…"
                  className="w-full flex-1 bg-transparent resize-none outline-none border-none text-sm text-white/80 leading-relaxed font-mono custom-scrollbar placeholder:text-white/20"
                />
              </div>

              {/* Editor Footer / Info */}
              <div className="px-6 py-3 border-t border-white/10 bg-black/20 flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-widest shrink-0">
                <div className="flex items-center gap-4">
                  <span>Words: {getWordCount(activeNote.content)}</span>
                  <span>Characters: {getCharacterCount(activeNote.content)}</span>
                </div>
                <span>Markdown Notepad</span>
              </div>
            </div>

            {/* COLUMN 2: WIDGETS STACK (40% Width) */}
            <div className="w-96 flex flex-col h-full overflow-y-auto custom-scrollbar p-6 bg-zinc-900/15 divide-y divide-white/10 shrink-0">
              
              {/* WIDGET 1: MEETING METADATA & SENTIMENT */}
              <div className="pb-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> Meeting Details
                  </h3>
                  {/* Sentiment reaction badge */}
                  <div className="flex items-center gap-1" title="Meeting Sentiment">
                    {activeNote.sentiment === 'outstanding' && <span className="text-sm">🚀</span>}
                    {activeNote.sentiment === 'great' && <span className="text-sm">😃</span>}
                    {activeNote.sentiment === 'neutral' && <span className="text-sm">😐</span>}
                    {activeNote.sentiment === 'challenging' && <span className="text-sm">⚠️</span>}
                    <span className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/50">{activeNote.sentiment}</span>
                  </div>
                </div>

                <div className="space-y-3 bg-black/20 p-4 border border-white/5 rounded-2xl">
                  {/* Date Picker */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Date & Time
                    </label>
                    <input 
                      type="datetime-local"
                      value={activeNote.meeting_date.slice(0, 16)}
                      onChange={(e) => updateActiveNote({ meeting_date: new Date(e.target.value).toISOString() })}
                      className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-accent cursor-pointer"
                    />
                  </div>

                  {/* Platform Picker */}
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Platform
                    </label>
                    <select
                      value={activeNote.metadata.platform || 'Google Meet'}
                      onChange={(e) => updateActiveNoteMetadata({ platform: e.target.value })}
                      className="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-accent cursor-pointer"
                    >
                      <option value="Google Meet">Google Meet</option>
                      <option value="Zoom">Zoom Meeting</option>
                      <option value="Phone Call">Phone Call</option>
                      <option value="In-Person">In Person</option>
                      <option value="Discord Channel">Discord Audio</option>
                    </select>
                  </div>

                  {/* Objective Input */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-white/40 block">Meeting Objective</label>
                    <input 
                      type="text"
                      value={activeNote.metadata.objective || ''}
                      onChange={(e) => updateActiveNoteMetadata({ objective: e.target.value })}
                      placeholder="e.g. Brainstorm storyboard or lock contract"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white placeholder:text-white/20 outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {/* Sentiment Selector */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-wider text-white/40 flex items-center gap-1">
                    <SmilePlus className="w-3.5 h-3.5" /> Log Client Sentiment
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { val: 'outstanding', label: 'Outstanding', emoji: '🚀' },
                      { val: 'great', label: 'Great', emoji: '😃' },
                      { val: 'neutral', label: 'Neutral', emoji: '😐' },
                      { val: 'challenging', label: 'Challenging', emoji: '⚠️' }
                    ].map(item => {
                      const isActive = activeNote.sentiment === item.val;
                      return (
                        <button
                          key={item.val}
                          onClick={() => updateActiveNote({ sentiment: item.val as any })}
                          className={`py-2 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                            isActive
                              ? 'bg-accent/15 border-accent/40 text-white shadow-md shadow-accent/5 scale-105'
                              : 'bg-black/20 border-white/5 text-white/50 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <span className="text-base">{item.emoji}</span>
                          <span className="text-[11px] md:text-[7px] font-black uppercase tracking-wider">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* WIDGET 2: ATTENDEES (PEOPLE PRESETS) */}
              <div className="py-6 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Attendees
                </h3>
                
                {/* List of Attendees */}
                <div className="flex flex-wrap gap-1.5">
                  {activeNote.attendees.length > 0 ? (
                    activeNote.attendees.map(name => (
                      <span 
                        key={name} 
                        className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-white flex items-center gap-1.5"
                      >
                        {name}
                        <button 
                          onClick={() => removeAttendee(name)}
                          className="hover:text-red-400 font-bold transition-colors cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-white/30 italic font-medium">No attendees recorded.</span>
                  )}
                </div>

                {/* Quick Add Attendees */}
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newAttendee}
                    onChange={(e) => setNewAttendee(e.target.value)}
                    placeholder="Add attendee name…"
                    onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
                    className="flex-grow bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                  />
                  <button 
                    onClick={addAttendee}
                    className="px-3.5 bg-white/10 hover:bg-white hover:text-black rounded-xl text-xs font-bold transition-all border border-white/10 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* WIDGET 3: INTERACTIVE ACTION ITEMS / CHECKLIST */}
              <div className="py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5" /> Action Items
                  </h3>
                  <span className="text-[11px] md:text-[9px] font-black uppercase bg-accent/15 border border-accent/25 text-accent px-2 py-0.5 rounded-full">
                    {activeNote.action_items.filter(i => i.completed).length} of {activeNote.action_items.length} done
                  </span>
                </div>

                {/* List of Tasks */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                  {activeNote.action_items.length > 0 ? (
                    activeNote.action_items.map(item => (
                      <div 
                        key={item.id}
                        className={`flex items-start justify-between gap-3 p-3 bg-black/25 border border-white/5 rounded-2xl group transition-all ${
                          item.completed ? 'opacity-45' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            onClick={() => toggleActionItem(item.id)}
                            className="p-0.5 text-white/50 hover:text-accent shrink-0 cursor-pointer"
                          >
                            <div className={`w-4.5 h-4.5 border rounded-md flex items-center justify-center transition-all ${
                              item.completed ? 'bg-accent border-accent text-white' : 'border-white/30 bg-black/20'
                            }`}>
                              {item.completed && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </button>
                          <div className="min-w-0">
                            <p className={`text-xs font-bold leading-tight ${item.completed ? 'line-through text-white/40' : 'text-white'}`}>
                              {item.text}
                            </p>
                            {item.due_date && (
                              <span className="text-[11px] md:text-[8px] font-bold text-white/30 block mt-1">
                                Due {new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeActionItem(item.id)}
                          className="p-1 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded cursor-pointer shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-white/30 italic font-medium py-3 text-center border border-dashed border-white/10 rounded-2xl">
                      No pending action items.
                    </p>
                  )}
                </div>

                {/* Add Task Area */}
                <div className="space-y-2 bg-black/15 p-3 border border-white/5 rounded-2xl">
                  <input 
                    type="text"
                    value={newActionItem}
                    onChange={(e) => setNewActionItem(e.target.value)}
                    placeholder="Enter new task description…"
                    onKeyDown={(e) => e.key === 'Enter' && addActionItem()}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-medium text-white outline-none focus:border-accent"
                  />
                  <div className="flex gap-2 justify-between items-center">
                    <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl px-2 py-1 shrink-0">
                      <Calendar className="w-3 h-3 text-white/40" />
                      <input 
                        type="date"
                        value={newActionDueDate}
                        onChange={(e) => setNewActionDueDate(e.target.value)}
                        className="bg-transparent text-[11px] md:text-[8px] font-black text-white/70 outline-none border-none cursor-pointer w-20 uppercase tracking-wider"
                      />
                    </div>
                    <button 
                      onClick={addActionItem}
                      className="bg-accent hover:bg-white hover:text-black text-white px-4 py-1.5 rounded-xl text-[11px] md:text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border border-accent"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              </div>

              {/* WIDGET 4: CO-PILOT AI SUMMARIZER CARD */}
              <div className="py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI Executive Summary
                  </h3>
                  <button
                    onClick={handleAISummarize}
                    disabled={isSummarizing || !activeNote.content}
                    className="bg-purple-600/10 hover:bg-purple-600 border border-purple-500/20 text-purple-400 hover:text-white px-3.5 py-1.5 rounded-xl text-[11px] md:text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-purple-500/5"
                  >
                    {isSummarizing ? 'Analyzing…' : 'Run Summarizer'}
                  </button>
                </div>

                {/* AI Output Card */}
                <div className="bg-gradient-to-br from-purple-950/15 to-indigo-950/5 border border-purple-500/15 rounded-3xl p-4 relative overflow-hidden">
                  {/* Subtle purple background glow */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                  
                  {isSummarizing ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-purple-400">
                      <div className="relative w-8 h-8">
                        <div className="absolute inset-0 border-2 border-purple-500/20 rounded-full" />
                        <div className="absolute inset-0 border-2 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Extracting highlights & decisions…</p>
                    </div>
                  ) : activeNote.metadata.ai_summary ? (
                    <div className="space-y-2.5">
                      <div className="text-[10px] text-white/70 leading-relaxed font-sans whitespace-pre-wrap">
                        {activeNote.metadata.ai_summary}
                      </div>
                      <button
                        onClick={() => updateActiveNoteMetadata({ ai_summary: undefined })}
                        className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-purple-400/60 hover:text-purple-400 transition-colors cursor-pointer mt-2 block"
                      >
                        Reset AI Card
                      </button>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-white/30 space-y-2">
                      <Sparkles className="w-6 h-6 text-purple-500/30 mx-auto" />
                      <p className="text-[10px] font-bold leading-normal uppercase tracking-wider max-w-xs mx-auto">
                        Ready to extract action items, key decisions, and strategic highlights automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* WIDGET 5: VOICE MEMO & DICTATION */}
              <div className="py-6 space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Mic className="w-3.5 h-3.5 text-red-400" /> Voice dictation memo
                </h3>

                <div className="bg-black/20 border border-white/5 rounded-3xl p-4 flex items-center gap-4 relative overflow-hidden">
                  <button
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isRecording 
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' 
                        : 'bg-white/10 hover:bg-white hover:text-black border border-white/10'
                    }`}
                  >
                    {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest text-white/50">
                        {isRecording ? 'Listening & Transcribing' : 'Record meeting memo'}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-white/40">{formatTime(recordingTime)}</span>
                    </div>

                    {/* Animated sound wave bars when recording */}
                    {isRecording ? (
                      <div className="flex items-end gap-0.5 h-6">
                        {[4, 2, 6, 8, 3, 5, 2, 7, 5, 8, 9, 3, 6, 4, 7, 2, 5, 3, 6].map((h, i) => (
                          <div
                            key={i}
                            className="bg-red-500 rounded-full flex-grow"
                            style={{
                              height: `${h * 10}%`,
                              animation: `pulse 0.8s ease-in-out infinite alternate`,
                              animationDelay: `${i * 0.05}s`
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="h-0.5 bg-white/10 rounded-full w-full mt-2" />
                    )}
                  </div>
                </div>
              </div>

              {/* WIDGET 6: STICKY SCRATCHPAD */}
              <div className="py-6 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-widest text-accent flex items-center gap-2">
                  <Save className="w-3.5 h-3.5 text-amber-400" /> Sticky Scratchpad
                </h3>
                {/* Amber/Yellow Post-It Note Style */}
                <div className="bg-amber-400 text-amber-950 rounded-3xl p-5 shadow-xl shadow-amber-950/5 border-t border-amber-300 relative transform hover:rotate-1 transition-all">
                  {/* Visual pin circle */}
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-amber-600 rounded-full opacity-60 shadow" />
                  
                  <textarea
                    value={activeNote.scratchpad}
                    onChange={(e) => updateActiveNote({ scratchpad: e.target.value })}
                    placeholder="Quick thoughts, clipboard items, or numbers jotted during the call. Saved instantly…"
                    className="w-full bg-transparent resize-none outline-none border-none text-[11px] font-semibold leading-relaxed placeholder:text-amber-900/40 h-28 custom-scrollbar mt-1"
                  />
                  <div className="text-[11px] md:text-[8px] font-black uppercase tracking-wider text-amber-900/40 text-right mt-2">
                    Transient Scratchpad
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Empty note screen placeholder */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white/30 select-none">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
              <FileText className="w-9 h-9 text-accent/60" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight text-white mb-2">No meeting notes selected</h2>
            <p className="text-xs font-semibold uppercase tracking-wider max-w-sm leading-relaxed text-white/30">
              Choose a client from the left sidebar or create a new meeting note to launch the interactive widgets dashboard.
            </p>
          </div>
        )}
      </div>

      {/* ═══════════════════════ NEW NOTE SETUP MODAL ═══════════════════════ */}
      <AnimatePresence>
        {isNewNoteModalOpen && (
          <div 
            onClick={(e) => e.target === e.currentTarget && setIsNewNoteModalOpen(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl text-white cursor-default relative"
            >
              <button 
                onClick={() => setIsNewNoteModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/55 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-bold tracking-tight text-white mb-6">New Meeting Note</h2>

              <div className="space-y-4">
                {/* Select Client */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Select Client</label>
                  {clients.length > 0 ? (
                    <select
                      value={selectedClientForNewNote}
                      onChange={(e) => setSelectedClientForNewNote(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white cursor-pointer"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id} className="bg-zinc-950 text-white font-bold">{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-red-400 italic ml-1">No clients found in database. Create a client in Rolodex first.</p>
                  )}
                </div>

                {/* Note Title */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-white/50 ml-1">Note / Meeting Title</label>
                  <input 
                    type="text"
                    required
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="e.g. Script Review Session"
                    className="w-full bg-black/50 border border-white/10 p-4 rounded-xl outline-none focus:border-accent font-semibold text-sm text-white placeholder:text-white/30"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNote()}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 mt-6">
                  <button 
                    type="button"
                    onClick={() => setIsNewNoteModalOpen(false)}
                    className="px-6 py-3 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleCreateNote}
                    disabled={!selectedClientForNewNote}
                    className="bg-accent text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-lg shadow-accent/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Create Note
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🎙️ VOICE TRANSCRIPT PREVIEW MODAL */}
      <AnimatePresence>
        {showTranscriptModal && audioTranscript && (
          <div 
            onClick={(e) => e.target === e.currentTarget && setShowTranscriptModal(false)}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl text-white cursor-default relative"
            >
              <button 
                onClick={() => setShowTranscriptModal(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/55 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Mic className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-bold text-white">Voice Dictation Transcript</h2>
              </div>

              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">
                Audio processed and transcribed
              </p>

              <div className="bg-black/40 border border-white/5 p-5 rounded-2xl mb-6 text-sm text-white/90 font-medium italic leading-relaxed">
                {audioTranscript}
              </div>

              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowTranscriptModal(false)}
                  className="px-6 py-2.5 rounded-xl font-semibold text-xs border border-white/10 hover:bg-white/5 transition-all text-white cursor-pointer"
                >
                  Discard
                </button>
                <button 
                  onClick={appendTranscriptToNote}
                  className="bg-accent text-white px-8 py-2.5 rounded-xl font-semibold text-xs hover:bg-white hover:text-black transition-all cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Append to Note
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Embedded keyframe CSS for sound wave animation */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scaleY(0.3);
          }
          100% {
            transform: scaleY(1);
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
