/**
 * Coordinates for the Locations map.
 *
 * Productions and scouted locations each keep `latitude`/`longitude` and
 * `geocoded_address` — the exact text those coordinates were looked up from.
 * Comparing that with the address as it reads now says whether a row still
 * has to be placed: a new row, or one whose address was edited since, does.
 * An address Google couldn't find keeps its text with no coordinates, so it
 * isn't sent again on every visit. Drawing the map never geocodes anything.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** What a row stores about where it is. */
export interface StoredPlace {
  latitude?: number | null;
  longitude?: number | null;
  geocoded_address?: string | null;
}

/** Text that holds the place of an address rather than being one. */
const PLACEHOLDER = /^(?:tbd|tba|tbc|n\/?a|none|unknown|remote|virtual|zoom|online|various|multiple|[-–—?.\s]*)$/i;

/**
 * The text a row is placed by, or null when there's nothing to look up.
 * Only the street address: a venue name alone ("Mark's loft") sends the
 * Geocoding API guessing, and a wrong pin is worse than none.
 */
export function placeText(address: string | null | undefined): string | null {
  const text = (address || '').trim().replace(/\s+/g, ' ');
  if (text.length < 3 || PLACEHOLDER.test(text)) return null;
  return text;
}

/** Whether a row's address has to be looked up (again). */
export function needsPlacing(text: string | null, row: StoredPlace): boolean {
  return !!text && row.geocoded_address !== text;
}

/** A row's coordinates, if they belong to the address it has now. */
export function currentPoint(text: string | null, row: StoredPlace): GeoPoint | null {
  if (!text || row.geocoded_address !== text) return null;
  const { latitude: lat, longitude: lng } = row;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export interface PlaceableRow extends StoredPlace {
  table: 'jobs' | 'locations';
  id: string;
  text: string | null;
}

/**
 * Sorts the rows that need placing into those another row already answers —
 * the same address looked up before, found or not, costs nothing — and the
 * distinct addresses still to send to Google.
 */
export function planPlacing(rows: PlaceableRow[]): {
  known: { row: PlaceableRow; point: GeoPoint | null }[];
  lookups: Map<string, PlaceableRow[]>;
} {
  const answered = new Map<string, GeoPoint | null>();
  for (const row of rows) {
    if (!row.text || row.geocoded_address !== row.text) continue;
    const point = currentPoint(row.text, row);
    // A found point wins over a "not found" recorded for the same text.
    if (point || !answered.has(row.text)) answered.set(row.text, point);
  }
  const known: { row: PlaceableRow; point: GeoPoint | null }[] = [];
  const lookups = new Map<string, PlaceableRow[]>();
  for (const row of rows) {
    if (!needsPlacing(row.text, row)) continue;
    const text = row.text as string;
    if (answered.has(text)) known.push({ row, point: answered.get(text) ?? null });
    else lookups.set(text, [...(lookups.get(text) || []), row]);
  }
  return { known, lookups };
}

export type GeocodeOutcome =
  | { kind: 'found'; lat: number; lng: number }
  | { kind: 'not_found' }
  /** `stop`: the key or quota is the problem, so the rest of a batch would fail too. */
  | { kind: 'error'; status: string; message: string; stop: boolean };

const STOP_STATUSES = new Set(['REQUEST_DENIED', 'OVER_QUERY_LIMIT', 'OVER_DAILY_LIMIT']);

/**
 * True for a result Google only reached by dropping most of the address: a
 * partial match that lands on a whole town or region. "Qzxv Plaza, Zzyx"
 * comes back as Zzyzx, California — fine for a weather lookup, wrong as a
 * pin. A typo in a street name still matches the street, so it isn't this.
 */
export function isLooseMatch(result: { partial_match?: boolean; geometry?: { location_type?: string } }): boolean {
  return result.partial_match === true && result.geometry?.location_type === 'APPROXIMATE';
}

/**
 * One Geocoding API request. Server-side only, so the key stays off the page.
 * `strict` (for map pins) treats a loose match as not found.
 */
export async function geocodeWithGoogle(address: string, key: string, { strict = false } = {}): Promise<GeocodeOutcome> {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${encodeURIComponent(key)}`
    );
    const data = await res.json();
    const result = data?.results?.[0];
    const location = result?.geometry?.location;
    if (data?.status === 'OK' && typeof location?.lat === 'number' && typeof location?.lng === 'number') {
      if (strict && isLooseMatch(result)) return { kind: 'not_found' };
      return { kind: 'found', lat: location.lat, lng: location.lng };
    }
    if (data?.status === 'ZERO_RESULTS') return { kind: 'not_found' };
    const status = String(data?.status || `HTTP ${res.status}`);
    return { kind: 'error', status, message: data?.error_message || status, stop: STOP_STATUSES.has(status) };
  } catch (err) {
    return { kind: 'error', status: 'NETWORK', message: err instanceof Error ? err.message : String(err), stop: false };
  }
}
