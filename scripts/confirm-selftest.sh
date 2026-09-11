#!/usr/bin/env bash
# confirm-selftest.sh — does confirm-artifacts.sh actually check what it claims?
#
# WHY THIS EXISTS. `confirm-artifacts.sh` is the CI second party: it decides what
# CONFIRMED counts, and CONFIRMED is the number the whole controller steers by.
# Nothing checked it. Over one session it produced five defects of a single
# shape — a check that cannot tell "I could not look" from "the thing is broken":
#
#   · P1.1 read an IN-PROGRESS run as a failed one, reporting the production
#     gate red three times on a healthy repo (#260)
#   · P1.3, PA.1, PA.2, P2c.2 read gh being unauthenticated as four regressions,
#     one of which (P1.3) carries a §2 rule that outranks every ladder row (#261)
#
# Both were found by hand, minutes apart, by poking at it. That is not a method.
#
# THE TWO PROPERTIES IT HOLDS, and they point in opposite directions:
#
#   SAFETY  — no check reports ✅ when its evidence is ABSENT. A false pass
#             inflates CONFIRMED, which is the one number nobody re-derives.
#   HONESTY — no check reports ❌ when its evidence is merely UNREADABLE. A
#             false failure sends an agent chasing an outage that is not there,
#             and §1.8 makes that expensive by design.
#
# A script satisfying only SAFETY can fail everything; only HONESTY can pass
# everything. Both together say: absent evidence produces a SKIP, and a skip is
# never a pass.
#
# WHAT IT CANNOT DO. It degrades the ENVIRONMENT (no gh, no engine checkout, no
# network), not the ARTIFACTS. It proves the script behaves when it cannot look;
# it does NOT prove each predicate is correct when it can — that a green P4.1 is
# green for the right reason. Corrupting real artifacts to test that would mean
# pushing bad commits to main. gate-selftest.sh CAN do it because the controller
# is one file that can be copied and mangled; this script reads live git, gh and
# HTTP state, and there is no copy of those to mangle.
#
# Usage:  bash scripts/confirm-selftest.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HERE/confirm-artifacts.sh"
WORKFLOW="$HERE/../.github/workflows/confirm.yml"
[[ -r "$TARGET" ]] || { echo "FATAL: cannot read $TARGET" >&2; exit 2; }
[[ -r "$WORKFLOW" ]] || { echo "FATAL: cannot read $WORKFLOW" >&2; exit 2; }

fails=0; ran=0
ok()   { printf '  ok    %-30s %s\n' "$1" "$2"; }
bad()  { printf '  FAIL  %-30s %s\n' "$1" "$2"; fails=$((fails+1)); }

# run_degraded <name> <env-prefix...> -- captures output with the environment
# broken in some specific way. ENGINE is passed through so engine-backed checks
# behave as they do in a developer run.
counts() {  # <output> -> "confirmed failed skipped"
  sed -n 's/^confirmed \([0-9]*\) · failed \([0-9]*\) · skipped \([0-9]*\)$/\1 \2 \3/p' <<<"$1" | tail -1
}

echo "── CONFIRM SELF-TEST ────────────────────────────────────────────────"
echo "target: $TARGET"
echo

# ── Case 0: the verifier can read the artifacts it claims to re-fetch. ──────
# P2b.5 and P2b.6 use the pulls API. GitHub's default token returns 403 unless
# `pull-requests: read` is explicit once the workflow declares permissions.
# That failure used to present as three artifact regressions even though the
# PR state was readable by every human and unchanged.
ran=$((ran+1))
pull_read_count="$(sed -n '/^permissions:/,/^[^ ]/p' "$WORKFLOW" | grep -c '^  pull-requests: read$')"
if [[ "$pull_read_count" -eq 1 ]]; then
  ok "permissions: PR evidence readable" "pull-requests: read is explicit"
else
  bad "permissions: PR evidence readable" "expected one pull-requests: read entry, found $pull_read_count"
fi

# ── Case 1: the baseline. Needed so the degraded cases mean something. ───────
ran=$((ran+1))
base_out="$(ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
read -r b_conf b_fail b_skip <<<"$(counts "$base_out")"
if [[ -z "${b_conf:-}" ]]; then
  bad "baseline" "could not parse the summary line — every case below is meaningless"
else
  ok "baseline" "confirmed $b_conf · failed $b_fail · skipped $b_skip"
fi

# Only the baseline above may consult live GitHub. Every later case supplies the
# evidence it is testing explicitly; an unrelated live GitHub read would add
# latency and could make the fixture's verdict depend on network state. The
# stub therefore fails closed for every unstubbed command while offline mode is
# active. Loopback HTTP fidelity cases still use real curl below.
STUB_DIR="$(mktemp -d)"
trap 'rm -rf "$STUB_DIR"' EXIT
cat > "$STUB_DIR/gh" <<'STUB'
#!/usr/bin/env bash
if [[ -n "${FAKE_TOKEN_SPLIT:-}" && "$*" == "auth status" ]]; then
  [[ "${GH_TOKEN:-}" == ordinary ]]
  exit
fi
if [[ "$*" == "auth status" ]] \
&& [[ -n "${FAKE_CI:-}${FAKE_SMOKE:-}${FAKE_STAGING_SMOKE:-}${FAKE_CLASSIC_PROTECTION:-}${FAKE_PROTECTION:-}" ]]; then
  exit 0
