#!/usr/bin/env bash
# Build and serve Studio OS against fake Supabase credentials, then render every
# signed-in panel and check it for layout defects.
#
#   npm run ui:harness              # screenshots into ui-harness-shots/
#   npm run ui:harness -- --out /tmp/shots
#
# Exits non-zero if any screen clips text, overflows, or fails to load, so this
# can gate a pull request. Requires no real credentials: the Supabase host it
# points at does not exist, and every request to it is answered from
# scripts/ui-harness/fixtures.ts.
set -euo pipefail

PORT="${UI_HARNESS_PORT:-3210}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

export NEXT_PUBLIC_SUPABASE_URL="https://harness.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="harness-anon-key"

echo "Building against the harness Supabase host…"
npx next build >/dev/null

npx next start -p "$PORT" >/tmp/ui-harness-server.log 2>&1 &
SERVER=$!
# Always take the server down, including on failure — otherwise a failed run
# leaves a process holding the port and the next run builds against a stale one.
trap 'kill $SERVER 2>/dev/null || true' EXIT

echo "Waiting for localhost:$PORT…"
for _ in $(seq 1 60); do
  curl -sf -o /dev/null "http://localhost:$PORT/command-center" && break
  sleep 1
done

npx tsx scripts/ui-harness/harness.mts --port "$PORT" "$@"
