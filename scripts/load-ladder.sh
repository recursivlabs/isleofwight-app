#!/usr/bin/env bash
# Cycle 0 — load §2's ladder into the dispatcher. §3.2's recipe, executable.
#
# Reads the nine scoring inputs from §3.1 and the title/N/Serial-on from §2 of
# docs/goal-prompt.md, then per row runs the recipe's four steps:
#   1  create_task            (title, description, effort, severity, signal, ui_impact, urgency)
#   2  update proximity + milestone
#   2b PATCH revenue/growth/mission/blocks   ← the four the MCP tools drop, weight 19
#   3  assert the returned score matches §3.1 within 1.0
#   4  status=blocked for every non-root
#
# The key is read from Infisical inside this script and never appears in argv,
# a file, or the shell history. DRY=1 prints the plan and calls nothing.
set -euo pipefail

GP="${GP:-docs/goal-prompt.md}"
ORIGIN="${MINDS_ORIGIN:-https://api.minds.com}"
ORG="${MINDS_ORG_ID:-019d517b-bb87-744d-92db-b3801dc15927}"
PROJ="${MINDS_PROJECT_ID:-019d5190-f0c0-717e-a1bd-ef9c335292b9}"
INFISICAL_PROJECT="${INFISICAL_PROJECT:-5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c}"
SECRET_NAME="${SECRET_NAME:-MINDS_NETWORK_API_KEY}"
DRY="${DRY:-0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRET_LOADER="$SCRIPT_DIR/read-infisical-secret.py"

if [ "$DRY" != "1" ]; then
  if KEY="$(python3 "$SECRET_LOADER" "$SECRET_NAME" --project-id "$INFISICAL_PROJECT" --env dev)"; then
    :
  else
    status=$?
    echo "GUARD FAILED: unable to load a validated $SECRET_NAME (loader exit $status)." >&2
    exit 1
  fi
  export KEY
fi
export ORIGIN ORG PROJ GP DRY

python3 - <<'PY'
import json, os, re, subprocess, sys, urllib.request, urllib.error

GP, ORIGIN, ORG, PROJ = os.environ['GP'], os.environ['ORIGIN'], os.environ['ORG'], os.environ['PROJ']
DRY = os.environ['DRY'] == '1'
KEY = os.environ.get('KEY', '')
# §3.2's own length-check pre-escapes `\|` before splitting; a cell containing a
# command pipe otherwise shifts every field right and silently truncates the exit.
src = [ln.replace(r'\|', '@ESC@') for ln in open(GP).read().split('\n')]

ROW = re.compile(r'^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|')
# ── §3.1: nine inputs per row id. Labels appear BOTH bold (**PS** wire …) and
#    plain (P2a branch protection) — matching only one form loses nine rows.
inputs = {}
for ln in src:
    m = re.match(r'^\|\s*(?:\*\*)?(P[0-9A-Za-z]+)(?:\*\*)?\s[^|]*\|((?:\s*\**[0-9]+\**\s*\|){10})\s*([0-9]+)\s*\|\s*\*\*([0-9.]+)\*\*\s*\|$', ln)
    if m:
        nums = [int(x) for x in re.findall(r'\d+', m.group(2))]
        if len(nums) == 10:
            inputs[m.group(1)] = dict(zip(
                'prox lev sig urg sev ui rev grow miss eff'.split(), nums)) | {'score': float(m.group(4))}

# ── §2: title, N, exit artifact, Serial-on ──────────────────────────────────
rows = []
for ln in src:
    if not ROW.match(ln): continue
    f = [c.strip() for c in ln.split('|')]
    if len(f) != 9: continue
    rid = f[1].strip('*')
    rows.append({'id': rid, 'title': f[2], 'n': int(f[3]), 'exit': f[4], 'serial': f[6]})

# The 27th row is off-ladder: #190 lives in §3.1 and in §1.0's load list, not in
# §2's table (its exit artifact is the GitHub issue's own A-grade capture).
m190 = re.search(r'^\|\s*\*\*#190([^|]*)\|((?:\s*\**[0-9]+\**\s*\|){10})\s*([0-9]+)\s*\|\s*\*\*([0-9.]+)\*\*\s*\|$',
                 '\n'.join(src), re.M)
if m190:
    nums = [int(x) for x in re.findall(r'\d+', m190.group(2))]
    inputs['#190'] = dict(zip('prox lev sig urg sev ui rev grow miss eff'.split(), nums)) | {'score': float(m190.group(4))}
    rows.append({'id': '#190', 'n': 3, 'serial': '—',
                 'title': '#190 chat attach/voice/retry sends to the WRONG conversation (web)',
                 'exit': ('Three network captures binding the outbound conversation_id to the visible '
                          'thread, committed under qa-media/ per the issue. Fix merged 2026-07-30 (PR #228); '
                          'the captures remain outstanding. Full definition: '
                          'https://github.com/recursivlabs/minds/issues/190')})

missing = [r['id'] for r in rows if r['id'] not in inputs]
print(f"§2 rows: {len(rows)} · §3.1 inputs matched: {len(rows)-len(missing)}"
      + (f" · MISSING {missing}" if missing else ""))
if missing: sys.exit("refusing to load: a row without published inputs cannot pass step 3")

HUMAN_ONLY = {'P0': 'Bill', 'P11': 'Bill', 'P12': 'Bill'}
roots = [r['id'] for r in rows if r['serial'] in ('—', '-', '')]
print(f"roots (Serial-on '—'): {roots}")

