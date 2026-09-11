#!/usr/bin/env bash
# mirror-to-board.sh — put each ladder row's GitHub issue onto build.minds.com.
#
# THE ASK (Bill, 2026-07-30): "i want to make sure that all issues are mirrored
# on github and build.minds.com. you should be able to pull up the rendered
# markdown in either site."
#
# WHAT IS ACTUALLY TRUE TODAY, measured rather than assumed:
#   · GitHub has the full issue: plain-English problem/solution + exit artifacts
#   · build.minds.com shows a task page whose only prose is a `notes` blob
#   · the two are NOT linked — every ladder task has `synced_at` set but
#     `syncs: []`, so the sync ran and recorded nothing
#   · the dispatcher task has NO `description` field at all (59 fields, none
#     named that), so the loader's 15900-char body was silently dropped on
#     create. `notes` is the only prose field, and it IS patchable.
#
# SO THIS IS A STOPGAP, and says so on every row it writes. The real fix is
# recursiv#2045 — a task↔GitHub sync reachable over REST/MCP, so the board
# renders the issue itself instead of a copy of its opening. Until that exists,
# a reader on build.minds.com gets the problem, the solution, and a link.
#
# WHY ONLY THE PLAIN-ENGLISH SECTIONS AND NOT THE WHOLE ISSUE: `notes` is a
# plain-text field rendered without markdown, and the §2 exit-artifact cells run
# to thousands of characters of nested backticks. Pasting those produces an
# unreadable wall and a false impression that the board holds the authoritative
# text. It does not — §2 on main does. The link is the artifact; the excerpt is
# the courtesy.
#
# Usage:  bash scripts/mirror-to-board.sh          (DRY=1 to preview)
set -uo pipefail

ORIGIN="${MINDS_ORIGIN:-https://api.minds.com}"
ORG="${MINDS_ORG_ID:-019d517b-bb87-744d-92db-b3801dc15927}"
PROJ="${MINDS_PROJECT_ID:-019d5190-f0c0-717e-a1bd-ef9c335292b9}"
REPO="${LADDER_REPO:-recursivlabs/minds}"
INFISICAL_PROJECT="${INFISICAL_PROJECT:-5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_LOADER="$SCRIPT_DIR/read-infisical-secret.py"

if KEY="$(python3 "$SECRET_LOADER" MINDS_NETWORK_API_KEY --project-id "$INFISICAL_PROJECT" --env dev)"; then
  :
else
  status=$?
  echo "FATAL: unable to load a validated MINDS_NETWORK_API_KEY (loader exit $status)" >&2
  exit 2
fi

command -v gh >/dev/null 2>&1 || { echo "FATAL: gh not on PATH" >&2; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "FATAL: gh not authenticated" >&2; exit 2; }

KEY="$KEY" ORIGIN="$ORIGIN" ORG="$ORG" PROJ="$PROJ" REPO="$REPO" DRY="${DRY:-0}" python3 - <<'PY'
import json, os, re, subprocess, urllib.request, urllib.error

ORIGIN, ORG, PROJ, REPO = (os.environ[k] for k in ("ORIGIN", "ORG", "PROJ", "REPO"))
KEY, DRY = os.environ["KEY"], os.environ["DRY"] == "1"

def api(method, path, body=None):
    url = f"{ORIGIN}/api/v1/dispatcher{path}" + ('&' if '?' in path else '?') + f"organization_id={ORG}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return {'_error': e.code, '_body': e.read().decode()[:200]}

# ---- the ladder issues on GitHub, by row id -------------------------------
# Selected by the `ladder` LABEL and the `[LADDER] <row>` title, which is the
# same discriminator check [12] of the controller gate uses. Anything else in
# the repo is not a ladder row and is left alone.
raw = subprocess.run(
    ['gh','issue','list','--repo',REPO,'--label','ladder','--state','all','--limit','100',
     '--json','number,title,body'], capture_output=True, text=True).stdout
issues = {}
for it in json.loads(raw or '[]'):
    m = re.match(r'\[LADDER\]\s+(\S+)', it['title'])
    if m:
        issues[m.group(1).lower().lstrip('#')] = it

