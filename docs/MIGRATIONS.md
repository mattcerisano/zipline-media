# Database migrations

There is no migration runner. Every change to the database is a `.sql` file in
`supabase/migrations/`, pasted by hand into **Supabase → SQL Editor → New
query**. That is a deliberate trade — no CLI to install, no credentials in CI —
but it means nothing enforces that a migration was actually run. Several code
paths deliberately degrade when one has not — a missing migration does not
raise an error, it quietly keeps the pre-migration behaviour — so there is no
symptom to notice.

`schema_migrations` is what closes that gap.

---

## What is pending

```bash
npx vercel env pull .env.local          # once, if you have no .env.local
node --env-file=.env.local scripts/migrations/check-applied.mjs
```

It compares the filenames in `supabase/migrations/` against the
`schema_migrations` table and lists anything not recorded, in the order to run
it. Exits non-zero when something is pending, so it can gate a deploy.

The service role key is required — `schema_migrations` has RLS on and no
policies, so the anon key sees nothing. Run it from your machine, never from
the browser.

---

## Applying one

1. Open the file, read the header comment. Several migrations have to run in a
   specific order relative to a sibling, and the header says so.
2. Paste the whole file into the SQL editor and run it.
3. That's it — the last statement in every migration records itself in
   `schema_migrations`.

Migrations are written to be idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT
EXISTS`, `ON CONFLICT DO NOTHING`), so running one twice is safe. Write new
ones the same way; the recovery path for a half-applied migration is to fix it
and run it again.

---

## Writing one

**Name it with the real current time, to the second:**

```bash
date -u +%Y%m%d%H%M%S     # → 20260823141207
```

Then `20260823141207_what_it_does.sql`.

Not a rounded-off `...000000` stamp. Two branches open on the same day both
reach for midnight and collide, which is exactly what happened on 2026-08-22:

| Prefix | Files sharing it |
|---|---|
| `20260822000000` | `dismissed_duplicate_pairs`, `editor_card_scope`, `studio_calendar` |
| `20260822000001` | `edit_time_tracking`, `marker_fanout_and_orphans` |

Those stay as they are. Renaming an applied migration would orphan its row in
`schema_migrations`, and the checker would then report it as pending forever.
They are harmless as long as nothing sorts by prefix alone — which is why
`version` is the **full filename minus `.sql`**, not the timestamp.

**End every migration by recording itself:**

```sql
INSERT INTO public.schema_migrations (version) VALUES ('20260823141207_what_it_does')
  ON CONFLICT (version) DO NOTHING;
```

The string must match the filename exactly. Nothing verifies this for you; a
typo produces a migration that silently reports as never-run.

**Match the RLS posture of what you are adding to.** Anything holding tokens,
billing records, or cross-account bookkeeping gets `ENABLE ROW LEVEL SECURITY`
with no policies granted, readable only by the service role — see
`google_tokens`, `calendar_event_google_links`, `schema_migrations`. The anon
key ships in the page bundle, so a rule enforced only in the UI is not enforced.

---

## The backfill

`20260823000000_schema_migrations.sql` seeds the table with the 52 migrations
that existed on 2026-08-23. It does not take anyone's word for which of them
ran: each one is recorded **only if a probe finds its change in the live
schema**. A migration you never applied simply gets no row, and the checker
lists it as pending.

The `basis` column says how each row knows:

| `basis` | Meaning |
|---|---|
| `recorded` | The migration inserted the row itself, as it ran. Everything from `20260823000000` onward. |
| `verified` | The backfill looked for this migration's change and found it — a table or index in `pg_class`, a column in `information_schema`, a policy in `pg_policies`, a CHECK constraint, or membership of the `supabase_realtime` publication. |
| `assumed` | The backfill could not look. Two migrations qualify (below). |

`applied_at` on a backfilled row is the date the table was created, not the
date that migration really ran — that was never recorded and cannot be
recovered. Rows written from `20260823000000` onward carry a true timestamp.

**The two assumed rows.** Each did nothing but create an RLS policy that a
later migration dropped and replaced, so no trace of them survives to look for:

- `20260619000007_public_read_user_roles` — superseded by `20260806000000`
- `20260806000000_user_roles_authenticated_read` — superseded by `20260822000000_editor_card_scope`

Both are gated on `user_roles.contact_id` — the fingerprint of
`20260822000000_editor_card_scope`, the migration that dropped the last of
their policies. A database that has reached that point has necessarily passed
through theirs. That is an inference from a later migration's evidence rather
than a check of their own effect, which is exactly why their basis is
`assumed` and not `verified`; on a database that never got that far, neither
is recorded.

**What "verified" claims.** That the schema change is present — not that this
particular file is what put it there. If someone made the same change by hand
in the dashboard, the probe passes, which is the right answer to the question
the table exists to answer: is the database in the shape the code expects?
