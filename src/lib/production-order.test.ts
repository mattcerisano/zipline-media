import { describe, it, expect } from 'vitest';
import { orderProductions, productionLabel } from './production-order';

const j = (id: string, shoot_date: string | null, extra: Partial<{ title: string; job_status: string; client_name: string }> = {}) =>
  ({ id, title: extra.title ?? id, shoot_date, job_status: extra.job_status ?? 'Booked', client_name: extra.client_name ?? null });

describe('orderProductions', () => {
  it('puts upcoming soonest first, then past newest first, then undated', () => {
    const out = orderProductions([
      j('undated', null),
      j('past-old', '2026-09-01'),
      j('next-month', '2026-11-16'),
      j('past-recent', '2026-10-16'),
      j('tomorrow', '2026-10-22'),
      j('today', '2026-10-21'),
    ], '2026-10-21');
    expect(out.map(x => x.id)).toEqual(['today', 'tomorrow', 'next-month', 'past-recent', 'past-old', 'undated']);
  });

  it('keeps today on the upcoming side and handles an empty list', () => {
    expect(orderProductions([], '2026-10-21')).toEqual([]);
    expect(orderProductions([j('today', '2026-10-21')], '2026-10-21')[0].id).toBe('today');
  });
});

describe('productionLabel', () => {
  it('shows the date, the client, and a status only when it is not Booked', () => {
    expect(productionLabel(j('a', '2026-10-21', { title: '860 Opening', client_name: 'RPM' }))).toBe('860 Opening — Oct 21, 2026 · RPM');
    expect(productionLabel(j('b', '2026-11-18', { title: 'STNJ Rehearsal', job_status: 'Hold' }))).toBe('STNJ Rehearsal — Nov 18, 2026 · Hold');
    expect(productionLabel(j('c', null, { title: 'TLB B-roll Clips', client_name: 'RPM' }))).toBe('TLB B-roll Clips — date TBD · RPM');
  });
});
