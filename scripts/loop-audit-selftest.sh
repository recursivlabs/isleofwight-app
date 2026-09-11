#!/usr/bin/env bash
# loop-audit-selftest.sh — does the §1.5 detector answer about the WHOLE log?
#
# WHY THIS EXISTS. loop-audit.sh is PA: the circling detector that runs
# unattended so §1.5 is not enforced only by the population it audits. It ran
# green on a daily cron for four scheduled runs while posting tables like this
# (verbatim, from run 30738794256):
#
#     §1.5 evaluated unattended (row PA) against 42
#     27 cycle line(s) from author(s): ottman
#     ottman.
#
#     | Frozen ranking | **FIRED — 3 consecutive RESCORE none; …**
#     clear | last 3 CYCLE lines |
#
# Two verdicts in one cell, disagreeing, in a table that does not render. A
# green workflow run said nothing about any of it, because "the job exited 0"
# and "the detector answered the question" are different claims.
#
# The two defects, both fixed in #337:
#
#   PAGINATION — `gh api --paginate --jq` runs the FILTER ONCE PER PAGE and
#     concatenates. The comment set was two JSON documents, so every jq ran
#     twice. Not cosmetic: `.[-3:]` took the last three of a PAGE BOUNDARY
#     rather than of the log, so the detector answered on an arbitrary slice.
#
#   BINDING — `[…] as $claims | flatten as $c` does not flatten $claims. After
#     an `as` binding the pipe carries the ORIGINAL input, so $c was the COMMENT
#     COUNT and $claims was never read. The countersign symptom reported the
#     number of comments under the label "token(s) claimed".
#
# Both are the same failure the confirm script had: the code fetched the
# evidence and then computed something else. Neither is visible from a green
# run, an exit code, or a shellcheck pass — only from asserting on the OUTPUT.
#
# Usage:  bash scripts/loop-audit-selftest.sh
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$HERE/loop-audit.sh"
[[ -r "$TARGET" ]] || { echo "FATAL: cannot read $TARGET" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "FATAL: jq is required" >&2; exit 2; }

fails=0; ran=0
ok()  { printf '  ok    %-40s %s\n' "$1" "$2"; }
bad() { printf '  FAIL  %-40s %s\n' "$1" "$2"; fails=$((fails+1)); }

STUB="$(mktemp -d)"
trap 'rm -rf "$STUB"' EXIT

# A stub gh serving TWO pages, the way `--paginate` really emits them: two
# concatenated JSON documents, not one array. The whole pagination defect is
# invisible to a single-page fixture, so a one-page stub would be a test that
# cannot fail.
cat > "$STUB/gh" <<'STUBEOF'
#!/usr/bin/env bash
if [[ "$*" == *"/comments"* ]]; then cat "$FAKE_P1"; cat "$FAKE_P2"; exit 0; fi
if [[ "$*" == *"--workflow=smoke.yml"* ]]; then echo "success"; exit 0; fi
echo ""; exit 0
STUBEOF
chmod +x "$STUB/gh"

# Page 1: three cycle lines that WOULD fire frozen-ranking on their own.
# Page 2: three later ones that clear it. The honest answer over the whole log
# is `clear`; a page-sliced reading says FIRED. The halves disagree ON PURPOSE.
cat > "$STUB/p1.json" <<'EOF'
[{"id":1,"user":{"login":"alice"},"body":"CYCLE a\nCONFIRMED 1/113 RESCORE none"},
 {"id":2,"user":{"login":"alice"},"body":"CYCLE b\nCONFIRMED 2/113 RESCORE none"},
 {"id":3,"user":{"login":"alice"},"body":"CYCLE c\nCONFIRMED 3/113 RESCORE none"}]
EOF
cat > "$STUB/p2.json" <<'EOF'
[{"id":4,"user":{"login":"bob"},"body":"CYCLE d\nCONFIRMED 4/113 RESCORE moved"},
 {"id":5,"user":{"login":"bob"},"body":"CYCLE e\nCONFIRMED 5/113 RESCORE moved"},
 {"id":6,"user":{"login":"bob"},"body":"CYCLE f\nCONFIRMED 6/113 RESCORE moved"}]
EOF

audit() {  # <p1> <p2> -> the table on stdout
  FAKE_P1="$1" FAKE_P2="$2" POST_MODE= PATH="$STUB:$PATH" bash "$TARGET" 2>&1
}

