import { describe, it, expect } from 'vitest';
import { dedupeByKey } from './calendar-sync';

describe('dedupeByKey', () => {
  it('keeps one row per key so ON CONFLICT never touches a row twice', () => {
    // A recurring shoot pushed by Slate: singleEvents hands back one instance
    // per date, every one of them carrying the same slateJobId. Upserting the
    // batch as-is is what threw "command cannot affect row a second time".
    const jobId = 'a2f0c1d4-1111-2222-3333-444455556666';
    const instances = [
      { id: jobId, title: 'Weekly Studio Day', shoot_date: '2026-08-24' },
      { id: jobId, title: 'Weekly Studio Day', shoot_date: '2026-08-31' },
      { id: jobId, title: 'Weekly Studio Day', shoot_date: '2026-09-07' },
    ];

    expect(dedupeByKey(instances, row => row.id)).toEqual([instances[0]]);
  });

  it('keeps the first occurrence, which is the earliest by start time', () => {
    const rows = [
      { google_event_id: 'evt-1', title: 'Original' },
      { google_event_id: 'evt-2', title: 'Meeting' },
      { google_event_id: 'evt-1', title: 'Renamed copy' },
    ];

    expect(dedupeByKey(rows, row => row.google_event_id)).toEqual([rows[0], rows[1]]);
  });

  it('leaves distinct rows and their order alone', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(dedupeByKey(rows, row => row.id)).toEqual(rows);
  });

  it('passes through rows with no key rather than collapsing them together', () => {
    // Two keyless rows collide on nothing, so dropping either would lose data.
    const rows = [{ id: undefined }, { id: 'a' }, { id: undefined }];
    expect(dedupeByKey(rows, row => row.id)).toEqual(rows);
  });

  it('handles an empty batch', () => {
    expect(dedupeByKey([], (row: { id: string }) => row.id)).toEqual([]);
  });
});
