/**
 * Edit Tracker columns. Customisable per studio: definitions are
 * { id, label, color } where color is a token the board maps to classes, and a
 * card stores the column's id as its edit_status. Custom definitions live
 * org-wide in organizations.edit_stages (JSONB, migration 20260706000001).
 *
 * Kept out of the board so other screens (My Work) show a card's stage the way
 * the board names it — "Work in Progress", not the stored id "WIP".
 */
export interface EditStageDef {
  id: string;
  label: string;
  color: string;
}

export const DEFAULT_STAGE_DEFS: EditStageDef[] = [
  { id: 'Filmed', label: 'Filmed / Raw', color: 'blue' },
  { id: 'WIP', label: 'Work in Progress', color: 'yellow' },
  { id: 'V1', label: 'V1 / Review', color: 'purple' },
  { id: 'Revisions', label: 'Revisions', color: 'orange' },
  { id: 'Delivered', label: 'Delivered', color: 'green' },
  { id: 'Wrapped', label: 'Wrapped', color: 'neutral' },
];

/** Drop malformed entries; null when nothing usable is left. */
export function sanitizeStageDefs(raw: unknown): EditStageDef[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const defs = raw.filter(
    (d: any) => d && typeof d.id === 'string' && d.id && typeof d.label === 'string' && d.label
  ).map((d: any) => ({ id: d.id, label: d.label, color: typeof d.color === 'string' ? d.color : 'neutral' }));
  return defs.length > 0 ? defs : null;
}

/** A card's stage as the board labels it; the id itself for a stage no longer defined. */
export function stageLabel(defs: EditStageDef[], id: string | null | undefined): string {
  if (!id) return '';
  return defs.find(d => d.id === id)?.label || id;
}
