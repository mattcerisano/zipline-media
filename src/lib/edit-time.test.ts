import { describe, it, expect } from 'vitest';
import {
  MAX_MANUAL_MINUTES,
  billableHours,
  entrySeconds,
  formatClock,
  formatDuration,
  isRunning,
  parseManualMinutes,
  totalSeconds,
  type TimeEntry,
} from './edit-time';

const NOW = Date.parse('2026-08-22T18:00:00.000Z');

const entry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  id: 'e1',
  job_id: 'j1',
  user_id: 'u1',
  started_at: '2026-08-22T17:00:00.000Z',
  ended_at: '2026-08-22T17:30:00.000Z',
  duration_seconds: 1800,
  source: 'timer',
  ...over,
});

describe('entrySeconds', () => {
  it('uses the duration the database computed for a stopped entry', () => {
    expect(entrySeconds(entry(), NOW)).toBe(1800);
  });

  it('falls back to the timestamps when the duration is missing', () => {
    expect(entrySeconds(entry({ duration_seconds: null }), NOW)).toBe(1800);
  });

  it('measures a running entry against now, so it ticks unwritten', () => {
    const running = entry({ ended_at: null, duration_seconds: null });
    expect(entrySeconds(running, NOW)).toBe(3600);
    expect(isRunning(running)).toBe(true);
  });

  it('never reports negative time from a clock that disagrees', () => {
    const future = entry({ started_at: '2026-08-22T19:00:00.000Z', ended_at: null, duration_seconds: null });
    expect(entrySeconds(future, NOW)).toBe(0);
  });

  it('totals stopped and running entries together', () => {
    const entries = [entry(), entry({ id: 'e2', ended_at: null, duration_seconds: null })];
    expect(totalSeconds(entries, NOW)).toBe(1800 + 3600);
  });
});

describe('formatting', () => {
  it('reads as billing, not as a stopwatch', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(59)).toBe('0m');
    expect(formatDuration(2820)).toBe('47m');
    expect(formatDuration(11100)).toBe('3h 05m');
  });

  it('shows seconds while a timer runs', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(5047)).toBe('01:24:07');
  });

  it('converts to invoice hours at two decimals', () => {
    expect(billableHours(6300)).toBe(1.75);
    expect(billableHours(0)).toBe(0);
  });
});

describe('parseManualMinutes', () => {
  it('reads a bare number as minutes', () => {
    expect(parseManualMinutes('90')).toBe(90);
    expect(parseManualMinutes(' 30 ')).toBe(30);
  });

  it('reads the shapes people actually type', () => {
    expect(parseManualMinutes('1.5h')).toBe(90);
    expect(parseManualMinutes('1h30m')).toBe(90);
    expect(parseManualMinutes('1h 30')).toBe(90);
    expect(parseManualMinutes('45m')).toBe(45);
    expect(parseManualMinutes('2:15')).toBe(135);
    expect(parseManualMinutes('2 hours')).toBe(120);
  });

  it('refuses amounts that cannot be an entry', () => {
    expect(parseManualMinutes('')).toBeNull();
    expect(parseManualMinutes('0')).toBeNull();
    expect(parseManualMinutes('-30')).toBeNull();
    expect(parseManualMinutes('all afternoon')).toBeNull();
    expect(parseManualMinutes('1e3')).toBeNull();
  });

  it('refuses anything past the per-entry cap', () => {
    expect(parseManualMinutes(String(MAX_MANUAL_MINUTES))).toBe(MAX_MANUAL_MINUTES);
    expect(parseManualMinutes(String(MAX_MANUAL_MINUTES + 1))).toBeNull();
    expect(parseManualMinutes('20h')).toBeNull();
  });
});
