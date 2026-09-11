#!/usr/bin/env bash
# gate-selftest.sh — does check-controller.sh actually catch what it claims to?
#
# WHY THIS EXISTS. Three defects were found in the gate in a single session on
# 2026-07-31, every one of them by USING it rather than reading it:
#
#   · a SIGPIPE race made check [10] report a dangling row that did not exist,
#     nondeterministically, on a valid controller (§5.49)
#   · check [1] grepped the WHOLE file, so a historical denominator in §5
#     satisfied it while the live §1.6 value was stale
#   · check [1] passed on ANY single match, so one updated statement satisfied it
#     while two others were stale
#
# The workflow's existing negative control could not have caught any of them. It
# applies ONE corruption — an `N` value — and asserts the gate fails SOMEHOW. A
# coarse control like that goes green as long as any check fires, so a check that
# has quietly stopped working is invisible: corrupting `N` trips the denominator
# line whether or not the pair comparison still functions.
#
# WHAT THIS DOES INSTEAD. Each case corrupts ONE thing and asserts THE SPECIFIC
# check fires on it. A check that silently stops working now fails its own case
# instead of hiding behind a sibling's failure.
#
# WHAT IT STILL CANNOT DO, stated because a self-test that oversells itself is
# worse than none: this proves the gate rejects things it should reject. It
# CANNOT catch a false FAILURE — a gate that rejects a VALID controller — which
# is what §5.49 was. The clean-file case at the end is the only guard against
# that, and one run of it cannot catch a race. Reproducing §5.49 needs the check
# run many times on unchanged input, which is a different and slower harness.
#
# Usage:  bash scripts/gate-selftest.sh [path-to-goal-prompt.md]
set -uo pipefail

GP="${1:-}"
if [[ -z "$GP" ]]; then
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "FATAL: not in a git repo" >&2; exit 2; }
  GP="$root/docs/goal-prompt.md"
fi
[[ -r "$GP" ]] || { echo "FATAL: cannot read $GP" >&2; exit 2; }
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE="$HERE/check-controller.sh"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fails=0; ran=0

# case <name> <expected-FAIL-substring> <python-corruption>
#   The corruption reads $SRC and writes $DST. If it changes nothing the case
#   ERRORS rather than passing — a control that no longer corrupts anything
#   proves nothing, and silently degrading into a no-op is how self-tests rot.
case_() {
  local name="$1" expect="$2" prog="$3" dst="$TMP/${1//[^a-zA-Z0-9]/_}.md"
  ran=$((ran+1))
  SRC="$GP" DST="$dst" python3 -c "$prog" || { printf '  ERROR %-26s corruption script failed\n' "$name"; fails=$((fails+1)); return; }
  if cmp -s "$GP" "$dst"; then
    printf '  ERROR %-26s corruption was a NO-OP — the document shape changed, so this case proves nothing\n' "$name"
    fails=$((fails+1)); return
  fi
  local out; out="$("$GATE" "$dst" 2>&1)"
  if [[ "$out" == *"ALL CHECKS PASSED"* ]]; then
    printf '  FAIL  %-26s the gate PASSED a controller corrupted this way\n' "$name"; fails=$((fails+1)); return
  fi
  if grep -qF -- "$expect" <<<"$out"; then
    printf '  ok    %-26s caught by the right check\n' "$name"
  else
    printf '  FAIL  %-26s gate failed, but NOT on "%s" — it caught something else, so this check is unproven\n' "$name" "$expect"
    grep -E '^\s+.?\[31m?FAIL' <<<"$out" | head -3 | sed 's/^/          /'
    fails=$((fails+1))
  fi
}

echo "── GATE SELF-TEST — each corruption must trip ITS OWN check ─────────"
echo "gate: $GATE"
echo "doc:  $GP"
echo

