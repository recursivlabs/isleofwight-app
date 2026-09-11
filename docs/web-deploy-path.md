# The web release path — what deploys `terrapin.minds.com`, and how to roll it back (PW sub-artifact 1)

**Every claim carries the command that produced it, run 2026-07-31.** §1.3's document-artifact form:
a second party re-runs any line here and gets the printed output.

## The answer

**The Recursiv platform deploys it, through Coolify, from `main`.** Not a hand step, not Vercel, not
Netlify, not this repo's CI.

```
$ curl -s -H "Authorization: Bearer $MINDS_KEY" \
    "https://api.minds.com/api/v1/deployments?limit=1&project_id=019d5190-f0c0-717e-a1bd-ef9c335292b9&organization_id=019d517b-bb87-744d-92db-b3801dc15927"

  type            : production
  status          : completed
  branch          : main
  commit_hash     : 6486972
  commit_message  : re-check: app onto @minds/sdk after github-auth check
  coolify_app_uuid: o6d84w31bv58aqeplf3r74ll
  coolify_domain  : minds.on.recursiv.io,minds.com
  deployment_url  : https://minds.com
  started_at      : 2026-07-30T14:56:04.943Z
  completed_at    : 2026-07-30T14:57:57.122Z
```

**121 deployment records exist for this project** (`…/deployments?limit=5&project_id=…` →
`121`), so this is the live mechanism with history, not a one-off.

**The trigger** is the Recursiv MCP `deploy_project` against project `019d5190-…`, as `AGENTS.md`
states — and unlike that file's version, this one is **verified by the mechanism's own response**
rather than cited as a lead.

## PW(1)(a) — the absence, anchored

The absence is only readable beside an anchor proving the command read the right tree:

```
$ git -C /home/bill/dev/recursivlabs-minds ls-tree origin/main --name-only -- eas.json app.json | wc -l
2                                    ← the anchor: this IS the Minds repo

$ git -C /home/bill/dev/recursivlabs-minds ls-tree origin/main --name-only -- vercel.json netlify.toml Dockerfile | wc -l
0                                    ← the absence: no web deploy config in this repo
```

`ci.yml`'s `build` job runs `pnpm exec expo export --platform web` and **stops** — it produces the
bundle and never ships it. Shipping is Coolify's, triggered off `main`.

## ⚠ The deployment record claims a domain it does not serve

`coolify_domain` lists **`minds.com`** and `deployment_url` reads **`https://minds.com`**. That is
not what `minds.com` serves:

```
$ for h in minds.on.recursiv.io terrapin.minds.com www.minds.com minds.com; do
    printf "%-26s " "$h"; curl -s "https://$h/" | grep -c "expo-root\|_expo/static"; done
minds.on.recursiv.io       1     ← Minds 2.0 (Expo web build)
terrapin.minds.com         1     ← Minds 2.0, same origin, branded name
www.minds.com              0     ← the LEGACY network
minds.com                  0     ← the LEGACY network
```

**So the Coolify app is configured for a hostname that DNS points elsewhere.** Nothing is broken
today — the two hosts that matter serve the app — but the platform's own `deployment_url` is
wrong, and anyone reading it to answer *"where did this deploy go?"* is misled to the legacy
network. §8's carve-out (this ladder does not repoint `minds.com`) is unaffected and unchanged;
what is recorded here is that the **deploy config already names the host the carve-out says we do
not touch.**

**Consequence for P13(3) and PW(2):** both prove against a host string. Read `deployment_url`
as *aspirational config*, never as *where the bytes landed* — the discriminator is the
`expo-root` grep above, not the platform's own field.

## What this document does NOT establish

- **PW(2) and PW(3) are untouched.** No deploy was performed here and no rollback was attempted.
  Both require the two discriminator strings committed **in advance** (PW's own rule, so the
  worker cannot pick the string the verifier greps for after the fact).
- **Rollback is unproven and there is a filed reason to doubt it.**
  `recursivlabs/recursiv#1905` records verbatim that the platform deploy surface has *"No rollback
  for user apps"* — `packages/server/src/features/deployment/` has only `deleteApp` and
  `cancelDeployment`. So "redeploy the previous build" is an **assumption about a surface a filed
  engine issue says is missing.** PW(3) must name its mechanism in the PR before attempting it.
- Whether `deploy_project` can be invoked by this loop's key is untested — the MCP tool exists but
  the dispatcher tools on that surface 401 (`recursiv#2039`; **fixed 2026-07-31 by recursiv#2056** —
  the tools authenticate now, but a deploy is still not something to fire as a probe).

## PW(3): the rollback mechanism, NAMED IN ADVANCE — 2026-07-31

PW(3) requires the mechanism named before the attempt. `recursiv#1905`'s doubt is about the
**platform** deploy surface, and it stands. But Coolify — the system of record — is a different
surface, and a read-only probe of it (2026-07-31, `GET /api/v1/applications/o6d84w31bv58aqeplf3r74ll`)
shows the app pins its build ref in a mutable field:

```
git_repository = recursivlabs/minds · git_branch = main · git_commit_sha = HEAD
```

**Primary mechanism — pin-to-previous-SHA and rebuild:**
1. `PATCH /api/v1/applications/o6d84w31bv58aqeplf3r74ll` body `{"git_commit_sha": "<previous SHA>"}`
2. `POST /api/v1/deploy?uuid=o6d84w31bv58aqeplf3r74ll`
3. Verify PW(2)'s pre-committed string pair flipped (previous → non-zero, candidate → 0).
4. Restore: PATCH `git_commit_sha` back to `"HEAD"`, redeploy.

**Verify-at-execution caveat (§5.50 — absence is not a value):** Coolify's PATCH allowlist is known
to refuse `source_id`/`source_type`/`git_full_url`/`private_key_id` ("This field is not allowed").
`git_commit_sha` is NOT on that refused list, but not-refused-in-past-attempts is not
accepted-by-contract: the first execution step is reading the PATCH response code, and a 4xx here
means fall through to the fallback, not improvise.

**Fallback mechanism — git-level revert:** `git revert` (or reset-to-SHA on a branch) pushed to
`main`. Requires no Coolify field at all, and the path is already proven end-to-end: five
push-triggered production deploys completed 2026-07-31 16:26–17:48Z (`3a6038824` … `0e98aceec`),
~4–7 min each. This fallback is also what makes the primary safe to attempt — a wedged
`git_commit_sha` pin is recovered by the same push-triggered rebuild.

**UI fallback:** Coolify's per-deployment *Redeploy* in the dashboard (UI-only; the deployments
API exposes no redeploy-by-uuid endpoint and `logs` is null over the API).

**What execution still requires, unchanged:** PW is serial on **P2a**; both discriminator strings
committed in the PR in advance; explicit authorization for the production deploys themselves —
naming the mechanism is this document's job, firing it is not.
