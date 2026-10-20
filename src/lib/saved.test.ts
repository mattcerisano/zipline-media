import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.fn();
vi.mock('@/components/Feedback', () => ({ toast: (...args: unknown[]) => toast(...args) }));

import { saved } from './saved';

describe('saved', () => {
  beforeEach(() => {
    toast.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes a successful result through without a toast', async () => {
    const result = { data: { id: 'a' }, error: null };
    await expect(saved(Promise.resolve(result), 'add the task')).resolves.toBe(result);
    expect(toast).not.toHaveBeenCalled();
  });

  it('resolves null and warns when Supabase returns an error', async () => {
    const result = { data: null, error: { message: 'JWT expired' } };
    await expect(saved(Promise.resolve(result), 'delete the note')).resolves.toBeNull();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0]).toMatch(/^Couldn't delete the note/);
    expect(toast.mock.calls[0][1]).toBe('error');
  });

  it('resolves null and warns when the request itself throws', async () => {
    await expect(saved(Promise.reject(new Error('Failed to fetch')), 'save the brief')).resolves.toBeNull();
    expect(toast).toHaveBeenCalledTimes(1);
  });
});
