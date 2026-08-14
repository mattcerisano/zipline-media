import { describe, it, expect } from 'vitest';
import * as ics from 'ics';
import { jobEventUid } from './calendar-uid';

/**
 * The subscribable feed is re-rendered from scratch on every poll, so the UID
 * is the only thread tying one render to the next. Get it wrong and nothing
 * errors — subscribers just accumulate a fresh copy of every shoot each time
 * their calendar refreshes.
 */

describe('jobEventUid', () => {
  it('gives the same job the same uid on every call', () => {
    const id = '7b0d4f1e-3c2a-4f5b-9a1d-2e6c8b0f4a37';
    expect(jobEventUid(id)).toBe(jobEventUid(id));
  });

  it('keeps different jobs apart', () => {
    expect(jobEventUid('a')).not.toBe(jobEventUid('b'));
  });

  it('qualifies the row id with a domain, as RFC 5545 asks', () => {
    expect(jobEventUid('abc')).toBe('job-abc@zipline.media');
  });
});

describe('ics UID handling', () => {
  const event = (uid?: string): ics.EventAttributes => ({
    ...(uid ? { uid } : {}),
    title: '🎥 Scout Day',
    start: [2026, 8, 10, 8, 0],
    end: [2026, 8, 10, 16, 0],
  });

  const uidsOf = (value: string | null) =>
    (value || '').split('\r\n').filter(line => line.startsWith('UID:'));

  it('re-renders a supplied uid unchanged', () => {
    const uid = jobEventUid('7b0d4f1e-3c2a-4f5b-9a1d-2e6c8b0f4a37');
    const first = ics.createEvents([event(uid)]);
    const second = ics.createEvents([event(uid)]);

    expect(first.error).toBeNull();
    expect(uidsOf(first.value)).toEqual([`UID:${uid}`]);
    expect(uidsOf(second.value)).toEqual(uidsOf(first.value));
  });

  it('invents a new uid per render when none is supplied — the bug being guarded against', () => {
    const first = uidsOf(ics.createEvents([event()]).value);
    const second = uidsOf(ics.createEvents([event()]).value);

    expect(first).toHaveLength(1);
    expect(second).not.toEqual(first);
  });
});
