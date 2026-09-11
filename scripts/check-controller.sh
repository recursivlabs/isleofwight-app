#!/usr/bin/env bash
# check-controller.sh — the one command that must pass before a §2 row is added.
#
# §5.39 and §5.41 both record the same failure: a row entered §2 and the
# machinery that READS §2 was not re-run. §5.39 scoped the rule to "the
# commands that count §2"; §5.41 proved that too narrow — the lapse defaults,
# the Serial-on column and the DAG block read it too. This script is that rule
# made mechanical, so the next row cannot break these silently.
#
# Exits non-zero on any failure. Prints every actual beside its published claim.
# Run from anywhere; binds $GP the way the controller's own header does.
#
# Usage:  scripts/check-controller.sh [path-to-goal-prompt.md]

set -uo pipefail

GP="${1:-}"
if [[ -z "$GP" ]]; then
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
    echo "FATAL: not in a git repo and no path given" >&2; exit 2; }
  GP="$root/docs/goal-prompt.md"
fi
[[ -r "$GP" ]] || { echo "FATAL: cannot read $GP" >&2; exit 2; }

fail=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=1; }
note() { printf '        %s\n' "$1"; }

echo "check-controller.sh — $GP"
echo "$(git -C "$(dirname "$GP")" rev-parse --short HEAD 2>/dev/null || echo '?') · $(wc -l < "$GP") lines"
echo

# ---------------------------------------------------------------- 1. denominator
echo "[1] §1.6 denominator (rows, sum of N)"
read -r rows sum < <(awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ \
  {gsub(/ /,"",$4); s+=$4; n++} END{print n, s}' "$GP")
[[ -n "${rows:-}" && -n "${sum:-}" ]] || { bad "awk produced nothing (dead pipe)"; rows=0; sum=0; }
denom=$(( sum + 3 ))   # + the off-ladder #190 row, N=3
note "actual: $rows $sum   → denominator $sum + 3 = $denom"
# Search the LIVE text only. §5 (the retraction ledger) and the CHANGELOG hold
# historical denominators BY DESIGN — a ledger that rewrote its own history
# would be useless — and this check greps for a bare literal, so a stale value
# recorded there satisfies it. On 2026-07-31 exactly that happened: §5 carried a
# historical `26 110` while §1.6 still published `27 111`, and this check PASSED
# while the live value was wrong. It was reporting on the ledger, not the
# controller. §6 already draws these boundaries for check [6]; [1] now uses them.
live() { awk -v a="${led:-0}" -v b="${six:-0}" -v c="${chg:-0}" \
  'NR>=a && NR<=b {next} c>0 && NR>=c {next} {print}' "$GP"; }
led=$(grep -n '^## 5\. RETRACTION LEDGER' "$GP" | cut -d: -f1)
six=$(grep -n '^## 6\. THE EVIDENCE BAR' "$GP" | cut -d: -f1)
chg=$(grep -n '^## CHANGELOG' "$GP" | cut -d: -f1)
# EVERY live statement of the pair must agree, not merely one of them. The pair
# is published in more than one place (§1.6 and its restatement), and a check
# that passes on ANY match passes while the others are stale — which is exactly
# the window this file sat in on 2026-07-31 when one was updated and one was not.
# The discriminator for "this is a denominator sentence" is that the line also
# names #190, the off-ladder row every such sentence adds.
declare -i pair_seen=0 pair_bad=0
while IFS= read -r l; do
  case "$l" in *'#190'*) ;; *) continue;; esac
  while read -r found; do
    [[ -z "$found" ]] && continue
    pair_seen+=1
    [[ "$found" == "$rows $sum" ]] || { pair_bad+=1; bad "stale published pair '\`$found\`' (live text says this; actual is '$rows $sum')"; }
  done < <(grep -oE '`[0-9]+ [0-9]+`' <<<"$l" | tr -d '`')
done <<<"$(live)"
if (( pair_seen == 0 )); then bad "no live statement of the pair '$rows $sum' found at all — a missing claim is not a pass"
elif (( pair_bad == 0 )); then pass "all $pair_seen live statements of the pair say '$rows $sum'"; fi
if grep -qF "= **$denom**" <<<"$(live)"; then pass "published denominator $denom matches (live text only)"
else bad "published denominator is not $denom"; fi