def api(method, path, body=None):
    url = f"{ORIGIN}/api/v1/dispatcher{path}" + ('&' if '?' in path else '?') + f"organization_id={ORG}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
        headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return {'_error': e.code, '_body': e.read().decode()[:300]}

loaded, failed = [], []
for r in rows:
    i = inputs[r['id']]
    desc = r['exit'][:15900]
    if r['id'] in HUMAN_ONLY:
        desc = (f"HUMAN-ONLY: an agent may prepare and stage this row but may not execute the named "
                f"action; executing it is a §1.7 violation.\n\n") + desc
    # The REST route requires an explicit `id` ("id and title are required") while
    # the MCP wrapper generates a slug — an undocumented divergence between the two
    # surfaces §3.2 already tracks. A STABLE id per ladder row is better than a
    # random one: a second run collides loudly instead of duplicating the ladder.
    plan = {'id': 'minds-ladder-' + r['id'].lstrip('#').lower(),
            'title': r['title'][:120], 'description': desc, 'effort': i['eff'],
            'severity': i['sev'], 'signal': i['sig'], 'ui_impact': i['ui'], 'urgency': i['urg'],
            'project_id': PROJ, 'milestone': 'R1', 'layer': 'launch-ladder', 'created_via': 'api'}
    if r['id'] in HUMAN_ONLY: plan['owner'] = HUMAN_ONLY[r['id']]

    if DRY:
        print(f"  {r['id']:5} eff={i['eff']} sev={i['sev']} prox={i['prox']} "
              f"rev={i['rev']} grow={i['grow']} miss={i['miss']} lev={i['lev']} "
              f"→ §3.1 {i['score']}  {'ROOT' if r['id'] in roots else 'blocked'}"
              + (f"  owner={HUMAN_ONLY[r['id']]}" if r['id'] in HUMAN_ONLY else ""))
        continue

    # UPSERT, and the title is deliberately NOT part of the update.
    #
    # Jack renamed every ladder row to plain English on the board — "Lock the
    # open /signals and /moderation routes — security (PS)" rather than §2's
    # "Wire `apiKeyAuth` onto `/signals/*` and `/moderation/*`". Those titles are
    # what a human reads on build.minds.com/roadmap, and they are better than
    # §2's, which are written for the ladder's own bookkeeping.
    #
    # A re-run that PATCHed `title` would silently revert all of them, and it
    # would do so under a green "loaded 27/27". So: title is set ONCE at create,
    # and an existing row keeps whatever it is called. §2 stays the authority on
    # what a row MEANS; the board is the authority on what it is CALLED. Nothing
    # else in the loop reads the title — claim/heartbeat/release key off the id.
    c = api('POST', '/tasks', plan)                                   # step 1: create
    tid = (c.get('data') or c).get('id')
    if not tid:
        # Already there — the stable id collides by design (see `plan` above).
        # Fall through to the scoring PATCHes on the EXISTING row rather than
        # skipping it, so a re-run still re-asserts scores after a §3.1 edit.
        tid = 'minds-ladder-' + r['id'].lstrip('#').lower()
        probe = api('GET', f'/tasks/{tid}', None)
        if not ((probe.get('data') or probe) or {}).get('id'):
            failed.append((r['id'], 'create', c.get('_error'), c.get('_body', '')[:120])); continue
        existing_title = ((probe.get('data') or probe) or {}).get('title')
        print(f"  {r['id']:5} exists — keeping board title: {str(existing_title)[:56]}")
    api('PATCH', f'/tasks/{tid}', {'proximity': i['prox'], 'milestone': 'R1'})   # step 2
    p = api('PATCH', f'/tasks/{tid}', {                                          # step 2b
        'revenue_impact': i['rev'], 'growth_impact': i['grow'],
        'mission_impact': i['miss'], 'blocks': [f"{r['id']}-edge-{k}" for k in range(i['lev'])]})
    # Step 3: RE-FETCH before asserting. The score is read from a GET, never from
    # the PATCH response — on the upsert path that response can omit `score`
    # entirely, and `.get('score')` then returns None, which the assertion read
    # as "does not match". That reported #190 as a MISMATCH while its live score
    # was 70.4367 against §3.1's 70.4: a missing KEY read as a wrong VALUE, which
    # is §5.50's rule turned on the script that is supposed to enforce §3.2.
    #
    # This assertion is the one that caught all 27 scores loading ~13% low and
    # self-consistently on the first Cycle-0 run. It is worth nothing if it cries
    # wolf, and worth less if a None can mask a real divergence.
    fetched = api('GET', f'/tasks/{tid}', None)
    got = ((fetched.get('data') or fetched) or {}).get('score')
    ok = got is not None and abs(float(got) - i['score']) <= 1.0                 # step 3
    if r['id'] not in roots:
        api('PATCH', f'/tasks/{tid}', {'status': 'blocked'})                     # step 4
    loaded.append((r['id'], tid, got, i['score'], ok))
    print(f"  {r['id']:5} → {tid[:44]:46} score {got} vs §3.1 {i['score']} {'OK' if ok else 'MISMATCH'}")

if DRY:
    print(f"\nDRY RUN — {len(rows)} rows would load, {len(roots)} roots pending / {len(rows)-len(roots)} blocked")
else:
    bad = [l for l in loaded if not l[4]]
    print(f"\nloaded {len(loaded)}/{len(rows)}; score mismatches: {len(bad)}; failures: {len(failed)}")
    for b in bad:    print("  SCORE-MISMATCH", b[0], b[2], "vs", b[3])
    for f_ in failed: print("  FAILED", f_)
PY
