#!/usr/bin/env bash
# Read-only developer access preflight. Never prints secret values.
set -uo pipefail

PROFILE="${DEV_ACCESS_PROFILE:-owner}"
MINDS_REPO="${MINDS_REPO:-recursivlabs/minds}"
ENGINE_REPO="${ENGINE_REPO:-recursivlabs/recursiv}"
ORIGIN="${MINDS_ORIGIN:-https://api.minds.com}"
ORG="${MINDS_ORG_ID:-019d517b-bb87-744d-92db-b3801dc15927}"
PROJ="${MINDS_PROJECT_ID:-019d5190-f0c0-717e-a1bd-ef9c335292b9}"
INFISICAL_PROJECT="${INFISICAL_PROJECT:-5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c}"
SECRET_NAME="${SECRET_NAME:-MINDS_NETWORK_API_KEY}"
REQUIRE_DISPATCHER="${REQUIRE_DISPATCHER:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_LOADER="$SCRIPT_DIR/read-infisical-secret.py"

usage() {
  cat <<'EOF'
Usage: bash scripts/dev-access-check.sh [--profile owner|external|launch-operator]

Profiles:
  owner            GitHub, both repos, Infisical, and the live Minds dispatcher.
  external         GitHub access only. Shared production secrets are not requested.
  launch-operator  Same checks as owner, for an explicitly authorized operator.

Set REQUIRE_DISPATCHER=1 only when an external developer has been deliberately
granted dispatcher access through their own Infisical identity.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$PROFILE" in
  owner|launch-operator) REQUIRE_DISPATCHER="${REQUIRE_DISPATCHER:-1}" ;;
  external) REQUIRE_DISPATCHER="${REQUIRE_DISPATCHER:-0}" ;;
  *) echo "Invalid profile: $PROFILE" >&2; usage >&2; exit 2 ;;
esac

failures=0
warnings=0
pass() { printf 'CONNECTED           %s\n' "$1"; }
warn() { printf 'OPTIONAL_UNAVAILABLE %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf '%-19s %s\n' "$1" "$2"; failures=$((failures + 1)); }

printf 'Developer access profile: %s\n\n' "$PROFILE"

if ! command -v gh >/dev/null 2>&1; then
  fail NOT_CONFIGURED "GitHub CLI is not installed (https://cli.github.com/)."
else
  gh_status="$(gh auth status -h github.com 2>&1)"
  if printf '%s' "$gh_status" | grep -q 'Logged in to github.com'; then
    pass "GitHub authentication"
  else
    fail AUTH_OR_KEYRING_UNAVAILABLE "GitHub login is missing, expired, or hidden by the sandbox; run: gh auth login -h github.com"
  fi

  if gh repo view "$MINDS_REPO" --json nameWithOwner >/dev/null 2>&1; then
    pass "GitHub repository $MINDS_REPO"
  else
    fail ACCESS_DENIED "Cannot read $MINDS_REPO with the active GitHub identity."
  fi

  if gh repo view "$ENGINE_REPO" --json nameWithOwner >/dev/null 2>&1; then
    pass "GitHub repository $ENGINE_REPO"
  elif [ "$PROFILE" = "external" ]; then
    warn "GitHub repository $ENGINE_REPO (request only for engine-scoped work)"
  else
    fail ACCESS_DENIED "Cannot read $ENGINE_REPO with the active GitHub identity."
  fi
fi

if [ "$REQUIRE_DISPATCHER" = "1" ]; then
  KEY=""
  if ! command -v python3 >/dev/null 2>&1; then
    KEY_STATUS=126
  elif KEY="$(python3 "$SECRET_LOADER" "$SECRET_NAME" --project-id "$INFISICAL_PROJECT" --env dev 2>/dev/null)"; then
    KEY_STATUS=0
  else
    KEY_STATUS=$?
  fi

  if [ "$KEY_STATUS" = "0" ]; then
    pass "Infisical secret $SECRET_NAME (value redacted)"
    if KEY="$KEY" ORIGIN="$ORIGIN" ORG="$ORG" PROJ="$PROJ" python3 - <<'PY' >/dev/null 2>&1
import json, os, urllib.request
req = urllib.request.Request(
    f"{os.environ['ORIGIN']}/api/v1/dispatcher/tasks?limit=1&layer=launch-ladder"
    f"&project_id={os.environ['PROJ']}&organization_id={os.environ['ORG']}",
    headers={"Authorization": f"Bearer {os.environ['KEY']}"},
)
with urllib.request.urlopen(req, timeout=15) as response:
    if response.status != 200:
        raise SystemExit(1)
    json.loads(response.read().decode())
PY
    then
      pass "Minds dispatcher API"
    else
      fail SERVICE_OR_CREDENTIAL_REJECTED "The dispatcher did not accept the Infisical credential."
    fi
    unset KEY
  elif [ "$KEY_STATUS" = "127" ]; then
    fail NOT_CONFIGURED "Infisical CLI is not installed or discoverable; install it or set INFISICAL_BIN."
  elif [ "$KEY_STATUS" = "11" ]; then
    fail AUTH_OR_KEYRING_UNAVAILABLE "Infisical command/session/network failed; run 'infisical login' and retry."
  elif [ "$KEY_STATUS" = "126" ]; then
    fail NOT_CONFIGURED "python3 is required by the access preflight."
  else
    fail SECRET_OR_SESSION_UNAVAILABLE "Infisical returned no valid $SECRET_NAME in plain or JSON output."
  fi
else
  warn "Infisical and live dispatcher (not granted by the external contributor profile)"
fi

printf '\nSummary: %s failure(s), %s optional item(s) unavailable.\n' "$failures" "$warnings"
[ "$failures" -eq 0 ]
