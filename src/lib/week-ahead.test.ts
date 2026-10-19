import { describe, expect, it } from 'vitest';
import { drivesOutLongest, editsDue, lastDayOf, needsClosingOut, upcomingShootDays, type WeekJob } from './week-ahead';

const TODAY = '2026-10-19';
const job = (o: Partial<WeekJob> & { id: string }): WeekJob => ({ title: o.id, ...o });

describe('lastDayOf', () => {
  it('uses the end date only when it is after the shoot date', () => {
    expect(lastDayOf({ shoot_date: '2026-10-20', end_date: '2026-10-22' })).toBe('2026-10-22');
    expect(lastDayOf({ shoot_date: '2026-10-20', end_date: '2026-10-19' })).toBe('2026-10-20');
    expect(lastDayOf({ shoot_date: null })).toBeNull();
  });
});

describe('upcomingShootDays', () => {
  it('lists shoots from today for seven days, by call time, untimed last', () => {
    const days = upcomingShootDays([
      job({ id: 'late', shoot_date: TODAY, call_time: '10:00 AM' }),
      job({ id: 'untimed', shoot_date: TODAY }),
      job({ id: 'early', shoot_date: TODAY, call_time: '6:30 AM' }),
      job({ id: 'past', shoot_date: '2026-10-18' }),
      job({ id: 'beyond', shoot_date: '2026-10-26' }),
      job({ id: 'edge', shoot_date: '2026-10-25' }),
    ], TODAY);
    expect(days.map(d => d.date)).toEqual([TODAY, '2026-10-25']);
    expect(days[0].shoots.map(s => s.id)).toEqual(['early', 'late', 'untimed']);
  });

  it('repeats a multi-day shoot on each day, continuing after the first', () => {
    const days = upcomingShootDays([job({ id: 'run', shoot_date: '2026-10-18', end_date: '2026-10-20' })], TODAY);
    expect(days.map(d => [d.date, d.shoots[0].continuing])).toEqual([[TODAY, true], ['2026-10-20', true]]);
  });

  it('leaves out cancelled shoots', () => {
    expect(upcomingShootDays([job({ id: 'x', shoot_date: TODAY, job_status: 'Cancelled' })], TODAY)).toEqual([]);
  });
});

describe('editsDue', () => {
  it('returns late and due-this-week cards on the board, earliest first', () => {
    const due = editsDue([
      job({ id: 'late', edit_status: 'WIP', due_date: '2026-10-17' }),
      job({ id: 'soon', edit_status: 'V1', due_date: '2026-10-21' }),
      job({ id: 'later', edit_status: 'WIP', due_date: '2026-10-30' }),
      job({ id: 'done', edit_status: 'Delivered', due_date: '2026-10-17' }),
      job({ id: 'offboard', edit_status: null, due_date: '2026-10-18' }),
      job({ id: 'nodate', edit_status: 'WIP' }),
      job({ id: 'cancelled', edit_status: 'WIP', due_date: '2026-10-18', job_status: 'Cancelled' }),
    ], TODAY);
    expect(due.map(d => [d.id, d.overdue])).toEqual([['late', true], ['soon', false]]);
  });
});

describe('needsClosingOut', () => {
  it('finds past shoots still marked open, most recent first', () => {
    const stale = needsClosingOut([
      job({ id: 'old-booked', job_status: 'Booked', shoot_date: '2026-10-01' }),
      job({ id: 'recent-hold', job_status: 'Hold', shoot_date: '2026-10-15' }),
      job({ id: 'running', job_status: 'Booked', shoot_date: '2026-10-17', end_date: TODAY }),
      job({ id: 'wrapped', job_status: 'Wrapped', shoot_date: '2026-10-10' }),
      job({ id: 'future', job_status: 'Booked', shoot_date: '2026-10-25' }),
      job({ id: 'undated', job_status: 'Planning' }),
    ], TODAY);
    expect(stale.map(j => j.id)).toEqual(['recent-hold', 'old-booked']);
  });
});

describe('drivesOutLongest', () => {
  it('ranks drives that are out by days out', () => {
    const now = new Date(2026, 9, 19, 12);
    const out = drivesOutLongest([
      { id: 'a', label: 'ZM-01', status: 'out', checked_out_at: new Date(2026, 8, 8, 15).toISOString() },
      { id: 'b', label: 'ZM-02', status: 'out', checked_out_at: new Date(2026, 9, 18, 21).toISOString() },
      { id: 'c', label: 'ZM-03', status: 'in_office' },
    ], now);
    expect(out.map(d => [d.label, d.days])).toEqual([['ZM-01', 41], ['ZM-02', 1]]);
  });
});