# ---------------------------------------------------------------- 2. sort order
echo "[2] §3.1 sorted descending"
sortout=$(awk '/^### 3.1/,/^### 3.2/' "$GP" | grep '^| ' | grep -v '^| Item\|^|---' \
  | awk -F'|' '{gsub(/\*\*/,"",$14); gsub(/ /,"",$14); print $14}' \
  | awk 'NR>1 && $1>prev {print "OUT OF ORDER row " NR ": " $1 " > " prev} {prev=$1} END{print "rows read: " NR}')
scored=$(echo "$sortout" | sed -n 's/^rows read: //p')
[[ -n "${scored:-}" ]] || bad "sort pipeline produced nothing (dead pipe)"
if echo "$sortout" | grep -q 'OUT OF ORDER'; then
  bad "table is not descending:"; echo "$sortout" | grep 'OUT OF ORDER' | sed 's/^/        /'
else pass "descending, $scored rows"; fi
if grep -qF "rows read: $scored" "$GP"; then pass "published 'rows read: $scored' matches"
else bad "published row count is not $scored"; fi

# ------------------------------------------------------- 3. length / columns / bold
echo "[3] §3.2 length, column count, balanced bold"
lenout=$(sed 's/\\|/@ESC@/g' "$GP" | awk -F'|' 'BEGIN{n=0}
  /^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {n++; row=$0;
    gsub(/^ +| +$/,"",$3); gsub(/^ +| +$/,"",$5);
    if (NF!=9) print "COLUMN COUNT WRONG (unescaped | in a cell): "$2" NF="NF;
    if (gsub(/\*\*/,"",row) % 2) print "UNBALANCED BOLD: "$2;
    if (length($3)>120) print "TITLE TOO LONG ("length($3)">120): "$3;
    if (length($5)>16000) print "DESC TOO LONG ("length($5)">16000): "$3}
  END{print "rows checked: " n}')
checked=$(echo "$lenout" | sed -n 's/^rows checked: //p')
[[ -n "${checked:-}" ]] || bad "length pipeline produced nothing (dead pipe)"
if echo "$lenout" | grep -qvE '^rows checked: |^$'; then
  bad "table violations:"; echo "$lenout" | grep -vE '^rows checked: |^$' | sed 's/^/        /'
else pass "$checked rows well-formed"; fi
if grep -qF "rows checked: $checked" "$GP"; then pass "published 'rows checked: $checked' matches"
else bad "published checked count is not $checked"; fi

# ---------------------------------------------------------------- 4. DAG roots
echo "[4] Cycle-0 root split"
roots=$(awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/^ +| +$/,"",$2);
  s=$(NF-2); gsub(/^ +| +$/,"",s); if (s=="—") printf "%s ", $2}' "$GP")
