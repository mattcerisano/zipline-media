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
 *  fallback when the value is empty. */
export function caps(value: string | null | undefined, fallback = ''): string {
  const v = (value ?? '').toString().trim();
  return v ? v.toUpperCase() : fallback;
}
