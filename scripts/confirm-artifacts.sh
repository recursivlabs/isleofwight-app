#!/usr/bin/env bash
# The CI second party — §1.0's condition (a), §1.3, §5.47.
#
# For each registered sub-artifact this RE-EXECUTES the exit command §2 names
# and prints the output as produced INSIDE this run. §1.0 is explicit that a
# restatement is not a confirmation: the comment must carry the command and the
# output the run itself produced, plus the run_id, or it is worthless.
#
# Condition (b) — this workflow must be a REQUIRED check so the loop cannot
# disable the witness judging it — is satisfied by confirm.yml being named in
# required_status_checks (P2a). Both conditions must hold or `github-actions`
# does not count as a second party (§1.0), and this script says so in its own
# output rather than assuming.
#
# WHAT IT DELIBERATELY WILL NOT DO:
#   · the media class (§1.3's ninth) — somebody has to WATCH a recording
#   · money-, store-, credential- and moderation-adjacent rows — §5.47 keeps a
#     human there because being wrong is expensive, not merely incorrect
#   · anything whose command it cannot run (engine-private paths without a token)
# Those print SKIP with the reason. A skip is never a pass.
#
# POST=1 emits COUNTERSIGN blocks for the confirmed set; otherwise it reports.
set -uo pipefail

REPO="${REPO:-recursivlabs/minds}"
ENGINE_DIR="${ENGINE:-}"
RUN_ID="${GITHUB_RUN_ID:-local}"
RUN_URL="https://github.com/$REPO/actions/runs/$RUN_ID"

pass=0; fail=0; skip=0
CONFIRMED_BLOCKS=""