nonroot=$(awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {s=$(NF-2);
  gsub(/^ +| +$/,"",s); if (s!="—") n++} END{print n+0}' "$GP")
nroots=$(echo "$roots" | wc -w)
pending=$(( nroots + 1 ))   # + off-ladder #190, always a root
note "table roots: $roots"
note "pending $pending (=$nroots table roots + #190) · blocked $nonroot · total $(( pending + nonroot ))"
if [[ $(( pending + nonroot )) -eq $(( rows + 1 )) ]]; then pass "split accounts for every row"
else bad "split does not sum to $((rows+1)) loaded rows"; fi
if grep -qE "\*\*$pending \+ $nonroot = $(( pending + nonroot ))\*\*" "$GP"; then
  pass "published split '$pending + $nonroot = $(( pending + nonroot ))' matches"
else bad "published split is not '$pending + $nonroot = $(( pending + nonroot ))'"; fi

# ----------------------------------------- 5. every §3.1 score recomputes (§3 item 1)
# The controller ASSERTS "25 of 25 recompute" and prints no command for it.
# This is that command. Weights from DispatcherService.ts:118-176.
echo "[5] §3.1 scores recompute from the published inputs"
recalc=$(awk '/^### 3.1/,/^### 3.2/' "$GP" | grep '^| ' | grep -v '^| Item\|^|---' \
| awk -F'|' '{
    for(i=1;i<=NF;i++){ gsub(/\*\*/,"",$i); gsub(/^ +| +$/,"",$i) }
    name=$2; prox=$3+0; lev=$4+0; sig=$5+0; urg=$6+0; sev=$7+0; ui=$8+0;
    rev=$9+0; grow=$10+0; miss=$11+0; eff=$12+0; num=$13+0; score=$14+0;
    calc = prox*3 + lev*3 + sig*3 + urg*3 + sev*8 + ui*5 + rev*7 + grow*5 + miss*4;
    d = (eff<1?1:sqrt(eff)); if (d<1) d=1;
    got = calc/d;
    r = int(got*10 + 0.5)/10;
    bad=0;
    if (calc != num) { printf "NUMERATOR %s: published %d, computes %d\n", name, num, calc; bad=1 }
    diff = r - score; if (diff<0) diff=-diff;
    if (diff >= 0.05) { printf "SCORE %s: published %.1f, computes %.1f\n", name, score, r; bad=1 }
    if (!bad) ok++
  } END{ printf "recomputed: %d\n", ok }')
okn=$(echo "$recalc" | sed -n 's/^recomputed: //p')
if echo "$recalc" | grep -qE '^(NUMERATOR|SCORE) '; then
  bad "scores that do not recompute:"; echo "$recalc" | grep -E '^(NUMERATOR|SCORE) ' | sed 's/^/        /'
else pass "$okn of $scored rows recompute (numerator and score)"; fi

# ------------------------------------------- 6. stale BASELINE values (§5.41 defect a)
echo "[6] forward BASELINE instructions agree with the current denominator"
# Historical records live in §5 and the CHANGELOG and are expected to hold old
# values — a retraction ledger that rewrote its own history would be useless.
# Only the FORWARD instructions matter: the ones an agent is told to post.
led=$(grep -n '^## 5\. RETRACTION LEDGER' "$GP" | cut -d: -f1)
six=$(grep -n '^## 6\. THE EVIDENCE BAR' "$GP" | cut -d: -f1)
chg=$(grep -n '^## CHANGELOG' "$GP" | cut -d: -f1)
end=$(wc -l < "$GP")
stale=0; checked6=0
while IFS=: read -r ln text; do
  # skip anything inside §5 or the CHANGELOG
  if [[ -n "${led:-}" && -n "${six:-}" && $ln -ge $led && $ln -le $six ]]; then continue; fi
  if [[ -n "${chg:-}" && $ln -ge $chg && $ln -le $end ]]; then continue; fi
  # §1.6's wire format is `BASELINE <old>/<new>  REASON ...`. A real instruction
  # therefore always carries REASON; a prose citation of an already-posted line
  # ("see the BASELINE 93/100 line on #206") does not. That is the discriminator.
  echo "$text" | grep -qE 'BASELINE [0-9]+/[0-9]+ +REASON' || continue
  val=$(echo "$text" | grep -oE 'BASELINE [0-9]+/[0-9]+' | head -1 | sed 's/BASELINE //')
  [[ -z "$val" ]] && continue
  from=${val%%/*}; to=${val##*/}
  checked6=$((checked6+1))
  if [[ "$from" != "$denom" ]]; then
    bad "line $ln: forward 'BASELINE $val' starts from $from, denominator is $denom"
    stale=1
  fi
done < <(grep -nE 'BASELINE [0-9]+/[0-9]+ +REASON' "$GP")
if [[ $stale -eq 0 ]]; then
  pass "$checked6 forward BASELINE instruction(s) start from $denom"
fi
note "(§5 lines ${led:-?}-${six:-?} and CHANGELOG ${chg:-?}+ hold historical values by design; not checked)"

# ------------------------------------- 7. every row is reachable (§5.41 defect b)
echo "[7] no row is loaded blocked with nothing able to unblock it"
# §1.3 flips a row to pending only when a row it is a DEPENDENT of closes, and
# "dependent" is defined by §2's DAG block — not by the Serial-on column. A
# blocked row absent from that block can never reach pending (§5.41(b)).
# A bare word-match is not enough: "say so in the P4 PR" contains "PR". Require
# the row name in an ARROW context, or an explicit trigger in its own cell.
dag=$(awk '/^### Parallel vs serial/,/^### The four human/' "$GP")
unreach=""
while read -r r; do
  [[ -z "$r" ]] && continue
  # (a) named in a dependency chain in the DAG block
  if echo "$dag" | grep -qE "(^|[^A-Za-z0-9])${r} *(→|->)|(→|->) *${r}([^A-Za-z0-9]|\$)"; then
    continue
  fi
  # (b) or its own §2 cell states when it becomes pending
  cell=$(grep -E "^\| \*\*${r}\*\* \|" "$GP")
  if echo "$cell" | grep -qiE 'moves to[^.]{0,40}`pending`|unblock'; then
    note "$r: not in the DAG chains, but its cell states an explicit unblock trigger — OK"
    continue
  fi
  unreach+="$r "
done < <(awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/[ *]/,"",$2);
  s=$(NF-2); gsub(/^ +| +$/,"",s); if (s!="—") print $2}' "$GP")
