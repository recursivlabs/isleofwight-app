#!/usr/bin/env bash
# PAPI(2) generator — the documented endpoint list with live statuses.
# Re-runnable by anyone: reads the engine's route registry at origin/main,
# probes every endpoint UNAUTHENTICATED against production, and emits
# docs/api-endpoints.md. No credential is used or needed: the point of the
# probe is the auth contract itself (401 missing_api_key on guarded routes),
# which is §2 row PS's inversion made visible per-endpoint.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
ENGINE="${ENGINE:-$(dirname "$ROOT")/recursiv}"
ORIGIN="${ORIGIN:-https://api.minds.com}"
OUT="${OUT:-docs/api-endpoints.md}"

REGISTRY_REF='origin/main:packages/server/src/features/api-keys/rest/route-registry.json'
ENGINE_SHA=$(git -C "$ENGINE" rev-parse --short origin/main)
DEPLOYED=$(wget -qO- "$ORIGIN/health" | python3 -c \
  "import json,sys; print(str(json.load(sys.stdin).get('commit','?'))[:8])")
STAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

get_registry() {
  git -C "$ENGINE" show "$REGISTRY_REF"
}

probe_status() {
  local method="$1"
  local url="$2"
  local response code
  if [ "$method" = "GET" ]; then
    response="$(wget -O /dev/null --server-response --timeout=15 --max-redirect=0 "$url" 2>&1 || true)"
  else
    response="$(wget -O /dev/null --server-response --timeout=15 --max-redirect=0 \
      --method="$method" --header='Content-Type: application/json' --body-data='{}' \
      "$url" 2>&1 || true)"
  fi
  code="$(printf '%s\n' "$response" | sed -n -E 's/^  HTTP\/[^ ]+ ([0-9]+).*/\1/p' | head -n 1)"
  printf '%s' "${code:-ERR}"
}

{
  echo "# Minds public API — endpoint list with live statuses (PAPI sub-artifact 2)"
  echo
  echo "**Generated ${STAMP} by \`scripts/gen-api-endpoints.sh\` — re-run it rather than trusting this file.**"
  echo
  echo '```'
  echo "source registry : git -C <recursiv-repo> show ${REGISTRY_REF}   # engine @ ${ENGINE_SHA}"
  echo "deployed commit : wget -qO- ${ORIGIN}/health | python3 -c '<read .commit>' → ${DEPLOYED}"
  echo "status probe    : wget --server-response --method=<METHOD> ${ORIGIN}/api/v1<PATH>   # UNAUTHENTICATED"
  echo '```'
  echo
  echo "Statuses are the **unauthenticated** response: \`401\` means the route exists and enforces"
  echo "API-key auth (the correct stranger-facing contract); anything else is that route's real"
  echo "unauthenticated behaviour and is the finding, not an error in this file. Path params are"
  echo "probed literally (\`:id\` unsubstituted); guarded groups 401 before routing, so a 401 is"
  echo "meaningful there while public groups show their true 404/4xx."
  echo
  echo "| # | Method | Path | Scopes | Unauth status |"
  echo "|---|---|---|---|---|"
  # Non-GET probes carry an empty JSON body so body parsing cannot mask the
  # unauthenticated contract. No credential is sent, so protected handlers do
  # not reach their mutation logic.
  n=0
  while IFS=$'\t' read -r method path scopes; do
    n=$((n+1))
    code="$(probe_status "$method" "${ORIGIN}/api/v1${path}")"
    echo "| $n | $method | \`$path\` | $scopes | $code |"
    sleep 0.05
  done < <(get_registry | python3 -c "
import json,sys
for r in json.load(sys.stdin):
    print(r['method'], r['path'], ','.join(r.get('scopes',[]) ) or '—', sep='\t')")
  echo
  echo "## Reading the observations (${STAMP})"
  echo
  echo "- \`401\` is the expected missing-key answer for a protected route."
  echo "- \`400\`/\`404\`/\`403\` can be correct for deliberately public, parameterized, or policy-gated routes; inspect the body before classifying one."
  echo "- \`429\` means this census hit a live rate limit and must be re-run more slowly; it is not the endpoint's auth contract."
  echo "- \`5xx\` and \`ERR\` are findings. Reproduce one route with its response body and a positive control before filing it."
  echo "- This unauthenticated census does not prove an authenticated call, tenant scoping, or SDK parity."
  echo
  echo "_${n} endpoints probed. Regenerate: \`ENGINE=../recursiv ORIGIN=https://api.minds.com bash scripts/gen-api-endpoints.sh\`_"
} > "$OUT"
echo "wrote $OUT"
