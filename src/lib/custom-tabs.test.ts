import { describe, it, expect } from 'vitest';
import { isRetiredCustomTab } from './custom-tabs';

describe('isRetiredCustomTab', () => {
  it('drops the full-page notepad type whatever it is called', () => {
    expect(isRetiredCustomTab({ type: 'notes', label: 'Call log' })).toBe(true);
  });

  it('drops a workspace that only opens retired tools, whatever it is called', () => {
    expect(isRetiredCustomTab({ type: 'workspace', label: 'Jotter', starterTools: ['notes'] })).toBe(true);
    expect(isRetiredCustomTab({ type: 'workspace', label: 'Docs', starterTools: ['docs', 'notes'] })).toBe(true);
  });

  it('keeps a workspace named Notes that opens real tools', () => {
    expect(isRetiredCustomTab({ type: 'workspace', label: 'Notes', starterTools: ['tasks', 'calendar'] })).toBe(false);
    expect(isRetiredCustomTab({ type: 'workspace', label: 'Notes', starterTools: ['notes', 'tasks'] })).toBe(false);
  });

  it('treats a tool-less tab named like the notepad as the notepad', () => {
    expect(isRetiredCustomTab({ type: 'workspace', label: ' Scratch Notes ' })).toBe(true);
    expect(isRetiredCustomTab({ type: 'workspace', label: 'Budget' })).toBe(false);
    expect(isRetiredCustomTab({ type: 'workspace', label: 'Notes', starterTools: [] })).toBe(true);
  });

  it('never touches system or embed tabs', () => {
    expect(isRetiredCustomTab({ type: 'system', label: 'Notes' })).toBe(false);
    expect(isRetiredCustomTab({ type: 'embed', label: 'Notepad' })).toBe(false);
  });
});
