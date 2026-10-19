import { describe, expect, it } from 'vitest';
import { crewConflicts, gearShortfalls, overlappingShoots, shootsOverlap, type BookingJob, type GearJob } from './conflicts';

const job = (o: Partial<BookingJob> & { id: string }): BookingJob => ({ title: o.id, ...o });

describe('shootsOverlap', () => {
  it('overlaps on shared days, including multi-day runs', () => {
    expect(shootsOverlap(job({ id: 'a', shoot_date: '2026-10-20' }), job({ id: 'b', shoot_date: '2026-10-20' }))).toBe(true);
    expect(shootsOverlap(job({ id: 'a', shoot_date: '2026-10-19', end_date: '2026-10-21' }), job({ id: 'b', shoot_date: '2026-10-21' }))).toBe(true);
    expect(shootsOverlap(job({ id: 'a', shoot_date: '2026-10-20' }), job({ id: 'b', shoot_date: '2026-10-21' }))).toBe(false);
  });

  it('lets a morning and an evening shoot on the same day share people', () => {
    const morning = job({ id: 'a', shoot_date: '2026-10-20', call_time: '7:00 AM', wrap_time: '12:00 PM' });
    const evening = job({ id: 'b', shoot_date: '2026-10-20', call_time: '6:00 PM', wrap_time: '10:00 PM' });
    const lunch = job({ id: 'c', shoot_date: '2026-10-20', call_time: '11:00 AM', wrap_time: '3:00 PM' });
    expect(shootsOverlap(morning, evening)).toBe(false);
    expect(shootsOverlap(morning, lunch)).toBe(true);
  });

  it('treats a missing wrap as the whole day', () => {
    expect(shootsOverlap(
      job({ id: 'a', shoot_date: '2026-10-20', call_time: '7:00 AM' }),
      job({ id: 'b', shoot_date: '2026-10-20', call_time: '6:00 PM', wrap_time: '10:00 PM' }),
    )).toBe(true);
  });

  it('runs an overnight wrap past midnight', () => {
    const night = job({ id: 'a', shoot_date: '2026-10-20', call_time: '8:00 PM', wrap_time: '2:00 AM' });
    const late = job({ id: 'b', shoot_date: '2026-10-20', call_time: '11:00 PM', wrap_time: '11:30 PM' });
    expect(shootsOverlap(night, late)).toBe(true);
  });

  it('ignores cancelled and undated shoots', () => {
    expect(shootsOverlap(job({ id: 'a', shoot_date: '2026-10-20' }), job({ id: 'b', shoot_date: '2026-10-20', job_status: 'Cancelled' }))).toBe(false);
    expect(shootsOverlap(job({ id: 'a', shoot_date: '2026-10-20' }), job({ id: 'b' }))).toBe(false);
  });
});

describe('overlappingShoots', () => {
  it('excludes the shoot itself', () => {
    const t = job({ id: 't', shoot_date: '2026-10-20' });
    expect(overlappingShoots(t, [t, job({ id: 'x', shoot_date: '2026-10-20' })]).map(j => j.id)).toEqual(['x']);
  });
});

describe('crewConflicts', () => {
  it('lists the other shoots each crew member is already on', () => {
    const target = job({ id: 't', shoot_date: '2026-10-20' });
    const jobs = [target, job({ id: 'x', shoot_date: '2026-10-20', title: 'Other shoot' }), job({ id: 'y', shoot_date: '2026-10-22' })];
    const roles = [
      { contact_id: 'priya', job_id: 't' },
      { contact_id: 'priya', job_id: 'x' },
      { contact_id: 'priya', job_id: 'y' },
      { contact_id: 'alex', job_id: 't' },
      { contact_id: null, job_id: 'x' },
    ];
    const clashes = crewConflicts(target, roles, jobs);
    expect(Object.keys(clashes)).toEqual(['priya']);
    expect(clashes.priya.map(j => j.title)).toEqual(['Other shoot']);
  });
});

describe('gearShortfalls', () => {
  const target = job({ id: 't', shoot_date: '2026-10-20' });
  const jobs: GearJob[] = [
    { ...job({ id: 'x', shoot_date: '2026-10-20', title: 'Day 1' }), gear_manifest: { 'Sony FX9': 2, 'Aputure 600d': 1 } },
    { ...job({ id: 'y', shoot_date: '2026-10-25' }), gear_manifest: { 'Sony FX9': 2 } },
  ];

  it('flags items that overlapping shoots leave too few of', () => {
    const short = gearShortfalls(target, { 'Sony FX9': 1, 'Aputure 600d': 1 }, jobs, { 'Sony FX9': 2, 'Aputure 600d': 4 });
    expect(short).toEqual([{ item: 'Sony FX9', wanted: 1, owned: 2, elsewhere: [{ job: jobs[0], count: 2 }] }]);
  });

  it("doesn't judge items with no known quantity or no other use", () => {
    expect(gearShortfalls(target, { 'Rented lens': 1 }, jobs, {})).toEqual([]);
    expect(gearShortfalls(target, { 'Sony FX9': 2 }, [jobs[1]], { 'Sony FX9': 2 })).toEqual([]);
  });
});
