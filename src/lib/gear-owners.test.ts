import { describe, expect, it } from 'vitest';
import { buildRentalLog, isBorrowed, ownedName, parseOwnedName, type RentalJob } from './gear-owners';
import type { InventoryItem } from '@/data/inventory';

describe('owned names', () => {
  it('splits the owner out of the bracket', () => {
    expect(parseOwnedName('Sony A1 [Rob Douthat]')).toEqual({ base: 'Sony A1', owner: 'Rob Douthat' });
    expect(parseOwnedName('1.4x Sony Teleconverter [Eric Mann]')).toEqual({ base: '1.4x Sony Teleconverter', owner: 'Eric Mann' });
  });

  it('leaves unowned names alone', () => {
    expect(parseOwnedName('Sony FX6')).toEqual({ base: 'Sony FX6', owner: null });
    expect(parseOwnedName('[weird]')).toEqual({ base: '[weird]', owner: null });
  });

  it('round-trips', () => {
    expect(ownedName('Sony A1', 'Rob Douthat')).toBe('Sony A1 [Rob Douthat]');
    expect(ownedName(' Sony A1 ', '  ')).toBe('Sony A1');
  });

  it('treats the studio as not borrowed', () => {
    expect(isBorrowed({ owner: 'Rob' })).toBe(true);
    expect(isBorrowed({ owner: 'zipline media' })).toBe(false);
    expect(isBorrowed({ owner: undefined })).toBe(false);
  });
});

describe('buildRentalLog', () => {
  const inventory: InventoryItem[] = [
    { name: 'Sony FX6', category: 'Camera', qty: 2, replacement: 0 },
    { name: 'Go Pro Hero 12 [Rod Weber]', category: 'Camera', qty: 1, replacement: 0, owner: 'Rod Weber' },
    { name: 'Slider [Rod Weber]', category: 'Grip/Support', qty: 1, replacement: 0, owner: 'Rod Weber' },
    // Owner only in the bracket, column empty — still in the catalog.
    { name: 'Sony A1 [Rob Douthat]', category: 'Camera', qty: 1, replacement: 0 },
  ];
  const jobs: RentalJob[] = [
    { id: 'a', title: 'Paranormal', shoot_date: '2026-08-14', gear_manifest: { 'Go Pro Hero 12 [Rod Weber]': 1, 'Go Pro Hero 8 [Rod Weber]': 1, 'Sony FX6': 2 } },
    { id: 'b', title: 'BOH B-Roll', shoot_date: '2026-10-02', gear_manifest: { 'Sony A1 [Rob Douthat]': 1, 'Go Pro Hero 12 [Rod Weber]': 0 } },
    { id: 'c', title: 'Later', shoot_date: '2026-09-01', gear_manifest: { 'Go Pro Hero 12 [Rod Weber]': 2 } },
    { id: 'd', title: 'Called off', shoot_date: '2026-12-01', job_status: 'Cancelled', gear_manifest: { 'Go Pro Hero 12 [Rod Weber]': 1, 'Drone [Kris]': 1 } },
  ];

  const log = buildRentalLog(inventory, jobs);

  it('groups by owner, most recent loan first, ignoring cancelled shoots', () => {
    expect(log.map(o => o.owner)).toEqual(['Rob Douthat', 'Rod Weber']);
    expect(log[1].jobCount).toBe(2);
    expect(log[1].lastDate).toBe('2026-09-01');
  });

  it('never offers to re-save a catalog row whose owner is only in its name', () => {
    expect(log[0].items.map(i => [i.base, i.inCatalog])).toEqual([['Sony A1', true]]);
  });

  it('includes list-only gear and catalog gear never borrowed yet', () => {
    const rod = log[1];
    expect(rod.items.map(i => [i.base, i.jobs.length, i.inCatalog])).toEqual([
      ['Go Pro Hero 12', 2, true],
      ['Go Pro Hero 8', 1, false],
      ['Slider', 0, true],
    ]);
    // Zero counts don't count as a loan; newest job first.
    expect(rod.items[0].jobs.map(j => j.id)).toEqual(['c', 'a']);
  });
});
