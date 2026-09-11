#!/usr/bin/env bash
# PMCP sub-artifact (3) — detect the MCP false-green.
#
# THE TRAP THIS EXISTS FOR, quoted from HANDOFF-minds-mcp.md:27-28 verbatim:
#   "It prints `minds: ✔ Connected` **in the exact broken state this file fixes.**
#    Restarting attaches `mcp__minds__*` but they still fail — every data tool
#    answers `Invalid API key.`; only `whoami` works."
#
# So a connection indicator is NOT evidence the server works, and neither is
# `whoami`: both answer green while every tool that reads a row is dead. That is
# the whole finding, and a check that calls `whoami` reproduces the bug instead
# of detecting it.
#
# WHAT THIS ASSERTS, and it is one thing: a tool that returns ROWS returns rows.
# Exit 0 only when a data endpoint answers with a payload. Any other outcome is
# a failure with the reason named, because "I could not look" and "it is broken"
# are different states and conflating them is what §1.2 clause 5 warns about.
#
# Usage:  MINDS_KEY=sk_live_… scripts/check-mcp-data-tools.sh
#         MINDS_KEY=… MINDS_ORIGIN=https://api.staging.recursiv.io scripts/…
set -uo pipefail

ORIGIN="${MINDS_ORIGIN:-https://api.minds.com}"
ORG="${MINDS_ORG_ID:-019d517b-bb87-744d-92db-b3801dc15927}"
KEY="${MINDS_KEY:-${MINDS_NETWORK_API_KEY:-}}"

fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; exit 1; }
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
skip() { printf '  \033[33mSKIP\033[0m  %s\n' "$1"; exit 2; }

[ -n "$KEY" ] || skip "no MINDS_KEY in the environment — CANNOT-VERIFY, not NOT-TRUE"

echo "MCP data-tool check — origin $ORIGIN"

# ── 1. The connection indicator, recorded but NEVER trusted ──────────────────
# whoami is the tool that stays green while the server is broken. It is called
# here for exactly one reason: to prove the false-green is reproducible, so the
# real check below is readable as a discriminator rather than as a lone assertion.
who_code=$(curl -s -o /tmp/mcp-whoami.$$ -w '%{http_code}' \
  -H "Authorization: Bearer $KEY" "$ORIGIN/api/v1/users/me")
if [ "$who_code" = "200" ]; then
  echo "  ..    connection/identity reachable (whoami-class, status $who_code) — NOT evidence of a working server"
else
  echo "  ..    connection/identity status $who_code — the false-green is not even present"
fi
rm -f /tmp/mcp-whoami.$$

# ── 2. THE ARTIFACT: a DATA tool must return ROWS ────────────────────────────
body=$(curl -s -H "Authorization: Bearer $KEY" \
  "$ORIGIN/api/v1/dispatcher/tasks?organization_id=$ORG&limit=5")

case "$body" in
  *'Invalid API key'*)
    fail "data tool answered 'Invalid API key.' while the connection reads healthy — THIS IS THE FALSE-GREEN (HANDOFF-minds-mcp.md:27)" ;;
  *'"error"'*)
    fail "data tool returned an error body: $(printf '%s' "$body" | head -c 200)" ;;
esac

# A payload is not a row. An empty list is what a scoped-out key, a wrong org and
# a working-but-empty project all return, so emptiness is not a pass — the same
# unguarded-absence defect §1.3 rejects everywhere else in this ladder.
count=$(printf '%s' "$body" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(-1); raise SystemExit
for k in ("data","tasks","items","results"):
    v = d.get(k) if isinstance(d, dict) else None
    if isinstance(v, list):
        print(len(v)); raise SystemExit
print(len(d) if isinstance(d, list) else -1)
' 2>/dev/null || echo -1)

[ "$count" = "-1" ] && fail "data tool returned a payload this check cannot parse as rows: $(printf '%s' "$body" | head -c 200)"
[ "$count" -eq 0 ] && fail "data tool returned ZERO rows — indistinguishable from a scoped-out key or a wrong org; not a pass"

ok "data tool returned $count row(s) — the server is working, not merely connected"
