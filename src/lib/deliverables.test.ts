import { describe, it, expect } from 'vitest';
import {
  DELIVERABLE_STATUS,
  nextDeliverableStatus,
  deliverableStatusLabel,
  deliverableStatusTone,
} from './deliverables';

/**
 * The status chip is a tap target that cycles a pipeline, and the same values
 * are rendered on two screens. A drift between them means a deliverable reads
 * as delivered on one and not the other.
 */

describe('nextDeliverableStatus', () => {
  it('walks the pipeline in order', () => {
    expect(nextDeliverableStatus('todo')).toBe('in_progress');
    expect(nextDeliverableStatus('in_progress')).toBe('delivered');
  });

  it('wraps back to the start, so the chip is never a dead end', () => {
    expect(nextDeliverableStatus('delivered')).toBe('todo');
  });

  it('treats a missing or unknown status as todo', () => {
    expect(nextDeliverableStatus(null)).toBe('in_progress');
    expect(nextDeliverableStatus(undefined)).toBe('in_progress');
    expect(nextDeliverableStatus('nonsense')).toBe('todo');
  });

  it('returns to where it started after a full cycle', () => {
    let s: string = 'todo';
    for (let i = 0; i < DELIVERABLE_STATUS.length; i++) s = nextDeliverableStatus(s);
    expect(s).toBe('todo');
  });
});

describe('deliverableStatusLabel', () => {
  it('reads as words while the stored value stays snake_case', () => {
    expect(deliverableStatusLabel('in_progress')).toBe('in progress');
    expect(deliverableStatusLabel('delivered')).toBe('delivered');
    expect(deliverableStatusLabel(null)).toBe('todo');
  });
});

describe('deliverableStatusTone', () => {
  it('gives each state its own colour, so status reads before the text does', () => {
    const tones = DELIVERABLE_STATUS.map(s => deliverableStatusTone(s));
    expect(new Set(tones).size).toBe(DELIVERABLE_STATUS.length);
  });

  it('falls back to the neutral tone rather than nothing', () => {
    expect(deliverableStatusTone('nonsense')).toBe(deliverableStatusTone('todo'));
  });
});
