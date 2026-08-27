'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle, 
  Columns, 
  Rows, 
  RotateCcw, 
  Briefcase, 
  Scissors, 
  Package, 
  Users, 
  MessageSquare, 
  Link, 
  Sparkles,
  Calendar,
  Plus,
  BookOpen,
  Lock,
  Palette,
  Tv,
  ArrowRight
} from 'lucide-react';
import TutorialsWidget from './TutorialsWidget';

// --- INTERACTIVE TOUR STEPS ---
interface TourStep {
  title: string;
  subtitle: string;
  icon: any;
  content: React.ReactNode;
}

interface QuickStartGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalendarSync: () => void;
  initialTab?: 'tour' | 'tutorials';
  initialTopicId?: string;
  onSwitchTab?: (tab: any) => void;
}

export function QuickStartGuideModal({ 
  isOpen, 
  onClose, 
  onOpenCalendarSync,
  initialTab = 'tour',
  initialTopicId,
  onSwitchTab
}: QuickStartGuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [activeModalTab, setActiveModalTab] = useState<'tour' | 'tutorials'>('tour');

  useEffect(() => {
    if (isOpen) {
      setActiveModalTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const steps: TourStep[] = [
    {
      title: "Welcome to Studio OS",
      subtitle: "The Command Center for Zipline Media",
      icon: Sparkles,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Welcome to <strong className="text-white">Studio OS</strong>, your agency-grade internal portal designed to unify production slates, crew planning, editing status, gear builders, and live integrations.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-3">
            <h4 className="text-[10px] font-black tracking-widest text-accent uppercase">At a Glance:</h4>
            <ul className="grid grid-cols-2 gap-3 text-xs text-white/60">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                Real-time Database Sync
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                Modular Panel Splits
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                Vimeo & Drive Embeds
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full" />
                Google & Discord Feeds
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Modular Layouts & Panel Splits",
      subtitle: "Customize your environment dynamically",
      icon: Columns,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Studio OS workspaces are built on a dynamic window-splitting layout manager. You can create customized dashboard layouts by splitting existing panels.
          </p>
          
          <div className="space-y-3">
            <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="p-1.5 bg-white/10 rounded"><Columns className="w-3.5 h-3.5 text-accent" /></div>
                <div className="p-1.5 bg-white/10 rounded"><Rows className="w-3.5 h-3.5 text-accent" /></div>
              </div>
              <p className="text-xs text-white/60">
                Hover over any panel and use the <strong className="text-white">Split</strong> icons in the top-right corner to divide it vertically or horizontally.
              </p>
            </div>

            <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="p-1.5 bg-white/10 rounded shrink-0"><RotateCcw className="w-3.5 h-3.5 text-accent" /></div>
              <p className="text-xs text-white/60">
                If the splits get too complicated, simply click the <strong className="text-white">Reset View</strong> button in the top-right header area to restore the default panel layout instantly.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Production Slate & Call Sheets",
      subtitle: "Unifying pre-production, scheduling, & crew",
      icon: Briefcase,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            The <strong className="text-white">Production Slate</strong> houses all agency jobs. Track dates, locations, client contacts, and detailed budgets.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-accent uppercase">Rosters & PDF Call Sheets:</h4>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
              <li>Assign team members to roles (Director, DP, Editor, Talent) from your CRM.</li>
              <li>Input day rates, expenses, and track total production margins.</li>
              <li>Click <strong className="text-white">Build Call Sheet</strong> to generate and download beautifully formatted PDFs.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Post-Production Edit Tracker",
      subtitle: "Review links, feedbacks, & client approvals",
      icon: Scissors,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            The <strong className="text-white">Edit Tracker</strong> manages your video editing pipeline. Never lose track of review links or revision lists again.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-accent uppercase">Post Pipeline features:</h4>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
              <li>Track progress of drafts (WIP, Rough Cut, Fine Cut, V1, V2, Final).</li>
              <li>Save Frame.io, Vimeo, or YouTube review links with passwords.</li>
              <li>Log and update specific client feedback notes as "Completed" or "Pending".</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Gear Builder & Manifests",
      subtitle: "Manage camera, lenses, audio, & lighting kits",
      icon: Package,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            The <strong className="text-white">Gear Builder</strong> coordinates transport lists, manifests, and kit configurations for every shoot.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-accent uppercase">Inventory Telemetry:</h4>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
              <li>Build gear manifests and link them directly to jobs on your Production Slate.</li>
              <li>Automatically calculate total package weight and estimated rental/insurance costs.</li>
              <li>Sort gear into labeled travel cases and check off items as they are packed.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Creative Board & storyboarding",
      subtitle: "Concept design, outlines, & references",
      icon: Palette,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Unify pre-production scripts and visual styles. The <strong className="text-white">Creative Board</strong> keeps directors and designers aligned.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-accent uppercase">Creative Board includes:</h4>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
              <li>Detailed creative briefs, target audience, and style profiles.</li>
              <li>Reference boards to pin moodboard images and visual mockups.</li>
              <li>Script outlines, scene breakdowns, and direct links to screenplay documents.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Rolodex CRM & Day Rates",
      subtitle: "Database of crew, clients, and talent",
      icon: Users,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Manage your agency contact network. The <strong className="text-white">Rolodex CRM</strong> houses crew profiles, client details, day rates, and skill tags.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-2.5">
            <h4 className="text-[10px] font-black tracking-widest text-accent uppercase">CRM features:</h4>
            <ul className="text-xs text-white/60 space-y-1.5 list-disc list-inside">
              <li>Filter contacts instantly by department (Directing, Camera, G&E, Audio, Vendor, Client).</li>
              <li>Log standard day rates, skill specialties, phone numbers, and email addresses.</li>
              <li>Seamlessly link crew contacts to jobs in the Slate roster for fast call sheet building.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Two-Way Calendar Synchronization",
      subtitle: "Keep your mobile devices and schedule in sync",
      icon: Calendar,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Studio OS features a live ICS subscription feed and Google Calendar OAuth integration.
          </p>
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-accent">How Sync Works:</h4>
              <button 
                onClick={onOpenCalendarSync}
                className="px-3 py-1 bg-accent/20 hover:bg-accent border border-accent/30 rounded-lg text-[9px] font-black uppercase text-white transition-colors cursor-pointer"
              >
                Configure Now
              </button>
            </div>
            <ul className="text-xs text-white/60 space-y-2 list-disc list-inside">
              <li>Copy the live Webcal link to subscribe in Apple/Google Calendar.</li>
              <li>Authenticate via Google OAuth to push shifts automatically.</li>
              <li>Any Google Calendar event prefixed with <span className="text-white font-bold">🎥</span> automatically imports back into your Slate.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Discord Crew Notifications",
      subtitle: "Real-time automated telemetry updates",
      icon: MessageSquare,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Keep your team aligned on shooting schedules. Studio OS connects directly with your Discord webhook gateway.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-3">
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              Webhook Alerts Trigger on:
            </h4>
            <div className="grid grid-cols-2 gap-2.5 text-xs text-white/60 font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">✓ New Booked Job</div>
              <div className="flex items-center gap-1.5">✓ Edit Stage Shift</div>
              <div className="flex items-center gap-1.5">✓ Budget Approvals</div>
              <div className="flex items-center gap-1.5">✓ System Alerts</div>
            </div>
          </div>
          <p className="text-[10px] text-white/40 italic">
            Configure the Discord gateway in the Overview tab to test delivery logs.
          </p>
        </div>
      )
    },
    {
      title: "Secure Media Vault & System Tools",
      subtitle: "Passwords, files, notes, clocks, & scripts",
      icon: Lock,
      content: (
        <div className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
          <p className="text-sm text-white/70 leading-relaxed">
            Studio OS provides secure encryption lists for assets, alongside useful built-in production widgets:
          </p>
          <div className="space-y-2.5">
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Lock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Secure Media Vault</h5>
                <p className="text-[11px] text-white/60">Store sensitive project credentials, client links, raw footage folders, and passwords securely.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Tv className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Script & Teleprompter</h5>
                <p className="text-[11px] text-white/60">Write scripts, configure font size or scroll speeds, and launch a full-screen teleprompter.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Link className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Workspace Embeds</h5>
                <p className="text-[11px] text-white/60">Create custom tabs containing live public folders, Figma, Miro, or Vimeo embeds in any panel split.</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const StepIcon = steps[currentStep].icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          {/* Main Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className={`w-full bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative flex flex-col justify-between overflow-hidden transition-all duration-350 min-h-[500px] ${
              activeModalTab === 'tutorials' 
                ? 'max-w-5xl h-[85vh] max-h-[750px]' 
                : 'max-w-xl h-auto'
            }`}
          >
            {/* Top glowing line decoration */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
            
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer z-50"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Tab Selector */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-4 mb-5 shrink-0 pr-8 z-10">
              <button
                onClick={() => setActiveModalTab('tour')}
                className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeModalTab === 'tour'
                    ? 'bg-accent text-white shadow-md shadow-accent/15'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3" /> Quick Start Tour
              </button>
              <button
                onClick={() => setActiveModalTab('tutorials')}
                className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeModalTab === 'tutorials'
                    ? 'bg-accent text-white shadow-md shadow-accent/15'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}
              >
                <BookOpen className="w-3 h-3" /> Interactive Tutorials
              </button>
            </div>

            {activeModalTab === 'tour' ? (
              <div className="flex-grow flex flex-col justify-between min-h-0">
                {/* Step Header */}
                <div className="flex items-center gap-3.5 mb-6 shrink-0">
                  <div className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20 shrink-0">
                    <StepIcon className="w-6 h-6 text-accent animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black uppercase tracking-tighter text-white truncate">
                      {steps[currentStep].title}
                    </h3>
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 mt-0.5 truncate">
                      {steps[currentStep].subtitle}
                    </p>
                  </div>
                </div>

                {/* Slide Body */}
                <div className="flex-1 mb-8 flex flex-col justify-center min-h-0 overflow-y-auto">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    {steps[currentStep].content}
                  </motion.div>
                </div>

                {/* Bottom Actions Area */}
                <div className="flex items-center justify-between border-t border-white/5 pt-5 shrink-0 gap-4">
                  {/* Slide dots */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {steps.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentStep(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 shrink-0 ${
                          i === currentStep ? 'w-6 bg-accent' : 'w-1.5 bg-white/10 hover:bg-white/35'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setActiveModalTab('tutorials')}
                      className="px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 text-purple-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" /> Learning Center
                    </button>
                    
                    {currentStep > 0 && (
                      <button
                        onClick={handleBack}
                        className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Back
                      </button>
                    )}
                    
                    <button
                      onClick={handleNext}
                      className="px-5 py-2.5 bg-accent hover:bg-white hover:text-black text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-accent/15"
                    >
                      {currentStep === steps.length - 1 ? 'Finish Tour' : 'Next'} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-grow min-h-0 flex flex-col relative overflow-hidden">
                <TutorialsWidget 
                  initialTopicId={initialTopicId} 
                  onSwitchTab={(targetTab) => {
                    onSwitchTab?.(targetTab);
                    onClose();
                  }} 
                />
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- INLINE CHEATSHEET WIDGET ---
interface QuickStartWidgetProps {
  onSwitchTab?: (tab: any) => void;
}

export function QuickStartWidget({ onSwitchTab }: QuickStartWidgetProps) {
  const [activeSection, setActiveSection] = useState<string | null>('layout');

  const sections = [
    {
      id: 'layout',
      title: 'Layout Splits & Resizing',
      icon: Columns,
      content: (
        <div className="space-y-3">
          <p className="text-[11px] text-white/60 leading-relaxed">
            Studio OS leverages a high-performance tiled grid layout. Subdivide your workspace vertically or horizontally to monitor multiple workflows.
          </p>
          <ul className="space-y-1.5 text-white/50 text-[11px] list-disc list-inside">
            <li>Hover a panel and click <strong className="text-white">Columns (vertical split)</strong> or <strong className="text-white">Rows (horizontal split)</strong> in the top right.</li>
            <li>Drag the dark panel borders to resize heights and widths.</li>
            <li>Add customized widgets or public web embeds in any split using the <strong className="text-white font-bold">+</strong> tab header button.</li>
          </ul>
          {onSwitchTab && (
            <button
              onClick={() => onSwitchTab('dashboard')}
              className="mt-1 w-full py-2 bg-white/5 hover:bg-accent hover:text-white border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              Go to Dashboard Overview <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )
    },
    {
      id: 'calendar',
      title: 'Calendar & Google Sync',
      icon: Calendar,
      content: (
        <div className="space-y-3">
          <p className="text-[11px] text-white/60 leading-relaxed">
            Bi-directional telemetry between your personal Google Calendar and the Studio OS Production Slate.
          </p>
          <ul className="space-y-1.5 text-white/50 text-[11px] list-disc list-inside">
            <li>OAuth Google accounts in settings to push and pull shooting dates automatically.</li>
            <li>Any calendar event starting with the <strong className="text-white">🎥</strong> movie camera emoji imports as a slate job.</li>
            <li>Subscribe to Apple or Google Calendar using the live ICS Webcal subscription URL.</li>
          </ul>
          {onSwitchTab && (
            <button
              onClick={() => onSwitchTab('calendar')}
              className="mt-1 w-full py-2 bg-white/5 hover:bg-accent hover:text-white border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1"
            >
              Open Calendar <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )
    },
    {
      id: 'modules',
      title: 'Core System Widgets',
      icon: Briefcase,
      content: (
        <div className="space-y-3 text-[11px]">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onSwitchTab?.('slate')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-left transition-colors cursor-pointer"
            >
              <span className="font-bold text-white block">🎥 Production Slate</span>
              <span className="text-[10px] text-white/50 block mt-0.5">Jobs, crew rosters, and PDF call sheets.</span>
            </button>
            <button 
              onClick={() => onSwitchTab?.('edits')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-left transition-colors cursor-pointer"
            >
              <span className="font-bold text-white block">✂️ Edit Tracker</span>
              <span className="text-[10px] text-white/50 block mt-0.5">Post pipelines, review links, feedback.</span>
            </button>
            <button 
              onClick={() => onSwitchTab?.('gear')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-left transition-colors cursor-pointer"
            >
              <span className="font-bold text-white block">📦 Gear Builder</span>
              <span className="text-[10px] text-white/50 block mt-0.5">Equipment manifests, weights, case packing.</span>
            </button>
            <button 
              onClick={() => onSwitchTab?.('rolodex')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-left transition-colors cursor-pointer"
            >
              <span className="font-bold text-white block">👥 Rolodex CRM</span>
              <span className="text-[10px] text-white/50 block mt-0.5">Directory of crews, clients, day rates.</span>
            </button>
          </div>
        </div>
      )
    },
    {
      id: 'shortcuts',
      title: 'Quick Shortcuts Cheatsheet',
      icon: RotateCcw,
      content: (
        <div className="space-y-2 text-[11px] text-white/60">
          <div className="flex justify-between border-b border-white/5 py-1">
            <span className="font-bold">Reset Panel Splits</span>
            <span className="bg-white/10 px-2 py-0.5 rounded text-[8px] font-bold text-white">Header &gt; Reset View</span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-1">
            <span className="font-bold">Add Embed Tab</span>
            <span className="bg-white/10 px-2 py-0.5 rounded text-[8px] font-bold text-white">Panel + &gt; Web Embed</span>
          </div>
          <div className="flex justify-between border-b border-white/5 py-1">
            <span className="font-bold">Link Gear to Slate</span>
            <span className="bg-white/10 px-2 py-0.5 rounded text-[8px] font-bold text-white">Slate &gt; Build Gear</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="font-bold">Open Full Tutorials</span>
            {onSwitchTab ? (
              <button 
                onClick={() => onSwitchTab('tutorials')}
                className="bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest transition-colors cursor-pointer"
              >
                Launch Learning Center
              </button>
            ) : (
              <span className="bg-white/10 px-2 py-0.5 rounded text-[8px] font-bold text-white">Sidebar &gt; Learning Center</span>
            )}
          </div>
        </div>
      )
    }
  ];

  const toggleSection = (sectionId: string) => {
    setActiveSection(activeSection === sectionId ? null : sectionId);
  };

  return (
    <div className="w-full h-full flex flex-col p-5 bg-neutral-950/20 text-white min-h-[300px] overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-accent animate-pulse" />
          <h4 className="text-[10px] font-black uppercase tracking-widest">Quick Start Cheatsheet</h4>
        </div>
        {onSwitchTab && (
          <button
            onClick={() => onSwitchTab('tutorials')}
            className="text-[8px] font-black uppercase tracking-widest text-accent hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <BookOpen className="w-3 h-3" /> Full Tutorials
          </button>
        )}
      </div>

      <div className="space-y-2">
        {sections.map((sec) => {
          const Icon = sec.icon;
          const isOpen = activeSection === sec.id;

          return (
            <div key={sec.id} className="bg-white/5 border border-white/5 rounded-xl overflow-hidden transition-all duration-300">
              <button
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isOpen ? 'text-accent' : 'text-white/40'}`} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-white">{sec.title}</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-white/30 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="border-t border-white/5 bg-black/20"
                  >
                    <div className="p-4">{sec.content}</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
