import { describe, it, expect } from 'vitest';
import { parseContactCSV, parseClientCSV, parseVCF, describeHeaders } from './contact-import';

describe('parseContactCSV', () => {
  it('reads a plain crew list', () => {
    const { contacts } = parseContactCSV(
      'Name,Email,Phone,Role\nTommy Reyes,tommy@x.com,555-0101,Editor'
    );
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      name: 'Tommy Reyes',
      email: 'tommy@x.com',
      phone: '555-0101',
      primary_role: 'Editor',
    });
  });

  // The reported bug: a contractor export that parsed to zero contacts while
  // the same flow worked for clients. Excel's "CSV UTF-8" BOM glued itself to
  // the first header, so the name column stopped matching and every row was
  // dropped as nameless.
  it('reads a file saved by Excel with a BOM on the first header', () => {
    const { contacts } = parseContactCSV('﻿Name,Email\nTommy Reyes,tommy@x.com');
    expect(contacts.map(c => c.name)).toEqual(['Tommy Reyes']);
  });

  it('finds the name under the headers contractor lists actually use', () => {
    for (const header of ['Contact', 'Contact Name', 'Vendor', 'Contractor', 'Crew Member', 'Full Name']) {
      const { contacts } = parseContactCSV(`${header},Email\nTommy Reyes,tommy@x.com`);
      expect(contacts.map(c => c.name), header).toEqual(['Tommy Reyes']);
    }
  });

  it('builds a name from First/Last columns', () => {
    const { contacts } = parseContactCSV('First Name,Last Name,Email\nTommy,Reyes,tommy@x.com');
    expect(contacts[0].name).toBe('Tommy Reyes');
  });

  it('falls back to a company name, as the client importer always did', () => {
    const { contacts } = parseContactCSV('Company,Email\nBright Lights LLC,hi@brightlights.com');
    expect(contacts[0].name).toBe('Bright Lights LLC');
  });

  // An apostrophe used to open a quote that never closed, swallowing the
  // delimiters after it and shifting every later column.
  it('keeps columns aligned through apostrophes', () => {
    const { contacts } = parseContactCSV(
      "Name,Role,Email\nSeamus O'Brien,Gaffer,seamus@x.com"
    );
    expect(contacts[0]).toMatchObject({
      name: "Seamus O'Brien",
      primary_role: 'Gaffer',
      email: 'seamus@x.com',
    });
  });

  it('splits several roles in one cell into primary and secondary', () => {
    const { contacts } = parseContactCSV('Name,Role\nMatt Cole,"Producer; Editor"');
    expect(contacts[0].primary_role).toBe('Producer');
    expect(contacts[0].secondary_roles).toBe('Editor');
  });

  it('spreads multiple role columns across primary and secondary', () => {
    const { contacts } = parseContactCSV('Name,Role,Role 2\nMatt Cole,Producer,Editor');
    expect(contacts[0].primary_role).toBe('Producer');
    expect(contacts[0].secondary_roles).toBe('Editor');
  });

  it('invents a placeholder email only when the file has none', () => {
    const { contacts } = parseContactCSV('Name\nTommy Reyes');
    expect(contacts[0].email).toBe('tommy.reyes@temporary.com');
  });

  it('reports the headers it saw when no row yields a name', () => {
    const result = parseContactCSV('Zip,Notes\n11201,call first');
    expect(result.contacts).toHaveLength(0);
    expect(result.rowCount).toBe(1);
    expect(describeHeaders(result.rawHeaders)).toContain('Zip');
  });

  it('reads semicolon-delimited and tab-delimited exports', () => {
    expect(parseContactCSV('Name;Email\nTommy;t@x.com').contacts[0].name).toBe('Tommy');
    expect(parseContactCSV('Name\tEmail\nTommy\tt@x.com').contacts[0].name).toBe('Tommy');
  });
});

describe('parseClientCSV', () => {
  it('reads a QuickBooks customer export', () => {
    const { clients } = parseClientCSV(
      'Customer,Email,Phone,Bill to Address\nAcme Corp,ap@acme.com,555-0100,"12 Main St, Brooklyn, NY"'
    );
    expect(clients[0]).toEqual({
      name: 'Acme Corp',
      email: 'ap@acme.com',
      phone: '555-0100',
      address: '12 Main St, Brooklyn, NY',
    });
  });

  it('assembles a split address', () => {
    const { clients } = parseClientCSV(
      'Customer,Street,City,State,Zip\nAcme Corp,12 Main St,Brooklyn,NY,11201'
    );
    expect(clients[0].address).toBe('12 Main St, Brooklyn, NY, 11201');
  });

  it('falls back to the company column for the name', () => {
    const { clients } = parseClientCSV('Company,Email\nAcme Corp,ap@acme.com');
    expect(clients[0].name).toBe('Acme Corp');
  });
});

describe('parseVCF', () => {
  it('reads name, email, and phone out of a card', () => {
    const card = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Tommy Reyes',
      'EMAIL;type=INTERNET:tommy@x.com',
      'TEL;type=CELL:555-0101',
      'END:VCARD',
    ].join('\n');
    expect(parseVCF(card)[0]).toMatchObject({
      name: 'Tommy Reyes',
      email: 'tommy@x.com',
      phone: '555-0101',
    });
  });

  it('falls back to the structured N field when FN is absent', () => {
    const card = 'BEGIN:VCARD\nN:Reyes;Tommy;;;\nEND:VCARD';
    expect(parseVCF(card)[0].name).toBe('Tommy Reyes');
  });
});
