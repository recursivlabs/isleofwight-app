# PW(3) — the production rollback drill, strings committed IN ADVANCE

PW's cell requires both discriminator strings committed **before** the rollback, "because otherwise
the worker chooses, after the fact, the very string (3)'s verifier greps for." This file is that
advance commitment, and it is a state machine the CI second party reads: `scripts/confirm-artifacts.sh`'s
PW.3 predicate keys off the `state:` line below.

state: complete

candidate-sha: da6978005a29aa4ad61db4172bafd67cdab65e14
candidate-string: index-3a4e0759f5bb88c720d4cf07b3341fac
previous-sha: bbc68f5be1ef7506ab7db9872f2304de7816b34d
previous-string: index-e6b2828c548d6519dc58288cba3fc992

## Why these four values — each carries the command that produced it (§1.3's document rule)

**The candidate string is what production serves today**, not a value chosen by the worker:

```
$ curl -s https://minds.on.recursiv.io/ | grep -oE 'index-[a-f0-9]{32}' | head -1
index-3a4e0759f5bb88c720d4cf07b3341fac
```

**The candidate SHA is what Coolify last deployed** (Coolify is the system of record —
`docs/web-deploy-path.md`; the platform's own deployment list ends 2026-07-31 while live moved):

```
$ curl -s -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
    "https://cloud.recursiv.io/api/v1/deployments/applications/o6d84w31bv58aqeplf3r74ll" \
  | jq -r '.deployments[0] | .commit + " " + .status'
da6978005a29aa4ad61db4172bafd67cdab65e14 finished
```

Every commit after `b6c1ae0` (#332) touches only `scripts/`, `docs/`, `.github/` — verified with
`git log --format="%h" b6c1ae0..origin/main -- . ':!scripts' ':!docs' ':!.github' ':!*.md'` → empty —
so the served bundle has been byte-stable across them, which is why the candidate SHA (`da69780`)
and the bundle-changing SHA (`b6c1ae0`) differ and both are named.

**The previous string is what production actually served immediately before the candidate bundle,
and the previous SHA is the commit Coolify built to produce it** — not a local rebuild, which was
tried and does NOT reproduce prod hashes (local export of `da69780` → `index-890586c5…` ≠ live;
the build environment participates in the hash, so only served history is honest evidence):

- Coolify: deploy of `bbc68f5` created `2026-08-02T17:58:21Z`, status `finished` (command above,
  `?skip=10`); the next deploy (`b6c1ae0`) was created `18:03:17Z`.
- The CI second party's countersign run posted at `2026-08-02T18:04Z` observed
  `index-e6b2828c548d6519dc58288cba3fc992` served — after `bbc68f5` finished, before `b6c1ae0`'s
  build completed. The 18:06Z run observed the candidate string, and every countersign since has
  (`gh issue view 206 --json comments`, PW.2's pasted output per run).

## The protocol

1. **This file merges to `main` first** — the advance commitment. In `state: armed`, PW.3:
   - live serves candidate only → **SKIP** ("drill armed, window not open") — an armed drill that
     has not begun is CANNOT-VERIFY, not NOT-TRUE, and must not read as a regression;
   - live serves previous only → **CONFIRM** — the mid-window pair, re-executed by the verifier;
   - anything else → **FAIL** (an unexpected bundle mid-drill is a real alarm).
2. **Rollback**: Coolify `PATCH /api/v1/applications/o6d84w31bv58aqeplf3r74ll` setting
   `git_commit_sha` to the previous SHA, then `POST /api/v1/deploy?uuid=o6d84w31bv58aqeplf3r74ll`.
   Watch the deployment record's own status — never the platform mirror (recursiv#2055).
3. **Mid-window**: dispatch `confirm.yml` (`gh workflow run confirm.yml`). Its PW.3 comment on #206
   is the pair pasted by a party that did not perform the rollback — the CI second party is a
   required check under P2a's contexts, satisfying §1.0's conditions (a) re-execution in-run and
   (b) required-check status.
4. **Roll forward**: PATCH `git_commit_sha` back to `HEAD`, deploy, verify live serves the
   candidate string again (PW.2's own predicate re-covers this on the next run).
5. **PR B** flips `state:` to `complete` and appends the mid-window evidence below: the verifying
   run id and the pair as executed inside it. In `state: complete`, PW.3 asserts this file still
   carries the demonstrated markers (the PAPI.4 form: the drill happened once; the evidence is
   committed; re-running the rollback on every confirm would make the second party a production
   deploy driver on a schedule, forever).

## Mid-window evidence (appended by PR B)

Drill performed 2026-08-03 ~13:20–13:45Z. The verifying run — dispatched mid-window, authored by
`github-actions` inside the required `confirm` check, by a party that did not perform the rollback —
re-executed the pair itself and posted it to #206:

verify-run: 30817769190
mid-window-prev: 1
mid-window-cand: 0

```
$ h=$(curl -s --max-time 30 https://minds.on.recursiv.io/); echo "prev=$(grep -c index-e6b2828c548d6519dc58288cba3fc992 <<<"$h") cand=$(grep -c index-3a4e0759f5bb88c720d4cf07b3341fac <<<"$h")"
prev=1 cand=0
```

**The mechanism that actually rolled back is NOT the one step 2 above prescribed, and the
difference is a finding.** `PATCH git_commit_sha` is stored by Coolify and **ignored by deploys** —
measured: with the app pinned to `bbc68f5…`, the triggered deploy recorded `commit: d0f2293` (HEAD)
and live never left the candidate bundle. §1.1's second corollary: the field is present and not fit.
What Coolify honors is the **branch**, so the working rollback is: push `pw3-rollback-target`
pinned at the previous SHA → `PATCH git_branch` to it → deploy (finished, live flipped to the
previous string) → verify → `PATCH git_branch` back to `main` → deploy (finished, candidate
restored, re-coverable by PW.2's own predicate on every subsequent run). Filed upstream as the
concrete missing-rollback evidence continuing recursiv#1905. The `pw3-rollback-target` branch is
left in place deliberately: it is the reusable rollback lever, and §1.7 forbids an agent deleting
branches in any case.
