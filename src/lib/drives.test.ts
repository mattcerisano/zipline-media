import { describe, it, expect } from 'vitest';
import { daysOut, daysOverdue, driveTotals, groupByHolder, formatCapacity, reminderMessage, type Drive } from './drives';

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
  it('is null for a drive in the office', () => {
    expect(daysOut(drive({ checked_out_at: '2026-10-01' }), NOW)).toBeNull();
  });
});

describe('daysOverdue', () => {
  it('uses the expected-back date when one is set', () => {
    expect(daysOverdue(drive({ status: 'out', checked_out_at: '2026-10-10', expected_back: '2026-10-12' }), NOW)).toBe(3);
    expect(daysOverdue(drive({ status: 'out', checked_out_at: '2026-10-10', expected_back: '2026-10-15' }), NOW)).toBeNull();
  });
  it('flags a transfer drive after two weeks with no date', () => {
    expect(daysOverdue(drive({ kind: 'transfer', status: 'out', checked_out_at: '2026-10-01' }), NOW)).toBeNull();
    expect(daysOverdue(drive({ kind: 'transfer', status: 'out', checked_out_at: '2026-09-30' }), NOW)).toBe(1);
  });
  it('gives an editor drive three months with no date', () => {
    expect(daysOverdue(drive({ status: 'out', checked_out_at: '2026-08-01' }), NOW)).toBeNull();
    expect(daysOverdue(drive({ status: 'out', checked_out_at: '2026-07-01' }), NOW)).toBe(16);
  });
});

describe('driveTotals', () => {
  it('sums storage and value out, ignoring retired drives', () => {
    const t = driveTotals(
      [
        drive({ status: 'out', checked_out_at: '2026-10-10', capacity_tb: 4, purchase_price: 300 }),
        drive({ status: 'out', checked_out_at: '2026-06-01', capacity_tb: 1, purchase_price: null }),
        drive({ status: 'lost', purchase_price: 150 }),
        drive({ status: 'retired', purchase_price: 999 }),
        drive({}),
      ],
      NOW
    );
    expect(t).toMatchObject({ total: 4, out: 2, overdue: 1, inOffice: 1, lost: 1, tbOut: 5, valueOut: 300, valueLost: 150 });
  });
});

describe('groupByHolder', () => {
  it('merges names case-insensitively and puts overdue holders first', () => {
    const groups = groupByHolder(
      [
        drive({ status: 'out', holder_name: 'Dana Editor', checked_out_at: '2026-10-10' }),
        drive({ status: 'out', holder_name: 'dana editor', checked_out_at: '2026-10-12' }),
        drive({ status: 'out', kind: 'transfer', holder_name: 'Acme Agency', checked_out_at: '2026-09-01' }),
      ],
      NOW
    );
    expect(groups.map((g) => [g.holder, g.drives.length])).toEqual([
      ['Acme Agency', 1],
      ['Dana Editor', 2],
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

describe('reminderMessage', () => {
  it('covers every drive in one message', () => {
    const msg = reminderMessage(
      'Dana Editor',
      [drive({ label: 'ZM-03', job_id: 'j1', checked_out_at: '2026-09-02' }), drive({ label: 'ZM-04' })],
      { j1: 'Nike Spring' }
    );
    expect(msg).toContain('Hi Dana');
    expect(msg).toContain('2 drives');
    expect(msg).toContain('ZM-03 (Samsung T9 · 2 TB, from Nike Spring, out since Sep 2)');
    expect(msg).toContain('ZM-04');
  });
});
