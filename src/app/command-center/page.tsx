'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  Lock,
  ChevronLeft,
  Menu,
  X,
  LogOut,
  ExternalLink,
  User as UserIcon,
  Mail,
  Check,
  Copy,
  RefreshCw,
  Plus,
  GripVertical,
  Settings,
  HelpCircle,
  RotateCcw,
  Search,
  AlertTriangle
} from 'lucide-react';

// "2m ago" / "3h ago" / "Jul 12" for the sync-health chip.
function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/lib/supabase';
import { trackView, trackAction } from '@/lib/usage';
import { getBranding } from '@/lib/branding';
import { applyAccent } from '@/lib/brand-theme';
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout';
import ProfileSettings from '@/components/workspace/ProfileSettings';
import SearchPalette from '@/components/workspace/SearchPalette';
import { loadOrgPref, saveOrgPref } from '@/lib/team-prefs';
import { QuickStartGuideModal } from '@/components/workspace/QuickStartGuide';
import {
  CONFIGURABLE_ROLES,
  ROLE_LABELS,
  canAccessTab,
  defaultTabForRole,
  isScopedRole,
  type AppRole,
} from '@/lib/roles';

interface CustomTab {
  id: string;
  label: string;
  iconName: string;
  type: 'workspace' | 'embed' | 'notes' | 'system';
  embedUrl?: string;
  isDefault?: boolean;
  // Only the configurable roles appear here. Scoped roles (freelance editor)
  // are whitelisted in src/lib/roles.ts instead, so no tab setting can hand
  // one the rest of the OS — or lock them out of the board they were hired for.
  allowedRoles?: AppRole[];
}

const SELECTABLE_ICONS = [
  // Overview & data
  { name: 'LayoutDashboard', label: 'Dashboard', desc: 'At-a-glance overview panel' },
  { name: 'BarChart3', label: 'Analytics', desc: 'Track performance and trends' },
  { name: 'PieChart', label: 'Reports', desc: 'Visual summary breakdowns' },
  { name: 'TrendingUp', label: 'Metrics', desc: 'Key numbers over time' },
  // Planning
  { name: 'Calendar', label: 'Calendar', desc: 'Dates, events and deadlines' },
  { name: 'Clock', label: 'Schedule', desc: 'Shoot times and shifts' },
  { name: 'ListTodo', label: 'Tasks', desc: 'Running to-do list' },
  { name: 'CheckSquare', label: 'Checklist', desc: 'Step-by-step completion items' },
  { name: 'Kanban', label: 'Board', desc: 'Cards across status columns' },
  { name: 'Briefcase', label: 'Projects', desc: 'Active jobs and engagements' },
  // People
  { name: 'Users', label: 'Team', desc: 'Crew and staff roster' },
  { name: 'Building2', label: 'Clients', desc: 'Client accounts and contacts' },
  { name: 'MessageSquare', label: 'Chat', desc: 'Team messages and threads' },
  { name: 'Mail', label: 'Inbox', desc: 'Incoming mail and requests' },
  { name: 'Phone', label: 'Contacts', desc: 'Phone numbers and directory' },
  // Money
  { name: 'DollarSign', label: 'Budget', desc: 'Spend and cost tracking' },
  { name: 'Receipt', label: 'Invoices', desc: 'Bills sent to clients' },
  { name: 'CreditCard', label: 'Payments', desc: 'Incoming and outgoing payments' },
  // Production
  { name: 'Camera', label: 'Photo', desc: 'Photography shoots and stills' },
  { name: 'Clapperboard', label: 'Production', desc: 'On-set production planning' },
  { name: 'Film', label: 'Footage', desc: 'Raw clips and reels' },
  { name: 'Video', label: 'Video', desc: 'Video deliverables and links' },
  { name: 'Mic', label: 'Audio', desc: 'Sound, voiceover and music' },
  { name: 'Palette', label: 'Creative', desc: 'Concepts, mood and design' },
  { name: 'Scissors', label: 'Edits', desc: 'Cuts in post-production' },
  { name: 'Package', label: 'Gear', desc: 'Equipment and kit inventory' },
  // Files & links
  { name: 'FolderOpen', label: 'Files', desc: 'Documents and shared assets' },
  { name: 'FileText', label: 'Notes', desc: 'Meeting notes library, sorted by client & production' },
  { name: 'Image', label: 'Media', desc: 'Image and graphic library' },
  { name: 'Link', label: 'Link', desc: 'Embedded external web tool' },
  { name: 'Globe', label: 'Website', desc: 'Live site or landing page' },
  { name: 'Upload', label: 'Uploads', desc: 'Drop and share files' },
  // Status & misc
  { name: 'Star', label: 'Favorites', desc: 'Pinned, important items' },
  { name: 'Flag', label: 'Priority', desc: 'Urgent, flagged items' },
  { name: 'Lock', label: 'Vault', desc: 'Secure, restricted files' },
  { name: 'Settings', label: 'Settings', desc: 'Configuration and preferences' }
];

