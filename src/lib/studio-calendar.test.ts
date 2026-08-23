import { describe, it, expect } from 'vitest';
import { pickStudioUserId } from './studio-calendar';

const MATT = 'matt-user-id';
const PRODUCER = 'producer-user-id';

describe('pickStudioUserId', () => {
  it('uses the designated account whoever is acting', () => {
    // The whole point: a shoot the producer saves still lands on the studio
    // calendar rather than the producer's own.
    const pick = pickStudioUserId(
      [{ id: MATT, is_studio_calendar: true }, { id: PRODUCER, is_studio_calendar: false }],
      null,
      PRODUCER
    );
    expect(pick).toEqual({ userId: MATT, source: 'designated' });
  });

  it('needs no setup for a one-person studio', () => {
    const pick = pickStudioUserId([{ id: MATT }], null, MATT);
    expect(pick).toEqual({ userId: MATT, source: 'sole' });
  });

  it('treats a sole connected account as the studio calendar for everyone', () => {
    // The producer has never connected Google, so they are not in the list at
    // all — their saves must still reach the one calendar that exists.
    const pick = pickStudioUserId([{ id: MATT }], null, PRODUCER);
    expect(pick).toEqual({ userId: MATT, source: 'sole' });
  });

  it('falls back to the acting user when several accounts and none designated', () => {
    // The old per-user behaviour. Guessing between colleagues' calendars would
    // be worse than leaving it where it was until someone chooses.
    const pick = pickStudioUserId([{ id: MATT }, { id: PRODUCER }], null, PRODUCER);
    expect(pick).toEqual({ userId: PRODUCER, source: 'acting' });
  });

  it('reports no calendar when there is no acting user to fall back to', () => {
    // The cron has nobody acting: it must skip the push, not pick at random.
    const pick = pickStudioUserId([{ id: MATT }, { id: PRODUCER }], null, null);
    expect(pick).toEqual({ userId: null, source: 'acting' });
  });

  it('lets the env override win over a designation', () => {
    const pick = pickStudioUserId([{ id: PRODUCER, is_studio_calendar: true }], MATT, PRODUCER);
    expect(pick).toEqual({ userId: MATT, source: 'env' });
  });

  it('ignores a blank env override', () => {
    const pick = pickStudioUserId([{ id: MATT, is_studio_calendar: true }], '   ', PRODUCER);
    expect(pick).toEqual({ userId: MATT, source: 'designated' });
  });

  it('ignores a corrupt multi-designation rather than picking one', () => {
    // The partial unique index should make this impossible; if it ever happens,
    // falling through beats writing to an arbitrary calendar.
    const pick = pickStudioUserId(
      [{ id: MATT, is_studio_calendar: true }, { id: PRODUCER, is_studio_calendar: true }],
      null,
      PRODUCER
    );
    expect(pick).toEqual({ userId: PRODUCER, source: 'acting' });
  });

  it('reports no calendar when nobody is connected', () => {
    expect(pickStudioUserId([], null, null)).toEqual({ userId: null, source: 'acting' });
  });
});
