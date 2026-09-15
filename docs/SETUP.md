# Studio OS — Deployment Setup

Everything here is optional. The app runs without any of it; each section
switches on one feature.

Two steps need a human because the credentials live in accounts only you can
sign into (Intuit, Anthropic, Supabase). Everything else is scripted.

---

## 1. Environment variables — scripted

From the repo root on your own machine:

```bash
bash scripts/setup-env.sh
```

It logs you into Vercel, links the project, generates the random secrets
itself, and prompts for the two you have to fetch (Anthropic, QuickBooks).
Secrets are read with echo off and piped straight to Vercel — nothing lands on
disk or in shell history. Press Enter to skip any section.

Re-running is safe: existing values are removed before being re-added, so the
same script rotates secrets later.

Then redeploy so the new values are picked up:

```bash
vercel --prod
```

### What it sets

| Variable | Where it comes from | Effect if unset |
|---|---|---|
| `CALENDAR_FEED_TOKEN` | generated | ICS feed is readable by anyone who knows the path |
| `CRON_SECRET` | generated | Anyone can trigger the calendar-sync cron |
| `OAUTH_STATE_SECRET` | generated | Falls back to the Supabase service key |
| `STUDIO_TIMEZONE` | you (default `America/New_York`) | Defaults to Eastern |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | Assistant hides itself |
| `QUICKBOOKS_CLIENT_ID` / `_SECRET` | developer.intuit.com → your app → Keys | QuickBooks card shows "not configured" |
| `QUICKBOOKS_ENVIRONMENT` | you (default `sandbox`) | Sandbox |
| `QUICKBOOKS_REDIRECT_URI` | you | Derived from the request origin |

> **After setting `CALENDAR_FEED_TOKEN`, the bare `/api/calendar` URL stops
> working.** Copy the new tokenized URL from Integrations → Live Calendar Feed
> and re-subscribe anywhere you'd previously subscribed.

---

## 2. Database migration — manual, one paste

QuickBooks needs two tables/columns. Supabase's SQL editor is the fastest path
and needs no CLI setup.

Open **Supabase → SQL Editor → New query**, paste the contents of
`supabase/migrations/20260805000000_quickbooks.sql`, and run it.

It creates `quickbooks_tokens` (RLS on, and deliberately **no policy granted** —
tokens are only ever read server-side with the service role) and adds
`clients.quickbooks_customer_id`.

Run this *before* connecting QuickBooks, or the callback will fail to store
its tokens.

This is one migration of many, and it is only the QuickBooks one because that
is what this section switches on. For the full picture — how to tell which
migrations your database is missing, and how to write a new one — see
[docs/MIGRATIONS.md](MIGRATIONS.md):

```bash
node --env-file=.env.local scripts/migrations/check-applied.mjs
```

---

## 3. QuickBooks app — manual

1. **developer.intuit.com** → sign in → **Dashboard** → **Create an app** →
   *QuickBooks Online and Payments*.
2. Scope: **Accounting**. (There is no read-only accounting scope — Studio OS
   enforces read-only in code instead; it only ever issues GET queries.)
3. **Keys & credentials** → copy the **Development** Client ID and Secret.
4. Under **Redirect URIs**, add exactly:
   `https://zipline.media/api/auth/quickbooks/callback`
5. Feed those to `scripts/setup-env.sh`, leaving the environment on `sandbox`.
6. Redeploy, then **Integrations → QuickBooks → Connect**. Pick the sandbox
   company.

Once it looks right, swap in the **Production** keys, set
`QUICKBOOKS_ENVIRONMENT=production`, redeploy, and reconnect against your real
company.

---

## 4. Google OAuth — publish the consent screen

If the Google connection dies every few days no matter how often you reconnect,
this is why: while the consent screen sits in **Testing**, Google expires every
refresh token after 7 days.

**Google Cloud Console → APIs & Services → OAuth consent screen.** If
Publishing status reads *Testing*, click **Publish app**. Internal-only usage
needs no verification review.

---

## 5. Anthropic key — manual

**console.anthropic.com → API keys → Create key.** Paste it into the script.

Usage is a short classification per suggestion at low effort — well under a
cent each. Set a spend limit under **Billing → Limits** if you want a hard cap.

---

# Running it locally (no Vercel build)

Vercel rebuilds on every push, which is roughly a minute before you can look at
a change. A local dev server updates the moment a file is saved, and can be
opened on your phone over the same wifi.

## One-time

```bash
cd ~/Documents/zipline-media
git pull
npm install
npx vercel link              # pick the zipline-media project
npx vercel env pull .env.local
```

`vercel env pull` writes every environment variable from the deployed project
into `.env.local`. Nothing is typed by hand and no secret goes through a chat
window. `.env.local` is gitignored.

## Every time

```bash
npm run dev          # just the Mac  → http://localhost:3000
npm run dev:phone    # phone too
```

`dev:phone` binds every network interface instead of only localhost, which is
what makes the Mac reachable from another device. Next prints both URLs on
start:

```
- Local:   http://localhost:3000
- Network: http://192.168.1.42:3000   ← open this one on the phone
```

Both devices have to be on the same wifi. Stop the server with Ctrl-C.

## What to know before editing anything

**This runs against the live database.** `vercel env pull` brings down the
production Supabase credentials, so a job you delete locally is deleted for
real, and saving a production pushes a real event to the studio's Google
Calendar. There is no separate staging database. Read freely; think before you
write.

**Connecting a new integration won't work locally.** Google and QuickBooks only
accept the redirect URIs registered for them, which point at zipline.media.
Accounts already connected keep working — those refresh server-side and don't
need the redirect — so calendar sync and the inbox behave normally. It is only
the initial *Connect* button that fails.

**Blank screens mean a missing key, not broken code.** Without
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` the app renders
but nothing loads. Re-run `npx vercel env pull .env.local` if that happens.
