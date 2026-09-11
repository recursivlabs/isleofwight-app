# P0 — Two-phase rotation runbook: the Mac's plaintext `sk_live_` + 2 Infisical creds

Ladder row **P0** (`HUMAN-ONLY`, §1.7, `owner=Bill`). This runbook is the agent-permitted
staging: it enumerates every consumer, fixes the order of operations, and embeds the exact
exit-artifact commands. **No agent executes any step in §3 — Bill runs them.**
No secret value appears in this file; keys are named by store + name + prefix.

## 1. The keys in scope

| # | Where it lives | Name / location | Prefix |
|---|---|---|---|
| K1 | Mac, plaintext in `~/.zshrc` (§10.3 known offender) | identity confirmed at rotation time by the `sha256sum` in exit artifact (1) | `sk_live_…` |
| K2 | Infisical `5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c` / `dev` | `MINDS_NETWORK_API_KEY` | `sk_live_hUH1…` |
| K3 | Infisical, same project/env | `RECURSIV_DISPATCHER_KEY` | `sk_live_Rz_o…` |
| K4 | Infisical, same project/env | `build.minds.com` | `sk_live_5fQI…` |

The row says "+ 2 Infisical creds" — which two of K2–K4 depends on which one K1 duplicates;
K1's identity is established by comparing its `sha256sum` (never the value) against each.
If K1 matches none, all three Infisical keys plus K1 rotate — four keys, same procedure.

**Enumeration hygiene:** `infisical secrets --plain` prints VALUES. To list names only:
`infisical secrets --projectId … --env dev --plain | cut -d= -f1`. The 2026-07-31 staging
pass learned this the hard way — the values landed in a session transcript, which K2 was
already exposed to via `~/.claude.json` on the Linux box (see consumer km-2 below).

## 2. Consumers — every place a rotated key must be re-provisioned (enumerated 2026-07-31)

**K2 `MINDS_NETWORK_API_KEY`** (bill@minds.com, Minds network — the loop's own credential):
- km-1: Infisical `dev` env (the store itself)
- km-2: Linux box `~/.claude.json` → `minds` MCP server `Authorization` header (`https://api.minds.com/mcp`)
- km-3: any shell that exported it for REST loop-driving (Linux box history; Mac unknown until the gitleaks sweep)

**K3 `RECURSIV_DISPATCHER_KEY`** (bill@social.dev, platform orgs, `api.recursiv.io`):
- kr-1: Infisical `dev` env
- kr-2: recursiv repo Actions secret `DISPATCHER_API_KEY` (rotated by prior art `rotate-dispatcher-key.yml`; that workflow also pushes to Coolify app envs `STAGING_API_APP_UUID` / `PRODUCTION_API_APP_UUID`)
- kr-3: recursiv repo Actions secret `RECURSIV_API_KEY` — **verify at rotation time whether this is the same key or a distinct one; do not assume** (§5.50: print, don't infer)

**K4 `build.minds.com`**:
- kb-1: Infisical `dev` env
- kb-2: whatever build.minds.com session/config consumed it — **unenumerated; the gitleaks
  sweep on the Mac (exit artifact 3's path list) is the discovery mechanism, not memory**

**CI secret inventory at staging time** (names only): minds repo = `QA_EMAIL`, `QA_PASSWORD`
(no `sk_live_` consumer); recursiv repo = 30 secrets of which `DISPATCHER_API_KEY` and
`RECURSIV_API_KEY` are the `sk_live_` candidates.

## 3. The rotation — Bill only, two-phase, never revoke first

**Phase A — provision-new (per key):**
1. Mint the replacement key in the dashboard as the same account/network the old key
   belongs to (no self-service API/MCP mint exists — §10.18/PAPI(1)).
2. Re-provision every consumer in §2 for that key (Infisical value, `~/.claude.json`
   header, GitHub Actions secret via `gh secret set`, Coolify app envs via the prior-art
   workflow pattern).
3. Verify each consumer works on the NEW key before touching the old one
   (`whoami`/`users/me` per surface).

**Phase B — revoke-old (per key), producing the three exit artifacts:**
1. **Artifact (1), paired transcript, one terminal session on the Mac:** `date -u`; then
   `curl -s -H "Authorization: Bearer $OLD" $ORIGIN/api/v1/users/me` → `200` + user id;
   `sha256sum <<< "$OLD"`; revoke in the dashboard; `date -u`; same curl from the same
   shell variable → `401`; `sha256sum <<< "$OLD"` again (same hash = same string sent twice).
2. **Artifact (2), provider-side:** the provider API/dashboard response showing the key id
   `revoked`, pasted with the request line + HTTP status, re-runnable by a second party
   from the key id alone; plus screenshot committed at
   `qa-media/p0-2-<provider>-<key-id-prefix>.png`, key id and state in the same frame.
3. Remove the plaintext line from `~/.zshrc` (and anything the before-scan found).
4. **Artifact (3), paired gitleaks on the Mac, same path list both halves:** transcript
   carries `hostname`, `sw_vers`, `gitleaks version`, and the printed path list —
   at minimum: `~/.zshrc ~/.zprofile ~/.bashrc ~/.bash_profile ~/.config ~/.claude.json
   ~/.claude ~/Library/Application Support/Claude` plus any credential stores the
   before-scan adds. BEFORE: exits non-zero, report names the `~/.zshrc` finding
   (positive control), committed `qa-media/p0-3-<hostname>-<date>-before.json`.
   AFTER: identical command exits `0`, committed `…-after.json`.
   (`gitleaks` is absent on the Linux box — this runs on the Mac by necessity, §1.2 cl. 5.)

**Rollback:** re-provision (Phase A is repeatable); never un-revoke.

## 4. Order across keys

Rotate K2 last. It is the loop's own credential (km-2): rotating it mid-session kills the
MCP connection doing the verifying. Sequence: K3 → K4 → K1 (if distinct) → K2, each
completing Phase B before the next begins, so at most one credential is in flux at a time.
