/**
 * What the Locations map draws: productions and scouted locations as places,
 * grouped into pins. Pure, so the server's backfill and the map agree on
 * which rows belong on it.
 */

import { currentPoint, placeText, type GeoPoint, type StoredPlace } from '@/lib/geocode';
import { parseLocalDate } from '@/lib/date';

export interface MapJob extends StoredPlace {
  id: string;
  title: string;
  client_name?: string | null;
  shoot_date?: string | null;
  end_date?: string | null;
  job_status?: string | null;
  type?: string | null;
  archived_at?: string | null;
  location_name?: string | null;
  location_address?: string | null;
}

export interface MapLocation extends StoredPlace {
  id: string;
  name: string;
  address: string;
  rating?: number | null;
  created_at?: string | null;
}

/** The jobs columns the map reads. */
export const MAP_JOB_COLUMNS =
  'id, title, client_name, shoot_date, end_date, job_status, type, archived_at, location_name, location_address';
export const COORDINATE_COLUMNS = 'latitude, longitude, geocoded_address';

/**
 * Productions that belong on the map: archived ones too — they're the
 * history — but not shoots that were called off, or gear rentals.
 */
export function isMappedProduction(job: { job_status?: string | null; type?: string | null }): boolean {
  return job.job_status !== 'Cancelled' && job.type !== 'rental';
}

export type PlaceKind = 'production' | 'scout';

export interface MapPlace {
  /** `job:<id>` or `loc:<id>`. */
  key: string;
  kind: PlaceKind;
  id: string;
  title: string;
  /** The venue or address line under the title. */
  where: string;
  client?: string;
  date: string | null;
  endDate: string | null;
  year: number | null;
  point: GeoPoint | null;
  /** Why a place has no pin, when it hasn't. */
  missing: 'no_address' | 'not_found' | 'pending' | null;
  archived: boolean;
  status?: string;
  rating?: number;
}

function missingReason(text: string | null, row: StoredPlace, point: GeoPoint | null): MapPlace['missing'] {
  if (point) return null;
  if (!text) return 'no_address';
  return row.geocoded_address === text ? 'not_found' : 'pending';
}

export function productionPlace(job: MapJob): MapPlace {
  const text = placeText(job.location_address);
  const point = currentPoint(text, job);
  return {
    key: `job:${job.id}`,
    kind: 'production',
    id: job.id,
    title: job.title || 'Untitled production',
    where: [job.location_name, job.location_address].map(s => s?.trim()).filter(Boolean).join(' · '),
    client: job.client_name?.trim() || undefined,
    date: job.shoot_date || null,
    endDate: job.end_date || null,
    year: parseLocalDate(job.shoot_date)?.getFullYear() ?? null,
    point,
    missing: missingReason(text, job, point),
    archived: !!job.archived_at,
    status: job.job_status || undefined,
  };
}

export function scoutPlace(loc: MapLocation): MapPlace {
  const text = placeText(loc.address);
  const point = currentPoint(text, loc);
  return {
    key: `loc:${loc.id}`,
    kind: 'scout',
    id: loc.id,
    title: loc.name,
    where: loc.address,
    date: loc.created_at || null,
    endDate: null,
    year: parseLocalDate(loc.created_at)?.getFullYear() ?? null,
    point,
    missing: missingReason(text, loc, point),
    archived: false,
    rating: loc.rating ?? undefined,
  };
}

export interface MapPin {
  key: string;
  point: GeoPoint;
  /** Newest first. */
  places: MapPlace[];
  kind: PlaceKind | 'mixed';
}

/** Which pin a point lands on: places within about 10 m share one. */
export function pinKey(point: GeoPoint): string {
  return `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
}

/** Places at the same spot share a pin: one studio, many shoots. */
export function groupPins(places: MapPlace[]): MapPin[] {
  const pins = new Map<string, MapPin>();
  for (const place of places) {
    if (!place.point) continue;
    const key = pinKey(place.point);
    const pin = pins.get(key);
    if (pin) {
      pin.places.push(place);
      if (pin.kind !== place.kind) pin.kind = 'mixed';
    } else {
      pins.set(key, { key, point: place.point, places: [place], kind: place.kind });
    }
  }
  for (const pin of pins.values()) pin.places.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return [...pins.values()];
}

/** The years there's anything to filter to, newest first. */
export function placeYears(places: MapPlace[]): number[] {
  return [...new Set(places.map(p => p.year).filter((y): y is number => y !== null))].sort((a, b) => b - a);
}

/** "Mar 4, 2025", "Mar 4 – 6, 2025", "Mar 30 – Apr 2, 2025" or across years in full. */
export function dateSpan(start: string | null | undefined, end?: string | null): string {
  const s = parseLocalDate(start);
  if (!s) return 'No date';
  const e = parseLocalDate(end);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-US', o);
  const full: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  if (!e || e.getTime() <= s.getTime()) return fmt(s, full);
  if (s.getFullYear() !== e.getFullYear()) return `${fmt(s, full)} – ${fmt(e, full)}`;
  if (s.getMonth() !== e.getMonth()) return `${fmt(s, { month: 'short', day: 'numeric' })} – ${fmt(e, full)}`;
  return `${fmt(s, { month: 'short', day: 'numeric' })} – ${e.getDate()}, ${e.getFullYear()}`;
}
