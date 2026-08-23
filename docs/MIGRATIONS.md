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

`20260823000000_schema_migrations.sql` seeds the table with all 52 migrations
that existed on 2026-08-23, marked `backfilled = TRUE`. Their `applied_at` is
the date the table was created, not the date they really ran — that information
was never recorded anywhere and cannot be recovered.

Everything from `20260823000000` onward has a true `applied_at`.
