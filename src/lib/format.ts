/**
 * Capitalization policy for Studio OS.
 *
 * The app displays structured fields (titles, names, clients, companies,
 * locations, crew positions, gear, categories) in ALL CAPS. Stored data is
 * kept exactly as typed so proper nouns aren't lost. To make exported
 * documents (call sheets, gear lists, briefs) match what's on screen, run
 * structured fields through `caps()` at render/export time.
 *
 * Do NOT use `caps()` on free-form prose (notes, descriptions, creative
 * briefs) or machine values (URLs, emails) — those render as typed.
 */

/** Uppercase a structured field for display/export. Null-safe; returns the
 *  fallback when the value is empty. Whitespace runs (double spaces, tabs,
 *  non-breaking spaces from copy/paste) collapse to a single space — stray
 *  whitespace in hand-typed names otherwise renders as large gaps in PDF
 *  table cells. */
export function caps(value: string | null | undefined, fallback = ''): string {
  const v = (value ?? '').toString().replace(/\s+/g, ' ').trim();
  return v ? v.toUpperCase() : fallback;
}

/** USD for money on screen. Whole dollars by default — cents are noise on a
 *  production card; pass `cents` when the exact figure matters. */
export function currency(amount: number | null | undefined, opts: { cents?: boolean } = {}): string {
  const n = Number(amount || 0);
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  });
}
