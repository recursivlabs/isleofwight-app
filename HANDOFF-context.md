# HANDOFF → new session with Minds MCP attached

*Written 2026-07-28 by the prior session, then fact-checked against the live machine the same
day. Every claim below was re-run, not remembered. **Do not delete this file** until Bill
confirms the handoff landed.*

> ## ⚠ WHAT CHANGED SINCE 2026-07-28 — read this before trusting anything below
>
> **This file is a dated snapshot and its timestamps are provenance, not drift.** It is deliberately
> NOT rewritten: its value is being a faithful record of what was true that day, re-run rather than
> remembered. Where it now disagrees with the live estate, the live estate wins. The material deltas,
> each re-verified 2026-07-30:
>
> - **`scripts/check-controller.sh` now exists** — 12 checks asserting the controller against itself.
>   Run it before working from any of this. Its gate workflow is **live in CI** at
>   `.github/workflows/controller-gate.yml` since 07-30 (green), but not yet a required check — `P2a`.
> - **The controller is 26 rows / 113 artifacts / 0 confirmed**, not the figures any older doc quotes.
>   `PR` (RLS) and `PD` (`recursiv.app`) entered 07-29 (§5.38); `PAPI`/`PSDK`/`PMCP`/`PCLI` entered
>   07-30 as launch-blocking rows, denominator 100 → 113 (§5.46).
> - **"Nothing outranks the CDN sunset" is RETRACTED** (§10.23). Row `PM` enters at **55.9, in score
>   order**. `HANDOFF-minds-mcp.md` carried that retracted wording until 07-30.
> - **Never cite a grader score for the controller** — its §0 deletes the self-assessment block and
>   forbids justifying anything by one. Older docs quoted `86.3/100`.
> - **The Minds project has 7 pending tasks, not 10** — and *do not* mirror GitHub issues into the
>   dispatcher: that pollutes the queue §1.0's `layer="launch-ladder"` filter exists to survive.
>   Cycle 0 loads the 23 ladder rows and dispositions the 7 via `archive_task`.
> - **The CI break is diagnosed and fixed**: `main`'s lockfile lost `patchedDependencies` while
>   `pnpm-workspace.yaml` still declares it, so every PR died at `pnpm install`. **#207** fixes it;
>   `lint`/`typecheck` still need **#180**.
> - **`recursiv.app` moved to Cloudflare**; `minds.recursiv.app` still returns `000` on an **expired
>   Vercel certificate** (grey-cloud record through to Vercel). DNS resolving is not the artifact.
> - **Cross-repo citations are now anchors, never line numbers** (§4.1) — the engine moved twice in
>   one day and 7 of 22 cited lines had drifted (§5.42). **The six `file:line` citations below are
>   left as-is on purpose**, for the same reason §5 keeps its own: a snapshot records what it read.
> - **A subagent is never the second party or the countersigner** (§1.9c).

**First command, before you trust anything below:**

```bash
cd /home/bill/dev/recursivlabs-minds
grep -qxF 'HANDOFF-*.md' .git/info/exclude || echo 'HANDOFF-*.md' >> .git/info/exclude
git fetch --all --prune
gh pr list --state open --json number,title,headRefName,mergeStateStatus
gh issue list --state all --limit 60 --json number,title
gh pr checks 180; gh pr checks 184
git log --oneline --branches --not --remotes    # unpushed local work
```

This file is a snapshot. Where those commands contradict it, **the commands win.**
The `.git/info/exclude` line is not optional: this repo is **public**, this file is untracked
and *not* gitignored (`git check-ignore -v HANDOFF-minds-mcp.md` → exit 1), and one `git add -A`
publishes the Infisical project id and the note that a bearer token sits plaintext in
`~/.claude.json`. Use `.git/info/exclude`, not `.gitignore` — the ignore rule itself must not be
committed.

---

## Why you exist

The prior session did a full launch-readiness audit of Minds and filed it all on GitHub. It could
**not** file into the Minds org: the `minds` MCP server was configured and reported `✔ Connected`,
but its tools were never attached to the session. **You are supposed to have them.**