echo "── LOOP AUDIT SELF-TEST ─────────────────────────────────────────────"
echo "target: $TARGET"
echo

OUT="$(audit "$STUB/p1.json" "$STUB/p2.json")"

# ── Case 1: the table is well-formed. ────────────────────────────────────────
# The doubling showed up first as broken markdown: a verdict containing a
# newline splits its row, and a table that does not render is not a report.
ran=$((ran+1))
body="$(sed -n '/^|---|/,/^$/p' <<<"$OUT" | grep -v '^|---|' | grep -v '^$')"
malformed="$(grep -vcE '^\|.*\|.*\|$' <<<"$body")"
n_rows="$(grep -cE '^\|.*\|.*\|$' <<<"$body")"
if [[ "$malformed" -ne 0 ]]; then
  bad "table rows are well-formed" "$malformed line(s) in the table are not rows — a verdict contains a newline"
  grep -vE '^\|.*\|.*\|$' <<<"$body" | sed 's/^/          /' | head -3
elif [[ "$n_rows" -lt 5 ]]; then
  bad "table rows are well-formed" "only $n_rows symptom row(s) — expected 5"
else
  ok "table rows are well-formed" "$n_rows symptom rows, no split cells"
fi

# ── Case 2: one verdict per symptom, and it is the WHOLE-LOG verdict. ────────
# The sharpest assertion in this file. Page-sliced, Frozen ranking reads FIRED;
# across the log it is clear. A detector that reports both has audited neither.
ran=$((ran+1))
frozen="$(grep '^| Frozen ranking' <<<"$OUT")"
if grep -q 'FIRED' <<<"$frozen"; then
  bad "frozen ranking reads the whole log" "FIRED on a log whose last 3 cycle lines are RESCORE moved — page-sliced"
elif ! grep -q 'clear' <<<"$frozen"; then
  bad "frozen ranking reads the whole log" "no verdict: $frozen"
else
  ok "frozen ranking reads the whole log" "clear — the last 3 across BOTH pages, not page 1's"
fi

# ── Case 3: counts and authors are single values, not one per page. ──────────
ran=$((ran+1))
hdr="$(grep -c 'cycle line(s) from author(s)' <<<"$OUT")"
if [[ "$hdr" -ne 1 ]]; then
  bad "header is one line" "$hdr header line(s) — the count was emitted per page"
elif ! grep -qE 'against 6 cycle line\(s\) from author\(s\): alice,bob\.' <<<"$OUT"; then
  bad "header is one line" "expected 6 lines from alice,bob — got: $(grep 'cycle line(s)' <<<"$OUT")"
else
  ok "header is one line" "6 cycle lines, authors alice,bob — both pages counted once"
fi

# ── Case 4: the countersign symptom counts TOKENS, not comments. ─────────────
# Six comments, zero CONFIRMED-THIS-CYCLE tokens. The binding defect reported
# "6 token(s) claimed" here, which is a number that looks like evidence.
ran=$((ran+1))
line="$(grep 'countersign clause' <<<"$OUT")"
if grep -qE '[0-9]+ token\(s\) claimed' <<<"$line"; then
  bad "counts tokens, not comments" "claimed tokens in a log that has none: $line"
else
  ok "counts tokens, not comments" "no tokens present, none claimed"
fi

# ── Case 5: …and it DOES count them when they are there. ─────────────────────
# Case 4 alone is satisfied by a symptom that can never report anything, which
# is the shape of a test that cannot fail. This is its positive control.
ran=$((ran+1))
jq '.[0].body += "\nCONFIRMED-THIS-CYCLE P1.1= CONFIRMED-THIS-CYCLE PW.1="' \
  "$STUB/p2.json" > "$STUB/p2tok.json"
tok_line="$(audit "$STUB/p1.json" "$STUB/p2tok.json" | grep 'countersign clause')"
if grep -qE '\b2 token\(s\) claimed' <<<"$tok_line"; then
  ok "positive control: 2 tokens counted as 2" "the symptom can report"
else
  bad "positive control: 2 tokens counted as 2" "got: $tok_line"
fi

echo
echo "ran $ran · failed $fails"
[[ "$fails" -eq 0 ]] || { echo "LOOP AUDIT SELF-TEST FAILED — the detector is not reading the whole log."; exit 1; }
echo "LOOP AUDIT SELF-TEST PASSED"
