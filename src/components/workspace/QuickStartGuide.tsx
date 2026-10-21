'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import GuidedTour, { type TourHost, type TourStep } from './GuidedTour';

// The quick start guide is a guided tour of the real screens rather than a
// box of slides: the slides were text-heavy and hard to remember, where a
// spotlight on the actual button shows where it is. One sentence per stop.
//
// One tour per kind of account. Admins and staff run the whole studio; a
// freelance editor's account reaches only the Edit Tracker and the Drive
// Tracker (src/lib/roles.ts). Stops whose tab or button an account can't see
// are skipped by the tour itself, so a client or a narrow phone gets a
// shorter walk rather than arrows at nothing.

const EDIT_CARD = { click: 'edit-card', container: 'edit-card-sheet' };

export const TEAM_TOUR: TourStep[] = [
  { id: 'welcome', title: 'Quick tour', body: 'A one-minute look around. Use Next, or the ← → keys.' },
  { id: 'sidebar', target: 'sidebar', inSidebar: true, title: 'Your tabs', body: 'Everything lives here. The tabs your team uses most rise to the top.' },
  { id: 'search', target: 'search', title: 'Search', body: 'Find any production, person or client. Shortcut: ⌘K.' },
  { id: 'week', tab: 'dashboard', target: 'this-week', title: 'This week', body: 'What’s shooting, what’s due, and past shoots to close out.' },
  { id: 'slate-new', tab: 'slate', target: 'slate-new', title: 'The Slate', body: 'Every production starts here.' },
  { id: 'slate-menu', tab: 'slate', target: 'dropdown-menu', opens: { click: 'slate-card-menu', container: 'dropdown-menu' }, title: 'Card menu', body: 'Gear list, call sheet, duplicate for the next day, archive.' },
  { id: 'slate-crew', tab: 'slate', target: 'slate-crew', title: 'Crew & schedule', body: 'Book people — it flags anyone already booked elsewhere.' },
  { id: 'edits-board', tab: 'edits', target: 'edits-column', title: 'Edit board', body: 'Each column is a stage. Drag cards along as the edit moves.' },
  { id: 'edits-views', tab: 'edits', target: 'edits-views', title: 'Views and filters', body: 'Board or timeline, just your cards, filters and card size.' },
  { id: 'card-drafts', tab: 'edits', target: 'card-drafts', opens: EDIT_CARD, title: 'Cuts', body: 'Editors post each version here. The numbers count themselves.' },
  { id: 'card-timer', tab: 'edits', target: 'card-timer', opens: EDIT_CARD, title: 'Hours', body: 'Time logged on the card, by timer or by hand.' },
  { id: 'gear', tab: 'gear', target: 'gear-start', title: 'Gear lists', body: 'Build a gear list for a shoot, or a one-off that never touches the Slate.' },
  { id: 'rolodex', tab: 'rolodex', target: 'rolodex-tabs', title: 'Rolodex', body: 'Crew and clients. Click any name for their card.' },
  { id: 'calendar', tab: 'calendar', target: 'calendar-main', title: 'Calendar', body: 'Switch months here. Click any day to add a hold, a meeting or a production.' },
  { id: 'google', target: 'calendar-sync', title: 'Google Calendar', body: 'Connect Google, and copy the private subscription link.' },
  { id: 'layout', target: 'edit-layout', title: 'Make it yours', body: 'Split panels, add tabs and reorder the sidebar.' },
  { id: 'settings', target: 'settings', title: 'Settings', body: 'Profile, password and theme. Admins also set up alerts and the team.' },
  { id: 'help', target: 'help', title: 'Replay any time', body: 'This button brings the tour back.' },
];

export const EDITOR_TOUR: TourStep[] = [
  { id: 'welcome', title: 'Quick tour', body: 'A one-minute look at your edit board. Use Next, or ← →.' },
  { id: 'edits-board', tab: 'edits', target: 'edits-column', title: 'Stages', body: 'Each column is a stage. Drag your card along as you work.' },
  { id: 'edits-views', tab: 'edits', target: 'edits-views', title: 'Views and filters', body: 'Board or timeline, filters and card size.' },
  { id: 'card-drafts', tab: 'edits', target: 'card-drafts', opens: EDIT_CARD, title: 'Post a cut', body: 'Paste the link and post it. Versions number themselves.' },
  { id: 'card-timer', tab: 'edits', target: 'card-timer', opens: EDIT_CARD, title: 'Your hours', body: 'Start the timer when you begin; stop it when you’re done.' },
  { id: 'drives-tab', target: 'tab-drives', inSidebar: true, title: 'Drives', body: 'The Drive Tracker shows who has each drive.' },
  { id: 'drive-checkout', tab: 'drives', target: 'drive-checkout', title: 'Check out', body: 'Check a drive out when you take it.' },
  { id: 'settings', target: 'settings', title: 'Your account', body: 'Profile and password live here.' },
  { id: 'help', target: 'help', title: 'Replay any time', body: 'This button brings the tour back.' },
];

interface QuickStartGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Picks the tour. The tour waits until the role has loaded. */
  userRole?: string | null;
  /** How the tour moves around the app: tabs, the phone drawer. */
  host: TourHost;
}

export function QuickStartGuideModal({ isOpen, onClose, userRole, host }: QuickStartGuideModalProps) {
  // On a first visit this opens before the role is known; starting then would
  // pick the wrong tour and point at tabs that are about to change.
  if (!isOpen || !userRole) return null;
  return <GuidedTour steps={userRole === 'editor' ? EDITOR_TOUR : TEAM_TOUR} host={host} onClose={onClose} />;
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
    { label: 'Map of every shoot and scout', how: 'Locations → Map' },
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