fi
if [[ -n "${FAKE_CI:-}" && "$*" == *"--workflow=CI"* ]] \
|| [[ -n "${FAKE_SMOKE:-}" && "$*" == *"--workflow=smoke.yml"* ]]; then
  if [[ -n "${FAKE_TOKEN_SPLIT:-}" && "${GH_TOKEN:-}" != ordinary ]]; then exit 97; fi
  src="$FAKE_CI"; [[ "$*" == *"smoke.yml"* ]] && src="$FAKE_SMOKE"
  # Honor --limit the way real gh does: a window narrower than the fixture must
  # actually narrow what the target sees, or a windowing defect in the target
  # (P1.3's in-flight race) sails through the stub that exists to catch it.
  filter="."; lim=""; prev=""
  for a in "$@"; do
    [[ "$prev" == "--jq" ]] && filter="$a"
    [[ "$prev" == "--limit" ]] && lim="$a"
    prev="$a"
  done
  [[ -n "$lim" ]] && src="$(jq --argjson n "$lim" '.[:$n]' <<<"$src")"
  jq -r "$filter" <<<"$src"
  exit 0
fi
if [[ -n "${FAKE_SMOKE:-}" && "$1 $2" == "run view" && "$*" == *"--log"* ]]; then
  if [[ "${FAKE_SMOKE_PARITY:-pass}" == "skip" ]]; then
    echo 'PARITY SKIPPED (billing): HTTP 402'
  else
    echo 'ALL PASS (10 checks)'
  fi
  exit 0
fi
if [[ -n "${FAKE_STAGING_SMOKE:-}" && "$*" == *"--workflow=smoke-staging.yml"* ]]; then
  filter="."; prev=""
  for a in "$@"; do [[ "$prev" == "--jq" ]] && filter="$a"; prev="$a"; done
  jq -r "$filter" <<<"$FAKE_STAGING_SMOKE"
  exit 0
fi
if [[ -n "${FAKE_STAGING_JOBS:-}" && "$1 $2" == "run view" && "$*" == *"--json jobs"* ]]; then
  filter="."; prev=""
  for a in "$@"; do [[ "$prev" == "--jq" ]] && filter="$a"; prev="$a"; done
  jq -r "$filter" <<<"$FAKE_STAGING_JOBS"
  exit 0
fi
if [[ -n "${FAKE_CLASSIC_PROTECTION:-}" && "$*" == *"branches/main/protection"* ]]; then
  if [[ -n "${FAKE_TOKEN_SPLIT:-}" && "${GH_TOKEN:-}" != admin ]]; then exit 98; fi
  if [[ "$*" == *"--jq"* ]]; then printf '%s\n' "$FAKE_CLASSIC_PROTECTION"; fi
  exit 0
fi
if [[ -n "${FAKE_PROTECTION:-}" && "$*" == *"api graphql"* ]]; then
  if [[ -n "${FAKE_TOKEN_SPLIT:-}" && "${GH_TOKEN:-}" != admin ]]; then exit 99; fi
  filter="."; prev=""
  for a in "$@"; do [[ "$prev" == "--jq" ]] && filter="$a"; prev="$a"; done
  jq -r "$filter" <<<"$FAKE_PROTECTION"
  exit 0
fi
if [[ "${CONFIRM_SELFTEST_OFFLINE_GH:-0}" == "1" ]]; then exit 86; fi
exec "$REAL_GH" "$@"
STUB
chmod +x "$STUB_DIR/gh"
REAL_GH="$(command -v gh || true)"
export REAL_GH CONFIRM_SELFTEST_OFFLINE_GH=1
export PATH="$STUB_DIR:$PATH"

ran=$((ran+1))
offline_rc=0
gh api user >/dev/null 2>&1 || offline_rc=$?
if [[ "$offline_rc" -eq 86 ]]; then
  ok "offline gh fails closed" "an unstubbed command was rejected locally"
else
  bad "offline gh fails closed" "expected exit 86, got $offline_rc"
fi

# The speed path is deliberately fail-closed: it is only for cases that mangle
# non-network evidence. The baseline above and the loopback HTTP fidelity cases
# below still execute PW.2 and PS.2. A skipped live predicate must remain a
# visible ⏭ and must never be counted or printed as a ✅.
ran=$((ran+1))
fast_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
fast_bad=""
for id in PW.2 PS.2; do
  grep -qE "⏭ +${id//./\\.} .*SKIP: non-network self-test case" <<<"$fast_out" \
    || fast_bad+="$id-not-skipped "
  grep -qE "✅ +${id//./\\.} " <<<"$fast_out" && fast_bad+="$id-confirmed "
done
if [[ -n "$fast_bad" ]]; then
  bad "self-test network fast path" "fail-closed contract broken: $fast_bad"
else
  ok "self-test network fast path" "PW.2 and PS.2 visibly skipped, never confirmed"
fi

# ── Case 2: SAFETY. gh gone — nothing that needs gh may report ✅. ───────────
# Checked by NAME, not by count: a drop in `confirmed` could equally come from a
# check that started failing, which is the opposite defect.
ran=$((ran+1))
nogh_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 GH_CONFIG_DIR=/nonexistent GH_TOKEN= GITHUB_TOKEN= ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
leaked=""
for id in P1.1 P1.3 PA.1 PA.2 P2c.2 P2c.3; do
  grep -qE "✅ +${id//./\\.} " <<<"$nogh_out" && leaked+="$id "
done
if [[ -n "$leaked" ]]; then
  bad "safety: no ✅ without gh" "these passed with gh unavailable: $leaked"
else
  ok "safety: no ✅ without gh" "every gh-backed check declined to confirm"
fi

# ── Case 3: HONESTY. gh gone — those checks must SKIP, not FAIL. ─────────────
# This is the property that was violated until #261, and the one a naive
# "does it go red?" test would have called healthy.
ran=$((ran+1))
gh_failed=""
for id in P1.1 P1.3 PA.1 PA.2 P2c.2 P2c.3; do
  grep -qE "❌ +${id//./\\.} " <<<"$nogh_out" && gh_failed+="$id "
done
if [[ -n "$gh_failed" ]]; then
  bad "honesty: no ❌ without gh" "these gh-backed checks reported regressions while unreadable: $gh_failed"
else
  ok "honesty: no ❌ without gh" "unreadable gh evidence produced skips, not regressions"
fi

