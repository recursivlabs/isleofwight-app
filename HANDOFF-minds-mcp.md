# HANDOFF → session with Minds MCP

**Snapshot 2026-07-30 — if a command contradicts this file, the command wins.**
Depth: `HANDOFF-context.md`. **Both are TRACKED on purpose** (`ccd06f0`, so LAUNCH-PROMPT resolves
off this machine) — they name secret *locations*, never values. Do not re-exclude without fixing it.

## ⚠ 0. THE SUNSET IS TOMORROW

`recursiv:docs/MINDS.md` @ `Media (images/video): NOT migrated yet`: **74,278 of 74,282 media refs
point at `cdn.minds.com`, sunset-gated ~July 31.** Today is 07-30 — images/video on 244k imported
posts break if it goes dark. **Verify it** — that file was last touched 2026-06-24.

**It does NOT outrank the ladder** — this file said "nothing outranks it"; §10.23 retracted that
wording. Row `PM` enters at **55.9, in score order**, below PS, P0, P2a and five others.

## 0b. Run first

```bash
cd /home/bill/dev/recursivlabs-minds && git fetch --all --prune
./scripts/check-controller.sh   # 12 checks; the plan against itself
gh issue list -s open -L 100    # authoritative
gh pr list; git log --oneline --branches --not --remotes
```

## 1. Confirm MCP — `claude mcp list` CANNOT detect this failure

It prints `minds: ✔ Connected` **in the exact broken state this file fixes.** Restarting attaches
`mcp__minds__*` but they still fail — every data tool answers `Invalid API key.`; only `whoami` works.
**AMENDED 2026-08-06 — the failure MOVED and this paragraph's diagnosis is stale.** Re-run through the
actual tools after recursiv#2056 (which closed #2039): `mcp__minds__list_tasks(project_id=019d5190-…,
organization_id=019d517b-…)` → **`403 "Not a member of the organization specified by
organization_id"`** — auth now works; **org membership is the one remaining gap.** Same 403 with the
org id omitted. So the fix owner changed: not an API-key rotation but **adding the MCP server's
identity to the Minds org** (`add_org_member`, needs a Minds org admin — Bill). Until that grant, the
REST path below remains the binding transport, unchanged. The false-green lesson stands verbatim:
`✔ Connected` and a working `whoami` still prove nothing about data tools.
**Plan on `mcp__recursiv__*`**; its writes are **UNPROVED** (`get_project` 403s) — get Bill's yes first. `list_tasks` takes **`project_id` alone**; **`limit` is mandatory** (default 20 truncates
silently). `minds` is **project-scoped to this dir**.

## 2. SUPERSEDED — do not mirror issues into the dispatcher

```
MINDS_ORG_ID     = 019d517b-bb87-744d-92db-b3801dc15927  (minds server only — §1)
MINDS_PROJECT_ID = 019d5190-f0c0-717e-a1bd-ef9c335292b9  (Minds 2.0)
```

This file used to say "mirror all open issues." **Don't** — that adds ~19 non-ladder rows to the queue
§1.0's `layer="launch-ladder"` filter exists to survive. Cycle 0 loads **23 ladder rows** and
dispositions the **7** existing tasks via `archive_task`. Set `project_id` on every call.

## 3. Hazards

- **CI is GREEN on `main` since 07-30** (#207+#180 merged; first green `f0400ea`) and `smoke.yml`
  — the production monitor — is green again. Never `--no-frozen-lockfile` on `main`. #8/#9/#29
  stale + CONFLICTING (close-or-mine comments posted). **Still no branch protection (P2a)**; PR only.
- #184 **merged 07-30** — Android boot fixed on `main`; needs a NATIVE build to reach devices
  (Kotlin, no OTA). #186 (Jack, decide-by 07-31) is the open go-forward call.
- **`update_task(status:"archived"\|"done")` → HTTP 400**; use `archive_task` / `complete_task`. The
  controller prescribes this correctly now — this file's old "top open defect" note was stale.
- **Never `eas update`; never sideload a `main` build onto the Pixel** — `production` hits real users,
  `preview` is its only good build, `internal` doesn't exist. Channel is compiled in, so
  `eas.json` edits cannot fix installed builds (#185).

## 4. State

- **Pixel `29021FDH30044X` has the FIXED build** (channel `preview`), app `com.minds.app`
  2.0.1/vc3; ignore `com.minds.mobile*` (5.x). Two vc3 builds: see context.md.
- **The controller is ON `main` since #225** (`docs/goal-prompt.md` — 26 rows, 113 artifacts,
  0 confirmed), with the gate live in CI. Still branch-only: `launch-readiness-backlog` (33 items),
  `surface-priorities`. **Never cite a grader score** — §0 deletes that block and forbids
  justifying anything by one.

## 5. Humans decide — not you

Open-source layer (#195) · track-player on New Arch (#186, **Jack**) · username aliases vs
identities (#189) · scope of the #197 monetization gate.

**PRs** = §9's six headings, **What remains unproved** non-empty (copy #184's). **Issues** = first two
+ **## A-grade verification** in a fence. Unit tests never close an item; **a subagent is never the
second party (§1.9c)**.