// Shared icon picker grid with a styled hover tooltip (label + short explainer)
function IconPickerGrid({ selected, onSelect }: { selected: string; onSelect: (name: string) => void }) {
  const resolve = (name: string) => (LucideIcons as any)[name] || LucideIcons.Layout;
  return (
    <div className="grid grid-cols-6 gap-1.5 bg-black/40 border border-white/5 p-2 rounded-xl">
      {SELECTABLE_ICONS.map(ico => {
        const Icon = resolve(ico.name);
        const isActive = selected === ico.name;
        return (
          <div key={ico.name} className="relative group flex">
            <button
              type="button"
              onClick={() => onSelect(ico.name)}
              className={`w-full p-2 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-accent text-white scale-110 shadow-lg shadow-accent/20'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <div className="bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl text-center">
                <div className="text-[10px] font-black uppercase tracking-wider text-white leading-tight">{ico.label}</div>
                <div className="text-[11px] md:text-[9px] font-medium text-white/50 leading-snug mt-0.5">{ico.desc}</div>
              </div>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45"></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// The real, working tools a custom workspace can open with. These are the
// widget ids WorkspaceLayout actually renders — the picker below only offers
// these, so a new tab never promises a tool that doesn't exist.
const STARTER_TOOLS: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'slate', label: 'Production Slate' },
  { id: 'edits', label: 'Edit Tracker' },
  { id: 'gear', label: 'Gear Builder' },
  { id: 'creative', label: 'Creative Board' },
  { id: 'social', label: 'Social Media' },
  { id: 'rolodex', label: 'Rolodex' },
  { id: 'inbox', label: 'Studio Inbox' },
  { id: 'vault', label: 'Vault' },
  { id: 'notes', label: 'Scratch Notes' },
  { id: 'script', label: 'Script & Teleprompter' },
  { id: 'clock', label: 'Production Timer' },
  { id: 'budget', label: 'Budget Tracker' },
  { id: 'tasks', label: 'Task List' },
  { id: 'mywork', label: 'My Work' },
  { id: 'docs', label: 'Notes Library' },
];

// Picking an icon pre-selects the closest real tool(s), so "Budget" doesn't
// silently create an empty page. Icons with no matching tool suggest Notes.
const ICON_TOOL_SUGGESTIONS: Record<string, string[]> = {
  LayoutDashboard: ['dashboard'], BarChart3: ['dashboard'], PieChart: ['dashboard'], TrendingUp: ['dashboard'],
  Calendar: ['calendar'], Clock: ['clock'], ListTodo: ['tasks'], CheckSquare: ['tasks'],
  Kanban: ['edits'], Briefcase: ['slate'],
  Users: ['rolodex'], Building2: ['rolodex'], MessageSquare: ['inbox'], Mail: ['inbox'], Phone: ['rolodex'],
  DollarSign: ['budget'], Receipt: ['budget'], CreditCard: ['budget'],
  Camera: ['slate', 'gear'], Clapperboard: ['slate'], Film: ['edits'], Video: ['edits'],
  Mic: ['script'], Palette: ['creative'], Scissors: ['edits'], Package: ['gear'],
  FolderOpen: ['docs'], FileText: ['docs'], Image: ['creative'], Upload: ['docs'],
  Star: ['mywork'], Flag: ['mywork'], Lock: ['vault'], Settings: ['dashboard'],
};

const DEFAULT_TABS: CustomTab[] = [
  { id: 'dashboard', label: 'Dashboard', iconName: 'LayoutDashboard', type: 'system', isDefault: true, allowedRoles: ['admin'] },
  { id: 'calendar', label: 'Calendar', iconName: 'Calendar', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff', 'client'] },
  { id: 'slate', label: 'Slate', iconName: 'Briefcase', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff', 'client'] },
  { id: 'edits', label: 'Edit Tracker', iconName: 'Scissors', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff', 'client'] },
  { id: 'gear', label: 'Gear Builder', iconName: 'Package', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff'] },
  { id: 'creative', label: 'Creative Board', iconName: 'Palette', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff'] },
  { id: 'social', label: 'Social Media', iconName: 'Share2', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff'] },
  { id: 'inbox', label: 'Inbox', iconName: 'Mail', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff'] },
  { id: 'rolodex', label: 'Rolodex', iconName: 'Users', type: 'system', isDefault: true, allowedRoles: ['admin'] },
  { id: 'vault', label: 'Vault', iconName: 'Lock', type: 'system', isDefault: true, allowedRoles: ['admin', 'staff'] },
  { id: 'library', label: 'Library', iconName: 'Library', type: 'system', isDefault: true, allowedRoles: ['admin'] },
  { id: 'usage', label: 'Usage', iconName: 'Activity', type: 'system', isDefault: true, allowedRoles: ['admin'] },
  { id: 'integrations', label: 'Integrations', iconName: 'Plug', type: 'system', isDefault: true, allowedRoles: ['admin'] }
];

export default function CommandCenterPage() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const loadedUserRef = useRef<string | null>(null);
  const [layoutResetNonce, setLayoutResetNonce] = useState<number>(0);
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isQuickStartOpen, setIsQuickStartOpen] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTabToEdit, setSelectedTabToEdit] = useState<CustomTab | null>(null);

  // Form states for creation
  const [newTabLabel, setNewTabLabel] = useState('');
  const [newTabIcon, setNewTabIcon] = useState('LayoutDashboard');
  const [newTabType, setNewTabType] = useState<'workspace' | 'embed' | 'notes'>('workspace');
  const [newTabUrl, setNewTabUrl] = useState('');
  const [newTabRoles, setNewTabRoles] = useState<AppRole[]>(['admin', 'staff']);
  // Which real tools the new workspace opens with. Auto-suggested from the
  // chosen icon until the user hand-picks (then their choice wins).
  const [newTabTools, setNewTabTools] = useState<string[]>(['notes']);
  const [newTabToolsTouched, setNewTabToolsTouched] = useState(false);
  // Tracks whether the user typed their own label; until then, picking an
  // icon autofills the workspace name with the icon's label.
  const [newTabLabelTouched, setNewTabLabelTouched] = useState(false);
  // Full starter-tool checklist is collapsed behind "Change" to keep the
  // create modal short.
  const [showToolPicker, setShowToolPicker] = useState(false);

  // Form states for editing
  const [editTabLabel, setEditTabLabel] = useState('');
  const [editTabIcon, setEditTabIcon] = useState('LayoutDashboard');
  const [editTabType, setEditTabType] = useState<'workspace' | 'embed' | 'notes'>('workspace');
  const [editTabUrl, setEditTabUrl] = useState('');
  const [editTabRoles, setEditTabRoles] = useState<AppRole[]>(['admin', 'staff']);

  const getIconComponent = (name: string) => {
    const Icon = (LucideIcons as any)[name];
    return Icon || LucideIcons.Layout;
  };

  const activeTabObj = tabs.find(t => t.id === activeTab);

  // Reset a specific tab's workspace layout to factory defaults
  const resetWorkspaceForTab = (tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const storageKey = `studio_workspace_layout_${tabId}`;
    localStorage.removeItem(storageKey);
    // Force a clean single remount of the active workspace so it reloads the
    // default layout. Bumping a nonce in the render key is deterministic —
    // unlike toggling activeTab through '', which AnimatePresence (mode="wait")
    // can coalesce and leave the stale panel mounted.
    if (activeTab === tabId) {
      setLayoutResetNonce(n => n + 1);
    }
  };

  // ⌘K / Ctrl+K opens smart search from anywhere in the command center.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Pull the org's brand color and re-skin the whole app to match. Cached in
  // localStorage by applyAccent, so subsequent loads (and other pages) pick it
  // up instantly via ThemeProvider before this fetch resolves.
  useEffect(() => {
    getBranding()
      .then((b) => { if (b.brand_color) applyAccent(b.brand_color); })
      .catch(() => { /* fall back to default accent */ });
  }, []);

  useEffect(() => {
    setIsMounted(true);

    // Load persisted active tab
    const savedActiveTab = localStorage.getItem('studio_active_tab');
    if (savedActiveTab) {
      setActiveTab(savedActiveTab);
    }

    // Merge in any newer built-in system tabs a saved list predates
    // (e.g. "social"), so existing users get them without losing custom
    // tabs or ordering.
    const mergeSystemTabs = (parsed: CustomTab[]): CustomTab[] => {
      const savedIds = new Set(parsed.map((t) => t.id));
      const missingSystemTabs = DEFAULT_TABS.filter((t) => t.type === 'system' && !savedIds.has(t.id));
      return missingSystemTabs.length ? [...parsed, ...missingSystemTabs] : parsed;
    };

    // Instant layer: this browser's saved tabs.
    const savedTabs = localStorage.getItem('custom_tabs_list');
    if (savedTabs) {
      try {
        setTabs(mergeSystemTabs(JSON.parse(savedTabs) as CustomTab[]));
      } catch (e) {
        setTabs(DEFAULT_TABS);
      }
    } else {
      setTabs(DEFAULT_TABS);
    }

    // Authoritative layer: the team's shared tab layout, so every device and
    // teammate sees the same Command Center. Fails soft pre-migration.
    loadOrgPref<CustomTab[]>('custom_tabs').then((orgTabs) => {
      if (orgTabs && Array.isArray(orgTabs) && orgTabs.length > 0) {
        const merged = mergeSystemTabs(orgTabs);
        setTabs(merged);
        localStorage.setItem('custom_tabs_list', JSON.stringify(merged));
      }
    });

    const seenQuickStart = localStorage.getItem('studio_seen_quickstart');
    if (!seenQuickStart) {
      localStorage.setItem('studio_seen_quickstart', 'true');
      setIsQuickStartOpen(true);
    }

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persist the tab layout: this browser immediately, the whole team's org
  // row in the background (fails soft pre-migration).
  const persistTabs = (items: CustomTab[]) => {
    // Was calling itself instead of writing to localStorage — every tab
    // create/edit/reorder recursed until the stack blew, so no layout (and no
    // role visibility set on it) ever survived a reload.
    localStorage.setItem('custom_tabs_list', JSON.stringify(items));
    saveOrgPref('custom_tabs', items);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(tabs);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTabs(items);
    persistTabs(items);
  };

  const handleCreateTab = () => {
    if (!newTabLabel.trim()) return;

    let embedUrl = newTabUrl.trim();
    if (newTabType === 'embed' && embedUrl && !/^https?:\/\//i.test(embedUrl)) {
      embedUrl = 'https://' + embedUrl;
    }

    const newTab: CustomTab = {
      id: 'custom_' + Date.now(),
      label: newTabLabel.trim(),
      iconName: newTabIcon,
      type: newTabType,
      embedUrl: newTabType === 'embed' ? embedUrl : undefined,
      allowedRoles: newTabRoles
    };

    // Seed the workspace with the chosen starter tools so the new tab opens
    // as a working panel — previously an unknown tab id fell back to the
    // Dashboard layout, which made every new tab look like a dashboard clone.
    if (newTabType === 'workspace') {
      const tools = newTabTools.length > 0 ? newTabTools : ['notes'];
      const seededLayout = {
        type: 'panel',
        id: `${newTab.id}-root`,
        activeTab: tools[0],
        tabs: tools,
      };
      localStorage.setItem(`studio_workspace_layout_${newTab.id}`, JSON.stringify(seededLayout));
    }

    const updated = [...tabs, newTab];
    setTabs(updated);
    persistTabs(updated);
    setActiveTab(newTab.id);
    localStorage.setItem('studio_active_tab', newTab.id);

    setNewTabLabel('');
    setNewTabIcon('LayoutDashboard');
    setNewTabType('workspace');
    setNewTabUrl('');
    setNewTabRoles(['admin', 'staff']);
    setNewTabTools(['notes']);
    setNewTabToolsTouched(false);
    setNewTabLabelTouched(false);
    setShowToolPicker(false);
    setIsCreateModalOpen(false);
  };

  const handleSaveEditTab = () => {
    if (!selectedTabToEdit) return;

    let embedUrl = editTabUrl.trim();
    if (editTabType === 'embed' && embedUrl && !/^https?:\/\//i.test(embedUrl)) {
      embedUrl = 'https://' + embedUrl;
    }

    // Icon, name, and contents stay one identity: when the icon changes on a
    // workspace tab, re-seed that tab's panel to the icon's tool so editing
    // the icon actually changes what the workspace IS (previously it only
    // changed the picture, which read as a bug).
    const iconChanged = editTabIcon !== selectedTabToEdit.iconName;
    if (iconChanged && editTabType === 'workspace') {
      const tools = ICON_TOOL_SUGGESTIONS[editTabIcon] || ['notes'];
      localStorage.setItem(
        `studio_workspace_layout_${selectedTabToEdit.id}`,
        JSON.stringify({ type: 'panel', id: `${selectedTabToEdit.id}-root`, activeTab: tools[0], tabs: tools })
      );
      if (activeTab === selectedTabToEdit.id) setLayoutResetNonce(n => n + 1);
    }

    // If the label wasn't hand-edited, keep it in sync with the new icon.
    const iconMeta = SELECTABLE_ICONS.find(i => i.name === editTabIcon);
    const oldIconMeta = SELECTABLE_ICONS.find(i => i.name === selectedTabToEdit.iconName);
    const labelFollowsIcon = iconChanged && iconMeta &&
      (editTabLabel.trim() === '' || editTabLabel.trim() === selectedTabToEdit.label) &&
      (selectedTabToEdit.label === oldIconMeta?.label || editTabLabel.trim() === '');

    const updated = tabs.map(t => {
      if (t.id === selectedTabToEdit.id) {
        return {
          ...t,
          label: labelFollowsIcon ? iconMeta!.label : (editTabLabel.trim() || t.label),
          iconName: editTabIcon,
          type: editTabType,
          embedUrl: editTabType === 'embed' ? embedUrl : undefined,
          allowedRoles: editTabRoles
        };
      }
      return t;
    });

    setTabs(updated);
    persistTabs(updated);
    setIsEditModalOpen(false);
    setSelectedTabToEdit(null);
  };

  const handleDeleteTab = () => {
    if (!selectedTabToEdit) return;
    const updated = tabs.filter(t => t.id !== selectedTabToEdit.id);
    setTabs(updated);
    persistTabs(updated);
    // Drop the tab's saved workspace layout so a future tab with a reused id
    // can't inherit a stale layout.
    localStorage.removeItem(`studio_workspace_layout_${selectedTabToEdit.id}`);
    if (activeTab === selectedTabToEdit.id) {
      setActiveTab('dashboard');
      localStorage.setItem('studio_active_tab', 'dashboard');
    }
    setIsEditModalOpen(false);
    setSelectedTabToEdit(null);
  };

  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Login Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isCalendarSyncOpen, setIsCalendarSyncOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Which surfaces get opened. One line here covers every tab, rather than a
  // call scattered through each widget. Repeats inside ten seconds collapse,
  // so flicking through tabs doesn't drown the totals.
  useEffect(() => {
    if (activeTab) trackView(activeTab);
  }, [activeTab]);

  // Swipe in from the left screen edge to open the sidebar on touch devices
  // (and swipe left while it's open to dismiss) — faster than the hamburger.
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking: 'open' | 'close' | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      if (t.clientX <= 24) tracking = 'open';        // edge swipe → open
      else if (isSidebarOpen) tracking = 'close';    // swipe left anywhere → close
      else tracking = null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > 60) { tracking = null; return; } // mostly-vertical → it's a scroll
      if (tracking === 'open' && dx > 60) {
        setIsSidebarOpen(true);
        tracking = null;
      } else if (tracking === 'close' && dx < -60) {
        setIsSidebarOpen(false);
        tracking = null;
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [isSidebarOpen]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  // Subscription URL including the feed secret, fetched server-side so the
  // token never ships in the bundle. Falls back to the bare path until it
  // loads — and on deployments that haven't configured a token.
  const [feedUrl, setFeedUrl] = useState<string>('');
  const [preloadedJob, setPreloadedJob] = useState<any | null>(null);
  const [preselectedJobId, setPreselectedJobId] = useState<string | null>(null);
  // Set when a date is picked in Calendar → "New production". Slate opens its
  // production form with this as the shoot date, then clears it.
  const [newProductionDate, setNewProductionDate] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  // One source of truth for "what can this account open". Everything that
  // navigates — the sidebar, the search palette, the guard below — reads this,
  // so a role can never reach a workspace by way of a stale saved tab id.
  const visibleTabs = useMemo(
    () => tabs.filter(tab => canAccessTab(userRole, tab)),
    [tabs, userRole]
  );

  // If the persisted/last-used tab isn't open to this account (a shared
  // browser, a role change, a widget linking across tabs), fall back to the
  // role's home tab rather than rendering a workspace they can't have.
  useEffect(() => {
    if (!userRole || tabs.length === 0 || visibleTabs.length === 0) return;
    if (visibleTabs.some(t => t.id === activeTab)) return;
    const fallback = defaultTabForRole(userRole);
    const target = visibleTabs.some(t => t.id === fallback) ? fallback : visibleTabs[0].id;
    setActiveTab(target);
    localStorage.setItem('studio_active_tab', target);
  }, [userRole, tabs, visibleTabs, activeTab]);

  // Google Calendar Integration States
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');

  // Sync health for the header chip: last outcome recorded by any sync path
  // (cron, silent, or manual). Refreshed on load, every 5 minutes, and when
  // the sync modal opens.
  const [googleSyncInfo, setGoogleSyncInfo] = useState<{ at: string | null; ok: boolean | null; error: string | null }>({ at: null, ok: null, error: null });

  const checkGoogleConnection = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      // Server-side check — google_tokens is not client-readable.
      const res = await fetch('/api/auth/google/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      setIsGoogleConnected(!!data.connected);
      setGoogleSyncInfo({ at: data.lastSyncAt ?? null, ok: data.lastSyncOk ?? null, error: data.lastSyncError ?? null });
    } catch (err) {
      setIsGoogleConnected(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isCalendarSyncOpen && session) {
      checkGoogleConnection();
    }
  }, [isCalendarSyncOpen, session, checkGoogleConnection]);

  useEffect(() => {
    if (!session?.access_token) return;
    checkGoogleConnection();
    const interval = setInterval(checkGoogleConnection, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session?.access_token, checkGoogleConnection]);

  const handleConnectGoogle = async () => {
    if (!session?.access_token) return;
    try {
      const res = await fetch('/api/auth/google', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setSyncStatusMsg(data.error || 'Could not start Google connection.');
      }
    } catch {
      setSyncStatusMsg('Could not reach Google connection service.');
    }
  };

  const handleTriggerSync = async () => {
    if (!session?.user?.id) return;
    setIsSyncing(true);
    setSyncStatusMsg('Connecting to Google Calendar...');
    try {
      const res = await fetch('/api/integrations/calendar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: 'pull' })
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatusMsg(data.message);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setSyncStatusMsg(data.error || 'Failed to sync calendar.');
      }
    } catch (err: any) {
      setSyncStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Resolve the subscription URL (with its secret) once the session is known.
  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/calendar/feed-url', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.url) setFeedUrl(data.url); })
      .catch(() => { /* the fallback URL still renders */ });
  }, [session?.access_token]);

  // Silent background pull while the app is open, so nobody has to remember to
  // hit sync — new Google events flow in via Supabase realtime with no reload.
  // The server-side cron covers the hours when nobody is looking. Throttled in
  // localStorage so several open tabs don't multiply the Google API traffic.
  useEffect(() => {
    if (!session?.access_token) return;
    const AUTO_SYNC_MS = 10 * 60 * 1000;
    const THROTTLE_KEY = 'google_calendar_last_auto_sync';

    const silentSync = async () => {
      const last = Number(localStorage.getItem(THROTTLE_KEY) || 0);
      if (Date.now() - last < AUTO_SYNC_MS - 5000) return;
      localStorage.setItem(THROTTLE_KEY, String(Date.now()));
      try {
        await fetch('/api/integrations/calendar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'pull' }),
        });
      } catch {
        // Background sync failures stay silent — the manual button still
        // surfaces errors when the user wants details.
      }
    };

    silentSync();
    const interval = setInterval(silentSync, AUTO_SYNC_MS);
    return () => clearInterval(interval);
  }, [session?.access_token]);

  const fetchUserRole = async (userId: string, email: string, setDefaultTab = false) => {
    setIsLoading(true);

    const checkPersistedTab = (role: AppRole) => {
      const savedActiveTab = localStorage.getItem('studio_active_tab');
      if (savedActiveTab) {
        let currentTabs = DEFAULT_TABS;
        const savedTabs = localStorage.getItem('custom_tabs_list');
        if (savedTabs) {
          try {
            currentTabs = JSON.parse(savedTabs);
          } catch (e) {}
        }
        const activeTabObj = currentTabs.find(t => t.id === savedActiveTab);
        const isValid = activeTabObj && canAccessTab(role, activeTabObj);
        if (isValid) {
          setActiveTab(savedActiveTab);
          return true;
        }
      }
      return false;
    };

    // Hardcoded bypass for the primary administrator account
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === 'matt@zipline.media') {
      setUserRole('admin');
      if (setDefaultTab) {
        if (!checkPersistedTab('admin')) {
          setActiveTab('dashboard');
          localStorage.setItem('studio_active_tab', 'dashboard');
        }
      }
      setIsLoading(false);
      return;
    }

    try {
      // 1. Try to fetch by ID
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      let role = data?.role;

      // 2. If not found by ID, try fetching by email (self-healing fallback)
      if (!role && email) {
        const { data: emailData } = await supabase
          .from('user_roles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (emailData) {
          role = emailData.role;

          // Attempt to update the row's ID to link it to the new auth user ID.
          // RLS may block this — that's fine, the role is already active in the UI.
          await supabase
            .from('user_roles')
            .update({ id: userId })
            .ilike('email', cleanEmail);
        }
      }

      // 3. If still not found, create a new client role
      if (!role) {
        const { data: newRole, error: insertError } = await supabase
          .from('user_roles')
          .insert({ id: userId, email: email, role: 'client' })
          .select('role')
          .single();

        if (insertError) throw insertError;
        role = newRole?.role || 'client';
      }

      setUserRole(role as AppRole);
      if (setDefaultTab) {
        if (!checkPersistedTab(role as AppRole)) {
          const defaultTab = defaultTabForRole(role);
          setActiveTab(defaultTab);
          localStorage.setItem('studio_active_tab', defaultTab);
        }
      }
    } catch (err: any) {
      console.error('[Studio OS] Error fetching user role:', err);
      setUserRole('client'); // Default fallback
      if (setDefaultTab) {
        if (!checkPersistedTab('client')) {
          setActiveTab('calendar');
          localStorage.setItem('studio_active_tab', 'calendar');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Track which user we've already loaded so we can ignore background auth
    // events (token refreshes, tab re-focus) that would otherwise re-run
    // fetchUserRole — flashing the loading screen and snapping the user back
    // to the default tab in the middle of whatever they were doing.

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadedUserRef.current = session.user.id;
        fetchUserRole(session.user.id, session.user.email || '', true);
      } else {
        setUserRole(null);
        setIsLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      const newUserId = session?.user?.id ?? null;

      // Sign-out: clear everything.
      if (!session?.user) {
        loadedUserRef.current = null;
        setUserRole(null);
        setIsLoading(false);
        return;
      }

      // Same user as already loaded (TOKEN_REFRESHED, USER_UPDATED, or a
      // SIGNED_IN re-fired on tab focus) — nothing to do. Re-fetching here was
      // the cause of "it kicks me out mid-task / sends me back to the home page".
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || newUserId === loadedUserRef.current) {
        return;
      }

      // Genuinely new sign-in — load their role and land on the default tab.
      loadedUserRef.current = newUserId;
      fetchUserRole(session.user.id, session.user.email || '', true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load the signed-in user's avatar for the sidebar (fails soft if no profile)
  const loadMyAvatar = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      setMyAvatarUrl(data?.avatar_url || null);
    } catch {
      // table may not exist yet — ignore
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadMyAvatar();
  }, [loadMyAvatar]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoginLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setIsLoginLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin relative z-10 shadow-[0_0_20px_rgba(0,119,255,0.2)]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="studio-shell min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/10 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-[130px] pointer-events-none" />
        
        {/* Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        
        <div className="w-full max-w-md bg-zinc-950/75 backdrop-blur-2xl border border-white/10 rounded-2xl p-10 shadow-2xl relative overflow-hidden shadow-accent/5">
          {/* Decorative gradient beam */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent animate-pulse" />
          
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-accent/20 relative group overflow-hidden">
              <div className="absolute inset-0 bg-accent/10 blur-xl opacity-50" />
              <Lock className="w-8 h-8 text-accent relative z-10" />
            </div>
            <h1 className="text-[28px] font-bold tracking-tight text-white bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">Studio OS</h1>
            <p className="text-[11px] font-medium tracking-[0.18em] uppercase text-white/35 mt-2">Zipline Media · Internal Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-medium tracking-normal ml-1 text-white/50 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-accent/60" /> Email address
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@zipline.media"
                required
                className="w-full bg-black/40 border border-white/10 p-3.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-all duration-300 text-sm font-medium rounded-xl text-white placeholder:opacity-45 placeholder:uppercase placeholder:font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-medium tracking-normal ml-1 text-white/50 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-accent/60" /> Password
              </label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-black/40 border border-white/10 p-3.5 outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-all duration-300 text-sm font-medium rounded-xl text-white placeholder:opacity-45"
              />
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl"
              >
                <p className="text-red-400 text-xs font-medium text-center">{error}</p>
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={isLoginLoading}
              className="w-full bg-gradient-to-r from-accent to-blue-600 text-white py-3.5 font-semibold text-sm hover:from-white hover:to-white hover:text-black transition-all duration-300 rounded-xl shadow-lg shadow-accent/20 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
            >
              {isLoginLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Unlock Command Center'}
            </button>

            <p className="text-center text-[11px] font-medium tracking-wide text-white/50">
              Authorized access only · All sessions are logged
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-shell min-h-screen bg-black text-white flex overflow-hidden relative">
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff01_1px,transparent_1px),linear-gradient(to_bottom,#ffffff01_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* Sidebar overlay backdrop on mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-48 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={isMobile ? {
          x: isSidebarOpen ? 0 : -260,
          width: 260,
        } : {
          x: 0,
          width: isSidebarOpen ? 260 : 80
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className={`bg-zinc-950/80 backdrop-blur-2xl border-r border-white/10 flex flex-col z-50 shrink-0 shadow-2xl ${
          isMobile ? 'fixed left-0 top-0 bottom-0' : 'relative'
        }`}
      >
        <div className={`flex ${(!isSidebarOpen && !isMobile) ? 'flex-col items-center gap-4 px-0 py-6' : 'items-center justify-between p-6'}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-blue-600 rounded-lg flex items-center justify-center font-black text-xs shadow-[0_0_15px_rgba(0,119,255,0.3)] shrink-0">Z</div>
            <span className={`font-semibold tracking-tight text-lg bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent ${(!isSidebarOpen && !isMobile) && 'hidden'}`}>Studio</span>
          </div>
          {/* Icon-only, so it needs a name of its own — without one a screen
              reader announces an unlabelled button. */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isMobile ? 'Close navigation' : isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer text-white/60 hover:text-white"
          >
            {isMobile ? (
              <X className="w-4 h-4" />
            ) : isSidebarOpen ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
          {isMounted ? (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="sidebar-nav">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-1.5"
                  >
                    {visibleTabs
                      .map((tab, index) => {
                        const Icon = getIconComponent(tab.iconName);
                        return (
                          <Draggable key={tab.id} draggableId={tab.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="group relative"
                                style={{ ...provided.draggableProps.style }}
                              >
                                <button
                                  onClick={() => {
                                    setActiveTab(tab.id);
                                    localStorage.setItem('studio_active_tab', tab.id);
                                    if (isMobile) {
                                      setIsSidebarOpen(false);
                                    }
                                  }}
                                  className={`w-full flex items-center gap-3 py-3 rounded-xl transition-all duration-300 relative border ${(!isSidebarOpen && !isMobile) ? 'justify-center px-0' : 'px-4'} ${
                                    activeTab === tab.id
                                      ? 'bg-gradient-to-r from-accent/15 to-accent/5 text-white border-accent/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-accent/5'
                                      : 'text-white/40 hover:text-white hover:bg-white/5 border-transparent'
                                  } ${snapshot.isDragging ? 'bg-zinc-900 border-white/10 z-50' : ''}`}
                                >
                                  {activeTab === tab.id && (
                                    <motion.div 
                                      layoutId="activeIndicator"
                                      className="absolute left-0 top-1/4 bottom-1/4 w-[2px] bg-accent rounded-full shadow-[0_0_8px_var(--accent)]"
                                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                    />
                                  )}
                                  
                                  <Icon className={`w-5 h-5 shrink-0 transition-colors duration-300 ${activeTab === tab.id ? 'text-accent' : ''}`} />
                                  
                                  <span className={`font-medium tracking-tight text-[13px] text-left transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                                    {tab.label}
                                  </span>
                                </button>

                                {/* Action controls live as siblings of the nav button — not
                                    nested inside it — so the markup stays valid (no button-in-
                                    button) while the absolute positioning + group-hover reveal
                                    are unchanged. */}

                                {/* Edit/Settings button for default/custom tabs on hover (admin only) */}
                                {isSidebarOpen && userRole === 'admin' && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTabToEdit(tab);
                                        setEditTabLabel(tab.label);
                                        setEditTabIcon(tab.iconName);
                                        setEditTabType(tab.type as any);
                                        setEditTabUrl(tab.embedUrl || '');
                                        setEditTabRoles(tab.allowedRoles || ['admin']);
                                        setIsEditModalOpen(true);
                                      }}
                                      className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-100 p-1 text-white hover:text-accent transition-opacity z-30 cursor-pointer"
                                      title="Edit Workspace Settings"
                                    >
                                      <Settings className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => resetWorkspaceForTab(tab.id, e)}
                                      className="absolute right-9 top-1/2 -translate-y-1/2 max-md:opacity-50 opacity-0 group-hover:opacity-40 hover:!opacity-100 p-1 text-white hover:text-orange-400 transition-opacity z-30 cursor-pointer"
                                      title="Reset panels to default view"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                {/* Grip handle visible on hover. Must stay mounted even when
                                    collapsed — @hello-pangea/dnd requires the drag handle to
                                    always exist in the DOM, so hide it with classes, not unmount. */}
                                <div
                                  {...provided.dragHandleProps}
                                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white hover:text-accent transition-opacity cursor-grab active:cursor-grabbing ${(!isSidebarOpen && !isMobile) ? 'opacity-0 pointer-events-none' : 'max-md:opacity-40 opacity-0 group-hover:opacity-40 hover:opacity-100'}`}
                                  title="Drag to reorder"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    {provided.placeholder}

                    {/* Add Custom Tab Button */}
                    {userRole === 'admin' && (
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className={`w-full flex items-center gap-3 py-3 rounded-xl border border-dashed border-white/10 hover:border-accent/40 text-white/40 hover:text-white bg-transparent hover:bg-white/5 transition-all duration-300 mt-4 cursor-pointer group/add-tab ${(!isSidebarOpen && !isMobile) ? 'justify-center px-0' : 'px-4'}`}
                      >
                        <Plus className="w-5 h-5 shrink-0 text-white/40 group-hover/add-tab:text-accent transition-colors duration-300" />
                        <span className={`font-medium tracking-tight text-[13px] text-left transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                          Create Workspace
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div className="space-y-1.5">
              {visibleTabs
                .map(tab => {
                  const Icon = getIconComponent(tab.iconName);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        localStorage.setItem('studio_active_tab', tab.id);
                        if (isMobile) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative border ${
                        activeTab === tab.id 
                          ? 'bg-gradient-to-r from-accent/15 to-accent/5 text-white border-accent/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-accent/5' 
                          : 'text-white/40 hover:text-white hover:bg-white/5 border-transparent'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-accent' : ''}`} />
                      <span className="font-medium tracking-tight text-[13px]">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/20 hover:text-red-500 transition-colors rounded-xl group cursor-pointer"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span className={`font-medium tracking-tight text-[13px] ${(!isSidebarOpen && !isMobile) && 'hidden'}`}>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col z-10">
        {/* z-45 is not a Tailwind scale value, so this compiled to no z-index
            at all and the header's paint order was left to chance. */}
        <header className="sticky top-0 z-30 bg-black/90 md:bg-black/40 backdrop-blur-xl border-b border-white/5 p-3 md:p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isMobile && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation"
                className="p-2 hover:bg-white/5 border border-white/10 rounded-lg transition-colors cursor-pointer text-white shrink-0"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="hidden sm:block text-[11px] md:text-[9px] md:text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80 mb-1 truncate max-w-[200px] sm:max-w-none">
                {activeTabObj ? (
                  activeTabObj.type === 'system' ? (
                    activeTabObj.id === 'dashboard' ? 'Studio Overview' :
                    activeTabObj.id === 'calendar' ? 'Monthly Schedule' :
                    activeTabObj.id === 'slate' ? 'Production Schedule' :
                    activeTabObj.id === 'edits' ? 'Post-Production Pipeline' :
                    activeTabObj.id === 'gear' ? 'Inventory & Manifests' :
                    activeTabObj.id === 'creative' ? 'Creative Pre-Production' :
                    activeTabObj.id === 'social' ? 'Social Rollout Management' :
                    activeTabObj.id === 'inbox' ? 'Messages & Requests' :
                    activeTabObj.id === 'vault' ? 'Secure Asset Storage' :
                    'Contacts & Clients'
                  ) : activeTabObj.type === 'embed' ? 'External Tool Integration' :
                      activeTabObj.type === 'notes' ? 'Production Notepad' : 'Custom Workspace Layout'
                ) : 'Workspace Overview'}
              </h2>
              <h1 className="text-lg md:text-[26px] font-semibold tracking-tight text-white truncate max-w-[200px] sm:max-w-none">
                {activeTabObj ? activeTabObj.label : 'Command Center'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-nowrap justify-end">
             {/* Live database status — a quiet macOS-style menu-bar indicator */}
             <div
                title="Live database sync is active"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/10 shrink-0"
             >
                <span className="relative flex w-1.5 h-1.5">
                   <span className="absolute inline-flex w-full h-full rounded-full bg-green-500/60 animate-ping" />
                   <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-green-500" />
                </span>
                <span className="text-[10px] font-medium tracking-wide text-white/45">Live</span>
             </div>

             {/* Toolbar group — utility actions grouped into one segmented control */}
             <div className="flex items-center gap-0.5 p-0.5 bg-white/[0.03] border border-white/10 rounded-lg shrink-0">
                {/* Smart Search (Cmd/Ctrl+K) */}
                <button
                   onClick={() => { trackAction('header', 'search_palette'); setIsSearchOpen(true); }}
                   className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                   title="Smart search (⌘K) — search productions, contacts & clients by meaning"
                   aria-label="Smart search"
                >
                   <Search className="w-4 h-4" />
                </button>

                {/* Reset Layout — only for workspaces that use the panel layout */}
                {activeTabObj && activeTabObj.type !== 'embed' && activeTabObj.type !== 'notes' && (
                  <button
                     onClick={() => resetWorkspaceForTab(activeTab)}
                     className="p-2 rounded-md text-white/50 hover:text-orange-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                     title="Reset this workspace's panels to the default layout"
                     aria-label="Reset layout"
                  >
                     <RotateCcw className="w-4 h-4" />
                  </button>
                )}

                {/* Sync health: green = last sync ok, red = failing. Click opens the sync modal. */}
                {isGoogleConnected && googleSyncInfo.ok === false && (
                  <button
                    onClick={() => setIsCalendarSyncOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                    title={`Google sync failing${googleSyncInfo.at ? ` since ${timeAgo(googleSyncInfo.at)}` : ''}: ${googleSyncInfo.error || 'unknown error'}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span className="text-[11px] md:text-[9px] font-black uppercase tracking-widest hidden sm:inline">Sync failing</span>
                  </button>
                )}
                {isGoogleConnected && googleSyncInfo.ok === true && googleSyncInfo.at && (
                  <span
                    className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/30 select-none"
                    title={`Google Calendar last synced ${new Date(googleSyncInfo.at).toLocaleString()}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                    Synced {timeAgo(googleSyncInfo.at)}
                  </span>
                )}

                {/* Calendar Sync — hidden for scoped roles, whose accounts have
                    no calendar to sync and shouldn't push the studio's. */}
                {!isScopedRole(userRole) && (
                  <button
                     onClick={() => setIsCalendarSyncOpen(true)}
                     className="p-2 rounded-md text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                     title="Google Calendar sync"
                     aria-label="Calendar sync"
                  >
                     <RefreshCw className="w-4 h-4 text-accent animate-spin-slow" />
                  </button>
                )}

                {/* Quick Start Guide */}
                <button
                   onClick={() => setIsQuickStartOpen(true)}
                   className="p-2 rounded-md text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                   title="Quick start guide"
                   aria-label="Quick start guide"
                >
                   <HelpCircle className="w-4 h-4" />
                </button>
             </div>

             {/* Profile / Settings — top-right for quick access */}
             <button
                onClick={() => setIsSettingsOpen(true)}
                title="Edit profile & settings"
                className="flex items-center gap-2 pl-1 pr-1 md:pr-3 py-1 bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-full transition-colors cursor-pointer shrink-0"
             >
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center border border-white/10 overflow-hidden shrink-0">
                   {myAvatarUrl ? (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img src={myAvatarUrl} alt="Me" className="w-full h-full object-cover" />
                   ) : (
                     <UserIcon className="w-3.5 h-3.5 text-white/40" />
                   )}
                </div>
                <div className="hidden md:block text-left leading-tight pr-1">
                   <p className="text-[11px] font-medium text-white/70 truncate max-w-[150px]">{session.user.email}</p>
                   <p className="text-[10px] font-medium text-accent/80 capitalize">{userRole || 'Loading…'} · Edit</p>
                </div>
             </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 flex flex-col relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeTab}::${layoutResetNonce}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex-grow flex flex-col min-h-0"
            >
              {activeTabObj?.type === 'embed' ? (
                <FullscreenEmbedWidget url={activeTabObj.embedUrl || ''} />
              ) : activeTabObj?.type === 'notes' ? (
                <FullscreenNotesWidget tabId={activeTabObj.id} />
              ) : (
                <WorkspaceLayout 
                  activeTab={activeTab}
                  userRole={userRole}
                  preloadedJob={preloadedJob}
                  onClearPreload={() => setPreloadedJob(null)}
                  preselectedJobId={preselectedJobId}
                  onClearPreselectedJobId={() => setPreselectedJobId(null)}
                  newProductionDate={newProductionDate}
                  onClearNewProductionDate={() => setNewProductionDate(null)}
                  onSwitchTab={(target) => {
                    if (typeof target === 'string') {
                      setActiveTab(target);
                      localStorage.setItem('studio_active_tab', target);
                    } else if (target && typeof target === 'object') {
                      if (target.selectCalendarJob) {
                        setPreselectedJobId(target.selectCalendarJob);
                        setActiveTab('slate');
                        localStorage.setItem('studio_active_tab', 'slate');
                      }
                      if (target.newProductionDate) {
                        setNewProductionDate(target.newProductionDate);
                        setActiveTab('slate');
                        localStorage.setItem('studio_active_tab', 'slate');
                      }
                      if (target.gearJob) {
                        setPreloadedJob(target.gearJob);
                        setActiveTab('gear');
                        localStorage.setItem('studio_active_tab', 'gear');
                      }
                    }
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Smart Search Palette (⌘K) */}
      <SearchPalette
        open={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpenJob={(jobId) => {
          // A production opens on the Slate — unless this account can't reach
          // it, in which case stay on the tab they do have.
          const target = visibleTabs.some(t => t.id === 'slate') ? 'slate' : defaultTabForRole(userRole);
          setPreselectedJobId(jobId);
          setActiveTab(target);
          localStorage.setItem('studio_active_tab', target);
        }}
        onOpenContacts={() => {
          setActiveTab('rolodex');
          localStorage.setItem('studio_active_tab', 'rolodex');
        }}
        onNavigate={(tabId) => {
          setActiveTab(tabId);
          localStorage.setItem('studio_active_tab', tabId);
        }}
        availableTabs={visibleTabs.map(t => t.id)}
        // The Rolodex is where crew rates and phone numbers live; a scoped
        // account has no tab for it, so it must not leak through search either.
        includePeople={visibleTabs.some(t => t.id === 'rolodex')}
      />

      {/* Profile & Branding Settings Modal */}
      {isSettingsOpen && (
        <ProfileSettings
          session={session}
          userRole={userRole}
          onClose={() => setIsSettingsOpen(false)}
          onSaved={loadMyAvatar}
        />
      )}

      {/* Calendar Sync Feed Modal */}
      <AnimatePresence>
        {isCalendarSyncOpen && (
          <div className="fixed inset-0 z-[110] flex justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-fit my-auto w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsCalendarSyncOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                  <RefreshCw className="w-5 h-5 text-accent animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-white">Google Calendar Sync</h3>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Live Webcal Subscription Feed</p>
                </div>
              </div>

              <div className="space-y-6 text-sm">
                <p className="text-white/70 leading-relaxed text-xs">
                  Subscribe to your live Studio OS Production Calendar feed inside Google Calendar, Apple Calendar, or Outlook to keep your shoots and meetings synced.
                </p>

                <div className="space-y-2">
                  <label className="text-[11px] md:text-[9px] font-black tracking-[0.3em] uppercase opacity-40 text-white">ICS Subscription Link</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={feedUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/calendar` : '/api/calendar')}
                      className="flex-grow bg-black/50 border border-white/10 px-4 py-3 outline-none text-xs font-bold rounded-xl text-white select-all"
                    />
                    <button
                      onClick={() => {
                        const link = feedUrl || (typeof window !== 'undefined' ? `${window.location.origin}/api/calendar` : '/api/calendar');
                        navigator.clipboard.writeText(link);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="bg-accent px-4 text-xs font-black uppercase tracking-widest text-white rounded-xl hover:bg-white hover:text-black transition-all flex items-center gap-1.5"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 bg-black/40 border border-white/5 p-4 rounded-xl">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Instructions for Google Calendar</h4>
                  <ol className="list-decimal list-inside text-xs text-white/60 space-y-2 leading-relaxed">
                    <li>Copy the subscription link above.</li>
                    <li>Open your Google Calendar on desktop.</li>
                    <li>On the left panel, click the <span className="text-white font-bold">+</span> next to &quot;Other calendars&quot;.</li>
                    <li>Select <span className="text-white font-bold">From URL</span>.</li>
                    <li>Paste the subscription link and click <span className="text-white font-bold">Add calendar</span>.</li>
                  </ol>
                </div>

                {/* Google OAuth & Two-Way Sync Integration */}
                <div className="space-y-3 bg-black/40 border border-white/5 p-4 rounded-xl text-left">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-accent">Two-Way Google Sync</h4>
                    <span className={`px-2 py-0.5 text-[11px] md:text-[8px] font-black uppercase tracking-widest rounded-full border ${
                      isGoogleConnected === null ? 'bg-white/5 border-white/10 text-white/40' :
                      isGoogleConnected ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
                    }`}>
                      {isGoogleConnected === null ? 'Checking...' : isGoogleConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  
                  <p className="text-white/60 leading-normal text-[11px]">
                    Authenticate with Google to enable two-way live calendar sync. Changes made in Slate will sync to Google, and events on Google prefixed with 🎥 will sync back to Slate.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    {!isGoogleConnected ? (
                      <button
                        onClick={handleConnectGoogle}
                        className="flex-1 py-2.5 bg-accent text-white text-xs font-black uppercase tracking-widest hover:bg-white hover:text-black rounded-xl transition-all cursor-pointer"
                      >
                        Connect Google Account
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleTriggerSync}
                          disabled={isSyncing}
                          className="flex-1 py-2.5 bg-green-600 text-white text-xs font-black uppercase tracking-widest hover:bg-green-500 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isSyncing ? 'Syncing...' : 'Run Two-Way Sync'}
                        </button>
                        <button
                          onClick={handleConnectGoogle}
                          className="py-2.5 px-3 bg-white/5 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                          title="Reconnect Account"
                        >
                          Reconnect
                        </button>
                      </>
                    )}
                  </div>

                  {syncStatusMsg && (
                    <p className="text-[10px] font-bold text-accent/80 italic mt-2 text-center animate-pulse">
                      {syncStatusMsg}
                    </p>
                  )}

                  {/* Sync health detail — surfaces silent background failures */}
                  {isGoogleConnected && googleSyncInfo.at && (
                    googleSyncInfo.ok === false ? (
                      <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-red-300 leading-relaxed">
                          <span className="font-black uppercase tracking-widest">Sync failing</span> (last attempt {timeAgo(googleSyncInfo.at)})
                          {googleSyncInfo.error ? ` — ${googleSyncInfo.error}` : ''}{' '}
                          Try Reconnect above if this persists.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] md:text-[9px] font-bold uppercase tracking-widest text-white/30 text-center">
                        Last synced {timeAgo(googleSyncInfo.at)} · auto-syncs every 10 minutes
                      </p>
                    )
                  )}
                </div>

                <button 
                  onClick={() => setIsCalendarSyncOpen(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black tracking-widest uppercase text-xs rounded-xl transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Tab Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[110] flex justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md h-fit my-auto bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                  <Plus className="w-5 h-5 text-accent animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-white">Create Custom Tab</h3>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Add a modular workspace tool</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Tab Label</label>
                  <input
                    type="text"
                    placeholder="E.G. CLIENT BOARD"
                    value={newTabLabel}
                    onChange={(e) => { setNewTabLabel(e.target.value); setNewTabLabelTouched(true); }}
                    className="w-full bg-black/40 border border-white/10 p-3 outline-none focus:border-accent text-xs font-bold rounded-xl text-white uppercase placeholder:opacity-20"
                  />
                </div>

                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2">Tab Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewTabType('workspace')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        newTabType === 'workspace' 
                          ? 'border-accent/40 bg-accent/10 text-white' 
                          : 'border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-black text-[13px] md:text-[10px] uppercase tracking-wider">Workspace</div>
                      <div className="text-[11px] md:text-[7px] text-white/30 uppercase mt-0.5 font-bold">Studio Tool Panels</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTabType('embed')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        newTabType === 'embed' 
                          ? 'border-accent/40 bg-accent/10 text-white' 
                          : 'border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-black text-[13px] md:text-[10px] uppercase tracking-wider">Embed</div>
                      <div className="text-[11px] md:text-[7px] text-white/30 uppercase mt-0.5 font-bold">External Website</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewTabType('notes')}
                      className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        newTabType === 'notes' 
                          ? 'border-accent/40 bg-accent/10 text-white' 
                          : 'border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="font-black text-[13px] md:text-[10px] uppercase tracking-wider">Notepad</div>
                      <div className="text-[11px] md:text-[7px] text-white/30 uppercase mt-0.5 font-bold">Markdown Page</div>
                    </button>
                  </div>
                </div>

                {newTabType === 'embed' && (
                  <div>
                    <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Embed URL</label>
                    <input 
                      type="text" 
                      placeholder="https://trello.com/..."
                      value={newTabUrl}
                      onChange={(e) => setNewTabUrl(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 outline-none focus:border-accent text-xs font-bold rounded-xl text-white placeholder:opacity-45"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2">Select Icon</label>
                  <IconPickerGrid
                    selected={newTabIcon}
                    onSelect={(name) => {
                      setNewTabIcon(name);
                      // Until the user hand-picks tools, follow the icon's
                      // suggestion so "Budget" opens with something useful.
                      if (!newTabToolsTouched) {
                        const suggested = ICON_TOOL_SUGGESTIONS[name];
                        if (suggested && suggested.length > 0) setNewTabTools(suggested);
                      }
                      // Autofill the workspace name from the icon until the
                      // user types their own.
                      if (!newTabLabelTouched) {
                        const iconMeta = SELECTABLE_ICONS.find(i => i.name === name);
                        if (iconMeta) setNewTabLabel(iconMeta.label);
                      }
                    }}
                  />
                </div>

                {newTabType === 'workspace' && (
                  <div>
                    <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">This workspace opens with</label>
                    {/* Compact summary: the tools this tab will contain, picked
                        automatically from the icon. "Change" reveals the full
                        list without making the modal taller by default. */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-black/40 border border-white/5 p-2.5 rounded-xl">
                      {(newTabTools.length > 0 ? newTabTools : ['notes']).map(id => {
                        const tool = STARTER_TOOLS.find(t => t.id === id);
                        return (
                          <span key={id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/15 border border-accent/30 text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white">
                            {tool?.label || id}
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setShowToolPicker(v => !v)}
                        className="px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] md:text-[9px] font-black uppercase tracking-wider text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {showToolPicker ? 'Done' : 'Change'}
                      </button>
                    </div>
                    <p className="text-[11px] md:text-[9px] text-white/30 mt-1.5 leading-relaxed">
                      These are the panels inside your new tab — picked to match the icon. You can add or split panels any time later.
                    </p>
                    {showToolPicker && (
                      <div className="grid grid-cols-2 gap-1.5 bg-black/40 border border-white/5 p-2 rounded-xl max-h-36 overflow-y-auto mt-2">
                        {STARTER_TOOLS.map(tool => {
                          const checked = newTabTools.includes(tool.id);
                          return (
                            <label
                              key={tool.id}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer select-none transition-all ${
                                checked ? 'bg-accent/15 border border-accent/30 text-white' : 'border border-transparent text-white/50 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  setNewTabToolsTouched(true);
                                  setNewTabTools(prev =>
                                    checked ? prev.filter(t => t !== tool.id) : [...prev, tool.id]
                                  );
                                }}
                                className="rounded border-white/10 text-accent focus:ring-accent bg-black"
                              />
                              <span className="text-[11px] md:text-[9px] font-black uppercase tracking-wider">{tool.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2">Role Visibility</label>
                  <div className="flex gap-4 bg-black/40 border border-white/5 p-3 rounded-xl">
                    {CONFIGURABLE_ROLES.map((role) => {
                      const isChecked = newTabRoles.includes(role);
                      return (
                        <label key={role} className="flex items-center gap-2 text-white/60 hover:text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setNewTabRoles(newTabRoles.filter(r => r !== role));
                              } else {
                                setNewTabRoles([...newTabRoles, role]);
                              }
                            }}
                            className="rounded border-white/10 text-accent focus:ring-accent bg-black"
                          />
                          <span className="text-[10px] font-black uppercase tracking-wider">{ROLE_LABELS[role]}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] md:text-[9px] text-white/25 mt-2 leading-relaxed">
                    {ROLE_LABELS.editor} accounts are locked to the Edit Tracker and aren&apos;t affected by this setting.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleCreateTab}
                    disabled={!newTabLabel.trim() || (newTabType === 'embed' && !newTabUrl.trim())}
                    className="flex-grow py-3 bg-accent hover:bg-white hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Create Workspace
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tab Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedTabToEdit && (
          <div className="fixed inset-0 z-[110] flex justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-fit my-auto w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                  <Settings className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-white">Workspace Settings</h3>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">Modify this navigation workspace</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Tab Label</label>
                  <input 
                    type="text" 
                    placeholder="E.G. CLIENT BOARD"
                    value={editTabLabel}
                    onChange={(e) => setEditTabLabel(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 p-3 outline-none focus:border-accent text-xs font-bold rounded-xl text-white uppercase placeholder:opacity-20"
                  />
                </div>

                {!selectedTabToEdit.isDefault && (
                  <div>
                    <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2">Tab Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditTabType('workspace')}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          editTabType === 'workspace' 
                            ? 'border-accent/40 bg-accent/10 text-white' 
                            : 'border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div className="font-black text-[13px] md:text-[10px] uppercase tracking-wider">Grid</div>
                        <div className="text-[11px] md:text-[7px] text-white/30 uppercase mt-0.5 font-bold">Premiere Splits</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTabType('embed')}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          editTabType === 'embed' 
                            ? 'border-accent/40 bg-accent/10 text-white' 
                            : 'border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div className="font-black text-[13px] md:text-[10px] uppercase tracking-wider">Embed</div>
                        <div className="text-[11px] md:text-[7px] text-white/30 uppercase mt-0.5 font-bold">iFrame Web Tool</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditTabType('notes')}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          editTabType === 'notes' 
                            ? 'border-accent/40 bg-accent/10 text-white' 
                            : 'border-white/5 bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <div className="font-black text-[13px] md:text-[10px] uppercase tracking-wider">Notepad</div>
                        <div className="text-[11px] md:text-[7px] text-white/30 uppercase mt-0.5 font-bold">Markdown Page</div>
                      </button>
                    </div>
                  </div>
                )}

                {!selectedTabToEdit.isDefault && editTabType === 'embed' && (
                  <div>
                    <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Embed URL</label>
                    <input 
                      type="text" 
                      placeholder="https://trello.com/..."
                      value={editTabUrl}
                      onChange={(e) => setEditTabUrl(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 outline-none focus:border-accent text-xs font-bold rounded-xl text-white placeholder:opacity-45"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2">Select Icon</label>
                  <IconPickerGrid selected={editTabIcon} onSelect={setEditTabIcon} />
                </div>

                <div>
                  <label className="text-[11px] md:text-[8px] font-black uppercase tracking-widest text-white/40 block mb-2">Role Visibility</label>
                  <div className="flex gap-4 bg-black/40 border border-white/5 p-3 rounded-xl">
                    {CONFIGURABLE_ROLES.map((role) => {
                      const isChecked = editTabRoles.includes(role);
                      return (
                        <label key={role} className="flex items-center gap-2 text-white/60 hover:text-white cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setEditTabRoles(editTabRoles.filter(r => r !== role));
                              } else {
                                setEditTabRoles([...editTabRoles, role]);
                              }
                            }}
                            className="rounded border-white/10 text-accent focus:ring-accent bg-black"
                          />
                          <span className="text-[10px] font-black uppercase tracking-wider">{ROLE_LABELS[role]}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[11px] md:text-[9px] text-white/25 mt-2 leading-relaxed">
                    {ROLE_LABELS.editor} accounts are locked to the Edit Tracker and aren&apos;t affected by this setting.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  {!selectedTabToEdit.isDefault && (
                    <button 
                      type="button"
                      onClick={handleDeleteTab}
                      className="py-3 px-4 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer font-bold"
                    >
                      Delete Tab
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all cursor-pointer font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveEditTab}
                    disabled={!editTabLabel.trim() || (editTabType === 'embed' && !editTabUrl.trim())}
                    className="flex-grow py-3 bg-accent hover:bg-white hover:text-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Start Guide Modal */}
      <QuickStartGuideModal 
        isOpen={isQuickStartOpen} 
        onClose={() => setIsQuickStartOpen(false)} 
        onOpenCalendarSync={() => {
          setIsQuickStartOpen(false);
          setIsCalendarSyncOpen(true);
        }} 
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// FULLSCREEN NOTE WIDGET
// ----------------------------------------------------------------------
function FullscreenNotesWidget({ tabId }: { tabId: string }) {
  const [notes, setNotes] = useState('');
  const storageKey = `studio_scratch_notes_${tabId}`;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes(localStorage.getItem(storageKey) || '');
    }
  }, [storageKey]);

  const saveNotes = (val: string) => {
    setNotes(val);
    localStorage.setItem(storageKey, val);
  };

  return (
    <div className="w-full h-full flex flex-col p-8 bg-zinc-950/20 text-white min-h-[300px]">
      <textarea
        value={notes}
        onChange={(e) => saveNotes(e.target.value)}
        placeholder="Write scratch workspace logs, storyboard drafts, or client call reminders here..."
        className="w-full h-full bg-transparent border-0 resize-none outline-none text-sm font-bold leading-relaxed text-white/70 focus:text-white transition-colors"
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// FULLSCREEN EMBED WIDGET
// ----------------------------------------------------------------------
function FullscreenEmbedWidget({ url }: { url: string }) {
  if (!url) {
    return (
      <div className="p-12 text-center text-xs text-white/40 uppercase tracking-widest">
        No Embed URL configured. Edit the tab settings to set a URL.
      </div>
    );
  }
  return (
    <div className="w-full h-full flex-grow relative bg-neutral-950/20 min-h-[500px]">
      <iframe 
        src={url}
        className="w-full h-full border-0 absolute inset-0 bg-neutral-950/20 animate-fade-in"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