# ── Case 4: SAFETY, engine half. No engine checkout — PS/P4 must not pass. ───
ran=$((ran+1))
noeng_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE= bash "$TARGET" 2>&1)"
eleaked=""
for id in PS.1 PS.3 PS.4; do
  grep -qE "✅ +${id//./\\.} " <<<"$noeng_out" && eleaked+="$id "
done
if [[ -n "$eleaked" ]]; then
  bad "safety: no ✅ without engine" "these passed with no engine checkout: $eleaked"
else
  ok "safety: no ✅ without engine" "engine-backed checks declined to confirm"
fi

# ── Case 4b: HONESTY, engine half. The WRONG repo is not a regression. ───────
# Case 4 covers "no engine at all". This covers the trap §2's PS(1) cell is a
# standing warning about: a valid git checkout that is not the engine. The gate
# used to ask only "is $ENGINE_DIR a git repo", so ENGINE=<this repo> produced
# three ❌ — three claimed engine regressions from looking in the wrong place.
# On stdout a wrong-repo grep prints `0`, byte-identical to an honest not-done.
ran=$((ran+1))
wrongrepo_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE="$(cd "$HERE/.." && pwd)" bash "$TARGET" 2>&1)"
wr_bad=""
for id in PS.1 PS.3 PS.4; do
  grep -qE "(❌|✅) +${id//./\\.} " <<<"$wrongrepo_out" && wr_bad+="$id "
done
if [[ -n "$wr_bad" ]]; then
  bad "honesty: wrong engine repo skips" "these reported a verdict from the wrong repo: $wr_bad"
else
  ok "honesty: wrong engine repo skips" "a checkout that is not the engine produced skips, not regressions"
fi

# ── Case 5: the summary must be internally consistent. ───────────────────────
# A miscounted total is how a false CONFIRMED would reach #206 wearing a
# plausible number, and the totals are what a human actually reads.
ran=$((ran+1))
marks=$(grep -cE '^  (✅|❌|⏭)' <<<"$base_out")
sum=$(( ${b_conf:-0} + ${b_fail:-0} + ${b_skip:-0} ))
if [[ "$marks" -eq "$sum" ]]; then
  ok "summary is consistent" "$marks marks == $b_conf+$b_fail+$b_skip"
else
  bad "summary is consistent" "$marks printed marks but the summary sums to $sum"
fi

# ── Cases 7-9: FIDELITY. Does a predicate READ the evidence it fetches? ──────
#
# This file used to say this class was untestable: "it does NOT prove each
# predicate is correct when it can [look] … Corrupting real artifacts to test
# that would mean pushing bad commits to main … there is no copy of those to
# mangle."
#
# There is now. A stub `gh` on PATH serves whatever run list we want, so the
# ARTIFACT can be made wrong-but-plausible without touching main or the network.
# That is the difference between the environment being broken (Cases 2-4) and
# the evidence being FALSE, and it is the gap three real defects lived in:
#
#   · P1.1 tested `[[ "$out" == success* ]]` over a string carrying the sha,
#     so CI green on an OLDER commit countersigned a moved main   (#334)
#   · P1.3 tested conclusions only, so a smoke.yml whose cron had been deleted
#     kept two stale greens and countersigned a DARK monitor forever  (#335)
#
# Both were true-but-unproved: the command fetched the evidence and the
# predicate read past it. SAFETY and HONESTY are both satisfied by a predicate
# that ignores its evidence entirely — only this catches that.

# fidelity <name> <id> <env assignment> — the artifact is FALSE, so <id> must
# not print ✅. A skip is an acceptable outcome; a confirm is not.
fidelity() {
  local name="$1" id="$2"; shift 2
  ran=$((ran+1))
  if [[ -z "$REAL_GH" ]]; then
    ok "$name" "gh absent — cannot stub what is not there (not a pass)"
    return
  fi
  local out
  out="$(env "$@" CONFIRM_SELFTEST_SKIP_NETWORK=1 REAL_GH="$REAL_GH" PATH="$STUB_DIR:$PATH" \
        ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
  if grep -qE "✅ +${id//./\\.} " <<<"$out"; then
    bad "$name" "$id confirmed against evidence that does not meet its exit"
  else
    ok "$name" "$id declined to confirm"
  fi
}

MAIN_SHA_NOW="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
fidelity "fidelity: P1.1 rejects a stale SHA" "P1.1" \
  "FAKE_CI=[{\"conclusion\":\"success\",\"headSha\":\"deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\",\"status\":\"completed\"}]"

fidelity "fidelity: P1.1 rejects a red run" "P1.1" \
  "FAKE_CI=[{\"conclusion\":\"failure\",\"headSha\":\"$MAIN_SHA_NOW\",\"status\":\"completed\"}]"

# Two greens, but the most recent is 30 days old: exactly what a smoke.yml with
# its cron removed looks like forever after.
STALE_A="$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo 2000-01-01T00:00:00Z)"
STALE_B="$(date -u -d '31 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo 2000-01-01T00:00:00Z)"
fidelity "fidelity: P1.3 rejects a dark monitor" "P1.3" \
  "FAKE_SMOKE=[{\"conclusion\":\"success\",\"createdAt\":\"$STALE_A\"},{\"conclusion\":\"success\",\"createdAt\":\"$STALE_B\"}]"

# Two fresh green workflow conclusions whose parity step exited 0 after a
# billing skip. This is the exact production false-green from run 32815371813:
# the monitor looked healthy while executing none of its ten checks.
FRESH_A="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
FRESH_B="$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$FRESH_A")"
fidelity "fidelity: P1.3 rejects a parity billing skip" "P1.3" \
  "FAKE_SMOKE=[{\"databaseId\":101,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_A\"},{\"databaseId\":100,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_B\"}]" \
  "FAKE_SMOKE_PARITY=skip"