# confirm <sub-id> <human description> <command string> <predicate over $OUT>
confirm() {
  local id="$1" desc="$2" cmd="$3" pred="$4" out rc
  out="$(eval "$cmd" 2>&1)"; rc=$?
  if eval "$pred"; then
    pass=$((pass+1))
    printf '  ✅ %-10s %s\n' "$id" "$desc"
    CONFIRMED_BLOCKS+="COUNTERSIGN $id — re-executed in run $RUN_ID
\`\`\`
\$ $cmd
$out
\`\`\`
"
  else
    fail=$((fail+1))
    printf '  ❌ %-10s %s\n     cmd: %s\n     out: %s\n' "$id" "$desc" "$cmd" "$(echo "$out" | head -3 | tr '\n' ' ')"
  fi
  return 0
}

skip_artifact() { skip=$((skip+1)); printf '  ⏭  %-10s %s — SKIP: %s\n' "$1" "$2" "$3"; }

# readable <cmd> — can this runner even see the thing? Reading classic branch
# protection through REST needs admin scope, which the default GITHUB_TOKEN
# lacks, so in CI P2a.1's command returns "Resource not accessible by
# integration". P2c.3 uses GraphQL's narrower read-only projection, but GitHub
# still withholds that projection from the default Actions token; it becomes
# readable when ADMIN_GH_TOKEN is provisioned. Either way, an unreadable
# response is CANNOT-VERIFY, not NOT-TRUE, and reporting it as a failure would
# be the stdout-collision §1.2 clause 5 warns about wearing an API's clothes.
readable() { eval "$1" >/dev/null 2>&1; }

# Use the narrowly scoped repository-administration credential only for the
# protection surfaces that require it. The ordinary Actions token must remain
# active for run, issue and pull-request evidence; replacing GH_TOKEN globally
# makes those unrelated reads fail with 403.
protection_gh() {
  GH_TOKEN="${ADMIN_GH_TOKEN:-${GH_TOKEN:-}}" gh "$@"
}

# gh_ready — can this runner reach GitHub at all? Four checks (P1.3, PA.1, PA.2,
# P2c.2) read run conclusions or issue comments through `gh`. With gh missing or
# unauthenticated they reported FAILURE, which says "the production monitor is
# red" / "the negative control stopped negating" when the truth was "I could not
# look". That is the same conflation P1.1 carried (#260) — an unfinished run read
# as a broken one — and the same one `readable()` exists to prevent for the
# protection API. Evaluated ONCE: a per-check probe would multiply latency and
# could disagree with itself mid-run.
GH_READY=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then GH_READY=1; fi

# A green workflow conclusion is not proof that production parity ran. The
# parity script deliberately exits 0 on billing exhaustion so product alerts do
# not fire for an infrastructure/account problem; that makes the scorecard text
# in the run log the necessary discriminator. Emit one compact, predicate-safe
# line for the latest two production monitor runs:
#
#   success/1,success/1 123s-ago
#
# `1` means that run's log contains the terminal `ALL PASS (10 checks)` marker.
# A billing skip, early exit, or missing log is `0`, regardless of the workflow
# conclusion. This function is shared by P1.3 and P4.4 so they cannot disagree.
#
# A run that is IN PROGRESS has an empty conclusion and is not evidence in
# either direction — it is the monitor doing its job. With `--limit 2` an
# in-flight run consumed one of the two slots, the loop skipped it, and the
# pair came out `success/1,missing/0`: a false "monitor red" whenever the
# 6-hour cron happened to overlap a confirm run (observed: run 33931851126,
# where the same helper passed in P4.4 two minutes later). So read a wider
# window and count the two most recent COMPLETED runs; an unfinished run is
# looked past, never counted as missing.
production_smoke_evidence() {
  local json id conclusion created marker age first='' second=''
  json="$(gh run list --repo "$REPO" --workflow=smoke.yml --limit 4 \
    --json databaseId,conclusion,createdAt 2>/dev/null)" || return 1

  local index=0
  while IFS=$'\t' read -r id conclusion created; do
    [[ "$index" -ge 2 ]] && break
    [[ -n "$id" && -n "$conclusion" && -n "$created" ]] || continue
    marker="$(gh run view "$id" --repo "$REPO" --log 2>/dev/null \
      | grep -cF 'ALL PASS (10 checks)' || true)"
    [[ "$marker" -gt 0 ]] && marker=1 || marker=0
    if [[ "$index" -eq 0 ]]; then
      first="$conclusion/$marker"
      age="$(jq -nr --arg created "$created" 'now - ($created | fromdateiso8601) | floor')"
    elif [[ "$index" -eq 1 ]]; then
      second="$conclusion/$marker"
    fi
    index=$((index+1))
  done < <(jq -r '.[] | [.databaseId, .conclusion, .createdAt] | @tsv' <<<"$json")

  printf '%s,%s %ss-ago\n' "${first:-missing/0}" "${second:-missing/0}" "${age:-999999999}"
}

echo "── RE-EXECUTING EXIT ARTIFACTS ─────────────────────────────"
echo "run: $RUN_URL"
echo

MAIN_SHA="$(git rev-parse HEAD)"

# ── P1 · CI green on main and the production monitor back up ────────────────
# An IN-PROGRESS run is not a failed one. `conclusion` is null until a run
# finishes, so the old form printed " <sha>" and the predicate read that as
# NOT-SUCCESS — reporting a red P1 every time a merge to main was still
# building. Three false failures in one session, each self-clearing minutes
# later, each indistinguishable in the log from a real regression.
#
# That is the CANNOT-VERIFY / NOT-TRUE distinction this script already draws
# for branch protection, applied to time instead of permissions: a run that has
# not finished has not told us anything yet. It skips, and a skip is never a
# pass — so an in-progress run can never be mistaken for a green one either.
# P1(1) is "success WITH headSha == git rev-parse origin/main". The predicate
# used to be `[[ "$out" == success* ]]` against a string that carried the sha
# and never read it, so CI green on an OLDER commit countersigned a main that
# had already moved past it — the sha was printed into the COUNTERSIGN block,
# where it looked like proof, having been checked by nothing.
#
# That is verbatim the failure P1(2) records one sub-artifact away: "the facts
# asserted were true and unproved by the command asserting them." It survived
# in the script that exists to enforce it.
#
# So select the run FOR this SHA instead of trusting the newest one to be it.
# `--limit 1` also had a race that could only ever be read as a regression: a
# newer commit landing mid-run returns ITS run, and a mismatched sha would then
# look like a failure rather than "I am confirming a commit that is no longer
# the tip". Selecting by sha makes that case a SKIP, which is what it is.
P11_RUN="$(gh run list --repo $REPO --branch main --workflow=CI --limit 30 \
  --json conclusion,headSha,status \
  --jq "[.[] | select(.headSha == \"$MAIN_SHA\")] | .[0] | select(.) | \"\(.status) \(.conclusion)\"" 2>/dev/null)"
if [[ -z "$P11_RUN" ]]; then
  skip_artifact "P1.1" "CI on main's own SHA" \
    "no CI run found for $MAIN_SHA in the last 30 — CANNOT-VERIFY, not NOT-TRUE"
elif [[ "$P11_RUN" != completed* ]]; then
  skip_artifact "P1.1" "CI on main's own SHA" \
    "the run for $MAIN_SHA is '${P11_RUN%% *}', not completed — CANNOT-VERIFY, not NOT-TRUE"
else
  confirm "P1.1" "CI success on main's own SHA" \
    "gh run list --repo $REPO --branch main --workflow=CI --limit 30 --json conclusion,headSha --jq '[.[] | select(.headSha == \"$MAIN_SHA\")] | .[0] | \"\\(.conclusion) \\(.headSha)\"'" \
    '[[ "$out" == "success $MAIN_SHA" ]]'
fi

# P1(2) tracks the SHAPE of ci.yml. PR #399 grew it on purpose: a test-hygiene
# step in `check` and a browser-smoke `e2e` job (its own install + `pnpm e2e`).
# The counts below say that shape: 8 required commands (3× install across
# check/build/e2e, lint, typecheck, test, check-test-hygiene.mjs, pnpm e2e),
# one `needs: check`, zero continue-on-error.
confirm "P1.2" "ci.yml runs lint+hygiene+typecheck+test, boot smoke after check, browser e2e; no continue-on-error" \
  "git show origin/main:.github/workflows/ci.yml | grep -cE 'pnpm install --frozen-lockfile|pnpm lint|pnpm typecheck|pnpm test|check-test-hygiene\.mjs|pnpm e2e'; git show origin/main:.github/workflows/ci.yml | grep -c 'needs: check'; git show origin/main:.github/workflows/ci.yml | grep -c 'continue-on-error'" \
  '[[ "$(echo "$out" | tr "\n" " ")" == "8 1 0 " ]]'

if [[ "$GH_READY" == "1" ]]; then
  # P1(3) is "both most-recent runs success, THE LATER ONE CREATED AFTER the P1
  # merge commit" — the second clause is what makes it mean "the monitor is back
  # UP" rather than "it was green whenever it last ran".
  #
  # The predicate was `[[ "$out" == "success,success" ]]` over conclusions only.
  # smoke.yml is a `cron: '0 */6 * * *'` workflow: delete that schedule, or let
  # the monitor die any other way, and its last two runs stay green in this list
  # FOREVER. P1.3 would have gone on confirming a dark monitor indefinitely —
  # and P1's own text calls smoke "the estate's ONLY continuous production
  # monitor" and writes a standing MONITOR-DARK rule around it.
  #
  # Same defect as P1.1 above: the artifact carried the evidence and the
  # predicate read past it. So check the age too. 13h is two 6-hour cycles plus
  # slack — one skipped cron does not cry wolf, a stopped monitor is caught
  # inside half a day.
  confirm "P1.3" "smoke.yml — both latest runs executed 10/10 parity and the monitor is still running" \
    "production_smoke_evidence" \
    '[[ "$out" =~ ^success/1,success/1\ ([0-9]+)s-ago$ ]] && (( BASH_REMATCH[1] < 46800 ))'
else
  skip_artifact "P1.3" "smoke.yml, the production monitor" "gh is unavailable or unauthenticated — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── PA · the §1.5 detector runs unattended ──────────────────────────────────
if [[ "$GH_READY" == "1" ]]; then
  confirm "PA.1" "loop-audit.yml on main and its last run green" \
    "git ls-tree origin/main --name-only .github/workflows/loop-audit.yml && gh run list --repo $REPO --workflow=loop-audit.yml --limit 1 --json conclusion --jq '.[0].conclusion'" \
    '[[ "$out" == *"loop-audit.yml"* && "$out" == *success* ]]'

  confirm "PA.2" "a SELF-AUDIT-RUN table posted by github-actions on #206" \
    "gh issue view 206 --repo $REPO --json comments --jq '[.comments[] | select(.author.login==\"github-actions\") | select(.body | startswith(\"## SELF-AUDIT-RUN\"))] | length'" \
    '[[ "$out" =~ ^[0-9]+$ && "$out" -ge 1 ]]'
else
  skip_artifact "PA.1" "loop-audit.yml and its last run" "gh is unavailable or unauthenticated — CANNOT-VERIFY, not NOT-TRUE"
  skip_artifact "PA.2" "the SELF-AUDIT-RUN table on #206" "gh is unavailable or unauthenticated — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── P2b · the merge train, and the three closes ─────────────────────────────
# Both halves assert the END STATE, which is what survives. The written exit also
# names an ORDER (#183 → #180 → #184 → #181 → #194, one at a time, CI green
# between each) and that order was NOT followed: #183/#181/#194 merged within six
# seconds of one another, so no CI run separated them.
#
# The predicate does not assert the order, and that is deliberate rather than
# lenient. Read the cell's own reasoning: the ordering exists because "#180 and
# #184 are both CONFLICTING and both touch pnpm-lock.yaml, so #184 rebases onto
# the post-#180 lockfile". That hazard is about ONE pair, and it is checked below
# — #184 must land after #180. The rest of the sequence carries no stated
# consequence, and asserting a timestamp order nobody can now change would make
# this permanently NOT-DONE for a procedural deviation whose risk did not occur.
# The deviation is recorded in docs/p2b-merge-train.md rather than hidden.
if [[ "$GH_READY" == "1" ]]; then
  # ISO-8601 UTC sorts lexicographically, so the timestamps compare directly.
  confirm "P2b.5" "the five train PRs are MERGED, and #184 landed after #180" \
    "{ for n in 183 180 184 181 194; do gh api repos/$REPO/pulls/\$n --jq '.merged'; done; gh api repos/$REPO/pulls/180 --jq .merged_at; gh api repos/$REPO/pulls/184 --jq .merged_at; } | tr '\n' ' '" \
    '[[ "$out" =~ ^true\ true\ true\ true\ true\ ([0-9TZ:-]+)\ ([0-9TZ:-]+)\ ?$ ]] && [[ "${BASH_REMATCH[1]}" < "${BASH_REMATCH[2]}" ]]'

  # "Closed WITH A COMMENT, not rebased" is the whole of (6): a silent close and a
  # reasoned one look identical in the state field, and three permanently-red PRs
  # were what made "CI green on every open PR" unachievable. So this asserts all
  # three are closed, none merged, and each carries at least one comment.
  confirm "P2b.6" "#29/#9/#8 are closed unmerged, each with a comment explaining why" \
    "for n in 29 9 8; do m=\$(gh api repos/$REPO/pulls/\$n --jq '.merged'); s=\$(gh api repos/$REPO/pulls/\$n --jq '.state'); c=\$(gh api repos/$REPO/issues/\$n/comments --jq 'length'); echo \"\$s/\$m/\$((c>0))\"; done | tr '\n' ' '" \
    '[[ "$out" == "closed/false/1 closed/false/1 closed/false/1 " ]]'
else
  skip_artifact "P2b.5" "the merge train" "gh is unavailable or unauthenticated — CANNOT-VERIFY, not NOT-TRUE"
  skip_artifact "P2b.6" "#29/#9/#8 closed with a comment" "gh is unavailable or unauthenticated — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── P2a · branch protection on both endpoints ───────────────────────────────
if readable "protection_gh api repos/recursivlabs/minds/branches/main/protection" && \
   readable "protection_gh api repos/recursivlabs/recursiv/branches/main/protection"; then
  confirm "P2a.1" "protection on BOTH endpoints: contexts set, force-push and deletion off" \
    "for r in recursivlabs/minds recursivlabs/recursiv; do protection_gh api repos/\$r/branches/main/protection --jq '\"\\(.required_status_checks.contexts|length) \\(.allow_force_pushes.enabled) \\(.allow_deletions.enabled)\"'; done" \
    '[[ "$(echo "$out" | grep -c "^[1-9][0-9]* false false$")" == "2" ]]'
else
  skip_artifact "P2a.1" "branch protection, both endpoints" \
    "this token cannot read the protection API (needs admin scope) — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── PAPI · the public API is usable by a stranger ───────────────────────────
confirm "PAPI.2" "documented endpoint list on main, each line carrying its curl" \
  "git show origin/main:docs/api-endpoints.md | grep -c '^| [0-9]' " \
  '[[ "$out" =~ ^[0-9]+$ && "$out" -ge 100 ]]'

# PAPI.4 is a file-on-main check, NOT a live burst. The evidence it certifies —
# the captured 429 with its Retry-After and its string-shaped body — was produced
# once against staging (recursivlabs/recursiv#2076) and committed. Re-running the
# burst on every confirm would make the second party a load generator against a
# shared environment, on a schedule, forever. So this asserts the artifact still
# says what it said: the demonstrated status line, the Retry-After, and the
# string-vs-object finding that is the whole reason the sub-artifact matters.
confirm "PAPI.4" "error/rate-limit contract on main carries a DEMONSTRATED 429, not an advertised one" \
  "git show origin/main:docs/api-error-contract.md | grep -cE 'HTTP/2 429|retry-after: [0-9]+|\"error\":\"Too many requests\"'" \
  '[[ "$out" =~ ^[0-9]+$ && "$out" -ge 3 ]]'

# ── PMCP · the MCP server works for a stranger ──────────────────────────────
# PMCP(3) asks for a check that calls a DATA tool and fails if it errors while
# the connection reports healthy — green on a named SHA. The detector lives at
# scripts/check-mcp-data-tools.sh; running it IS the sub-artifact, so this block
# runs it rather than asserting it exists. A script that is present and never
# executed is the "spec no step produces" failure §5.6 is named for.
#
# It needs a key. Without one the detector exits 2 (its own SKIP), and that is
# reported as CANNOT-VERIFY rather than NOT-TRUE — the same distinction PS.1 and
# P2a.1 already make, and for the same reason: "I could not look" and "it is
# broken" must never collapse into one verdict on a check that gates CONFIRMED.
if [ -n "${MINDS_KEY:-${MINDS_NETWORK_API_KEY:-}}" ]; then
  confirm "PMCP.3" "the false-green detector RUNS and a data tool returns rows" \
    "bash scripts/check-mcp-data-tools.sh 2>&1 | tail -1" \
    '[[ "$out" == *"row(s) — the server is working"* ]]'
else
  skip_artifact "PMCP.3" "false-green detector" \
    "no MINDS_KEY/MINDS_NETWORK_API_KEY secret — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── P4 · the agent half of staging, merged in #245 ──────────────────────────
# Both are file-on-main checks (§1.3's second class) and need no credentials.
# P4's live staging-org half is checked separately below, so a future credential
# outage cannot hide or falsify these durable artifacts.
confirm "P4.1" "a fifth eas.json profile, staging on its own channel" \
  "git show origin/main:eas.json | python3 -c 'import sys,json; b=json.load(sys.stdin)[\"build\"]; print(len(b), b.get(\"staging\",{}).get(\"channel\"))'" \
  '[[ "$out" == "5 staging" ]]'

confirm "P4.3" ".env.staging committed on main and pointed at the staging origin" \
  "git cat-file -e origin/main:.env.staging && git show origin/main:.env.staging | grep -c 'api.staging.recursiv.io'" \
  '[[ "$out" =~ ^[0-9]+$ && "$out" -ge 1 ]]'

# P4(2) is the live half of the staging binding. The ordinary staging monitor
# already exercises parity with these credentials, but that does not prove the
# org id in the app config resolves to the same row on the staging origin. Run
# the exact lookup again here under the required, independent verifier. The
# helper prints the request URL, HTTP status and both ids, never the credentials
# or the one-use key, and revokes that key before it exits. PR checks exercise
# the helper's unit tests and this predicate's self-tests but deliberately skip
# the live login: only landed artifacts can be countersigned, and every PR push
# consuming the same QA account's 8-attempt/15-minute security budget made the
# independent main witness intermittently fail with an auth throttle.
if [[ "${P42_LIVE_VERIFY:-1}" == "0" ]]; then
  skip_artifact "P4.2" "staging org resolves byte-equal on the staging origin" \
    "live staging proof is main/schedule-only; PR runs test the verifier without consuming QA auth budget"
elif [[ -n "${STAGING_QA_EMAIL:-}" && -n "${STAGING_QA_PASSWORD:-}" && \
      -n "${STAGING_ORG_ID:-}" && -n "${STAGING_PROJECT_ID:-}" ]]; then
  P42_VERIFY_CMD="${P42_VERIFY_CMD:-node scripts/verify-staging-org.mjs}"
  confirm "P4.2" "the app's staging org id resolves byte-equal on the staging origin" \
    "$P42_VERIFY_CMD" \
    '[[ "$rc" -eq 0 && "$out" == *"HTTP 200"* && "$out" == *"configured.id=$STAGING_ORG_ID"* && "$out" == *"response.id=$STAGING_ORG_ID"* && "$out" == *"P4.2 STAGING ORG BINDING PASS"* ]]'
else
  skip_artifact "P4.2" "staging org resolves byte-equal on the staging origin" \
    "staging QA secrets unavailable — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── P4.4 · both monitors green in the same window — and the STAGING one must
# have actually exercised parity. smoke-staging.yml reports success when the
# staging credentials are absent (a permanent red on main taught nobody
# anything — see that file's own comment), so a run conclusion ALONE cannot
# distinguish "parity passed" from "parity never ran". The discriminator is the
# step: `Parity scorecard against staging` is skipped without credentials, so
# this asserts that step COMPLETED inside the run it is certifying.
#
# Without that clause this predicate would certify P4(4) — "staging wired to
# the app" — off a run that only proved a health endpoint answers. That is the
# exact false-green shape the three fidelity fixes of 2026-08-02 removed
# elsewhere in this file, and it would have been introduced by the fix that
# stopped the red.
if [[ "$GH_READY" == "1" ]]; then
  P44_STAGING_RUN="$(gh run list --repo $REPO --workflow=smoke-staging.yml --limit 1 \
    --json databaseId,conclusion,createdAt \
    --jq '.[0] | "\(.databaseId) \(.conclusion) \(now - (.createdAt | fromdateiso8601) | floor)"' 2>/dev/null)"
  if [[ ! "$P44_STAGING_RUN" =~ ^([0-9]+)\ success\ ([0-9]+)$ ]] || \
     (( BASH_REMATCH[2] >= 21600 )); then
    skip_artifact "P4.4" "smoke + smoke-staging both green" \
      "no successful smoke-staging run inside the 6h window (${P44_STAGING_RUN:-none}) — CANNOT-VERIFY, not NOT-TRUE"
  else
    confirm "P4.4" "both monitors ran parity successfully inside the same 6h window" \
      "gh run view ${P44_STAGING_RUN%% *} --repo $REPO --json jobs --jq '[.jobs[].steps[] | select(.name==\"Parity scorecard against staging\") | .conclusion] | join(\",\")'; production_smoke_evidence" \
      '[[ "$(echo "$out" | head -1)" == "success" ]] && prod="$(echo "$out" | tail -1)" && [[ "$prod" =~ ^success/1,.*\ ([0-9]+)s-ago$ ]] && (( BASH_REMATCH[1] < 21600 ))'
  fi
fi

# ── P2c · the §5.6 evidence gate, enforced ──────────────────────────────────
confirm "P2c.1" "evidence-gate.yml on main, demanding a NON-EMPTY unproved section" \
  "git cat-file -e origin/main:.github/workflows/evidence-gate.yml && git show origin/main:.github/workflows/evidence-gate.yml | grep -c 'What remains unproved'" \
  '[[ "$out" =~ ^[0-9]+$ && "$out" -ge 2 ]]'

# P2c(2) is a RE-FETCHABLE RUN — §1.3's third artifact class — not a file. The
# throwaway PR it ran on is closed and its branch deleted, which is correct: the
# artifact was never the PR, it was the run, and a run id stays resolvable after
# the branch is gone. Asserting `failure` is the point: this run is evidence the
# gate REJECTS a non-compliant PR, so a `success` here would mean the negative
# control had stopped negating.
if [[ "$GH_READY" == "1" ]]; then
  confirm "P2c.2" "run 30603990840 — the negative control — still resolves as a FAILURE" \
    "gh run view 30603990840 --repo $REPO --json conclusion,workflowName --jq '\"\(.conclusion) \(.workflowName)\"'" \
    '[[ "$out" == "failure Evidence gate" ]]'
else
  skip_artifact "P2c.2" "run 30603990840, the negative control" "gh is unavailable or unauthenticated — CANNOT-VERIFY, not NOT-TRUE"
fi

# P2c(3) is the repository-local half of P2a: the evidence gate must be in the
# live required contexts, not merely present as a workflow file. The REST
# branch-protection endpoint requires repository-administration permission, but
# GraphQL provides a narrower, read-only branchProtectionRules projection, but
# PR run 31423469093 proved GitHub withholds it from the ordinary repository
# token. When ADMIN_GH_TOKEN is provisioned, the required second party can
# re-fetch only the contexts it needs; until then this skips rather than
# manufacturing a regression.
P2C3_CMD="protection_gh api graphql -f query='query { repository(owner: \"recursivlabs\", name: \"minds\") { branchProtectionRules(first: 100) { nodes { pattern requiredStatusCheckContexts } } } }' --jq '.data.repository.branchProtectionRules.nodes[] | select(.pattern == \"main\") | .requiredStatusCheckContexts | join(\" \")'"
if [[ "$GH_READY" == "1" ]] && readable "$P2C3_CMD"; then
  confirm "P2c.3" "evidence is a required status-check context on main" \
    "$P2C3_CMD" \
    '[[ " $out " == *" evidence "* ]]'
else
  skip_artifact "P2c.3" "evidence required on main" \
    "this token cannot read branchProtectionRules — CANNOT-VERIFY, not NOT-TRUE"
fi

# ── PW(2) · the deploy actually reached the origin ──────────────────────────
# This is the check whose absence cost days. Production served commit 6486972
# from 2026-07-29 to 2026-07-31 while the platform reported every deployment
# `completed`; 197 of them had failed in Coolify. Nothing compared what was
# CLAIMED to what was SERVED, so the lie survived every green dashboard.
#
# Three assertions, because a bare 200 proves almost nothing:
#   · the origin answers 200
#   · it references an Expo bundle — a parked page, a Traefik 503 body and a
#     redirect stub all return bytes, and one of those is what a half-finished
#     deploy looks like (§5.20)
#   · the bundle is NOT index-07628618…, the frozen build. That is the
#     regression guard: if production ever reverts to it, this goes red.
#
# WHAT IT CANNOT DO, said plainly: it proves production serves *an* app that is
# not *the stale one*. It does not prove production serves origin/main. Binding
# a served page to a commit needs something the HTML carries, and the <meta>
# marker committed for exactly this failed — Expo's web export strips
# unrecognised meta tags (see PW(2) on #217). Until a build stamps its own SHA
# into something served, "not the known-frozen build" is the strongest honest
# claim available without a Coolify token in CI.
PW_ORIGIN="${PW_ORIGIN:-https://minds.on.recursiv.io}"
PW_STALE="index-07628618e137db722807402c1c649219"
if [[ "${CONFIRM_SELFTEST_SKIP_NETWORK:-0}" == "1" ]]; then
  skip_artifact "PW.2" "production serves an Expo build, and NOT the frozen 6486972 bundle" \
    "non-network self-test case — baseline and HTTP fidelity cases still execute this live predicate"
else
  confirm "PW.2" "production serves an Expo build, and NOT the frozen 6486972 bundle" \
    "curl -s -o /tmp/pw2.html -w '%{http_code} ' --max-time 30 $PW_ORIGIN/ ; grep -oE 'index-[a-f0-9]{32}' /tmp/pw2.html | head -1" \
    '[[ "$out" == "200 index-"* && "$out" != *"'"$PW_STALE"'"* ]]'
fi

# ── PW(3) · the rollback drill — a state machine, because a drill is a point-
# in-time event and this predicate has three honest lives. Before the window
# (armed, live still serving the candidate) it is CANNOT-VERIFY, not NOT-TRUE —
# an armed drill that has not begun must never read as a regression. During the
# window it re-executes the pair itself: previous string present, candidate
# absent, which is the only shape that discriminates a rollback from a page
# that never changed. After PR B commits the evidence (complete) it asserts the
# committed artifact still carries what the verifying run executed — the PAPI.4
# form, for the same reason: re-running a production rollback on every confirm
# would make the second party a deploy driver on a schedule, forever.
# PW3_REF is overridable for the same reason PW_ORIGIN is: the selftest builds
# fixture commits with git plumbing and drives the REAL read path against them.
# Production (CI) never sets it, so the evidence source stays origin/main.
PW3_DOC="docs/pw3-rollback-drill.md"
PW3_REF="${PW3_REF:-origin/main}"
if ! git cat-file -e "$PW3_REF:$PW3_DOC" 2>/dev/null; then
  skip_artifact "PW.3" "rollback drill" \
    "$PW3_DOC not on $PW3_REF — drill not staged, CANNOT-VERIFY not NOT-TRUE"
else
  PW3_SRC="$(git show "$PW3_REF:$PW3_DOC")"
  PW3_STATE="$(sed -n 's/^state: //p' <<<"$PW3_SRC" | head -1)"
  PW3_PREV="$(sed -n 's/^previous-string: //p' <<<"$PW3_SRC" | head -1)"
  PW3_CAND="$(sed -n 's/^candidate-string: //p' <<<"$PW3_SRC" | head -1)"
  case "$PW3_STATE" in
    armed)
      pw3_live="$(curl -s --max-time 30 "$PW_ORIGIN/")"
      if grep -q "$PW3_CAND" <<<"$pw3_live" && ! grep -q "$PW3_PREV" <<<"$pw3_live"; then
        skip_artifact "PW.3" "rollback drill (armed)" \
          "window not open — live still serves the candidate $PW3_CAND; the drill has not begun"
      else
        confirm "PW.3" "mid-window: production serves the PREVIOUS build and not the candidate" \
          "h=\$(curl -s --max-time 30 $PW_ORIGIN/); echo \"prev=\$(grep -c $PW3_PREV <<<\"\$h\") cand=\$(grep -c $PW3_CAND <<<\"\$h\")\"" \
          '[[ "$out" =~ prev=[1-9] && "$out" =~ cand=0$ ]]'
      fi
      ;;
    complete)
      confirm "PW.3" "drill evidence on main: the verifying run id and the pair as executed" \
        "git show $PW3_REF:$PW3_DOC | grep -cE 'verify-run: [0-9]+|mid-window-prev: [1-9]|mid-window-cand: 0'" \
        '[[ "$out" == "3" ]]'
      ;;
    *)
      skip_artifact "PW.3" "rollback drill" \
        "unrecognised state '$PW3_STATE' in $PW3_DOC — fix the doc, this is not a verdict"
      ;;
  esac
fi

# ── PW · the web release path, written down ─────────────────────────────────
# PW(1) asks for the host and the deploy trigger NAMED IN WRITING. The check is
# not "a file exists" — it is that the file still names the mechanism. A doc that
# lost its answer in an edit would pass a bare existence test.
# AND, not OR. `grep -cE 'coolify|<project-id>'` counts lines matching EITHER,
# so a `-ge 2` passed on a file that named Coolify twice and the project id
# never — the id being the half that makes the doc actionable. Demonstrated:
# a two-line file containing only "coolify\ncoolify" satisfied the old
# predicate. Count the two terms separately and require both.
# (Also case-insensitive on Coolify: the doc writes it capitalised in prose,
# and the old pattern was case-sensitive, so it was already reading fewer
# lines than it appeared to.)
confirm "PW.1" "web-deploy-path.md on main, naming BOTH Coolify and the project id" \
  "git cat-file -e origin/main:docs/web-deploy-path.md && git show origin/main:docs/web-deploy-path.md | grep -ci 'coolify'; git show origin/main:docs/web-deploy-path.md | grep -c '019d5190-f0c0-717e-a1bd-ef9c335292b9'" \
  '[[ "$(echo "$out" | tr "\n" " ")" =~ ^([0-9]+)\ ([0-9]+)\ $ ]] && (( BASH_REMATCH[1] >= 1 && BASH_REMATCH[2] >= 1 ))'

# ── PS(2) · the deployed inversion, which needs NO engine checkout ──────────
# PS's defect was that these two routes answered 403 no_scopes — "your key lacks
# the scope" — to a caller carrying NO key at all. 401 is the correct answer and
# the inversion is the whole row. This runs against the live origin, so it is the
# one PS sub-artifact CI can witness without a token, and it re-checks the thing
# a revert would silently undo.
#
# Both conditions are asserted together: the deployed commit is READ from /health
# in the same run, so the status codes are attributable to a SHA rather than to
# "production, at some point". §1.3's machine-timestamp-pair clause in spirit —
# an unattributed 401 proves nothing about the code that produced it.
PS2_ORIGIN="${PS_ORIGIN:-https://api.recursiv.io}"
if [[ "${CONFIRM_SELFTEST_SKIP_NETWORK:-0}" == "1" ]]; then
  skip_artifact "PS.2" "deployed /signals and /moderation answer 401 missing_api_key, not 403" \
    "non-network self-test case — baseline and HTTP fidelity cases still execute this live predicate"
else
  confirm "PS.2" "deployed /signals and /moderation answer 401 missing_api_key, not 403" \
    "for p in /api/v1/signals/post /api/v1/moderation/actions; do curl -s -o /dev/null -w '%{http_code} ' -m 20 -X POST -H 'Content-Type: application/json' -d '{}' \"$PS2_ORIGIN\$p\"; done; curl -s -m 20 $PS2_ORIGIN/health | sed -n 's/.*\"commit\":\"\\([0-9a-f]*\\)\".*/commit=\\1/p'" \
    '[[ "$out" == "401 401 "*commit=* ]]'
fi

# ── PS · engine-side, needs the engine checkout ─────────────────────────────
# The gate used to be "$ENGINE_DIR is A git repo". It never asked whether it is
# the RIGHT one, so pointing ENGINE at any checkout — this repo included —
# produced THREE ❌: three claimed regressions in the engine when the truth was
# "I looked in the wrong place." Measured, with ENGINE set to minds:
#
#     ❌ PS.1   ❌ PS.4   ❌ PS.3      confirmed 14 · failed 3 · skipped 2
#
# That is the CANNOT-VERIFY / NOT-TRUE conflation this whole script is built to
# avoid, and §2's PS(1) cell is a standing warning about this exact trap: run
# from the wrong repo the grep prints `0` on stdout — byte-identical to an
# honest not-done — with the fatal only on stderr. PS.4 is worse still: it has
# no existence guard at all, so a missing file and a file with zero matches are
# the same string.
#
# `packages/server` identifies the engine and is not PS's artifact, so a real
# engine whose PS work has been reverted still FAILS (correctly) rather than
# skipping. Probing PS.1's own file here would have hidden a genuine regression
# behind a skip.
ENGINE_IS_ENGINE=0
if [ -n "$ENGINE_DIR" ] && [ -d "$ENGINE_DIR/.git" ]; then
  git -C "$ENGINE_DIR" cat-file -e origin/main:packages/server 2>/dev/null && ENGINE_IS_ENGINE=1
fi
if [ -n "$ENGINE_DIR" ] && [ -d "$ENGINE_DIR/.git" ] && [ "$ENGINE_IS_ENGINE" = "0" ]; then
  for id in PS.1 PS.4 PS.3 P4.5; do
    skip_artifact "$id" "engine-side check" \
      "ENGINE=$ENGINE_DIR has no origin/main:packages/server — that is not the engine, CANNOT-VERIFY not NOT-TRUE"
  done
elif [ "$ENGINE_IS_ENGINE" = "1" ]; then
  confirm "PS.1" "apiKeyAuth mounted on /signals/* and /moderation/*" \
    "git -C $ENGINE_DIR cat-file -e origin/main:packages/server/src/features/api-keys/rest/index.ts && git -C $ENGINE_DIR show origin/main:packages/server/src/features/api-keys/rest/index.ts | grep -cE \"api\\.use\\('/(signals|moderation)/\\*'\"" \
    '[[ "$out" == "2" ]]'
  confirm "PS.4" "engine CLAUDE.md stops telling the worker to close its own task" \
    "git -C $ENGINE_DIR show origin/main:CLAUDE.md | grep -c release_task" \
    '[[ "$out" =~ ^[0-9]+$ && "$out" -ge 1 ]]'
  # PS(3) asks for the regression test RED on the pre-fix SHA and green after.
  # Only the green half is re-executable here: the red half is a statement about
  # 5230cec0, a commit this run does not build, and re-running it every time
  # would be theatre. The red demonstration is recorded once, on the row, with
  # its output. What CI is good for is the standing half — the test still exists
  # and still passes — because that is what silently rots.
  confirm "PS.3" "the route-coverage regression test is on main (green half of the pair)" \
    "git -C $ENGINE_DIR ls-tree origin/main --name-only -r | grep -c 'api-keys/__tests__/rest-auth-coverage.test.ts'" \
    '[[ "$out" == "1" ]]'

  # ── P4.5 · staging data provenance, re-executed rather than read ───────────
  # The cell's own exit is a COMPARISON with both sides printed, never a bare
  # zero: an empty (a) is what a renamed script or a wrong ref returns, and an
  # empty (b) is what a wrong database returns, and either yields "nothing
  # uncovered" while proving nothing.
  #
  # So the assertion is a TRIPLE — a positive schema table count, zero uncovered
  # AND zero stale. `144 0 0` passes; `0 0 0` does not, which is the point. The
  # reproducer aborts (exit 2) if either side parses empty, so a silent-empty run
  # cannot reach the awk at all.
  #
  # Stale is load-bearing, not decoration. A named column that no longer exists
  # in the schema contributes ZERO to the uncovered count, so a wholesale rename
  # would report "0 uncovered" while comparing nothing at all — a green built out
  # of an empty list. Asserting stale=0 is what stops this predicate from
  # becoming the very false pass the cell was written to reject.
  #
  # (b) does NOT use the run_sql_query the P4(5) cell prescribes: that tool is
  # project-scoped and cannot reach the control-plane tables the sanitizer
  # targets, so run as written it returns zero rows for `user`/`api_key` and
  # manufactures this cell's own false pass. docs/p4-staging-data-provenance.md
  # records the substitution and the proof. Source is the schema the sanitizer's
  # own header names as authority, at a named ref, re-fetchable with git show.
  confirm "P4.5" "sanitizer covers every credential/PII column in the engine schema" \
    "P45S=\$(mktemp) && P45Q=\$(mktemp) && git -C $ENGINE_DIR show origin/main:packages/server/src/db/schema.ts > \$P45S && git -C $ENGINE_DIR show origin/main:scripts/sanitize-staging-data.sql > \$P45Q && node scripts/p4-sanitizer-coverage.js \$P45S \$P45Q | awk '/^schema:/{t=\$2} /^TOTAL UNCOVERED:/{u=\$3} /^STALE TOTAL:/{s=\$3} END{print t\" \"u\" \"s}'" \
    '[[ "$out" =~ ^[1-9][0-9]*\ 0\ 0$ ]]'
else
  skip_artifact "PS.1" "apiKeyAuth mounts" "no engine checkout — set ENGINE_REPO_TOKEN"
  skip_artifact "PS.4" "engine CLAUDE.md" "no engine checkout — set ENGINE_REPO_TOKEN"
  skip_artifact "PS.3" "route-coverage regression test" "no engine checkout — set ENGINE_REPO_TOKEN"

  # A private source checkout is the strongest route and remains above. The
  # no-secret fallback reads the same source-level check from the deployed API
  # image: its Docker build fails on a coverage gap and bakes the paired result
  # into /health beside the image's own commit. Positive table/column counts and
  # both zeroes are all required; `status: ok` alone is not evidence.
  P45_HEALTH_ORIGIN="${P45_HEALTH_ORIGIN:-https://api.recursiv.io}"
  P45_HEALTH_CMD="${P45_HEALTH_CMD:-curl -fsS --max-time 30 $P45_HEALTH_ORIGIN/health}"
  confirm "P4.5" "deployed build proves sanitizer coverage for its schema" \
    "$P45_HEALTH_CMD | jq -r '[.commit, .stagingSanitizer.status, .stagingSanitizer.schemaTables, .stagingSanitizer.schemaColumns, .stagingSanitizer.uncoveredColumns, .stagingSanitizer.staleColumns] | @tsv'" \
    '[[ "$out" =~ ^[0-9a-f]{40}[[:space:]]ok[[:space:]][1-9][0-9]*[[:space:]][1-9][0-9]*[[:space:]]0[[:space:]]0$ ]]'
fi

# ── Explicitly NOT machine-confirmable — §5.47's ~20 ────────────────────────
echo
echo "── HUMAN-ONLY BY RULE, never confirmed here (§5.47) ────────"
cat <<'EOF'
  P11 (all 8)  the launch-gate sitting — a person must watch it
  P13(1)(2)    a stranger installing from the public listings
  P3(2) P3b(1) device boot recordings bound to a build id in frame
  P5(4a)       the OTA channel demonstration
  P12(1..5)    store submissions — §1.7 HUMAN-ONLY
  #190(1..3)   network captures binding conversation_id to the visible thread
  P0(1..3)     credential rotation — §1.7 HUMAN-ONLY
  P9(1..15)    money. §5.47 keeps a human on every line.
EOF

echo
echo "confirmed $pass · failed $fail · skipped $skip"

if [ "${POST:-0}" = "1" ] && [ -n "$CONFIRMED_BLOCKS" ]; then
  {
    echo "## CI second party — $pass sub-artifact(s) re-executed and confirmed"
    echo
    echo "Every block below is the sub-artifact's **own** exit command, run inside \`$RUN_URL\`, with the output this run produced. §1.0's condition (a): a restatement is not a confirmation."
    echo
    echo "$CONFIRMED_BLOCKS"
    echo "**Conditions on this comment counting as a §1.3 second party (§1.0), both required:**"
    echo "**(a)** each block above re-executes the command in-run with the \`run_id\` present — satisfied by construction."
    echo "**(b)** the posting workflow is a **required check** under P2a, so the loop cannot disable its own witness — verify independently:"
    echo '```'
    echo "$P2C3_CMD"
    eval "$P2C3_CMD" 2>&1
    echo '```'
    echo
    echo "_Skipped: $skip. Failed: $fail. A skip is never a pass. The media class and every money-, store-, credential- or moderation-adjacent sub-artifact stay with a human by rule (§5.47) and are listed in the run log._"
  } > /tmp/countersign.md
  gh issue comment 206 --repo "$REPO" --body-file /tmp/countersign.md
fi

# EXIT CODE — deliberately 0 even when a sub-artifact fails, and the reasoning
# matters because the obvious choice is wrong. This workflow is a REQUIRED check
# (§1.0 condition (b)). If a regressed artifact failed the check, then the day
# smoke.yml goes red every PR in the repo is blocked — INCLUDING the PR that
# fixes it. A production regression would become a repo-wide merge freeze.
#
# §1.8 says a gate failure is first-class and must be VISIBLE in the distance
# metric; it does not say it should stop all work. So a regression is reported
# in the run log, posted to the loop log, and left for §1.5's phantom-progress
# row to reopen the row — while merges keep flowing.
#
# A non-zero exit is reserved for this script itself malfunctioning, which is
# what a required check should actually protect against: the witness being
# broken, not the world being broken.
if [ "$fail" -gt 0 ]; then
  echo "::warning::$fail sub-artifact(s) FAILED re-execution — reported, not merge-blocking. §1.8 applies: the row is reopened, the counter moves down."
fi
exit 0
