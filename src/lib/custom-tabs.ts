/**
 * Which saved custom tabs are dropped on load.
 *
 * Notes have one home, Meeting Notes. The full-page notepad tab type and
 * every custom workspace that only opened retired tools (the scratch notepad,
 * the Notes Library) go on load; whatever was typed in them stays in this
 * browser's storage. The rule is about the tools a tab opens with, not its
 * name, so a tab called "Notes" that was seeded with the Task List survives
 * and a tab called "Jotter" that only opened the notepad does not.
 */

export interface RetirableTab {
  type: 'workspace' | 'embed' | 'notes' | 'system';
  label: string;
  starterTools?: string[];
}

/** Starter tools no panel offers any more. */
export const RETIRED_STARTER_TOOLS: ReadonlySet<string> = new Set(['notes', 'docs', 'intake']);

/**
 * Tabs from before starter tools were recorded carry only a label. One named
 * like the notepad opened as a blank notepad on every other device, so it is
 * treated as one.
 */
const SCRATCH_TAB_LABELS: ReadonlySet<string> = new Set(['notes', 'scratch notes', 'notepad', 'scratch notepad']);

export function isRetiredCustomTab(tab: RetirableTab, retiredTools: ReadonlySet<string> = RETIRED_STARTER_TOOLS): boolean {
  if (tab.type === 'notes') return true;
  if (tab.type !== 'workspace') return false;
  const tools = (tab.starterTools || []).map((t) => t.trim()).filter(Boolean);
  if (tools.length > 0) return tools.every((t) => retiredTools.has(t));
  return SCRATCH_TAB_LABELS.has(tab.label.trim().toLowerCase());
}
