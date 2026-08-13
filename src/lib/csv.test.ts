import { describe, it, expect } from 'vitest';
import { parseDelimited, findColumn, findColumns, cell } from './csv';

describe('parseDelimited', () => {
  it('reads a plain comma file', () => {
    const table = parseDelimited('Name,Email\nTommy,tommy@x.com\nMatt,matt@x.com')!;
    expect(table.headers).toEqual(['name', 'email']);
    expect(table.rows).toEqual([['Tommy', 'tommy@x.com'], ['Matt', 'matt@x.com']]);
  });

  it('keeps commas inside quoted fields', () => {
    const table = parseDelimited('Name,Address\n"Smith, John","12 Main St, Brooklyn, NY"')!;
    expect(table.rows[0]).toEqual(['Smith, John', '12 Main St, Brooklyn, NY']);
  });

  // The old parser toggled its quote state on apostrophes too, so one Irish
  // surname ate every delimiter after it and blanked the rest of the row.
  it('treats an apostrophe as a character, not a quote', () => {
    const table = parseDelimited("Name,Role,Email\nSeamus O'Brien,Director's Assistant,seamus@x.com")!;
    expect(table.rows[0]).toEqual(["Seamus O'Brien", "Director's Assistant", 'seamus@x.com']);
  });

  it('keeps newlines inside a quoted field', () => {
    const table = parseDelimited('Name,Notes\nTommy,"Line one\nLine two"\nMatt,ok')!;
    expect(table.rows).toEqual([['Tommy', 'Line one\nLine two'], ['Matt', 'ok']]);
  });

  it('unescapes doubled quotes', () => {
    const table = parseDelimited('Name,Nickname\nTommy,"He goes by ""T"""')!;
    expect(table.rows[0][1]).toBe('He goes by "T"');
  });

  it('strips the BOM Excel writes so the first header still matches', () => {
    const table = parseDelimited('﻿Name,Email\nTommy,tommy@x.com')!;
    expect(table.headers[0]).toBe('name');
    expect(findColumn(table.headers, ['name'])).toBe(0);
  });

  it('handles CRLF line endings', () => {
    const table = parseDelimited('Name,Email\r\nTommy,tommy@x.com\r\n')!;
    expect(table.rows).toEqual([['Tommy', 'tommy@x.com']]);
  });

  it('sniffs semicolon and tab delimited re-saves', () => {
    const semi = parseDelimited('Name;Email\nTommy;tommy@x.com')!;
    expect(semi.delimiter).toBe(';');
    expect(semi.rows[0]).toEqual(['Tommy', 'tommy@x.com']);

    const tab = parseDelimited('Name\tEmail\nTommy\ttommy@x.com')!;
    expect(tab.delimiter).toBe('\t');
    expect(tab.rows[0]).toEqual(['Tommy', 'tommy@x.com']);
  });

  it('drops blank lines and pads short rows to the header width', () => {
    const table = parseDelimited('Name,Email,Phone\n\nTommy,tommy@x.com\n\n')!;
    expect(table.rows).toEqual([['Tommy', 'tommy@x.com', '']]);
  });

  it('returns null when there is no data beyond the header', () => {
    expect(parseDelimited('Name,Email')).toBeNull();
    expect(parseDelimited('')).toBeNull();
  });
});

describe('findColumn', () => {
  const headers = ['contact name', 'company phone', 'phone', 'e-mail address'];

  it('prefers an exact header match over a substring one', () => {
    expect(findColumn(headers, ['phone'])).toBe(2);
  });

  it('falls back to a substring match', () => {
    expect(findColumn(headers, ['email', 'e-mail'])).toBe(3);
  });

  it('honours candidate order', () => {
    expect(findColumn(headers, ['company phone', 'phone'])).toBe(1);
  });

  it('returns -1 when nothing matches', () => {
    expect(findColumn(headers, ['zip'])).toBe(-1);
  });

  it('collects every matching column', () => {
    expect(findColumns(['role', 'role 2', 'secondary role', 'name'], ['role'])).toEqual([0, 1, 2]);
  });
});

describe('cell', () => {
  it('reads a trimmed value, and empty for a missing column', () => {
    expect(cell(['  Tommy '], 0)).toBe('Tommy');
    expect(cell(['Tommy'], -1)).toBe('');
    expect(cell(['Tommy'], 5)).toBe('');
  });
});