# A run that is IN PROGRESS has an empty conclusion and is the monitor doing
# its job, not evidence against it. With `--limit 2` an in-flight run consumed
# one of the two slots and P1.3 printed `success/1,missing/0` — a false
# "monitor red" whenever the 6-hour cron overlapped a confirm run (production
# run 33931851126, where the same helper passed in P4.4 two minutes later).
# Both directions: two completed greens behind an unfinished head run confirm;
# a single completed green behind one does not — an unfinished run is looked
# past, never counted as the second green.
INFLIGHT_SMOKE="[{\"databaseId\":103,\"conclusion\":\"\",\"createdAt\":\"$FRESH_A\"},{\"databaseId\":102,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_A\"},{\"databaseId\":101,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_B\"}]"
ran=$((ran+1))
if [[ -z "$REAL_GH" ]]; then
  ok "positive control: P1.3 in-flight run" "gh absent — cannot stub what is not there (not a pass)"
else
  inflight_out="$(env CONFIRM_SELFTEST_SKIP_NETWORK=1 FAKE_SMOKE="$INFLIGHT_SMOKE" \
    REAL_GH="$REAL_GH" PATH="$STUB_DIR:$PATH" ENGINE="${ENGINE:-/home/bill/dev/recursiv}" \
    bash "$TARGET" 2>&1)"
  if grep -qE "✅ +P1\.3 " <<<"$inflight_out"; then
    ok "positive control: P1.3 in-flight run" "two completed greens confirmed past an unfinished head run"
  else
    bad "positive control: P1.3 in-flight run" "an in-progress smoke run blinded the monitor check — row was: $(grep -E '(✅|❌|⏭) +P1\.3 ' <<<"$inflight_out" | head -1 || echo '<no P1.3 row printed>')"
  fi
fi
fidelity "fidelity: P1.3 rejects one green behind an in-flight run" "P1.3" \
  "FAKE_SMOKE=[{\"databaseId\":103,\"conclusion\":\"\",\"createdAt\":\"$FRESH_A\"},{\"databaseId\":102,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_A\"}]"

# P4.4 shares the production evidence helper but also reads a distinct staging
# run and step. Prove the full predicate in both directions: genuine parity on
# both monitors confirms; the same green staging run paired with a production
# billing skip does not.
P44_PROD="[{\"databaseId\":401,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_A\"},{\"databaseId\":400,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_B\"}]"
P44_STAGING="[{\"databaseId\":402,\"conclusion\":\"success\",\"createdAt\":\"$FRESH_A\"}]"
P44_JOBS='{"jobs":[{"steps":[{"name":"Parity scorecard against staging","conclusion":"success"}]}]}'
ran=$((ran+1))
p44_positive="$(env CONFIRM_SELFTEST_SKIP_NETWORK=1 FAKE_SMOKE="$P44_PROD" \
  FAKE_STAGING_SMOKE="$P44_STAGING" FAKE_STAGING_JOBS="$P44_JOBS" \
  REAL_GH="$REAL_GH" PATH="$STUB_DIR:$PATH" ENGINE="${ENGINE:-/home/bill/dev/recursiv}" \
  bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.4 " <<<"$p44_positive"; then
  ok "positive control: P4.4 parity" "both fresh scorecards confirmed"
else
  bad "positive control: P4.4 parity" "good production + staging parity evidence did not confirm"
fi
fidelity "fidelity: P4.4 rejects production billing skip" "P4.4" \
  "FAKE_SMOKE=$P44_PROD" "FAKE_SMOKE_PARITY=skip" \
  "FAKE_STAGING_SMOKE=$P44_STAGING" "FAKE_STAGING_JOBS=$P44_JOBS"

# P2c(3) exists to distinguish a workflow that merely exists from one enforced
# by main's protection. Exercise both directions through the exact GraphQL read
# path so a query that ignores its returned contexts cannot pass this suite.
PROTECTION_WITH_EVIDENCE='{"data":{"repository":{"branchProtectionRules":{"nodes":[{"pattern":"main","requiredStatusCheckContexts":["check","build","gate","confirm","evidence"]}]}}}}'
PROTECTION_WITHOUT_EVIDENCE='{"data":{"repository":{"branchProtectionRules":{"nodes":[{"pattern":"main","requiredStatusCheckContexts":["check","build","gate","confirm"]}]}}}}'
ran=$((ran+1))
p2c3_positive="$(env CONFIRM_SELFTEST_SKIP_NETWORK=1 FAKE_PROTECTION="$PROTECTION_WITH_EVIDENCE" REAL_GH="$REAL_GH" PATH="$STUB_DIR:$PATH" \
  ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P2c\.3 " <<<"$p2c3_positive"; then
  ok "positive control: P2c.3 required" "evidence context confirmed"
else
  bad "positive control: P2c.3 required" "good GraphQL protection evidence did not confirm — row was: $(grep -E '(✅|❌|⏭) +P2c\.3 ' <<<"$p2c3_positive" | head -1 || echo '<no P2c.3 row printed>')"
fi
fidelity "fidelity: P2c.3 rejects optional evidence" "P2c.3" \
  "FAKE_PROTECTION=$PROTECTION_WITHOUT_EVIDENCE"

# The administration token is intentionally too narrow for actions, issues and
# pull requests. Prove it is used only for the two protection reads while the
# ordinary token still drives the monitor check.
ran=$((ran+1))
TOKEN_SPLIT_SMOKE="[{\"databaseId\":201,\"conclusion\":\"success\",\"createdAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},{\"databaseId\":200,\"conclusion\":\"success\",\"createdAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]"
token_split_out="$(env CONFIRM_SELFTEST_SKIP_NETWORK=1 GH_TOKEN=ordinary ADMIN_GH_TOKEN=admin FAKE_TOKEN_SPLIT=1 \
  FAKE_SMOKE="$TOKEN_SPLIT_SMOKE" FAKE_CLASSIC_PROTECTION="5 false false" \
  FAKE_PROTECTION="$PROTECTION_WITH_EVIDENCE" REAL_GH="$REAL_GH" PATH="$STUB_DIR:$PATH" \
  ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P1\.3 " <<<"$token_split_out" \
  && grep -qE "✅ +P2a\.1 " <<<"$token_split_out" \
  && grep -qE "✅ +P2c\.3 " <<<"$token_split_out"; then
  ok "token isolation" "ordinary evidence and admin-only protection reads both confirmed"
