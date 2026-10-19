import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_TEMPLATES, resolveEventTemplate } from './notify-defaults';

describe('resolveEventTemplate', () => {
  it('sends a default-on alert that has never been configured', () => {
    expect(resolveEventTemplate('edit_review', null)).toBe(DEFAULT_EVENT_TEMPLATES.edit_review);
    expect(resolveEventTemplate('edit_delivered', undefined)).toBe(DEFAULT_EVENT_TEMPLATES.edit_delivered);
  });

  it('keeps every other unconfigured alert silent', () => {
    expect(resolveEventTemplate('status_booked', null)).toBeNull();
  });

  it('respects an alert switched off in settings', () => {
    expect(resolveEventTemplate('edit_review', { enabled: false, message_template: 'x' })).toBeNull();
  });

  it('uses the saved wording, and the default when the saved one is blank', () => {
    expect(resolveEventTemplate('edit_review', { enabled: true, message_template: 'Cut ready: {title}' })).toBe('Cut ready: {title}');
    expect(resolveEventTemplate('edit_review', { enabled: true, message_template: '  ' })).toBe(DEFAULT_EVENT_TEMPLATES.edit_review);
    expect(resolveEventTemplate('status_booked', { enabled: true, message_template: '' })).toBeNull();
  });
});
