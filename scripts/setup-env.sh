#!/usr/bin/env bash
#
# One-shot environment setup for Studio OS on Vercel.
#
# Run this from the repo root on your own machine — secrets are read from your
# terminal and piped straight to Vercel, so nothing is written to disk, echoed
# to the screen, or stored in shell history.
#
#   bash scripts/setup-env.sh
#
# Safe to re-run: existing values are removed before being re-added, so this
# doubles as a rotation script. Skip any prompt by pressing Enter.
set -uo pipefail

cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null 2>&1; then
  VERCEL="npx --yes vercel@latest"
else
  VERCEL="vercel"
fi

echo "Checking Vercel login…"
if ! $VERCEL whoami >/dev/null 2>&1; then
  $VERCEL login || { echo "Login failed."; exit 1; }
fi
echo "Logged in as: $($VERCEL whoami 2>/dev/null)"

if [ ! -d .vercel ]; then
  echo
  echo "Linking this directory to the Vercel project…"
  $VERCEL link || { echo "Link failed."; exit 1; }
fi

# Replace rather than append: `vercel env add` on an existing name creates a
# duplicate rather than overwriting, which leaves the old value in play.
put() {
  local name="$1" value="$2" env="${3:-production}"
  [ -z "$value" ] && { printf '  %-26s skipped\n' "$name"; return; }
  $VERCEL env rm "$name" "$env" --yes >/dev/null 2>&1
  if printf '%s' "$value" | $VERCEL env add "$name" "$env" >/dev/null 2>&1; then
    printf '  %-26s set (%s)\n' "$name" "$env"
  else
    printf '  %-26s FAILED\n' "$name"
  fi
}

# Prompt without echoing to the terminal or leaving a history entry.
ask_secret() {
  local __var="$1" __prompt="$2" __value=""
  printf '%s\n  > ' "$__prompt" >&2
  read -rs __value
  printf '\n' >&2
  printf -v "$__var" '%s' "$__value"
}

ask_plain() {
  local __var="$1" __prompt="$2" __default="${3:-}" __value=""
  if [ -n "$__default" ]; then
    printf '%s [%s]\n  > ' "$__prompt" "$__default" >&2
  else
    printf '%s\n  > ' "$__prompt" >&2
  fi
  read -r __value
  printf -v "$__var" '%s' "${__value:-$__default}"
}

echo
echo "─────────────────────────────────────────────────────────────"
echo " 1. Generated secrets — no account needed, these are random"
echo "─────────────────────────────────────────────────────────────"

# Regenerated locally so they never travel through a chat transcript.
CALENDAR_FEED_TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
CRON_SECRET="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
OAUTH_STATE_SECRET="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"

put CALENDAR_FEED_TOKEN "$CALENDAR_FEED_TOKEN"
put CRON_SECRET         "$CRON_SECRET"
put OAUTH_STATE_SECRET  "$OAUTH_STATE_SECRET"

echo
echo "─────────────────────────────────────────────────────────────"
echo " 2. Studio timezone"
echo "─────────────────────────────────────────────────────────────"
ask_plain STUDIO_TZ "IANA timezone for call times" "America/New_York"
put STUDIO_TIMEZONE "$STUDIO_TZ"

echo
echo "─────────────────────────────────────────────────────────────"
echo " 3. Claude assistant  (console.anthropic.com -> API keys)"
echo "    Enter to skip — the assistant hides itself without a key."
echo "─────────────────────────────────────────────────────────────"
ask_secret ANTHROPIC_KEY "Paste ANTHROPIC_API_KEY (input hidden)"
put ANTHROPIC_API_KEY "$ANTHROPIC_KEY"

echo
echo "─────────────────────────────────────────────────────────────"
echo " 4. QuickBooks  (developer.intuit.com -> your app -> Keys)"
echo "    Use the DEVELOPMENT keys first; they pair with sandbox."
echo "    Enter to skip all three."
echo "─────────────────────────────────────────────────────────────"
ask_plain  QB_ID     "QUICKBOOKS_CLIENT_ID"
ask_secret QB_SECRET "Paste QUICKBOOKS_CLIENT_SECRET (input hidden)"
ask_plain  QB_ENV    "Environment (sandbox or production)" "sandbox"
# No default on purpose. Left unset, both the authorize and callback routes
# derive the redirect URI from the request origin, so it always matches the
# domain you're actually on. Only pin it if you need a specific one.
ask_plain  QB_URL    "Redirect URI (press Enter to auto-detect — recommended)"

put QUICKBOOKS_CLIENT_ID     "$QB_ID"
put QUICKBOOKS_CLIENT_SECRET "$QB_SECRET"
put QUICKBOOKS_ENVIRONMENT   "$QB_ENV"
put QUICKBOOKS_REDIRECT_URI  "$QB_URL"

echo
echo "─────────────────────────────────────────────────────────────"
echo " Done. Redeploy for these to take effect:"
echo "     vercel --prod"
echo
echo " Your calendar feed URL is now secret. Grab the new one from"
echo " Integrations -> Live Calendar Feed and re-subscribe anywhere"
echo " you'd previously subscribed — the old bare URL stops working."
echo "─────────────────────────────────────────────────────────────"