else
  bad "token isolation" "the admin credential escaped the protection-only boundary"
fi

# ── Cases 10-14: FIDELITY, the doc-backed half. ──────────────────────────────
#
# Seven predicates read a blob out of `origin/main` with `git show`. A `gh` stub
# cannot reach those, so the same question — does the predicate READ what it
# fetched? — was unaskable for all of them, PW.1's fix (#336) included.
#
# A `git` stub answers it: intercept ONE path and serve mangled content, defer
# every other git invocation to the real binary. Nothing on disk is touched and
# `main` is never involved, which is the objection that kept this untested.
GIT_STUB="$(mktemp -d)"
trap 'rm -rf "$STUB_DIR" "$GIT_STUB"' EXIT
cat > "$GIT_STUB/git" <<'GSTUB'
#!/usr/bin/env bash
# Serve FAKE_BLOB for `show origin/main:$FAKE_PATH`; pass everything else
# through, including `rev-parse` and the cat-file existence probes, so only the
# one artifact under test is false.
if [[ -n "${FAKE_PATH:-}" && "$1" == "show" && "$2" == "origin/main:$FAKE_PATH" ]]; then
  printf '%s\n' "$FAKE_BLOB"
  exit 0
fi
exec "$REAL_GIT" "$@"
GSTUB
chmod +x "$GIT_STUB/git"
REAL_GIT="$(command -v git || true)"

# blob_fidelity <name> <id> <path> <blob> — the blob is wrong-but-plausible,
# so <id> must not print ✅.
blob_fidelity() {
  local name="$1" id="$2" path="$3" blob="$4"
  ran=$((ran+1))
  if [[ -z "$REAL_GIT" ]]; then
    ok "$name" "git absent — cannot stub what is not there (not a pass)"
    return
  fi
  local out
  out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 FAKE_PATH="$path" FAKE_BLOB="$blob" REAL_GIT="$REAL_GIT" \
        PATH="$GIT_STUB:$PATH" ENGINE="${ENGINE:-/home/bill/dev/recursiv}" \
        bash "$TARGET" 2>&1)"
  if grep -qE "✅ +${id//./\\.} " <<<"$out"; then
    bad "$name" "$id confirmed against a blob that does not meet its exit"
  else
    ok "$name" "$id declined to confirm"
  fi
}

# POSITIVE CONTROL for the whole block, and it has to come first. Every case
# below asserts a check DECLINED to confirm — which is also what happens if the
# stub is broken, or the path never matches, or the script dies early. Then all
# five pass forever while testing nothing. This one feeds a GOOD blob down the
# same path and requires a ✅, so the block can only be green if the stub is
# both live and discriminating.
ran=$((ran+1))
if [[ -z "$REAL_GIT" ]]; then
  ok "stub is effective (positive control)" "git absent — cannot stub what is not there"
else
  pc_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 FAKE_PATH="docs/web-deploy-path.md" \
    FAKE_BLOB="$(printf 'Coolify deploys this.\n019d5190-f0c0-717e-a1bd-ef9c335292b9\n')" \
    REAL_GIT="$REAL_GIT" PATH="$GIT_STUB:$PATH" \
    ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
  if grep -qE '✅ +PW\.1 ' <<<"$pc_out"; then
    ok "stub is effective (positive control)" "a good blob still confirms — the cases below can fail"
  else
    bad "stub is effective (positive control)" "PW.1 did not confirm on a GOOD blob — every fidelity case below is vacuous"
  fi
fi

# PW(1) names Coolify AND the project id. `grep -cE 'a|b' -ge 2` counted lines
# matching EITHER, so this exact blob used to confirm (#336).
blob_fidelity "fidelity: PW.1 needs BOTH terms" "PW.1" "docs/web-deploy-path.md" \
  "$(printf 'coolify\ncoolify\ncoolify\n')"

# P1(2)'s zero is only readable beside its non-zeros — a ci.yml with the four
# steps and a `continue-on-error` must not pass.
blob_fidelity "fidelity: P1.2 rejects continue-on-error" "P1.2" ".github/workflows/ci.yml" \
  "$(printf 'pnpm install --frozen-lockfile\npnpm lint\npnpm typecheck\npnpm test\nneeds: check\ncontinue-on-error: true\n')"

# P4(1) is a FIFTH profile named staging on its own channel; four is not it.
blob_fidelity "fidelity: P4.1 rejects a missing profile" "P4.1" "eas.json" \
  '{"build":{"development":{},"preview":{},"production":{},"staging":{"channel":"staging"}}}'

# P2c(1) wants the gate to DEMAND a non-empty section; one mention is a mention.
blob_fidelity "fidelity: P2c.1 rejects a single mention" "P2c.1" ".github/workflows/evidence-gate.yml" \
  "$(printf 'echo "What remains unproved"\n')"

# PAPI(4) wants a DEMONSTRATED 429 — a document that merely says the word.
blob_fidelity "fidelity: PAPI.4 rejects an advertised 429" "PAPI.4" "docs/api-error-contract.md" \
  "$(printf 'We return HTTP/2 429 when you exceed the limit.\n')"

# ── Cases 16-21: FIDELITY, the HTTP half. ────────────────────────────────────
#
# PW.2 and PS.2 read a LIVE origin, which no PATH stub can mangle. But both take
# their host from an env var (`PW_ORIGIN`, `PS_ORIGIN`), so a fixture server on
# loopback exercises the real curl, the real parsing and the real predicate
# against a response we choose. No network, no production, nothing stubbed.
#
# PS.2 is the one that most needed this. Its whole row is that these routes
# answered `403 no_scopes` — "your key lacks the scope" — to a caller carrying
# NO key. Nothing tested that the predicate can tell 403 from 401, which is the
# only distinction the sub-artifact exists to make.
cat > "$STUB_DIR/fixture-server.py" <<'PYEOF'
import os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer

