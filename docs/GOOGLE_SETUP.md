# Google Account Linking — One-Time Server Setup

The "Connect Google Account" button in **Command Center → Integrations** needs a
Google OAuth client and three environment variables. This takes about 10 minutes
and you only ever do it once.

Your redirect URI (used in Step 2 and Step 3 — copy it exactly, no trailing slash):

```
https://zipline.media/api/auth/google/callback
```

---

## Step 1 — Create a Google Cloud project and enable the APIs

1. Go to <https://console.cloud.google.com/projectcreate>, name the project
   (e.g. `zipline-media`), and click **Create**. Make sure it's selected in the
   top bar afterwards.
2. Enable the three APIs the app uses — open each link and click **Enable**:
   - Calendar: <https://console.cloud.google.com/apis/library/calendar-json.googleapis.com>
   - Drive: <https://console.cloud.google.com/apis/library/drive.googleapis.com>
   - Gmail: <https://console.cloud.google.com/apis/library/gmail.googleapis.com>

## Step 2 — Consent screen + OAuth client

1. Go to <https://console.cloud.google.com/apis/credentials/consent>
   (Google sometimes calls this **Google Auth Platform → Branding**).
   - User type: **External** → Create.
   - Fill in only the required fields: app name (`Zipline Media`) and your email
     for the support/developer contacts. **Skip the Scopes page** — the app
     requests scopes at runtime and test users can approve them anyway.
   - On the **Test users** page, click **Add users** and add the Google account
     email you'll sign in with. Leave publishing status as **Testing**.
2. Go to <https://console.cloud.google.com/apis/credentials> →
   **+ Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, click **+ Add URI** and paste the
     redirect URI from the top of this page.
   - Click **Create**, then copy the **Client ID** and **Client secret**.

## Step 3 — Environment variables in Vercel

Go to your Vercel project → **Settings → Environment Variables** and add these
three, scoped to **Production** (tick Preview too if you test there):

| Name                   | Value                                              |
| ---------------------- | -------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | the Client ID from Step 2                          |
| `GOOGLE_CLIENT_SECRET` | the Client secret from Step 2                      |
| `GOOGLE_REDIRECT_URI`  | `https://zipline.media/api/auth/google/callback`   |

`GOOGLE_REDIRECT_URI` must match the URI you entered in Google
**character-for-character** or the flow fails with `redirect_uri_mismatch`.

## Step 4 — Redeploy and connect

1. Env vars only apply to new deployments: Vercel → **Deployments** → **⋯** on
   the latest deployment → **Redeploy** (or just push any commit).
2. Reload **Command Center → Integrations**. The amber warning is gone.
3. Click **Connect Google Account**, approve the consent screen, and you'll land
   back in the app showing **Connected**.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `redirect_uri_mismatch` | The URI in Google Credentials ≠ `GOOGLE_REDIRECT_URI`. Make them identical (scheme, domain, path, no trailing slash). |
| "Google hasn't verified this app" / access blocked | The account you're signing in with isn't in **Test users** (Step 2), or you're signed into a different Google account. |
| Button still shows "isn't configured" | You didn't redeploy after adding the env vars, or they're scoped to the wrong environment. |
| Connected, but Gmail/Drive/Calendar calls fail | One of the three APIs wasn't enabled in Step 1. |
