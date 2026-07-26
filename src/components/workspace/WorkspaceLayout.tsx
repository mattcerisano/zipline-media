'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Columns, 
  Rows, 
  X, 
  Plus, 
  Layout, 
  Settings, 
  FileText, 
  ChevronDown, 
  RotateCcw,
  LayoutDashboard,
  Calendar,
  Briefcase,
  Scissors,
  Package,
  Palette,
  Users,
  Link,
  ExternalLink,
  Tv,
  Timer,
  Play,
  Pause,
  HelpCircle,
  Lock,
  Mail,
  Share2,
  Plug,
  DollarSign,
  ListTodo,
  UserCheck
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { loadMyScratchNotes, saveMyScratchNotes } from '@/lib/team-prefs';
import { Job } from '@/components/gearbuilder/types';

import Slate from '@/components/teambuilder/Slate';
import EditTracker from '@/components/teambuilder/EditTracker';
import Rentals from '@/components/gearbuilder/Rentals';
import ProductionCalendar from '@/components/gearbuilder/ProductionCalendar';
import Creative from '@/components/teambuilder/Creative';
import SocialMedia from '@/components/social/SocialMedia';
import Rolodex from '@/components/teambuilder/Rolodex';
import DashboardOverview from '@/components/workspace/DashboardOverview';
import { QuickStartWidget } from './QuickStartGuide';
import InboxWidget from '@/components/workspace/InboxWidget';
import Vault from '@/components/workspace/Vault';
import IntegrationsHub from '@/components/workspace/IntegrationsHub';
import BudgetWidget from '@/components/workspace/BudgetWidget';
import TasksWidget from '@/components/workspace/TasksWidget';
import MyWorkWidget from '@/components/workspace/MyWorkWidget';
import NotesLibraryWidget from '@/components/workspace/NotesLibraryWidget';

export type LayoutNode = 
  | { type: 'row'; children: LayoutNode[]; sizes: number[] }
  | { type: 'col'; children: LayoutNode[]; sizes: number[] }
  | { 
      type: 'panel'; 
      id: string; 
      activeTab: string; 
      tabs: string[]; 
      embedUrls?: Record<string, string>; 
      embedLabels?: Record<string, string>; 
    };

const WIDGET_ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  calendar: Calendar,
  slate: Briefcase,
  edits: Scissors,
  gear: Package,
  creative: Palette,
  social: Share2,
  rolodex: Users,
  notes: FileText,
  script: Tv,
  clock: Timer,
  quickstart: HelpCircle,
  inbox: Mail,
  vault: Lock,
  integrations: Plug,
  budget: DollarSign,
  tasks: ListTodo,
  mywork: UserCheck,
  docs: FileText
};

const WIDGET_LABELS: Record<string, string> = {
  dashboard: 'Overview',
  calendar: 'Calendar',
  slate: 'Production Slate',
  edits: 'Edit Tracker',
  gear: 'Gear Builder',
  creative: 'Creative Board',
  social: 'Social Media',
  rolodex: 'Rolodex',
  notes: 'Scratch Notes',
  script: 'Script & Teleprompter',
  clock: 'Production Timer',
  quickstart: 'Quick Start Guide',
  inbox: 'Studio Inbox',
  vault: 'Vault',
  integrations: 'Integrations',
  budget: 'Budget Tracker',
  tasks: 'Task List',
  mywork: 'My Work',
  docs: 'Notes Library'
};

const DEFAULT_LAYOUTS: Record<string, LayoutNode> = {
  dashboard: { type: 'panel', id: 'dash-root', activeTab: 'dashboard', tabs: ['dashboard', 'notes'] },
  calendar: { type: 'panel', id: 'cal-root', activeTab: 'calendar', tabs: ['calendar'] },
  slate: { type: 'panel', id: 'slate-root', activeTab: 'slate', tabs: ['slate'] },
  edits: { type: 'panel', id: 'edits-root', activeTab: 'edits', tabs: ['edits'] },
  gear: { type: 'panel', id: 'gear-root', activeTab: 'gear', tabs: ['gear'] },
  creative: { type: 'panel', id: 'creative-root', activeTab: 'creative', tabs: ['creative'] },
  social: { type: 'panel', id: 'social-root', activeTab: 'social', tabs: ['social'] },
  rolodex: { type: 'panel', id: 'rolodex-root', activeTab: 'rolodex', tabs: ['rolodex'] },
  inbox: { type: 'panel', id: 'inbox-root', activeTab: 'inbox', tabs: ['inbox'] },
  vault: { type: 'panel', id: 'vault-root', activeTab: 'vault', tabs: ['vault'] },
  integrations: { type: 'panel', id: 'integrations-root', activeTab: 'integrations', tabs: ['integrations'] }
};

