/**
 * Shared sizing for toolbar controls.
 *
 * The Slate, Edit Tracker and Job Detail toolbars were each written on their
 * own, so a filter pill was 43px tall in one and 38px in another, a CTA was
 * 52px, and gaps ranged from 8px to 24px inside a single row. Nothing was
 * broken — it just read as cramped and slightly misaligned everywhere, because
 * no two rows agreed on a height.
 *
 * These are the agreement. One height, one radius, one type scale, one gap.
 * Import them rather than retyping the class strings, so the next toolbar
 * inherits the decision instead of re-making it.
 *
 * The 44px height is not arbitrary: it doubles as the minimum comfortable
 * touch target, so a control that satisfies this file also satisfies the
 * tap-target floor on a phone.
 */

/** Every interactive control in a toolbar row is this tall. */
export const CONTROL_H = 'h-11';

/** Shape and type shared by fields, pills and CTAs. */
const CONTROL_BASE = `${CONTROL_H} rounded-xl text-[13px] font-medium tracking-tight transition-colors`;

/** Text input / select surface. */
export const CONTROL_FIELD =
  `${CONTROL_BASE} bg-black/50 border border-white/10 text-white px-4 outline-none focus:border-accent`;

/** Select. Same surface as a field, plus the pointer affordance. */
export const CONTROL_SELECT = `${CONTROL_FIELD} cursor-pointer appearance-none`;

/**
 * Width cap for a filter select.
 *
 * A <select> sizes itself to its longest option, not to its current value. A
 * client filter listing "Moulin Rouge! The Musical — Broadway Company" renders
 * ~385px wide even while showing "All Clients", which is what pushed the Slate
 * toolbar onto a third row no matter how the container was arranged. The cap
 * makes a filter's width a property of the toolbar rather than of whatever the
 * studio happened to name a client.
 */
export const CONTROL_SELECT_MAX = 'max-w-[190px]';

/** Toggle pill, e.g. Group / Grouped. Pass whether it is active. */
export const controlToggle = (active: boolean) =>
  `${CONTROL_BASE} border px-4 ${
    active
      ? 'bg-accent text-white border-accent'
      : 'bg-black/50 border-white/10 text-white/60 hover:text-white'
  }`;

/** Secondary action, e.g. My Cards / Columns / Templates. */
export const CONTROL_BUTTON =
  `${CONTROL_BASE} bg-black/50 border border-white/10 text-white/70 hover:text-white px-4 inline-flex items-center justify-center gap-2`;

/** Primary call to action. Same height as everything beside it. */
export const CONTROL_CTA =
  `${CONTROL_BASE} bg-accent text-white px-5 font-semibold hover:bg-white hover:text-black shadow-lg shadow-accent/20 inline-flex items-center justify-center gap-2`;

/**
 * Gap between controls in a row — 10px, inside the 8–12px band that reads as
 * deliberate rather than either cramped or disconnected.
 */
export const CONTROL_GAP = 'gap-2.5';

/**
 * Sub-navigation tab labels. Kept as the Job Detail's own all-caps voice rather
 * than folded into the toolbar type scale — these are section headings, not
 * controls. Shared so the three tabs cannot drift apart from each other.
 */
export const TAB_STRIP_TEXT = 'text-lg font-black uppercase tracking-tighter';

/** The card a toolbar row sits in. */
export const TOOLBAR_CARD =
  'bg-neutral-900/40 border border-white/10 rounded-2xl p-5 md:p-6';
