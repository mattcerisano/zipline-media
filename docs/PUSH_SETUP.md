# Web Push Setup

Push notifications deliver **call-time reminders** and **@mention pings**
straight to phones and desktops — no app store, it rides on the PWA.

## 1. Generate VAPID keys (once)

VAPID keys identify your server to browser push services (Chrome/FCM, Safari,
Firefox). Generate a pair locally:

```bash
npx web-push generate-vapid-keys
```

## 2. Set environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | The **public** key from step 1 (safe to expose) |
| `VAPID_PRIVATE_KEY` | The **private** key from step 1 (keep secret) |
| `VAPID_SUBJECT` | Optional `mailto:you@example.com` contact for push services |

Redeploy after saving. The settings card under **Integrations → Push
Notifications** stops showing the "not configured" warning once the keys are
live.

## 3. Run the database migration

Apply `supabase/migrations/20260717000004_web_push.sql` (push subscriptions,
per-user preferences, the reminder dedupe ledger, and an
`organizations.timezone` column — defaults to `America/New_York`; update that
row if your productions run in another zone, since call times are wall-clock
text like "07:30 AM").

## 4. Enable on each device

Each person turns push on per device from **Integrations → Push Notifications**
(or **Settings → Profile**): Enable Push → allow notifications → Send test.

- **iPhone/iPad:** Safari only allows push for installed web apps — add the
  site to the Home Screen first (Share → Add to Home Screen), open it from
  there, then enable.
- **Android/desktop Chrome, Edge, Firefox:** works directly in the browser.

## How the reminders decide who to ping

The `/api/cron/call-reminders` cron (every 10 minutes, see `vercel.json`)
checks today's and tomorrow's non-cancelled shoots:

- People on the job's **crew list** (`job_roles`) are matched to their account
  by email and get *their* crew call time, falling back to the job's call time.
- If a job has **no crew list at all**, everyone with push enabled gets the
  job-level call time — the solo-operator case.
- Lead time is per user (default 1 hour) and set on the push settings card;
  each reminder sends exactly once per job/person/day.

Mention pings fire immediately when someone saves Edit Tracker notes that
@mention you (matched by your Rolodex contact's email), unless you've turned
mention pings off.

If `CRON_SECRET` is set in the environment, Vercel Cron authenticates with it
automatically — same arrangement as the calendar sync cron.
