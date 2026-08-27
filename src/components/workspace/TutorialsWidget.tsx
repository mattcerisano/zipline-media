'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Search, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Columns, 
  Briefcase, 
  Scissors, 
  Package, 
  Calendar, 
  MessageSquare, 
  Users, 
  Lock, 
  Sparkles,
  HelpCircle,
  Tv,
  Check,
  RotateCcw
} from 'lucide-react';

interface TutorialTopic {
  id: string;
  title: string;
  category: string;
  icon: any;
  description: string;
  steps: string[];
  proTips: string;
  actionLabel: string;
  actionTab: string;
}

interface TutorialsWidgetProps {
  onSwitchTab: (tab: any) => void;
  initialTopicId?: string;
}

export default function TutorialsWidget({ onSwitchTab, initialTopicId }: TutorialsWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState(initialTopicId || 'layout');
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    }
  }, [initialTopicId]);

  const topics: TutorialTopic[] = [
    {
      id: 'layout',
      title: 'Workspace Layouts & Panel Splits',
      category: 'System Interface',
      icon: Columns,
      description: 'Studio OS features a high-performance tile-based window manager that allows you to subdivide any workspace pane into rows or columns. This enables you to monitor live shooting slates, edit reviews, and scripts simultaneously on a single screen.',
      steps: [
        'Hover your mouse cursor over the top-right corner of any active workspace panel.',
        'Identify the vertical splitting icon (Columns) and horizontal splitting icon (Rows).',
        'Click either split icon to partition the panel. A new, empty panel will appear next to or below the active one.',
        'Click the "+" button in any panel\'s header to add a new tab (e.g., Scratch Notes, Production Clock, or an external Web Embed).',
        'Drag the dark border dividers between panels to resize them to your liking.',
        'If your layout becomes too complex, click the "Reset View" button in the top-right header of the application to restore the default layout.'
      ],
      proTips: 'You can create customized client portals or operator dashboards by splitting panels and adding public Vimeo or Google Drive folder embeds.',
      actionLabel: 'Launch Dashboard Overview',
      actionTab: 'dashboard'
    },
    {
      id: 'slate',
      title: 'Production Slate & Call Sheets',
      category: 'Core Modules',
      icon: Briefcase,
      description: 'The Production Slate is the central repository for all active shoots, client proposals, and historical projects. It tracks shooting dates, statuses, budgets, and crew roles, and features an advanced call sheet generator.',
      steps: [
        'Navigate to the Slate tab in the sidebar.',
        'Click the "+ New Job" button in the top-right corner to open the creation form.',
        'Input details such as Job Title, Client Name, Shoot Date, Status, and Location.',
        'Scroll to the Crew Roster section and click "Add Crew Member" to assign contacts from your Rolodex to specific roles (e.g., Director, DP, Gaffer).',
        'Input financial details like Day Rate, Crew Expenses, and Client Budget to calculate margins automatically.',
        'To create a Call Sheet, click "Build Call Sheet". Review the details and click "Export PDF Call Sheet" to generate a beautifully formatted PDF to email to your crew.'
      ],
      proTips: 'Keep your slate tidy by archiving finished productions. Simply change their status to "Wrapped" or "Archived" to filter them out of active views while keeping their records intact.',
      actionLabel: 'Open Production Slate',
      actionTab: 'slate'
    },
    {
      id: 'edits',
      title: 'Post-Production Edit Tracker',
      category: 'Core Modules',
      icon: Scissors,
      description: 'The Edit Tracker monitors the post-production lifecycle of every project. It tracks drafts, review links, client approval states, and specific revision notes, keeping editors and clients aligned.',
      steps: [
        'Open the Edit Tracker tab. You will see a list of active editing jobs.',
        'Select a job to open its detail view.',
        'Click "Add Draft" to log a new version. Choose the stage (WIP, Rough Cut, Fine Cut, V1, V2, Final).',
        'Input the review link (e.g., Frame.io, Vimeo, or YouTube) and add any passwords or access instructions.',
        'Under "Client Feedback & Revision Log", click "Add Revision Note" to document client requests. Mark notes as "Pending", "In Progress", or "Completed" to track fixes.',
        'When a draft is approved, update the edit status to "Final" and upload the final delivery links.'
      ],
      proTips: 'You can embed a public Vimeo player or Frame.io review link directly in a split panel next to your notes by using the Web Embed feature.',
      actionLabel: 'Open Edit Tracker',
      actionTab: 'edits'
    },
    {
      id: 'gear',
      title: 'Gear Builder & Transport Manifests',
      category: 'Core Modules',
      icon: Package,
      description: 'The Gear Builder acts as your digital camera locker. It allows you to build custom rental and inventory manifests, automatically calculate total kit weights, track packing completeness, and estimate rental values.',
      steps: [
        'Open the Gear Builder. You can build a general list or select an active job from the dropdown to link a manifest directly to that shoot.',
        'Browse the gear catalog or use the search bar to find specific items (cameras, lenses, lighting, audio).',
        'Click the "+" button next to an item to add it to your manifest. Specify the quantity.',
        'Organize gear into specific cases (e.g., Case A: Red V-Raptor, Case B: Cine Lenses) to streamline on-set packaging.',
        'Review the bottom telemetry panel to monitor total manifest weight and estimated rental/insurance values.',
        'Check off items in the manifest as they are packed into cases, ensuring nothing is left behind.'
      ],
      proTips: 'You can quickly duplicate an existing manifest to use as a template for future shoots, saving hours of manual data entry.',
      actionLabel: 'Open Gear Builder',
      actionTab: 'gear'
    },
    {
      id: 'calendar',
      title: 'Two-Way Google Calendar Sync',
      category: 'Integrations',
      icon: Calendar,
      description: 'Studio OS features a live two-way integration with Google Calendar, alongside Webcal / ICS subscription feeds. This ensures your personal devices and team scheduling remain perfectly in sync.',
      steps: [
        'Navigate to the Dashboard (Overview) or click the Calendar tab.',
        'Click "Configure Sync" or click the "Calendar Sync" button in the top-right header.',
        'Connect your Google Account via OAuth to authorize Studio OS to read and write calendar events.',
        'To import a shoot from Google Calendar to your Slate, simply create an event on Google and prefix the title with the movie camera emoji: 🎥 (e.g., "🎥 Zipline Media Commercial"). The system will automatically sync it back as a job.',
        'Copy the live Webcal subscription feed link and paste it into Apple Calendar, Outlook, or Google Calendar to subscribe to your team\'s schedule.'
      ],
      proTips: 'The calendar sync runs in the background. Bi-directional updates occur every few minutes, keeping your mobile device notified of newly booked shoots instantly.',
      actionLabel: 'Open Calendar',
      actionTab: 'calendar'
    },
    {
      id: 'discord',
      title: 'Discord Webhook Integrations',
      category: 'Integrations',
      icon: MessageSquare,
      description: 'Connect Studio OS to your team\'s Discord server to receive real-time automated telemetry notifications. Keep crew members informed of newly booked jobs, edit status updates, and budget approvals automatically.',
      steps: [
        'Open your Discord server, navigate to the channel settings, and create a new Webhook. Copy the Webhook URL.',
        'In Studio OS, navigate to the Overview / Dashboard tab.',
        'In the "Team Alert Gateway" card, click the settings link or go to Settings -> Integrations.',
        'Paste your Discord Webhook URL into the field and toggle on the alerts you wish to enable (New Booked Jobs, Edit Stage Shifts, Budget Approvals, System Alerts).',
        'Return to the Dashboard, type a test message in the input box, and click "Test Alert" to verify that the webhook is working and the message appears in Discord.'
      ],
      proTips: 'Create separate Discord channels for #production-alerts and #post-alerts, and configure distinct webhooks in Studio OS to route notifications to the correct teams.',
      actionLabel: 'Open Dashboard Settings',
      actionTab: 'dashboard'
    },
    {
      id: 'rolodex',
      title: 'Rolodex CRM & Roster Directory',
      category: 'Core Modules',
      icon: Users,
      description: 'The Rolodex is your agency\'s secure address book. It houses profiles for crew members, clients, talent, and vendors, complete with day rates, contact info, and skill tags.',
      steps: [
        'Open the Rolodex panel.',
        'Click "+ Add Contact" to create a new contact profile.',
        'Input details such as Full Name, Email, Phone, Company, and Role/Department.',
        'Set their standard Day Rate and specify their primary skills or equipment (e.g., "A-Cam Operator", "Movi Pro Tech").',
        'Use the search bar and filter pills at the top to instantly sort contacts by department (Directing, Camera, Lighting, Audio, Talent, Client).',
        'When building crew rosters in the Production Slate, these contacts will automatically appear as selectable options.'
      ],
      proTips: 'You can log client contacts in the Rolodex and link them directly to jobs, allowing you to quickly look up key agency stakeholders on set.',
      actionLabel: 'Open Rolodex CRM',
      actionTab: 'rolodex'
    },
    {
      id: 'vault',
      title: 'Secure Media Vault & Storage',
      category: 'Core Modules',
      icon: Lock,
      description: 'The Media Vault provides a secure, centralized panel for managing client credentials, shared Google Drive or Dropbox folders, stock music accounts, and other critical production assets.',
      steps: [
        'Navigate to the Vault tab in the sidebar.',
        'Click "+ New Entry" to create a secure vault record.',
        'Enter a title, select a category (Folder Link, Password, Asset, Other), and input the URL or credentials.',
        'Add any notes, passwords, or access keys. Vault entries are encrypted and securely stored in your database.',
        'Use the search bar to filter entries by client or project name.',
        'Click the copy icon next to a link or password to copy it to your clipboard instantly.'
      ],
      proTips: 'Use the Vault to store shared Google Drive folders for active shoots, making it easy for editors and clients to locate raw footage and project files.',
      actionLabel: 'Open Media Vault',
      actionTab: 'vault'
    },
    {
      id: 'tools',
      title: 'Scratch Notes, Clock, & Script',
      category: 'System Interface',
      icon: Tv,
      description: 'Studio OS contains a suite of integrated utility widgets designed to assist you during brainstorming sessions, teleprompting, and editing sessions.',
      steps: [
        'Scratch Notes: A local markdown notepad. Split your panel, add a "Scratch Notes" tab, and start typing. Your notes are automatically saved to your browser\'s local storage.',
        'Production Timer: Includes a UTC digital clock, a stopwatch, and a countdown timer. Perfect for timing segment lengths on set, tracking edit durations, or timing voiceover recordings.',
        'Script & Teleprompter: A teleprompter utility. Write or paste your script, configure the font size and scroll speed, and click "Launch Teleprompter" to open a full-screen, scrollable presenter window.'
      ],
      proTips: 'You can open multiple instances of Scratch Notes or Production Clocks across your split panels, allowing you to time multiple tasks while keeping notes open.',
      actionLabel: 'Go to Dashboard',
      actionTab: 'dashboard'
    }
  ];

  // Load checklist progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('studio_tutorials_checklist');
    if (saved) {
      try {
        setChecklistState(JSON.parse(saved));
      } catch (e) { /* ignore */ }
    }
  }, []);

  const handleToggleCheck = (topicId: string, stepIndex: number) => {
    const key = `${topicId}_${stepIndex}`;
    const nextState = { ...checklistState, [key]: !checklistState[key] };
    setChecklistState(nextState);
    localStorage.setItem('studio_tutorials_checklist', JSON.stringify(nextState));
  };

  const handleResetChecklist = (topicId: string) => {
    const nextState = { ...checklistState };
    topics.find(t => t.id === topicId)?.steps.forEach((_, index) => {
      delete nextState[`${topicId}_${index}`];
    });
    setChecklistState(nextState);
    localStorage.setItem('studio_tutorials_checklist', JSON.stringify(nextState));
  };

  const calculateProgress = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return 0;
    const total = topic.steps.length;
    const completed = topic.steps.filter((_, index) => checklistState[`${topicId}_${index}`]).length;
    return Math.round((completed / total) * 100);
  };

  const filteredTopics = topics.filter(topic => {
    const query = searchQuery.toLowerCase();
    return (
      topic.title.toLowerCase().includes(query) ||
      topic.category.toLowerCase().includes(query) ||
      topic.description.toLowerCase().includes(query)
    );
  });

  const selectedTopic = topics.find(t => t.id === selectedTopicId) || topics[0];
  const selectedProgress = calculateProgress(selectedTopic.id);
  const SelectedIcon = selectedTopic.icon;

  return (
    <div className="w-full h-full flex flex-col md:flex-row bg-neutral-950/20 text-white min-h-[500px] overflow-hidden rounded-xl border border-white/5">
      
      {/* LEFT SIDEBAR - TOPICS LIST */}
      <div className="w-full md:w-72 border-r border-white/10 flex flex-col shrink-0 bg-black/40 backdrop-blur-sm">
        
        {/* Search Header */}
        <div className="p-4 border-b border-white/5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4.5 h-4.5 text-accent" />
            <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Learning Center</h4>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input 
              type="text"
              placeholder="Search tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/35 outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all duration-300"
            />
          </div>
        </div>

        {/* List of Topics */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
          {filteredTopics.map((topic) => {
            const Icon = topic.icon;
            const isSelected = topic.id === selectedTopicId;
            const progress = calculateProgress(topic.id);

            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all duration-300 group cursor-pointer ${
                  isSelected 
                    ? 'bg-accent/10 border border-accent/20 shadow-[0_0_20px_rgba(0,119,255,0.05)]' 
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg transition-colors shrink-0 ${
                  isSelected ? 'bg-accent text-white' : 'bg-white/5 text-white/50 group-hover:text-accent group-hover:bg-accent/10'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[8px] font-black uppercase tracking-widest text-accent/80 block">{topic.category}</span>
                    {progress === 100 && (
                      <Check className="w-3 h-3 text-green-400 shrink-0" />
                    )}
                  </div>
                  <h5 className={`text-xs font-bold truncate transition-colors ${
                    isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'
                  }`}>
                    {topic.title}
                  </h5>
                  
                  {/* Small progress bar */}
                  <div className="mt-2 w-full bg-white/5 h-1 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-accent'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}

          {filteredTopics.length === 0 && (
            <div className="py-12 text-center">
              <HelpCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">No tutorials found</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT DETAIL VIEW */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/20 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedTopic.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="p-6 md:p-8 space-y-6 flex-1 flex flex-col"
          >
            {/* Topic Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20 shrink-0">
                  <SelectedIcon className="w-6 h-6 text-accent" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-accent/80 block">{selectedTopic.category}</span>
                  <h3 className="text-lg md:text-xl font-black uppercase tracking-tight text-white mt-0.5 truncate">
                    {selectedTopic.title}
                  </h3>
                </div>
              </div>

              {/* Progress Tracker */}
              <div className="flex items-center gap-3 self-start sm:self-auto bg-white/5 border border-white/5 px-4 py-2 rounded-2xl shrink-0">
                <div className="text-right">
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40 block">Tutorial Progress</span>
                  <span className="text-xs font-black text-white">{selectedProgress}% Complete</span>
                </div>
                <div className="relative w-8 h-8 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-white/5"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className={`transition-all duration-500 ${selectedProgress === 100 ? 'text-green-500' : 'text-accent'}`}
                      strokeWidth="3.5"
                      strokeDasharray={`${selectedProgress}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white/5 border border-white/5 p-5 rounded-2xl">
              <p className="text-xs md:text-sm text-white/70 leading-relaxed">
                {selectedTopic.description}
              </p>
            </div>

            {/* Interactive Step-by-Step Checklist */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <span>Interactive Checklist</span>
                  <span className="px-2 py-0.5 bg-white/5 rounded-full text-[8px] font-bold text-white/60">
                    {selectedTopic.steps.filter((_, i) => checklistState[`${selectedTopic.id}_${i}`]).length} / {selectedTopic.steps.length} Steps
                  </span>
                </h4>
                {selectedProgress > 0 && (
                  <button 
                    onClick={() => handleResetChecklist(selectedTopic.id)}
                    className="text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-accent flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Reset Steps
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {selectedTopic.steps.map((step, index) => {
                  const isChecked = !!checklistState[`${selectedTopic.id}_${index}`];
                  return (
                    <button
                      key={index}
                      onClick={() => handleToggleCheck(selectedTopic.id, index)}
                      className={`w-full flex items-start gap-3.5 p-3.5 rounded-xl border text-left transition-all duration-300 group cursor-pointer ${
                        isChecked 
                          ? 'bg-green-500/5 border-green-500/15 hover:bg-green-500/10' 
                          : 'bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/8'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckCircle2 className="w-4.5 h-4.5 text-green-400 fill-green-400/10" />
                        ) : (
                          <Circle className="w-4.5 h-4.5 text-white/25 group-hover:text-accent transition-colors" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className={`text-[10px] font-black tracking-wider block mb-0.5 uppercase ${
                          isChecked ? 'text-green-400/80' : 'text-white/40'
                        }`}>
                          Step {index + 1}
                        </span>
                        <p className={`text-xs leading-relaxed transition-colors ${
                          isChecked ? 'text-white/60 line-through' : 'text-white/80'
                        }`}>
                          {step}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pro-Tips & Advanced */}
            <div className="bg-gradient-to-r from-accent/5 via-blue-500/5 to-transparent border border-accent/15 p-5 rounded-2xl space-y-2 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-accent flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Pro-Tip / Advanced Usage
              </h4>
              <p className="text-xs text-white/70 leading-relaxed font-medium">
                {selectedTopic.proTips}
              </p>
            </div>

            {/* Quick Actions & Launch Widget */}
            <div className="border-t border-white/5 pt-6 mt-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest">
                <HelpCircle className="w-4 h-4 text-white/30" /> Need more help? Check the cheatsheet widget
              </div>
              
              <button
                onClick={() => onSwitchTab(selectedTopic.actionTab)}
                className="px-5 py-3 bg-accent hover:bg-white hover:text-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-accent/15 hover:shadow-white/10 active:scale-[0.98] self-start sm:self-auto"
              >
                {selectedTopic.actionLabel} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