HTML   = os.environ.get("FX_HTML", "")
STATUS = int(os.environ.get("FX_STATUS", "401"))
HEALTH = os.environ.get("FX_HEALTH", '{"commit":"deadbee"}')

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.startswith("/health"):
            body, code = HEALTH.encode(), 200
        else:
            body, code = HTML.encode(), 200
        self.send_response(code)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        self.send_response(STATUS)
        self.send_header("Content-Length", "0")
        self.end_headers()

srv = HTTPServer(("127.0.0.1", 0), H)
print(srv.server_port, flush=True)
srv.serve_forever()
PYEOF

# http_case <name> <id> <expect: confirm|decline> <env...>
http_case() {
  local name="$1" id="$2" expect="$3"; shift 3
  ran=$((ran+1))
  if ! command -v python3 >/dev/null 2>&1; then
    ok "$name" "python3 absent — no fixture server (not a pass)"
    return
  fi
  local port out
  # shellcheck disable=SC2086
  exec 3< <(env "$@" python3 "$STUB_DIR/fixture-server.py")
  read -r port <&3
  if [[ -z "${port:-}" ]]; then
    bad "$name" "fixture server did not start"
    return
  fi
  out="$(PW_ORIGIN="http://127.0.0.1:$port" PS_ORIGIN="http://127.0.0.1:$port" \
        ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
  exec 3<&-
  pkill -f "$STUB_DIR/fixture-server.py" 2>/dev/null
  if grep -qE "✅ +${id//./\\.} " <<<"$out"; then
    [[ "$expect" == "confirm" ]] && ok "$name" "$id confirmed" \
      || bad "$name" "$id confirmed against a response that does not meet its exit"
  else
    [[ "$expect" == "decline" ]] && ok "$name" "$id declined to confirm" \
      || bad "$name" "$id did NOT confirm on a good response — the cases beside it are vacuous"
  fi
}

FRESH_HTML='<html><script src="/_expo/static/js/web/index-0123456789abcdef0123456789abcdef.js"></script></html>'
STALE_HTML='<html><script src="/_expo/static/js/web/index-07628618e137db722807402c1c649219.js"></script></html>'

# Positive control first, same reason as the git block: every "decline" case
# below is also what a dead fixture server produces.
http_case "http stub is effective (positive control)" "PW.2" "confirm" \
  "FX_HTML=$FRESH_HTML" "FX_STATUS=401"
http_case "fidelity: PW.2 rejects the frozen bundle" "PW.2" "decline" \
  "FX_HTML=$STALE_HTML" "FX_STATUS=401"
http_case "fidelity: PW.2 rejects a page with no bundle" "PW.2" "decline" \
  "FX_HTML=<html>maintenance</html>" "FX_STATUS=401"

http_case "positive control: PS.2 confirms on 401" "PS.2" "confirm" \
  "FX_HTML=$FRESH_HTML" "FX_STATUS=401"
# THE defect the row exists for: 403 no_scopes to a caller with no key.
http_case "fidelity: PS.2 rejects 403 no_scopes" "PS.2" "decline" \
  "FX_HTML=$FRESH_HTML" "FX_STATUS=403"
# 401s that cannot be attributed to a deployed commit prove nothing about code.
http_case "fidelity: PS.2 rejects an unattributable 401" "PS.2" "decline" \
  "FX_HTML=$FRESH_HTML" "FX_STATUS=401" "FX_HEALTH={}"

# ── PW.3 fidelity: the drill state machine, driven through the REAL read path.
# Fixture commits are built with git plumbing (hash-object → mktree → commit-tree),
# so PW3_REF exercises exactly the `git show` the CI run performs; nothing on the
# working tree or any branch moves, and the objects are unreferenced after this
# run. The live-page half rides the same fixture server as PW.2's cases.
pw3_fixture_ref() {
  local blob docstree root
  blob=$(git hash-object -w --stdin)
  docstree=$(printf '100644 blob %s\tpw3-rollback-drill.md\n' "$blob" | git mktree)
  root=$(printf '040000 tree %s\tdocs\n' "$docstree" | git mktree)
  GIT_AUTHOR_NAME=selftest GIT_AUTHOR_EMAIL=selftest@local \
  GIT_COMMITTER_NAME=selftest GIT_COMMITTER_EMAIL=selftest@local \
    git commit-tree "$root" -m "pw3 selftest fixture"
}

PW3_P="index-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
PW3_C="index-cccccccccccccccccccccccccccccccc"
pw3_armed_ref=$(pw3_fixture_ref <<EOF
state: armed
candidate-string: $PW3_C
previous-string: $PW3_P
EOF
)

# Mid-window: previous only → the one shape that confirms. Positive control
# first — every decline below is also what a broken fixture ref produces.
PW3_REF=$pw3_armed_ref http_case "positive control: PW.3 confirms mid-window" "PW.3" "confirm" \
  "FX_HTML=<html><script src=\"/_expo/static/js/web/$PW3_P.js\"></script></html>" "FX_STATUS=401"
# A half-done rollback references BOTH bundles. "Previous present" alone would
# pass it; the pair exists because only prev-AND-NOT-cand discriminates.
PW3_REF=$pw3_armed_ref http_case "fidelity: PW.3 rejects a page carrying both strings" "PW.3" "decline" \
  "FX_HTML=<html><script src=\"$PW3_P.js\"></script><script src=\"$PW3_C.js\"></script></html>" "FX_STATUS=401"

