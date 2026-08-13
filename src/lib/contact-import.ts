/**
 * Reading contact and client lists out of the files people actually have:
 * a vCard exported from a phone, or a CSV out of QuickBooks, Google Contacts,
 * Excel, or a spreadsheet somebody keeps by hand.
 *
 * Lives here rather than inside the Rolodex component because this is the part
 * that silently decides whether an import works, and it is worth testing
 * without a browser. The CSV mechanics — quoting, delimiters, the BOM Excel
 * writes — are in src/lib/csv.ts.
 */

import { parseDelimited, findColumn, findColumns, cell } from './csv';
import { parseRoleList, formatRoleList } from './roles';

/** A row in the import preview. Roles are text here so they stay editable. */
export interface ImportContact {
  name: string;
  email: string;
  phone: string;
  primary_role: string;
  /** Comma-separated while it's in the preview table. */
  secondary_roles: string;
  tags: string;
}

export interface ImportClient {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface ContactCSVResult {
  contacts: ImportContact[];
  /** Headers as written, so an error can name the columns that were found. */
  rawHeaders: string[];
  /** Data rows seen, whether or not they yielded a contact. */
  rowCount: number;
}

/** A contact with no email still has to satisfy a NOT NULL column. */
const placeholderEmail = (name: string) =>
  `${name.toLowerCase().replace(/\s+/g, '.')}@temporary.com`;

/** vCard (.vcf), as exported from iOS and macOS Contacts. */
export function parseVCF(text: string): ImportContact[] {
  const contacts: ImportContact[] = [];
  const cards = text.split(/END:VCARD/i);

  for (const card of cards) {
    if (!card.includes('BEGIN:VCARD')) continue;

    let name = '';
    let email = '';
    let phone = '';

    const lines = card.split(/\r?\n/);
    for (const line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.toUpperCase().startsWith('FN:')) {
        name = cleanLine.substring(3).trim();
      } else if (cleanLine.toUpperCase().startsWith('FN;')) {
        const parts = cleanLine.split(':');
        if (parts.length > 1) name = parts.slice(1).join(':').trim();
      } else if (cleanLine.toUpperCase().startsWith('EMAIL')) {
        const parts = cleanLine.split(':');
        if (parts.length > 1) {
          const emailVal = parts.slice(1).join(':').trim();
          if (emailVal.includes('@')) email = emailVal;
        }
      } else if (cleanLine.toUpperCase().startsWith('TEL')) {
        const parts = cleanLine.split(':');
        if (parts.length > 1) phone = parts.slice(1).join(':').trim();
      }
    }

    // Fallback if FN is not defined but N is: e.g. N:LastName;FirstName;;;
    if (!name) {
      const nLine = lines.find(l => l.toUpperCase().startsWith('N:'));
      if (nLine) {
        const parts = nLine.substring(2).split(';');
        const last = parts[0]?.trim() || '';
        const first = parts[1]?.trim() || '';
        name = `${first} ${last}`.trim();
      }
    }

    if (name) {
      contacts.push({
        name,
        email: email || placeholderEmail(name),
        phone: phone || '',
        primary_role: '',
        secondary_roles: '',
        tags: 'iPhone Import',
      });
    }
  }
  return contacts;
}

/**
 * Parse a contractor/crew CSV into importable contacts.
 *
 * The client importer below always understood more header shapes than this one
 * did — it falls back to a Company column, while this insisted on a literal
 * "Name", "Full Name", or a First/Last pair. A contractor list headed
 * "Contact", "Vendor", or "Crew Member" therefore parsed to nothing and
 * reported "no contacts found" for a perfectly good file, which is what a beta
 * tester hit with a contractor export after the same flow worked for clients.
 *
 * Returns the headers alongside the rows so the caller can say *which* column
 * it couldn't find rather than leaving the producer to guess.
 */
