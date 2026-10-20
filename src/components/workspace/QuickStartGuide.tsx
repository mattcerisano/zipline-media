'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EscapeToClose } from './Overlay';
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
  Library,
  Film,
  Clapperboard
} from 'lucide-react';

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
}

export function QuickStartGuideModal({ 
  isOpen, 
  onClose, 
  onOpenCalendarSync 
}: QuickStartGuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

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
                Draft Links & Versions
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
                Click <strong className="text-white">Edit layout</strong> in the header, then use the <strong className="text-white">Split</strong> icons in a panel&apos;s top-right corner to divide it vertically or horizontally. Click <strong className="text-white">Done</strong> to hide the controls again.
              </p>
            </div>

            <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="p-1.5 bg-white/10 rounded shrink-0"><RotateCcw className="w-3.5 h-3.5 text-accent" /></div>
              <p className="text-xs text-white/60">
                If the splits get too complicated, click <strong className="text-white">Edit layout</strong>, then the <strong className="text-white">Reset</strong> button beside it to restore the default panel layout.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Core Modules Guide",
      subtitle: "Unifying pre-production, filming, and post",
      icon: Briefcase,
      content: (
        <div className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
          <p className="text-sm text-white/70 leading-relaxed">
            Quickly navigate the core internal widgets by switching workspace tabs or clicking icons:
          </p>
          <div className="space-y-2.5">
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Briefcase className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Production Slate</h5>
                <p className="text-[11px] text-white/60">Every card shows its crew, its deliverables and its billing at a glance. Manage status and budgets, and export PDF call sheets.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Scissors className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Edit Tracker</h5>
                <p className="text-[11px] text-white/60">Track each edit through your stages, post each cut&apos;s link with its version history, and coordinate notes. S / M / L sets how big the cards are.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Package className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Gear Builder</h5>
                <p className="text-[11px] text-white/60">Pick a production and build its gear list, or make a one-off list that never touches the Slate. Export a PDF or share a live link; it warns when another shoot that day needs the same gear.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Users className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Rolodex CRM</h5>
                <p className="text-[11px] text-white/60">Crew, vendors and clients with day rates and contact info, plus who&apos;s booked when. Searching a name opens their card.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Library className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Library</h5>
                <p className="text-[11px] text-white/60">One place to browse, rename and tidy projects and shoots. Clients live in the Rolodex; gear is edited in the Gear Builder.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Tabs & Custom Embeds",
      subtitle: "Modular widgets and custom dashboards",
      icon: Link,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Expand the portal capabilities by creating custom workspace views.
          </p>
          <div className="space-y-3">
            <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="p-2 bg-white/10 rounded shrink-0"><Link className="w-4 h-4 text-accent" /></div>
              <p className="text-xs text-white/60 font-bold uppercase tracking-wider">
                Web Embeds: <span className="text-white/80 lowercase normal-case block mt-0.5">Embed public folders, Vimeo playbacks, Figma wireframes, or Trello boards directly into any split panel.</span>
              </p>
            </div>
            <div className="flex gap-4 items-center bg-white/5 p-3 rounded-xl border border-white/5">
              <div className="p-2 bg-white/10 rounded shrink-0"><Plus className="w-4 h-4 text-accent" /></div>
              <p className="text-xs text-white/60">
                Click <strong className="text-white">Edit layout</strong> in the header, then <strong className="text-white">Create Workspace</strong> at the bottom of the sidebar to add a custom tab for your team. The sidebar keeps the tabs the team opens most at the top; the order you set in Edit layout breaks ties.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Calendar Integration",
      subtitle: "Two-way synchronization",
      icon: Calendar,
      content: (
        <div className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
          <p className="text-sm text-white/70 leading-relaxed">
            The calendar works in both directions: shoots booked here appear on Google, and events
            added in Google appear here.
          </p>

          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-black uppercase text-accent">Sync</h4>
              <button
                onClick={onOpenCalendarSync}
                className="px-3 py-1 bg-accent/20 hover:bg-accent border border-accent/30 rounded-lg text-[11px] md:text-[9px] font-semibold text-white transition-colors cursor-pointer"
              >
                Configure Now
              </button>
            </div>
            <ul className="text-xs text-white/60 space-y-2 list-disc list-inside">
              <li>Connect Google once and saving a production pushes it automatically — with the crew, call time, location and safety details written into the event, so the calendar entry works as a pocket call sheet.</li>
              <li>Colours match Google&rsquo;s own palette, so a Hold looks the same in both places. Productions are tangerine.</li>
              <li>Subscribe any calendar app to the feed link for a read-only copy.</li>
            </ul>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-3">
            <h4 className="text-[10px] font-black uppercase text-accent">Clicking a day</h4>
            <ul className="text-xs text-white/60 space-y-2 list-disc list-inside">
              <li><span className="text-white font-semibold">Hold, Out of Office, Booked, Meeting</span> — quick markers. A colour and a note, nothing more.</li>
              <li><span className="text-white font-semibold">New production</span> — opens the full Slate form with that date already filled in, for a real shoot that needs a client, crew and a location.</li>
            </ul>
          </div>

          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-2">
            <h4 className="text-[10px] font-black uppercase text-accent">On a phone</h4>
            <p className="text-xs text-white/60">
              The calendar opens as an agenda — a running list of what&rsquo;s coming, with full titles
              and call times. Switch to the month grid with the toggle at the top when you want to
              spot a free week.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "What a Production Card Carries",
      subtitle: "Crew, deliverables and billing at a glance",
      icon: Clapperboard,
      content: (
        <div className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
          <p className="text-sm text-white/70 leading-relaxed">
            Each card on the Slate board shows the three things you usually open a job to check.
            A block only appears once it has something in it, so an empty shoot stays a title and a date.
          </p>
          <div className="space-y-2.5">
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Users className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Crew</h5>
                <p className="text-[11px] text-white/60">Who&rsquo;s on it, their position and their call time. Roles you haven&rsquo;t filled yet read <span className="italic">Unassigned</span> rather than hiding — that&rsquo;s the thing still to book.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Film className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Deliverables</h5>
                <p className="text-[11px] text-white/60">Every cutdown the shoot owes. Tap the chip to move one from to&nbsp;do to in&nbsp;progress to delivered. Add them from the card menu; they also show in the Social tab.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start bg-white/5 p-2.5 rounded-xl border border-white/5">
              <Plus className="w-4 h-4 text-accent mt-0.5 shrink-0" />
              <div>
                <h5 className="text-[10px] font-black uppercase text-white">Billing</h5>
                <p className="text-[11px] text-white/60">Invoiced and quoted totals, read straight from QuickBooks once it&rsquo;s connected. Read-only — nothing here writes to your books.</p>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-white/45 leading-relaxed">
            <span className="text-white/70">Crew &amp; schedule</span> at the bottom of the card opens the crew manager. The menu holds
            the rest: gear list, links, call sheet and production brief exports, duplicating a shoot
            for the next day, archiving it (kept, in the Archived folder at the bottom of the Slate),
            and deleting it.
          </p>
        </div>
      )
    },
    {
      title: "The Library",
      subtitle: "Everything the rest of the app refers to",
      icon: Library,
      content: (
        <div className="space-y-4 max-h-[350px] overflow-y-auto no-scrollbar pr-1">
          <p className="text-sm text-white/70 leading-relaxed">
            Projects and shoots in one place — for when you want to tidy up, rename something,
            or add a lot at once. Clients are kept in the Rolodex; the gear catalogue in the Gear Builder.
          </p>
          <ul className="text-xs text-white/60 space-y-2 list-disc list-inside">
            <li>Search across both at once. Looking for &ldquo;Hudson&rdquo; finds the project and the shoot together.</li>
            <li>Pick a record to see its details and what it&rsquo;s linked to — a project walks to its shoots.</li>
            <li>Sort shoots by date, client or status.</li>
            <li>Tick several rows to remove them together.</li>
          </ul>
          <div className="bg-amber-400/5 border border-amber-400/20 p-3 rounded-xl space-y-1.5">
            <h4 className="text-[10px] font-black uppercase text-amber-300/90">Before you delete</h4>
            <p className="text-[11px] text-white/60 leading-relaxed">
              Removing a project <span className="text-white">unlinks</span> its shoots — they stay.
              Deleting a <span className="text-white">shoot</span> is different: its crew, schedule, shot list
              and budget go with it, and it&rsquo;s cleared from Google Calendar. The confirmation always says which.
            </p>
          </div>
        </div>
      )
    },
    {
      title: "Team Channel Alerts",
      subtitle: "Discord, Slack or Teams",
      icon: MessageSquare,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-white/70 leading-relaxed">
            Keep the team aligned without anyone having to check the app. Studio OS posts to the channels you add — Discord, Slack or Microsoft Teams.
          </p>
          <div className="bg-white/5 border border-white/15 p-4 rounded-xl space-y-3">
            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
              Alerts you can switch on
            </h4>
            <div className="grid grid-cols-2 gap-2.5 text-xs text-white/60 font-semibold">
              <div className="flex items-center gap-1.5">✓ New production</div>
              <div className="flex items-center gap-1.5">✓ Status changes</div>
              <div className="flex items-center gap-1.5">✓ Edit ready for review</div>
              <div className="flex items-center gap-1.5">✓ Edit delivered</div>
            </div>
          </div>
          <p className="text-[10px] text-white/40 italic">
            Add channels and choose which alerts go where under Settings → Integrations.
          </p>
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
          <EscapeToClose onClose={onClose} />
          {/* Main Modal Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="w-full max-w-xl bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative flex flex-col justify-between overflow-hidden min-h-[460px]"
          >
            {/* Top glowing line decoration */}
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />
            
            {/* Close Button */}
            <button aria-label="Close" title="Close" 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step Header */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20 shrink-0">
                <StepIcon className="w-6 h-6 text-accent animate-pulse" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black uppercase tracking-tighter text-white truncate">
                  {steps[currentStep].title}
                </h3>
                <p className="text-[11px] md:text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 mt-0.5 truncate">
                  {steps[currentStep].subtitle}
                </p>
              </div>
            </div>

            {/* Slide Body */}
            <div className="flex-1 mb-8 flex flex-col justify-center">
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
            <div className="flex items-center justify-between border-t border-white/5 pt-5 shrink-0">
              {/* Slide dots */}
              <div className="flex gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep ? 'w-6 bg-accent' : 'w-1.5 bg-white/10 hover:bg-white/35'
                    }`}
                  />
                ))}
              </div>

              {/* Navigation buttons */}
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl text-[11px] md:text-[9px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
                
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-accent hover:bg-white hover:text-black text-white rounded-xl text-[11px] md:text-[9px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-accent/15"
                >
                  {currentStep === steps.length - 1 ? 'Finish Tour' : 'Next'} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- INLINE CHEATSHEET WIDGET ---
export function QuickStartWidget() {
  return (
    <div className="w-full h-full flex flex-col p-5 bg-neutral-950/20 text-white min-h-[300px] overflow-y-auto no-scrollbar">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4 shrink-0">
        <HelpCircle className="w-4 h-4 text-accent" />
        <h4 className="text-[10px] font-black uppercase tracking-widest">Quick Start Cheatsheet</h4>
      </div>

      <div className="space-y-6 text-xs text-white/70">
        {/* Layout management card */}
        <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-white/5 pb-1.5">
            <Columns className="w-4.5 h-4.5 text-accent" />
            <h5 className="text-[10px] font-black uppercase text-white">Layout Splits & Resizing</h5>
          </div>
          <ul className="space-y-2 text-white/60 leading-relaxed list-disc list-inside">
            <li>
              Click <strong className="text-white">Edit layout</strong> in the header, then <strong className="text-white">Columns (vertical split)</strong> or <strong className="text-white">Rows (horizontal split)</strong> on a panel to divide the workspace view.
            </li>
            <li>
              Drag the dark borders/dividers between panels to resize them.
            </li>
            <li>
              While editing the layout, click <strong className="text-white">Reset</strong> in the header to revert any screen splitting back to defaults.
            </li>
          </ul>
        </div>

        {/* Integration cheatsheet */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-2">
            <h5 className="text-[11px] md:text-[9px] font-black uppercase text-accent tracking-widest">Calendar Webcal</h5>
            <p className="text-[11px] leading-relaxed text-white/60">
              Click the Calendar Sync button in the header to copy the ICS subscription URL to keep your devices synced.
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-2">
            <h5 className="text-[11px] md:text-[9px] font-black uppercase text-accent tracking-widest">Google Two-Way Sync</h5>
            <p className="text-[11px] leading-relaxed text-white/60">
              Connect your account, then events created on Google Calendar prefixed with <span className="text-white font-bold">🎥</span> automatically sync back to your Production Slate.
            </p>
          </div>
        </div>

        {/* Shortcuts / Quick Actions */}
        <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-3">
          <h5 className="text-[10px] font-black uppercase text-white border-b border-white/5 pb-1.5">Shortcut Operations</h5>
          <div className="space-y-2 text-white/60">
            <div className="flex justify-between border-b border-white/5 py-1 text-[11px]">
              <span className="font-bold">Reset Split View</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] md:text-[8px] font-bold text-white">Edit layout → Reset</span>
            </div>
            <div className="flex justify-between border-b border-white/5 py-1 text-[11px]">
              <span className="font-bold">Add Web Embed Tab</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] md:text-[8px] font-bold text-white">Plus Icon &gt; Web Embed</span>
            </div>
            <div className="flex justify-between border-b border-white/5 py-1 text-[11px]">
              <span className="font-bold">Link Gear builder from Slate</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] md:text-[8px] font-bold text-white">Slate &gt; Click &quot;Build Gear&quot;</span>
            </div>
            <div className="flex justify-between py-1 text-[11px]">
              <span className="font-bold">CRM Contacts database</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] md:text-[8px] font-bold text-white">Rolodex Panel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
