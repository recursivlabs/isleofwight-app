#!/usr/bin/env bash
# Mirror GitHub issues onto the Minds network as markdown posts.
#
# Owner directive 2026-07-30 (Bill): every issue readable on GitHub AND on
# build.minds.com / terrapin.minds.com, rendered as markdown on both.
#
# The app renders markdown in posts (components/PostCard.tsx →
# lib/markdown.renderMarkdownToHtml) and the API stores the format
# (post.content_format, 'plain' | 'markdown' — engine db/schema.ts). So a
# mirrored issue is a real post, not a link.
#
# IDEMPOTENT by a committed mapping, docs/issue-mirror.json: issue number →
# post id. A rerun PATCHes changed issues and creates only new ones. Without
# the mapping every run would duplicate the whole set, which is the failure
# mode this file exists to avoid — and why the mapping is committed rather
# than derived from a search over post text.
#
# DRY=1 prints what it would do and calls nothing.
# ONLY=<n> mirrors a single issue (use this first on a fresh checkout).
set -uo pipefail

REPO="${MIRROR_REPO:-recursivlabs/minds}"
ORIGIN="${MINDS_ORIGIN:-https://api.minds.com}"
WEB="${MINDS_WEB:-https://terrapin.minds.com}"
MAP="${MIRROR_MAP:-docs/issue-mirror.json}"
INFISICAL_PROJECT="${INFISICAL_PROJECT:-5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c}"
SECRET_NAME="${SECRET_NAME:-MINDS_NETWORK_API_KEY}"
DRY="${DRY:-0}"
ONLY="${ONLY:-}"
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
export REPO ORIGIN WEB MAP DRY ONLY

python3 - <<'PY'
import json, os, subprocess, sys, urllib.request, urllib.error

REPO, ORIGIN, WEB, MAP = (os.environ[k] for k in ('REPO', 'ORIGIN', 'WEB', 'MAP'))
DRY, ONLY, KEY = os.environ['DRY'] == '1', os.environ.get('ONLY') or '', os.environ.get('KEY', '')

def gh(*args):
    return subprocess.run(['gh', *args], capture_output=True, text=True).stdout

issues = json.loads(gh('issue', 'list', '--repo', REPO, '--state', 'open', '--limit', '100',
                       '--json', 'number,title,body,labels,url,updatedAt') or '[]')
if ONLY:
    issues = [i for i in issues if str(i['number']) == ONLY]
issues.sort(key=lambda i: i['number'])

mapping = {}
if os.path.exists(MAP):
    mapping = json.load(open(MAP))

def api(method, path, body=None):
    req = urllib.request.Request(f"{ORIGIN}/api/v1{path}",
        data=json.dumps(body).encode() if body is not None else None, method=method,
        headers={'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return {'_error': e.code, '_body': e.read().decode()[:200]}

def render(i):
    labels = ' '.join(f"`{l['name']}`" for l in i.get('labels', []))
    # The GitHub link is FIRST and unconditional: a mirror that cannot be
    # traced back to its source is a second copy, not a mirror.
    head = (f"# {i['title']}\n\n"
            f"**GitHub:** {i['url']}  ·  **#{i['number']}**"
            + (f"  ·  {labels}" if labels else "") + "\n\n---\n\n")
    body = (i.get('body') or '_No description._').strip()
    tail = ("\n\n---\n\n_Mirrored from GitHub by `scripts/mirror-issues.sh`. "
            "GitHub is the source of truth; edit there and re-run the mirror._")
    out = head + body + tail
    # The server cap is 5000 — `content: z.string().min(1).max(5000)` in the
    # engine's posts route, NOT the 16000 the dispatcher allows. Found by a 400
    # on the one issue long enough to exceed it (#200 at 5,721 chars), which is
    # why the limit is read from the source rather than guessed: a cap guessed
    # too high fails only on the rare long issue, which is exactly the one
    # nobody notices is missing from the mirror.
    LIMIT = 5000
    if len(out) > LIMIT:
        note = f"\n\n---\n\n**Truncated — read the full issue on GitHub:** {i['url']}"
        cut = out[:LIMIT - len(note) - len(tail) - 8].rsplit('\n', 1)[0]
        out = cut + note + tail
    return out

created = updated = unchanged = failed = 0
for i in issues:
    n = str(i['number'])
    content = render(i)
    known = mapping.get(n)
    if known and known.get('updatedAt') == i['updatedAt']:
        unchanged += 1
        continue
    if DRY:
        print(f"  {'UPDATE' if known else 'CREATE'} #{n} {i['title'][:60]}")
        continue
    if known:
        r = api('PATCH', f"/posts/{known['post_id']}", {'content': content, 'content_format': 'markdown'})
        if r.get('_error'):
            print(f"  FAIL update #{n}: {r['_error']} {r.get('_body','')[:90]}"); failed += 1; continue
        mapping[n] = {**known, 'updatedAt': i['updatedAt']}
        updated += 1
        print(f"  updated #{n} → {known['post_id']}")
    else:
        r = api('POST', "/posts", {'content': content, 'content_format': 'markdown'})
        pid = (r.get('data') or r).get('id')
        if not pid:
            print(f"  FAIL create #{n}: {r.get('_error')} {r.get('_body','')[:90]}"); failed += 1; continue
        mapping[n] = {'post_id': pid, 'updatedAt': i['updatedAt'], 'url': f"{WEB}/post/{pid}"}
        created += 1
        print(f"  created #{n} → {WEB}/post/{pid}")

if not DRY:
    json.dump(dict(sorted(mapping.items(), key=lambda kv: int(kv[0]))), open(MAP, 'w'), indent=2)
    open(MAP, 'a').write('\n')

print(f"\n{len(issues)} issue(s) · created {created} · updated {updated} · unchanged {unchanged} · failed {failed}")
if not DRY:
    print(f"mapping: {MAP}")
sys.exit(1 if failed else 0)
PY
