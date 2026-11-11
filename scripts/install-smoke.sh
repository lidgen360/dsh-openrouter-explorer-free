#!/usr/bin/env bash
#
# Release smoke: `npm pack` the bundle, install THAT tarball into a throwaway
# DSH_HOME/profile and prove the result is a working install:
#
#   1. tarball is built by npm (the same artifact the GitHub release ships);
#   2. profile is created from a shipped DSH template and gets the tarball
#      through the documented `dsh plugin --profile <name> add <tarball>`;
#   3. the composed config contains the `openrouter-explorer-free` row;
#   4. the installed package resolves and its host entry + client bundle load;
#   5. the Web host boots on an ephemeral port and answers HTTP.
#
# Everything happens under a temporary DSH_HOME: the real profile, the real
# state and the user's credentials are never touched. There is no dependency
# on the path this repo lives in, so it also works from a fresh clone.
#
#   bash scripts/install-smoke.sh              # web profile, full smoke
#   bash scripts/install-smoke.sh --keep       # keep temp dirs for debugging
#   bash scripts/install-smoke.sh --no-boot    # skip the Web host boot step
#   DSH_BIN=/path/to/dsh bash scripts/install-smoke.sh
#   TEMPLATE=headless bash scripts/install-smoke.sh
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DSH_BIN="${DSH_BIN:-dsh}"
PROFILE="${PROFILE:-dsh-orx-smoke}"
TEMPLATE="${TEMPLATE:-web}"
ROW="openrouter-explorer-free"
PACKAGE="dsh-openrouter-explorer-free"
KEEP=0
BOOT=1

for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    --no-boot) BOOT=0 ;;
    -h | --help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "unknown argument: $arg (see --help)" >&2
      exit 2
      ;;
  esac
done

step() { printf '  -> %s\n' "$*"; }
fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail 'node is not on PATH (need Node >= 22)'
command -v npm >/dev/null 2>&1 || fail 'npm is not on PATH'
command -v "$DSH_BIN" >/dev/null 2>&1 || fail "dsh not found ($DSH_BIN); set DSH_BIN=/path/to/dsh"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/dsh-orx-smoke-XXXXXX")"
TEMP_HOME="$WORK/home"
TARBALL_DIR="$WORK/tarball"
mkdir -p "$TEMP_HOME" "$TARBALL_DIR"

cleanup() {
  if [ "$KEEP" = 1 ]; then
    printf 'kept: %s\n' "$WORK"
  else
    rm -rf "$WORK"
  fi
}
trap cleanup EXIT

printf 'OpenRouter Explorer Free — install smoke\n'
printf '  repo:   %s\n' "$REPO"
printf '  dsh:    %s (%s)\n' "$("$DSH_BIN" --version)" "$DSH_BIN"
printf '  node:   %s\n' "$(node --version)"
printf '  home:   %s\n' "$TEMP_HOME"

# 1. Build the release artifact.
TARBALL="$(cd "$TARBALL_DIR" && npm pack "$REPO" --silent | tail -n 1)"
[ -f "$TARBALL_DIR/$TARBALL" ] || fail "npm pack produced no tarball in $TARBALL_DIR"
step "packed $TARBALL ($(wc -c <"$TARBALL_DIR/$TARBALL" | tr -d ' ') bytes)"

# 2. Fresh profile from a shipped template, then the documented install path.
export DSH_HOME="$TEMP_HOME"
"$DSH_BIN" --profile "$PROFILE" --from-default-profile "$TEMPLATE" --dump-config >/dev/null
step "profile $PROFILE created from template $TEMPLATE"

"$DSH_BIN" plugin --profile "$PROFILE" add "$TARBALL_DIR/$TARBALL" >/dev/null
step "installed via dsh plugin --profile $PROFILE add <tarball>"

# 3. The bundle row must be composed into the profile tree.
CONFIG="$("$DSH_BIN" --profile "$PROFILE" --dump-config)"
printf '%s' "$CONFIG" | grep -q "$ROW" || fail "row \"$ROW\" is missing from --dump-config"
step "row $ROW is composed into --dump-config"

