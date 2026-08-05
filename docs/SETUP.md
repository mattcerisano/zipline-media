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
