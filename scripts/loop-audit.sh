#!/usr/bin/env bash
# PA — the §1.5 circling detector, run unattended (docs/goal-prompt.md, row PA).
#
# Reads the loop log (recursivlabs/minds#206) and evaluates the mechanically-
# checkable subset of §1.5's symptom table AGAINST COMMENTS THIS WORKFLOW DID
# NOT AUTHOR, then posts one table per run carrying a SELF-AUDIT-RUN token.
# Honest about its limits: symptoms needing dispatcher access or §2 diffing
# are listed as NOT-EVALUATED rather than silently skipped.
#
# POST_MODE=post  → comment on the issue (workflow use)
# POST_MODE unset → print to stdout (local dry-run; never posts)
set -euo pipefail

REPO="${LOOP_REPO:-recursivlabs/minds}"
ISSUE="${LOOP_ISSUE:-206}"
RUN_ID="${GITHUB_RUN_ID:-local-dry-run}"
SELF_LOGINS='["github-actions","github-actions[bot]"]'

# `gh api --paginate --jq` runs the FILTER ONCE PER PAGE and concatenates the
# results, so this produced two JSON documents — `[…100…][…90…]` — not one array.
# Every jq below then ran twice, once per page, and every value was emitted
# twice. That is why the posted table had two verdicts in each cell, and it was
# not merely cosmetic: `.[-3:]` took the last three of a PAGE BOUNDARY rather
# than of the log, so "Frozen ranking" reported **FIRED** and `clear` in the
# same cell — the detector answering the same question two different ways, on
# an arbitrary slice, having audited neither.
#
# `--slurp` would fix it but does not exist before gh 2.46 (2.45.0 here), so
# take the raw pages and slurp with jq, which is portable.
json=$(gh api "repos/$REPO/issues/$ISSUE/comments" --paginate \
  | jq -s '[.[][] | {id, author: .user.login, body}]')

# Comments not authored by this workflow — the population §1.5 audits.
audited=$(jq --argjson self "$SELF_LOGINS" '[.[] | select(.author as $a | $self | index($a) | not)]' <<<"$json")
cycle_lines=$(jq '[.[] | select(.body | test("(^|\\n)CYCLE "))]' <<<"$audited")
n_cycles=$(jq 'length' <<<"$cycle_lines")
authors=$(jq -r '[.[].author] | unique | join(",")' <<<"$audited")
n_authors=$(jq '[.[].author] | unique | length' <<<"$audited")

row() { printf '| %s | %s | %s |\n' "$1" "$2" "$3"; }

# ── Symptom 1: MONITOR-DARK (P1's standing rule) ────────────────────────────
smoke=$(gh run list --repo "$REPO" --workflow=smoke.yml --limit 1 \
  --json conclusion --jq '.[0].conclusion // "none"')
if [ "$smoke" = "failure" ]; then s1="**FIRED — MONITOR-DARK**"; else s1="clear (latest smoke: $smoke)"; fi

# ── Symptom 2: baseline drift (denominator moved with no BASELINE line) ─────
s2=$(jq -r '
  [.[] | .body | capture("CONFIRMED (?<c>[0-9]+)/(?<d>[0-9]+)") | .d] as $ds
  | if ($ds | length) < 2 then "not armed (<2 cycle lines)"
    else ( [range(1; $ds|length) | select($ds[.] != $ds[.-1])] as $moves
      | if ($moves|length) == 0 then "clear (denominator stable at \($ds[-1] // "n/a"))"
        else "denominator moved \($moves|length) time(s) — verify a BASELINE line covers each"
        end )
    end' <<<"$cycle_lines")

# ── Symptom 3: three cycles at DELTA-DISTANCE 0 with nothing blocked ────────
s3=$(jq -r '
  [.[-3:][] | .body] as $b
  | if ($b|length) < 3 then "not armed (<3 cycle lines)"
    else ( [$b[] | test("DELTA-DISTANCE 0")] as $z
      | [$b[] | test("BLOCKED-ON-HUMAN *(none|$)")] as $nb
      | if ($z | all) and ($nb | all) then "**FIRED — 3 cycles at zero with nothing blocked**"
        else "clear" end )
    end' <<<"$cycle_lines")

# ── Symptom 4: frozen ranking (3 consecutive RESCORE none) ──────────────────
s4=$(jq -r '
  [.[-3:][] | .body | test("RESCORE none")] as $r
  | if ($r|length) < 3 then "not armed (<3 cycle lines)"
    elif ($r | all) then "**FIRED — 3 consecutive RESCORE none; check for input-bearing facts**"
    else "clear" end' <<<"$cycle_lines")

# ── Symptom 5: phantom progress, countersign clause ──────────────────────────
if [ "$n_authors" -lt 2 ]; then
  s5="SUSPENDED — COUNTERSIGN-UNAVAILABLE (single login: $authors), per §1.0"
else
  # `… as $claims | flatten as $c` does NOT flatten $claims — after an `as`
  # binding the pipe carries the ORIGINAL input forward, so `flatten` ran on the
  # comment array and `$c|length` was the number of COMMENTS. $claims was bound
  # and never read. This symptom has therefore always reported the comment count
  # under the label "token(s) claimed": the run before this fix printed "54
  # token(s) claimed" against a log containing zero CONFIRMED-THIS-CYCLE tokens.
  s5=$(jq -r '
    [.[] | .body | scan("CONFIRMED-THIS-CYCLE ([A-Za-z0-9#.\\-]+)=")] as $claims
    | ($claims | flatten) as $c
    | if ($c|length) == 0 then "clear (no CONFIRMED-THIS-CYCLE tokens yet)"
      else "\($c|length) token(s) claimed — verify each has a COUNTERSIGN comment from a second login"
      end' <<<"$audited")
fi

table=$(
  echo "## SELF-AUDIT-RUN ${RUN_ID}"
  echo
  echo "§1.5 evaluated unattended (row PA) against ${n_cycles} cycle line(s) from author(s): ${authors:-none}."
  echo
  echo "| §1.5 symptom | result | note |"
  echo "|---|---|---|"
  row "Phantom progress — MONITOR-DARK standing rule" "$s1" "gh run list --workflow=smoke.yml"
  row "Baseline drift" "$s2" "denominators parsed from CYCLE lines"
  row "Three cycles at DELTA-DISTANCE 0, nothing blocked" "$s3" "last 3 CYCLE lines"
  row "Frozen ranking" "$s4" "last 3 CYCLE lines"
  row "Phantom progress — countersign clause" "$s5" "author-count aware"
  echo
  echo "**Not evaluated here (needs dispatcher or §2 access):** re-auditing's N>3 exception, blocked-item drift, ladder-table sort, score/plan divergence. Those remain on the cycle-opening agent per §1.0."
  echo
  echo "Evaluated comment ids/authors: $(jq -r '[.[] | "\(.id)(\(.author))"] | join(" ")' <<<"$cycle_lines")"
  echo
  echo "_Run: https://github.com/${REPO}/actions/runs/${RUN_ID} — this comment is posted by the workflow and is never a §1.3 second party unless P2a's two conditions hold (§1.0)._"
)

if [ "${POST_MODE:-print}" = "post" ]; then
  gh api "repos/$REPO/issues/$ISSUE/comments" -f body="$table" --jq '.html_url'
else
  echo "$table"
fi
