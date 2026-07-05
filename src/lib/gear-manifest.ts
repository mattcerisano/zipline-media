import { supabase } from '@/lib/supabase';
import { caps } from '@/lib/format';

// Category display order shared by every gear export (Equipment List,
// Call Sheet, Master Production Brief) so gear always reads in the same
// load-out order no matter which document it appears on.
export const GEAR_CATEGORY_ORDER = [
  'Camera', 'Lens', 'Lens Accessories', 'Grip/Support', 'Playback & Wireless Video',
  'Lighting', 'Modifiers', 'Stands/Grip', 'Audio', 'Power', 'Comms',
  'Backdrops', 'Carts/Cases', 'Computing', 'Specialty'
];

// Bucket for manifest items that no longer match an inventory record
// (one-off custom gear, renamed items, etc.). Always sorts last.
export const UNCATEGORIZED_GEAR = 'Other / Custom';

export interface GearCategoryGroup {
  category: string;
  items: { name: string; count: number }[];
}

// Look up each inventory item's category so a flat gear manifest
// (name -> qty) can be grouped for exports. Fails soft to an empty map —
// unknown items simply land in the "Other / Custom" bucket.
export async function fetchGearCategoryMap(): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase.from('inventory').select('name, category');
    if (error || !data) return new Map();
    return new Map(
      (data as { name: string; category: string }[]).map(i => [i.name, i.category])
    );
  } catch {
    return new Map();
  }
}

// Group a manifest by category, ordered by GEAR_CATEGORY_ORDER with
// unknown categories last and items alphabetized within each group.
export function groupManifestByCategory(
  manifest: Record<string, number>,
  categoryMap: Map<string, string>
): GearCategoryGroup[] {
  const groups = new Map<string, { name: string; count: number }[]>();
  Object.entries(manifest).forEach(([name, count]) => {
    if (!count || count <= 0) return;
    const category = categoryMap.get(name) || UNCATEGORIZED_GEAR;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push({ name, count });
  });

  const orderIndex = (cat: string) => {
    if (cat === UNCATEGORIZED_GEAR) return GEAR_CATEGORY_ORDER.length + 1;
    const idx = GEAR_CATEGORY_ORDER.indexOf(cat);
    return idx === -1 ? GEAR_CATEGORY_ORDER.length : idx;
  };

  return Array.from(groups.entries())
    .sort((a, b) => orderIndex(a[0]) - orderIndex(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, items]) => ({
      category,
      items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

// Build the shared QTY/ITEM autoTable body: a shaded full-width category
// row followed by that category's items. Both the Call Sheet and Master
// Brief render gear through this so the two PDFs stay identical.
export function buildGearTableBody(groups: GearCategoryGroup[]): any[][] {
  const body: any[][] = [];
  groups.forEach(group => {
    body.push([
      {
        content: caps(group.category),
        colSpan: 2,
        styles: {
          fillColor: [240, 240, 240] as [number, number, number],
          textColor: [17, 17, 17] as [number, number, number],
          fontStyle: 'bold' as const,
          fontSize: 8,
          cellPadding: 4,
        },
      },
    ]);
    group.items.forEach(item => {
      body.push([`${item.count}`, caps(item.name)]);
    });
  });
  return body;
}