# ---- rows whose issue predates the [LADDER] convention ---------------------
# Seven §2 rows cite their own issue in-cell instead of having a `[LADDER]`
# wrapper — the shape check [12] of the gate already calls expected. Mapped
# EXPLICITLY, never by "first #N in the cell": P11 cites #186 and P13 cites
# #190, but those are cross-references to other rows' work, not their own
# issues, so a first-match rule would mis-map both.
#
# #184 is deliberately absent. It looked like P3's issue by title
# ("fix(android): unbreak app launch") and is a MERGED PULL REQUEST —
# `gh api repos/.../issues/184 --jq 'if .pull_request then ...'`. Mirroring a
# PR body onto a ladder row would put a changelog where the reasoning belongs.
OWN_ISSUE = {'p5': 185, 'p9': 197, 'p10': 200, 'p7': 188,
             'p6': 187, 'p8': 196, '190': 190}
for rid, num in OWN_ISSUE.items():
    if rid in issues:
        continue
    got = subprocess.run(['gh','issue','view',str(num),'--repo',REPO,
                          '--json','number,title,body'], capture_output=True, text=True)
    if got.returncode == 0 and got.stdout.strip():
        issues[rid] = json.loads(got.stdout)

def section(body, name):
    """Pull one '## <name>' section.

    Stops at the next '## ' heading, a '---' rule, OR the '**Ladder row' block
    the ladder issues append after the prose. The first version stopped only at
    '## ', so on every ladder issue the solution excerpt ran on into the row's
    score and exit artifacts — a wall of metadata under a heading that promised
    a sentence. Verified against issue #210, whose solution is followed by
    '---' then '**Ladder row PS — score 101.8**'.
    """
    m = re.search(rf'^##\s*{re.escape(name)}\s*$(.*?)(?=^##\s|^---\s*$|^\*\*Ladder row|\Z)',
                  body or '', re.M | re.S)
    return re.sub(r'\n{3,}', '\n\n', m.group(1).strip()) if m else ''

def squash(s, limit):
    s = re.sub(r'`{1,3}', '', s)                  # backticks render as literals here
    s = re.sub(r'\*\*(.+?)\*\*', r'\1', s)        # bold likewise
    s = re.sub(r'\s+', ' ', s).strip()
    return s if len(s) <= limit else s[:limit - 1].rsplit(' ', 1)[0] + '…'

rows = (api('GET', f'/tasks?limit=100&layer=launch-ladder&project_id={PROJ}') or {}).get('data', [])
print(f"  {len(rows)} ladder tasks · {len(issues)} [LADDER] issues on GitHub")

done = skipped = failed = 0
for t in sorted(rows, key=lambda r: -(r.get('score') or 0)):
    rid = str(t.get('id', '')).replace('minds-ladder-', '')
    it = issues.get(rid)
    if not it:
        print(f"    {rid:<6} no [LADDER] issue — left alone"); skipped += 1; continue

    prob = squash(section(it['body'], 'Plain-English problem'), 700)
    soln = squash(section(it['body'], 'Plain-English solution'), 700)
    if not prob and not soln:
        print(f"    {rid:<6} #{it['number']} has no plain-English sections — left alone"); skipped += 1; continue

    url = f"https://github.com/{REPO}/issues/{it['number']}"
    keep = (t.get('notes') or '').strip()
    # Never clobber a status note a loop wrote. The mirror block is delimited so
    # a re-run replaces only itself.
    keep = re.split(r'\n*— mirrored from GitHub', keep)[0].strip()
    block = (f"— mirrored from GitHub {url} —\n"
             f"PROBLEM: {prob}\n"
             f"SOLUTION: {soln}\n"
             f"Full issue, exit artifacts and the authoritative §2 cell: {url} "
             f"(stopgap until recursiv#2045 renders the issue here directly)")
    notes = (keep + "\n\n" + block).strip() if keep else block

    if DRY:
        print(f"    {rid:<6} #{it['number']} would write {len(notes)} chars"); done += 1; continue
    r = api('PATCH', f"/tasks/{t['id']}", {'notes': notes[:4000]})
    if r.get('_error'):
        print(f"    {rid:<6} FAILED {r['_error']} {r.get('_body','')[:60]}"); failed += 1
    else:
        print(f"    {rid:<6} #{it['number']} ✓ {len(notes)} chars"); done += 1

print(f"\n  {'would write' if DRY else 'written'} {done} · skipped {skipped} · failed {failed}")
PY