# 4. The installed package itself: exports, host entry, client bundle.
PROFILE_DIR="$TEMP_HOME/profiles/$PROFILE"
[ -d "$PROFILE_DIR/node_modules/$PACKAGE" ] || fail "$PACKAGE is not in $PROFILE_DIR/node_modules"
PROFILE_DIR="$PROFILE_DIR" PACKAGE="$PACKAGE" ROW="$ROW" node --input-type=module <<'NODE'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = path.join(process.env.PROFILE_DIR, 'node_modules', process.env.PACKAGE)
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('package.json is missing dsh.bundle.patch')
if (pkg.dsh?.client?.platform !== 'web') throw new Error('package.json is missing dsh.client.platform')
const host = await import(pathToFileURL(path.join(dir, 'index.js')).href)
if (host.name !== process.env.ROW) throw new Error(`host entry exports name "${host.name}"`)
if (typeof host.apply !== 'function') throw new Error('host entry has no apply()')
const client = path.join(dir, 'lib', 'client.js')
if (!fs.existsSync(client) || fs.statSync(client).size < 1000) throw new Error('client bundle is missing or empty')
console.log(`  -> installed package ${pkg.name}@${pkg.version}: host entry + client bundle load`)
NODE

# 5. Boot the Web host against the throwaway home and make sure it answers.
if [ "$BOOT" = 1 ]; then
  LOG="$WORK/host.log"
  "$DSH_BIN" --profile "$PROFILE" --host 127.0.0.1 --port 0 --no-open >"$LOG" 2>&1 &
  HOST_PID=$!
  # shellcheck disable=SC2064
  trap 'kill "$HOST_PID" 2>/dev/null || true; cleanup' EXIT

  URL=''
  for _ in $(seq 1 120); do
    URL="$(grep -oE 'http://(127\.0\.0\.1|localhost):[0-9]+[^[:space:]]*' "$LOG" | head -n 1 || true)"
    [ -n "$URL" ] && break
    if ! kill -0 "$HOST_PID" 2>/dev/null; then
      tail -n 20 "$LOG" >&2 || true
      fail 'Web host exited before printing its URL'
    fi
    sleep 0.5
  done
  [ -n "$URL" ] || {
    tail -n 20 "$LOG" >&2 || true
    fail 'Web host did not print a URL within 60s'
  }
  ORIGIN="$(printf '%s' "$URL" | sed -E 's#(https?://[^/]+).*#\1#')"
  TOKEN="$(printf '%s' "$URL" | sed -nE 's/.*[?&]token=([^&]+).*/\1/p')"
  step "host booted: $ORIGIN"

  # A fresh DSH_HOME has no session yet, so the UI root legitimately answers
  # 303 -> welcome page or 401 from the auth fence; any of these means the host
  # is up and serving. A connection failure is what we must catch here.
  STATUS="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$URL" || true)"
  case "$STATUS" in
    200 | 303 | 401) step "GET $ORIGIN/ -> $STATUS (host is serving)" ;;
    *) fail "GET $URL returned HTTP $STATUS" ;;
  esac

  # The plugin's HTTP prefix must be mounted (401/403 from the auth fence is a
  # valid answer: the route exists; 404 would mean the plugin is not loaded).
  ROUTE_URL="$ORIGIN/openrouter-explorer-free/status"
  [ -n "$TOKEN" ] && ROUTE_URL="$ROUTE_URL?token=$TOKEN"
  ROUTE_BODY="$WORK/route.json"
  ROUTE_STATUS="$(curl -sSL -o "$ROUTE_BODY" -w '%{http_code}' --max-time 15 "$ROUTE_URL" || true)"
  [ "$ROUTE_STATUS" = '200' ] || {
    tail -n 20 "$LOG" >&2 || true
    fail "plugin route /openrouter-explorer-free/status returned HTTP $ROUTE_STATUS"
  }
  grep -q '"status"' "$ROUTE_BODY" || {
    head -c 300 "$ROUTE_BODY" >&2 || true
    fail 'plugin route /openrouter-explorer-free/status did not return the status payload'
  }
  step "plugin route /openrouter-explorer-free/status -> 200 (JSON status payload)"

  kill "$HOST_PID" 2>/dev/null || true
  wait "$HOST_PID" 2>/dev/null || true
  trap cleanup EXIT
fi

printf '\nPASS  install smoke: %s@%s installs from the release tarball and boots\n' "$PACKAGE" "$(node -p "require('$PROFILE_DIR/node_modules/$PACKAGE/package.json').version")"
