#!/usr/bin/env bash
# Re-point the [LADDER] issues' goal-prompt deep links after a controller edit.
#
# WHY THIS EXISTS: every §2 ladder row is mirrored to a GitHub issue whose body
# links `docs/goal-prompt.md#L<n>`. Those are LINE anchors in a file that edits
# itself, so any insertion above the §2 table shifts all twenty at once — a
# 14-line amendment drifted every one of them on 2026-08-01. §4.1 already made
# this argument for cross-repo citations ("a line number is a citation with a
# decay date") and replaced them with greppable anchors; the issue mirror is the
# one place still carrying raw line numbers, because GitHub blob URLs have no
# text-anchor equivalent to link to instead.
#
# So the numbers stay and the REPAIR becomes mechanical. check-controller.sh's
# check [12] already computes the exact old→new mapping and prints it; this
# parses that output and PATCHes each issue body. Nothing is re-derived here —
# if the checker and this script ever disagree, the checker is authoritative.
#
# RUN IT AFTER THE CONTROLLER EDIT MERGES, not before: the line numbers are
# read from the working tree, and re-pointing to a branch's numbers publishes
# links that are wrong on `main`.
#
# Usage:  scripts/repoint-ladder-links.sh          # dry run, prints what it would do
#         APPLY=1 scripts/repoint-ladder-links.sh  # actually PATCH the issues
set -uo pipefail

REPO="${REPO:-recursivlabs/minds}"
APPLY="${APPLY:-0}"

command -v gh >/dev/null || { echo "gh not found"; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "gh not authenticated — CANNOT-VERIFY, not NOT-TRUE"; exit 2; }

cd "$(git rev-parse --show-toplevel)" || exit 2

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" != "main" ] && [ "$APPLY" = "1" ]; then
  echo "REFUSING: on '$branch', not main. Line numbers must come from the merged file." >&2
  echo "Re-run after the controller edit lands on main." >&2
  exit 1
fi

drift=$(./scripts/check-controller.sh 2>&1 | grep 'deep link drifted' || true)

if [ -z "$drift" ]; then
  echo "No drift — every [LADDER] deep link already points at its row."
  exit 0
fi

echo "$drift" | wc -l | xargs printf 'drifted links: %s\n'
[ "$APPLY" = "1" ] || echo "(dry run — set APPLY=1 to write)"
echo

fail=0
while IFS= read -r l; do
  # "#273 deep link drifted: body says L1417, P13 is now L1431"
  l="${l#"${l%%[![:space:]]*}"}"   # strip the checker's leading indent before parsing
  num=$(sed -E 's/^#([0-9]+) .*/\1/' <<<"$l")
  old=$(sed -E 's/.*body says L([0-9]+).*/\1/' <<<"$l")
  new=$(sed -E 's/.* is now L([0-9]+)$/\1/' <<<"$l")

  # A missing capture would produce an empty sed pattern and rewrite nothing —
  # or worse, match everything. Refuse rather than guess.
  case "$num$old$new" in *[!0-9]*|'') echo "  SKIP unparseable: $l"; fail=1; continue;; esac

  printf '  #%-5s L%s → L%s' "$num" "$old" "$new"

  if [ "$APPLY" != "1" ]; then echo "  (dry run)"; continue; fi

  body=$(gh issue view "$num" --repo "$REPO" --json body --jq .body) || { echo "  FETCH FAILED"; fail=1; continue; }
  # Anchor the substitution to the filename so a bare "L1417" elsewhere in the
  # body — a quoted command, a line reference in prose — is never touched.
  updated=${body//goal-prompt.md#L$old/goal-prompt.md#L$new}

  if [ "$updated" = "$body" ]; then echo "  NO-OP (pattern not found in body)"; fail=1; continue; fi

  printf '%s' "$updated" > /tmp/repoint-$num.md
  if gh issue edit "$num" --repo "$REPO" --body-file /tmp/repoint-$num.md >/dev/null 2>&1; then
    echo "  updated"
  else
    echo "  PATCH FAILED"; fail=1
  fi
  rm -f /tmp/repoint-$num.md
done <<<"$drift"

echo
if [ "$APPLY" = "1" ]; then
  echo "Re-running the checker to confirm:"
  ./scripts/check-controller.sh 2>&1 | grep -c 'deep link drifted' | xargs printf '  remaining drifted: %s\n'
fi
exit $fail