# Window not open (candidate only): must neither confirm NOR fail — an armed
# drill that has not begun is CANNOT-VERIFY, and a ❌ here would page someone
# about a rollback nobody performed.
ran=$((ran+1))
exec 3< <(env "FX_HTML=<html><script src=\"$PW3_C.js\"></script></html>" FX_STATUS=401 python3 "$STUB_DIR/fixture-server.py")
read -r pw3_port <&3
if [[ -z "${pw3_port:-}" ]]; then
  bad "fidelity: PW.3 window-not-open is a skip" "fixture server did not start"
else
  pw3_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 PW3_REF=$pw3_armed_ref PW_ORIGIN="http://127.0.0.1:$pw3_port" PS_ORIGIN="http://127.0.0.1:$pw3_port" \
            ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
  exec 3<&-
  pkill -f "$STUB_DIR/fixture-server.py" 2>/dev/null
  if grep -qE "(✅|❌) +PW\.3 " <<<"$pw3_out"; then
    bad "fidelity: PW.3 window-not-open is a skip" "PW.3 issued a verdict before the drill began"
  else
    ok "fidelity: PW.3 window-not-open is a skip" "armed + candidate-only produced a skip, not a verdict"
  fi
fi

# Complete state: the committed evidence, not the live page, is the artifact.
pw3_complete_ok=$(pw3_fixture_ref <<EOF
state: complete
candidate-string: $PW3_C
previous-string: $PW3_P
verify-run: 12345678
mid-window-prev: 1
mid-window-cand: 0
EOF
)
pw3_complete_bare=$(pw3_fixture_ref <<EOF
state: complete
candidate-string: $PW3_C
previous-string: $PW3_P
EOF
)
ran=$((ran+1))
pw3_ok_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 PW3_REF=$pw3_complete_ok ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
if grep -qE "✅ +PW\.3 " <<<"$pw3_ok_out"; then
  ok "positive control: PW.3 confirms committed evidence" "complete + all three markers confirmed"
else
  bad "positive control: PW.3 confirms committed evidence" "did NOT confirm on good evidence — the case below is vacuous"
fi
ran=$((ran+1))
pw3_bare_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 PW3_REF=$pw3_complete_bare ENGINE="${ENGINE:-/home/bill/dev/recursiv}" bash "$TARGET" 2>&1)"
if grep -qE "✅ +PW\.3 " <<<"$pw3_bare_out"; then
  bad "fidelity: PW.3 rejects evidence-free completion" "state: complete with no markers confirmed"
else
  ok "fidelity: PW.3 rejects evidence-free completion" "complete without run id + pair declined to confirm"
fi

# ── Case 6: a skip is never silently a pass. ─────────────────────────────────
ran=$((ran+1))
if grep -qE '^  ⏭' <<<"$nogh_out" && ! grep -qE 'SKIP' <<<"$nogh_out"; then
  bad "skips state a reason" "skip lines carry no reason text"
else
  ok "skips state a reason" "every skip names why it could not verify"
fi

# ── Case 7: P4.5 predicate fidelity — the ARTIFACTS, not just the environment.
#
# The header above says this script degrades the environment and not the
# artifacts, because live git/gh/HTTP state has no copy to mangle. P4.5 is the
# exception and the reason is structural: its evidence is a git repository
# reached through $ENGINE, and a git repository CAN be synthesised. So this is
# the one predicate whose correctness-when-it-can-look is testable here.
#
# What is under test is the paired-result rule. P4(5) closes on a comparison
# where BOTH sides are non-empty, never on a bare zero — because an empty side
# yields "nothing uncovered" while proving nothing.
fake_engine() {  # <schema-content> <sanitizer-content> -> prints repo path
  local d; d="$(mktemp -d)"
  mkdir -p "$d/packages/server/src/db" "$d/scripts"
  printf '%s' "$1" > "$d/packages/server/src/db/schema.ts"
  printf '%s' "$2" > "$d/scripts/sanitize-staging-data.sql"
  git -C "$d" init -q 2>/dev/null
  git -C "$d" add -A 2>/dev/null
  git -C "$d" -c user.email=t@t -c user.name=t commit -qm f 2>/dev/null
  # The engine-identity gate and every predicate read origin/main, so give the
  # synthetic repo that ref directly rather than inventing a remote.
  git -C "$d" update-ref refs/remotes/origin/main HEAD 2>/dev/null
  printf '%s' "$d"
}

# The positive control must contain EVERY named column: any column the fixture
# omits is reported stale, so a hand-written two-line schema fails for a reason
# that has nothing to do with what is under test. Both fixtures are generated
# from the reproducer's own lists.
# Written to a file rather than passed with `node -e`: the generated Drizzle and
# SQL both contain single quotes, which would close a single-quoted shell string
# mid-expression. A quoted heredoc keeps the JS untouched by the shell.
cat > "$STUB_DIR/genfx.js" <<'GENFX'
const { CREDENTIALS, PERSONAL } = require(process.argv[3]);
const m = {};
for (const g of [CREDENTIALS, PERSONAL]) {
  for (const [t, cs] of Object.entries(g)) {
    m[t] = m[t] || new Set();
    cs.forEach((c) => m[t].add(c));
  }
}
const out = Object.entries(m).map(([t, cs], i) =>
  process.argv[2] === 'schema'
    ? `export const t${i} = pgTable('${t}', { ${[...cs].map((c) => `f_${c}: text('${c}')`).join(', ')} });`
    : `UPDATE "${t}" SET ${[...cs].map((c) => `${c} = NULL`).join(', ')};`,
);
console.log(out.join('\n'));
GENFX
fx_schema_ok="$(node "$STUB_DIR/genfx.js" schema "$HERE/p4-sanitizer-coverage.js")"
fx_sanitize_ok="$(node "$STUB_DIR/genfx.js" sql "$HERE/p4-sanitizer-coverage.js")"
# Same sanitizer, but a schema where every named column is GONE. The uncovered
# count is then 0 by vacancy, and a predicate asserting only "uncovered == 0"
# would call this a pass. This is the bare zero P4(5) forbids.
fx_schema_renamed="export const user = pgTable('user', { somethingElse: text('something_else'), });"

