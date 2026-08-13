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

# A server left over from an earlier run is not harmless: `next build` above has
# already overwritten .next underneath it, so it now serves a half-replaced build
# and every screen fails to load — which reads as 18 layout findings rather than
# as "the wrong server answered". Refuse to run instead.
if curl -sf -o /dev/null "http://localhost:$PORT/command-center" 2>/dev/null; then
  echo "Something is already serving localhost:$PORT. Stop it first:" >&2
  echo "  UI_HARNESS_PORT=<other> npm run ui:harness   # or kill the stale next-server" >&2
  exit 1
fi

# setsid puts the server in its own process group. `npx next start` spawns
# next-server as a child, so killing the npx wrapper alone orphans the real
# server still holding the port — the exact leak this trap exists to prevent.
setsid npx next start -p "$PORT" >/tmp/ui-harness-server.log 2>&1 &
SERVER=$!
trap 'kill -- -$SERVER 2>/dev/null || kill $SERVER 2>/dev/null || true' EXIT

echo "Waiting for localhost:$PORT…"
up=""
for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER" 2>/dev/null; then
    echo "next start exited before it began serving:" >&2
    cat /tmp/ui-harness-server.log >&2
    exit 1
  fi
  curl -sf -o /dev/null "http://localhost:$PORT/command-center" && { up=1; break; }
  sleep 1
done
# Without this the harness would go on to screenshot connection errors and
# report them as layout defects.
if [ -z "$up" ]; then
  echo "localhost:$PORT never answered after 60s:" >&2
  cat /tmp/ui-harness-server.log >&2
  exit 1
fi

npx tsx scripts/ui-harness/harness.mts --port "$PORT" "$@"
