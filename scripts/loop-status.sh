#!/usr/bin/env bash
# Cross-loop coordination status — §1.9a/§1.9d, made answerable.
#
# Answers "what has the other loop done, and what is waiting on me?" from LIVE
# ARTIFACTS ONLY: the loop log, the dispatcher queue, open PRs in both repos,
# and the §10 decision table. Nothing here is remembered or summarized — every
# line is a command's output, so an agent in either repo can run it and get the
# same answer.
#
# Written because on 2026-07-30 a Minds loop closed Cycle 0, produced six
# artifacts and filed three upstream issues, and an agent asked the same day in
# the engine repo what had happened had no way to find out.
#
# Usage:  bash scripts/loop-status.sh            (from either repo checkout)
set -uo pipefail

MINDS_REPO="${MINDS_REPO:-recursivlabs/minds}"
ENGINE_REPO="${ENGINE_REPO:-recursivlabs/recursiv}"
LOG_ISSUE="${LOG_ISSUE:-206}"
ORIGIN="${MINDS_ORIGIN:-https://api.minds.com}"
ORG="${MINDS_ORG_ID:-019d517b-bb87-744d-92db-b3801dc15927}"
PROJ="${MINDS_PROJECT_ID:-019d5190-f0c0-717e-a1bd-ef9c335292b9}"
INFISICAL_PROJECT="${INFISICAL_PROJECT:-5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c}"
SECRET_NAME="${SECRET_NAME:-MINDS_NETWORK_API_KEY}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_LOADER="$SCRIPT_DIR/read-infisical-secret.py"

hr() { printf '\n%s\n' "── $1 ──────────────────────────────────────────────"; }

hr "THE CONTRACT"
cat <<'EOF'
Minds launch is driven by docs/goal-prompt.md on main in recursivlabs/minds.
Two loops share it (§1.9d): loop ids are `bill` and `jack`. One controller,
two owners. Rules that bind BOTH loops and any agent in either repo:

  · Nothing closes by assertion. Every exit names an artifact a second party
    can re-fetch (§1.3). A subagent is never that second party (§1.9c).
  · One §1.6 cycle line per cycle to the loop log below. Nothing else counts
    as a progress report.
  · Single-writer lanes (§1.9b): one named driver owns writes to a shared PR,
    branch or deploy path at a time. A handoff names the SHA, the new driver,
    the allowed scope, and whether behaviour may change.
  · Engine work belongs to the Minds portfolio only when a Minds outcome
    depends on it (§1.9a). Non-ladder work never changes the launch denominator.
EOF

hr "LOOP LOG — last cycle line per loop"
gh issue view "$LOG_ISSUE" --repo "$MINDS_REPO" --json comments --jq '
  [.comments[] | select(.body | test("(^|\\n)CYCLE "))] as $c
  | if ($c|length)==0 then "no cycle lines yet"
    else ($c[-2:][] | (.body | capture("(?<line>CYCLE [^\n]*)").line) + "   (" + .author.login + ")")
    end' 2>/dev/null || echo "  (GitHub auth/keyring unavailable — run: bash scripts/dev-access-check.sh --profile owner)"
echo "  full log: https://github.com/$MINDS_REPO/issues/$LOG_ISSUE"

hr "LAUNCH SPINE + FULL PORTFOLIO — live, from the dispatcher"
KEY=""
if ! command -v python3 >/dev/null 2>&1; then
  KEY_STATUS=126
elif KEY="$(python3 "$SECRET_LOADER" "$SECRET_NAME" --project-id "$INFISICAL_PROJECT" --env dev 2>/dev/null)"; then
  KEY_STATUS=0
else
  KEY_STATUS=$?
fi
if [ "$KEY_STATUS" = "0" ]; then
  KEY="$KEY" ORIGIN="$ORIGIN" ORG="$ORG" PROJ="$PROJ" \
    python3 "$SCRIPT_DIR/loop-status-queue.py"
elif [ "$KEY_STATUS" = "127" ]; then
  echo "  INFISICAL_CLI_NOT_FOUND — install the CLI or set INFISICAL_BIN to its executable path."
  echo "  Run: bash scripts/bootstrap-dev-access.sh --profile owner"
elif [ "$KEY_STATUS" = "11" ]; then
  echo "  INFISICAL_CLI_FAILED — the CLI could not reach Infisical or use the current session."
  echo "  Run \`infisical login\`, then re-run this script."
elif [ "$KEY_STATUS" = "126" ]; then
  echo "  PYTHON_NOT_CONFIGURED — python3 is required by the status renderer and secret adapter."
else
  echo "  SECRET_OR_SESSION_UNAVAILABLE — Infisical returned no valid $SECRET_NAME in plain or JSON output."
  echo "  Run: bash scripts/bootstrap-dev-access.sh --profile owner"
fi
unset KEY

hr "OPEN PRs — both repos, one lane at a time"
for repo in "$MINDS_REPO" "$ENGINE_REPO"; do
  echo "  $repo:"
  gh pr list --repo "$repo" --state open --limit 12 \
    --json number,title,author,isDraft \
    --jq '.[] | "    #\(.number) \(.author.login)  \(.title[0:70])"' 2>/dev/null || \
      echo "    (GitHub auth/keyring unavailable — run the access preflight)"
done

hr "WAITING ON A HUMAN — nothing below moves without the named person"
gh issue list --repo "$MINDS_REPO" --state open --limit 60 \
  --json number,title,labels \
  --jq '.[] | select(.title | test("\\[decision\\]|decide|P0-decision")) | "  #\(.number) \(.title[0:74])"' 2>/dev/null
cat <<'EOF'
  #195 open-source layer (Bill) · #186 track-player (Jack) · #189 username model (Bill)
  #197 monetization gate scope (Bill) · P0 credential rotation (Bill, §1.7)
  P11 launch-gate sitting (Bill) + countersignature (Jack, §10)
  P12 store submission (Bill, §1.7) · P2a branch protection (Bill)
  A second GitHub login on the loop log — until one exists CONFIRMED cannot rise (§1.6)
EOF

hr "HOW TO HAND OFF"
cat <<'EOF'
  Claim   : the top AVAILABLE NOW row after checking its outcome, then heartbeat every 5 min (§1.9)
  Release : release_task(release_reason:"completed", pr_urls:[…], commits:[…]) and STOP.
            A completed release stays in_progress in the VERIFICATION QUEUE; a
            different party verifies and calls complete_task (§1.3). Partial work
            re-enters pending via a "blocked" release with
            context_handoff "PARTIAL k/N; CONFIRMED …; OUTSTANDING …; BLOCKED-BY …".
  Blocked : comment on the blocking issue naming the blocker, the human, the exact
            input needed, and the date its §10 default applies — then take the next
            unblocked row. Do not idle; do not cross a §1.7 boundary to self-unblock.
EOF
echo