if [[ -n "$unreach" ]]; then
  bad "blocked row(s) with no path to pending: $unreach"
  note "Add them to §2's DAG block as a dependent of some row, or state an"
  note "explicit unblock trigger in the row's own cell. §5.41(b)."
else pass "every blocked row has a path to pending"; fi

# ------------------------------- 8. every cross-repo anchor still resolves (§4.1, §5.42)
# §4.1: cross-repo citations name a greppable string, never a line number, because
# the engine moves ~30 commits/day and a line number is a count (§1.2 clause 3).
# This asserts each `<file>` @ `<anchor>` pair still resolves at origin/main.
echo "[8] §4.1 citation anchors resolve at origin/main"
ENG="${ENGINE:-/home/bill/dev/recursiv}"
# Resolve the Minds checkout from git, not from $GP's parent — $GP may be a copy
# outside the repo (a negative-control run), and dirname/.. would silently point
# somewhere else, failing every same-repo anchor for the wrong reason.
MND="$(git -C "$(dirname "$GP")" rev-parse --show-toplevel 2>/dev/null || echo "")"
if [[ -z "$MND" || ! -d "$MND/.git" ]]; then
  MND="$(git -C "$PWD" rev-parse --show-toplevel 2>/dev/null || echo "")"
fi
if [[ ! -d "$ENG/.git" ]]; then
  note "engine checkout not at $ENG — skipping cross-repo anchors (set ENGINE=)"
else
  # basename -> repo|path. Extend as the document cites new files.
  read -r -d '' MAP <<'MAPEOF'
