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
  Briefcase,
  Scissors,
  Package,
  Users,
  Sparkles,
  Calendar,
  NotebookPen,
  SlidersHorizontal,
  Upload,
  Timer,
  HardDrive,
  UserCog,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

// One tour per kind of account. Admins and staff run the whole studio; a
// freelance editor's account opens on the Edit Tracker and reaches nothing but
// that and the Drive Tracker (src/lib/roles.ts), so the full tour mostly
// described screens they can't open. Each list covers only what its reader
// can actually do, as of PRs #100–#115.

interface TourStep {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  content: React.ReactNode;
}

interface QuickStartGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalendarSync: () => void;
  /** Picks the tour. Null while the role is still loading: the team tour shows. */
  userRole?: string | null;
}

/** A row in a step: icon, short heading, one or two sentences. */
function Item({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start bg-white/5 p-3 rounded-xl border border-white/5">
      <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
      <div className="min-w-0">
        <h5 className="text-[13px] font-semibold text-white leading-snug">{title}</h5>
        <p className="text-xs text-white/60 leading-relaxed mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-white/70 leading-relaxed">{children}</p>;
}

function Points({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="text-xs text-white/60 space-y-2 list-disc list-outside pl-4 leading-relaxed">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

const B = ({ children }: { children: React.ReactNode }) => <strong className="text-white font-semibold">{children}</strong>;

function teamSteps(onOpenCalendarSync: () => void): TourStep[] {
  return [
    {
      title: 'Welcome to Studio OS',
      subtitle: 'The studio’s shared workspace',
      icon: Sparkles,
      content: (
        <div className="space-y-3">
          <Lead>
            Every production in one place — the Slate, the Edit Tracker, gear, crew, the calendar and notes — saved for the whole team as you work.
          </Lead>
          <Item icon={LayoutGrid} title="Start on the Dashboard">
            <B>This week</B> lists what’s shooting, edits that are due, past shoots to close out and the drives that have been out longest.
          </Item>
          <Item icon={HelpCircle} title="Find anything">
            Press <B>⌘K</B> or the magnifier to search productions, contacts, clients and features. A contact opens straight to their card.
          </Item>
          <Item icon={Columns} title="The sidebar learns">
            The tabs the team opens most move to the top on their own.
          </Item>
          <p className="text-[11px] text-white/45 leading-relaxed">
            If a save ever fails you’ll see a red message and the screen puts itself back, so nothing quietly disappears.
          </p>
        </div>
      ),
    },
    {
      title: 'Productions on the Slate',
      subtitle: 'From the first hold to the wrap',
      icon: Briefcase,
      content: (
        <div className="space-y-3">
          <Points items={[
            <><B>New production</B> takes the client, dates, call and wrap times and the location. The status chip on a card moves it from Hold to Booked in one tap.</>,
            <>Each card shows its crew, its deliverables and its billing (read from QuickBooks once connected — nothing is written back).</>,
            <><B>Crew &amp; schedule</B> opens the crew manager, which warns when someone is already booked on another shoot at the same time.</>,
            <>The card menu holds the gear list, links, call sheet and brief PDFs, <B>Duplicate</B> for the next day, <B>Archive</B> (kept in the Archived folder at the bottom) and <B>Delete</B>.</>,
            <>When a shoot is over, close it out from the Dashboard: <B>Mark wrapped</B>, or <B>Wrapped, add to edit board</B> if it goes to post.</>,
          ]} />
        </div>
      ),
    },
    {
      title: 'Post on the Edit Tracker',
      subtitle: 'Every cut, every version',
      icon: Scissors,
      content: (
        <div className="space-y-3">
          <Points items={[
            <><B>+ Add production</B> pulls a shoot from the Slate onto the board. Drag cards between stages; <B>Columns</B> renames or adds stages for everyone (admins only).</>,
            <>Switch between <B>Board</B> and <B>Timeline</B>, show <B>My cards</B> only, filter by client, project or year, and size cards <B>S / M / L</B>.</>,
            <>Editors post each cut on its card. Version numbers count themselves and the newest becomes the review link; posting V1 offers to move the card to review, which alerts the team.</>,
            <>Editors log hours with a timer or by adding minutes, and the total shows on the card.</>,
            <>Deliverable chips step through <B>To do</B>, <B>In progress</B> and <B>Delivered</B>, here and on the Slate.</>,
          ]} />
          <p className="text-[11px] text-white/45 leading-relaxed">
            A freelance editor’s account sees only their own cards, plus the Drive Tracker.
          </p>
        </div>
      ),
    },
    {
      title: 'Gear',
      subtitle: 'Lists, clashes and sharing',
      icon: Package,
      content: (
        <div className="space-y-3">
          <Points items={[
            <>Pick a production to build its gear list, or start a <B>one-off list</B> that never touches the Slate. <B>Save draft</B> keeps it for later, on any of your devices.</>,
            <>It warns when another shoot that day needs the same gear and there isn’t enough to go round.</>,
            <>Export a PDF, or share a live link the crew can open without signing in.</>,
            <>Owners you type are remembered, so the next list fills them in.</>,
          ]} />
        </div>
      ),
    },
    {
      title: 'People and clients',
      subtitle: 'The Rolodex',
      icon: Users,
      content: (
        <div className="space-y-3">
          <Points items={[
            <>Crew and contractors with their roles, rates and contact details. Each card lists what that person is booked on.</>,
            <>Clients live here too. Rename one and every production follows; link it to its QuickBooks customer to see billing on the Slate.</>,
            <><B>Import</B> brings in contacts from a spreadsheet or clients from QuickBooks, and possible duplicates are offered for merging.</>,
          ]} />
        </div>
      ),
    },
    {
      title: 'Calendar and Google',
      subtitle: 'Both directions, automatically',
      icon: Calendar,
      content: (
        <div className="space-y-3">
          <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-[13px] font-semibold text-white">Google sync</h4>
              <button
                onClick={onOpenCalendarSync}
                className="px-3 py-1.5 bg-accent/20 hover:bg-accent border border-accent/30 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
              >
                Set it up
              </button>
            </div>
            <Points items={[
              <>Connect Google once. Saving a production puts it on the studio calendar with the crew, call time and location written into the event.</>,
              <>Events added in Google whose titles start with <B>🎥</B> come in as productions; anything else shows as a marker.</>,
            ]} />
          </div>
          <Points items={[
            <>Click a day for a quick marker — <B>Hold</B>, <B>Out of office</B>, <B>Booked</B>, <B>Meeting</B> — or <B>New production</B> with that date filled in.</>,
            <>The subscription link gives any calendar app a private, read-only copy. Share it only with the team.</>,
            <>On a phone the calendar opens as an agenda; the toggle at the top switches to the month grid.</>,
          ]} />
        </div>
      ),
    },
    {
      title: 'Notes, briefs and records',
      subtitle: 'Shared with the team',
      icon: NotebookPen,
      content: (
        <div className="space-y-3">
          <Points items={[
            <><B>Meeting notes</B> are kept per client and save as you type — the footer says <B>Synced</B>, or <B>Not saved</B> if something went wrong.</>,
            <><B>Client onboarding</B> holds creative briefs; <B>Locations</B> holds scouting notes on permits, power and parking.</>,
            <><B>Vault</B> stores encrypted logins and notes — your own, plus a shared vault for the people you choose.</>,
            <><B>Library</B> is for tidying: browse, rename and remove projects and shoots, several at once if you tick them.</>,
          ]} />
        </div>
      ),
    },
    {
      title: 'Make it yours',
      subtitle: 'Layout, settings and alerts',
      icon: SlidersHorizontal,
      content: (
        <div className="space-y-3">
          <Item icon={Columns} title="Edit layout">
            In the top bar. Split panels, add tabs or web embeds, reorder the sidebar, or <B>Reset</B>. Click <B>Done</B> when you’re finished.
          </Item>
          <Item icon={UserCog} title="Settings">
            Click your name at the top right for your profile, password and appearance (light, dim or dark). Admins also get branding, integrations and the team list.
          </Item>
          <Item icon={Sparkles} title="Team alerts">
            Under <B>Settings → Integrations</B>, add a Discord, Slack or Teams channel and choose which events post there — new productions, status changes, edits ready and delivered.
          </Item>
        </div>
      ),
    },
  ];
}

const editorSteps: TourStep[] = [
  {
    title: 'Welcome',
    subtitle: 'Your edit board',
    icon: Sparkles,
    content: (
      <div className="space-y-3">
        <Lead>
          Your account has two screens: the <B>Edit Tracker</B>, where you land, and the <B>Drive Tracker</B>. You’ll see the productions you’ve been assigned.
        </Lead>
        <Points items={[
          <>Everything saves for the studio as you work. If a save fails you’ll see a red message and the screen puts itself back.</>,
          <>Open this guide again any time from the <B>?</B> in the top bar.</>,
        ]} />
      </div>
    ),
  },
  {
    title: 'Your cards',
    subtitle: 'Stages and views',
    icon: Scissors,
    content: (
      <div className="space-y-3">
        <Points items={[
          <>Each column is a stage. Drag a card to move it along — the producer sees the change straight away.</>,
          <>Switch between <B>Board</B> and <B>Timeline</B> (ordered by due date), filter by client, project or year, and size cards <B>S / M / L</B> on a larger screen.</>,
          <>Open a card for its notes, <B>Checklist</B>, <B>Deliverables</B> and links. Tap a deliverable’s chip to move it from <B>To do</B> to <B>In progress</B> to <B>Delivered</B>.</>,
        ]} />
      </div>
    ),
  },
  {
    title: 'Posting a cut',
    subtitle: 'Versions count themselves',
    icon: Upload,
    content: (
      <div className="space-y-3">
        <Points items={[
          <>On the card, under <B>Drafts</B>, give the cut a title, paste its link (Vimeo, Frame.io, Drive…) and post it.</>,
          <>The version number counts itself — V1, V2, V3 — and the newest becomes the review link everywhere the studio looks.</>,
          <>After you post, the card offers to move to review. That’s what tells the producer it’s ready to watch.</>,
        ]} />
      </div>
    ),
  },
  {
    title: 'Logging time',
    subtitle: 'Hours on each card',
    icon: Timer,
    content: (
      <div className="space-y-3">
        <Points items={[
          <>Press <B>Start timer</B> on the card when you begin and <B>Stop</B> when you’re done. The total shows on the card.</>,
          <>Forgot to stop? The timer closes itself after 12 hours, and you can add the real time by hand.</>,
          <>To log time afterwards, add the minutes with an optional note.</>,
        ]} />
      </div>
    ),
  },
  {
    title: 'Drives',
    subtitle: 'Who has what',
    icon: HardDrive,
    content: (
      <div className="space-y-3">
        <Points items={[
          <>The <B>Drive Tracker</B> lists the studio’s drives and who has each one.</>,
          <><B>Check out</B> a drive when you take it. When you hand it on, use its menu — <B>Back with…</B> or <B>Change who has it</B> — so the next person can find it.</>,
          <><B>History</B> on a drive shows everywhere it has been.</>,
        ]} />
      </div>
    ),
  },
  {
    title: 'Your account',
    subtitle: 'Profile, password and appearance',
    icon: UserCog,
    content: (
      <div className="space-y-3">
        <Points items={[
          <>Click your name at the top right for <B>Settings</B>: your name, photo and phone number.</>,
          <><B>Password</B> is at the bottom of the profile — it asks for your current one first, and can sign you out of your other devices.</>,
          <><B>Appearance</B> switches between light, dim and dark, or follows your device.</>,
        ]} />
      </div>
    ),
  },
];

export function QuickStartGuideModal({
  isOpen,
  onClose,
  onOpenCalendarSync,
  userRole,
}: QuickStartGuideModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = userRole === 'editor' ? editorSteps : teamSteps(onOpenCalendarSync);
  // The guide can open before the role has loaded (first visit) and switch
  // tours underneath; keep the step inside the shorter list.
  const stepIndex = Math.min(currentStep, steps.length - 1);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const handleNext = () => {
    if (!isLast) setCurrentStep(stepIndex + 1);
    else onClose();
  };

  const handleBack = () => {
    if (stepIndex > 0) setCurrentStep(stepIndex - 1);
  };

  const StepIcon = step.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <EscapeToClose onClose={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            role="dialog"
            aria-label="Quick start guide"
            className="w-full max-w-xl max-h-[90dvh] bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative flex flex-col overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent" />

            <button
              aria-label="Close"
              title="Close"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step header */}
            <div className="flex items-center gap-3.5 mb-5 pr-8 shrink-0">
              <div className="w-11 h-11 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20 shrink-0">
                <StepIcon className="w-5 h-5 text-accent" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold tracking-tight text-white leading-tight">{step.title}</h3>
                <p className="text-xs text-white/45 mt-0.5">{step.subtitle}</p>
              </div>
            </div>

            {/* Step body — scrolls on short screens instead of growing past them */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mb-6 -mr-2 pr-2">
              <motion.div
                key={`${userRole === 'editor' ? 'e' : 't'}-${stepIndex}`}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
              >
                {step.content}
              </motion.div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-5 shrink-0">
              <div className="flex gap-1.5 flex-wrap">
                {steps.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    aria-current={i === stepIndex ? 'step' : undefined}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === stepIndex ? 'w-6 bg-accent' : 'w-1.5 bg-white/10 hover:bg-white/35'
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2 shrink-0">
                {stepIndex > 0 && (
                  <button
                    onClick={handleBack}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" /> Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-accent hover:bg-white hover:text-black text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-accent/15"
                >
                  {isLast ? 'Done' : 'Next'} {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
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
// A panel admins and staff can keep open beside their work (editors can't
// mount it). The short version of the team tour.
export function QuickStartWidget() {
  const rows: { label: string; how: string }[] = [
    { label: 'Search anything', how: '⌘K' },
    { label: 'Close out a past shoot', how: 'Dashboard → This week' },
    { label: 'Duplicate a shoot for the next day', how: 'Slate card → menu' },
    { label: 'Archive a production', how: 'Slate card → menu' },
    { label: 'One-off gear list', how: 'Gear Builder → One-off' },
    { label: 'Split a panel or add an embed', how: 'Edit layout' },
    { label: 'Calendar subscription link', how: 'Calendar sync icon' },
    { label: 'Team alerts', how: 'Settings → Integrations' },
    { label: 'Change your password', how: 'Settings → Profile' },
  ];
  return (
    <div className="w-full h-full flex flex-col p-5 bg-neutral-950/20 text-white min-h-[300px] overflow-y-auto no-scrollbar">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4 shrink-0">
        <HelpCircle className="w-4 h-4 text-accent" />
        <h4 className="text-sm font-semibold">Quick start</h4>
      </div>

      <div className="space-y-4 text-xs text-white/70">
        <div className="bg-white/5 border border-white/5 p-4 rounded-xl">
          <h5 className="text-[13px] font-semibold text-white mb-2">Where things are</h5>
          <div className="divide-y divide-white/5">
            {rows.map(r => (
              <div key={r.label} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-white/70">{r.label}</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[11px] font-medium text-white shrink-0">{r.how}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-1.5">
            <h5 className="text-[13px] font-semibold text-white">Google two-way sync</h5>
            <p className="text-[11px] leading-relaxed text-white/60">
              Saved productions go to the studio calendar. Google events titled with a leading <span className="text-white">🎥</span> come back as productions.
            </p>
          </div>
          <div className="bg-white/5 border border-white/5 p-4 rounded-xl space-y-1.5">
            <h5 className="text-[13px] font-semibold text-white">Layouts</h5>
            <p className="text-[11px] leading-relaxed text-white/60">
              Drag the dividers between panels to resize them. <span className="text-white">Edit layout → Reset</span> puts a tab back to its defaults.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