export function parseContactCSV(text: string): ContactCSVResult {
  const table = parseDelimited(text);
  if (!table) return { contacts: [], rawHeaders: [], rowCount: 0 };

  const { headers, rawHeaders, rows } = table;
  const firstNameIdx = findColumn(headers, ['first name', 'first', 'given name', 'firstname']);
  const lastNameIdx = findColumn(headers, ['last name', 'last', 'family name', 'surname', 'lastname']);
  let nameIdx = findColumn(headers, [
    'name', 'full name', 'display name', 'contact name', 'contact', 'crew member',
    'crew', 'vendor', 'vendor name', 'contractor', 'contractor name', 'person',
  ]);
  // "First Name" contains "name", so the loose match claimed it as the whole
  // name and every imported contact lost their surname. A split-name file has
  // no single name column at all.
  if (nameIdx !== -1 && (nameIdx === firstNameIdx || nameIdx === lastNameIdx)) nameIdx = -1;
  const companyIdx = findColumn(headers, ['company', 'company name', 'business name', 'organization']);
  const emailIdx = findColumn(headers, ['email', 'e-mail', 'email address', 'mail']);
  const phoneIdx = findColumn(headers, ['phone', 'mobile', 'cell', 'phone number', 'telephone', 'tel']);
  const tagsIdx = findColumn(headers, ['tag', 'tags', 'group', 'category', 'department']);
  // Every role-ish column, in order: the first becomes the primary role and
  // the rest become secondary ones, which is how a sheet with "Role" and
  // "Role 2" columns is meant to read.
  const roleIdxs = findColumns(headers, ['role', 'position', 'title', 'job title', 'trade', 'skill']);

  const contacts: ImportContact[] = [];
  for (const row of rows) {
    let name = cell(row, nameIdx);
    if (!name) {
      name = [cell(row, firstNameIdx), cell(row, lastNameIdx)].filter(Boolean).join(' ');
    }
    // A one-person company listed only under its business name is still a
    // contact worth importing; dropping the row taught nobody anything.
    if (!name) name = cell(row, companyIdx);
    if (!name) continue;

    // A single cell can hold several roles ("Editor; Colorist") — common
    // wherever people wear more than one hat, which is the whole reason
    // secondary roles exist.
    const roles: string[] = [];
    for (const idx of roleIdxs) {
      for (const role of parseRoleList(cell(row, idx))) {
        if (!roles.some(r => r.toLowerCase() === role.toLowerCase())) roles.push(role);
      }
    }

    const email = cell(row, emailIdx);
    contacts.push({
      name,
      email: email || placeholderEmail(name),
      phone: cell(row, phoneIdx),
      primary_role: roles[0] || '',
      secondary_roles: formatRoleList(roles.slice(1)),
      tags: cell(row, tagsIdx) || 'CSV Import',
    });
  }

  return { contacts, rawHeaders, rowCount: rows.length };
}

/**
 * Parse a QuickBooks customer-list CSV export into client rows. Handles the
 * common QuickBooks header variants (Customer / Display Name, Company, Email,
 * Phone, and either a single Bill-to Address or split Street/City/State/ZIP).
 */
export function parseClientCSV(text: string): { clients: ImportClient[]; rawHeaders: string[] } {
  const table = parseDelimited(text);
  if (!table) return { clients: [], rawHeaders: [] };

  const { headers, rawHeaders, rows } = table;
  const nameIdx = findColumn(headers, ['customer', 'display name', 'full name', 'name', 'client']);
  const companyIdx = findColumn(headers, ['company', 'company name']);
  const emailIdx = findColumn(headers, ['email', 'e-mail', 'email address']);
  const phoneIdx = findColumn(headers, ['phone', 'mobile', 'tel', 'telephone']);
  const billIdx = findColumn(headers, ['bill to address', 'billing address', 'bill address']);
  const addrIdx = findColumn(headers, ['address', 'full address']);
  const streetIdx = findColumn(headers, ['street', 'address line 1', 'addr 1']);
  const cityIdx = findColumn(headers, ['city']);
  const stateIdx = findColumn(headers, ['state', 'province']);
  const zipIdx = findColumn(headers, ['zip', 'postal']);

  const clients: ImportClient[] = [];
  for (const row of rows) {
    const name = cell(row, nameIdx) || cell(row, companyIdx);
    if (!name) continue;

    let address = cell(row, billIdx) || cell(row, addrIdx);
    if (!address) {
      address = [streetIdx, cityIdx, stateIdx, zipIdx].map(idx => cell(row, idx)).filter(Boolean).join(', ');
    }

    clients.push({ name, email: cell(row, emailIdx), phone: cell(row, phoneIdx), address });
  }
  return { clients, rawHeaders };
}

/** Headers, quoted, for an error message someone can act on. */
export function describeHeaders(rawHeaders: string[]): string {
  const shown = rawHeaders.filter(Boolean).slice(0, 6).map(h => `“${h}”`).join(', ');
  if (!shown) return 'The first row of the file is empty.';
  return `Columns found: ${shown}${rawHeaders.length > 6 ? '…' : ''}.`;
}
