// Which migrations in the repo have not been run against the database yet.
//
//   node --env-file=.env.local scripts/migrations/check-applied.mjs
//
// Reads the filenames in supabase/migrations and compares them against the
// schema_migrations table. Exits 1 when something is pending, so it can gate a
// deploy rather than only inform a human.
//
// Node's own --env-file is used instead of dotenv, which this project does not
// declare as a dependency. Requires Node 20.6+.
//
// The service role key is needed because schema_migrations has RLS on and no
// policies -- the anon key sees nothing. Run it locally, never in a browser.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'supabase', 'migrations');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Run: npx vercel env pull .env.local, then pass --env-file=.env.local'
  );
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const onDisk = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.replace(/\.sql$/, ''))
  .sort();

const { data, error } = await supabase.from('schema_migrations').select('version, basis');

if (error) {
  // The table itself is created by a migration, so its absence is the expected
  // first-run state rather than a failure to explain away.
  const missingTable = error.code === '42P01' || /schema_migrations/.test(error.message ?? '');
  console.error(
    missingTable
      ? 'No schema_migrations table yet. Apply 20260823000000_schema_migrations.sql first — see docs/MIGRATIONS.md.'
      : `Could not read schema_migrations: ${error.message}`
  );
  process.exit(2);
}

const recorded = new Map(data.map((r) => [r.version, r]));
const pending = onDisk.filter((v) => !recorded.has(v));
const unknown = [...recorded.keys()].filter((v) => !onDisk.includes(v)).sort();

console.log(`${onDisk.length} migrations in the repo, ${recorded.size} recorded as applied.\n`);

if (pending.length) {
  console.log('PENDING — paste these into Supabase → SQL Editor, in this order:');
  for (const v of pending) console.log(`  ${v}.sql`);
  console.log('');
}

if (unknown.length) {
  // Someone ran a migration from a branch, then the branch was renamed or
  // dropped. Worth surfacing: the database has a change the repo cannot explain.
  console.log('RECORDED BUT NOT IN THE REPO — a migration ran from a branch that no longer exists:');
  for (const v of unknown) console.log(`  ${v}`);
  console.log('');
}

// How each row knows what it knows. 'verified' means the backfill found the
// migration's change in the live schema; 'assumed' means it could not look,
// because a later migration replaced the only thing that migration created.
const byBasis = data.reduce((acc, r) => ({ ...acc, [r.basis]: (acc[r.basis] ?? 0) + 1 }), {});
const summary = ['recorded', 'verified', 'assumed']
  .filter((b) => byBasis[b])
  .map((b) => `${byBasis[b]} ${b}`)
  .join(', ');
if (summary) console.log(`(${summary}.)`);

const assumed = data.filter((r) => r.basis === 'assumed').map((r) => r.version).sort();
if (assumed.length) {
  console.log('  assumed, not checked against the schema:');
  for (const v of assumed) console.log(`    ${v}`);
}

if (!pending.length) console.log('Up to date.');
process.exit(pending.length ? 1 : 0);
