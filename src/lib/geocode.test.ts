import { describe, it, expect } from 'vitest';
import { currentPoint, isLooseMatch, needsPlacing, placeText, planPlacing, type PlaceableRow } from './geocode';
import { dateSpan, groupPins, isMappedProduction, placeYears, productionPlace, scoutPlace } from './map-places';

function row(over: Partial<PlaceableRow>): PlaceableRow {
  return { table: 'jobs', id: Math.random().toString(36).slice(2), text: null, ...over };
}

describe('placeText', () => {
  it('tidies whitespace so the same address always reads the same', () => {
    expect(placeText('  141 W 44th St,\n New York ')).toBe('141 W 44th St, New York');
  });
  it('treats placeholders as no address', () => {
    for (const t of ['TBD', 'tba', 'N/A', 'na', '—', '?', 'Remote', '', '  ', 'NY']) expect(placeText(t)).toBeNull();
  });
});

describe('needsPlacing / currentPoint', () => {
  const placed = { latitude: 40.75, longitude: -73.98, geocoded_address: '141 W 44th St' };
  it('keeps coordinates only while they belong to the address', () => {
    expect(currentPoint('141 W 44th St', placed)).toEqual({ lat: 40.75, lng: -73.98 });
    expect(currentPoint('1 Main St', placed)).toBeNull();
    expect(needsPlacing('1 Main St', placed)).toBe(true);
    expect(needsPlacing('141 W 44th St', placed)).toBe(false);
  });
  it('does not retry an address Google could not find', () => {
    const unfound = { latitude: null, longitude: null, geocoded_address: 'Nowhere Lane' };
    expect(needsPlacing('Nowhere Lane', unfound)).toBe(false);
    expect(currentPoint('Nowhere Lane', unfound)).toBeNull();
  });
  it('has nothing to place without an address', () => {
    expect(needsPlacing(null, {})).toBe(false);
  });
});

describe('isLooseMatch', () => {
  it('rejects a partial match that only found a town, keeps the rest', () => {
    expect(isLooseMatch({ partial_match: true, geometry: { location_type: 'APPROXIMATE' } })).toBe(true);
    expect(isLooseMatch({ partial_match: true, geometry: { location_type: 'ROOFTOP' } })).toBe(false);
    expect(isLooseMatch({ geometry: { location_type: 'APPROXIMATE' } })).toBe(false);
  });
});

describe('planPlacing', () => {
  it('reuses an address another row already has, and looks each new one up once', () => {
    const rows = [
      row({ text: 'Studio A', latitude: 1, longitude: 2, geocoded_address: 'Studio A' }),
      row({ text: 'Studio A' }),
      row({ table: 'locations', text: 'Studio A' }),
      row({ text: 'Pier 17' }),
      row({ text: 'Pier 17', geocoded_address: 'Old address', latitude: 5, longitude: 6 }),
      row({ text: 'Nowhere Lane', geocoded_address: 'Nowhere Lane' }),
      row({ text: 'Nowhere Lane' }),
      row({ text: null }),
    ];
    const { known, lookups } = planPlacing(rows);
    expect(known.map(k => [k.row.text, k.point])).toEqual([
      ['Studio A', { lat: 1, lng: 2 }],
      ['Studio A', { lat: 1, lng: 2 }],
      ['Nowhere Lane', null],
    ]);
    expect([...lookups.keys()]).toEqual(['Pier 17']);
    expect(lookups.get('Pier 17')).toHaveLength(2);
  });
});

describe('map places', () => {
  const job = {
    id: 'j1', title: 'Spring promo', client_name: 'Acme', shoot_date: '2025-03-04', end_date: '2025-03-06',
    job_status: 'Wrapped', location_name: 'Hudson Theatre', location_address: '141 W 44th St',
    latitude: 40.75, longitude: -73.98, geocoded_address: '141 W 44th St', archived_at: '2025-06-01T00:00:00Z',
  };

  it('maps archived productions but not cancelled shoots or rentals', () => {
    expect(isMappedProduction(job)).toBe(true);
    expect(isMappedProduction({ ...job, job_status: 'Cancelled' })).toBe(false);
    expect(isMappedProduction({ ...job, type: 'rental' })).toBe(false);
  });

  it('says why a place has no pin', () => {
    expect(productionPlace(job).missing).toBeNull();
    expect(productionPlace({ ...job, location_address: '' }).missing).toBe('no_address');
    expect(productionPlace({ ...job, location_address: '1 New St' }).missing).toBe('pending');
    expect(productionPlace({ ...job, latitude: null, longitude: null }).missing).toBe('not_found');
  });

  it('groups places at one spot into one pin, newest first', () => {
    const older = productionPlace({ ...job, id: 'j0', shoot_date: '2023-01-10' });
    const scout = scoutPlace({ id: 'l1', name: 'Hudson lobby', address: '141 W 44th St', latitude: 40.75001, longitude: -73.98001, geocoded_address: '141 W 44th St', created_at: '2024-02-01T15:00:00Z' });
    const elsewhere = productionPlace({ ...job, id: 'j2', latitude: 41, longitude: -74 });
    const pins = groupPins([older, productionPlace(job), scout, elsewhere]);
    expect(pins).toHaveLength(2);
    expect(pins[0].kind).toBe('mixed');
    expect(pins[0].places.map(p => p.id)).toEqual(['j1', 'l1', 'j0']);
    expect(pins[1].kind).toBe('production');
    expect(placeYears([older, scout, elsewhere])).toEqual([2025, 2024, 2023]);
  });
});

describe('dateSpan', () => {
  it('writes one date, a run of days, or a span across months and years', () => {
    expect(dateSpan('2025-03-04')).toBe('Mar 4, 2025');
    expect(dateSpan('2025-03-04', '2025-03-04')).toBe('Mar 4, 2025');
    expect(dateSpan('2025-03-04', '2025-03-06')).toBe('Mar 4 – 6, 2025');
    expect(dateSpan('2025-03-30', '2025-04-02')).toBe('Mar 30 – Apr 2, 2025');
    expect(dateSpan('2025-12-30', '2026-01-02')).toBe('Dec 30, 2025 – Jan 2, 2026');
    expect(dateSpan(null)).toBe('No date');
  });
});
