import { describe, it, expect } from 'vitest';
import { markerDeletionTargets, buildMarkerEventBody } from './marker-sync';
import { STUDIO_MARKER_TAG } from './calendar-tags';

const MATT = 'matt-user-id';
const PRODUCER = 'producer-user-id';

describe('markerDeletionTargets', () => {
  it('removes every mirrored copy from the calendar that holds it', () => {
    const links = new Map([[MATT, 'evt-matt'], [PRODUCER, 'evt-producer']]);
    expect(markerDeletionTargets(links, null, [MATT, PRODUCER])).toEqual([
      { userId: MATT, googleEventId: 'evt-matt' },
      { userId: PRODUCER, googleEventId: 'evt-producer' },
    ]);
  });

  it('sweeps a pre-migration id across accounts, since nothing records its owner', () => {
    expect(markerDeletionTargets(new Map(), 'legacy-evt', [MATT, PRODUCER])).toEqual([
      { userId: MATT, googleEventId: 'legacy-evt' },
      { userId: PRODUCER, googleEventId: 'legacy-evt' },
    ]);
  });

  it('does not sweep an id a link already claims', () => {
    // The marker has been re-pushed since the migration, so the legacy column
    // and one link name the same event. Sweeping it would delete that live copy
    // from every other calendar it does not belong to.
    const links = new Map([[MATT, 'evt-matt'], [PRODUCER, 'evt-producer']]);
    expect(markerDeletionTargets(links, 'evt-matt', [MATT, PRODUCER])).toEqual([
      { userId: MATT, googleEventId: 'evt-matt' },
      { userId: PRODUCER, googleEventId: 'evt-producer' },
    ]);
  });

  it('handles a marker that never reached Google', () => {
    expect(markerDeletionTargets(new Map(), null, [MATT])).toEqual([]);
  });
});

describe('buildMarkerEventBody', () => {
  const marker = {
    id: 'marker-1',
    title: 'Out of Office',
    preset: 'timeout',
    event_date: '2026-08-24',
    end_date: null,
    start_time: null,
    end_time: null,
    notes: 'Back Monday',
  };

  it('tags the event so the importer never pulls it back in as a new marker', () => {
    const body = buildMarkerEventBody(marker);
    expect(body.extendedProperties.private.app).toBe(STUDIO_MARKER_TAG);
    expect(body.extendedProperties.private.studioEventId).toBe('marker-1');
  });

  it('carries the preset colour so a Hold reads as a Hold on Google', () => {
    expect(buildMarkerEventBody({ ...marker, preset: 'hold' }).colorId).toBe('5');
    expect(buildMarkerEventBody({ ...marker, preset: 'timeout' }).colorId).toBe('4');
  });

  it('leaves an unknown preset to the calendar default rather than mislabelling it', () => {
    expect(buildMarkerEventBody({ ...marker, preset: 'nonsense' }).colorId).toBeUndefined();
  });

  it('stays all-day when the marker has no times', () => {
    const body = buildMarkerEventBody(marker);
    expect(body.start).toEqual({ date: '2026-08-24' });
  });

  it('falls back to a title rather than pushing a blank event', () => {
    expect(buildMarkerEventBody({ ...marker, title: '' }).summary).toBe('Untitled');
  });
});