interface WorkspaceLayoutProps {
  activeTab: string;
  userRole?: 'admin' | 'staff' | 'client' | null;
  preloadedJob: any;
  onClearPreload: () => void;
  preselectedJobId: string | null;
  onClearPreselectedJobId: () => void;
  onSwitchTab: (tab: any) => void;
}

export default function WorkspaceLayout({
  activeTab,
  userRole,
  preloadedJob,
  onClearPreload,
  preselectedJobId,
  onClearPreselectedJobId,
  onSwitchTab
}: WorkspaceLayoutProps) {
  const [layoutRoot, setLayoutRoot] = useState<LayoutNode | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const storageKey = `studio_workspace_layout_${activeTab}`;

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, client_name, job_status')
          .order('shoot_date', { ascending: false });
        if (!error && data) {
          const activeJobs = (data as Job[]).filter(j => j.job_status !== 'Cancelled' && j.job_status !== 'Wrapped');
          setJobs(activeJobs);
        }
      } catch (err) {
        console.error('Error fetching jobs in layout:', err);
      }
    };
    fetchJobs();
  }, []);

  useEffect(() => {
    // Custom tabs (unknown ids) fall back to a blank notes panel, NOT the
    // dashboard — falling through to the dashboard made every new custom tab
    // look like a broken dashboard clone. Freshly created tabs normally have
    // a seeded layout in localStorage already (written at creation time).
    const fallback: LayoutNode =
      DEFAULT_LAYOUTS[activeTab] ||
      ({ type: 'panel', id: `${activeTab}-root`, activeTab: 'notes', tabs: ['notes'] } as LayoutNode);

    // Layouts saved by the old dashboard-fallback bug are permanently
    // contaminated: interacting with a custom tab back then persisted the
    // dashboard's layout (panel id "dash-root") under the custom tab's own
    // storage key, so those tabs kept showing the dashboard even after the
    // fallback was fixed. Detect the tell-tale foreign root id and discard.
    const isContaminated = (node: LayoutNode): boolean => {
      if (node.type === 'panel') return node.id === 'dash-root' && activeTab !== 'dashboard';
      return node.children.some(isContaminated);
    };

    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as LayoutNode;
        if (!DEFAULT_LAYOUTS[activeTab] && isContaminated(parsed)) {
          localStorage.removeItem(storageKey);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLayoutRoot(fallback);
        } else {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLayoutRoot(parsed);
        }
      } catch (e) {
        setLayoutRoot(fallback);
      }
    } else {
      setLayoutRoot(fallback);
    }
  }, [activeTab, storageKey]);

  const saveLayout = (newLayout: LayoutNode) => {
    setLayoutRoot(newLayout);
    localStorage.setItem(storageKey, JSON.stringify(newLayout));
  };

  if (!layoutRoot) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-grow flex flex-col h-full overflow-hidden select-none relative bg-neutral-950/20">
      <div aria-hidden className="workspace-ambient" />
      <div className="relative z-10 flex-1 p-4 md:p-6 lg:p-8 flex flex-col min-h-0">
        <WorkspaceNode 
          node={layoutRoot} 
          onUpdate={saveLayout}
          activeTab={activeTab}
          jobs={jobs}
          userRole={userRole}
          preloadedJob={preloadedJob}
          onClearPreload={onClearPreload}
          preselectedJobId={preselectedJobId}
          onClearPreselectedJobId={onClearPreselectedJobId}
          onSwitchTab={onSwitchTab}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// NODE DISPATCHER
// ----------------------------------------------------------------------
function WorkspaceNode({ 
  node, 
  onUpdate,
  activeTab,
  ...props 
}: { 
  node: LayoutNode; 
  onUpdate: (n: LayoutNode) => void;
  activeTab: string;
  [key: string]: any;
}) {
  if (node.type === 'row' || node.type === 'col') {
    return (
      <WorkspaceSplit 
        node={node} 
        onUpdate={onUpdate} 
        activeTab={activeTab}
        {...props} 
      />
    );
  }
  return (
    <WorkspacePanel 
      node={node} 
      onUpdate={onUpdate} 
      activeTab={activeTab} 
      {...props} 
    />
  );
}

