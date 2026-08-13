/**
 * CSV reading for the Rolodex imports.
 *
 * The old parsers split on newlines and then walked the line flipping an
 * `inQuotes` flag on **either** quote character, which broke on the two things
 * real exports are full of:
 *
 *   * apostrophes — "O'Brien" or "Director's Assistant" opened a quote that
 *     never closed, so every comma after it was swallowed and the columns
 *     after that shifted, usually emptying the name;
 *   * a quoted field containing a comma *and* a newline (an address, a note),
 *     which was cut in half by the line split before quoting was ever
 *     considered.
 *
 * Both produced the same symptom: rows parsed to nothing and the importer
 * reported "no contacts found" for a file that was perfectly valid.
 *
 * This module parses the whole text in one pass per RFC 4180 (`"` quotes,
 * `""` for a literal quote inside one, newlines allowed inside a quoted
 * field), strips a UTF-8 BOM — which Excel writes on "Save as CSV UTF-8" and
 * which otherwise glues itself to the first header name — and sniffs the
 * delimiter, since a re-save in a European locale writes semicolons and a
 * "Save as tab-delimited" writes tabs.
 */

/** Delimiters worth guessing between. Comma wins ties, being the default. */
const CANDIDATE_DELIMITERS = [',', ';', '\t', '|'] as const;

export interface DelimitedTable {
  /** Header names, lowercased and trimmed — what `findColumn` matches on. */
  headers: string[];
  /** Header names as written, for error messages the user can act on. */
  rawHeaders: string[];
  /** Data rows, header row excluded. Short rows are padded to the header width. */
  rows: string[][];
  /** The delimiter that was used, for diagnostics. */
  delimiter: string;
}

/** Split one already-delimited text into rows of fields. */
function tokenize(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // Swallow CR; the LF that follows ends the row.
      if (text[i + 1] !== '\n') { row.push(field); field = ''; rows.push(row); row = []; }
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Which delimiter yields the most fields on the first non-empty line. */
function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
  let best = ',';
  let bestCount = 0;
  for (const d of CANDIDATE_DELIMITERS) {
    // Counted outside quotes, so a comma inside "Smith, John" doesn't vote.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

/**
 * Parse a delimited file into headers and rows. Returns null when there is no
 * header row plus at least one data row to read.
 */
export function parseDelimited(text: string): DelimitedTable | null {
  if (!text) return null;
  // Excel's "CSV UTF-8" writes a BOM. Left in place it becomes part of the
  // first header, so "Name" stops matching "name" and the column vanishes.
  const clean = text.replace(/^﻿/, '');
  const delimiter = sniffDelimiter(clean);

  const raw = tokenize(clean, delimiter).filter(r => r.some(cell => cell.trim() !== ''));
  if (raw.length < 2) return null;

  const rawHeaders = raw[0].map(h => h.trim());
  const headers = rawHeaders.map(h => h.toLowerCase());
  const width = headers.length;

  const rows = raw.slice(1).map(r => {
    const padded = r.map(cell => cell.trim());
    while (padded.length < width) padded.push('');
    return padded;
  });

  return { headers, rawHeaders, rows, delimiter };
}

/**
 * Index of the first header matching any candidate, exact matches preferred
 * over substring ones so a "Company Phone" column can't win over "Phone".
 * Candidates are lowercase.
 */
export function findColumn(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const exact = headers.indexOf(c);
    if (exact !== -1) return exact;
  }
  for (const c of candidates) {
    const partial = headers.findIndex(h => h.includes(c));
    if (partial !== -1) return partial;
  }
  return -1;
}

/** Every header index matching any candidate — for files that split one idea
 *  across columns (Role, Role 2, Secondary Role…). */
export function findColumns(headers: string[], candidates: string[]): number[] {
  const hits: number[] = [];
  headers.forEach((h, idx) => {
    if (candidates.some(c => h === c || h.includes(c))) hits.push(idx);
  });
  return hits;
}

/** Read a cell, tolerating a column that isn't present. */
export function cell(row: string[], idx: number): string {
  return idx >= 0 ? (row[idx] || '').trim() : '';
}
