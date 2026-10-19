import { describe, it, expect } from 'vitest';
import { daysOut, driveTotals, groupByHolder, groupAvailable, keeperOf, formatCapacity, type Drive } from './drives';

const NOW = new Date(2026, 9, 15, 15, 0); // Oct 15 2026, mid-afternoon local

function drive(over: Partial<Drive>): Drive {
  return {
    id: Math.random().toString(36).slice(2),
    label: 'ZM-01',
    kind: 'editor',
    model: 'Samsung T9',
    capacity_tb: 2,
    serial: null,
    purchase_price: 200,
    status: 'in_office',
    holder_name: null,
    holder_type: null,
    job_id: null,
    checked_out_at: null,
    expected_back: null,
    notes: null,
    ...over,
  };
}

describe('daysOut', () => {
  it('counts calendar days, not 24h blocks', () => {
    expect(daysOut(drive({ status: 'out', checked_out_at: '2026-10-14T23:30:00' }), NOW)).toBe(1);
  });
  it('is null for an available drive', () => {
    expect(daysOut(drive({ checked_out_at: '2026-10-01' }), NOW)).toBeNull();
  });
});

describe('keeperOf', () => {
  it('reads which owner an available drive is with, ignoring case', () => {
    expect(keeperOf(drive({ holder_name: 'tommy' }))).toBe('Tommy');
    expect(keeperOf(drive({ holder_name: null }))).toBeNull();
  });
  it('is null while the drive is out, even if an owner took it', () => {
    expect(keeperOf(drive({ status: 'out', holder_name: 'Matt' }))).toBeNull();
  });
});

describe('driveTotals', () => {
  it('counts what is out and what is free, and with whom', () => {
    const t = driveTotals([
      drive({ status: 'out', checked_out_at: '2026-10-10', capacity_tb: 4, purchase_price: 300 }),
      drive({ status: 'out', checked_out_at: '2026-06-01', capacity_tb: 1, purchase_price: null }),
      drive({ status: 'lost', purchase_price: 150 }),
      drive({ status: 'retired', purchase_price: 999 }),
      drive({ holder_name: 'Matt' }),
      drive({ holder_name: 'Tommy' }),
      drive({ holder_name: 'Tommy' }),
      drive({}),
    ]);
    expect(t).toMatchObject({ total: 7, out: 2, available: 4, lost: 1, tbOut: 5, valueOut: 300, valueLost: 150 });
    expect(t.availableBy).toEqual({ Matt: 1, Tommy: 2 });
  });
});

describe('groupByHolder', () => {
  it('merges names case-insensitively, most drives first', () => {
    const groups = groupByHolder(
      [
        drive({ status: 'out', holder_name: 'Acme Agency', checked_out_at: '2026-09-01' }),
        drive({ status: 'out', holder_name: 'Dana Editor', checked_out_at: '2026-10-10' }),
        drive({ status: 'out', holder_name: 'dana editor', checked_out_at: '2026-10-12' }),
      ],
      NOW
    );
    expect(groups.map((g) => [g.holder, g.drives.length])).toEqual([
      ['Dana Editor', 2],
      ['Acme Agency', 1],
    ]);
  });
});

describe('groupAvailable', () => {
  it('always lists both owners, and drives with nobody recorded last', () => {
    const groups = groupAvailable([
      drive({ label: 'ZM-10', holder_name: 'Matt' }),
      drive({ label: 'ZM-2', holder_name: 'Matt' }),
      drive({ label: 'ZM-5' }),
      drive({ label: 'ZM-9', status: 'out', holder_name: 'Dana' }),
    ]);
    expect(groups.map((g) => [g.keeper, g.drives.map((d) => d.label)])).toEqual([
      ['Matt', ['ZM-2', 'ZM-10']],
      ['Tommy', []],
      [null, ['ZM-5']],
    ]);
  });
});

describe('formatCapacity', () => {
  it('reads like the label on the box', () => {
    expect(formatCapacity(2)).toBe('2 TB');
    expect(formatCapacity(0.5)).toBe('500 GB');
    expect(formatCapacity(null)).toBe('');
  });
});