ran=$((ran+1))
fe_ok="$(fake_engine "$fx_schema_ok" "$fx_sanitize_ok")"
p45_ok_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE="$fe_ok" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.5 " <<<"$p45_ok_out"; then
  ok "positive control: P4.5 confirms a covered schema" "non-empty schema + zero uncovered confirmed"
else
  bad "positive control: P4.5 confirms a covered schema" "did NOT confirm on good evidence — the cases below are vacuous"
fi
rm -rf "$fe_ok"

ran=$((ran+1))
fe_stale="$(fake_engine "$fx_schema_renamed" "$fx_sanitize_ok")"
p45_stale_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE="$fe_stale" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.5 " <<<"$p45_stale_out"; then
  bad "fidelity: P4.5 rejects a vacuous zero" "every named column stale, yet it confirmed — this is the bare zero P4(5) forbids"
else
  ok "fidelity: P4.5 rejects a vacuous zero" "all-stale list did not confirm despite 0 uncovered"
fi
rm -rf "$fe_stale"

ran=$((ran+1))
fe_dirty="$(fake_engine "$fx_schema_ok" "-- clears nothing
DELETE FROM unrelated_table;")"
p45_dirty_out="$(CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE="$fe_dirty" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.5 " <<<"$p45_dirty_out"; then
  bad "fidelity: P4.5 rejects an uncovered column" "legacy_email left uncleared, yet it confirmed"
else
  ok "fidelity: P4.5 rejects an uncovered column" "uncleared legacy_email declined to confirm"
fi
rm -rf "$fe_dirty"

# No cross-repository credential is needed when the deployed image carries the
# source check's paired output beside its own commit. Hold the public fallback
# in both directions: positive counts + both zeroes confirm; an `ok` label with
# a stale column does not.
P45_HEALTH_SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
P45_HEALTH_OK="printf '%s' '{\"commit\":\"$P45_HEALTH_SHA\",\"stagingSanitizer\":{\"status\":\"ok\",\"schemaTables\":152,\"schemaColumns\":1894,\"uncoveredColumns\":0,\"staleColumns\":0}}'"
P45_HEALTH_STALE="printf '%s' '{\"commit\":\"$P45_HEALTH_SHA\",\"stagingSanitizer\":{\"status\":\"ok\",\"schemaTables\":152,\"schemaColumns\":1894,\"uncoveredColumns\":0,\"staleColumns\":1}}'"

ran=$((ran+1))
p45_health_ok_out="$(env CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE= P45_HEALTH_CMD="$P45_HEALTH_OK" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.5 " <<<"$p45_health_ok_out"; then
  ok "positive control: P4.5 build health" "commit + positive schema + paired zero confirmed"
else
  bad "positive control: P4.5 build health" "valid build-bound health evidence did not confirm"
fi

ran=$((ran+1))
p45_health_stale_out="$(env CONFIRM_SELFTEST_SKIP_NETWORK=1 ENGINE= P45_HEALTH_CMD="$P45_HEALTH_STALE" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.5 " <<<"$p45_health_stale_out"; then
  bad "fidelity: P4.5 rejects stale health" "an ok label with a stale schema column confirmed"
else
  ok "fidelity: P4.5 rejects stale health" "stale-column evidence declined to confirm"
fi

# ── P4.2: the live helper's output is necessary but its exit status is too. ─
# A helper that prints PASS and then fails to revoke its temporary API key must
# not be countersigned. The helper has unit tests for origin/status/id/cleanup;
# these two cases hold the shell predicate that consumes its output.
p42_common=(
  CONFIRM_SELFTEST_SKIP_NETWORK=1
  GH_CONFIG_DIR=/nonexistent
  GH_TOKEN=
  GITHUB_TOKEN=
  ENGINE=
  STAGING_QA_EMAIL=fixture@example.test
  STAGING_QA_PASSWORD=fixture-password
  STAGING_ORG_ID=fixture-org
  STAGING_PROJECT_ID=fixture-project
)
p42_output="printf 'HTTP 200\nconfigured.id=fixture-org\nresponse.id=fixture-org\nP4.2 STAGING ORG BINDING PASS\n'"

ran=$((ran+1))
p42_ok_out="$(env "${p42_common[@]}" P42_VERIFY_CMD="$p42_output" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.2 " <<<"$p42_ok_out"; then
  ok "positive control: P4.2 binding" "200 + byte-equal ids + zero exit confirmed"
else
  bad "positive control: P4.2 binding" "valid helper output did not confirm"
fi

ran=$((ran+1))
p42_bad_out="$(env "${p42_common[@]}" P42_VERIFY_CMD="$p42_output; exit 9" bash "$TARGET" 2>&1)"
if grep -qE "✅ +P4\.2 " <<<"$p42_bad_out"; then
  bad "fidelity: P4.2 rejects failed cleanup" "PASS text with a non-zero helper exit was countersigned"
else
  ok "fidelity: P4.2 rejects failed cleanup" "non-zero helper exit declined to confirm"
fi

ran=$((ran+1))
p42_pr_out="$(env "${p42_common[@]}" P42_LIVE_VERIFY=0 \
  P42_VERIFY_CMD="printf 'SHOULD-NOT-RUN\\n'; exit 9" bash "$TARGET" 2>&1)"
if grep -qE "⏭ +P4\.2 .*main/schedule-only" <<<"$p42_pr_out" && \
   ! grep -q "SHOULD-NOT-RUN" <<<"$p42_pr_out"; then
  ok "fidelity: P4.2 PR mode preserves auth budget" "live helper skipped and never executed"
else
  bad "fidelity: P4.2 PR mode preserves auth budget" "PR mode executed or misreported the live helper"
fi

echo
echo "ran $ran · failed $fails"
[[ "$fails" -eq 0 ]] || { echo "CONFIRM SELF-TEST FAILED — the second party is not behaving as claimed."; exit 1; }
echo "CONFIRM SELF-TEST PASSED"
