import { supabase } from '@/lib/supabase';

// Organization branding used across all PDF exports (call sheets, crew &
// gear manifests). Centralized so every export reads from one source and a
// production company can fully rebrand the output.
export interface Branding {
  id?: string;
  name: string;
  tagline: string;
  logo_url?: string | null;
  brand_color: string; // hex
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  /** IANA zone (e.g. "America/New_York") call times are interpreted in. */
  timezone?: string | null;
}

export const DEFAULT_BRANDING: Branding = {
  name: 'Zipline Media',
  tagline: 'Creative Video Production',
  logo_url: null,
  brand_color: '#0077FF',
};

// Convert a hex string (e.g. "#0077FF") to an [r, g, b] tuple for jsPDF.
export function hexToRgb(hex: string): [number, number, number] {
  const clean = (hex || '').replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const bigint = parseInt(full, 16);
  if (Number.isNaN(bigint)) return [0, 119, 255];
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

// Fetch the active organization's branding. Falls back to defaults if the
// organizations table is missing (older deployments) or empty.
export async function getBranding(orgId?: string): Promise<Branding> {
  try {
    let query = supabase.from('organizations').select('*');
    query = orgId ? query.eq('id', orgId) : query.order('created_at', { ascending: true }).limit(1);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return DEFAULT_BRANDING;
    return {
      id: data.id,
      name: data.name || DEFAULT_BRANDING.name,
      tagline: data.tagline || '',
      logo_url: data.logo_url,
      brand_color: data.brand_color || DEFAULT_BRANDING.brand_color,
      address: data.address,
      phone: data.phone,
      email: data.email,
      website: data.website,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}