**Do not use `claude mcp list` as your check — it cannot see this failure.** Right now
`claude mcp list` prints `minds: https://api.build.minds.com/mcp (HTTP) - ✔ Connected`, the
handshake log shows `Successfully connected (transport: http)` with `hasTools:true`, and there is
still **no `mcp__minds__*` tool available**. That green check is exactly what the broken state
looks like.

**The real check:** confirm a tool literally named `mcp__minds__whoami` (or any `mcp__minds__*`)
is callable. If none exists, the server is connected but unattached — same bug — and Job 1 is
blocked. `mcp__recursiv__*` is **not** a substitute for filing: it is a different deployment
(`mcp__recursiv__get_project` on the Minds project id returns *"You do not have access to this
project"*). It *can* read tasks in that project, which matters below.

---

## Persistent memory — read it, and fix its index

Two memories were written today at
`/home/bill/.claude/projects/-home-bill-dev-recursivlabs-minds/memory/`:

- **`recursiv-mcp-otp-failed-to-fetch.md`** — OTP fails on the first attempt and works on the
  retry, on both Recursiv MCP (`failed to fetch`) and build.minds.com (`invalid OTP`). If your
  key/MCP setup hits an OTP error, **retry once before debugging**.
- **`onboarding-username-prompt-bug.md`** — the evidence behind issue **#189** and open decision
  #3: sign-in re-prompted for a username and minted `bill-1` on the same account.

**Known inconsistency — fix it.** The two index files disagree: `…/MEMORY.md` (project root)
lists both memories; `…/memory/MEMORY.md` lists only the OTP one. Read both memory files directly
regardless of what any index says, then reconcile the indexes.

---

## Job 1 — mirror the audit into the Minds org (the reason for this handoff)

**Paraphrase, not a quote.** Bill's ask as the prior session understood it: audit items get filed
in the Minds org that owns build.minds.com and terrapin.minds.com, and mirrored on GitHub,
everything synced. The exact wording is not preserved, so treat the mirror as **a plan to
confirm**, not a green light. Creating tasks in a live org is not a dry run.

**Target IDs** (from `recursiv/docs/MINDS.md:83-85`, confirmed in `AGENTS.md:10-12`):

```
MINDS_NETWORK_ID = 0f1fcb0f-11c0-41f2-9406-943a88f48b59
MINDS_ORG_ID     = 019d517b-bb87-744d-92db-b3801dc15927
MINDS_PROJECT_ID = 019d5190-f0c0-717e-a1bd-ef9c335292b9   (Minds 2.0 / "Terrapin")
```

**Three things that decide whether this job succeeds:**

1. **Start with `cwd = /home/bill/dev/recursivlabs-minds`.** The `minds` server is registered
   **project-scoped** in `~/.claude.json` (`projects['/home/bill/dev/recursivlabs-minds'].mcpServers`
   = `['minds']`); only `recursiv` is global. Start anywhere else and `minds` is simply absent.
2. **`minds` and `recursiv` expose identical tool names.** The handshake log shows
   `api.build.minds.com/mcp` identifying as `"Recursiv — AI agent platform with recursive
   self-improvement" v0.1.0` — same server software, different deployment. Every call for this job
   must carry the `mcp__minds__` prefix. Sanity-check with `mcp__minds__whoami` first.
3. **The project is not empty, and you can already see it.** `mcp__recursiv__list_tasks` with
   `project_id=019d5190-…` returns **10 existing tasks** (Minds cutover beat-1, [Reveal] WS1–WS6,
   three done native passes). The filter is genuinely applied — a bogus project id returns
   *"No tasks found matching filters."* So **reconcile before creating**: list what exists, show
   Bill the create/skip diff, get a yes, then file.

**`create_task` has no URL field.** Schema is `title / description / project_id /
organization_id / owner / severity / urgency / signal / ui_impact / effort / milestone / layer /
created_by / created_via`. Put the GitHub link as the **first line of `description`** in a fixed
form — `GitHub: https://github.com/recursivlabs/minds/issues/185` — so the two systems can be
reconciled by text search. Set `project_id` explicitly every time.

**Issues to mirror — all live on `recursivlabs/minds`:**

| GH | Sev | Title (short) |
|---|---|---|
| #185 | P0 | Internal sideload builds publish to the PRODUCTION OTA channel |
| #186 | P0 | react-native-track-player unsupported on New Architecture (decision) |
| #187 | P1 | No crash telemetry on iOS/Android; CI never compiles native |
| #188 | P1 · upstream | Session API key never expires / cannot be revoked |
| #189 | P1 · upstream | Onboarding re-prompts username; can silently rename a user |
| #190 | P1 | Chat retry/attach/voice-note can send to the WRONG conversation |
| #191 | P1 | Failed image upload still publishes the post |
| #192 | P1 | Returning to feed discards all loaded pages + scroll position |
| #193 | P1 | Web ships one 1.14 MB gz chunk |
| #195 | P1 | Choose the open-source layer + add a LICENSE (owner decision) |
| #196 | P1 · upstream | No automated moderation — gates every autonomy workstream |

Those 11 are the **entire** issue list on the repo (`gh issue list --state all --limit 100` →
185–193, 195, 196 and nothing else).

**Do not hand-roll bidirectional sync.** GitHub↔dispatcher has no built-in sync; real sync is a
webhook integration and its own project. Prior session's recommendation, **unconfirmed by Bill**:
GitHub is the source of truth, the dispatcher task carries the issue URL. Get Bill's call before
building anything more.

**The GitHub half is *not* done — it covers backlog items 1–9 only.** Backlog **items 10–14 are
unfiled and are never mentioned elsewhere in this handoff's issue table**:

- 10 — production web deploy ships zero security headers
- 11 — drafts/bookmarks/mutes/preferences survive sign-out under global keys (shared browser)
- 12 — push token registered on every sign-in, never unregistered
- 13 — PostHog stamps `$current_url` on every event → a live **password-reset token can be
  exfiltrated** on an error
- 14 — **68 open Dependabot advisories on `main` (4 critical / 35 high / 23 medium / 6 low)**,
  marked *"must be triaged before the store build"*

So the true unfiled set is **backlog items 10–33 — 24 items, all P2**, not 19. The earlier "19"
came from starting at Tier 4; Tier 3 (items 10–14) is headed `## TIER 3 — Security hardening &
data hygiene (P2)` and is equally unfiled. **Ask Bill before bulk-filing any of them.**

*Notation:* `#NNN` in this document always means a GitHub issue/PR on `recursivlabs/minds`.
Backlog entries are cited as **"backlog item N"** with no `#` — `#15`, `#20`, `#29`, `#33` are all
real, unrelated PRs on this repo, and writing "#15–#33" for backlog items misleads.

---

## Job 2 — the dispatcher rule the prior session broke

**The rule is on disk, in full — the prior session wrongly recorded it as transcript-only.**

- `/home/bill/dev/recursiv/CLAUDE.md:30-44`, `## Dispatcher Workflow (MANDATORY)`:
  *"No PR without a claimed dispatcher task."* Then the procedure: **1. check `list_tasks` — is
  there already a task for this? 2. if yes → `claim_task` with your name; 3. if no →
  `create_task` then `claim_task`; 4. do the work, push PRs; 5. `complete_task` with notes.*
  Applies to *all* work, "even quick one-liners." Owner identifier is a name: `bill`, `jack`.
- The onboarding doc Bill pasted is unmerged but recoverable at
  `/home/bill/.claude/paste-cache/7d4ea677f722c334.txt` — line 79 is the verbatim
  "Dispatcher first" rule.

**Step 1 is the one the prior session skipped, and skipping it is how you create duplicates.**

**Five PRs were opened today with no dispatcher task behind them** — #180, #181, #183, #184, #194
(not two). None of the tasks in the Minds project matches them (10 then; **7** as of 07-30). Retro-file them, or get Bill's
ok to leave them. Do not repeat it for new work.

---

## Current state

**Repo:** `/home/bill/dev/recursivlabs-minds` (GitHub `recursivlabs/minds`, **public**, no LICENSE,
no README on `main`). Also cloned today: `/home/bill/dev/battlechat`,
`/home/bill/dev/inverted-world`, plus `/home/bill/dev/recursiv` (platform engine, private).

**Read `AGENTS.md` (78 lines) before you touch code.** It is the repo's only onboarding doc —
there is no `CLAUDE.md` and no project `.claude/` directory, so nothing loads it for you. The
load-bearing sections are *Footguns (real, learned the hard way)* and *✅ Already done — DO NOT
repeat*. Two hard rules from it: every API call goes through `@recursiv/sdk`, never raw `fetch`;
never bump `@recursiv/sdk` ahead of the deployed API. **PR #194 modifies `AGENTS.md`** — rebase
rather than making a competing edit.

**Read the backlog — it is not in your working tree.** The checkout is on `docs/goal-prompt`;
`ls docs/` returns only `goal-prompt.md` and `x-parity.md`, and the file is not on `main` either:

```bash
git show origin/docs/launch-readiness-backlog:docs/launch-readiness-backlog.md > /tmp/backlog.md
```

33 numbered items across 7 tiers. Its own line 3 says "28" — wrong, fix it in the PR that merges
it. Items 15–19 and 29–33 live in a table and a numbered list, so `grep '^### '` will not find
them; that is what caused the earlier undercounts. A branch deletion erases this file, which is
why merging it is the first backlog task.

**Open PRs — 8 total. Merge in this order:**

| # | Branch | PR | State |
|---|---|---|---|
| 1 | `fix/fresh-clone-toolchain-and-lint` | **#180** | Fixes the single `biome` **error** that makes `check` fail on every other PR, and adds `packageManager: pnpm@10.28.0`. **Needs an unpushed commit first — see below.** |
| 2 | `fix/android-black-screen-trackplayer` | **#184** | Device-verified boot fix; the app does not boot on `main` without it. |
| 3 | `fix/metro-pnpm-patch-watch-crash` | **#183** | `metro.config.js` only. |
| 4 | `docs/env-example-stale` | **#181** | `.env.example` only. |
| 5 | `docs/readme-and-mission` | **#194** | README (repo had none) + golden-rule rationale in `AGENTS.md`. |
| — | `docs/launch-readiness-backlog` | — | No PR yet. The audit source of truth. |
| — | `docs/goal-prompt` | — | No PR yet. **B-grade, unresolved** — see below. |

Stale, not ours, all `CONFLICTING/DIRTY`: **#8, #9** (Apr 2026) and **#29** (May 2026), by
`jotto141`. Raise with Jack whether to close; do not try to rescue them.

**On merge order — the reason is CI, not the lockfile.** #180 and #184 both touch
`pnpm-lock.yaml`, and it is tempting to warn about a conflict. I tested it: a detached worktree
off `origin/main`, merge #180 then #184, gives *"Automatic merge went well"* on `pnpm-lock.yaml`
both ways. **There is no lockfile ordering hazard.** #180 goes first because until it lands,
`check` fails at Lint on everything else.

### Unpushed work — do this before anything else

`git rev-list --count origin/fix/fresh-clone-toolchain-and-lint..fix/fresh-clone-toolchain-and-lint`
returns **3**. Two are duplicates: `d51d6c7` and `7e0059a` have the same `git patch-id --stable`
as #184's `c535504` (`59611bde…`) and `efaf5d0` (`4c4439d2…`). Drop them. The third is not a
duplicate and is load-bearing:

- **`6eab9f0` — `ci: drop the pinned pnpm version input, read packageManager instead`.** #180 adds
  `packageManager` to `package.json`, which makes `pnpm/action-setup@v4` fail *immediately*:
  `Error: Multiple versions of pnpm specified`. #180's own `check` job dies at that step with
  everything after it skipped. `6eab9f0` removes `with: version: 10` from all three action-setup
  steps (`ci.yml` check + build, `smoke.yml`). **Without it #180 can never go green, and #180 is
  what everything else is queued behind.**

Cherry-pick `6eab9f0`, drop the two duplicates, force-push, confirm `gh pr checks 180`.

### CI is red everywhere right now — pre-existing, not yours

- `main` carries one `biome` **error**: `app/(tabs)/notifications.tsx:432:39
  lint/complexity/useOptionalChain`. `npx biome lint app components lib` → *"Found 1 error. Found
  150 warnings."* Only the error fails the job.
- `check` runs Lint before Typecheck and Unit tests, and `build` has `needs: check`, so every open
  PR shows `check fail` / `build skipping` / `mergeStateStatus: UNSTABLE`. The last two CI runs on
  `main` itself are `failure`.
- **There is no branch protection and no rulesets** (`gh api …/branches/main/protection` → 404,
  `gh api …/rulesets` → `[]`), so nothing physically stops a red merge. Per `AGENTS.md:48` a push
  to `main` is the deploy trigger. **Report the merge order to Bill and get an explicit ok — do
  not merge into `main` yourself on the strength of this document.**

**Identity and access.** `git config user.email` = `Bill@minds.com`; `gh auth status` = account
**`ottman`**, scopes `admin:public_key, gist, read:org, repo`, HTTPS. Collaborators on
`recursivlabs/minds`: `ottman`, `jotto141`, `recursiv-code-review`. You **cannot** publish to npm
— `npm whoami` → `ENEEDAUTH`, so anything requiring a `@recursiv/sdk` release is blocked on Bill.
Sign commits with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

Local checkout is on `docs/goal-prompt`, clean apart from this file. Local `main` is 4 behind.

---

## The phone

A **Pixel 7 Pro** (`29021FDH30044X`, `cheetah`) is attached over USB — `adb devices -l` sees it
now. Installed: `com.minds.app`, `versionName 2.0.1 / versionCode 3`, `lastUpdateTime 2026-07-28
13:49:07`.

The build on it is the **fixed** one — bundle `commitTime 2026-07-28T16:51:17.361Z`, built with
the `preview` EAS profile (`{"expo-channel-name":"preview"}`). The broken build is
`2026-07-28T14:37:17.285Z`.

**`main` is still broken.** Do not `adb install` anything built from `main` onto this phone until
#184 lands — you will put the black screen back on Bill's device.

---

## The one P0 you must not get wrong

**#185 — internal builds on the production OTA channel.** The remediation in the original issue
body was **wrong** and is corrected in
[a comment](https://github.com/recursivlabs/minds/issues/185#issuecomment-5108954270).

The channel is **compiled into the binary**. The probative evidence is the *pair* of APKs, and the
prior session's write-up (and that GitHub comment) cited the wrong half of it — they quoted
`preview`, which shows the mechanism but not the failure. Re-run:

```
installed.apk  (the APK pulled off the device, commitTime 2026-07-28T14:37:17.285Z)
  AndroidManifest.xml → expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
                      → {"expo-channel-name":"production"}     ← the bug, in a shipped sideload APK
preview.apk / now.apk  (commitTime 2026-07-28T16:51:17.361Z)
                      → {"expo-channel-name":"preview"}        ← the same key, different build
```

An APK with `channel=production` can only have come from the `android-internal` profile —
`eas.json` gives it `"extends": "production", "distribution": "internal", "channel":
"production", buildType apk`. So: editing `eas.json` fixes future builds only; every
already-installed `android-internal` APK requests `production` forever. **The fix is a rebuild +
tester reinstall, not a config edit.** Correct the comment on #185 while you are there.

**There is no `internal` channel.** `eas.json` defines exactly four: `development`, `preview`,
`production`, and `android-internal` → `production`. An `eas update --channel internal` would
publish to a channel no installed binary requests, and you would think the P0 was fixed. The
cutover is four steps or none: (a) change `android-internal.channel` to a real new non-production
name, (b) rebuild that profile, (c) `eas update --branch <branch> --channel <that same name>`,
(d) testers reinstall. **An EAS build and an `eas update` are outward-facing and cost quota — get
Bill's explicit go-ahead before running either.**

---

## Hard-won gotchas — these cost real time today

1. **Two APKs can be byte-different but look identical.** Both builds were `versionName 2.0.1 /
   versionCode 3`, so `adb shell dumpsys package` is useless. Cheapest discriminator is
   `sha256sum` of the pulled APK (`05dd5795…` broken vs `77446105…` fixed). When you want a
   human-readable build timestamp, read the embedded bundle's `commitTime`:
   ```bash
   unzip -p base.apk assets/app.manifest | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(new Date(JSON.parse(d).commitTime).toISOString()))'
   ```
   A whole debugging cycle was lost to an accidentally-reinstalled old APK.
2. **`gh`/`eas` gotchas:** `eas build:view` **rejects** `--non-interactive` (a poller silently
   returned `UNKNOWN` for 9 minutes). EAS log files need `curl --compressed` or you get binary
   garbage.
3. **Check egress yourself — do not assume it is blocked.** Earlier today `api.recursiv.io` and
   `api.build.minds.com` (both `34.71.80.160`) timed out from Bash, and the first draft of this
   handoff told you to drive Chrome for any HTTP against them. **That is stale.** As of the end of
   the session: `curl -sS https://api.recursiv.io/health` → `{"status":"ok","version":"1.0.0",…}`
   in 0.3 s. Run that one-liner first. Only if it hangs fall back to `mcp__claude-in-chrome__*` —
   and note **two browsers are connected**, `Browser 1` (Linux, local,
   `2fa0b995-5df3-412b-aa1e-63324f3e3dd6`) and `Browser 2` (macOS, not local,
   `0689b388-b272-45b4-bbdb-0ddd814a767f`), so you must ask Bill which one before any browser action.
4. **Kotlin does not coerce expression bodies to `Unit`.** `fun f(): Unit = scope.launch {}` fails
   with `Return type mismatch: expected 'Unit', actual 'Job'`. The block body `fun f() {
   scope.launch {} }` is required. This burned a full EAS build; the reasoning is in commit
   `c535504` so nobody retries it.
5. **`pnpm patch-commit` adds a duplicate `patchedDependencies` to `package.json`** while this repo
   declares it in `pnpm-workspace.yaml`. Revert the `package.json` hunk; keep only the lockfile change.
6. **`pnpm install` aborts without a TTY** (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`). Set `CI=true`.
7. **Never put a secret on a command line.** The prior session wrote that `HISTCONTROL` is unset —
   that was measured in a *non-interactive* shell. In Bill's interactive shell it is set:
   `~/.bashrc:13` → `HISTCONTROL=ignoreboth`, and `bash -ic 'echo $HISTCONTROL'` confirms
   `ignoreboth`. So a **leading space** does keep a command out of `~/.bash_history` — but that is
   fragile to rely on and does not apply to every shell you might spawn. Prefer `read -rs` or
   command substitution from Infisical for anything like `infisical secrets set KEY=<value>`.

---

## Artifacts on disk — your own scratchpad is empty

Everything the day produced is under the **prior** session's scratchpad,
`/tmp/claude-1000/-home-bill-dev-recursivlabs-minds/5fc0fd26-5829-4127-bfe6-3951c600b540/scratchpad/`.
Your session gets a different UUID and an empty directory. `/tmp` is not durable — copy what you need.

| File | What it is |
|---|---|
| `backlog.md` | Byte-identical copy of `docs/launch-readiness-backlog.md` (verified with `diff`). |
| `goal-prompt.md` | Working copy — **differs from** the committed `docs/goal-prompt.md`, which is newer. Use the committed one. |
| `installed.apk` | The **broken** build, `commitTime …14:37:17.285Z`, channel `production`. The #185 evidence. |
| `preview.apk` / `now.apk` / `device-now.apk` | The **fixed** build, `…16:51:17.361Z`, channel `preview`, all three identical (`sha256 77446105…`). |
| `build.log`, `gradle.log`, `full.log` | EAS / Gradle output from the track-player builds. |
| `dev-hq/` | Clone of Bill's private notes repo (incl. `minds-security-audit-2026-02-18.md`). |

**No logcat was saved** — `find … -iname '*logcat*'` returns nothing. The counts in #184's
*How it was tested* exist only in the PR body. Re-capture if you need them.

---

## MCP setup (only if no `mcp__minds__*` tool exists)

OAuth **does not work**: `api.build.minds.com/.well-known/oauth-authorization-server` → `404
{"error":"Not Found"}` while `api.recursiv.io` returns `200` with full metadata including
`registration_endpoint`. Dynamic Client Registration fails and you get an empty `SDK auth
failed:`. Both re-verified from Bash today. **Worth reporting to Jack** — it blocks anyone
connecting Minds MCP by OAuth.

The working path is the API key. **Guard the token fetch** — `infisical secrets get --plain` exits
**0 with zero bytes** on a miss (wrong projectId, expired login, renamed secret), so without the
guard you register a server with `Bearer ` and no error:

```bash
cd /home/bill/dev/recursivlabs-minds
TOKEN=$(infisical secrets get 'build.minds.com' \
  --projectId 5bf5f9f7-1a2f-4f42-867d-1b544fd7fb7c --env dev --plain)
[ ${#TOKEN} -ge 20 ] || { echo "infisical returned nothing — it exits 0 on a miss. Fix auth/projectId."; exit 1; }
claude mcp add --transport http --scope local minds https://api.build.minds.com/mcp \
  --header "Authorization: Bearer $TOKEN"
```

`claude mcp add` **refuses to overwrite** an existing name (`MCP server minds already exists in
local config`) — verified — so running it is safe. If you must replace the entry,
`claude mcp remove minds` first, but only after the length guard passes. Pass `--scope local`
explicitly; the entry must land under `projects['/home/bill/dev/recursivlabs-minds']`.

Infisical naming trap: the project named **`recursiv`** (`c1e6c9e8-…`) contains a `minds`
*environment*; the build.minds.com token lives in a **separate** project (`5bf5f9f7-…`, env `dev`,
secret `build.minds.com`). Three different things are called "minds."

Debug at `~/.cache/claude-cli-nodejs/-home-bill-dev-recursivlabs-minds/mcp-logs-minds/`.

**Note:** the token is **plaintext in `~/.claude.json`** (`sk_…`, 39 chars). Bill accepted this
knowingly; the cleaner alternative is a project `.mcp.json` with `${VAR}` expansion sourced via
`infisical run`.

---

## Open decisions — Bill's, not yours

1. **Which layer goes open source** (#195) — app / SDK / whole platform. Determines whether "make
   your own Minds" means "fork our app" or "run our platform." Nothing about the community thesis
   can be planned until this is answered.
2. **track-player on New Architecture** (#186) — keep patching / replace with `expo-audio` / ship
   without lockscreen audio.
3. **Username model** — aliases on one account vs toggleable identities in a master account.
   Jack's call. Neither justifies prompting at sign-in.
4. **GitHub↔dispatcher sync model.**

---

## `docs/goal-prompt.md` — read the header, but obey §3 and §8 from your first action

It **did not earn an A**. Three grading rounds returned **B / C / B**, unchanged each round.
Published at its real grade with six unresolved flaws listed at the bottom. Do not treat its
*plans* as authoritative until they are closed.

**But §3 and §8 are not in dispute — follow them immediately.** All six flaws are about stale
citations, Phase numbering, the #185 remediation, and §6.3's token-matching check. **None of them
touches §3 or §8.**

- **§3 — the evidence bar (line 69).** Nothing is graded higher than its evidence. If you reasoned
  it from source and did not run it, write **UNPROVED** and name the run that would settle it.
- **§8 — PR and issue format (line 356), mandatory.** Six headings, exactly these:
  `## What users experience` · `## Why it is broken` · `## What the fix changes` ·
  `## How it was tested` · `## What remains unproved` · `## How to roll it back`. **"What remains
  unproved" must be non-empty** — "a PR with an empty UNPROVED section is a PR that has not been
  thought about." "Unit tests pass" is not an answer to "How it was tested": name the run, device,
  build id, command, captured output. Issues take the first two headings plus
  `## A-grade verification`.
- **`gh pr view 184` is the reference implementation** — its body carries exactly those six
  headings. Read it before writing your first PR body. (#194 does not; it predates the rule being
  written down.)

Recommended next pass: fix the six named flaws against a **fresh `main` checkout** (the document
was written 4 commits behind). Five are mechanical; §6.3 needs redesigning or the "beats Gumroad"
claim dropped. The most valuable habit in it — the drafting agent re-queried the graders' claims
and *refuted several* — should survive any rewrite.

---

## Not the focus

**Battlechat integration.** Bill said explicitly it is not a focus. Audited and graded **do not
integrate yet** — Recursiv has no automated media screening (`moderationService.ts` is 123 lines,
post-hoc, human-triggered). One line is enough.

---

## Strategic frame (Bill's words, integrated into the docs)

Three beliefs, ordered by **distance from reality** — which is also the work order:

1. **Fork leverage — asserted, not proven.** Minds is the SDK reference app and Minds Build is
   *intended* to fork it. `docs/goal-prompt.md:29` marks this **UNPROVED** and makes confirming it
   **Phase 0.8, a hard Phase 0 exit criterion** — every fork-surface argument in §4, §6.4 and
   Phase 4 rests on it. Note PR **#194 already states it as settled fact in `AGENTS.md`**: either
   prove it or soften that line. *If* it holds, the golden-rule violations are damage to the moat,
   not style debt.
   On the count: the backlog's item-27 headline still says the retracted **"~10"**;
   `docs/goal-prompt.md:94` enumerates **19** raw API fetches that are SDK gaps, by file:line.
   Use 19 and amend the backlog headline. (A naive `grep -c 'fetch('` over `app components lib`
   returns 37 — that includes legitimate non-API uses; do not quote it as a violation count.)
2. **Open infrastructure — not yet true.** Public repo, no license = all rights reserved. Cheapest
   gap to close, blocked on decision #1 above.
3. **Moderation scaling with autonomy — furthest away.** An autonomous system multiplies whatever
   moderation it has. **Rule recorded in the backlog: no autonomy or large-scale ingestion
   workstream starts ahead of a real moderation primitive.**

Also researched, not yet acted on: the `ProtocolAdapter` contract
(`recursiv/packages/server/src/features/protocols/ProtocolAdapter.ts`) implements `collect()` for
**read only** — `publish`/`reply`/`react` are commented out as Phase 2. Today it is aggregation,
not federation. Polycentric is absent. And Inverted World has a working news pipeline
(`inverted-world/lib/worldwire-crawler.ts` et al) whose overlap with the RSS protocol adapter is
**the open design question** — duplicate, superset, or complementary. Get that wrong and you build
ingestion twice.


---

## Detail moved out of the 4k handoff (2026-07-28)

`create_task` has **no URL field** — put `GitHub: <url>` first in `description` so search
reconciles. Set `project_id` every call. **10 tasks existed then; 7 as of 07-30** — list first, show Bill the
create/skip diff, get a yes, file. **But see the banner: do NOT mirror issues into the dispatcher.** **21 of backlog items 10–33 unfiled** (12/29/33 shipped as
#203/#202/#201), incl. item 14, *68 Dependabot advisories (4 crit / 35 high)*. Ask first.
Don't build GitHub↔dispatcher sync.

**PRs** = §8's six headings + non-empty **What remains unproved** (copy #184's headings).
**Issues** = first two + **## A-grade verification in a ``` fence**. **No issue conforms** —
§8's "#195/#196 conform" is wrong. Unit tests never close an item.

Backlog items 10-33: 21 unfiled. Items 12/29/33 shipped as #203/#202/#201.
Item 14 is *68 Dependabot advisories (4 critical / 35 high)*.
Issue-format detail: #185-#193 and #201-#203 have no headings; #195-#200 and #204 have
the heading but no fence. goal-prompt s8's claim that #195/#196 conform is wrong.