DispatcherService.ts|E|packages/server/src/features/dispatcher/DispatcherService.ts
dispatcher.routes.ts|E|packages/server/src/features/dispatcher/dispatcher.routes.ts
orgDispatcher.router.ts|E|packages/server/src/features/dispatcher/orgDispatcher.router.ts
moderation.ts|E|packages/server/src/features/api-keys/rest/routes/moderation.ts
signals.ts|E|packages/server/src/features/api-keys/rest/routes/signals.ts
index.ts|E|packages/server/src/features/api-keys/rest/index.ts
schema.ts|E|packages/server/src/db/schema.ts
dispatcher.ts|E|packages/mcp/src/tools/dispatcher.ts
monitoring.ts|M|lib/monitoring.ts
storage.ts|M|lib/storage.ts
vitest.config.ts|M|vitest.config.ts
notifications.tsx|M|app/(tabs)/notifications.tsx
MAPEOF
  # Only check the live document — §5's retracted rows keep their original citations.
  ledline=$(grep -n '^## 5\. RETRACTION LEDGER' "$GP" | cut -d: -f1)
  sixline=$(grep -n '^## 6\. THE EVIDENCE BAR' "$GP" | cut -d: -f1)
  checked8=0; broke8=0
  while IFS= read -r rec; do
    ln=${rec%%:*}; rest=${rec#*:}
    if [[ -n "${ledline:-}" && -n "${sixline:-}" && $ln -ge $ledline && $ln -le $sixline ]]; then continue; fi
    base=${rest%%$'\x01'*}; anch=${rest#*$'\x01'}
    row=$(printf '%s\n' "$MAP" | grep "^${base}|" | head -1) || true
    [[ -z "$row" ]] && continue
    rp=$(printf '%s' "$row" | cut -d'|' -f2); path=$(printf '%s' "$row" | cut -d'|' -f3)
    R="$ENG"; [[ "$rp" == "M" ]] && R="$MND"
    if [[ -z "$R" || ! -d "$R/.git" ]]; then
      note "skipped $base — no checkout resolved for repo '$rp'"; continue
    fi
    checked8=$((checked8+1))
    # Git exports GIT_DIR while running hooks. Without clearing it, `git -C`
    # still reads the caller's repository, so a Minds pre-commit hook tries to
    # resolve Recursiv paths from the Minds object database and falsely fails.
    hits=$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$R" show "origin/main:$path" 2>/dev/null | grep -cF -- "$anch" || true)
    if [[ "${hits:-0}" -eq 0 ]]; then
      bad "line $ln: anchor does not resolve in $path — \"$anch\""
      broke8=$((broke8+1))
    fi
  done < <(
    # emit  <lineno>:<basename>\x01<anchor>  for every  `<file>` @ `<anchor>`  pair
    grep -noE '`[A-Za-z][A-Za-z0-9_.()/-]*\.(ts|tsx|sql|yml)` @ `[^`]+`' "$GP" \
    | sed -E 's/^([0-9]+):`([^`]*)` @ `(.*)`$/\1:\2\x01\3/' \
    | awk -F: '{n=$1; sub(/^[0-9]+:/,""); print n":"$0}' \
    | sed -E 's#([0-9]+):.*/([A-Za-z0-9_.()-]+\.(ts|tsx|sql|yml))\x01#\1:\2\x01#'
  )
  if [[ $broke8 -eq 0 ]]; then pass "$checked8 mapped anchor(s) resolve"
  else note "an anchor that stops resolving means the cited code moved or changed — re-read it"; fi
  note "(§5 lines ${ledline:-?}-${sixline:-?} exempt: a retraction records what was claimed)"
fi

# --------------------------------------- 9. every §x.y reference resolves (§1.3's "tenth class")
echo "[9] §-references resolve"
XR="$(dirname "${BASH_SOURCE[0]}")/check-xrefs.py"
if [[ -x "$XR" || -r "$XR" ]]; then
  if out=$(python3 "$XR" "$GP" 2>&1); then
    echo "$out" | sed 's/^/      /'; pass "no dangling §-references"
  else
    echo "$out" | grep DANGLING | sed 's/^  /  /' | while read -r l; do bad "$l"; done
    fail=1
    note "a §-ref pointing at nothing is §1.3's \"tenth class\" defect — an ordinal that resolved to nothing"
  fi
else
  note "check-xrefs.py not found — skipped"
fi

# ------------------------- 10. Serial-on integrity + §10 decision-row completeness
echo "[10] Serial-on targets exist; every §10 decision row is complete"
ids=$(awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/[ *]/,"",$2); print $2}' "$GP")
danglers=""
while IFS= read -r line; do
  id=$(printf '%s' "$line" | awk -F'|' '{gsub(/[ *]/,"",$2); print $2}')
  ser=$(printf '%s' "$line" | awk -F'|' '{print $(NF-2)}' | sed 's/\*\*//g')
  # only validate cells that look like a dependency list (row ids, commas, arrows)
  # Here-strings, NOT pipes. `grep -q` exits the moment it matches, which closes
  # the pipe under a still-writing `printf`; with `set -o pipefail` (line 15) that
  # SIGPIPE becomes the pipeline's exit status, and a SUCCESSFUL match is reported
  # as a failure. It is a race on the pipe buffer, so it is invisible on a
  # developer box and fires in CI — which is exactly what happened on run
  # 30603155333, where check [10] invented a dangling `P6→P3` that does not exist.
  grep -qE '^[[:space:]]*(—|$)' <<<"$ser" && continue
  # NO -i HERE, and it is load-bearing. With `-i` this heuristic reads ANY run of
  # four letters as prose — including UPPERCASE ROW IDS — so `PAPI`, `PMCP`,
  # `PSDK` and `PCLI` were silently skipped and never validated. Four rows'
  # dependencies went unchecked, among them P13, the terminal row, whose entire
  # Serial-on list is `P12, PR, PD, PAPI, PMCP, PSDK, PCLI`. Row ids are
  # uppercase-initial; prose is lowercase — that is the whole discriminator.
  grep -qE '[a-z]{4,}' <<<"$ser" && continue   # prose cell (e.g. PR's, "all above")
  # a cell may qualify a dependency by sub-artifact — "P3 (1); P6 (2)" — so drop
  # any "(n)" qualifier BEFORE tokenising, and never strip digits: ids carry them.
  ser_clean=$(printf '%s' "$ser" | sed -E 's/\([0-9]+\)//g')
  for t in $(printf '%s' "$ser_clean" | tr ',;' '  '); do
    t=$(printf '%s' "$t" | tr -d ' '); [[ -z "$t" ]] && continue
    grep -qx "$t" <<<"$ids" || danglers+="$id→$t "
  done
done < <(grep -E '^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|' "$GP")
if [[ -n "$danglers" ]]; then bad "Serial-on names a row that does not exist: $danglers"
else pass "every Serial-on target resolves to a real row"; fi

# §10's table: | Decision | Owner | Decide by | Blocks | Default | log_decision id |
inc=0; rows10=0
while IFS= read -r line; do
  n=$(printf '%s' "$line" | awk -F'|' '{print NF}')
  if [[ "$n" -lt 7 ]]; then skip10=$((${skip10:-0}+1)); continue; fi
  owner=$(printf '%s' "$line" | awk -F'|' '{gsub(/^ +| +$/,"",$3); print $3}')
  by=$(printf '%s'    "$line" | awk -F'|' '{gsub(/^ +| +$/,"",$4); print $4}')
  dflt=$(printf '%s'  "$line" | awk -F'|' '{gsub(/^ +| +$/,"",$6); print $6}')
  rows10=$((rows10+1))
  if [[ -z "$owner" || -z "$by" || -z "$dflt" ]]; then
    bad "§10 row missing owner/decide-by/default: $(printf '%s' "$line" | cut -c1-70)"; inc=$((inc+1))
  fi
done < <(awk '/^### Decisions blocked on a human/,/^### The #198 open product question/' "$GP" \
         | grep -E '^\| ' | grep -vE '^\| Decision|^\|---')
# NOTE: this selector is deliberately identical to check [11]'s. An earlier version
# required an alphanumeric first character and silently missed 4 of 21 rows — every
# row whose Decision cell opens with punctuation (e.g. `.node-version`). Two checks
# reading the same table must agree on which rows it has, or one of them is lying.
[[ $inc -eq 0 ]] && pass "$rows10 §10 decision rows each carry owner, decide-by and a default"
# §1.0's rule: never truncate silently. If this validated fewer rows than exist, say so.
if [[ "${skip10:-0}" -gt 0 ]]; then
  bad "$skip10 §10 row(s) NOT validated — fewer than 7 pipe-fields (escaped | inside a cell?)"
  note "a check that silently skips rows reports a pass it did not earn"
fi

# ------------- 11. §10's row count agrees with every prose claim about it (§5.39's rule)
echo "[11] §10 decision count agrees with the prose that counts it"
n10=$(awk '/^### Decisions blocked on a human/,/^### The #198 open product question/' "$GP" \
      | grep -E '^\| ' | grep -vE '^\| Decision|^\|---' | wc -l | tr -d ' ')
words=(zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen \
       fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three \
       twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty)
w=${words[$n10]:-$n10}
note "table has $n10 rows"
bad11=0
# the three shapes the document uses to count them
grep -qiE "\b${w} decisions are blocked on a human" "$GP" \
  || { bad "§1.4 does not say \"${w} decisions are blocked on a human\" (table has $n10)"; bad11=1; }
grep -qE "$((n10-1)) of the ${n10} §10 decisions" "$GP" \
  || { bad "§1.9 does not say \"$((n10-1)) of the ${n10} §10 decisions\""; bad11=1; }
grep -qiE "all ${w}\b" "$GP" \
  || { bad "§10's closing does not say \"all ${w}\""; bad11=1; }
[[ $bad11 -eq 0 ]] && pass "all three prose counts agree with $n10"

# ---------------- 12. the GitHub mirror of §2 has not drifted (needs network)
# Every §2 row has a `ladder`-labelled issue. Mirrors drift, so both directions
# are checked. Line numbers inside issue bodies are DECAYING CITATIONS by §4.1's
# argument — reported as drift, never failed on, because any insertion above a
# row moves them and that is ordinary editing.
echo "[12] the GitHub issue mirror of §2 matches"
mirror_ids() {
  awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/[ *]/,"",$2); print $2}' "$GP"
}
if ! command -v gh >/dev/null 2>&1; then
  bad "gh not on PATH — the mirror was NOT checked (a skip is not a pass)"