// ----------------------------------------------------------------------
// ROW / COLUMN SPLITS WITH DRAG HANDLERS
// ----------------------------------------------------------------------
function WorkspaceSplit({ 
  node, 
  onUpdate,
  activeTab,
  ...props 
}: { 
  node: LayoutNode & { type: 'row' | 'col' }; 
  onUpdate: (n: LayoutNode) => void;
  activeTab: string;
  [key: string]: any; 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isRow = node.type === 'row';

  const startResize = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startPos = isRow ? e.clientX : e.clientY;
    const initialSizes = [...node.sizes];
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalSize = isRow ? rect.width : rect.height;
      const delta = (isRow ? moveEvent.clientX : moveEvent.clientY) - startPos;
      const deltaPercent = (delta / totalSize) * 100;
      
      const newSizes = [...initialSizes];
      newSizes[index] = Math.max(15, initialSizes[index] + deltaPercent);
      newSizes[index + 1] = Math.max(15, initialSizes[index + 1] - deltaPercent);
      
      // Keep sum balanced
      const sum = newSizes.reduce((a, b) => a + b, 0);
      const normalizedSizes = newSizes.map(s => (s / sum) * 100);
      
      onUpdate({
        ...node,
        sizes: normalizedSizes
      });
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleChildUpdate = (childIndex: number, updatedChild: LayoutNode) => {
    const newChildren = [...node.children];
    newChildren[childIndex] = updatedChild;
    onUpdate({
      ...node,
      children: newChildren
    });
  };

  const handleChildDelete = (childIndex: number) => {
    const newChildren = node.children.filter((_, idx) => idx !== childIndex);
    const newSizes = node.sizes.filter((_, idx) => idx !== childIndex);
    
    const sum = newSizes.reduce((a, b) => a + b, 0);
    const normalizedSizes = sum > 0 ? newSizes.map(s => (s / sum) * 100) : [100];
    
    if (newChildren.length === 1) {
      onUpdate(newChildren[0]);
    } else {
      onUpdate({
        ...node,
        children: newChildren,
        sizes: normalizedSizes
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`flex-1 flex min-h-0 min-w-0 ${isRow ? 'flex-row' : 'flex-col'}`}
    >
      {node.children.map((child, idx) => {
        const size = node.sizes[idx] || (100 / node.children.length);
        const style = isRow ? { width: `${size}%` } : { height: `${size}%` };
        
        return (
          <React.Fragment key={idx}>
            <div style={style} className="flex min-h-0 min-w-0">
                <WorkspaceNode 
                  node={child} 
                  onUpdate={(updated) => handleChildUpdate(idx, updated)}
                  onDelete={() => handleChildDelete(idx)}
                  activeTab={activeTab}
                  {...props}
                />
            </div>
            {idx < node.children.length - 1 && (
              <div 
                onMouseDown={(e) => startResize(idx, e)}
                className={`relative shrink-0 select-none z-40 transition-colors
                  ${isRow 
                    ? 'w-1.5 cursor-col-resize hover:bg-accent/40 border-x border-white/5 bg-black/40' 
                    : 'h-1.5 cursor-row-resize hover:bg-accent/40 border-y border-white/5 bg-black/40'
                  }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------
// WORKSPACE PANEL (THE WIDGET SHELL)
// ----------------------------------------------------------------------
function WorkspacePanel({ 
  node, 
  onUpdate,
  onDelete,
  activeTab,
  jobs = [],
  userRole,
  preloadedJob,
  onClearPreload,
  preselectedJobId,
  onClearPreselectedJobId,
  onSwitchTab
}: { 
  node: LayoutNode & { type: 'panel' }; 
  onUpdate: (n: LayoutNode) => void;
  onDelete?: () => void;
  activeTab: string;
  jobs?: Job[];
  [key: string]: any;
}) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectTab = (tab: string) => {
    onUpdate({
      ...node,
      activeTab: tab
    });
  };

  const handleAddTab = (tab: string) => {
    if (node.tabs.includes(tab)) {
      handleSelectTab(tab);
    } else {
      onUpdate({
        ...node,
        tabs: [...node.tabs, tab],
        activeTab: tab
      });
    }
    setShowAddMenu(false);
  };

  const handleAddJobTab = (jobId: string) => {
    const tabId = `${activeTab}_job_${jobId}`;
    if (node.tabs.includes(tabId)) {
      handleSelectTab(tabId);
    } else {
      onUpdate({
        ...node,
        tabs: [...node.tabs, tabId],
        activeTab: tabId
      });
    }
    setShowAddMenu(false);
  };

  const handleCloseTab = (tab: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.tabs.length <= 1) return; // Keep at least one
    const newTabs = node.tabs.filter(t => t !== tab);
    const newActive = node.activeTab === tab ? newTabs[0] : node.activeTab;
    onUpdate({
      ...node,
      tabs: newTabs,
      activeTab: newActive
    });
  };

  const handleSplit = (splitType: 'row' | 'col') => {
    const newNode: LayoutNode = {
      type: splitType,
      sizes: [50, 50],
      children: [
        { ...node },
        { type: 'panel', id: Math.random().toString(), activeTab: 'notes', tabs: ['notes'] }
      ]
    };
    onUpdate(newNode);
  };

  return (
    // NOTE: no backdrop-filter/transform on this shell — either would turn the
    // panel into the containing block for `position: fixed` descendants,
    // trapping every widget modal (Add Contact, Add Production, …) inside the
    // panel instead of centering it in the viewport.
    <div className="panel-rise flex-1 bg-zinc-950/60 border border-white/10 rounded-2xl flex flex-col overflow-hidden min-h-0 min-w-0 shadow-xl m-1 group relative">
      {/* Panel Header */}
      <div className="h-10 bg-black/40 border-b border-white/5 px-3 flex items-center justify-between shrink-0 select-none relative z-40">
        
        <div className="flex items-center gap-1.5 flex-grow min-w-0 h-full">
          {/* Tabs Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar h-full pt-1 max-w-[calc(100%-36px)]">
            {node.tabs.map(t => {
              const isActive = node.activeTab === t;
              const isEmbed = t.startsWith('embed_');
              const isJobBound = t.includes('_job_');
              
              let label = t;
              let Icon = Layout;

              if (isEmbed) {
                Icon = Link;
                label = node.embedLabels?.[t] || 'Web Embed';
              } else if (isJobBound) {
                const parts = t.split('_job_');
                const widgetType = parts[0];
                const jobId = parts[1];
                Icon = WIDGET_ICONS[widgetType] || Layout;
                
                const job = jobs.find(j => j.id === jobId);
                const catPrefix = widgetType === 'gear' ? 'GEAR' :
                                  widgetType === 'creative' ? 'CREATIVE' :
                                  widgetType === 'slate' ? 'SLATE' :
                                  widgetType === 'edits' ? 'EDITS' : widgetType.toUpperCase();
                label = job ? `${catPrefix}: ${job.title}` : `${catPrefix}: LOADING...`;
              } else {
                Icon = WIDGET_ICONS[t] || Layout;
                label = WIDGET_LABELS[t] || t;
              }
              
              return (
                <div 
                  key={t}
                  onClick={() => handleSelectTab(t)}
                  className={`h-9 px-3 rounded-t-lg flex items-center gap-2 text-[12px] font-medium tracking-tight cursor-pointer border-t-2 transition-all shrink-0
                    ${isActive 
                      ? 'bg-neutral-900 border-t-accent text-white shadow-md' 
                      : 'bg-transparent border-t-transparent text-white/40 hover:text-white/80'
                    }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                  {isJobBound && (
                    <Lock className="w-2.5 h-2.5 text-accent opacity-60 shrink-0" />
                  )}
                  {/* Fat tap target on phones — the desktop 10px X sits inside the
                      tab's own select handler, so a near miss switched tabs
                      instead of closing one. */}
                  {node.tabs.length > 1 && (
                    <button
                      onClick={(e) => handleCloseTab(t, e)}
                      aria-label={`Close ${label}`}
                      title={`Close ${label}`}
                      className="p-2 -mr-1.5 md:p-0.5 md:mr-0 hover:bg-white/10 rounded text-white/30 hover:text-white transition-colors ml-1 shrink-0 touch-manipulation"
                    >
                      <X className="w-3.5 h-3.5 md:w-2.5 md:h-2.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
  
          {/* Plus Add Panel Tab button */}
          <div className="relative pt-1 shrink-0" ref={menuRef}>
            <button 
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {showAddMenu && (
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 max-h-[350px] overflow-y-auto custom-scrollbar">
                {['gear', 'creative', 'slate', 'edits'].includes(activeTab) ? (
                  <>
                    <p className="text-[7px] font-black tracking-widest uppercase text-white/30 px-2.5 py-1.5 border-b border-white/5 mb-1">Select Job For Tab</p>
                    <div className="max-h-[200px] overflow-y-auto no-scrollbar space-y-0.5">
                      {jobs.map(job => (
                        <button
                          key={job.id}
                          onClick={() => handleAddJobTab(job.id)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[9px] font-bold text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left uppercase tracking-wider"
                        >
                          <span className="truncate max-w-[150px]">{job.title}</span>
                          {job.client_name && (
                            <span className="text-[7px] opacity-40 truncate max-w-[50px]">{job.client_name}</span>
                          )}
                        </button>
                      ))}
                      {jobs.length === 0 && (
                        <p className="text-[8px] text-white/30 px-2.5 py-3 uppercase tracking-widest text-center">No Active Jobs Found</p>
                      )}
                    </div>
                    
                    <div className="border-t border-white/5 mt-1.5 pt-1.5">
                      <details className="group/details">
                        <summary className="list-none flex items-center justify-between px-2.5 py-1 text-[7px] font-black tracking-widest uppercase text-white/40 cursor-pointer hover:text-white select-none">
                          <span>Other Widgets</span>
                          <ChevronDown className="w-2.5 h-2.5 transition-transform group-open/details:rotate-180" />
                        </summary>
                        <div className="mt-1 space-y-0.5">
                          {Object.keys(WIDGET_LABELS).map(key => {
                            const Icon = WIDGET_ICONS[key] || Layout;
                            return (
                              <button
                                key={key}
                                onClick={() => handleAddTab(key)}
                                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[8px] font-bold text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left uppercase tracking-wider"
                              >
                                <Icon className="w-3.5 h-3.5 text-accent" />
                                <span>{WIDGET_LABELS[key]}</span>
                              </button>
                            );
                          })}
                          <button
                            onClick={() => handleAddTab('embed_' + Date.now())}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[8px] font-bold text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left uppercase tracking-wider"
                          >
                            <Link className="w-3.5 h-3.5 text-accent" />
                            <span>Web Embed</span>
                          </button>
                        </div>
                      </details>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[7px] font-black tracking-widest uppercase text-white/30 px-2.5 py-1.5 border-b border-white/5 mb-1">Select Panel View</p>
                    {Object.keys(WIDGET_LABELS).map(key => {
                      const Icon = WIDGET_ICONS[key] || Layout;
                      return (
                        <button
                          key={key}
                          onClick={() => handleAddTab(key)}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-[9px] font-bold text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left uppercase tracking-wider"
                        >
                          <Icon className="w-3.5 h-3.5 text-accent" />
                          <span>{WIDGET_LABELS[key]}</span>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleAddTab('embed_' + Date.now())}
                      className="w-full flex items-center gap-2 px-2.5 py-2 text-[9px] font-bold text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-left uppercase tracking-wider border-t border-white/5"
                    >
                      <Link className="w-3.5 h-3.5 text-accent" />
                      <span>Web Embed</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
 
        {/* Panel splitting operations. The hover reveal is desktop-only: touch
            devices never fire hover, so gating these behind group-hover left the
            close button permanently invisible and a panel impossible to dismiss
            on a phone. */}
        <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          {/* Splits are mouse-only — the resize handle listens for mousedown —
              so they stay off the phone header rather than making panes that
              can never be resized. */}
          <button
            onClick={() => handleSplit('row')}
            className="hidden md:block p-1.5 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
            title="Split Vertically (Row)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleSplit('col')}
            className="hidden md:block p-1.5 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
            title="Split Horizontally (Column)"
          >
            <Rows className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label="Close panel"
              className="p-2 md:p-1.5 md:ml-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-red-500/20 md:border-transparent md:hover:border-red-500/20 touch-manipulation"
              title="Close Panel"
            >
              <X className="w-4 h-4 md:w-3.5 md:h-3.5" />
            </button>
          )}
        </div>
      </div>
 
      {/* Panel Content Mount Area */}
      <div className="flex-grow overflow-y-auto min-h-0 min-w-0 bg-neutral-900/10">
        <WidgetMount 
          type={node.activeTab}
          node={node}
          onUpdateNode={onUpdate}
          userRole={userRole}
          preloadedJob={preloadedJob}
          onClearPreload={onClearPreload}
          preselectedJobId={preselectedJobId}
          onClearPreselectedJobId={onClearPreselectedJobId}
          onSwitchTab={onSwitchTab}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// WEBPAGE EMBED WIDGET
// ----------------------------------------------------------------------
function EmbedWidget({ 
  tabId, 
  node, 
  onUpdateNode 
}: { 
  tabId: string; 
  node: any; 
  onUpdateNode: (n: any) => void;
}) {
  const currentUrl = node.embedUrls?.[tabId] || '';
  const currentLabel = node.embedLabels?.[tabId] || 'Web Embed';
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [labelInput, setLabelInput] = useState(currentLabel);
  const [isEditing, setIsEditing] = useState(!currentUrl);

  const handleSave = () => {
    let formattedUrl = urlInput.trim();
    if (formattedUrl && !/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    onUpdateNode({
      ...node,
      embedUrls: {
        ...node.embedUrls,
        [tabId]: formattedUrl
      },
      embedLabels: {
        ...node.embedLabels,
        [tabId]: labelInput.trim() || 'Web Embed'
      }
    });
    setIsEditing(false);
  };

  const handlePreset = (url: string, label: string) => {
    setUrlInput(url);
    setLabelInput(label);
  };

  if (isEditing) {
    return (
      <div className="p-6 flex flex-col justify-center items-center h-full bg-zinc-950/20 text-white space-y-4 min-h-[300px]">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
          <Link className="w-5 h-5 text-accent" />
        </div>
        <div className="text-center">
          <h4 className="text-[10px] font-black uppercase tracking-wider text-white">Embed External Tool</h4>
          <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest mt-1">Embed Trello, Vimeo, Figma, Frame.io or any page</p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Widget Label</label>
            <input 
              type="text" 
              placeholder="E.G. FIGMA BOARD"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 p-3 outline-none focus:border-accent text-xs font-bold rounded-xl text-white uppercase placeholder:opacity-20"
            />
          </div>
          <div>
            <label className="text-[8px] font-black uppercase tracking-widest text-white/40 block mb-1">Tool URL</label>
            <input 
              type="text" 
              placeholder="https://trello.com/b/..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full bg-black/40 border border-white/10 p-3 outline-none focus:border-accent text-xs font-bold rounded-xl text-white placeholder:opacity-20"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap justify-center py-1">
            <button 
              onClick={() => handlePreset('https://trello.com', 'Trello')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
            >
              Trello
            </button>
            <button 
              onClick={() => handlePreset('https://figma.com', 'Figma')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
            >
              Figma
            </button>
            <button 
              onClick={() => handlePreset('https://vimeo.com', 'Vimeo')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
            >
              Vimeo
            </button>
            <button 
              onClick={() => handlePreset('https://frame.io', 'Frame.io')}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[8px] font-bold uppercase tracking-wider text-white/60 hover:text-white"
            >
              Frame.io
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            {currentUrl && (
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-all"
              >
                Cancel
              </button>
            )}
            <button 
              onClick={handleSave}
              disabled={!urlInput.trim()}
              className="flex-grow py-2.5 bg-accent hover:bg-white hover:text-black text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Save Embed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative group/embed min-h-[200px]">
      {/* Hover action bar overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/embed:opacity-100 transition-opacity z-30">
        <button 
          onClick={() => setIsEditing(true)}
          className="px-2 py-1 bg-black/85 hover:bg-black border border-white/10 hover:border-white/20 rounded-lg text-white/60 hover:text-white text-[8px] font-black uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer"
          title="Configure Embed"
        >
          Configure
        </button>
        <button 
          onClick={() => window.open(currentUrl, '_blank')}
          className="p-1 bg-black/85 hover:bg-black border border-white/10 hover:border-white/20 rounded-lg text-white/60 hover:text-white transition-all cursor-pointer"
          title="Open in new window"
        >
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      <iframe 
        src={currentUrl}
        className="w-full h-full border-0 bg-neutral-950/20"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// WIDGET DISPATCHER MOUNT
// ----------------------------------------------------------------------
function WidgetMount({ 
  type,
  node,
  onUpdateNode,
  userRole,
  preloadedJob,
  onClearPreload,
  preselectedJobId,
  onClearPreselectedJobId,
  onSwitchTab
}: { 
  type: string;
  node: any;
  onUpdateNode: (n: any) => void;
  [key: string]: any;
}) {
  if (type.startsWith('embed_')) {
    return (
      <EmbedWidget 
        tabId={type}
        node={node}
        onUpdateNode={onUpdateNode}
      />
    );
  }

  // Parse job bound tabs
  let widgetType = type;
  let boundJobId: string | null = null;
  if (type.includes('_job_')) {
    const parts = type.split('_job_');
    widgetType = parts[0];
    boundJobId = parts[1];
  }

  switch (widgetType) {
    case 'dashboard':
      return <DashboardOverview onSwitchTab={onSwitchTab} />;
    case 'calendar':
      return (
        <div className="p-4 md:p-6 bg-neutral-900/10 h-full overflow-y-auto">
          <ProductionCalendar editable enableQuickEvents onSelectJob={(job) => onSwitchTab({ selectCalendarJob: job.id })} />
        </div>
      );
    case 'slate':
      return (
        <Slate 
          userRole={userRole || undefined}
          onBuildGear={(job: any) => onSwitchTab({ gearJob: job })}
          preselectedJobId={boundJobId || preselectedJobId}
          onClearPreselectedJobId={onClearPreselectedJobId}
        />
      );
    case 'edits':
      return <EditTracker userRole={userRole || undefined} selectedJobId={boundJobId || undefined} />;
    case 'gear':
      return (
        <Rentals 
          preloadedJob={preloadedJob} 
          onClearPreload={onClearPreload} 
          selectedJobId={boundJobId || undefined}
        />
      );
    case 'creative':
      return <Creative selectedJobId={boundJobId || undefined} />;
    case 'social':
      return <SocialMedia />;
    case 'rolodex':
      return <Rolodex />;
    case 'notes':
      return <NotesWidget />;
    case 'script':
      return <ScriptWidget />;
    case 'clock':
      return <ClockWidget />;
    case 'quickstart':
      return <QuickStartWidget />;
    case 'inbox':
      return <InboxWidget />;
    case 'integrations':
      return <IntegrationsHub />;
    case 'budget':
      return <BudgetWidget />;
    case 'tasks':
      return <TasksWidget />;
    case 'mywork':
      return <MyWorkWidget />;
    case 'docs':
      return <NotesLibraryWidget />;
    case 'vault':
      return <Vault />;
    default:
      return (
        <div className="p-6 text-center text-xs text-white/40 uppercase tracking-widest">
          Layout Widget Empty
        </div>
      );
  }
}

// ----------------------------------------------------------------------
// SCRATCH NOTES WIDGET
// ----------------------------------------------------------------------
function NotesWidget() {
  const [notes, setNotes] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('studio_scratch_notes') || '';
    }
    return '';
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Profile copy wins over this browser's copy, so notes follow the user
  // across devices. Only applied before any local typing this session.
  const touched = useRef(false);
  useEffect(() => {
    loadMyScratchNotes().then((remote) => {
      if (remote !== null && !touched.current) {
        setNotes(remote);
        localStorage.setItem('studio_scratch_notes', remote);
      }
    });
  }, []);

  const saveNotes = (val: string) => {
    touched.current = true;
    setNotes(val);
    localStorage.setItem('studio_scratch_notes', val);
    // Debounced profile write — one save per pause, not per keystroke.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveMyScratchNotes(val), 800);
  };

  return (
    <div className="w-full h-full flex flex-col p-5 bg-neutral-950/20 text-white min-h-[140px]">
      <textarea
        value={notes}
        onChange={(e) => saveNotes(e.target.value)}
        placeholder="Write scratch workspace logs, storyboard drafts, or client call reminders here..."
        className="w-full h-full bg-transparent border-0 resize-none outline-none text-xs font-bold leading-relaxed text-white/70 focus:text-white transition-colors"
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// SCRIPT & TELEPROMPTER WIDGET
// ----------------------------------------------------------------------
function ScriptWidget() {
  const [script, setScript] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('studio_script_text') || 'Write your script here... \n\nDouble click to edit. Use the Teleprompter mode on set for actors/directors to read along.';
    }
    return '';
  });
  const [isTeleprompter, setIsTeleprompter] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [fontSize, setFontSize] = useState(40);
  const [isFlipped, setIsFlipped] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const saveScript = (val: string) => {
    setScript(val);
    localStorage.setItem('studio_script_text', val);
  };

  useEffect(() => {
    if (!isPlaying || !isTeleprompter) return;
    let lastTime = performance.now();
    let frameId: number;
    
    const scroll = (now: number) => {
      if (!scrollRef.current) return;
      const elapsed = now - lastTime;
      const pixelsPerMs = scrollSpeed * 0.04;
      scrollRef.current.scrollTop += pixelsPerMs * elapsed;
      lastTime = now;
      frameId = requestAnimationFrame(scroll);
    };
    
    frameId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying, scrollSpeed, isTeleprompter]);

  if (isTeleprompter) {
    return (
      <div className="w-full h-full flex flex-col bg-black text-white relative min-h-[300px]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-zinc-900/90 border-b border-white/5 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPlaying ? 'Pause' : 'Scroll'}
            </button>
            <button 
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollTop = 0;
                setIsPlaying(false);
              }}
              className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Reset
            </button>
            <button 
              onClick={() => setIsFlipped(!isFlipped)}
              className={`px-3 py-2 border rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isFlipped ? 'bg-accent/20 border-accent/20 text-accent' : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
            >
              Flip/Mirror
            </button>
          </div>

          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/40">
            <div className="flex items-center gap-2">
              <span>Speed: {scrollSpeed}x</span>
              <input 
                type="range" 
                min="1" 
                max="10" 
                value={scrollSpeed}
                onChange={(e) => setScrollSpeed(Number(e.target.value))}
                className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <span>Size: {fontSize}px</span>
              <input 
                type="range" 
                min="20" 
                max="100" 
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
              />
            </div>
            <button 
              onClick={() => {
                setIsPlaying(false);
                setIsTeleprompter(false);
              }}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border border-red-500/20 transition-all ml-2"
            >
              Exit
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-10 py-40 select-none no-scrollbar cursor-pointer"
          onClick={() => setIsPlaying(!isPlaying)}
        >
          <div 
            style={{ fontSize: `${fontSize}px` }}
            className={`font-black uppercase tracking-tight text-center leading-relaxed transition-all max-w-4xl mx-auto
              ${isFlipped ? 'scale-x-[-1]' : ''}`}
          >
            {script.split('\n').map((paragraph, i) => (
              <p key={i} className="mb-10 text-white/90 hover:text-white">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        <div className="absolute top-[48%] left-0 w-full h-[60px] border-y-2 border-accent/20 bg-accent/5 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col p-5 bg-neutral-950/20 text-white min-h-[200px]">
      <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Tv className="w-4 h-4 text-accent" />
          <h4 className="text-[10px] font-black uppercase tracking-widest">Script & Teleprompter</h4>
        </div>
        <button 
          onClick={() => setIsTeleprompter(true)}
          className="px-4 py-1.5 bg-accent hover:bg-white hover:text-black text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1 shadow-lg shadow-accent/15"
        >
          <Play className="w-3 h-3 fill-current" /> Teleprompter Mode
        </button>
      </div>

      <textarea
        value={script}
        onChange={(e) => saveScript(e.target.value)}
        placeholder="Type or paste scripts here..."
        className="w-full flex-grow bg-transparent border-0 resize-none outline-none text-xs font-bold leading-relaxed text-white/70 focus:text-white transition-colors"
      />
    </div>
  );
}

// ----------------------------------------------------------------------
// PRODUCTION TIMER WIDGET
// ----------------------------------------------------------------------
function ClockWidget() {
  const [localTime, setLocalTime] = useState('');
  
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [laps, setLaps] = useState<string[]>([]);
  const stopwatchInterval = useRef<any>(null);

  const [countdownTarget, setCountdownTarget] = useState('18:00');
  const [countdownString, setCountdownString] = useState('--h --m --s');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLocalTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (stopwatchRunning) {
      const start = Date.now() - stopwatchTime;
      stopwatchInterval.current = setInterval(() => {
        setStopwatchTime(Date.now() - start);
      }, 10);
    } else {
      if (stopwatchInterval.current) clearInterval(stopwatchInterval.current);
    }
    return () => {
      if (stopwatchInterval.current) clearInterval(stopwatchInterval.current);
    };
  }, [stopwatchRunning]);

  useEffect(() => {
    const updateCountdown = () => {
      if (!countdownTarget) {
        setCountdownString('--h --m --s');
        return;
      }
      
      const now = new Date();
      const [targetHour, targetMin] = countdownTarget.split(':').map(Number);
      
      const targetDate = new Date();
      targetDate.setHours(targetHour, targetMin, 0, 0);

      if (targetDate.getTime() < now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const diff = targetDate.getTime() - now.getTime();
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      const hrsStr = hrs.toString().padStart(2, '0');
      const minsStr = mins.toString().padStart(2, '0');
      const secsStr = secs.toString().padStart(2, '0');

      setCountdownString(`${hrsStr}h ${minsStr}m ${secsStr}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [countdownTarget]);

  const formatStopwatch = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    const centi = Math.floor((ms % 1000) / 10);

    const minStr = min.toString().padStart(2, '0');
    const secStr = sec.toString().padStart(2, '0');
    const centiStr = centi.toString().padStart(2, '0');

    return `${minStr}:${secStr}.${centiStr}`;
  };

  const handleLap = () => {
    setLaps(prev => [...prev, formatStopwatch(stopwatchTime)]);
  };

  const handleResetStopwatch = () => {
    setStopwatchRunning(false);
    setStopwatchTime(0);
    setLaps([]);
  };

  return (
    <div className="w-full h-full flex flex-col p-5 bg-neutral-950/20 text-white min-h-[220px] overflow-y-auto no-scrollbar">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4 shrink-0">
        <Timer className="w-4 h-4 text-accent" />
        <h4 className="text-[10px] font-black uppercase tracking-widest">Production Timer</h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Local Time</p>
          <p className="text-2xl font-black tracking-tight text-accent mt-2 font-mono">{localTime}</p>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center text-center relative group/countdown">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Target Countdown</p>
          <p className="text-xl font-black tracking-tight text-white mt-2 font-mono">{countdownString}</p>
          
          <div className="mt-2 flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-lg px-2 py-1 focus-within:border-accent/40">
            <span className="text-[7px] font-black tracking-wider text-white/30">SET TARGET:</span>
            <input 
              type="time" 
              value={countdownTarget}
              onChange={(e) => setCountdownTarget(e.target.value)}
              className="bg-transparent border-0 p-0 text-[9px] font-black text-white outline-none w-16 cursor-pointer"
            />
          </div>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col justify-center items-center text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Set Stopwatch</p>
          <p className="text-xl font-black tracking-tight text-white mt-1.5 font-mono">{formatStopwatch(stopwatchTime)}</p>
          
          <div className="flex gap-2 mt-3">
            <button 
              onClick={() => setStopwatchRunning(!stopwatchRunning)}
              className={`px-3 py-1.5 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${stopwatchRunning ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' : 'bg-accent text-white shadow-md shadow-accent/15'}`}
            >
              {stopwatchRunning ? 'Pause' : 'Start'}
            </button>
            {stopwatchRunning && (
              <button 
                onClick={handleLap}
                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/80 border border-white/5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
              >
                Lap
              </button>
            )}
            <button 
              onClick={handleResetStopwatch}
              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
            >
              Reset
            </button>
          </div>

          {laps.length > 0 && (
            <div className="mt-3 w-full max-h-16 overflow-y-auto border-t border-white/5 pt-2 text-[8px] font-mono text-white/40 space-y-0.5 text-left uppercase">
              {laps.slice().reverse().map((lap, i) => (
                <div key={i} className="flex justify-between">
                  <span>Lap {laps.length - i}</span>
                  <span>{lap}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
