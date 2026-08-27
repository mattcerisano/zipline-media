# Zipline Media

Two applications in one Next.js project:

**The public site** (`/`) — the cinematic single-page site for Zipline Media,
plus the video repository at `/archive`, services, and the public gear-share
pages. Live at [zipline.media](https://zipline.media).

**The Command Center** (`/command-center`) — the studio's internal operating
system, behind a login. Production calendar with two-way Google Calendar sync,
Slate (bookings, crew, call sheets, budgets), the Edit Tracker, the Gear
Builder, the Rolodex, a Gmail-backed inbox, creative briefs, and a credential
vault. Roles run from owner down to a freelance editor scoped by row-level
security to their own cards.

There is also an Electron wrapper (`electron/main.js`) that packages the same
app as a desktop build.

---

## Running it

```bash
npm install
npx vercel link              # pick the zipline-media project
npx vercel env pull .env.local
npm run dev                  # → http://localhost:3000
```

`npm run dev:phone` binds every interface so the dev server is reachable from
a phone on the same wifi.

**This runs against the live database.** There is no staging Supabase — a job
you delete locally is deleted for real, and saving a production pushes a real
event to the studio's Google Calendar. Read freely; think before you write.

Blank screens almost always mean a missing key rather than broken code; re-run
`npx vercel env pull .env.local`.

## Checks

```bash
npx tsc --noEmit     # types
npx eslint           # lint
npm test             # vitest
npx next build       # production build
```

CI runs all four on every PR and on `main`. Node 20.

## Database changes

Migrations are `.sql` files in `supabase/migrations/`, applied by hand through
the Supabase SQL editor — there is no runner. **Before assuming the database is
current:**

```bash
node --env-file=.env.local scripts/migrations/check-applied.mjs
```

Several code paths degrade quietly rather than erroring when a migration has
not been run, so a missing one has no obvious symptom. See
[docs/MIGRATIONS.md](docs/MIGRATIONS.md).

---

## Layout

| Path | What's in it |
|---|---|
| `src/app/` | Routes. Public site at the root, the app under `command-center/`, REST handlers under `api/`. |
| `src/components/workspace/` | Command Center shell — layout, dashboard widgets, settings, search palette. |
| `src/components/teambuilder/` | Rolodex, Slate, Edit Tracker. |
| `src/components/gearbuilder/` | Gear Builder, Rentals, Production Calendar. |
| `src/lib/` | Business logic, and where the unit tests live. |
| `supabase/migrations/` | Every database change, oldest first. |
| `scripts/` | Hand-run tooling. Excluded from typecheck and lint by design. |
| `docs/` | Setup, roadmap, and the guides below. |

## Docs

| | |
|---|---|
| [SETUP.md](docs/SETUP.md) | Deployment: env vars, QuickBooks, Google OAuth, running locally |
| [MIGRATIONS.md](docs/MIGRATIONS.md) | How database changes are applied and written |
| [GOOGLE_SETUP.md](docs/GOOGLE_SETUP.md) | Google OAuth client and calendar sync |
| [EDITOR_ACCOUNTS.md](docs/EDITOR_ACCOUNTS.md) | Giving a freelance editor a scoped login |
| [ROADMAP.md](docs/ROADMAP.md) | Shipped work and what's still open |
| [REQUIREMENTS.md](docs/REQUIREMENTS.md) | Design brief for the public site |

Deployed on Vercel; every push to `main` rebuilds.