# [1] a single LIVE statement of the pair goes stale while the others stay right.
# This is the case the old control could not express, and the exact window this
# file sat in on 2026-07-31 when one statement was updated and one was not.
case_ "pair-partially-stale" "stale published pair" '
import os,re
s=open(os.environ["SRC"],encoding="utf-8").read()
m=re.search(r"→ \*\*`(\d+) (\d+)`\*\*", s)
a,b=int(m.group(1)),int(m.group(2))
s=s.replace(f"→ **`{a} {b}`**", f"→ **`{a+1} {b+1}`**", 1)   # FIRST occurrence only
open(os.environ["DST"],"w",encoding="utf-8").write(s)'

# [1] EVERY live statement removed, while §5 keeps the historical value. The old
# shape was satisfiable by history alone, so deleting the live claim passed.
case_ "pair-live-claim-deleted" "no live statement of the pair" '
import os,re
s=open(os.environ["SRC"],encoding="utf-8").read()
led=s.index("## 5. RETRACTION LEDGER")
head,tail=s[:led],s[led:]
head=re.sub(r"`\d+ \d+`","`XX YYY`",head)
tail=re.sub(r"(?m)^(?!.*RETRACTION)(.*`)\d+ \d+(`.*#190.*)$",r"\1XX YYY\2",tail)
open(os.environ["DST"],"w",encoding="utf-8").write(head+tail)'

# [2] the scored table must be sorted descending.
case_ "table-unsorted" "not descending" '
import os,re
lines=open(os.environ["SRC"],encoding="utf-8").read().split("\n")
idx=[i for i,l in enumerate(lines) if re.search(r"\*\*[0-9.]+\*\* \|\s*$", l) and l.startswith("| **")]
lines[idx[0]],lines[idx[-1]]=lines[idx[-1]],lines[idx[0]]
open(os.environ["DST"],"w",encoding="utf-8").write("\n".join(lines))'

# [5] a published score that no longer recomputes from its own inputs.
case_ "score-does-not-recompute" "do not recompute" '
import os,re
lines=open(os.environ["SRC"],encoding="utf-8").read().split("\n")
for i,l in enumerate(lines):
    m=re.search(r"\*\*([0-9.]+)\*\* \|\s*$", l)
    if m and l.startswith("| **"):
        lines[i]=l[:m.start(1)]+"7.7"+l[m.end(1):]; break
open(os.environ["DST"],"w",encoding="utf-8").write("\n".join(lines))'

# [10] a Serial-on cell naming a row that does not exist. This is the check that
# reported a PHANTOM dangler under the SIGPIPE race — so it needs a case proving
# it still catches a REAL one, or the §5.49 fix could have disabled it outright
# and nothing would have noticed.
case_ "serial-on-dangler" "does not exist" '
import os,re
lines=open(os.environ["SRC"],encoding="utf-8").read().split("\n")
for i,l in enumerate(lines):
    if l.startswith("| **P2b** |"):
        c=l.split("|"); c[-3]=" PZZZ "; lines[i]="|".join(c); break
open(os.environ["DST"],"w",encoding="utf-8").write("\n".join(lines))'

# The positive control. Without it every case above is satisfiable by a gate that
# rejects EVERYTHING, which is the §5.49 failure mode wearing a green badge.
echo
ran=$((ran+1))
pc_out="$("$GATE" "$GP" 2>&1)"; pc_rc=$?
if [[ $pc_rc -eq 0 ]]; then
  printf '  ok    %-26s the unmodified controller still PASSES\n' "positive-control"
else
  printf '  FAIL  %-26s the gate rejects the REAL controller — every case above is meaningless\n' "positive-control"
  # PRINT WHY. The first version discarded this output, so when it fired on CI
  # run 30605160163 the log said only "the gate rejects the REAL controller" and
  # the actual cause — check [12] with no GH_TOKEN — was invisible. A control
  # that cannot tell you what it caught costs more than it saves.
  grep -E 'FAIL' <<<"$pc_out" | sed 's/^/          /'
  fails=$((fails+1))
fi

echo
echo "ran $ran · failed $fails"
[[ "$fails" -eq 0 ]] || { echo "GATE SELF-TEST FAILED — the gate is not checking what it claims to."; exit 1; }
echo "GATE SELF-TEST PASSED"
