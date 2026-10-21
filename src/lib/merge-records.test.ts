import { describe, it, expect } from 'vitest';
import { losersOf, pickSurvivor } from './merge-records';

describe('pickSurvivor', () => {
  it('keeps the duplicate with the most productions', () => {
    const keep = pickSurvivor([
      { id: 'a', name: '860', usage: 1 },
      { id: 'b', name: '860', usage: 2, client_id: 'rpm' },
    ]);
    expect(keep?.id).toBe('b');
  });

  it('prefers the one with a client when counts tie', () => {
    const keep = pickSurvivor([
      { id: 'a', name: 'Keke Palmer Pod', usage: 0 },
      { id: 'b', name: 'Keke Palmer Pod', usage: 0, client_id: 'c1' },
    ]);
    expect(keep?.id).toBe('b');
  });

  it('falls back to the first by name and handles an empty list', () => {
    expect(pickSurvivor([])).toBeNull();
    expect(pickSurvivor([{ id: 'x', name: 'Zed' }, { id: 'y', name: 'Alpha' }])?.id).toBe('y');
  });
});

describe('losersOf', () => {
  it('returns everything but the survivor, in order', () => {
    const rows = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }];
    expect(losersOf(rows, 'b').map(r => r.id)).toEqual(['a', 'c']);
  });
});