elif ! gh auth status >/dev/null 2>&1; then
  bad "gh not authenticated — the mirror was NOT checked (a skip is not a pass)"
else
  repo="${LADDER_REPO:-recursivlabs/minds}"
  jqf='.[] | [(.number|tostring), ((.title|capture("\\[LADDER\\]\\s+(?<r>[^ ]+)").r) // ""), ((.body|capture("goal-prompt\\.md#L(?<l>[0-9]+)").l) // "")] | @tsv'
  if ! tsv=$(gh issue list --repo "$repo" --label ladder --limit 100 --json number,title,body --jq "$jqf" 2>/dev/null); then
    bad "could not read $repo — the mirror was NOT checked (a skip is not a pass)"
  elif [[ -z "${tsv// /}" ]]; then
    bad "zero ladder issues returned — either none exist or the query broke; not a pass either way"
  else
    ids="$(mirror_ids)"
    parsed=0; orphan=0; drift=0; seen=" "
    while IFS=$'\t' read -r num rid line; do
      [[ -z "${rid:-}" ]] && continue
      parsed=$((parsed+1)); seen+="$rid "
      if ! grep -qx -- "$rid" <<<"$ids"; then
        bad "issue #$num claims row '$rid', which no longer exists in §2"; orphan=1; continue
      fi
      if [[ -n "${line:-}" ]]; then
        actual=$(sed -n "${line}p" "$GP" | sed -E 's/^\| \*\*([A-Za-z0-9]+)\*\* \|.*/\1/')
        if [[ "$actual" != "$rid" ]]; then
          real=$(grep -n "^| \*\*${rid}\*\* |" "$GP" | head -1 | cut -d: -f1)
          note "#$num deep link drifted: body says L$line, ${rid} is now L${real:-?}"
          drift=$((drift+1))
        fi
      fi
    done <<< "$tsv"
    if [[ $parsed -eq 0 ]]; then
      bad "parsed 0 issues from a non-empty response — the extraction is broken, not the repo"
    else
      missing=""
      while read -r r; do
        [[ -z "$r" ]] && continue
        [[ "$seen" == *" $r "* ]] || missing+="$r "
      done <<< "$ids"
      [[ -n "$missing" ]] && note "§2 rows with no [LADDER] issue: $missing(rows citing their own #issue in-cell are expected)"
      if [[ $orphan -eq 0 ]]; then
        pass "$parsed ladder issues parsed; every row id still present in §2"
        [[ $drift -gt 0 ]] && note "$drift deep link(s) drifted — re-point when convenient, not urgent"
      fi
    fi
  fi
fi

echo
if [[ $fail -eq 0 ]]; then
  echo "ALL CHECKS PASSED — denominator $denom, $rows table rows + #190, $pending pending / $nonroot blocked"
  exit 0
fi
echo "CHECKS FAILED — do not add a row, and do not start Cycle 0, until these pass."
exit 1
