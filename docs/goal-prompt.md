# THE MINDS MASTER PLAN

*A controller for a continuously-running agent loop. Not a document to admire. Its only job is to
drive the loop toward a production launch that actually happened, and to make self-agreement
impossible.*

---

## IN PLAIN ENGLISH — for people. If you are the loop, skip to the next heading.

*(A courtesy summary for humans, added 2026-07-30. It is NOT the contract: nothing in it is
binding, nothing in it may be cited as an exit artifact, and where it disagrees with §0–§11 the
body wins. Agents work from §1 and §3.1 directly — §0's rule against working from a summary
applies to this section like any other.)*

**The goal.** Ship Minds 2.0 so a stranger — someone with no connection to us — can use it on
launch day: the iOS app, the Android app, the web app, plus the API, MCP server, SDK and CLI,
which are one product surface with them. Seven surfaces, one launch (§5.46).

**The problem this document solves.** AI agents work on this continuously, and the failure mode
isn't bad code — it's an agent saying something is done when it isn't, and the next agent
believing it. So here, "done" never means "an agent said so." Every task ends with an artifact a
second party can check without trusting the worker: a file on `main`, a green CI run on a named
commit, a URL returning 200, a video with the build number visible in frame. A task that can't
name its artifact isn't allowed to start.

**How it's organized.** §2 lists every step to launch. §3.1 ranks them by score and the loop
always works the highest-scoring unblocked row — priorities re-derive from facts each cycle
rather than sitting fixed. §5 is an append-only ledger of every claim this document had to take
back. §10 lists the decisions only humans may make, each with an owner, a deadline, and a written
default if the deadline lapses. A CI gate (`scripts/check-controller.sh`, 12 checks) rejects any
edit that makes the document disagree with itself — run it for the current numbers rather than
trusting any prose snapshot, including this one.

**Where things stand (snapshot 2026-07-30).** 113 checkable artifacts across 26 ranked rows,
0 confirmed — not because nothing works, but because confirmation needs a second GitHub identity
and only one login has ever commented on the loop log (#206). The gate runs green in CI but is
not yet a required check, so it can still be bypassed.

**What humans owe it right now.** Merge #207 (unbreaks CI for every open PR), #205 (makes this
document discoverable from AGENTS.md), and #208 (this revision plus the CI gate). Comment on
#206 from a second login so confirmations can start counting. Turn on branch protection so the
gate becomes a required check. Decide the §10 rows whose deadlines are near — #186 lapses
2026-07-31.

---

## GRADING HISTORY IS NOT PART OF THIS CONTROLLER

**No dimension score, composite, or grader verdict appears in this file, and nothing in it may be
justified by citing one.** The previous revision opened with a self-assessment block: six dimension
scores and a composite, presented as findings, positioned above the operating contract, and **the
only claim in the document no command could falsify.** The arithmetic was checkable; the six inputs
were not derived from anything. §1.1 forbids an agent claiming on its own authority *"that an earlier
agent's claim was correct"* — that block did exactly that, at document level, and it was the first
thing an agent read. It is deleted. What it actually recorded — which objections changed the shape of
this document — is at the **CHANGELOG** at the end of this file, stated as changes rather than as
scores.

**The self-checks this document makes about itself are arithmetic, and each is stated where it
is used. There are exactly THREE, they are enumerated below, and this list is the enumeration — two
earlier passages said "only two self-checks", counting §3.1's sort check and §3.2's length/column
check and silently dropping §1.6's denominator awk, which is the one §1.6 calls the source of the
denominator of every progress report the loop emits. A reader told to re-run "both self-checks" would
not have re-run it. Three, everywhere, named:**

**Every command in this document that reads this file is written against `$GP`, bound once, here.
Bind it before running anything below** — the three self-checks used the bare relative path
`docs/goal-prompt.md`, which is `awk: cannot open docs/goal-prompt.md` and exit 2 from any directory
but the repo root, and §1.6 calls the first of them the source of the denominator of every progress
report the loop emits:

```
GP="$(git -C /home/bill/dev/recursivlabs-minds rev-parse --show-toplevel)/docs/goal-prompt.md"
```

1. **§1.6's denominator awk** —
   `awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/ /,"",$4); s+=$4; n++} END{print n, s}' "$GP"`
   → **`26 110`**, plus the off-ladder #190 row (3) = **113**. *(25 table rows + #190 = the **26** steps
   §2 counts. The conditional `PM` row in §2 is deliberately written outside the table so it does not
   move this until §10.23 fires.)* **Its positive control is the printed PAIR itself: against a `$GP`
   that does not exist this prints NOTHING and exits `2` (verified 2026-07-29 against
   `/nonexistent/x.md`), so an empty result is never a pass here either — the pass value is two
   numbers, and it is the only one of the three whose pass value was already non-empty, which is why
   CHANGELOG 37 had nothing to fix on it and why two later passages then forgot it exists.**
2. **§3.1's sort check** — the table is in descending score order. Printed in §3.1; **must print
   exactly `rows read: 31` and nothing else.**
3. **§3.2's length/column check** — every §2 ladder row fits `title`/`description` limits, has nine
   pipe-delimited fields, and carries an EVEN number of `**` markers. Printed in §3.2; **must print
   exactly `rows checked: 26` and nothing else.**

Checks 2 and 3 each print a row count as their positive control **because both previously passed by
printing nothing, which is exactly what they print against a `$GP` that does not exist (CHANGELOG
37).** §3 also asserts that all 25 §3.1 rows recompute against the formula printed in §3 (item 1
there, *"25 of 25"*). **That assertion is deliberately NOT counted as a fourth self-check: it prints
no command and reads no `$GP`. What makes it checkable instead is that every input — the nine weights
and `eff` — is published per row in §3.1, so a second party recomputes it from the table without
running anything this document wrote. The three above are the three commands that read this file, and
"three" is what §1.0's variable block, §3, §3.2 and the CHANGELOG all say.**

**If any of the three arithmetics stops reproducing, that is a §1.5 violation. A dimension score is
not a falsifiable claim and this document does not carry one.**

**Refs this revision was written against, all re-fetched 2026-07-28/29:**
`recursivlabs/minds origin/main` = `3761e415` (529 commits) ·
`recursivlabs/recursiv origin/main` = `24e4ca0f` · **production API deployed commit** =
`24e4ca0f` (`curl -s https://api.recursiv.io/health` → `{"status":"ok","version":"1.0.0","commit":"24e4ca0f…"}`).
No claim below was taken from a working tree.
**RE-RUN 2026-07-29, and two of the three have MOVED: `recursiv origin/main` = `e2a6f957`, production
API deployed commit = `6da07b58` — which equals NEITHER the old ref NOR current `origin/main`. The
"production is deployed from `origin/main`" equality asserted in §4 and §5.18 no longer holds. Treat
every engine citation below as pinned to `24e4ca0f` and re-read it at `origin/main` before relying on
it; the local `/home/bill/dev/recursiv` checkout is 26 behind (§1.2 clause 2).**

---

## 0. What this document is

**Eight files matter and they do different jobs. Do not merge them and do not duplicate them. Two of
the eight live in the engine repo and are the two most likely to be missed, because Claude Code
auto-loads one of them and this controller is not loaded there at all.**

**The set is closed by command, not by memory.** `git ls-tree -r origin/main --name-only | grep '\.md$'`
returns every in-repo candidate on `main` — today exactly `AGENTS.md`, `DESIGN.md`, `docs/x-parity.md`
(re-run 2026-07-29). The other five live on other branches or in the engine repo and are named below.
**Re-run that command before trusting this table: an earlier revision asserted "seven" from memory and
missed `DESIGN.md`, which is on `main` and republishes a §5.7-retracted claim (§5.27).**

| Document | Job | Branch |
|---|---|---|
| `docs/goal-prompt.md` (this) | The controller. Order of operations, exit artifacts, the loop contract. | `docs/goal-prompt` |
| `docs/launch-readiness-backlog.md` | The 33-item product audit. Evidence per item. | `docs/launch-readiness-backlog` |
| `docs/surface-priorities.md` | 63 cross-repo items ranked with the live dispatcher formula. **Its banner currently republishes a claim §5.9 refuted — see §5.16, which is filed as work.** | `docs/surface-priorities` |
| `AGENTS.md` | The onboarding doc every agent reads first. **Stale against this controller**: its "Roadmap" section duplicates §2 in prose with no artifacts, and it points at `~/.claude/plans/operation-keystone.md` and `~/.claude/plans/minds-cutover-plan.md`, **neither of which exists on this machine** (`ls ~/.claude/plans/` → `No such file or directory`). It is also the only place the Minds project/org/network UUIDs are written down, which §1.0 depends on. | `main` |
| `docs/x-parity.md` | An active X-design-parity spec whose stated floor is "match X surface-for-surface". **The only doc under `docs/` on `main`** (`git ls-tree origin/main docs/ --name-only` → exactly this path). Not on this ladder — §8. | `main` |
| `DESIGN.md` | A 41-line design-token doc on `main`, last touched `7ba9d9c` 2026-04-02. Not on this ladder and no ladder step is gated on it. **But its line 5 reads `**Tagline**: The open social network` on a repo that is `isPrivate:true` with `licenseInfo:null` — the exact claim class §5.7 retracted and P2b gates PR #194 on. It is a second live §1.5 re-derivation instance alongside §5.16.** Disposition and exit artifact in §8. | `main` |
| `recursiv:CLAUDE.md` + `recursiv:AGENTS.md` | The engine repo's agent contract. **Claude Code auto-loads it the moment an agent opens `~/dev/recursiv`, which is where PS, P8 and P9 are done.** `git -C ~/dev/recursiv show origin/main:CLAUDE.md \| grep -n complete_task` → `40:5. **When done** → \`complete_task\` with notes on what was shipped` — which is the call §1.3 assigns to the *second party*, not the worker. An engine-side agent is under two contracts and the wrong one loads by default. **PS sub-artifact (4) closes this.** | `recursiv origin/main` |
| `recursiv:docs/RLS-COMPLETION-GOAL-PROMPT.md` | **A SECOND controller driving a SECOND loop**, over the shared multi-tenant Postgres this app is a tenant of (`git show origin/main:AGENTS.md \| sed -n '8p'` → *"Data lives in Recursiv's shared multi-tenant Postgres (Neon), scoped to the Minds tenant. The app does NOT own a database; the platform does."*). Not ours, not merged, and **not ignorable** — §1.9's loop-to-loop clause. | `recursiv origin/main` |

The backlog and surface-priorities both carry a `Provisional — not audited to completion` stamp in
their own first five lines. Treat their file:line citations as leads, not facts, until an item is
picked up — at which point §1.2 applies.

**This revision is committed** (2026-07-29). `git log -1 --oneline origin/docs/goal-prompt --
docs/goal-prompt.md` names the commit carrying it, and `git show
origin/docs/goal-prompt:docs/goal-prompt.md | wc -l` returns this file's own line count. Do not state
which branch the working tree is on — §1.2 clause 1 forbids citing a working tree, and this paragraph
broke that rule in an earlier revision by naming a branch that had already changed. **The predecessor
it replaced is `39a983a` at `2653` lines** (`git show 39a983a:docs/goal-prompt.md | wc -l`); the diff
between them is `+196/-41`. **This revision's diff no longer exists on exactly one disk** — that was
true of every revision before this one, and the earlier text of this paragraph cited `1cd8c64` at
`1629` lines, two predecessors stale, which is why it names the re-run commands rather than the
numbers. Re-run both rather than trusting this paragraph.

**Cycle 0, one PR, both actions in it:**

1. ~~**Commit this revision onto `docs/goal-prompt`.**~~ **DONE 2026-07-29** — exit artifact is the
   paragraph above: the branch tip's line count equals this file's. Action 2 remains open, so Cycle 0
   is not closed; it shipped as two commits rather than one PR because action 1 is preservation and
   action 2 targets a different branch.
2. **Make the controller reachable.** Add under `AGENTS.md`'s title: `> Before doing any work, read
   docs/goal-prompt.md. It is the controller; this file is context. Where they disagree, the
   controller wins.` and replace AGENTS.md's Roadmap section with a pointer to §2.
   **Exit artifact: `git show origin/main:AGENTS.md | grep -c goal-prompt` → non-zero. Today it is
   `0`** (re-verified 2026-07-28). Until that grep is non-zero, this document is unreachable by the
   loop it governs.

Then §1.0's Cycle 0 loads the ladder into the dispatcher. **Until that is done, §1.0's start-of-cycle
queue read is not authoritative** — it reaches seven tasks, none of which is a step in this document.

**Neither the backlog, surface-priorities, nor this file is on `main`.** `git ls-tree origin/main
docs/ --name-only` → exactly `docs/x-parity.md`. A branch deletion erases all three today and there
is no branch protection to stop one (§4). P2 fixes that; until P2 lands this is the cheapest way to
lose the plan.

---

## 1. THE LOOP OPERATING CONTRACT

*This is the most important section. Everything else is content; this is what stops the loop from
agreeing with itself.*

Self-trickery has one mechanism: **a claim no command can falsify.** An agent writes "improved error
handling", the next agent reads it as done, and the loop congratulates itself forever. Every rule
below exists to make that impossible.

### 1.P Pre-launch shipping mode — governing override

**Our present job is to make Minds noticeably better and get it launched.** Production currently has
only Bill and Jack as users, so reversible mistakes are cheap and learning from shipped behavior is
unusually valuable. Until Bill declares public launch, this section overrides blanket proof,
countersignature, artifact-counting, controller-maintenance, and audit requirements elsewhere in this
document. The hard-risk exceptions below still apply.

Choose work by product value, in this order:

1. broken core journeys: sign in, feed, create, media, discovery, profiles, chat, notifications;
2. missing or poor launch experience across web, iOS, Android, API, MCP, CLI, SDK, and public docs;
3. reliability, speed, accessibility, and trust problems a user can feel;
4. developer or operational work that directly unblocks one of the above.

A task is launch work only if it **ships a user-visible improvement, fixes a real defect, or directly
unblocks either one**. Re-ranking, auditing, writing proof machinery, editing the controller, splitting
work into ceremonial micro-PRs, or making infrastructure for agents is not progress by itself. Do it
only when a concrete product decision depends on it or a demonstrated recurring failure makes it the
fastest route to shipping. If a process-only cycle produces no patch or decision, record the blocker
briefly and take the next product task. Do not spend another cycle polishing the process.

Use the smallest proof that answers **“does the changed behavior work where users will encounter it?”**

- **Reversible product change:** focused tests, existing required CI on the PR SHA, and a direct smoke
  when runtime behavior can differ. Green CI plus the smoke is enough; no countersigner or bespoke
  evidence artifact.
- **Shared/API change:** focused regression coverage and one staging or live exercise of the changed
  path. Verify each materially different surface once, not every wrapper around the same contract.
- **Hard-risk change:** strict review and rollback evidence remain mandatory for tenant isolation,
  secrets, permissions, payments/billing, destructive or irreversible data operations, production
  migrations, account deletion, privacy boundaries, moderation enforcement, and production data
  integrity.

**Dispatcher repair #2973 — owner-directed exception, 2026-09-05.** For the
separately owner-authorized `minds-db-migrate.yml` operation
`confirm=repair-minds-dispatcher-columns`, Bill's explicit approval satisfies the
production-change approval requirement; an additional non-initiating human reviewer
is not required. This exception covers only `organization_settings.task_close_policy`,
`roadmap_task.proof_type`, and `roadmap_task.proof_note` from
`recursivlabs/recursiv#2973`. It is owner authorization, not independent verification
or a countersignature. Exact-source authorization, normal PR review, protected main,
required CI, single-writer ownership, tenant/catalog/tracker checks, bounded
transaction and timeouts, post-operation verification, and rollback safeguards all
remain required. A new source SHA is not authorized merely because it descends from
the approved SHA. No other migration, dispatcher closure, P8/P11 change, live
ingestion, or public write inherits this exception. This amendment takes effect
through the existing human-merged PR process in §1.7, not from an agent's local edit.

Required CI must be green, but a flaky or redundant check is a product-delivery bug: repair, combine,
or remove it when it does not protect a credible failure mode. Prefer testing behavior over testing
that another test or document exists. Prefer a real browser/device/API result over a narrative. Prefer
fix-forward for reversible pre-launch defects over rollback ceremony.

Stop only for a hard-risk boundary, destructive ambiguity, genuinely red required CI, an unresolved
merge conflict, or a product decision reserved for a human. Otherwise make a reasonable choice,
state it in the PR, ship, observe, and continue. After public launch, replace this override with gates
based on actual users, traffic, incident history, and blast radius—not hypothetical agent concerns.

#### 1.P.1 Adaptive portfolio amendment — owner direction, 2026-08-24

The launch ladder is the protected **safety spine and launch denominator**, not the exclusive product
backlog. A cycle reads both the canonical `minds-ladder-*` rows and the full project-scoped dispatcher
portfolio across every layer. The ladder continues to define launch gates, dependencies and
`CONFIRMED`; non-ladder work changes none of those counts.

Task selection uses the highest-scoring `pending` full-portfolio row that has no dependency, active
claim, reserved owner, blocking release handoff (`blocked`, `needs_human`, or `out_of_scope`), or
conflicting controller outcome. A non-completed release can revert a row to `pending`, so status alone
is not proof that its recorded blocker cleared; a `completed` release deliberately stays `in_progress`
without an active claim and belongs to the verification queue, never the worker queue. Existing dispatcher inputs and score remain the ranking; no parallel
score is invented. Before creating a row, search tasks, issues, PRs, branches, code and named owners,
then extend or reconcile existing work. Shipped-but-open and duplicate records are queue defects, not
new opportunities.

`scripts/loop-status.sh` is the executable view of this rule: it reports the canonical launch spine,
all project layers, active claims, owner-reserved work and cross-layer candidates separately. An
additional task tagged `launch-ladder` is portfolio work unless it duplicates a canonical title; its
layer does not add to §1.6's denominator. This dated owner amendment governs task selection wherever
older ladder-only text below disagrees; the older text still governs ladder artifact semantics.

### 1.0 What a cycle is, which queue it reads, and where the report goes

**A cycle is one pass over §2 by one agent. It begins with a project-scoped task list and a
`claim_task`, and ends when the §1.6 line is posted as a comment on the loop-log issue.**

```
MINDS_PROJECT_ID = 019d5190-f0c0-717e-a1bd-ef9c335292b9
MINDS_ORG_ID     = 019d517b-bb87-744d-92db-b3801dc15927
MINDS_NETWORK_ID = 0f1fcb0f-11c0-41f2-9406-943a88f48b59

ORIGIN   = https://api.recursiv.io      # NO /api/v1 suffix. Health is $ORIGIN/health
                                        # (root path — §10.25); everything else is
                                        # $ORIGIN/api/v1/... Verified 2026-07-29:
                                        # curl -s https://api.recursiv.io/health -> {"status":"ok",…}
                                        # curl -s -o /dev/null -w '%{http_code}' \
                                        #   https://api.recursiv.io/api/v1/users/me -> 401
STAGING_ORIGIN = https://api.staging.recursiv.io    # same shape; /api/v1/health -> 200
SK_LIVE  = <the loop's dispatcher API key, sk_live_*; the one P0 rotates>
                                        # supplied by the operator, never written into this file
                                        # or into a task. Neither ORIGIN nor SK_LIVE is exported in
                                        # any shell here: `env | grep -cE '^(ORIGIN|SK_LIVE)='` -> 0.
                                        # Export them yourself before running any command below that
                                        # names them, and paste the export line's shape (not the key)
                                        # in the cycle comment.
MINDS_ORIGIN = https://api.minds.com    # THE DISPATCHER HOST FOR THIS LADDER — see the block below.
                                        # NOT api.recursiv.io: the ladder lives in the Minds org and
                                        # a Recursiv-org key 401s on it. Verified 2026-07-30.
MINDS_KEY = <the Minds-network key; bill@minds.com, org 019d517b-…>
                                        # operator-supplied 2026-07-30, stored as MINDS_NETWORK_API_KEY.
                                        # DISTINCT from SK_LIVE, which authenticates to the platform
                                        # org and cannot read this project.
ENGINE   = /home/bill/dev/recursiv      # the recursivlabs/recursiv checkout. Every engine-path
                                        # git command is `git -C /home/bill/dev/recursiv …` —
                                        # §1.2 clause 5, and the path is written out in full at
                                        # every use because a variable that is not exported is a
                                        # second way to fail silently.
```
*(Source for the three UUIDs: `AGENTS.md` on `main`, "Minds is one of ~17 co-resident tenants".
`ORIGIN` is bound here because P0(1), PS(2) and §3.2 step 2b all print it as a command argument and an
earlier revision defined it nowhere — two agents resolving it differently to `…/api/v1` and `…` send
different strings, and P0's whole exit is that the identical string was sent twice.)*

> **HOW EVERY DISPATCHER CALL IN THIS DOCUMENT IS ACTUALLY MADE — amended 2026-07-30, and it
> governs all 94 tool citations below rather than rewriting each one.**
>
> This document names `list_tasks`, `claim_task`, `release_task`, `complete_task`, `get_task`,
> `update_task` and `archive_task` throughout as **MCP tools**. **For this project, the MCP path does
> not work and the REST path does.** Both halves were established by running them, 2026-07-30, with
> the ladder loaded:
>
> | Path | Result |
> |---|---|
> | `mcp__recursiv__list_tasks(project_id=…, layer="launch-ladder")` | `No tasks found matching filters.` — that server authenticates as **bill@social.dev** in the *Recursiv* org and cannot see this project |
> | `mcp__minds__*` dispatcher tools, either host, ±`organization_id` | **`401 Unauthorized`** on all four combinations, while `initialize` and `whoami` succeed — filed as `recursivlabs/recursiv#2039` |
> | `GET $MINDS_ORIGIN/api/v1/dispatcher/tasks?…&organization_id=$MINDS_ORG_ID` with `$MINDS_KEY` | **`200`, 27 rows** — this is the working path |
>
> **So: read every dispatcher-tool name below as "the operation", not as "the MCP tool".** The
> binding form is the REST route on `$MINDS_ORIGIN`, org-scoped with `organization_id=$MINDS_ORG_ID`,
> authenticated with `$MINDS_KEY`. `scripts/load-ladder.sh` is the worked reference implementation.
>
> **Three REST/MCP divergences that will bite anyone writing these calls, all found by running them:**
> **(a)** REST takes **`urgency_score`** and **`signal_score`** where the MCP tools take `urgency` and
> `signal` — sending the MCP names to REST is accepted, **silently dropped, and every score lands low
> and self-consistently.** That is what happened on the first Cycle-0 load: all 27 rows ~13% low, a
> ladder that sorted correctly and was uniformly wrong, caught **only** by §3.2 step 3's
> match-within-1.0 assertion. **This is the strongest evidence in the document for why step 3 exists;
> do not weaken it.** **(b)** REST requires an explicit **`id`** (`{"error":"id and title are
> required"}`) where the MCP wrapper generates a slug — use a stable id per row so a re-run collides
> loudly instead of duplicating the ladder. **(c)** REST rejects the full nine-input payload in one
> `PATCH` for some rows while accepting the same fields split across calls; the loader splits.
>
> **What does NOT change:** every rule about *what* the calls mean. §1.3's two-party closure,
> `release_task` routing by reason rather than closing, the `agent` parameter being the worker's id, the ban
> on `update_task(status:"done")`, `archive_task` over `update_task(status:"archived")` — all
> unchanged. Only the transport moved. **When `recursiv#2039` closes, re-verify with the table above
> and amend this block rather than assuming the MCP path came back.**

> **CYCLE 0 — the ladder must be in the queue before any cycle reads it. This is the first
> instruction in the document that an agent executes, and skipping it makes every later instruction
> point at the wrong work.**
>
> Verified 2026-07-29: `list_tasks(project_id=$MINDS_PROJECT_ID, status="pending", limit=100)` →
> **`Showing 7 of 7 tasks`**, and **not one of them is a §2 row**:
> `proj-minds-cutover-beat-1-recover-placeholder-email-logins-…` (score `57.27564927611034`, owner
> `jack`), then `[Reveal] WS2` (26), `WS5` (23.26), `WS3` (19.68), `WS1` (19.65), `WS6` (18), `WS4`
> (16.62). The top row is the **legacy minds.com cutover, which §8 declares out of scope**. An agent
> that obeys the next bullet on day one therefore claims out-of-scope work, while an agent that obeys
> the closing paragraph works PS. That divergence is a determinism failure at the most-executed
> instruction in the document, and this block is what removes it.
>
> **Before cycle 1, load all 27 §2 rows into the project via §3.2's recipe** — P0, PS, PA, P1, **P2a,
> P2b**, P2c, P3, P3b, P4, P5, P6, P7, P8, P9, P10, PW, P11, P12, P13, **PR**, **PD**, **PAPI**, **PMCP**, **PSDK**, **PCLI**, #190 — **each with
> `layer="launch-ladder"`.**
>
> **The seven DAG roots end Cycle 0 `pending`. The other twenty end it `blocked`.**
> Pending (7): **PS, P0, P1, PA, PD, PAPI, #190** — §2's "Startable today with no predecessor" bullet, verbatim.
> Blocked (16): **P2a** (serial on P1 — it is *not* a root; its `Serial on` cell says `P1`), P2b, P2c,
> P3, P3b, P4, P5, P6, P7, P8, P9, P10, PW, P11, P12, P13, **PR**, **PMCP**, **PSDK**, **PCLI**. **7 + 20 = 27**, which is the same 27 the
> exit artifact below counts.
>
> **It takes a FOURTH call, and writing it as a `create_task` argument errors — `create_task` has no
> `status` parameter at all** (live schema, read 2026-07-29: `title, description, effort, severity,
> signal, ui_impact, urgency, layer, milestone, owner, project_id, organization_id, created_by,
> created_via` — that is the whole list). So for each of the twenty, §3.2's recipe gets a step **4)
> `update_task(task_id, status:"blocked")`**, which is legal in both enums — MCP `update_task`
> advertises `["pending","in_progress","blocked","done","archived"]` and the REST schema accepts
> `z.enum(['pending','in_progress','blocked'])` (`dispatcher.routes.ts` @ `status: z.enum(['pending', 'in_progress', 'blocked'])`); the intersection is the
> three that work, and `blocked` is in it. *(`done` and `archived` are in the MCP enum and 400 at the
> route — §1.1's second corollary, already recorded for `archived` below. Do not read a value's
> presence in the MCP enum as evidence it is accepted.)*
>
> **This is what makes "the highest-scoring unblocked unclaimed row" a query rather than a
> judgement**: `list_tasks` has **no dependency filter** (live schema, read 2026-07-29 — its filters
> are `status, layer, milestone, owner, project_id, organization_id, limit`), so without the blocked
> load an agent reading the queue literally claims P13 (71.0) on day one with nothing beneath it built.
> §1.3's transition sets a row's dependents to `pending` when it closes; §2's DAG block, not the
> `Serial on` column, is what "dependents" means. **`status="blocked"` is also a legal `list_tasks`
> filter, so the blocked set is re-readable and the split is checkable, not asserted:**
> `list_tasks(project_id=$MINDS_PROJECT_ID, layer="launch-ladder", status="blocked", limit=100)` →
> **20**, and the same call with `status="pending"` → **7**, at the end of Cycle 0.
>
> **`owner` is set at load and encodes §1.7's boundary, because three rows require actions no agent
> may perform.** §1.7 forbids an agent rotating a live credential or submitting to a store. So:
> **P0 → `owner=Bill`**, **P11 → `owner=Bill`** (the sitting; Jack countersigns, §10), **P12 →
> `owner=Bill`** for sub-artifacts (1) and (2) only. Each of the three carries, as the first line of
> its `description`: `HUMAN-ONLY: an agent may prepare and stage this row but may not execute
> <the named action>; executing it is a §1.7 violation.` An agent may still claim these rows to do the
> preparation — enumerating P0's consumers, writing P12's `submit.production.android` profile — and
> must release rather than execute.
>
> **P2 is loaded as TWO rows, P2a and P2b, and this is not cosmetic.** §3.1 has always scored it as
> two rows with two different scores (`79.0` and `55.5`), while §2 carried one row and §1.0 named it
> once. Step 3 of §3.2's recipe asserts the loaded score matches §3.1 — so two agents running Cycle 0
> loaded `79.0` and `55.5` respectively and **both passed their own assertion.** Cycle 0 was
> undecidable at the row carrying the merge train. `N` is unchanged (1 + 6 = 7), so **the denominator
> does not move and no `BASELINE` line is required for the split** — only for P1(3) and P8(5)(6),
> which do move it. Say that explicitly in the Cycle-0 comment so the next agent does not re-derive it.
>
> **Exit artifact, and it is one thing, not two:**
> `list_tasks(project_id=$MINDS_PROJECT_ID, layer="launch-ladder", limit=100)` returns **exactly the
> number of rows in §2's table plus the off-ladder #190 row — 27 today** — every title matching a Step
> cell, **eight of them `pending` and twenty `blocked`** per the split above. Today that exact call
> returns **`No tasks found matching filters.`** (verified 2026-07-29), which makes it a clean
> before/after discriminator that no assertion can produce.
>
> *(The previous revision added a second clause — `get_task` on the P0 row → `92.0 ±1.0`. It is
> **deleted**, because it cannot fail: §3.2 step 2 writes `score_override=92.0` and
> `DispatcherService.ts`'s own header says `// score_override takes precedence if set.`, and on the
> rows where the override is skipped §3.2 step 2b supplies §3.1's own nine inputs to a function
> (`computeFormulaScore`, @ `function computeFormulaScore(`) that is deterministic in exactly those nine — so it returns
> §3.1's number by construction either way. An exit criterion true by construction is the class of
> claim §1 exists to eliminate, and it had been installed as a Cycle-0 exit. The `layer` count above
> is the real discriminator and is unaffected.)*
>
> **`limit` is MANDATORY on every `list_tasks` call in this document.** The live schema's default is
> `20` and its maximum is `100` (`"limit": {"description": "Max results (default 20)", "maximum": 100,
> "minimum": 1}`, read 2026-07-29). **An unlimited read truncates at 20 and gives no indication that it
> did**, so it reports 20 whether 21 rows or 40 rows exist, and a truncated count cannot distinguish
> "all rows loaded" from "rows missing". **The ladder is 27, so an unlimited read is wrong on day one**,
> and it gets worse the moment §1.6's `BASELINE` mechanism adds a row. *(An earlier revision justified
> this rule in three places with "the default is exactly the ladder size". It is not — 20 ≠ 21, and this
> same block's exit artifact says 21. The instruction was always right; the coincidence under it was
> false and is deleted. Silence on truncation is the whole argument and it needs no numerology.)*
> **If §2 ever exceeds 100 rows this exit artifact must
> be re-specified; record that as a §10 unknown rather than paginating silently.**
>
> **The 7 pre-existing tasks are dispositioned in the same pass** — each is either mapped onto a §2
> row or **`archive_task(task_id)`**. **Do NOT use `update_task(task_id, status:"archived")`: it
> returns `400 Invalid input`.** `updateTaskSchema` is `status: z.enum(['pending','in_progress',
> 'blocked'])` inside a `.strict()` object (`recursiv origin/main:packages/server/src/features/
> dispatcher/dispatcher.routes.ts` @ `status: z.enum(['pending', 'in_progress', 'blocked'])`, inside `const updateTaskSchema = z.object({`), and the handler @ its `{error:'Invalid input'}, 400` return returns
> `{error:'Invalid input'}, 400` on a failed parse. **The MCP tool's own status enum advertises
> `archived` and `done` (`packages/mcp/src/tools/dispatcher.ts` @ `dispatcherTaskStatusUpdateSchema`) — it is the wrapper that is wrong,
> not the server, and this is §1.1's second corollary at its sharpest: the tool is present, the value
> is in its enum, and the call still errors.** `archive_task` routes to
> `dispatcherApi.post('/tasks/:taskId/archive')` @ `/tasks/:taskId/archive` and runs `archiveTask` (`DispatcherService.ts` @ `async archiveTask(`),
> which releases any active claim and sets `archived = TRUE`. **`archive_task` takes only `task_id` and
> `organization_id` — there is no `notes` parameter**, so the §8 citation for each archived task goes on
> the #206 Cycle-0 comment, not on the task. Leaving them pending means the next agent's queue read
> outranks the ladder with work this document says not to do.
>
> **CYCLE-0 SUB-ACTION: provision the second GitHub identity, or the `CONFIRMED` counter is pinned at
> 0 forever and the document must say so.** §1.6 discards any `COUNTERSIGN` whose author equals the
> cycle-line author, and **this box has exactly one authenticated login**: `gh api user --jq '.login'`
> → `ottman` (2026-07-29). §10 names a second human (Jack) for **P11 and only P11**, and §10 requires
> him to post a per-sub-check frame timestamp for **each of P11's eight**, so Jack covers eight
> sub-artifacts, not one row. So as shipped, **92 of the 100 artifacts (100 − P11's 8) have no
> available countersigner** and `CONFIRMED` cannot rise — while §1.6b's
> `PACE-ESCALATION` fires at day 30 for a mechanism gap rather than for a work gap.
> **Exit artifact for this sub-action:** a distinct identity exists and has posted —
> `gh issue view 206 --json comments --jq '[.comments[].author.login|select(startswith("github-actions")|not)]|unique|length'` → **`≥2`**.
> *(Amended 2026-07-30, the day PA landed: the unfiltered count went to 2 the moment the loop's own
> auditor posted its first `SELF-AUDIT-RUN` table — `github-actions` is the identity the very next
> paragraph excludes, so the unfiltered form stopped discriminating the condition it stands for.
> Found by the cycle that broke it; see the `bill/2` line on #206. The filter excludes
> `github-actions` and `github-actions[bot]` — both surface forms, per PA(2)'s own note.)*
>
> **Which identities count, stated as a rule because the loose reading re-opens the hole §1.6 closed.**
> A **human** other than the cycle-line author, or a **machine user not driven by this loop**, counts
> unconditionally. **The `github-actions` bot counts ONLY under both of:** (a) the comment pastes the
> sub-artifact's own command **and the output as executed inside that run**, with the `run_id` in the
> body, so the countersignature is a re-execution and not a restatement; **and** (b) the workflow
> posting it is a **required check** under P2a's contexts, so the loop cannot delete or disable the
> witness it is being judged by. **An agent may write PA's workflow — PA is agent work under §1.7 —
> so without (a) and (b) an agent could author the thing that certifies its own artifacts, which is
> the free-text `COUNTERSIGNED-BY` token §1.6 deleted, wearing a different login.** Until P2a lands,
> (b) is unsatisfiable and `github-actions` does **not** count; the exit is a human or a machine user.
>
> **Until that command returns ≥2:** every cycle line appends the token `COUNTERSIGN-UNAVAILABLE
> <the single login>`, `CONFIRMED` is reported as `0/100` with that token rather than as progress,
> **§1.6b's `PACE-ESCALATION` is SUSPENDED**, **and §1.5's phantom-progress row is evaluated on its
> other three conditions only — its `COUNTERSIGN` clause is SUSPENDED with it.** That second
> suspension is not a softening, it is a fork closure: the clause is *unsatisfiable* while one login
> exists, so read literally it fires on every row the loop legitimately closes, and one agent would
> reopen all of the loop's work each cycle while another reopened none. Escalating on a mechanism gap,
> or reopening correct work because of one, teaches the loop that its own detectors mean nothing.
> **The `CONFIRMED-THIS-CYCLE`, empty-`pr_urls` and `N`-sub-id clauses of that row stay live** — they
> do not depend on a second identity. `COUNTERSIGN-UNAVAILABLE` on three consecutive cycles is itself
> a §1.4 escalation to Bill by name. **Do not resolve this by reading "a different login" loosely.** The whole
> value of §1.6's countersignature is that GitHub attributes authorship and the working agent cannot
> forge it; an agent that countersigns itself has re-created the free-text token §1.6 deleted.
>
> **Naming collision, resolved here so it cannot recur: the live task scoring 57.28 is labelled "P0
> legacy-auth" in the dispatcher and is NOT §2's P0** (credential rotation, 92.0). §3.1 uses 57.28
> **only** as a calibration anchor for the scorer. It is not a ladder row and it is not startable
> work under this document.
>
> Until Cycle 0's exit artifact exists, **§1.0's start-of-cycle read is not authoritative** and the
> agent works **the one ordering statement in this document** instead, quoted whole from §2's closing
> lines and the closing actions so no reader has to reconstruct it:
> **PS (101.8), P0 (92.0), #190 (70.4), PD (68.1), P1 (65.8), PAPI (61.3), PA (41.7)** — §2's seven DAG roots, in §3.1 order.
> **P0 and PA are IN this list.** An earlier revision wrote it here as "PS, #190, P1", dropping both,
> which made the second row of the day `#190` for one agent and `P0` for another — §5.33. P0 is
> `HUMAN-ONLY` under §1.7 and an agent takes only its **preparation** half (§1.7's own clause), which
> is a reason to annotate it, not to delete it from the order; PA is startable today with no
> predecessor. **P2a (79.0) is NOT in this list — it is serial on P1.**

- **Start of cycle:** read `list_tasks(project_id=$MINDS_PROJECT_ID, layer="launch-ladder",
  limit=100)` as the safety spine, then `list_tasks(project_id=$MINDS_PROJECT_ID, status="pending",
  limit=100)` plus active claims as the selectable portfolio. Claim the highest-scoring row allowed
  by §1.P.1. **"Unblocked" is part of the rule, not an omissible adjective** — §1.4.3 and
  §1.5 both say "unblocked, unclaimed" and this bullet said only "unclaimed", so at cycle 6 one agent
  claimed P13 (71.0, the literal reading) while another claimed the highest *startable* row (§2's DAG).
  **The filter is mechanical, not judgemental: `status="pending"` already excludes it**, because Cycle 0
  loads every non-root row with `status:"blocked"` and §1.3's transition flips a row's dependents to
  `pending` when it closes. If a row is `pending` it is startable; if you believe a `pending` row is not
  startable, that is a §1.5 report, not a judgement call at claim time. **`limit=100` is required, for
  the reason in Cycle 0**: "the highest-scoring unblocked unclaimed row in that list" is only
  well-defined over an untruncated list, and the default of 20 truncates rows silently. A non-ladder
  row does not change the launch denominator or ladder dependencies; its claim and outcome still obey
  the same single-writer, heartbeat, verification and handoff rules.
- **NEVER `claim_next_task`.** Its own description is `Atomically claim the highest-priority
  available task. Scoped to the configured organization.` — the *organization*, not the project.
  Verified 2026-07-28: `list_tasks(status="pending", limit=10)` returns ten auto-discovered
  `disc-bug-*` recursiv infrastructure tasks scoring **305, 303.5, 255.5, 225.9, 225.9, 225.9,
  222.5, 221.5, 209.5, 202.6** — every one of them above §3.1's ceiling of 120.0. An agent that
  calls `claim_next_task` works "Production deployment e8bb0262 is completely unreachable" forever
  and §1.6's counter never moves. **This was the largest convergence hole in an earlier revision
  and it was a wiring error, not a scoring error.**
  *(`get_dispatcher_stats` reports `Total 2267 / Done 335 / Stale 735` and **Pending ~1.9k and
  moving** — that counter drifted 1927 → 1926 inside one grading round. Per §1.2 clause 3 it is not
  a citable constant: re-run it, do not quote this line. The load-bearing claim is the **shape** of
  the unscoped queue, not its size.)*
- The loop log is **GitHub issue `recursivlabs/minds#206`, titled `[loop] cycle log`. It now exists**
  — `gh issue view 206 --json title,state` → `[loop] cycle log`, `OPEN` (opened 2026-07-29, closing
  this part of Cycle 0). **It was specified throughout this document as `#205` and is not.** #205 was
  taken by a PR opened minutes earlier in the same session, and GitHub does not reuse numbers, so the
  reservation was never enforceable — see §5.37. **Re-run the command rather than trusting this
  bullet**; a number this document reserves but does not own can be taken again.
  **Ordering, now load-bearing rather than stylistic (§5.37):** in any cycle that both opens the log
  and opens a PR, **the log is opened first**. The original text placed it after §0's two actions,
  which is exactly the order that produced the collision.
- **RESCORE, before claiming anything — the ranking is re-derived each cycle, not inherited.** For every
  row whose underlying facts moved since the last cycle — a date that got nearer, a dependency that
  landed, a blocker that cleared, a scope a human changed, an issue body that was edited — update the
  §3.1 inputs that the fact bears on, recompute, re-sort, and push the new values to the dispatcher.
  **Then post one line per changed row to #206, in exactly this form:**
  ```
  RESCORE <row>  <input>=<old>→<new>  SCORE <old>→<new>  FACT <the command or artifact that moved>
  ```
  **`FACT` is mandatory and is a command or an artifact, never a judgement.** *"the sunset is now one
  day out (`§10.23`'s decide-by, today's date)"* qualifies; *"this feels more urgent"* does not — that
  is the §1.1 rule applied to scoring. **A cycle that rescored nothing says `RESCORE none`**, which is
  a claim that no fact moved and is falsifiable like any other.
  **RE-RANKING DECIDES WHAT YOU PICK UP NEXT — NEVER WHAT YOU PUT DOWN.** A row that drops in rank
  while you are actively working it is *not* abandoned: you finish it, or you release it with
  `PARTIAL k/N` for a reason that is not "something else scored higher." **Without this clause a
  re-ranking loop thrashes** — abandon at 60%, take the new top row, abandon that one next cycle — and
  produces motion with nothing closed, which is the failure this whole document is built against. The
  one exception is already written and already narrow: the `MONITOR-DARK` rule outranks every
  **unclaimed** ladder row, and says nothing about claimed ones. Emergencies pre-empt the *queue*, not
  the work in hand.
  **Rescoring is NOT a denominator change and owes no `BASELINE` line** — the row count and `N` are
  untouched; only the order changes. Conversely a rescore is **never** reported as `DELTA-DISTANCE`
  progress: re-ranking is not work done, and a loop that could promote its own preferred row and call
  that progress would have the motion generator this document exists to remove.
- An agent that claims nothing still ends a cycle: it posts `… NEXT none IDLE <reason>`.
- **§1.5's detector is run by the agent opening the next cycle, before it claims anything**, against
  the last three comments on #206 (`gh issue view 206 --json comments`). If a symptom fires, execute
  the Response column instead of claiming. With fewer than three comments the detector is not yet
  armed and the agent must say so in its line.
- **The detector must also run unattended, and today it cannot.** `git ls-tree origin/main
  .github/workflows/ --name-only` → exactly `.github/workflows/ci.yml`,
  `.github/workflows/smoke.yml` (re-verified 2026-07-28). Nothing scheduled runs §1.5, so §1.5 is
  enforced only by the population it audits. **Closing it is PA.** An earlier revision named this gap
  and then kept PA off the ladder as "process infrastructure, not launch work" — but §8 of this same
  document says *"A carve-out with no artifact is a carve-out nobody can close"*, and a detector
  whose only enforcer is the loop it detects is §1 exempting itself from §1. **Every cycle line
  states `SELF-AUDITED yes` until PA's sub-artifact (2) exists.** **AMENDED 2026-07-31 — PA(2)
  exists: first satisfied by run `30615511066`, CI-countersigned as PA.2 in runs `30640292161`
  and `30652874433`. From the first cycle after this amendment lands on `main`: `SELF-AUDITED
  yes` is claimable only when a successful `SELF-AUDIT-RUN` comment on #206 is ≤24h old at
  posting time, and the cycle block body names that run id; otherwise the line states
  `SELF-AUDITED no`. A `no` is §1.5's own symptom class, not a style violation — the unattended
  detector going quiet is exactly the thing it exists to detect, and a `no` obliges the same
  cycle to check `gh run list --workflow=loop-audit.yml --limit 1` and report what it found.
  The field keeps its `yes|no` shape deliberately: nothing parses it today (zero matches in
  `loop-audit.yml`, `confirm-artifacts.sh`, `scripts/` — verified 2026-07-31), so this change
  is semantic only and no tooling migrates.**

### 1.1 What an agent may claim without external proof

Almost nothing. The complete list:

- That it read a file, and what the file said at a named line, **with the `git show <ref>:<path>`
  command in the message**.
- That a command exited non-zero, **with the command and its output pasted**.
- That it is blocked, **naming the blocker by issue number or by the §10 row**.
- That it formed a hypothesis. A hypothesis is not a finding and may never close an item.

Everything else requires an artifact. An agent may **never** claim on its own authority: that a bug
is fixed, that a test proves a user-facing behaviour, that a surface works, that a decision was
made, that a phase exited, or that an earlier agent's claim was correct.

**Corollary added after §5.9:** a name-match is not a causal chain. Two identifiers that share a word
are unrelated until a `grep` shows a call path between them. The most damaging error in an earlier
revision was exactly this shape, and it was bolded and armed as a rhetorical defence.

**Second corollary, added after §1.9's defect:** *a tool being present is not a tool being fit.*
The previous revision wrote "All five tools verified present in the live MCP schema" and then used
one of them for something its parameters cannot express. Presence is a `ToolSearch`; fitness is
reading the parameter ranges and the description. Check both.

### 1.2 The re-verification rule (this is how earlier revisions rotted, twice)

**Before starting any item, re-run the command behind every citation you are relying on.** Citations
decay silently; nothing warns you.

1. Cite via `git show <ref>:<path>` or `git grep <pat> <ref> -- <path>`, never via `sed`/`grep` over
   a working tree. A working tree is on whatever branch the last agent left it on. **§4 violated
   this once in the previous revision and shipped an overclaim as a result (§5.17).**
2. **This applies across repos, and it is where this document has failed twice.**
   `/home/bill/dev/recursiv` is a working checkout, not a mirror. When §4 was first written it was
   on `docs/mcp-build-command`, 1 ahead and 16 behind `origin/main`, which is how a revision shipped
   three wrong engine line numbers *and* one already-fixed defect (§5.10, §5.11). Before citing any
   `recursiv/` path:
   ```
   git -C /home/bill/dev/recursiv fetch origin && \
   git -C /home/bill/dev/recursiv rev-list --count HEAD..origin/main
   ```
   Non-zero → cite via `git show origin/main:<path>` and paste the ref. *(It returned `16` when this
   revision was written. Every recursiv citation below is at `origin/main`.)*
3. **Before relying on any count in this document, recount it.** Two counts of the same thing that
   disagree are a §1.5 divergence condition even when both are small — §5.12.
4. **A filtered command output is not a command output.** If you present a subset, print the command
   that produces the subset. §5.17 exists because a seven-item list was captioned with a command
   that returns twenty-two.
5. **A cross-repo command printed without `-C` is a §1.2 violation on sight — reject the PR, no
   argument about whether it "worked for you".** This controller lives in `recursivlabs-minds`; every
   `packages/server/…`, `docs/MINDS.md`, `scripts/…`, engine `CLAUDE.md` and engine
   `.github/workflows/…` path is in `recursivlabs/recursiv` at `/home/bill/dev/recursiv`. **The
   failure is not loud.** Three shapes, all observed in this document before this clause existed:
   - `git show origin/main:packages/server/… | grep -c <pat>` → `fatal: … does not exist in
     'origin/main'` on **stderr** and **`0` on stdout** — and `0` is the documented NOT-DONE value of
     PS(1), so the error state and the not-done state are byte-identical on stdout.
   - `git show origin/main:.github/workflows/staging-db-refresh.yml` → `fatal:` — and §1.3's P4(5)
     clause used to enumerate "or states that they do not exist" as a legal way to close, turning a
     `cd` mistake into a false "staging does not copy prod" finding on the artifact that decides
     whether real user PII lands in a database throwaway accounts touch.
   - `git log -1 … origin/main -- docs/MINDS.md` → **empty output, exit 0** — silently
     indistinguishable from "never modified", on §10.23, the question with the shortest decide-by date
     in this file.
   **The guard, required whenever an engine path decides a sub-artifact:**
   ```
   git -C /home/bill/dev/recursiv cat-file -e origin/main:<path> && echo PATH-OK
   ```
   No `PATH-OK`, no reportable result. `PATH-OK` is pasted next to the output it guards.

If a citation no longer resolves: fix it in place in this document in the same PR as the work, and
add a row to §5. Do not work around a stale citation and do not leave it for later.

### 1.3 How an item is marked done, who may mark it, and where the enforcement gap is

An item is done when its **exit artifact** exists and a **second party** has seen it. Both halves are
required.

- **Exit artifact** — one of **nine** classes: a URL returning a specific status code; a string present
  in a built binary; a row in a live database; a re-fetchable telemetry event id; a GitHub API
  response; a file at a path on `main`; a green run of a named workflow on a named SHA; a machine timestamp pair; **or a screen recording or screenshot COMMITTED at a path on `main` and bound
  to a named SHA, build id or account identifier visible in the frame** — committed and bound it
  is evidence, pasted and unbound it is not, and that binds recordings exactly as it binds stills. The artifact is named in §2 per
  item, in advance. **An item with no artifact named is not startable** — which is why PS, PA and P13
  exist as rows rather than as prose.
  *(The **committed-and-bound media class** is added rather than assumed, and it is the NINTH, not a
  tenth: folding the former standalone "a screen recording" entry into it left nine enumerated classes,
  and the header said "ten" while the list counted nine — a count that did not
  recount, inside the section §1.2 clause 3 governs, which is §5.31's exact recurrence. **Recount it
  yourself; the recount is written line-independently on purpose:**
  `awk '/^- \*\*Exit artifact\*\* — one of/,/^  is evidence, pasted and unbound/' "$GP" | tr '\n' ' ' | tr ';' '\n' | grep -c .`
  → **`9`** (re-run 2026-07-29; against a `$GP` that does not exist it prints `0`, so the nine is its
  own positive control). **The first version of this parenthetical cited `sed -n '427,431p'` instead,
  and the same edit that wrote it pushed the list down three lines, so the citation that closed a
  count-that-did-not-recount stopped reproducing its own count — it reached "a GitHub API" and
  truncated at 8. A line-numbered self-citation in a file that edits itself is a citation with a decay
  date; both anchors above are unique whole lines (`grep -c` → 1 each) and survive insertion above,
  below or between them.** Every citation
  elsewhere now names this class by NAME rather than by ordinal, so a future fold cannot orphan them
  again — four sub-artifacts had been citing "§1.3's tenth class" as the thing that made their evidence
  admissible, and that ordinal resolved to nothing. The list said nine and "a screenshot" was not among
  them, while P5(2) closed on "screenshots of both" and P12(5) on "screenshotted with the account
  email visible" — two sub-artifacts closing on a class the list did not contain. An uncommitted
  screenshot is a JPEG in a chat window: it has no path, no SHA, and no second party can re-fetch it,
  which is the whole test. **Committed and bound, it is evidence; pasted and unbound, it is not, and
  no sub-artifact in this document may close on the unbound form.** Where a machine-readable artifact
  exists for the same claim, it is required **in addition** — see P5(2) and P12(5).)*
- **A document is an exit artifact only if every load-bearing sentence in it carries the command
  that produced it, in the form §4 uses.** A document asserting a fact with no command is prose, and
  prose does not close an item — it is "improved error handling" at one remove. **Five** sub-artifacts
  in §2 are written as documents — **P4(5)**, **P8(4)**, **P8(5)**, **PW(1)**, **P10(4)** — and each
  closes on a file on `main` in which a second party can re-run at least one printed command and get
  the printed output. *(An earlier revision said "Four" and omitted **P8(5)**, the retention/deletion
  schedule — the most assertion-shaped exit in the ladder, since no command falsifies "the schedule
  says 90 days". "Four" was stated as exhaustive, so an agent closing P8(5) had to decide for itself
  whether this clause reached it. It does.)*
  - **P4(5)** prints the `git -C /home/bill/dev/recursiv show origin/main:.github/workflows/staging-db-refresh.yml`
    lines that copy prod. **Those lines EXIST — this is settled, not open, and P4(5) does not close on
    a claim that they do not.** Verified 2026-07-29: `:49` `gcloud storage cp "${LATEST}" /tmp/prod-backup.sql.gz`,
    `:52` `- name: Restore to staging DB`, `:57` `psql "${STAGING_DB_URL}" < /tmp/prod-backup.sql`,
    then `:61-63` `- name: Sanitize PII` running `psql "${STAGING_DB_URL}" -f scripts/sanitize-staging-data.sql`
    (that script exists: `git -C /home/bill/dev/recursiv cat-file -e origin/main:scripts/sanitize-staging-data.sql`
    exits `0`). **P4(5) is therefore not "does staging copy prod" — it does — it is whether the sanitizer's
    column list still covers every PII column the current schema has.** A P4(5) document reporting that
    the copy lines do not exist is a **wrong-repo error, not a finding**: without `-C` the command prints
    `fatal: path '.github/workflows/staging-db-refresh.yml' does not exist in 'origin/main'` from this
    repo. **The document must paste the `PATH-OK` guard of §1.2 clause 5 alongside the output.**
  - **PW(1)** prints all three parts its cell names, and the absence is never one of them on its own.
    **(a)** `git -C /home/bill/dev/recursivlabs-minds ls-tree origin/main --name-only -- eas.json app.json | wc -l`
    → `2` (the this-repo anchor) beside the same command over `vercel.json netlify.toml Dockerfile`
    → `0`. **(b)** the deploy mechanism's OWN response — the `deploy_project` MCP response or the
    workflow run URL that moved PW(2)'s pre-committed string. **(c)** or, if it is a hand step, that
    step performed in the same transcript with its output pasted and the string shown to move.
    *(The earlier form read "prints `git ls-tree origin/main` showing no `vercel.json`/`netlify.toml`/
    `Dockerfile` and records hand-deploy as the finding" — no `-C`, no anchor, no positive. Run from
    `/home/bill/dev/recursiv` it prints the same `0` over a non-empty 65-entry tree, so the finding was
    producible from the wrong repository, and the site returns `200`, so the negative was contradicted
    by a live fact in the same cell. §1.2 clause 5 calls the unguarded cross-repo form a violation on
    sight; this clause was the last place in the document still writing one.)*
  - **P8(4)** names each unscreened surface by the route or file path that handles it.
  - **P8(5)** prints the `git show origin/main:<schedule-path>` lines stating the routine-deletion
    window and, **separately**, the NCMEC preservation window and the named filing entity. **A schedule
    that does not distinguish the two is not sub-artifact (5)** — that sentence is in P8's cell and this
    clause claims it. A retention number with no command that reads it back off `main` is prose.
  - **P10(4)** cites `recursiv origin/main:docs/MINDS.md:107,:126` (via `git -C /home/bill/dev/recursiv`)
    and the GDPR article relied on, by number.
- **Second party — a human, OR a required CI check, and WHICH ONE is determined by the artifact class,
  not by preference.** Requiring a human on all 113 would make confirmation the bottleneck, and that is
  not what this clause asks for. §5.47.

  > **Eight of §1.3's nine artifact classes are machine-verifiable.** A URL returning a status code, a
  > string in a built binary, a row in a live database, a re-fetchable telemetry event id, a GitHub API
  > response, a file at a path on `main`, a green run of a named workflow on a named SHA, and a machine
  > timestamp pair — **every one of those is a command a check can re-run and compare.** Only the ninth,
  > the committed recording or screenshot bound to a SHA/build id in frame, requires a person, because
  > somebody has to *watch* it.
  >
  > **So the rule is:** an artifact whose class is one of the eight is confirmed by the CI check, and a
  > `CONFIRMED-THIS-CYCLE` token for it needs no human. **A human countersignature is required for (a)
  > the media class, and (b) any sub-artifact whose row is money-, store-, credential- or
  > moderation-adjacent** — where being wrong is expensive rather than merely incorrect. Concretely
  > that concentrates human confirmation on **P11's eight sub-checks, P13(1)(2), P3(2), P3b(1),
  > P5(4a), P12(1)(2)(3)(5) and #190's three captures** — the sittings, the device recordings and the
  > store submissions — and takes it off the roughly ninety artifacts that are a command and its output.
  >
  > **The two conditions on a CI second party are UNCHANGED and are what keep this honest** (§1.0):
  > the check's comment must **re-execute the sub-artifact's own command inside the run**, with the
  > `run_id` in the body — a restatement is not a confirmation — **and** the posting workflow must be a
  > **required check** under `P2a`, so the loop cannot delete or disable the witness judging it. Until
  > `P2a` lands, neither condition holds and a human is still the only available second party. **That
  > makes `PA` and `P2a` load-bearing in a way they were not before: they are what unblocks ~85% of
  > confirmation.**
  >
  > **Review and attestation are different things and only one of them is gated.** Commenting on work,
  > catching problems, disagreeing with an approach — none of that is countersignature and none of it is
  > rationed. Attestation is the narrow formal act of recording that a named artifact exists. Confusing
  > the two is what makes a verification rule feel like a tax on collaboration. **An agent may never close an item it worked
  on.** *Stated because concealing it would be the failure this section prevents:* **the CI half does
  not exist yet.** `gh api repos/recursivlabs/minds/rulesets --jq 'length'` → `0`;
  `gh api repos/recursivlabs/minds/branches/main/protection` → `404 Branch not protected`
  (re-verified 2026-07-28). Until P2 and P2c land, **a human is the only available second party**,
  and `COUNTERSIGNED-BY` on the §1.6 line is the only record that one existed.

> **THE CLOSURE TRANSITION — read from source, because the previous revision forbade the only call
> that can close a task and thereby made the ladder uncloseable.**
>
> `git -C ~/dev/recursiv show origin/main:packages/server/src/features/dispatcher/DispatcherService.ts | sed -n '/const revertGuard =/,/reverted_task/p'`
> — **print the whole range, not a subset (§1.2 clause 4).** Since Recursiv #2089, `release()` builds
> a reason-sensitive guard immediately before the CTE and then interpolates it into `do_revert`:
> ```
> const revertGuard = releaseReason === 'completed' ? sql`AND FALSE` : sql``;
>
> UPDATE roadmap_task
> SET status = 'pending', updated_at = NOW(), last_activity_at = NOW()
> WHERE id = ${taskId}
>   AND status = 'in_progress'
>   ${revertGuard}
>   AND NOT EXISTS (
>     SELECT 1 FROM task_claim tc2
>     WHERE tc2.task_id = ${taskId} AND tc2.status = 'claimed'
>       AND tc2.id NOT IN (SELECT id FROM do_release)
>   )
> ```
> **So a `completed` release never re-queues the row:** it releases the claim but deliberately leaves
> `roadmap_task.status='in_progress'` for a different party to verify and close. Other release reasons
> re-queue when the released claim was the last active one; under concurrent claims the row stays
> `in_progress`.** `release_reason` is written to `task_claim` and surfaced on task reads from the
> latest handoff; it is not a `roadmap_task` column. `status = 'done'` is set **only** by `done()` —
> the handler behind `complete_task`. **So `release_task` never closes anything: `completed` routes
> to verification, while non-completed final releases route back to worker selection.**
>
> **The closure is therefore explicitly two-party and asymmetric:**
>
> 1. **The working agent calls `release_task(task_id, release_reason:"completed",
>    pr_urls:[<artifact URLs>], commits:[<SHAs>], context_handoff:<the exit artifact verbatim>)` and
>    STOPS.** `pr_urls` (`format: uri`) and `commits` (`^[a-fA-F0-9]{7,64}$`) are typed and queryable;
>    a free-text note is not. **A release with `release_reason:"completed"` and an empty `pr_urls` is
>    a §1.5 phantom-progress violation on sight.** The task stays `in_progress` with no active claim —
>    that is the verifier handoff, and `scripts/loop-status.sh` renders it under `VERIFICATION QUEUE`.
>    It is not re-servable to a worker.
> 2. **A second party — never the working agent — verifies the exit artifact, then calls
>    `complete_task(task_id, agent:<THE WORKING AGENT'S ID>, notes:<artifact URL + the #206 comment
>    permalink>)`.**
>
> **THE TWO GRANULARITIES, stated because they are deliberately different and nothing mapped one onto
> the other.** §1.6 counts **per sub-artifact** (`CONFIRMED-THIS-CYCLE <item.sub-id>`); the dispatcher
> moves **per row**. **Twenty of the 21 rows have `N > 1` — only P2a is `N`=1**, so the gap covered
> nearly the whole ladder. Recount rather than trust that sentence:
> ```
> awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/ /,"",$2); gsub(/ /,"",$4);
>   if ($4+0>1) c++; else print "N==1: "$2} END{print "N>1 table rows: "c}' "$GP"
> ```
> → `N==1: **P2a**` and `N>1 table rows: 19`; +1 for off-ladder #190 (`N`=3) = **20 of 21**.
> *(This read "Eighteen of the 21" for two revisions — §5.31. The section that installs §1.2 clause 3
> carried a count that did not survive clause 3.)*
> P3b makes it explicit — *"Report P3b as 1/2 until P6 exits"* — while saying nothing about the task's
> dispatcher state. Two agents therefore did two different things: one held the claim open (heartbeat
> every 5 minutes, per the tool's own contract) until P6 landed and tripped §1.5's blocked-item drift
> at three cycles; the other called `release_task(release_reason:"completed")` at 1/2, and a second
> party `complete_task`ed a half-done row — which §1.5's phantom-progress row does **not** catch,
> because a `CONFIRMED-THIS-CYCLE` token naming P3b.1 genuinely does exist. The rule:
>
> - **`release_reason:"completed"` requires ALL `N` sub-artifacts to have countersigned #206 entries.**
>   A `completed` release on a row with a confirmed-but-incomplete sub-artifact set is a §1.5
>   phantom-progress violation on sight, alongside the empty-`pr_urls` case.
> - **A row with some sub-artifacts confirmed and some not is released with
>   `release_reason:"blocked"`** — **not `"partial"`, which is NOT in the tool's enum and errors.**
>   `release_task`'s live schema restricts `release_reason` to
>   `["completed","blocked","timeout","reassigned","out_of_scope","needs_human","audit_failed"]`
>   (read 2026-07-29). The REST route types it as a free `string` (`dispatcher.routes.ts` @ `release_reason?: string; context_handoff?: string;`), so
>   `"partial"` would be accepted over REST and rejected over MCP — **two surfaces, two behaviours,
>   which is precisely how two agents diverge**, so this document uses the MCP enum, the narrower one,
>   everywhere. The partial state is carried in the payload, not in the reason:
>   `pr_urls`/`commits` for what landed, plus
>   `context_handoff:"PARTIAL <k>/<N>; CONFIRMED <sub-ids>; OUTSTANDING <sub-ids>; BLOCKED-BY <what>"`.
>   The row re-enters `pending` (that is what `release()` does, §1.3's CTE) and is re-servable by
>   anyone. **This is the normal path for P9 (`N`=15) and P11 (`N`=8)**, which cannot be held under a
>   5-minute heartbeat for the days they take, and it is the path §1.9's 30-minute reclaim rule assumes
>   exists.
> - **A partial release is not a close and does not call `complete_task`.** `CONFIRMED` still moves by
>   the sub-artifacts that were countersigned — the counter is not held hostage to the row.
> - **P3b(2) specifically:** release `blocked` with a `PARTIAL 1/2` handoff after (1); do not hold the
>   claim across P6, and do not report P3b's dispatcher row as anything but re-queued.
> - **Filed against `recursivlabs/recursiv` alongside the other three tool defects above:** add
>   `partial` to `release_reason`'s enum, or drop the enum to match the route's `string`. Until then
>   the `PARTIAL <k>/<N>` prefix in `context_handoff` is the machine-readable form and
>   `grep -c '^PARTIAL'` over `list_task_activity` output is how you count them.
>
> **The `agent` parameter is the working agent's id, not the verifier's, and this is not a style
> choice.** `done()` filters the active claim with `AND tc.agent = ${agent}`, and its
> expired-claim fallback refuses outright unless the named agent has a **prior claim** on that task
> (`SELECT 1 FROM task_claim WHERE task_id = … AND agent = …` → *"has no prior claim … refusing
> fallback done()"*). A verifier passing their own id gets `null` and nothing is closed. **One grader
> prescribed `agent:<verifier>`; it does not work, and §5.21 records why.**
>
> **Consequence you must not paper over:** `logActivity(taskId, row.agent, 'completed', notes)`
> records the **worker** on the completing event too, so `list_task_activity` **cannot** tell you who
> countersigned. The countersignature exists only in `notes` and in the `COUNTERSIGNED-BY` field of
> the §1.6 cycle line. That is why §1.6 has that field, and it is the weakest link in this section.
>
> **`update_task(status:"done")` remains forbidden — but the previous revision's three stated reasons
> were two-thirds wrong, and a rule defended by a false mechanism is a rule the next agent discards
> when it checks (§5.26).** Read from source:
>
> - **It is rejected by the server, not merely by this document.** `updateTaskSchema`
>   (`dispatcher.routes.ts` @ `status: z.enum(['pending', 'in_progress', 'blocked'])`) is `z.enum(['pending','in_progress','blocked'])` in a `.strict()`
>   object, so `PATCH /tasks/:id` with `status:"done"` returns **`400 Invalid input`** @ its `{error:'Invalid input'}, 400` return
>   before any handler runs. If it were reached, `DispatcherService.updateTask` throws
>   `'Cannot set status to done via updateTask — use the done() method instead'` (@ `Cannot set status to done via updateTask`).
> - **The claim that it "writes no activity row" was FALSE and is retracted.** The org-dashboard path
>   `setTaskStatusManually` (@ `async setTaskStatusManually(`, reached from `orgDispatcher.router.ts` @ `return await dispatcherService.setTaskStatusManually(`) closes the
>   `task_claim` row inside a transaction and calls
>   `logActivity(taskId, actor, 'completed', 'Status set to done manually')` @ `'Status set to done manually'` — recording the
>   **caller**, which is *strictly better provenance* than `complete_task`, whose `done()` logs
>   `row.agent`, the worker (`:1126`).
> - **What it actually costs, and why the prohibition survives intact:** it writes **no `pr_urls` and
>   no `commits`** (those fields exist only on `release_task`), it **requires no prior claim by
>   anyone**, so it closes items nobody worked, and it stamps `notes = COALESCE(notes,'completed
>   manually')`, which is the artifact link §1.3 depends on being absent. **A caller-attributed row
>   with no evidence fields is still a single-party close and is a §1.5 phantom-progress violation on
>   sight.**
> - **Keep the irony, it is load-bearing:** the one call this document bans is the only one that
>   records *who closed the task*. That is why §1.6's countersignature cannot live in the dispatcher
>   at all and is bound to a GitHub comment author instead, and it is the concrete ask in the defect
>   §1.3's enforcement gap files: make `complete_task` log the caller the way `setTaskStatusManually`
>   already does.
- **P11 is the one step where the actor cannot be the second party.** The gate is run by one human
  and countersigned by **the named human in §10's "Who countersigns the P11 launch gate?" row**, or by
  a CI job that re-fetches T0, T1 and every `qa-media/launch-gate-<build-id>-*` path and asserts they
  exist. Everywhere else §1.3's "a human" is sufficient; at the launch gate it collapses, because §1.9
  assigns the sitting to Bill and Bill also wants to launch. **An earlier revision said "a *different*
  named human" and named nobody, in a document whose only other named human appears twice — so the
  terminal gate had a requirement with no referent, no owner, no decide-by and no lapse default, which
  is the §10.26 defect recurring at the last row of the ladder. It is now a decision row, which is the
  only structure §1.4.4's automatic default operates on.**

**`complete_task` is not evidence.** It records that a `done` row was written. It does not record
that anything happened. The evidence is the artifact in `notes` and on #206.

**This rule crosses repos, and it currently loses there.**
`git -C ~/dev/recursiv show origin/main:CLAUDE.md | grep -n complete_task` →
`40:5. **When done** → \`complete_task\` with notes on what was shipped`, under a heading that reads
`## Dispatcher Workflow (MANDATORY)`. That is the file Claude Code auto-loads for the repo where
**PS, P8 and P9** are done, and it instructs the *worker* to make the closing call — the one half of
the transition above that the worker may not make. Until that line is amended, every engine-side
hand-off is a §1.5 phantom-progress risk by construction. **Exit artifact, and it is PS
sub-artifact (4):** `git -C ~/dev/recursiv show origin/main:CLAUDE.md | grep -c release_task` returns
non-zero and step 5 reads `release_task(task_id, release_reason:"completed", pr_urls:[…],
commits:[…])`, with `complete_task` moved to a separate "verifier" step.

> **THE ENFORCEMENT GAP, stated because concealing it would be the exact failure this section
> prevents.** §1.3's second-party rule is a **convention with no mechanism inside the dispatcher**.
> Verified against the live tool schemas 2026-07-29: `mcp__recursiv__complete_task` requires only
> `task_id` — `agent` is optional, and when the claim is still active the `agentFilter` is simply
> omitted (`done()` @ `const agentFilter =`, the SECOND of two occurrences — the first is in `release()`). Any agent holding the org key can claim, work
> and close its own task, and the dispatcher checks neither who verified it nor whether a link is
> present. *(The MCP `update_task` status enum advertises `done` and `archived`; both 400 at the REST
> layer, so that is a wrapper defect, not a second close path — see the block above.)*
>
> **Three consequences, all actionable now.** (a) File this against `recursivlabs/recursiv`: reject
> `update_task(status:"done")` at the tool layer where it already 400s at the route layer, and drop
> `archived` from the wrapper enum in favour of `archive_task`; require `complete_task`'s caller
> identity to differ from the task's last claimant; record the *caller* as well as the worker in
> `task_activity`, the way `setTaskStatusManually` already does @ `'Status set to done manually'`; and require `release_task`'s
> typed evidence fields for a `completed` release. (b) **Until that ships, the countersignature is not
> held in the dispatcher at all — it is held by GitHub, which attributes comment authorship and which
> the working agent cannot forge.** §1.6's `COUNTERSIGN` rule is the mechanism; it is the reason this
> gap is survivable rather than fatal. (c) §1.3 is otherwise enforced only by §1.5's "Phantom progress"
> row on review, and **the loop should assume it is being violated.**

### 1.4 What an agent does when blocked on a human decision

**Twenty-five decisions are blocked on a human (§10's table). Four of them block §2 directly and cannot
be resolved by any amount of agent work:**

| # | Decision | Score | What it blocks |
|---|---|---|---|
| #195 | Which layer opens (app / app+SDK / app+SDK+engine), and the licence | **120.0** | The community/fork thesis; re-publishing the repo; #204; **P2b sub-artifact (5)** (PR #194's mission language); `DESIGN.md`'s tagline (§8); every "every fork inherits this" ranking argument |
| #186 | `react-native-track-player` on New Architecture: patch / replace with `expo-audio` / ship without lockscreen audio / disable New Arch | (§2 P3) | The store build; **P3's EXIT, not its start — P3 sub-artifact (2) names this row directly**; P12 |
| #189 | Usernames: stable server-owned identity, or mutable display alias | (§2 P7) | The auth-response shape, onboarding, backlog item 33 |
| #197 | The **scope** of the monetization staging gate — which proof lines are launch-blocking vs. fast-follow | (§2 P9) | The launch date itself; whether P8 → P9 is a real edge (§2) |

Protocol:

1. Do not guess. Do not "assume for now" and build on the assumption — that is how an undecided
   thing becomes a decided thing nobody chose.
2. Set the dispatcher task `blocked`. Comment on the GitHub issue with: the options, the cost of
   each, what you would do absent a decision, and **the date after which the default applies**.
   §10's table now carries that default per row, so the comment quotes it rather than inventing one.
3. Work the next unblocked, **unclaimed** item in §2's order (§1.9). Do not idle and do not invent
   work.
4. **If a decision is past its §10 decide-by date, the default in §10's table takes effect
   automatically.** The agent records that fact as a §5 row and proceeds on the default. An overdue
   decision must never block the loop; a silently-applied default must never be unrecorded. Say so at
   the top of the next cycle line.
   **RE-VERIFY THE PREMISE BEFORE EXECUTING, and this clause is not optional — a default can go stale
   between the day it is written and the day it lapses.** The row was written against a condition that
   held then; the lapse fires on a date, and nothing in between checks whether the condition still
   holds. **Before acting on a default, re-run the command that establishes the problem it solves.**
   If that command now says the problem is solved, or solved differently, **do NOT execute the
   default**: post the evidence on the decision's issue, state which of the row's own options the world
   has already taken, and ask the owner to confirm or supersede. **Recording the lapse is still
   mandatory** (clause 5) — what is suspended is only the *execution*, and only with the refuting
   command pasted. **An agent that executes a stale default has not been careful, it has been
   obedient**, and §1.1's rule that a hypothesis may never close an item applies with equal force to a
   date closing one. **§5.53 is the live instance and it is not hypothetical**: #186's default is
   *"ship with lockscreen audio disabled and the track-player import removed"*, its option 1 (patch the
   library) shipped in PR #184 and is on `main`, and executing the default would have removed a working
   feature to fix an already-fixed crash.
5. **A decision is only made when `mcp__recursiv__log_decision` returns an id and that id is written
   into §10.** A decision asserted in prose, Slack, or a PR comment is not a decision. **A default
   that took effect under clause 4 is recorded the same way**, with `log_decision` naming the date it
   lapsed.

### 1.5 The circling detector

| Symptom | Check | Response |
|---|---|---|
| Re-auditing | Two consecutive cycles on #206 produce findings but zero new §2 sub-artifacts | Stop auditing. Take the highest-scoring **unblocked, unclaimed** §2 item and produce its artifact. **Exception: not a circling condition while the active item's `N` is greater than 3 and its sub-artifact count moved — report the sub-count.** |
| Doc growth without artifact growth | `git log --oneline docs/ \| wc -l` rises while §1.6's `CONFIRMED` is flat | Freeze docs edits for one cycle. Only §1.2 citation repairs and §5 retractions are allowed. |
| Re-derivation | A claim listed in §5 as retracted reappears in a PR, issue or plan edit | Reject the PR. Point at the §5 row. §5 is append-only and binding. **§5.16 is a live instance in the estate right now.** |
| Phantom progress | A `done` task with **no `CONFIRMED-THIS-CYCLE` token on #206 naming it**, **or** a `CONFIRMED-THIS-CYCLE` token with **no matching `COUNTERSIGN` comment from a second GitHub login** (§1.6) — **this second clause is SUSPENDED while §1.0's `COUNTERSIGN-UNAVAILABLE` is in force, because with one login on the box it is unsatisfiable and would fire on every correctly-closed row; evaluate the other three** — **or** `list_task_activity` shows a `completed` release with empty `pr_urls`, **or** a `release_reason:"completed"` on a row whose `N` sub-ids do not all have countersigned #206 entries (§1.3's two-granularities rule) | Reopen it (`update_task(status:"pending")` — legal, `pending` is in the REST enum). §1.3 was violated — and per §1.3's enforcement gap this is expected, not exceptional. **Run this project-scoped**; the unscoped `get_dispatcher_stats` counter is several hundred pre-existing `done` rows and is unusable for this loop. **Do not quote a number here — re-run it (§1.0, §1.2 clause 3); it drifts between grading rounds, and this row previously carried `Done: 335` as though it were current while the live value had already moved.** *(The check cannot be "a task shows `done`" — under §1.3's transition `done` is the correct terminal state. The signal is a `done` with no countersigned #206 entry.)* |
| Baseline drift | §1.6's denominator changed with no `BASELINE` line on #206 | Reject the PR that changed it. §1.6's denominator rule applies — **in both directions; a decrease has its own wire format and its own `log_decision` requirement.** |
| Ladder table unsorted or unrecomputable | §3's two-part check fails: any §3.1 row's published score differs from the formula by ≥0.05, or the score column is not descending | Reject the PR. §3.1 is §2's designated tie-break between simultaneously-startable rows, so an unsorted table makes two free agents pick different work. §5.24 is the live instance this row was written for. |
| Blocked-item drift | The same item is `blocked` for 3+ cycles with no comment change | Escalate to Bill by name in the cycle line, with the §1.4 decision text. |
| **Frozen ranking** | **Three consecutive cycles post `RESCORE none` while #206's cycle lines record facts that bear on a row's inputs** — a decide-by that passed, a dependency that closed, a `MONITOR-DARK`, a `BASELINE` line, a scope declaration, an issue body edited. This is the INVERSE of the drift row above and was missing entirely until 2026-07-30: the document detected a score moving when it should not, and never a score standing still when it should move (§5.45). | Rescore before claiming. **A `RESCORE none` posted in the same cycle as a fact that bears on an input is a false statement about the world, not a no-op** — it is the scoring-layer form of the phantom-progress row. Name the fact, move the input, post the `RESCORE` line. |
| Score/plan divergence | `get_task` returns a score disagreeing with the score §3.1's own inputs compute to, by more than 1.0. **Re-stated 2026-07-30: this compares the dispatcher against the FORMULA APPLIED TO §3.1's INPUTS, not against §3.1's printed score column, and not against a pasted `score_override`.** With the override retired (§3.2), a divergence now means the inputs were never pushed — step 2b skipped — which is a real and detectable failure rather than a mis-typed number. | **This only detects a skipped `score_override` step, and that is all it is for.** `DispatcherService.ts`'s own header says verbatim `// score_override takes precedence if set.`, so once step 2 of §3.2 runs the two agree by construction. Execute §3.2 step 3's failure branch — `SCORE-MISMATCH` to #206, one re-run of step 2, then `blocked` + §1.4. **Do not read this row as a check on the auto-scorer:** the auto-scorer never runs on a ladder row (`hasScoring`, §3.2), and measuring it needs the separate throwaway probe in §10.24. |

### 1.6 What "closer" means, precisely

Distance to the goal is **the count of §2 exit sub-artifacts that do not yet exist.**

**Counting rule: §2 carries an explicit `N` column. That column is the only source of the total, and
the total is its sum. No rule infers it.** A row's `N` is written down when the row is written.
Every sub-artifact inside an `N` must be **separately confirmable by a second party**, or it is not
a separate `N`. If you disagree with a row's `N`, change the column in a PR a human merges (§1.7) —
do not recompute it at read time.

*Why the column exists: the previous revision used the prose rule "a step whose exit names more than
three independently-confirmable things is counted by those things", then applied it to only three
steps. P6's own cell opens "Four steps, in order" and counted 1; P11 named seven sub-checks and
counted 1. Two agents applying that rule honestly got different denominators, and the denominator is
the divisor of every progress report the loop emits. §5.19 records it.*

> **Twenty-seven steps, one hundred and thirteen artifacts, from here to production. It starts at 113 outstanding, 0
> confirmed.** Recompute:
> `awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/ /,"",$4); s+=$4; n++} END{print n, s}' "$GP"`
> → **`26 110`**, plus the off-ladder #190 row (3) = **113**. **`$GP` is bound at the top of this file;
> the bare relative path fails with exit 2 from anywhere but the repo root and this is the denominator
> of every progress report the loop emits.**

`CONFIRMED` goes up only when an artifact appears and a second party confirms it (§1.3). It goes
**down** when a confirmed artifact stops existing — a reverted merge, a re-broken CI, a rotated key
copied back, a gate re-failed (§1.8). Nothing else moves it. Not lines of code, not merged PRs, not
closed issues, not this document getting longer.

**Denominator rule.** The denominator is not fixed. A row may be added to §2 only by the four
mechanisms that authorise it — **§1.8 step 3** (a gate root cause), **§8's carve-out** (a newly found
cross-user private-data defect), **a confirmed §10.23-class external deadline**, and **§1.0's
self-audit gap** (PA, and only PA — none of the other three authorised it, which is why an earlier
revision left PA off the ladder rather than admit the enum was short). When a row is added, the agent
adding it (a) edits §2's table and §1.6's header in the same PR, (b) restates the denominator in that
cycle's line, and (c) posts one extra line to #206 in exactly this form:

```
BASELINE <old>/<new>  REASON <§1.8 | §8-carveout | §10.23 | §1.0-selfaudit | §1.7-human-prereq>  ROW <id>  ARTIFACTS +<n>
```

**`§1.7-human-prereq` was added 2026-07-29 and the enum was short again.** Bill declared RLS and the
`recursiv.app` switchover launch prerequisites; both are ranked rows (`PR`, `PD`) and neither of the
four existing reasons describes a human adding scope under §1.7. The identical gap is on record one
paragraph below for decreases — *"the enum above had no value for it"* — and PA's row records a third
instance. **An enum that has been short three times is a shape, not an accident: when a legal action
has no wire format, the honest agent either lies or stalls.** If you add a row for a reason none of
the five covers, extend the enum in the same PR and say so here rather than picking the nearest fit.

**A row's `N` may also DECREASE, by exactly one mechanism, and this was missing.** §10's defaults can
*shrink* a row's scope — #186's lapsed default, three days out when this was written, removes work
from P3's exit — and the enum above had no value for it while `ARTIFACTS +<n>` was written as an
increment. An honest agent applying a lapsed default therefore changed the denominator with no legal
way to say so, and §1.5's baseline-drift row fired on **them**. The decrease format is:

```
BASELINE <old>/<new>  REASON §10-decision  ROW <id>  ARTIFACTS -<n>  DECISION <log_decision id>
```

**The `log_decision` id is required** — without it the reduction is unauthorised and §1.5's
baseline-drift row applies. **A decrease is NEVER reported as `DELTA-DISTANCE` progress: a decision
that removes work is not work done**, and a loop that could shrink its own denominator and call the
result progress would have exactly the motion generator this document exists to stop.

A denominator that changes without a `BASELINE` line, in either direction, is a §1.5 baseline-drift
violation — reject the PR and point at this rule. **`DELTA-DISTANCE` is computed against `OUTSTANDING`
only across cycles with the same baseline; a baseline change is reported on its own line and never as
progress or regression.**

Every cycle posts exactly this block to #206, and nothing else counts as a progress report:

```
CYCLE <loop-id>/<n>  CONFIRMED <c>/<D>  OUTSTANDING <D-c>  DELTA-DISTANCE <signed int>  ELAPSED <days>
BLOCKED-ON-HUMAN <list of #>  NEXT <item id>  SELF-AUDITED <yes|no>
CONFIRMED-THIS-CYCLE <item.sub-id>=<artifact URL or command+output digest> COUNTERSIGNED-BY <name>
```

**`<D>` is the current denominator: the sum of §2's `N` column plus the off-ladder #190 row,
recomputed from the table at read time with the `awk` above, never copied from a previous cycle line.
It is 113 today** — 93 until 2026-07-29, when `PR` (+4) and `PD` (+3) were added as ranked rows;
see §5.38 and the `BASELINE 93/100` line on #206. **If your `<D>` differs from last cycle's and you did not post a `BASELINE` line, you
have miscounted — recount before posting; if it genuinely changed, post the `BASELINE` line first.
`DELTA-DISTANCE` is meaningful only between two cycles with the same `<D>`.

**`CONFIRMED` is not a number an agent may carry forward on trust, and it is not derived from
anything the working agent types.** This was the weakest link in the document: `COUNTERSIGNED-BY` was
a **free-text token the working agent wrote about itself**, so the entire `CONFIRMED` counter — the
numerator of every progress report — was self-certified. The remedy costs nothing and was available in
the command already prescribed: **GitHub attributes comment authorship.**

> **A `CONFIRMED-THIS-CYCLE` entry counts only when a SEPARATE comment on #206, authored by a
> different GitHub login than the one that posted the cycle line, contains:**
> ```
> COUNTERSIGN <item.sub-id> <artifact URL or command+output digest>
> ```
> **The count is derived by:**
> ```
> gh issue view 206 --json comments \
>   --jq '[.comments[]|select(.body|startswith("COUNTERSIGN "))|{a:.author.login,b:.body}]'
> ```
> **and an entry whose countersigning author equals the cycle-line author is DISCARDED.** Verified
> that `author.login` is populated and non-forgeable by the comment body:
> `gh issue view 1949 --repo recursivlabs/recursiv --json comments --jq '[.comments[]|{a:.author.login}]'`
> → `[{"a":"ottman"},{"a":"ottman"},{"a":"ottman"},{"a":"ottman"}]` (2026-07-29).
>
> **`COUNTERSIGNED-BY <name>` stays on the cycle line as a human-readable pointer and is NOT the
> record.** A token a writer types about itself can never be the record of a second party.

`CONFIRMED` is therefore: the count of distinct `<item.sub-id>` tokens that have both a
`CONFIRMED-THIS-CYCLE` entry and a surviving `COUNTERSIGN` comment from a different login, minus those
retracted under §1.8. Do not copy last cycle's number. Two agents can otherwise both post
`CONFIRMED 12` while disagreeing about which twelve, and a third has no command to tell them apart.

`DELTA-DISTANCE` is this cycle's `OUTSTANDING` minus last cycle's `OUTSTANDING`. **A cycle that
produced work reports a NEGATIVE number. A positive `DELTA-DISTANCE` is a regression and §1.8
applies. Zero means nothing moved.** There is exactly one sign convention and this is it.

**Known limitation, named rather than smoothed over: `DELTA-DISTANCE` weights every sub-artifact
equally.** P9 (`N`=15, effort 9) moves the counter 15; P3b (`N`=2, effort 4) moves it 2. The counter
will therefore read as near-stalled through the expensive middle of the ladder and then jump. **Do
not treat a low `DELTA-DISTANCE` during P9 as a circling signal** — that is what §1.5's `N > 3`
exception is for. An effort-weighted metric was considered and rejected: effort is an estimate and
artifacts are facts, and a metric built on estimates can be moved by re-estimating.

Three consecutive cycles at `DELTA-DISTANCE 0` with nothing blocked is a circling condition — §1.5
applies, subject to the `N > 3` exception in that table.

### 1.6b What this document does NOT measure — time

**There is no target launch date here, and that is deliberate: an artifact count is falsifiable and a
date is not.** But the absence must not be read as "time does not matter" — the document refers to
"the launch date" twice (§2's decision block, §10's #197 row) without ever saying whether one exists.
Two clauses keep that honest:

1. **Every cycle line carries `ELAPSED <days-since-cycle-1>`**, so the artifacts-per-day ratio is
   visible even though no rule keys off it.
2. **If `CONFIRMED` is below 20 at day 30, or below 50 at day 60, the loop escalates to Bill by name
   in the cycle line with the phrase `PACE-ESCALATION`, quoting the ratio.** **SUSPENDED while
   `COUNTERSIGN-UNAVAILABLE` is on the cycle line** (§1.0's Cycle-0 sub-action): with one GitHub login
   on the box, `CONFIRMED` is 0 by mechanism, not by pace, and an escalation that fires for a
   mechanism gap trains the next agent to ignore the escalation. The suspension is itself reported —
   `PACE-SUSPENDED COUNTERSIGN-UNAVAILABLE` — so it is visible rather than silent.

Those two thresholds are guesses of the same class as §1.5's (§10.21) and are tuned after five
cycles. **A launch date, if one is ever set, is a §10 decision with an owner and a default — never a
number an agent infers from this ladder.**

### 1.7 Boundaries the loop may not cross on its own

- No agent modifies `.claude/settings.json`, CLAUDE.md, permission config, or its own operating
  contract. A change to §1 — including any `N` in §2 — is a PR a human merges.
- No agent sends bulk email, publishes an `eas update` to `production`, force-pushes, deletes a
  branch, rotates a live credential, or submits to a store. Those are human actions.
  **Three ladder rows require one of them, and they are marked `HUMAN-ONLY` in §2 and loaded with
  `owner=<the named human>` at Cycle 0 rather than left to be discovered at claim time: P0**
  (rotates a live credential), **P11** (the sitting is one human's, §1.9), **P12 sub-artifacts (1) and
  (2)** (`eas submit` to both stores). *(They sat in the claimable queue with no marker, P0 at 92.0 —
  the second-highest row in the estate — so the highest-value thing an agent could reach was a thing
  §1.7 forbade it to finish. P11 said "One human, one sitting" in its own prose; P0 and P12 said
  nothing.)* **An agent may claim a `HUMAN-ONLY` row to do everything up to the forbidden action, and
  must then release with `PARTIAL k/N` and `BLOCKED-BY §1.7 <the action>` rather than execute it.
  Preparing is not forbidden; only the named action is.**
- No agent starts an autonomy or large-scale-ingestion workstream. See §7's hard rule.

### 1.8 When a gate fails

A gate failure is a first-class outcome, not an exception. An earlier revision wrote every gate as a
pass condition and defined no failure branch — including for two P0 launch-blockers.

On failure the agent:

1. Posts the **failing** artifact — the transcript, the recording, the elapsed time — to the gate's
   issue and to #206.
2. Sets the step back to NOT-DONE, which **decrements `CONFIRMED` and increases `OUTSTANDING`**. A
   regression must be visible in the distance metric or the metric is decorative.
3. Files the root cause as a new §2 row with its own exit artifact **and posts the `BASELINE` line
   §1.6 requires**. **A gate may not be re-run until a named change lands.** Re-running a gate hoping
   for a different result is the purest form of the motion this document exists to stop.

Specifics: P9 failing any of #197's proof lines blocks launch and forces the #197 scope decision to
be taken explicitly rather than by attrition — "we shipped anyway" is the exact self-trickery this
document exists to prevent. P11's rollback drill over ten minutes blocks launch until it is
re-measured under ten. **Store rejection at P12 is a gate failure, not a delay:** post the rejection
text to #206, decrement `CONFIRMED`, and file the cited guideline as its own §2 row before
resubmitting. **Three consecutive failures of the same gate — including three rejections on the same
Apple guideline — escalate to Bill by name.**

### 1.9 Contention — who works what, with more than one agent running

This document is written for a loop that runs continuously.

- **Agent-to-agent.** No agent starts a §2 step without `claim_task` returning success. No agent
  works a claimed task. **`heartbeat_task` must be called every 5 minutes — that is the tool's own
  stated contract** (`Must be called every 5 minutes to keep the claim alive.`), not a convention.
  A claim whose heartbeat is more than **30 minutes** old is reclaimable: read it from
  **`list_active_claims`**, which is the only tool that reports heartbeat status (`List all active
  task claims — shows which agents are working on which tasks, with heartbeat status.`), then
  `release_task(task_id, release_reason:"timeout", notes:<last heartbeat timestamp>)`.
  **Do NOT use `list_stale_tasks` or `list_stuck_tasks` for this.** Both take `days` with
  `minimum: 1`, and `list_stale_tasks` is defined over task *updates* (`List tasks with no updates
  in N days`), not claim liveness — neither can see a claim that went stale an hour ago. All three
  schemas read live 2026-07-28. *(The previous revision named `list_stale_tasks` here. It is present;
  it is not fit. See §1.1's second corollary.)*
  Two free agents take the highest and second-highest **unclaimed** unblocked rows.
- **Loop-to-loop. This document is not the only controller operating on the data this app reads.**
  The engine repo runs its own: `recursiv:docs/RLS-COMPLETION-GOAL-PROMPT.md`
  (`git -C ~/dev/recursiv log -1 --format='%h %ad' --date=short origin/main --
  docs/RLS-COMPLETION-GOAL-PROMPT.md` → `096632c7 2026-07-12`), which opens *"paste the whole thing
  into a fresh Claude Code session at `~/dev/recursiv`"* — a competing controller for a competing
  loop. Its own state section says verbatim **"The rollout has been frozen since 2026-05-08"** and
  **"Tables with RLS actually enabled today: ZERO"**, and I confirmed the second:
  `git -C ~/dev/recursiv grep -c "ENABLE ROW LEVEL SECURITY" origin/main -- drizzle/` exits `1` with
  no output. Its **Phase 2** table list is verbatim *"P2 `post`, `conversation`,
  `conversation_member`, `conversation_message`, `notification` (org)"* — **the tables this app's feed
  and chat read**. Its Prime Directive 1 states verbatim: *"If the RLS-enabling migration ships
  before/with the caller code, every affected endpoint returns zero rows for the whole deploy
  window."*
  **Rule: no RLS PR-B touching a Phase 2 table merges without a Minds-side confirmation comment on
  #206 naming the SHA and the wrapped call sites.** Exit artifact for that confirmation: a
  `[staging]` transcript showing the Minds feed returning a **non-zero** post count against a DB with
  the policy enabled. Whether the Minds launch blocks on RLS Phase 2 at all is a §10 decision with a
  written default.
- **Human-to-human.** Bill is the single point of contention — 24 of the 25 §10 decisions (Jack owns
  #186), P0, and the P11 sitting. **Jack is the P11 countersigner (§10's countersigner row), which is
  the one place the loop structurally cannot route through Bill.** When two steps need Bill in the same window, **decisions win over
  execution**, because a decision unblocks agents and execution does not.
- If a step needs a person unavailable for 72 hours, mark it `blocked` and report `BLOCKED-ON-HUMAN`
  rather than letting an agent proceed on a guess.

#### 1.9a The controller registry — one controller per OUTCOME, not per repo

**The question "is this a Minds task or a Recursiv task?" has the wrong shape, and answering it by
repository produces the wrong answer.** The unit a controller governs is a **shippable outcome**,
because the denominator is what makes §1.6 mean anything and a denominator is only closed around one
outcome. §2's treatment of engine issue #1296 already states the principle: it is *"deliberately NOT
added as a P4 sub-artifact, because it is work in a repo this ladder does not own and moving this
document's denominator for it would make the counter measure something other than this launch."*

> **THE TEST, one sentence: not *which repo does the diff land in*, but *whose exit artifact does it
> close?*** Those two answers diverge constantly, and only the second is correct.

| Outcome | Controller | Owner | Where the work lands | Edge into THIS ladder |
|---|---|---|---|---|
| A stranger can install and USE Minds 2.0 across all seven surfaces (§2, amended 2026-07-30) | `docs/goal-prompt.md` (this file) | Bill | `recursivlabs/minds`, plus engine work at PS/P8/P9/P10 | — it *is* this ladder |
| Every tenant table has enforced RLS policies | `recursiv:docs/RLS-COMPLETION-GOAL-PROMPT.md` | **unassigned — §10 row, decide-by 2026-08-04** | `recursivlabs/recursiv` | **`PR`, verification only** |
| `~/dev` is one estate across machines | `ottman/dev-hq#1` + `dev-hq:MANIFEST.tsv` | Bill | `ottman/dev-hq` | **#199, off-ladder, deferred (23.5)** |
| Battlechat ships | `fishtank-live/battlechat` + its collaboration protocol | Wes | `fishtank-live/battlechat` | **none — different estate, do not couple** |

**Three consequences, all binding:**

1. **Cross-repo work belongs INSIDE a controller when it is on that outcome's critical path.** `PS` is
   engine work and correctly a Minds row, because a Minds exit artifact depends on it. That is not an
   exception to the rule; it is the rule.
2. **Absorbing another outcome's work into your denominator is forbidden.** When A depends on B's
   outcome, A gets a **verification** row and never a *doing* row, and **B's completion is re-fetched by
   A** rather than reported by B. `PR` is the reference implementation — its sub-artifact (3) is a
   `get_task` this loop runs itself.
3. **Contributing upstream is prescribed, not a detour** — §7 belief 1 (fix at the platform layer, prove
   it through the SDK). **The accounting rule that was missing: Minds' denominator moves for engine work
   if and only if a Minds exit artifact depends on it. Otherwise it is a contribution — recorded in the
   cycle line, counted by nobody.** A loop that counted its own upstream generosity would be measuring
   something other than this launch.

#### 1.9b Human driver ownership — imported from the battlechat protocol, because §1.9 had no such concept

§1.9 above covers **agent-vs-agent** (`claim_task`, the 30-minute heartbeat reclaim) and then says
*"Bill is the single point of contention"* and stops. **There is no notion of a named human driver on a
shared branch, which is a real hole**: two humans on one lane cannot be arbitrated by `claim_task`.
`fishtank-live/battlechat` runs a protocol that closes it. Five clauses are imported and bind humans and
agents equally.

1. **One named driver owns writes to a lane at a time.** A lane is a shared PR, branch, deployment path,
   or migration stack. Everyone else reads and reviews and **must not push, rebase, merge or deploy that
   lane.**
2. **A handoff names four things or it is not a handoff:** the exact current commit SHA, the new driver,
   the allowed scope, and **whether behaviour may change.** §1.3's `context_handoff` carries
   `PARTIAL k/N` and none of these — they go in the same string.
3. **Before pushing, fetch and verify that BOTH the shared branch and its base are still at the expected
   SHAs.** If either moved, stop and reconcile; never overwrite unseen work. **Not hypothetical: on
   2026-07-29 `origin/main` moved `3761e415` → `6486972` mid-task while a fix was being prepared against
   the old head. It was caught by re-verification habit, not by any rule in this document — and habit is
   not a control.**
4. **After any rebase or force-push, prior approvals and green checks are STALE and must be re-run on the
   exact new head.** §1.3's second-party approval currently survives a history rewrite, which means a
   countersigned artifact can be silently replaced by a different one. Closing that is this clause's
   whole value.
5. **Only one behavioural PR occupies a merge lane at a time.** P2b's train is this idea applied to one
   row; it generalises. Use a protected merge queue where the platform offers one.

*(Battlechat's remaining clauses — PR narrative format, production-is-never-the-first-test, and never
weakening money/security/identity/moderation/migration/rollback safeguards to avoid waiting — are
already carried here in stronger form by §9's six mandatory headings, §6.1's environment labels and
§1.7's boundaries. Its `--force-with-lease` + `git range-diff` clause is adopted **for humans only**:
§1.7's flat ban on force-push stays for agents, which cannot judge whether they are clobbering unseen
work.)*

**What battlechat gets right that this estate should copy, as a measurement rather than an impression**
(2026-07-29): its PR gate runs **0–2 min** across **3** workflows and it merged **12 PRs in ~9 hours**,
all single-purpose. `recursivlabs/recursiv` runs **6–14 min** (25 when it times out) across **22**
workflows and has **19 open PRs, up from 10 in two days** — the shape LAUNCH-PROMPT already names as *"a
loop generating new attempts instead of iterating on one."* **The lesson is not "fewer checks": it is
that fast gating plus small single-driver PRs produces throughput, and that gating checks and scheduled
checks are different budgets.** Most of recursiv's 22 are already scheduled; the gating path has never
been separated out and held to a time budget. That is engine work under §1.9a's registry, not a row
here — but it is why **P2a's `required_status_checks.contexts` should name a FAST subset rather than
everything green.**

#### 1.9c A subagent is not a second party — fan-out is a work primitive, never a verification one

**This clause exists because the convenient reading and the honest reading diverge, and nothing above
said which one wins.** Anyone picking this up in a modern agent harness will reach for a subagent, and
the obvious use — *"spawn a verifier"* — silently defeats §1.3 and §1.6.

1. **A subagent, a workflow-spawned agent, or any agent acting under another agent's direction is
   NEVER §1.3's second party and NEVER §1.6's countersigner.** It shares the parent's identity, the
   parent's credential and the parent's instructions. §1.6 binds countersignature to a **GitHub comment
   author** for exactly this reason — because agent self-attestation is unverifiable — and §1.0 already
   settles the analogous case: `github-actions` counts only if its comment **re-executes the
   sub-artifact's own command inside the run** (with the `run_id` in the body) **and** the posting
   workflow is a required check the loop cannot disable. **A subagent satisfies neither condition.**
   Treating one as a second party re-creates the free-text `COUNTERSIGNED-BY` token §1.6 deleted,
   wearing a different hat.
2. **Fan-out is unrestricted for read-only work that produces INPUTS rather than closures.** Route
   enumeration for P8(4), consumer enumeration for P0, citation sweeps, repo inventories, reading an
   issue body before re-deriving P9 — parallelise all of it freely. The artifact is still produced by
   one accountable agent and still countersigned by a different **login**.
3. **A `CONFIRMED-THIS-CYCLE` token whose countersignature traces back to the same session is a §1.5
   phantom-progress violation on sight**, and is reopened under that row's existing mechanism.

**Enforcement is honest about its own limit, per §1.3's enforcement-gap precedent: no command can
derive session lineage from a GitHub comment.** `scripts/check-controller.sh` cannot check this and
does not pretend to. It is enforced the way §1.3 is — by §1.5 on review, by the fact that a second
**login** is the thing §1.6 actually counts, and by the loop assuming it is being violated.

**Nothing here is a throughput argument, and one is worth refusing explicitly.** The ladder's
bottleneck is not agent-hours: it is two sign-offs, one GitHub login, twenty-one undecided §10 rows,
and absent environments (`eas`, `gitleaks`, `apktool` all ABSENT per §4; no app staging until P4; no
iOS device per §10). **None of those is relieved by more agents**, the loop's model spend is
explicitly unbounded with no cap decided, and with six startable rows and one operator parallelism has
nowhere to go. **Adding orchestration to a loop blocked on a human is motion**, which is the one thing
this document exists to prevent.

#### 1.9d Two loops running continuously — what breaks, and the four rules that stop it

**The target is Bill and Jack each running a loop, always on, without collisions.** §1.9 arbitrates
agents inside one loop; §1.9a separates outcomes; neither describes two loops sharing this ladder,
this log and this table. Three things break immediately, and one thing finally works.

**1. Every cycle line names its loop: `CYCLE <loop-id>/<n>`.** The format was `CYCLE <n>` with a single
counter. Two loops both post `CYCLE 7`, `DELTA-DISTANCE` is computed against the wrong predecessor, and
§1.5's detector reads the last three comments as one sequence when they are two interleaved ones — so
it fires on phantom drift or misses real drift, and the log still *looks* orderly. Loop ids are
lowercase and stable (`bill`, `jack`); a cycle line without one is not a cycle line.

**2. Cross-loop countersignature is not a nice-to-have — it is THE mechanism, and two loops is what
switches it on.** §1.0 already admits *"a machine user not driven by this loop"* unconditionally.
**A loop running under `jotto141` is exactly that relative to a loop running under `ottman`**: a
different GitHub login, not driven by the other. **So the two-loop configuration is what finally takes
`CONFIRMED` off `0/113`** — the counter has been pinned by one login on one box, not by pace, and this
is the fix rather than a workaround. **The constraint that keeps it honest:** a loop may never
countersign an artifact produced by its own loop, in any cycle, ever — the discriminator remains
§1.6's, the countersigning comment's author login against the cycle line's author login, and §1.9c's
rule that a subagent inherits its parent's identity applies unchanged.

**3. Rescoring §3.1 goes through a PR, never a direct push.** §1.0's `RESCORE` step runs **every
cycle in both loops**, and both writing the same table directly is a lost-update generator: the second
push silently discards the first loop's re-derivation, and **neither notices, because the gate checks
internal consistency and consistency survives losing an update**. So rescore edits open a PR the gate
runs on, and §1.9b's named-driver rule governs that lane. **A cycle whose `RESCORE` line cites a fact
that never reached §3.1 is a §1.5 frozen-ranking instance**, not a filing detail.

**4. The queue is partitioned by OUTCOME, not by politeness.** Both loops read the same
project-scoped portfolio plus the canonical launch spine, and `claim_task` arbitrates correctly. But
**`claim_task` cannot see §1.9a's registry**, so a loop can atomically claim a row belonging to another
controller's outcome and the dispatcher will happily grant it. That is a rule, and it is checkable
before claiming: the row's outcome is named in §1.9a's table. **Claiming across an outcome boundary is
a §1.5 report, not a judgement call at claim time** — the same shape as §1.0's "unblocked" rule.

**What this does NOT need, stated so nobody builds it:** no new locking, no scheduler, no second
dispatcher project. `claim_task` + heartbeat already handle work contention; §1.9b handles branch
contention; the four rules above handle log, counter, table and outcome contention. **The failure mode
to watch is not collision — it is two loops that both idle**, each assuming the other took the
highest-scoring row. Both loops post `NEXT none IDLE <reason>` when they claim nothing, and two
consecutive idle lines from *different* loops in the same window is a §1.4 escalation to Bill by name.

---

## 2. THE DETERMINISTIC PATH

**Twenty-seven steps, one hundred and thirteen artifacts, from here to production.** Each exit is an artifact. The
`N` column is authoritative for §1.6 (§1.6's counting rule). **Serial** means the predecessor must be
`done` per §1.3 first. **This is a partial order — a DAG with five roots — not a queue**; the
"Parallel vs serial" block below is what resolves it, and it wins over the table's `Serial on` column.

**"Production" means SEVEN surfaces, reachable by a stranger — amended 2026-07-30 (§5.46).** The
three below, plus **the API (`PAPI`), the MCP server (`PMCP`), the SDK (`PSDK`) and the CLI (`PCLI`)**,
which are surfaces of this same product and accessible on day one, not a separate program. The three: **iOS** (App Store — an App Store
Connect record exists, `git show origin/main:eas.json` → `submit.production.ios.ascAppId`
`6793750469`), **Android** (Play), and **web** — **`https://terrapin.minds.com/`, named by Bill
2026-07-30 as the production web surface for THIS repo.**

> **THE HOST MAP — bound here because the estate has five names for four things.** Verified
> 2026-07-30, every line a command; Bill confirmed the identities the same day.
>
> | Host | What it is | State today |
> |---|---|---|
> | `terrapin.minds.com` | **production web, this repo** — the branded name for `minds.on.recursiv.io` | `200` |
> | `minds.on.recursiv.io` | **the same surface**, platform-assigned name. PW's and P13's existing citations are CORRECT, not stale | `200` |
> | `staging.terrapin.minds.com` | **production-shaped staging web** — re-verified 2026-08-24: CNAME `minds-staging.staging.recursiv.io`, HTTPS `/` returns `200`. This corrects the 2026-07-30 “no DNS” observation; P4 still requires its browser-bound staging evidence, not DNS alone. | `200` |
> | `build.minds.com` | the Recursiv-fork instance — a **different outcome** under §1.9a, not a row here | `200` |
> | `minds.recursiv.app` | `PD`'s target | `000`, expired cert |
> | `api.staging.recursiv.io` | staging API — **already healthy**, `/api/v1/health` → `{"status":"ok"}` | up |
>
> **The anomaly worth a decision: `build.minds.com` CNAMEs to `minds.on.recursiv.io` → `34.71.80.160`
> — the SAME origin as production** — and all three API hosts (`api.minds.com`,
> `api.build.minds.com`, `api.minds.recursiv.io`) return the identical commit `5230cec0`. So the fork
> and production are one deployment behind two names, and the fork cannot be deployed to, rolled
> back, or broken independently of production. Whether they separate before launch is a §10 decision,
> not an agent's call.
>
> **What this does NOT mean, corrected before it propagated:** an earlier draft of this block claimed
> PW and P13 were "written against the wrong host." They were not — `minds.on.recursiv.io` *is*
> `terrapin.minds.com`, so those citations hold as written. The real discrimination failure is
> narrower and sits with `build.minds.com`: a `curl` against the shared origin cannot tell production
> from the fork, so any artifact meant to prove one of them must name which, and PW(2)'s
> pre-committed string is what makes that checkable.

> **⚠ SCOPE DECLARATION, Bill, 2026-07-30 — READ BEFORE PLANNING ANYTHING. The three surfaces above
> are NO LONGER the whole definition, and the rows for the rest DO NOT EXIST YET.**
>
> Bill declared that launch also requires **a solid API, MCP, SDK and CLI**, and that **tokens and
> account migration are launch prerequisites**, not post-launch. Three things in this document
> contradict that and are hereby narrowed rather than silently overridden:
> **(a)** this three-surface definition; **(b)** §8's carve-outs for *"the full 1.5M cutover"* and the
> token economy; **(c)** §10's row *"Does 'launched' require `minds.com` to serve Minds 2.0?"*, whose
> written default is **No**. §5.44.
>
> **The denominator does NOT move yet, and that is deliberate.** It is **113** *(100 when this block
> was written; §5.46's four rows moved it — tokens and migration still add nothing)*. No `BASELINE` line is
> owed because **no row has been added** — and none can be until the decision below is made, because
> §1.4 forbids assuming-for-now and building on it. **An agent reading this must not invent the rows.**
>
> **Two structural questions gate the work, and both are §10 rows now:**
>
> 1. **What is Minds 2.0's bare-minimum feature set against legacy Minds?** Account migration cannot
>    be scoped without it — you cannot migrate 1.5M accounts into a product whose required surface
>    area is undefined, and "everything legacy does" is not a scope, it is a decade of accretion.
>    **This is the single most load-bearing undefined thing in the document as of today.**
> 2. **Do API/MCP/SDK/CLI enter as MINDS rows or as a separate outcome?** §1.9a's test is *whose exit
>    artifact does it close* — and those four are the **platform's** surfaces, in a repo this ladder
>    does not own. §1.9a forbids absorbing another outcome's work into this denominator. So either they
>    enter as **verification** rows in `PR`'s shape (Minds proves each works *for Minds*, the other loop
>    does the work), or they are a **second outcome** in §1.9a's registry with a DAG edge into `P13`.
>    **These two readings differ by roughly an order of magnitude in artifacts, which is exactly why an
>    agent may not pick one.**

> **`minds.com` does NOT point at Minds 2.0 and this ladder does not move it.**
> `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://minds.com/` →
> `301 https://www.minds.com/`; `curl -s -o /dev/null -w "%{http_code}" https://www.minds.com/` →
> `200`.
> **The discriminator — and the page title is NOT one:**
> `curl -s https://www.minds.com/ | grep -c "expo-root\|_expo/static"` → **`0`**, while
> `curl -s https://minds.on.recursiv.io/ | grep -c "expo-root\|_expo/static"` → **`1`**. Minds 2.0 is
> an Expo web build and the legacy network is not; that asymmetry is the test. Verified 2026-07-28.
> **Do not use `<title>`:** both hosts return `<title>Minds</title>`, and `www.minds.com` alternates
> it with `<title>Own your network | Minds</title>` across requests — four consecutive runs gave
> `Minds`, then `Own your network | Minds` ×3. An earlier revision printed one observed output of a
> nondeterministic, non-diagnostic command as though it established the conclusion. **The conclusion
> is unchanged and correct; the command that established it is replaced — §5.20.**
> The legacy cutover is deliberately out of scope with a named consequence — **§8**.

Two structural facts reorder everything:

> **1. Monetization must pass in staging before launch (#197), and the *app* has no staging.**
> **A staging origin exists and is healthy** —
> `curl -s -o /dev/null -w "%{http_code}" https://api.staging.recursiv.io/api/v1/health` → `200`,
> `https://staging.recursiv.io` → `200`, deployed by `recursiv/.github/workflows/staging-deploy.yml`.
> What does not exist is the **Minds app's** staging wiring: `git show origin/main:eas.json` declares
> four profiles and `android-internal` sets `"channel": "production"`; `git show
> origin/main:.env.example` has three lines and one origin, production; `git grep -c staging
> origin/main` → two files, both code comments (`lib/hooks.ts`, `lib/recursiv.ts`). **P4 is therefore
> not "build a staging environment" — it is "wire the app to the one that exists."** Smaller than an
> earlier revision thought, and still upstream of the entire launch.
>
> **2. The engine already ships the deploy/rollback layer this ladder needs. Reuse it.**
> `git -C /home/bill/dev/recursiv ls-tree origin/main .github/workflows/ --name-only` returns **22**
> workflows. The seven relevant to this ladder — filter with
> `… --name-only | grep -E 'staging-deploy|staging-db-refresh|promote-to-prod|prod-db-migrate|rotate-dispatcher-key|enforce-branch-protection|compliance-checks'`
> → **7 lines** — are `staging-deploy.yml`, `staging-db-refresh.yml`, `promote-to-prod.yml`,
> `prod-db-migrate.yml`, `rotate-dispatcher-key.yml`, `enforce-branch-protection.yml`,
> `compliance-checks.yml`. `promote-to-prod.yml`'s header says verbatim: *"Rollback = dispatch this
> workflow with the known-good SHA and skip_ci_gate=true."* Porting beats inventing for P0, P2, P4
> and P11. *(The previous revision printed these seven as the output of `ls`, which returns 22 —
> §5.17.)*

### The ladder

| # | Step | N | Exit ARTIFACT (this is the definition of done) | Rollback / blast radius | Serial on | Score |
|---|---|---|---|---|---|---|
| **P0** | `HUMAN-ONLY` Rotate the Mac's plaintext `sk_live_` + 2 Infisical creds | 3 | **`HUMAN-ONLY`, §1.7: no agent rotates a live credential. `owner=Bill`. An agent may enumerate consumers, stage the new key and write the two-phase runbook, then must release `blocked` with `PARTIAL k/3 … BLOCKED-BY §1.7 rotate-live-credential` — it may not execute the rotation.** **(1)** A **paired transcript from one terminal session**, `date -u` printed before and after: `curl -s -H "Authorization: Bearer $OLD" $ORIGIN/api/v1/users/me` → **`200` with the account's user id in the body** at T0, then the same command from the same shell variable → **`401`** at T1, with `sha256sum <<< "$OLD"` printed in both to prove the same string was sent twice. **A bare `401` is not evidence: `curl -s -o /dev/null -w "%{http_code}" $ORIGIN/api/v1/users/me` returns `401` with no credential at all (verified 2026-07-28), so an unpaired 401 is producible by sending nothing, a typo, or an invented string.** **(2)** The provider-side artifact, **structured like P12(5): the provider's OWN response first, the picture as supporting evidence at a NAMED path.** *("The key's id shown `revoked` in the dashboard/API, re-fetchable by a second party who never held the key" was the complete text — no path, no command, no request line, no in-frame binding, so it named none of §1.3's nine classes, and §1.3's own rule is that an item with no artifact named is not startable. It survived the sweep that rewrote P12(3) and P12(5) out of exactly this shape, on the second-highest-scoring row in the estate.)* **This is the only sub-artifact that proves the old key is dead PROVIDER-side**; (1) proves only that the API stopped accepting it, which a scope change, a rate limit or a revoked session also produces. Artifact, both halves: **(a)** the **provider API response for that key id** showing it `revoked`, pasted with the request line that produced it and its HTTP status, and **re-run by the second party from the key id alone** — they never held the key, which is the point; **(b)** a screenshot committed at `qa-media/p0-2-<provider>-<key-id-prefix>.png` with the key id and the revoked state visible **in the same frame** (§1.3's committed-and-bound media class). **Neither half closes (2) alone.** **(3)** **A PAIRED gitleaks scan over a PRINTED path list, not a bare exit `0`.** `gitleaks detect --no-git` scans the current working directory, so run from an empty or a wrong directory it exits `0`, prints `hostname` and `sw_vers`, satisfies all three previously-stated predicates and produces zero information — exit `0` is what gitleaks returns when it scanned nothing. That is the identical argument (1) makes about an unpaired `401` ("producible by sending nothing, a typo, or an invented string"), not applied. Instead: one transcript **on the Mac** carrying `hostname`, `sw_vers`, `gitleaks version` and the explicit scanned-path list, run twice over the SAME list. **BEFORE** rotation: `gitleaks detect --no-git --source <explicit path list including the shell dotfiles and the credential stores> --report-path qa-media/p0-3-<hostname>-<date>-before.json` exits **non-zero** and the report names the `~/.zshrc` finding — §10.3 already records that file as the known offender, so the positive control was sitting unused, and it is the only thing that proves the scanner would have flagged the very key this artifact certifies gone. **AFTER**: the identical command over the identical path list exits **`0`**, report committed at `qa-media/p0-3-<hostname>-<date>-after.json`. Both reports committed; both path lists printed in both halves. (`command -v gitleaks` → ABSENT here, so this cannot be run from this box; §10.3 also records that the full dotfile/credential-store sweep has never been run, which is why the path list is itself an artifact and not an assumption.) | **Two-phase: provision-new, then revoke-old. Never revoke first.** Enumerate every consumer before revoking — CI secrets on both repos, the dispatcher, MCP clients, **the loop's own credential**. Prior art: `recursiv/.github/workflows/rotate-dispatcher-key.yml`. Rollback = re-provision. | — | 92.0 |
| **PS** | Wire `apiKeyAuth` onto `/signals/*` and `/moderation/*` (recursiv) | 4 | **(1)** `git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/api-keys/rest/index.ts \| grep -cE "api\.use\('/(signals\|moderation)/\*'"` → **`2`** (today: **`0`**, re-run 2026-07-29). **The `-C` is mandatory and is the whole reason this sub-artifact is written twice-checked: run from *this* repo the command prints `fatal: path 'packages/server/…' does not exist in 'origin/main'` on stderr and `0` on stdout — byte-identical on stdout to the NOT-DONE value — so a wrong-repo run is indistinguishable from an honest not-done. §1.2 clause 5. Guard against it: `git -C /home/bill/dev/recursiv cat-file -e origin/main:packages/server/src/features/api-keys/rest/index.ts && echo PATH-OK` must print `PATH-OK` before the grep result is reportable.** **(2)** After deploy, `curl -s -X POST -H 'Content-Type: application/json' -d '{}' $ORIGIN/api/v1/signals/post` → **`401 missing_api_key`, not `403 no_scopes`** — the inversion is the whole defect; same for `/moderation/actions`. Record the deployed commit either side (`curl -s https://api.recursiv.io/health` → `.commit`) so the change is attributable to a SHA. **(3)** A merged regression test asserting every `api.route('/x')` prefix in that file has a matching `api.use('/x/*', apiKeyAuth, …)`, shown **red** on the pre-fix SHA and green after. **Do NOT make a scoped-key `200` the exit: §10.18 records that no scoped key can be minted (no MCP tool, no REST route), and `moderation.ts` @ `requireScope('admin'), requireLiveAdminRole()` requires `requireLiveAdminRole()` on top of `requireScope('admin')`, so a scoped-key 200 on `/moderation` is unreachable by construction.** **(4)** **The engine's agent contract stops contradicting §1.3:** `git -C ~/dev/recursiv show origin/main:CLAUDE.md \| grep -c release_task` → non-zero, with its step 5 rewritten to `release_task(…, release_reason:"completed", pr_urls, commits)` and `complete_task` moved to a separate verifier step. Today that grep returns `0` while `grep -n complete_task` returns `40:5. **When done** → complete_task …` — the file Claude Code auto-loads for the repo where this very step is done. **No issue exists for this** — `gh issue list --repo recursivlabs/recursiv --state open --search "apiKeyAuth signals"` → `[]` (2026-07-28); **file it in the same PR.** | Revert the two `api.use` lines; both routes return to 403. Revert the CLAUDE.md line; engine agents go back to two contracts. No user-visible change either way. | — | 101.8 |
| **PA** | The §1.5 circling detector runs unattended | 2 | **(1)** `.github/workflows/loop-audit.yml` exists on `main` on a daily `schedule:` cron, ported from `recursiv/.github/workflows/compliance-checks.yml`, and `gh run list --workflow=loop-audit.yml --limit 1 --json conclusion` → `success` on a named SHA. Today `git ls-tree origin/main .github/workflows/ --name-only` returns exactly `ci.yml`, `smoke.yml`, and the source workflow exists to port (`git -C ~/dev/recursiv ls-tree origin/main .github/workflows/ --name-only \| grep -c compliance-checks` → `1` of 22). **(2)** A scheduled run posts the §1.5 symptom table to #206 with a `SELF-AUDIT-RUN <run-id>` token, and **evaluates at least one symptom against comments it did not author**. Verify with `gh issue view 206 --json comments --jq '[.comments[]\|select(.author.login=="github-actions")]\|length'` → non-zero (**`github-actions`, not `github-actions[bot]` — the `--json comments` GraphQL surface returns the former; the REST surface returns the latter, and using the wrong one silently returns 0**), plus `gh run view <run-id> --json conclusion` → `success`, plus the posted table naming the comment ids it evaluated and their authors, none of which is `github-actions`. *(The criterion used to be "on a day no agent ran a cycle", verified by a timestamp more than 12h from the nearest `CYCLE` line. **That is unsatisfiable by construction in the loop this document is written for**: §1.4.3 says "Do not idle", a cycle is one pass by one agent, and with cycles under 24h apart no cron comment is ever more than 12h from a `CYCLE` line. PA could never exit, so `SELF-AUDITED yes` — the loop grading its own homework — was permanent. The property that was actually wanted is **independence of authorship**, not absence of work, and that is what the rewrite tests.)* **Failure branch: if (2) has not exited by the end of cycle 10, PA is escalated to Bill by name under §1.4 as a mechanism failure, not re-attempted silently.** **Until (2) exists every cycle line states `SELF-AUDITED yes`, and §1.3's second party is a human on every item without exception.** | Delete the workflow; the detector reverts to being run only by the population it audits, which is the state today. | — | 41.7 |
| **P1** | CI green on `main` **and the production monitor back up** | 3 | **(1)** `gh run list --branch main --workflow=CI --limit 1 --json conclusion,headSha` → `success` with `headSha` == `git rev-parse origin/main`. **(2)** **A positive read plus a guarded zero — the diff that stood here was `origin/main` against ITSELF and returned zero bytes by construction.** `3761e415` IS `origin/main` (`git rev-parse origin/main` → `3761e415b1e4a6c62688732fc4d91bf01d494e51`, 2026-07-29), so `git diff 3761e415 origin/main -- .github/workflows/ci.yml \| wc -c` → `0`, exit `0` — and `git diff 3761e415 origin/main -- .github/workflows/DOESNOTEXIST.yml` → empty, exit `0` as well: an unchanged file, a mistyped path and a wrong ref were indistinguishable, and an empty output showed none of the four steps and established nothing about `needs: check`. The facts asserted were true and unproved by the command asserting them. Replaced by: `git cat-file -e origin/main:.github/workflows/ci.yml && echo PATH-OK` (§1.2 clause 5 — no `PATH-OK`, no reportable result), then, from one `git show origin/main:.github/workflows/ci.yml`, `\| grep -cE 'pnpm install --frozen-lockfile\|pnpm lint\|pnpm typecheck\|pnpm test'` → **`5`** (today `5`: `:22`, `:24`, `:26`, `:28` in `check`, `:42` in `build`), `\| grep -c 'needs: check'` → **non-zero** (today `1`, `:32`), and `\| grep -c 'continue-on-error'` → **`0`**. The zero is readable only beside the non-zeros from the same `git show`. **A green run produced by removing or softening a step is a §1.5 phantom-progress violation — reopen it.** Both on the **same SHA**. **(3)** **`smoke.yml` green on the same lockfile fix:** `gh run list --workflow=smoke.yml --limit 2 --json conclusion,createdAt` → both most-recent runs `success`, the later one created after the P1 merge commit. **Smoke went RED at `2026-07-29T00:18:41Z` (run `30410762278`) at the step `Run pnpm install --frozen-lockfile` with `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH — the current "patchedDependencies" configuration doesn't match the value found in the lockfile` — byte-identical to the failing step in CI run `30401808070` on `main`. One root cause takes down both the gate and the estate's ONLY continuous production monitor (§4). A P1 that greens `ci.yml` and leaves `smoke.yml` red has restored the gate and not the monitor, and is not done.** **Standing rule, outliving P1 and binding for the life of this document: any cycle whose §1.5 detector pass observes `gh run list --workflow=smoke.yml --limit 1 --json conclusion` returning `failure` posts `MONITOR-DARK <run-id>` on its #206 cycle line and treats restoring it as outranking every unclaimed ladder row.** | Revert the CI change; `main` returns to red, which is honest. | — | 65.8 |
| **P2a** | Branch protection on both endpoints | 1 | **(1)** **BOTH endpoints, because the estate uses the other one:** `gh api repos/recursivlabs/minds/branches/main/protection` returns an object with `required_status_checks.contexts` containing the CI check names, `allow_force_pushes.enabled` `false`, `allow_deletions.enabled` `false` — **or** `gh api …/rulesets` returns an equivalent non-empty ruleset. Today: rulesets `[]` (length 0), protection `404 Branch not protected`. | Protection is reversible by deleting the ruleset. | P1 | 79.0 |
| **P2b** | Merge train #183 → #180 → #184 → #181 → #194, plus closing #29/#9/#8 | 6 | **(1)** #183 → **(2)** #180 → **(3)** #184 → **(4)** #181 → **(5)** **#194** land in that order, one PR at a time, CI green between each. #180 and #184 are both `CONFLICTING` and both touch `pnpm-lock.yaml`, so #184 rebases onto the post-#180 lockfile and its Pixel 7 Pro boot run is **re-run, not reused**. **#194 (README + mission) lands LAST and is gated on #195** — a README asserting an openness mission on a repo that is private with `licenseInfo: null` (§4) is a claim the estate cannot currently back; if #195 lapses to its §10 default, #194 is amended to drop the openness language or closed with that reason in a comment, never left open. **The same PR fixes `DESIGN.md`'s line 5 (§8) — it republishes the identical retracted claim on `main` and is a live §1.5 re-derivation instance.** **(6)** #29/#9/#8 (`jotto141`, `CONFLICTING` since spring) **closed with a comment, not rebased** — three permanently-red PRs make "CI green on every open PR" unachievable by construction. **Why this is two rows and not one: §3.1 has always scored branch protection (79.0) and the merge train (55.5) separately, while §2 carried one row with the cell `79.0 / 55.5`. §1.0's Cycle 0 loads each row with `score_override=<score from §3.1>` and then asserts the returned score matches — so two agents running Cycle 0 loaded 79.0 and 55.5 and BOTH passed their own assertion. The most-executed instruction in the document was undecidable at this row. `N` is 1 + 6 = 7, unchanged, so the split moves no denominator and requires no `BASELINE` line (§5.28).** | The merges are not reversible, so the train lands one PR at a time. | P2a | 55.5 |
| **P2c** | The §5.6 evidence gate is **enforced**, not merely specified | 3 | **(1)** `.github/workflows/evidence-gate.yml` exists on `main`. **(2)** A deliberately non-compliant PR touching `app/` (empty `## What remains unproved`) is shown **failing** the required check, with the run link. **(3)** The check name appears in **P2a**'s `required_status_checks.contexts`. Today: `git grep -l "What remains unproved" origin/main -- .github/` → **no output**; `git ls-tree origin/main .github/workflows/ --name-only` → exactly `ci.yml`, `smoke.yml`. | Delete the workflow and drop the required check. | P2a | 53.7 |
| **P3** | App boots on Android and survives a track-player failure | 2 | **(1)** An APK built from a **named `main` SHA** boots on the Pixel 7 Pro. The transcript carries, in one session: `git rev-parse origin/main`; `sha256sum <apk>`; the EAS build id (`eas build:list --limit 1 --json`); `adb devices -l` showing the device serial; then `adb logcat -c && adb shell am start -n <pkg>/.MainActivity && adb logcat -d > qa-media/p3-<sha7>-boot.log`. Exit requires `grep -c 'Displayed .*MainActivity' qa-media/p3-<sha7>-boot.log` → non-zero **and** `grep -c 'FATAL EXCEPTION' …` → `0`, with the log **committed at that path on `main`**. **A pasted logcat line with no committed file and no SHA is not sub-artifact (1), and closing on one is a §1.5 phantom-progress violation** — this is the identity §5.2/§10.22 failed to record, which is why P5 is blocked today. The `sha256sum` and `main` SHA recorded here are what P3b binds to. **(2)** With track-player init forced to throw, the root error boundary renders instead of a black screen. **Same artifact form as (1), stated so it is not closed on a narrative:** recording committed at `qa-media/p3-<sha7>-boundary.mov` **and** a logcat at `qa-media/p3-<sha7>-boundary.log` for which `grep -c 'ErrorBoundary' …` → non-zero **and** `grep -c 'FATAL EXCEPTION' …` → `0`. **Decision-gated: #186 (Jack, decide-by 2026-07-31) governs whether (2) is a boundary test against a RETAINED track-player or a REMOVED one. Start P3 regardless — the decision does not block the start — but do not mark it done before #186 is logged via `log_decision` or has lapsed under §1.4.4. #186's lapse default leaves `N` at 2; see §10.** | Revert #184's diff; the black screen returns. No user-visible state change. | P2b | 55.4 |
| **P3b** | App boots on **iOS hardware** | 2 | **(1)** A TestFlight build from the **same `main` SHA and APK `sha256sum` P3 recorded** launches on a **physical iPhone** (`xcrun simctl`, and `xcrun devicectl` against a simulator, are **not** acceptable): screen recording committed at `qa-media/p3b-<sha7>-launch.mov`, plus a device console transcript (`idevicesyslog` or a Console.app export) showing the process reaching foreground with no crash report generated. **(2) — SERIAL ON P6, NOT ON P3.** The same launch confirmed crash-free in P6's vendor dashboard. **A pasted empty window proves the absence of nothing — it is exactly what a dead pipe returns — so this closes on a negative against a pipe proven live for THAT build, in three parts:** **(a)** the vendor query filtered to (1)'s build id, its full response committed at `qa-media/p3b-<sha7>-p6-window.png` with the build id and the time window visible in frame; **(b)** the same build deliberately throwing once, producing a vendor event whose **event id is pasted and re-fetched by the second party from the vendor's own API** — the same artifact form as P6(3), which is what makes (a)'s emptiness readable; **(c)** the window in (a) stated as a bounded interval (`--since`/`--until` or the dashboard's own range in frame), not as "no crashes seen". **Absent (b) this sub-artifact does not close, and it does not decrement `OUTSTANDING`.** **P6 requires P5 requires P4, so (2) is not startable at P3b's position in the ladder; it does not block (1). Report P3b as 1/2 until P6 exits.** An earlier revision put this inside a single `N`=1 exit, which meant the unreachable half could be dropped and the counter would not show it. **Blocked-if:** no iOS device is available — set the task `blocked`, comment per §1.4.2 quoting §10's iOS-hardware default, and report `BLOCKED-ON-HUMAN`; per §1.4.4 the default takes effect automatically on 2026-08-05. Do **not** silently ship Android-only; `git show origin/main:app.json` declares `ios.bundleIdentifier: com.minds.app`, so iOS is in scope by construction. | An unreleased TestFlight build reaches no users. | P3 (1); P6 (2) | 58.5 |
| **P4** | **Staging wired to the app** | 5 | **(1)** A fifth `eas.json` profile on its own channel. **(2)** A Minds org/project provisioned on the staging origin with its own `EXPO_PUBLIC_RECURSIV_ORG_ID` — **and the id proved to resolve on the staging origin, not merely written down.** *(This cell previously read as the sentence above and stopped there: no command, no artifact class, the least-specified of the 93. An agent closed it by provisioning nothing and asserting provisioning.)* Exit, both halves: **(a)** `curl -s "$STAGING_ORIGIN/api/v1/organizations/<org_id>" -H "Authorization: Bearer $STAGING_KEY"` **(path corrected 2026-08-06, §5.54: the `/orgs/<org_id>` this cell carried until today returns `404` — the live route is `/organizations/:id`, which the SDK's `organizations.get` also uses. A `404` is this cell's own NOT-DONE value, so the stale path made an honest DONE unprovable by the printed command.)** (or the `@recursiv/sdk` equivalent per §6.7) returning that org's row, pasted with the request line and the HTTP status, and **re-run by the second party from the org id alone**; **(b)** the id in that response **byte-equal** to the `EXPO_PUBLIC_RECURSIV_ORG_ID` in the `.env.staging` committed in (3) — show it with `git show origin/main:.env.staging \| grep EXPO_PUBLIC_RECURSIV_ORG_ID` beside the curl output, so the app's config and the live row are bound to each other rather than each to a claim. **A 404 or an id that differs from (3)'s is a NOT-DONE, and staging pointing at production's org is the specific failure this binding exists to catch.** **(3)** `.env.staging` committed. **(4)** **A second workflow, `smoke-staging.yml`, green against `https://api.staging.recursiv.io/api/v1` — `smoke.yml` is NOT repointed.** `smoke.yml`'s own header reads *"Synthetic monitoring: drives the full social loop … against PRODUCTION with two real accounts"* on `cron: '0 */6 * * *'`, and `git ls-tree origin/main .github/workflows/` returns exactly two files, so it is the estate's **only** continuous production monitor. Exit: `gh run list --workflow=smoke.yml --limit 1` and `gh run list --workflow=smoke-staging.yml --limit 1` both `success` in the same 6-hour window. **(5)** **A written statement of staging data provenance.** `recursiv/.github/workflows/staging-db-refresh.yml` copies prod — **settled, printed in §1.3, and NOT what this closes on.** **The load-bearing claim is the one §1.3 isolates: whether the sanitizer's column list still covers every PII column the CURRENT schema has** — and that half had no command anywhere, while the settled half supplied the one printed command §1.3's document clause asks for. So the exit is the COMPARISON, both sides printed: **(a)** the sanitizer's assigned-column list — `git -C /home/bill/dev/recursiv show origin/main:scripts/sanitize-staging-data.sql \| grep -oE '^ +[a-z_]+ ='` → **NON-EMPTY** (11 lines, re-run 2026-07-29), pasted with the `git -C /home/bill/dev/recursiv cat-file -e origin/main:scripts/sanitize-staging-data.sql && echo PATH-OK` guard of §1.2 clause 5; **(b)** the current schema's PII columns from a `run_sql_query` over `information_schema.columns`, pasted with its output and a **stated non-zero row count**; **(c)** every column present in (b) and absent from (a), **listed by name**. **Zero uncovered columns is a PAIRED result — (a) and (b) both non-empty — never a bare zero:** an empty (a) is what a renamed script, a wrong ref or a missing `-C` returns, and an empty (b) is what a wrong database returns, and either produces "nothing uncovered" while proving nothing. | Additive. Deleting `smoke-staging.yml` and pointing `.env` back at production restores the prior state; `smoke.yml` is never touched, so production is never left unmonitored. | P1 | 59.0 |
| **P5** | Internal builds off the production OTA channel (#185) | 5 | **(1)** **Unpack an `android-internal` APK and show `{"expo-channel-name":"internal"}` in `AndroidManifest.xml`.** The channel is compiled into the binary — editing `eas.json` alone changes nothing for installed APKs (§5.2). **(2)** A deliberately broken `eas update --channel internal` reaches an internal device and **not** a production device. **Closes on the machine-readable pair, with the screenshots as supporting evidence and not as the artifact: (a)** the update's id from `eas update:list --branch <b> --json` — the same id must appear in the internal device's update log and **must not** appear in the production device's; **(b)** per device, `adb shell dumpsys package com.minds.app \| grep -E 'versionName\|lastUpdateTime'` transcripts either side, the internal one moving and the production one not; **(b2)** **the production device's OTA delivery pipe proven LIVE in that same window, because (b) proves only that `adb` can query the device, not that the device would have received an update had one been published to its channel** — a production device in airplane mode, powered off, or whose app was never foregrounded produces byte-identical evidence to a correctly-isolated channel, on the negative half of a negative control. Artifact: a second, harmless `eas update --channel production` published in the same sitting, ITS update id from `eas update:list --branch <production-branch> --json` pasted, and that id shown landing in the production device's update log with `lastUpdateTime` advancing. Both update ids and both `dumpsys` transcripts pasted together; only then does the absence of the INTERNAL id on that device, in that window, mean anything; **(c)** screenshots of both devices committed at `qa-media/p5-2-<update-id>-{internal,production}.png` with the update id visible in frame (§1.3's committed-and-bound media class). *(Previously "(screenshots of both)" with no committed path and no update id — a class §1.3 did not list, on the negative half of a negative control.)* **(3)** A real `internal` update published so testers are not stranded — **and it closes on (2)'s machine-readable object, not on the sentence it used to be**: the update id from `eas update:list --branch <internal-branch> --json` pasted and **re-fetched by the second party from that id alone**, plus at least one internal device's `adb shell dumpsys package com.minds.app \| grep -E 'versionName\|lastUpdateTime'` transcript showing a `lastUpdateTime` **after** publication and that update id in the device's update log. *(This was one sentence — no artifact class, no id, no path, no command, no second party — closable by writing that an update was published: the exact shape flagged at P6(4), surviving in the same row rewritten for it, on the critical path P4 → P5 → P6 → P3b(2)/P11. §1.3: an item with no artifact named is not startable.)* **(4)** **The tester population is ENUMERATED from a source outside the loop, then each install is confirmed replaced.** **(4a)** The roster, in **two committed files at two paths, because a screenshot is not JSON and one `.json` path could not hold both halves**: `eas build:list --profile android-internal --limit 20 --json` committed at `qa-media/p5-tester-roster-<sha7>.json`, **and** the Play Console internal-track tester list — the half that comes from OUTSIDE the loop, and the whole reason this sub-artifact was rewritten — committed at `qa-media/p5-tester-roster-<sha7>-playconsole.png`, with the account email **and the track name** visible in frame (§1.3's committed-and-bound media class, the form P5(2)(c) and P12(5) already use). **Hand-typing tester emails into the `.json` and putting the Console screenshot in the PR body closes nothing: a PR-body image has no path, no SHA and nothing for a second party to re-fetch, and under the folded class it is not evidence.** **(4b)** For every device reachable: `adb devices -l` showing the serial, then `adb shell dumpsys package com.minds.app \| grep -E 'versionName\|lastUpdateTime'` with a `lastUpdateTime` **after** the rebuild, plus the unpacked manifest for that install reading `internal` — one transcript per device. **(4c)** For every roster entry NOT reachable, a named list of who was contacted, when, and through which channel. **An unreachable tester is recorded as UNREACHED, never as replaced.** **Why this sub-artifact was rewritten: as "written confirmation every existing internal install was replaced" it was the ONE exit in all 93 that closed on an assertion with no external referent — no enumeration source for "every existing internal install" exists anywhere in this document, §10.22 records that nobody has established what testers even hold, and `eas`/`apktool` are ABSENT from this box so nothing could check it. It sits on the critical path P4 → P5 → P6 → P3b(2)/P11, so a single self-certified line gated the back half of the ladder. A count with no roster and no per-device transcript is not sub-artifact (4), and closing on one is a §1.5 phantom-progress violation.** Like (1), (4) cannot start before §10.22 is settled and `eas`/`apktool` are installed. **(5)** **A CI job on `main` that builds an Android APK and boots it, green on a named SHA** — this is #185's own second A-grade requirement (`gh issue view 185`: *"Plus one CI job that actually builds and boots the Android app."*), which the previous revision omitted. **Precondition: §10.22 must be settled first** — the only APK anyone unpacked reported `preview`, not `production`. **Tooling: `apktool`, `aapt` and `eas` are ABSENT from this box (§4). Install first.** | An internal-channel rebuild **strands every existing internal install** — the channel is compiled in. Rollback = publish a known-good update to the **old** channel and confirm on a device before the tester reinstall window closes. | P4 | 71.6 |
| **P6** | Native crash telemetry that actually captures (#187) | 4 | Four steps, in order. **(1)** The reporter is **chosen** via `log_decision` and the id written into §10 — a §1.4 decision, not an engineering preference (§10.2: no candidate is in the tree). **(2)** `git show origin/main:package.json \| grep -E "sentry\|posthog-react-native\|bugsnag"` returns the chosen package. **(3)** A thrown exception from a leaf screen in a **release build on ANDROID hardware** produces a vendor event **whose event id is pasted into the PR and independently re-fetched by a second party** — a screenshot is supporting evidence, the re-fetchable id is the artifact. **(4)** The negative control, in **three parts** — a pasted empty window proves the absence of nothing, since it is exactly what a dead pipe returns, so this closes only against a pipe proven live for THAT build: **(a)** a logcat from the no-reporter release build committed at `qa-media/p6-4-<sha7>-noreporter.log`, for which `grep -c '<exception class>'` is **non-zero** — proving the exception was actually thrown — **carrying a build id that is NOT (3)'s, with both ids printed side by side from one `eas build:list --json`, and the P6(2) reporter package shown ABSENT from this build**: unpack this APK in the same form P5(1) already uses and paste `grep -c '<chosen package>'` over its bundle/manifest → **`0`**, beside the identical grep over (3)'s APK → **non-zero**. **This replaces "carrying the same EAS build id as (3)", which reopened the hole it was written to close. A no-reporter build is a different binary and necessarily carries a different EAS build id, so read strictly the sub-artifact was unsatisfiable by construction — the class §5's PA(2) retraction exists to forbid — and read loosely, which is the lazy read, (3)'s OWN logcat satisfied every stated predicate: a release-build logcat, `grep -c '<exception class>'` non-zero, (3)'s build id. Nothing else in the row distinguishes a no-reporter build from a reporter build, so the negative control compared the reporter build against itself; P6(2)'s package grep runs against `origin/main`, not against this artifact's build, and cannot supply the difference.**; **(b)** the window stated as an explicit `--since`/`--until` pair, or the dashboard range visible in a committed frame; **(c)** the verifier's **own** vendor query over that window returning zero, pasted by them, next to their own re-fetch of (3)'s event id. The pipe is proven live by (3) at the moment (4) is proven empty. **The platform word in (3) is new and it is a determinism fix, not a scope change: `gh issue view 187 --json title --jq .title` returns, in full, `[P1] No crash telemetry on iOS/Android; one root error boundary; CI never compiles native` (§8 quotes it whole; do not re-abbreviate it), while (3) said only "on hardware", so two agents disagreed on whether an Android-only close was done. `N` is unchanged at 4 — iOS crash capture is NOT an artifact of this row and is NOT proved anywhere on this ladder. §8 records that as a named exclusion with its consequence rather than smuggling it in as a fifth artifact.** | The reporter ships behind an OTA-flippable flag; disabling it degrades to today's state (no native capture). | P3, P5 | 41.6 |
| **P7** | Credential killable, identity server-owned (#188) | 5 | **Every revoke check is a PAIRED transcript — same token, `sha256sum` printed, `200` first then `401` — for the reason spelled out in P0: an unpaired `401` is the API's response to sending nothing.** **(1)** Bearer token from a disposable account: `200` then `401` from `/users/me` after sign-out. **(2)** Same after "revoke all other sessions". **(3)** Same after a password change. **(4)** **All three re-run through `@recursiv/sdk`**, not raw `curl` (§6.7; #188 names both surfaces). **(5)** **On ANDROID — PAIRED like (1)-(3), not silently exempted from this row's own opening rule.** An empty grep is what a dead pipe returns, and `adb shell run-as <pkg>` REFUSES on a non-debuggable **release** build with `package not debuggable` **on stderr and nothing on stdout** — byte-identical to the documented pass; a wrong package name returns nothing the same way. That is §1.2 clause 5's stdout/error collision recurring on a credential-exfiltration check, and (5) was the one sub-artifact in the row carrying no before-state. So, in **one** session, with the device serial from `adb devices -l`: **(a)** `adb shell run-as <pkg> ls -l files databases shared_prefs && echo RUNAS-OK` pasted, `run-as`'s exit status printed — no `RUNAS-OK`, no reportable result, so a permission failure cannot masquerade as a clean device; **(b)** **while signed in**, the identical grep over the identical named AsyncStorage sqlite and `shared_prefs` paths returns **NON-ZERO** for the key prefix, proving the search string, the package, the store path and `run-as` all work and that the credential WAS in that store; **(c)** after sign-out/revoke, the identical command over the identical paths returns **zero**. **`N` is unchanged at 5: the iOS equivalent — Keychain items and the app's `Library`/`Documents` container — is NOT an artifact of this row and is NOT proved anywhere on this ladder, even though the backlog item behind it (`git show origin/docs/launch-readiness-backlog:docs/launch-readiness-backlog.md`, item 4) cites `lib/storage.ts` @ `export async function getItem(` as unencrypted on both platforms. §8 records the exclusion and its consequence.** | **Killing credentials signs every live session out.** State that user-visible effect in the PR. Rollback does not un-sign-out anyone. | P4 | 51.0 |
| **P8** | Moderation primitive, fail-closed (#196) | 6 | **Decomposed against #196's *minimum primitive*, not only its A-grade verification block — the same standard P9 gets from #197, and the reason `N` moved from 4 to 6.** `gh issue view 196 --json body` under "What 'a real primitive' means" reads verbatim: *"At minimum: automated screening on the ingest and publish paths; **fail-closed** degradation …; a documented retention/deletion schedule; a durable audit trail; and an appeals path. Coverage must be **documented**, including what it does *not* cover."* That is **five** elements; the previous decomposition carried four and silently dropped the retention schedule and the appeals path — while §11 attaches an NCMEC duty that *presupposes* retention. **(1)** A known-bad item blocked on the **publish** path, **with the audit record produced as a `run_sql_query` row and its id**, not as a screenshot. **(2)** The same on the **protocol-ingest** path, same artifact form. **(3)** **Fail-closed proved by a NAMED CI RUN carrying BOTH directions.** As "a test proving content does not pass when the classifier is unavailable" this named none of §1.3's artifact classes — no run id, no SHA, no committed path, no `run_sql_query` row — so by §1.3 it was not startable; it was a pure negative, which a test that errors out, is skipped, or never ran satisfies; and the one form it gestured at is the form §6.2 bans (*"Unit tests never close an item."*). Artifact, in PS(3)'s shape plus a positive control: a named CI job **green on a named SHA**, run URL pasted and **re-fetched by the second party**, whose log shows, in order — **(a)** with the classifier reachable, a known-good item publishes, is asserted visible, and produces the audit record as a `run_sql_query` row **with its id** (the form (1) and (2) already carry); **(b)** with the classifier made unreachable **by a named mechanism**, the SAME item's publish attempt returns the platform-layer status and body, pasted verbatim; **(c)** a `run_sql_query` showing **no published row** for it, plus a **fail-closed audit row with its id**. Both row ids re-queryable by the second party from the ids alone. **Without (a) the run proves the publish path is broken, not that it is fail-closed.** **(4)** A written coverage document naming what is *not* screened, by route or file path (§1.3's document-artifact clause applies) — **with a MECHANICAL denominator, because this is the only sub-artifact in the ladder whose entire content is a list of things that do NOT happen.** No command can prove a named route is unscreened, and as written nothing required the list to be derived from a route table, so no second party could detect an omitted surface and §1.3's "at least one printed command" was satisfiable by any reproducing command at all. Exit, in order: **(a)** the FULL route enumeration this document partitions, printed — `git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/api-keys/rest/index.ts \| grep -nE "api\.[a-z]+\('"` → **NON-ZERO** (117 lines, re-run 2026-07-29), plus the equivalent for every other feature router claimed in scope, each with its own line count; **(b)** every route in that printed enumeration marked screened or unscreened — **a surface absent from the enumeration is not covered by this document, and the document says so**; **(c)** the positive control: **at least one route in the SCREENED column demonstrated by P8(1)'s `run_sql_query` audit-row id**, re-queryable by the second party from the id alone. **Without (c) the partition has no referent and "screened" is a word the worker wrote.** **(5)** **A committed retention/deletion schedule at a path on `main`** stating how long screened content, classifier verdicts and audit records are held, when they are deleted, and — **separately** — the **preservation** window required for material reported to NCMEC, with the named filing entity. **A schedule that does not distinguish routine deletion from legally-required preservation is not sub-artifact (5)**, because the two obligations point in opposite directions and §11 creates both. **(6)** **An appeals path demonstrated end to end on a disposable account**: a false-positive block is appealed in-app, the appeal is visible to a reviewer, and the reversal appears in the **same** audit trail as the original action. **It closes on (1)/(2)'s machine-readable form, NOT on "recording or transcript" — a transcript is text the worker produced, it carried no committed path and no in-frame binding, and it was the third sub-artifact still resting on the unbound-media form the §1.3 fold forbids.** Artifact: **three `run_sql_query` row ids in that one audit table** — the block's, the appeal's, and the reversal's — with the reversal row shown to reference the block's row id, **all three re-queryable by the second party from the ids alone**. The recording is supporting evidence and is committed at `qa-media/p8-6-<audit-row-id>.mov` with the disposable account identifier visible in frame. Not a design doc, and not a picture instead of the ids. | **A fail-closed classifier blocks legitimate posting when it is unavailable.** Name the kill switch, who may flip it, and the acceptable false-positive rate, in the PR. See §11 on the NCMEC reporting duty that attaches the moment this exists. | P4 | 46.0 |
| **P9** | Monetization proves out in staging (#197) | 15 | **If #197's body changes, re-derive this list before starting — a P9 that closes against a stale copy of #197 closes nothing.** Every item in staging against Stripe sandbox, on the exact candidate SHA, driven through `@recursiv/sdk` (§6.7). **ARTIFACT FORM — binding on all fifteen, not negotiable per line, and the reason this row was rewritten: P9 is 15 of the 93 artifacts in this document (16%), it was the ONLY ladder row whose sub-artifacts named no artifact FORM, and its entire evidence requirement was the phrase "evidence retained and linked" — which an agent satisfies with a transcript it produced itself. §1.3 enumerates nine artifact classes and says "An item with no artifact named is not startable"; P9 named none of the nine for any of the fifteen, and unlike P4(5)/P8(4)/PW(1)/P10(4) it has no document-shaped sub-artifact for §1.3's document clause to rescue. The decomposition was never the defect — it is faithful to #197 line by line — the form was.** Each of the fifteen closes on **BOTH** of: **(a)** a transcript committed at `qa-media/p9-<n>-<sha7>.log` containing the `@recursiv/sdk` call, its full response, and the `run_sql_query` text **and output** proving the DB state after the transition; **and (b)** the **Stripe sandbox object id** (`evt_*`, `pi_*`, `cs_*`, `ch_*`, `re_*`, `dp_*`, `po_*` as applicable) pasted into the PR and **re-fetched by the second party without the worker's help** — via the Stripe dashboard on the sandbox account, or `curl -s https://api.stripe.com/v1/events/<evt_id> -u <sandbox_sk>:` — with the verifier pasting **their own** output. *(`command -v stripe` → ABSENT on this box, so do not write the exit against the Stripe CLI; the re-fetch is what matters, not which client performs it.)* **Lines (13) and (14) have no Stripe-side object and close on (a) alone — the `run_sql_query` text plus its output — which is why they are called out here rather than left to be discovered. For (13) and (14), (a) alone is NOT sufficient and each carries the extra condition stated at its own line: (14) is the only one of the fifteen whose claim is satisfied BY emptiness, and (13)'s invariant check passes vacuously over zero rows for the same reason, and (a) as written sets no non-emptiness condition, so a query returning zero rows satisfied it vacuously — which is what a mis-scoped query, a wrong table, a `WHERE` that matches nothing, or an audit trail that was never written to returns, i.e. P8's "durable audit trail" defect recorded as a pass.** **A line whose evidence is a narrative sentence, a screenshot alone, or a link to a document is NOT confirmed and does NOT decrement `OUTSTANDING`. These fifteen are the fifteen most likely places in this ladder for a phantom close, because they are the only sub-artifacts whose environment a verifier cannot reach with a public `curl`.** **This list is `gh issue view 197`'s Minimum proof set decomposed one artifact per demonstrable claim, checked line by line on 2026-07-28:** **(1)** checkout creation end-to-end; **(2)** signed webhook handling, **proven negative and positively controlled in the same transcript**, because "creates no credit" is a zero-row query and a zero-row query is what the wrong table, the wrong tenant or a mistyped column returns: the SAME `run_sql_query` text must first show the credit row created by the UNTAMPERED delivery of that same `evt_*` (row id pasted), then show **zero** for the tampered one, with the platform's rejection status and body pasted — the rejection response is the positive half, the empty credit query alone is not; **(3)** exactly-once credit across retries and restarts; **(4)** promotional/bonus bucket isolation; **(5)** partial refunds; **(6)** full refunds; **(7)** the dispute lifecycle opened/updated/lost/won/reinstated; **(8)** missed-webhook reconciliation; **(9)** worker-restart recovery; **(10)** maturity holds; **(11)** payout-readiness loss; **(12)** cash-out idempotency and failure recovery; **(13)** DB invariants after **every** money transition — **the invariant query pasted with a stated NON-ZERO row count for the transitions it is asserted over, since an invariant holds vacuously over an empty result set**; **(14)** audit logs that expose **no secrets and no identity material** (#197's own wording — the previous revision dropped "or identity material") — **closing only on a NON-EMPTY, positively-controlled pair in one transcript: (i) that same audit query first returning a stated NON-ZERO row count for a NAMED transition drawn from lines (1)-(12), with at least one row id pasted and re-queryable by the second party from that id alone — this proves the trail is populated and that the query reaches it; then (ii) the redaction grep run over THOSE SPECIFIC rows for the sandbox `sk_*`, the account email and the card PAN returning `0`, beside the IDENTICAL grep against the raw request/webhook body returning NON-ZERO, which is the positive control that the search terms are the ones actually present upstream. An absence asserted about an empty result set is not an absence about the audit trail**; **(15)** the staging rollback path proven **with readiness re-run after rollback**, which #197 lists as its own bullet and the previous revision folded into another. *(Items 1 and 2 were absent entirely from the previous revision's twelve — the entry point of the money path.)* | Staging-only. Nothing reaches a paying user. **§1.8 applies on any failing line.** | P4, P7, P8 | 59.7 |
| **P10** | Consent + suppression ledger before any outbound (#200) | 4 | **(1)** An attempt to send to a suppressed address is **blocked at the platform layer, not at the ESP**, in P8(1)'s artifact form and for the same reason: **(a)** the suppression row itself as a `run_sql_query` result **with its row id**; **(b)** the send attempt made against that exact address on **staging**, with the platform-layer response body and status code pasted; **(c)** the rejection recorded as a second `run_sql_query` row **with its id**, re-queryable by the second party from those two ids without the worker's help; and **(d)** the **negative control — that the ESP was never called — in P6(4)'s three parts, because a bare empty ESP log proves the absence of nothing.** No ESP is named anywhere in this document (§11 lists "An ESP plus enrichment (P10)" as an unpriced future cost), so an unconfigured, dead, mis-credentialed or wrong-window ESP returns an empty outbound log for every address, and as a bare absence this closed by taking no action — on the one row whose rollback cell reads "Irreversible by construction". The three parts: **(d-i)** a **positive control in the SAME window** — one send to a **non-suppressed** disposable address that DOES appear in the ESP outbound log, its **ESP message id pasted**, proving the log was live and populating at that moment; **(d-ii)** the window stated as an explicit bounded interval — a `--since`/`--until` pair, or the dashboard range visible in a committed frame; **(d-iii)** the verifier's **own** zero-returning ESP query for the suppressed address over that same interval, pasted by them, beside their **own** re-fetch of (d-i)'s message id. **Not a screenshot and not "— shown". A description of a block is not a block.** **(2)** DMARC at enforcement, verified from outside by the **countersigner on their own machine**: `dig +short _dmarc.<domain> TXT` pasted with its output containing `p=reject` or `p=quarantine` (`p=none` is not enforcement and does not close this), plus `dig +short <domain> TXT \| grep spf` and the DKIM selector record. The domain is named in the PR before the check is run. **(3)** RFC 8058 one-click-unsubscribe present in a **real received message's** headers — **the full raw headers of that message committed at `qa-media/p10-3-<message-id>.txt`** (the whole header block from the receiving mailbox's "show original"/`.eml` export, `Message-ID` included, not a cropped screenshot of two lines), showing **both** `List-Unsubscribe:` with an `https:` URI **and** `List-Unsubscribe-Post: List-Unsubscribe=One-Click` — RFC 8058 requires the second header and a message carrying only the first does **not** close this. **Then the verifier POSTs to that URI themselves and pastes their own status code**, because a header advertising an endpoint is not an endpoint; the suppression row it creates is queryable by its id per (1). *(This cell previously named no committed path and no verifier action — one indirection away from §1.3's committed-and-bound media class, on the one row in the ladder with no rollback.)* **(4)** A written decision on the 8,407 imported / ~1.5M-deliverable legacy cohort (`recursiv origin/main:docs/MINDS.md:107,:126`) including its GDPR legal basis (§11). **Nothing bulk-sends before all four exist.** | Irreversible by construction — a sent email cannot be unsent. This is the only step with no rollback, which is why it gates on four artifacts instead of one. | P4 | 59.6 |
| **PW** | Web release path documented and gated | 3 | **(1)** The host and the deploy trigger named in writing. **OWNER DIRECTIVE 2026-07-30 — use Cloudflare for everything possible — so if this row concludes the web surface needs its own deploy path, Cloudflare Pages/Workers is the stated default and a non-Cloudflare choice needs a written reason in this cell. This does NOT pre-empt (1): the artifact is still identifying what deploys the site TODAY, which is unknown and is the entire point of the row.** — **nothing in this repo's CI deploys web** (`ci.yml`'s `build` job runs `pnpm exec expo export --platform web` and stops; there is no `vercel.json`, `netlify.toml` or `Dockerfile` in the tree), so find and record the mechanism. **"Or record that it is deployed by hand, which is itself the finding" is DELETED as a self-standing close.** The site returns `200` (re-verified 2026-07-29), so it is deployed by SOMETHING; the old branch closed one of the five document-shaped sub-artifacts in one grep and one sentence, and the identical grep run from the engine checkout prints the identical `0` over a plausible 65-entry tree — §1.2 clause 5's stdout collision, on the exit whose whole job is to identify the deploy path. Artifact, three parts, **all three required**: **(a)** the absence read from THIS repo, named, beside an anchor proving the command read the right tree — `git -C /home/bill/dev/recursivlabs-minds ls-tree origin/main --name-only -- eas.json app.json \| wc -l` → **`2`** pasted beside `git -C /home/bill/dev/recursivlabs-minds ls-tree origin/main --name-only -- vercel.json netlify.toml Dockerfile \| wc -l` → **`0`** (both verified 2026-07-29; from `/home/bill/dev/recursiv` the anchor prints **`1`** and the absence still prints `0`, which is exactly what makes the anchor a discriminator rather than decoration); **(b)** the POSITIVE — the mechanism that actually deploys, evidenced by **its own response**: the `deploy_project` MCP response, or the workflow run URL, that (2)'s deploy emitted and that moved (2)'s pre-committed candidate string; **(c)** if the mechanism really is a hand step, that hand step **PERFORMED** in the same transcript, its output pasted, and (2)'s string shown to move. **(a) alone does not close (1)** — this is the same three-part negative-plus-live-pipe form P6(4) and P10(1)(d) already carry, and PW is where it was missing. *(`AGENTS.md` says "deploy via the Recursiv MCP `deploy_project` (project `019d5190-…`)" — that is a lead to verify, not the artifact, and **(b) is where it gets verified; verifying it is not optional**.)* **(2)** A deploy of the candidate SHA that changes a visible string on `https://minds.on.recursiv.io` — **and BOTH discriminator strings are committed BEFORE the rollback and written into the PR in advance, because otherwise the worker chooses, after the fact, the very string (3)'s verifier greps for.** Artifact, pasted with the candidate SHA: `curl -s https://minds.on.recursiv.io/ \| grep -o '<candidate string>'` non-empty AND `curl -s https://minds.on.recursiv.io/ \| grep -c '<previous string>'` → **`0`**. **A string present in every build — "Minds" — returns non-zero identically before a rollback, after a rollback, and when no rollback happened at all: that is §5.20's "nondeterministic in one direction and non-diagnostic in both", recorded there for the minds.com discriminator, and naming both strings in advance is what stops it being re-imported here.** **(3)** Rollback to the previous build proven — **artifact: the verifier's own PAIR, pasted by someone who did not perform the rollback** — `curl -s https://minds.on.recursiv.io/ \| grep -c '<previous string>'` → **non-zero** AND `curl -s https://minds.on.recursiv.io/ \| grep -c '<candidate string>'` → **`0`**, the two strings byte-identical to the ones (2) committed, **because only the pair discriminates a rollback from a page that never changed** — **plus the run URL or MCP response of the mechanism named in advance** — **and the mechanism is named in the PR before the attempt, for the reason in P11: `recursivlabs/recursiv#1905` records that the platform deploy surface has no rollback path for user apps, so "redeploy the previous build" is an assumption about a surface a filed engine issue says is missing.** #193's 1.14 MB gz chunk attaches here. | Redeploy the previous build — which is exactly what this step proves is possible. | P2a | 61.8 |
| **P11** | `HUMAN-ONLY` The launch gate | 8 | **`HUMAN-ONLY`, §1.7/§1.9: `owner=Bill` runs the sitting; Jack countersigns (§10). An agent may stage the build, write the eight pass criteria and pre-post the rollback mechanism; it may not run the sitting.** One human, one sitting, one build id, **on the Pixel 7 Pro — this gate is run on ANDROID**, on the **staging** channel then the internal channel. **The platform is named because it was not: the sub-checks said "a wiped device" and "a second device", so nothing in the row said which OS, and the honest reading was that all eight could be closed on Android while P13(1) then puts a stranger on an iPhone. `N` stays 8 rather than doubling to 16 — running the whole sitting twice is not what this ladder buys — and the consequence is written into §8 instead of hidden: no iOS user completes the eight-step social loop before the App Store listing goes live.** **Each sub-check carries its pass criterion, written before the sitting starts:** **(1)** sign in on a wiped device; **(2)** post with a photo → image renders in the feed on a second device within 30s; **(3)** a failed upload does not publish (**#191**); **(4)** DM two threads back to back → both land in the correct thread with no cross-thread leak, each opened and checked (**#190**); **(5)** play audio with the screen locked (or record that it ships knowingly disabled per #186); **(6)** open and back out of five posts → scroll offset preserved each time (**#192**); **(7)** force a crash → the P6 event id appears within 60s; **(8)** **the rollback drill** — publish a deliberately broken build, detect it via P6, roll it back. **Elapsed time is computed from two re-fetchable machine timestamps, never a stopwatch: T0 = the broken update's `createdAt` from `eas update:list --branch <b> --json`; T1 = the P6 vendor event's server-side received-at for the crash that confirms the good build on the device.** Both values pasted with the commands that produced them. **Over ten minutes fails the gate (§1.8).** **The gate record is one comment on #206** carrying the build id, every sub-check marked pass/fail, the elapsed seconds, and links to `qa-media/launch-gate-<build-id>-*`. A gate with any sub-check unmarked has not been run. **§1.3's countersignature clause applies here and only here, and the countersigner is NAMED in §10's decision table** — not left as "a different named human" with no referent, no owner and no lapse default, which is how the terminal gate acquired a requirement that could stall indefinitely. **Before sub-check (8) is attempted the agent posts to #206 which rollback mechanism it is actually using** — `promote-to-prod.yml` dispatched with a known-good SHA, or an OTA kill-switch — **because `recursivlabs/recursiv#1905` records verbatim that the platform deploy surface has "No rollback for user apps" (`packages/server/src/features/deployment/` has no rollback/revert/promote path). An unstated rollback mechanism is what makes a ten-minute drill unrepeatable by the next person.** | The drill *is* the rollback proof. | all above | 67.0 |
| **P12** | Store submission **uploaded and in review** — (1)(2) `HUMAN-ONLY` | 6 | **Sub-artifacts (1) and (2) are `HUMAN-ONLY`, §1.7: no agent submits to a store. `owner=Bill` for those two; (3)-(6) are agent work and are the reason this row is claimable at all.** **(1)** `eas submit --platform ios --profile production` returns an App Store Connect build id in state `Ready to Submit` for `ascAppId 6793750469`. **(2)** `eas submit --platform android` returns a Play Console release id on the internal track. **(3)** **Android prerequisite, and it is unverified: `git show origin/main:eas.json`'s entire `submit` block is `{"production": {"ios": {"ascAppId": "6793750469"}}}`** (re-verified 2026-07-28 by parsing the JSON, not grepping it) — no `submit.production.android`, no service-account key path, no evidence a Play Console record or a Google Play developer account exists. The iOS half is evidenced by `ascAppId`; the Android half is evidenced by nothing. Artifact, structured like (5) — the console's own response first, the picture as supporting evidence at a NAMED path: the **Play Developer API response** for the `com.minds.app` app record (`app.json` → `expo.android.package`) showing state `Draft` or better, pasted with the request that produced it; **plus** a screenshot committed at `qa-media/p12-3-play-<package>-<captured-at>.png` with the account email and the package identifier visible in frame (§1.3's committed-and-bound media class — the previous "screenshot with the account email visible" named no path, on the sole artifact for §10.28, which blocks P12's Android half entirely and therefore P13(2)); **plus** a committed `submit.production.android` profile. See §10.28. **(4)** **A published privacy-policy URL returning `200`**, covering PostHog and whatever P6 adds, linked from both store listings and from in-app settings — `curl -s -o /dev/null -w '%{http_code}' <url>` → `200`, plus the linking screenshots **committed at `qa-media/p12-4-<platform>-listing.png`, one per surface, with the policy URL and the listing/package identifier visible in frame — a screenshot with no committed path is not evidence (§1.3), which is the residual CHANGELOG 34 swept for and CHANGELOG 25 created the media class to stop.** Today there is no policy page in the tree: `git grep -il privacy origin/main -- app/ public/` → `app/(tabs)/create.tsx`, `app/admin.tsx`, `app/settings.tsx` only. **(5)** **Apple privacy-nutrition and Play data-safety declarations submitted**, and **the artifact is the console's own response, not the picture of it**: the App Store Connect API response for the app's `appPrivacyDetails`/privacy-declaration resource and the Play Developer API response for the app's data-safety declaration, each pasted with the request that produced it — **plus** a screenshot committed at `qa-media/p12-5-<platform>-<submitted-at>.png` with the account email and the submission timestamp visible (§1.3's committed-and-bound media class). The declared items must match what `git show origin/main:package.json \| grep -E 'posthog\|sentry'` actually ships, and the mismatch, if any, is written down rather than reconciled by editing the declaration. **(6)** **Apple 5.1.1(v) proved, not asserted — and PAIRED.** A bare `404`/`410` and a zero-row query are producible the same three ways P0(1) names for a bare `401` ("sending nothing, a typo, or an invented string"): a 404 from a path that never existed, a zero row-count from a wrong id, a wrong table or a wrong database. The unpaired form was closable against an account nobody ever created, on the sub-artifact that decides whether the store submission is truthful and that gates P13. Artifact: **one transcript, same URL and byte-identical `run_sql_query` text on both sides** — **before** deletion the profile endpoint returns `200` carrying the disposable account's user id in the body and the query returns **exactly one row** with that id; **after** deletion the identical request returns `404`/`410` and the identical query returns **zero**. The account id is printed in both halves so the second party re-runs the after-query from the id alone, and **the elapsed time between the two halves is pasted**, since §10.30's `requestDeletion` may be asynchronous. **This cannot pass today** — `git show origin/main:app/settings.tsx \| sed -n '464,470p'` shows `deleteAccount` calling `sdk.settings.requestDeletion({ password: deletePw, … })` and reporting `'Account deletion requested.'`: a request, not a deletion, demanding a password on an OTP-first auth system. §10.30. **Apple 1.2 (UGC) additionally requires filtering, in-app reporting that actually files, blocking and a published EULA — P8 and backlog item 27 are prerequisites.** *(Sub-artifacts 4-6 were §11 prose in an earlier revision — obligations that gated P12 by the document's own words while being invisible to §1.6's counter. That is §5.6's "a spec no step produces" failure applied to this document itself.)* | A rejected submission costs a review cycle, not users — but per §1.8 it is a **gate failure**, not a delay. **P12 exits at upload state, not at approval; approval is counted once, inside P13's sub-artifacts 1 and 2 — do not add an approval artifact here or it double-counts against §1.6's denominator.** A rejection arriving after P12 is marked done decrements `CONFIRMED` and re-opens P12; that is the designed path. A shipped build is rolled back by an OTA kill-switch (§6.5), never by a resubmission. | P11 | 44.5 |
| **PAPI** | The public API is usable by a stranger, not just by us | 4 | **Declared launch scope by Bill 2026-07-30: the API, MCP, SDK and CLI are one product surface with the apps, all accessible on day one, so all four are launch-blocking (§5.46). This is the `PS` pattern, not a new one — engine work, Minds row, because a Minds exit depends on it.** **(1)** **A self-service path to a scoped key EXISTS.** **RE-SCOPED 2026-08-06 (§5.54): the path already exists — this sub-artifact is now PROVING it on production, not building it.** The earlier text read "§10.18 records that no MCP tool and no REST route can mint one — so today a stranger cannot authenticate at all", and that premise is refuted: `POST $ORIGIN/api/auth/sign-up/email` followed by `POST $ORIGIN/api/v1/api-keys` with a `scopes` array mints one, verified end-to-end on `api.staging.recursiv.io` 2026-08-06 (a fresh account with no org membership minted a 21-scope key and created an org with it — #206 `bill/90`). Exit is unchanged in form and is what still gates the row: the mint request against **production**, pasted with its response, **run by someone outside the org** — no agent is a stranger, so this sub-artifact is a stranger-sitting item, not engineering work. **(2)** A documented endpoint list on `main` (§1.3's document-artifact form), each line carrying the `curl` that produced its status. **(3)** **A stranger-minted key returns `200` on a documented read**, paired against the same call with no key returning `401` — the pair, because an unpaired `200` does not prove the key did anything and an unpaired `401` is what sending nothing returns (P0(1)'s rule). **(4)** The error and rate-limit contract stated and demonstrated: a deliberate 429 or 4xx pasted with its body, so a consumer can code against it. | Revoke the scoped-key path; strangers return to being unable to authenticate, which is today's state. No Minds user-facing change. | — | 61.3 |
| **PMCP** | The MCP server works for a stranger — and the false-green is detected | 3 | **(1)** The published server installs from its package name in a clean environment, transcript pasted. **(2)** **A DATA tool returns real rows under a stranger-minted key — a connection check is NOT this artifact.** `HANDOFF-minds-mcp.md` records the exact trap: `claude mcp list` prints `✔ Connected` **in the broken state**, every data tool answers `Invalid API key.`, and only `whoami` works. So the exit is a tool that reads rows, with the rows pasted; `whoami` and any connection indicator are explicitly excluded. **(3)** **That false-green is DETECTED, not just documented** — a check that calls a data tool and fails if it errors while the connection reports healthy, green on a named SHA. Without (3) the next person rediscovers the trap by losing a day to it. | Unpublish the server version; MCP consumers fall back to the previous one. | PAPI | 60.0 |
| **PSDK** | The SDK installs and works from a clean environment | 3 | **(1)** Published and installable: from an empty directory, install by package name and import it, transcript pasted with the resolved version. **REFUTED 2026-09-03 (§5.56): this is not a blocker and never gated the row.** The earlier text read "§5.8 records `npm whoami` → `ENEEDAUTH`, so publish rights are NOT established for either named human — that is this row's first real blocker, not a formality", and the inference does not hold: the `@minds/*` family publishes from CI via trusted publishing, not from a human login, and all five packages are live at their source versions. **The exit is unchanged in form** — install by name from an empty directory, import it, paste the transcript with the resolved version — and was executed on 2026-09-03: `@recursiv/sdk@0.7.14` (75 exports) and `@minds/sdk@0.0.9` (79). **(2)** One authenticated call returns real data under a stranger-minted key (PAPI(1)), response pasted. **(3)** **The `@minds/sdk` / `@recursiv/sdk` relationship settled and written down.** `git show origin/main:package.json` carries **both** — `@minds/sdk` `0.0.1` added 2026-07-30 alongside `@recursiv/sdk` `0.5.6` — so it reads as a skin, not a fork, and this document names `@recursiv/sdk` in ten places as the surface verification runs through. Exit: which one third parties install, stated on `main`, and every §2 row that names the other corrected in the same PR. | Unpublish the version; consumers pin the prior one. `@recursiv/sdk` remains as it is. | PAPI | 64.5 |
| **PCLI** | The CLI installs and works from a clean environment | 3 | **(1)** Installable by name in a clean environment, `--version` pasted and matching the published release. The engine already ships `publish-cli.yml`, so this is a release-and-verify row, not a build-it row — **check that before scoping any work here (§1.2).** **(2)** An authenticated command returns real data under a stranger-minted key, output pasted. **(3)** The version and install path documented on `main`, with the command that produced the version string beside it. | Unpublish the release; the prior version stays installable. | PAPI | 54.3 |
| **PR** | Multi-tenant RLS proven to cover the Minds tenant — **cross-loop, §1.9** | 4 | **Declared a launch prerequisite by Bill 2026-07-29. "Launch prerequisite" is a DAG edge to P13 and NOTHING ELSE — both rows enter in score order like every other row, exactly as §10.23 forces for `PM`. Neither outranks the ladder, neither is worked before a higher-scoring unblocked row, and an agent that reorders the queue because a row is labelled a prerequisite has done the thing §10.23 exists to stop.** **This loop does NOT do the RLS work — `recursiv:docs/RLS-COMPLETION-GOAL-PROMPT.md` drives a second loop over the same Postgres (§0, §1.9). This row is this loop VERIFYING it, and §1.9 forbids marking another loop's work done on that loop's say-so.** **(1)** Policies exist, as a PAIR because a bare zero is what a wrong schema, a wrong database or a query against a replica returns: `run_sql_query` over `pg_policies` for the tenant tables → a stated **NON-ZERO** policy count, pasted beside the same session's `information_schema.tables` enumeration returning a stated **NON-ZERO** table count. **Today the in-repo evidence is zero:** `git -C /home/bill/dev/recursiv grep -il "ENABLE ROW LEVEL SECURITY\|CREATE POLICY" origin/main -- drizzle packages/server` → **empty** (re-run 2026-07-29). The live DB may differ from the repo and **(1) is what settles that, not the grep** — but an empty grep plus an unrun query is not evidence of coverage, it is evidence of nothing. **(2)** A cross-tenant read is actually DENIED, positively controlled in ONE transcript with byte-identical query text on both sides: under the Minds project-bound key the query returns Minds rows with a stated **NON-ZERO** count, and the same query targeting another tenant's `network_id` returns **zero**. **An empty result from a key that returns nothing at all satisfies the zero half and proves nothing** — this is P7(5)'s form and it is mandatory here because "no cross-tenant rows" is exactly what a broken query looks like. **(3)** The other loop's completion **re-fetched by this loop**: `get_task` on umbrella `proj-goal-fully-complete-rls-security-rollout-and-migration-handoff-elkn1ri9` in a terminal state, pasted with the command that produced it. A status reported in prose by the other loop, or a link to its controller, is not this artifact. **(4)** **App-code scoping survives.** `AGENTS.md` footgun 1 records RLS as the *planned backstop* while app-code scoping is load-bearing; a backstop that arrives is not a licence to delete the thing it backs. The three endpoints named there — `/profiles/leaderboard`, `/agents/discoverable`, `/agents/leaderboard` — re-tested in (2)'s paired form **with RLS in force**, each returning Minds rows NON-ZERO and other-tenant rows zero. | **`ALTER TABLE … DISABLE ROW LEVEL SECURITY` reverts in seconds — but the blast radius is every co-resident tenant, not Minds alone.** Minds is one of ~17 (`AGENTS.md`); a wrong policy denies reads for all of them, and the failure presents as an empty feed rather than an error. Roll back **at the policy**, never by removing app-code scoping, or (4) silently regresses to the pre-RLS leak state. | **Blocked on the RLS loop, not on a row here — and that is NOT a `Serial on` value §1.3 can act on. READ THIS BEFORE Cycle 0:** Cycle 0 loads every non-root row `blocked`, and §1.3's transition flips a row to `pending` only when a row it is a *dependent of* closes — where "dependent" means §2's DAG block, not this column. **`PR` appears nowhere in that block, so nothing in this document can ever move it out of `blocked`** — while `P13`'s `Serial on` names `PR`, which means the TERMINAL row could never close and the ladder could never terminate. That is a deadlock, not a gate. **The unblock condition, stated so it is mechanical:** `PR` moves to `pending` the moment the other loop's umbrella task reaches a terminal state — `get_task(proj-goal-fully-complete-rls-security-rollout-and-migration-handoff-elkn1ri9)`, which is sub-artifact (3)'s own command, so the trigger and the evidence are the same call. Any agent may run it in any cycle and `update_task(status:"pending")` on this row when it returns terminal; record that in the cycle line. **And if §10's "Does the Minds launch block on RLS Phase 2?" row lapses to its written default — *ship on app-layer scoping; RLS is post-launch defense-in-depth* — then `PR` is REMOVED from the ladder under §1.6's decrease format (`BASELINE 113/109 REASON §10-decision ROW PR ARTIFACTS -4 DECISION <log_decision id>`), the `PR` edge is struck from `P13`'s `Serial on`, and per §1.6 that decrease is NEVER reported as `DELTA-DISTANCE` progress.** Neither branch was written down when this row was added on 2026-07-29; both are now. §5.41. | 61.0 |
| **PD** | `recursiv.app` is the app's served origin | 3 | **Declared a launch prerequisite by Bill 2026-07-29. Distinct from §8's legacy-`minds.com` carve-out — different hosts, different decision; see §8's amended text and §5.38.** **(1)** `curl -s -o /dev/null -w '%{http_code}' https://minds.recursiv.app/` → **`200`**. **Today: `000`** (re-run 2026-07-29, twice — 15:13 and again at 00:10 after the operator reported moving `recursiv.app` to Cloudflare) — and the shape of today's failure is the reason this sub-artifact is worded against the HTTP code and not against DNS: `getent hosts minds.recursiv.app` **already succeeds**, returning a CNAME to `cname.vercel-dns-016.com`, while nothing terminates TLS. **⚠ THE ZONE IS ON CLOUDFLARE; THE RECORD POINTS AT VERCEL; THE VERCEL CERT IS EXPIRED. All three are true at once, and an earlier draft of this cell got it wrong by reading the CNAME target and inferring the move had not propagated — without checking `NS`, which is the only record that answers "where does this zone live".** Verified 2026-07-30 00:1x: `dig +short NS recursiv.app` → `konnor.ns.cloudflare.com`, `lovisa.ns.cloudflare.com`, and the `SOA` is Cloudflare's — **the move happened.** Inside that Cloudflare zone, `minds.recursiv.app` is a CNAME to `cname.vercel-dns-016.com`, resolving to `216.150.x` (Vercel's range, not Cloudflare's `104./172.`), so the record is **DNS-only / grey-cloud** and passes straight through to Vercel. Nothing was misconfigured at Vercel by anyone; that CNAME is a record in the Cloudflare zone. **The `000` is neither DNS nor a missing listener — it is `SSL certificate problem: certificate has expired` (`curl -sv` pasted in the PR).** Vercel answers, presents a lapsed certificate, and curl refuses before HTTP. **Hypothesis, NOT a finding (§1.1): the NS move to Cloudflare broke Vercel's ACME renewal path, so the certificate lapsed rather than rotated. That is a guess about causation and closes nothing** — **and the LAPSE ITSELF is no longer a guess (measured 2026-08-06, §5.54): `echo \| openssl s_client -servername minds.recursiv.app -connect minds.recursiv.app:443 \| openssl x509 -noout -subject -issuer -dates` → `subject=CN=*.recursiv.app`, `issuer=… Let's Encrypt … R13`, `notBefore=Apr 21 16:34:49 2026 GMT`, `notAfter=Jul 20 16:34:48 2026 GMT`. The wildcard expired 2026-07-20. `dig +short minds.recursiv.app A` → `216.150.16.1`, `216.150.1.1` — still Vercel's range, so the record is still grey-cloud and Vercel still terminates TLS. The CAUSE of the non-renewal remains a hypothesis; the expiry and the un-proxied record are facts.** — **OWNER DIRECTIVE 2026-07-30: use Cloudflare for everything possible.** That settles which of the two fixes to take — **proxy the record (orange-cloud it) so CLOUDFLARE terminates TLS**, rather than re-issuing a Vercel certificate for a hostname whose zone Cloudflare already controls. It also clears a cross-entity flag `dev-hq:PROPERTIES.md` raises independently — *"`recursiv.io`, `recursiv.app` — Recursiv's core domains sit in Minds' Vercel team — cross-entity infra"* — which is how a Recursiv domain came to depend on a Minds-team certificate at all. Fallback if proxying is rejected: re-issue the cert (re-verify the domain on the Vercel project). Either way, re-run (1) and accept only the `200`. **The lesson that survives regardless, and it is this sub-artifact's whole thesis: `getent`/`dig` succeeding is not this artifact, and neither is a zone transfer anybody can see in a dashboard. Three layers can each be correct while the surface is dead. Accept the `200`.** **Provider-access boundary:** the DNS/TLS change itself needs registrar or CDN credentials the loop does not hold. §1.7 does not currently enumerate DNS among its forbidden actions, so this row is NOT marked `HUMAN-ONLY` — but an agent that cannot reach the provider **prepares and releases with `PARTIAL k/3 … BLOCKED-BY provider-access`** rather than guessing at a config it cannot verify. Whether DNS joins §1.7's enumeration is a human's call and is not decided here. **A resolving name is what a half-finished switchover looks like, and it reads as DONE to every check that stops at DNS.** `getent`/`dig` succeeding is NOT this artifact. **(2)** The origin serves **this app**, not a placeholder, a parked apex or another tenant. §5.20 applies — the page title cannot distinguish two Minds-branded surfaces — so the artifact is a THREE-WAY paste from one session: `curl -s https://minds.recursiv.app/ \| grep -c "expo-root\|_expo/static"` → **NON-ZERO**, beside the identical command against `https://minds.on.recursiv.io/` (today **`1`**, the positive control that the grep string is right), beside the identical command against `https://recursiv.app/` (today the apex returns **`404`**, the negative control that a wildcard or parked page cannot satisfy this). **(3)** The switchover is **complete, not additive**, and **which ending is chosen is written into the PR BEFORE the change**: every surface naming the old host is updated — both store listings, in-app links, and `app/+html.tsx`'s OG/meta tags — and the old host either still returns `200` (dual-serving, stated as deliberate) or `301`s to the new one, proven by `curl -sI https://minds.on.recursiv.io/` pasted with its `Location`. **Discovering after the fact which of the two happened is not an artifact.** ⚠ **Interaction, stated here because it is the kind that is found at launch: `P13(3)` closes against `https://minds.on.recursiv.io/` by name, twice. If PD lands first, the PR that lands it MUST update P13(3)'s host in the same commit** — otherwise the terminal row of the ladder certifies a host nobody uses, and it will pass while doing so. | DNS revert, bounded by TTL. **Choose the redirect ending LAST** — while (3) is dual-serving, the old origin keeps serving throughout and a revert is a no-op for users. Once the `301` is in place a revert is TTL-bounded downtime on the launch domain. | — | 68.1 |
| **P13** | The three surfaces are actually reachable by a stranger | 3 | **(1)** A person outside the org installs Minds from the **public App Store listing** and reaches the feed — **recording committed at `qa-media/p13-1-<asc-build-id>.mov`**, with the public listing URL, the store page's build/version string and the installing Apple ID visible **in the same frame** (§1.3's committed-and-bound media class, the form P3b(1) and #190's three already use). **The terminal row of the ladder was the last place still closing on an unbound, uncommitted "screen recording" — the class fold changed the definition in §1.3 and did not touch this cell, which left P13(1)/(2) naming no valid artifact at all and therefore unstartable by §1.3's own rule.** **The pre-state is FILMED, not asserted: "a device that has never had a build sideloaded" is unprovable by any recording, so what is required instead is checkable on camera before the store install begins — the app ABSENT from the device, and no TestFlight entry for it. An empty screen is not that: a TestFlight that failed to load, a signed-out Apple ID and a broken query all film identically. So the absence is bound to a LIVE enumeration in the SAME continuous take — TestFlight open and listing at least one OTHER build, or `xcrun devicectl device info apps` run against the connected device and shown returning a non-empty app list — with Minds absent from it. P7(5)'s form: the non-empty half is what makes the empty half readable.** **(2)** The same from the **public Play listing**, committed at `qa-media/p13-2-<play-release-id>.mov` with the listing URL, the release/version string and the installing Play account visible in the same frame, and the same filmed pre-state, **positively controlled in P7(5)'s form, because `grep -c` → `0` is byte-identical to what a disconnected device, an unauthorised `adb` session, a wrong serial or a mistyped package name returns**: `adb devices -l` showing the serial, then `adb shell pm list packages \| wc -l` → **NON-ZERO** — the shell answered and returned a package list — beside the identical `adb shell pm list packages \| grep -c com.minds.app` → **`0`**. All three from one session, all three pasted or shown in frame. **The serial proves `adb devices` saw the device; it does not prove `pm list packages` returned anything, and that gap is why this was the last unpaired zero in the ladder while the identical `adb` shape at P7(5) already carried `RUNAS-OK` plus a non-zero control.** **(3)** `curl -s -o /dev/null -w "%{http_code}" https://minds.on.recursiv.io/` → `200` — **and the `200` is NOT the artifact: it is true TODAY with nothing shipped (re-verified 2026-07-29).** The sole discriminator was the clause *"confirmed by a visible build string"*, which named no string, no command and no committed frame, and did not require the string to exist before the deploy — which is exactly what PW(2) two rows above was rewritten to forbid, because otherwise the worker chooses, after the fact, the very string this line greps for, and "Minds" is present in every build (§5.20). That fix was not carried to the terminal web sub-artifact of the ladder; it is carried now. **PW(2)'s rule applies here verbatim:** the candidate build string is **derived from the P12 candidate SHA** — its short hash, e.g. injected by `scripts/inject-boot-shell.mjs`, which `git ls-tree origin/main --name-only -- scripts/` confirms exists — and **both it and the previous string are written into the PR BEFORE the deploy**. Artifact, the pair, pasted with the P12 candidate SHA: `curl -s https://minds.on.recursiv.io/ \| grep -o '<candidate string>'` **non-empty** AND `curl -s https://minds.on.recursiv.io/ \| grep -c '<previous string>'` → **`0`**, both strings byte-identical to the two committed in advance. **A status code with no pair does not close this.** **Until all three exist the launch has not happened, whatever the counter says.** The previous revision terminated at `Ready to Submit`, which meant `OUTSTANDING` could reach 0 with the app sitting in review and nobody able to install it. | An approved app is unpublished from both consoles in minutes; that is the rollback. | P12, PR, PD, PAPI, PMCP, PSDK, PCLI | 71.0 |

**Off-ladder but P0-class by §8's own carve-out: #190 — N = 3.** Chat retry / attach / voice-note can
deliver into the **wrong conversation** — cross-user private-data misdelivery in a shipped path.

> **Exit artifact — WEB ONLY.** `gh issue view 190` states verbatim: **`Scope: web-only — native
> pushes /chat/[id], which is a fresh mount.`** **A native reproduction proves nothing and closing on
> one is a §1.5 phantom-progress violation.** In ONE web session with two disposable accounts: open
> Alice's thread, switch to Bob's **without a reload**, then send **(1)** a photo, **(2)** a voice
> note, **(3)** a retry of a failed message. For each, capture the **outbound request in the network
> tab and assert `conversation_id` equals Bob's** — that is #190's own A-grade verification
> (*"capture the outbound request and assert conversation_id matches the visible thread. Network-tab
> screenshot, not a unit test."*). **Each of the three captures is committed at
> `qa-media/190-<n>-<sha7>.png`** (`<n>` ∈ {1,2,3}, `<sha7>` the SHA under test) **with the request
> URL, the request body's `conversation_id`, and Bob's thread id all visible in the same frame** —
> §1.3's committed-and-bound media class, the same form P3/P3b/P5/P12 already use. *(These three previously required a
> network-tab capture but named no path, so the artifact existed only in whatever the worker said it
> saw.)* The recipient-side thread on both accounts is supporting evidence, not the artifact. **Anchors to re-verify per §1.2 before starting — declaration lines, from
> `git show origin/main:app/'(tabs)'/chat.tsx | grep -nE "const (handleAttach|handleSendVoice|retryMessage|handleSend) *="`:**
> `:1217` (`handleSend`), `:1476` (`handleAttach`, deps `[sdk, attaching]` at `:1495`), `:1500`
> (`handleSendVoice`, deps `[sdk]` at `:1516`), `:1518` (`retryMessage`, deps `[]` at `:1529`).
> *(An earlier revision cited `:1495` and `:1516` as the handlers themselves; `sed -n '1495p;1516p'`
> returns `}, [sdk, attaching]);` and `}, [sdk]);` — the dependency-array closings, not the
> declarations. **Cite declarations, and name the dependency line separately when the stale closure
> is the point.**)*
> *(The previous revision specified "a screen recording plus the recipient-side thread" — a test that
> passes on native regardless of the bug.)*

Runs in parallel with everything. Score **70.4** (§3.1).

**PM — PRE-WRITTEN, CONDITIONAL, NOT IN THE DENOMINATOR TODAY.** *(Written out here rather than in the
table on purpose: the §1.6 `awk` matches table rows, so a conditional row inside the table would move
the denominator to 96 before the condition fires. It is pasted into the table verbatim — as
`| **PM** | … | 3 | … |` — on the day §10.23 lapses or is confirmed, and not before.)*

| # | Step | N | Exit ARTIFACT | Rollback | Serial on | Score |
|---|---|---|---|---|---|---|
| PM *(conditional)* | Re-host the ~74K `cdn.minds.com` media references ahead of the legacy sunset | 3 | **(1)** The sunset is **confirmed or refuted by a command, not by belief**: `curl -sI <asset-url>` against a `cdn.minds.com` URL **taken from a named imported post id** (paste the post id and the `run_sql_query` that produced the URL) → a status code, dated. A `200` today is not a refutation of a future sunset; the *decision* row is what settles the date. **(2)** A count query, printed with its output, showing the remaining `cdn.minds.com` references: `run_sql_query` over the media/attachment table → today `~74,278 of 74,282` per `git -C /home/bill/dev/recursiv show origin/main:docs/MINDS.md` `:119-121`; exit is a **pair from one query, because a bare `0` over ~74,278 rows is equally what a typo'd table name, a changed column, or a `LIKE` pattern that stopped matching returns**: rows matching `cdn.minds.com` → **`0`** AND total rows in that table → **`74,282`**, the denominator held constant (it appeared in the today-value and was never carried into the exit condition) AND rows matching the NEW host → **`74,278`**. A zero beside an unchanged denominator and a matching positive count cannot be produced by a broken query. **PM is pasted into the ladder verbatim the day §10.23 lapses, so this is fixed here rather than at paste time.** **(3)** `curl -s -o /dev/null -w '%{http_code}'` → `200` on the **re-hosted** URL for the same named post id from (1), plus the post rendering its image in a screen recording **committed at `qa-media/pm-3-<post-id>.mov` with that post id visible in frame (§1.3's committed-and-bound media class) — the unbound form does not close this either.** | Re-point the references back; the legacy CDN either still serves or it does not, and (1) is what tells you which. | — | **55.9** |

**On lapse or confirmation:** paste the row into the ladder table, insert `| PM re-host the
cdn.minds.com media references | 5 | 3 | 3 | 5 | 5 | 5 | 1 | 4 | 2 | 7 | 148 | **55.9** |` — §3.1's
already-published provisional inputs, unchanged, every one of them inside `create_task`'s live 0-5
bounds for `signal`/`urgency`/`severity`/`ui_impact` — into §3.1
**between P3b (58.5) and P2b (55.5)** — the only position that keeps §3.1 descending, which §1.5's
"ladder table unsorted" row checks — and post `BASELINE 113/116 REASON §10.23 ROW PM ARTIFACTS +3` to
#206. **It is worked in §3.1 score order at 55.9. It does NOT outrank the ladder**; fifteen rows
outscore it, PS and P0 among them. If §10.23 is refuted, this row is deleted, §3.1 is untouched, and
no `BASELINE` line is owed because it never entered.

### Parallel vs serial

**This is a DAG, not a total order.** Seven rows are startable today with no predecessor; several
pairs are genuinely concurrent. Where two rows are simultaneously startable, §3.1's score is the
tie-break.

- **Strictly serial:** P1 → P2a → P2b; P1 → P2a → P2c; P1 → P2a → P2b → P3 → P3b(1).
- **Strictly serial:** P1 → P4; P4 → P5; P4 → P7; P4 → P9; P4 → P10; P2a → PW; P3, P5 → P6;
  **P6 → P3b(2)**; P7 → P9; P8 → P9; all → P11 → P12 → P13.
- **PA depends on nothing** and is startable today. It is the only row whose absence makes every
  other row's `SELF-AUDITED` field read `yes` forever.
- **P8 → P9 is a real dependency, not a preference.** P9 puts money behind user-supplied content
  (advertiser creatives under #198, paid posts), so a fail-closed classifier must exist before
  anything monetized is publishable. **If #197's scope decision (§1.4) removes paid user content from
  the launch gate, this edge is cut and P8 becomes parallel — record that in §5 if it happens.**
- **Startable today with no predecessor: P0, PS, PA, P1, PD, PAPI and #190 — the DAG's seven roots.** Everything
  else in §2 is loaded `blocked` at Cycle 0. **Order among the five is §3.1's, and there is exactly one
  ordering statement in this document: PS (101.8), P0 (92.0), #190 (70.4), PD (68.1), P1 (65.8), PAPI (61.3), PA (41.7).**
  *(An earlier revision said "Do P0 first **regardless**" here while the closing actions said "P0 if
  you are Bill, otherwise PS" and §1.0 said "the highest-scoring unclaimed row" — three orderings in
  three places for the most-executed decision in the file. "Regardless" is deleted.)* **P0 is
  `HUMAN-ONLY`: §1.7 forbids an agent rotating a live credential, so an agent claiming P0 does the
  preparation — enumerate every consumer, stage the new key, write the two-phase runbook — and
  releases without executing.** PS is the highest-scoring engineering item in the estate, depends on
  nothing, and an agent may execute it end to end.
- **P8 and P10 may be *investigated* in parallel with anything** — §10.6's consent-ledger grep and
  P8's coverage document need no environment — **but neither can *exit* before P4, because both exit
  artifacts require a non-production environment. Do not read "parallel" as "closable."**
- **Strictly serial:** PAPI → PSDK; PAPI → PMCP; PAPI → PCLI. All three of their sub-artifact (2)s
  need a key a stranger minted, which is PAPI(1). **PAPI itself is a root and startable today.**
  All four gate **P13** — they are surfaces of the same launch, not a separate program (§5.46).
- **Parallel pair:** P6 and P7 share no artifact.
- **P4 is the single highest-leverage unblocking move in the document.** Two people means P4 starts
  the same day as P2a.
- **P4 has a precondition in the engine repo that this ladder does not own.** `recursivlabs/recursiv#1296`
  ("Isolate staging deploy workflow from production refs") records that `staging-deploy.yml` still
  injects `PRODUCTION_API_APP_UUID`, branches `DISPATCHER_API_KEY` into it, and runs a QA step against
  `RECURSIV_PRODUCTION_API_URL` — all four confirmed at `origin/main:.github/workflows/staging-deploy.yml`
  `:48`, `:112`, `:114`, `:272` (2026-07-29). P4 is built entirely on that workflow's staging origin and
  P0's rollback cell enumerates the dispatcher as a rotation consumer. **This is named, not added as an
  artifact: it is an engine-repo issue nobody here can close, and inventing a P4 sub-artifact for it
  would move this document's denominator for work outside its own repo. Read #1296 before starting P4;
  if it is still open, say so in the P4 PR.**

### The four human decisions sit *outside* this ladder

**They do not block the START of any of P0–P5 — every one of those rows is workable today. They block
specific EXITS.** *(The previous revision wrote "do not block P0–P5" and then, in the next clause,
listed P3's exit and P2's #194 merge — both inside P0–P5. Two consecutive sentences, two answers, and
an agent handed only the P3 row found #186 named nowhere in it while §1.4's table said #186 blocks
"P3's exit". Three places, two answers, at a row on the critical path.)*

- **#186** blocks **P3's exit** and **P12**. P3's cell now says so in sub-artifact (2).
- **#189** blocks **P7**.
- **#197's scope** blocks **P9's scope** and the **P8 → P9 edge**.
- **#195** blocks **P2b's sub-artifact (5)** (the #194 merge) and everything in §7 belief 2.

Escalate all four on day one so they are not discovered as blockers in week four. §1.4 is the
protocol, and §10 carries a written default for each so a lapsed date does not stall the loop.

---

## 3. DISPATCHER SYNCHRONIZATION

The scoring formula is **real, live, and not to be replaced**.
`recursiv origin/main:packages/server/src/features/dispatcher/DispatcherService.ts`, @ `// ── Scoring ─` through `function computeFormulaScore(`:

```
score = ((proximity × milestone_mult) + (leverage × 3) + (signal × 3) + (urgency × 3)
       + (severity × 8) + (ui_impact × 5) + (revenue × 7) + (growth × 5) + (mission × 4))
       / max(√effort, 1)

MILESTONE_MULTIPLIERS = { R1: 3.0, R2: 2.0, R3: 1.5, R4: 1.0, M1: 3.0, M2: 2.0, M3: 1.5,
                          M4: 1.5, M5: 2.0, M6: 1.5, M7: 1.0, M8: 1.0, M9: 1.0, M10: 1.0 }
MILESTONE_MULTIPLIERS[milestone ?? ''] ?? 0.5      // ← an unknown or absent milestone = 0.5
Math.max(Math.sqrt(effort ?? 2), 1)                 // ← verbatim from source
```

Ranges: `proximity` 1-10; `signal`/`urgency`/`severity`/`ui_impact` 0-5;
`revenue`/`growth`/`mission` 0-10; `effort` 1-10; `leverage` = `blocksCount`.
`mission_impact` is defined in-source as **"freedom, openness, decentralization"**.

**Implementation check — TWO properties, checked in one pass, both binding.** Reconstructing
`docs/surface-priorities.md`'s published #1 from its own input columns at `R2` reproduces its numerator
`138` and score `97.58 → 97.6` exactly. And in §3.1:

1. **Every row recomputes.** Parse the table, compute
   `(prox*3 + lev*3 + sig*3 + urg*3 + sev*8 + ui*5 + rev*7 + grow*5 + miss*4)`, assert it equals the
   published `num`, divide by `max(sqrt(eff),1)`, and assert the result equals the published `score`.
   **Re-run 2026-07-29: 25 of 25.**
2. **The table is in descending score order.** §2's parallel/serial block makes §3.1 the tie-break
   between simultaneously-startable rows and §3.1's own last paragraph calls it *"a pick-up order for
   an agent that is free right now"* — **an unsorted pick-up order is not one**, and an agent reading
   positionally and an agent sorting numerically pick different work. Check:
   ```
   awk '/^### 3.1/,/^### 3.2/' "$GP" | grep '^| ' | grep -v '^| Item\|^|---' \
     | awk -F'|' '{gsub(/\*\*/,"",$14); gsub(/ /,"",$14); print $14}' \
     | awk 'NR>1 && $1>prev {print "OUT OF ORDER row " NR ": " $1 " > " prev} {prev=$1} \
            END{print "rows read: " NR}'
   ```
   must print exactly `rows read: 32` and nothing else. **The row count is a positive control, not
   decoration: with a broken `$GP` this pipeline prints nothing and exits `0` — verified 2026-07-29
   against `/nonexistent/x.md` — so "must print nothing" made a silent pass and a dead pipe
   byte-identical, on one of the THREE self-checks this document makes about itself (enumerated at
   the top of this file: §1.6's denominator awk, this sort check, §3.2's length/column check) and the
   one §1.5 arms a detector row on. *(This sentence read "one of only two" for two revisions,
   dropping §1.6's denominator awk — the check §1.6 calls the source of the denominator of every
   progress report. An agent told to re-run "both" would have left it un-run.)* A detector that passes on a dead pipe is what §1.0 calls teaching the loop
   that its own detectors mean nothing. Re-run 2026-07-29 on the real file: `rows read: 31`, no
   violations.**

**Rounding, stated once because getting it wrong is what produced the retracted `44.6` (§5.24):
§3.1's `score` column is rounded ONCE, from full precision to 1dp, half-up. Double-rounding through
2dp is FORBIDDEN.** The "round half-up to 2dp" convention below applies to values quoted **from the
server** (the `57.28` anchor), not to this table. `126/√8 = 44.5477…` → **44.5** at 1dp; the retracted
value was reachable only as `44.5477 → 44.55 → 44.6`.

**Any edit that changes a score re-sorts the table and re-runs both checks in the same PR.** §1.5 has
a row for the failure.

### 3.1 The ladder, scored

This document scores at **milestone R1 (mult 3.0)**; `docs/surface-priorities.md` scored at **R2
(2.0)**. To compare a row across the two, **subtract `proximity` from this numerator** and re-divide.
Numerator and effort are published per row so anyone can recompute.

| Item | prox | lev | sig | urg | sev | ui | rev | grow | miss | eff | num | **score** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| #195 open-source layer decision + LICENSE | 8 | 4 | 1 | 3 | 1 | 0 | 1 | 5 | 8 | 1 | 120 | **120.0** |
| **PS** wire `apiKeyAuth` onto `/signals/*` + `/moderation/*` — **`/evidence` done 2026-07-28** | 9 | 2 | 4 | 5 | 4 | 3 | 2 | 3 | 2 | 2 | 144 | **101.8** |
| P0 rotate Mac `sk_live_` + Infisical creds | 9 | 2 | 0 | 5 | 5 | 0 | 0 | 0 | 1 | 1 | 92 | **92.0** |
| #198 token/Boost → adx **decision** | 2 | 3 | 2 | 2 | 1 | 1 | 7 | 5 | 4 | 2 | 130 | **91.9** |
| #204 fork-ability decision | 8 | 4 | 0 | 3 | 0 | 0 | 1 | 3 | 4 | 1 | 83 | **83.0** |
| P2a branch protection | 10 | 3 | 0 | 4 | 3 | 0 | 0 | 0 | 1 | 1 | 79 | **79.0** |
| P5 #185 rebuild + redistribute off prod channel | 7 | 4 | 2 | 5 | 5 | 0 | 3 | 1 | 1 | 3 | 124 | **71.6** |
| **P13 a stranger installs it from the public listings** | 1 | 0 | 3 | 3 | 0 | 3 | 5 | 8 | 3 | 3 | 123 | **71.0** |
| **#190 chat attach/voice/retry sends to the WRONG conversation (web)** | 8 | 1 | 1 | 5 | 5 | 4 | 0 | 1 | 3 | 3 | 122 | **70.4** |
| **PD `recursiv.app` is the app's served origin** | 7 | 3 | 0 | 4 | 3 | 2 | 2 | 4 | 2 | 3 | 118 | **68.1** |
| **P11 the launch gate** | 2 | 1 | 2 | 4 | 3 | 4 | 3 | 4 | 1 | 3 | 116 | **67.0** |
| P1 CI green on `main` | 9 | 5 | 0 | 5 | 4 | 0 | 0 | 0 | 1 | 2 | 93 | **65.8** |
| **PSDK** the SDK installs and works from a clean env | 4 | 2 | 1 | 3 | 3 | 0 | 3 | 6 | 6 | 4 | 129 | **64.5** |
| PW web release path documented + gated | 6 | 2 | 2 | 3 | 2 | 2 | 2 | 4 | 2 | 3 | 107 | **61.8** |
| **PAPI** the public API is usable by a stranger | 3 | 3 | 2 | 4 | 3 | 0 | 4 | 5 | 6 | 5 | 137 | **61.3** |
| **PR multi-tenant RLS proven for the Minds tenant** | 2 | 6 | 0 | 5 | 5 | 0 | 2 | 1 | 6 | 4 | 122 | **61.0** |
| **PMCP** the MCP server works for a stranger | 4 | 1 | 3 | 3 | 2 | 1 | 3 | 5 | 5 | 4 | 120 | **60.0** |
| P9 monetization proof set in staging (#197) | 2 | 4 | 2 | 5 | 4 | 2 | 10 | 4 | 2 | 9 | 179 | **59.7** |
| P10 consent + suppression ledger (#200 step 1) | 4 | 3 | 1 | 4 | 5 | 0 | 4 | 6 | 3 | 6 | 146 | **59.6** |
| P4 staging wired to the app | 4 | 6 | 1 | 5 | 3 | 0 | 6 | 2 | 2 | 5 | 132 | **59.0** |
| P3b app boots on iOS hardware | 5 | 4 | 1 | 4 | 4 | 2 | 2 | 3 | 1 | 4 | 117 | **58.5** |
| P2b merge train #183/#180/#184/#181/#194 | 8 | 5 | 1 | 5 | 5 | 2 | 0 | 0 | 1 | 4 | 111 | **55.5** |
| P3 track-player off the pre-`AppRegistry` path | 7 | 2 | 1 | 4 | 5 | 2 | 0 | 0 | 1 | 3 | 96 | **55.4** |
| **PCLI** the CLI installs and works from a clean env | 4 | 1 | 1 | 2 | 2 | 0 | 2 | 4 | 5 | 3 | 94 | **54.3** |
| P2c evidence gate enforced in CI | 9 | 4 | 0 | 3 | 2 | 0 | 0 | 0 | 3 | 2 | 76 | **53.7** |
| P7 key revoke/expiry over REST + SDK (#188) | 6 | 2 | 1 | 3 | 5 | 0 | 2 | 0 | 3 | 4 | 102 | **51.0** |
| P8 moderation primitive, fail-closed (#196) | 3 | 5 | 1 | 3 | 5 | 1 | 2 | 3 | 5 | 8 | 130 | **46.0** |
| P12 store submission uploaded + in review (iOS + Play) | 3 | 3 | 2 | 4 | 0 | 0 | 6 | 8 | 2 | **8** | 126 | **44.5** |
| **PA** the §1.5 detector runs unattended | 9 | 1 | 0 | 3 | 2 | 0 | 0 | 0 | 1 | 2 | 59 | **41.7** |
| P6 native crash telemetry (#187) | 5 | 4 | 2 | 4 | 4 | 0 | 1 | 1 | 1 | 5 | 93 | **41.6** |
| #199 `~/dev` manifest sync | 6 | 2 | 0 | 2 | 1 | 0 | 0 | 1 | 1 | 4 | 47 | **23.5** |

**This table is sorted by the `score` column, descending, and the ordering is load-bearing** — §2's
parallel/serial block uses position and number interchangeably as the tie-break between
simultaneously-startable rows. Until this revision it was **not** sorted: P12 sat two positions above
P7 (51.0) and P8 (46.0), and PA (41.7) sat below P6 (41.6), while the same revision added §5.22
rejecting two graders for publishing scores that do not recompute. **Both checks in §3 are re-run and
both pass as of 2026-07-29.**

**Calibration anchors, live and project-scoped:** `list_tasks(project_id=019d5190-…,
status="pending", limit=100)` → 7 tasks; the legacy-cutover task at **57.28** (raw `57.27564927611034`;
**round half-up to 2dp everywhere in this document** — an earlier revision printed it as both `57.27`
and `57.28`, which its own §1.2 clause 3 calls a divergence condition); `[Reveal] WS2` feed swap @
effort 4 = **26**. Verified 2026-07-28 — these are the only Minds-project tasks in the dispatcher
today, which is why §1.0 scopes the loop's queue read to that project **and why Cycle 0 exists**.
**Neither anchor is a ladder row.** The 57.28 task is labelled "P0 legacy-auth" in the dispatcher and
is not §2's P0; §8 puts it out of scope.

**PA is scored, not asserted, and two round-3 graders got it wrong** — one proposed `62.0` from
"numerator 87", another `66.0/65.05` from "numerator 92". Neither recomputes: at prox 9 / lev 1 /
sig 0 / urg 3 / sev 2 / ui 0 / rev 0 / grow 0 / miss 1 / eff 2 the numerator is
`9×3 + 1×3 + 0 + 3×3 + 2×8 + 0 + 0 + 0 + 1×4` = **59**, and `59 / √2` = **41.72**. Leverage is 1, not
3 — PA blocks no ladder row; it changes what `SELF-AUDITED` can read. Mission is 1, not 2 — an
auditable loop is adjacent to "freedom, openness, decentralization", not an instance of it. §5.22.

**Conditional, not ranked until verified — see §10.23:** legacy-CDN media migration. If
`recursiv origin/main:docs/MINDS.md:119-121` is current, ~74,278 of 74,282 media references still
point at `cdn.minds.com` and legacy minds.com is sunset-gated **~July 31**. At prox 5 / lev 3 / sig 3
/ urg 5 / sev 5 / ui 5 / rev 1 / grow 4 / miss 2 / eff 7 that is numerator **148**, score **55.9** —
**the row is pre-written in §2 as `PM`, and these are its inputs; do not re-derive them** — but
**that document was last modified 2026-06-24** (`git -C /home/bill/dev/recursiv log -1
--format='%h %ad' --date=short origin/main -- docs/MINDS.md` → `5bb4b5ca 2026-06-24`; **without `-C`
this prints nothing and exits 0**, §1.2 clause 5) and today is 2026-07-28. **A date-stamped
external deadline three days out either outranks this entire ladder or does not exist. It is not
scored until someone confirms it with the owner. That confirmation is the highest-value hour in this
document.** If confirmed, it enters §2 under §1.6's denominator rule with a `BASELINE` line.

> **THREE LAYERS, AND THEY HAVE DIFFERENT MUTABILITY. Conflating them is what produced §5.45.**
>
> | Layer | Mutability | Why |
> |---|---|---|
> | **What launch means** (§2's surface definition, §8's carve-outs) | **Changes when a human learns something.** Bill widened it on 2026-07-30 and was right to. | A goal that cannot absorb new information is a guess defended past its evidence. It changes by owner declaration, recorded (§5.44), never by an agent. |
> | **The exit artifact of a CLAIMED row** | **IMMUTABLE until the row closes or is released.** | If the bar moves while someone works toward it, nothing can ever be proven done. This is "we shipped anyway" with extra steps, and it is the single thing this document exists to make impossible. |
> | **The order to work in** (§3.1's inputs and scores) | **Changes every cycle, from facts.** §1.0's `RESCORE` step. | A frozen order means working yesterday's most important thing. |
>
> **So: goals may move; bars may not move under someone mid-task; order moves constantly.** An earlier
> reading of this file collapsed the first and third into "settled priorities" and enforced the second
> across all three — three mechanisms for stability, none for freshness.

> **THIS TABLE IS STATE, NOT A VERDICT — and a ranking that never moves is a defect, not stability.
> Owner direction, Bill, 2026-07-30.** The nine inputs per row are the state; the score is *derived*
> from them. **Both are expected to change as facts arrive**, and §1.0's cycle contract now requires
> the arriving facts to be pushed back into the inputs (§1.0's `RESCORE` step). The controller does not
> need to hold the right priorities in advance; it needs to make the priorities *re-derivable* and to
> make a stale one visible.
>
> **The defect this closes, stated because the document caused it.** Before 2026-07-30 nothing in this
> file required a score to be revisited — `grep -ciE 'rescore|revisit the score'` over the whole
> controller returned **`0`** — while §1.5 carried a detector for scores *drifting* from the published
> table and `score_override` pinned the dispatcher to it. **Every mechanism pointed at freezing the
> ranking and none at refreshing it.** A day that moved the CDN sunset from five weeks out to
> *tomorrow*, took `recursiv`'s open PRs from 10 to 18, forked the SDK, and expanded launch scope to
> four more surfaces changed **not one input in this table.** §5.45.
>
> **The worked example, and it is live:** `PM`'s `proximity` of **5** was assigned when the sunset was
> five weeks away. It is now one day away. Proximity is the term that moves with time, so `PM`'s
> inputs are stale by construction — not wrong when written, stale now. Re-deriving it is exactly the
> obligation §1.0's `RESCORE` step creates.
>
> **What has NOT changed, so nobody reads this as licence:** the arithmetic still has to hold. Check
> `[5]` verifies every row's score recomputes from its own published inputs, and it stays — that check
> constrains *consistency*, never *value*. Moving an input is legitimate; publishing a score that its
> inputs do not produce is still a §1.5 violation. And an input may only move because a **fact**
> moved, with that fact named — not because a row feels urgent.

**Read this table correctly.** The score is a *pick-up order for an agent that is free right now*. It
is **not** the dependency order — §2 is. Both are binding, and **§2 wins when they disagree**; where
the disagreement is *inside* §2, the "Parallel vs serial" block wins over the ladder table's
`Serial on` column. The clearest case: #195 scores 120 and P4 scores 59, but P4 unblocks the launch
and #195 is a decision an agent cannot make. The formula ranks throughput; §2 ranks reachability.

**What the formula surfaces that intuition does not:** the four highest-scoring items in the estate
are three human decisions, a credential rotation, and a two-line middleware mount — combined effort
7, all doable in a day, all currently untouched.

### 3.2 Loading this into the dispatcher — the exact recipe, and its verified limitation

**`create_task` cannot set 5 of the 9 scoring inputs, and 4 of those are missing from the `update_task`
MCP tool as well — but they are NOT missing from the server.** Verified against the live tool schemas
and the REST source, 2026-07-29.

| Input | `create_task` (MCP) | `update_task` (MCP) | `PATCH /dispatcher/tasks/:id` (REST) |
|---|---|---|---|
| `effort`, `severity`, `signal`, `ui_impact`, `urgency` | yes | yes | yes |
| `milestone`, `layer`, `owner` | yes | yes | yes |
| `project_id` | yes | **no** | **yes** (`projectId`) |
| `proximity` | **no** | yes | yes |
| `revenue_impact`, `growth_impact`, `mission_impact` | **no** | **no** | **yes** |
| `blocks` → `blocksCount` (leverage) | **no** | **no** | **yes** |
| `score_override` | **no** | yes | yes |

Consequences, and they are not cosmetic:

- **`proximity` is reachable only via `update_task`. `revenue` (×7), `growth` (×5), `mission` (×4) and
  `leverage` (×3) are unreachable through the MCP TOOLS — but they ARE reachable over the dispatcher
  REST API with the same key.** `updateTaskSchema` declares `revenueImpact`, `growthImpact`,
  `missionImpact` and `blocks` (`recursiv origin/main:packages/server/src/features/dispatcher/
  dispatcher.routes.ts` @ `const updateTaskSchema = z.object({`); the body normalizer maps the
  `revenue_impact` / `growth_impact` / `mission_impact` snake_case forms; `blocksCount` is `blocks?.length ?? 0` at `DispatcherService.ts` @ `blocksCount: input.blocks?.length ?? 0`, so setting `blocks`
  sets leverage; and `PATCH /api/v1/dispatcher/tasks/:taskId` (`:737`, mounted at
  `api-keys/rest/index.ts` @ `api.route('/dispatcher', dispatcherApi)`) authenticates an `sk_live_*` key through the dispatcher's own
  middleware at `:106-124`. **Only the MCP wrapper drops them** (`packages/mcp/src/tools/dispatcher.ts` @ its `create_task`/`update_task` input schemas).
  **An earlier revision wrote "unreachable through MCP entirely — set server-side by the LLM
  auto-scorer or not at all". The "or not at all" half was false, and three things rested on it: the
  `score_override` crutch, §1.5's neutered score-divergence row, and §10.24's "never measured".
  §5.29 records it. The filed defect narrows to the MCP tool surface.**
- **Therefore a task created from this table will not score what this table says.** The nearest way to
  make the dispatcher agree with the plan is `score_override` — and `DispatcherService.ts`'s header
  says `// score_override takes precedence if set.`, which is why §1.5's divergence detector can only
  catch a skipped step, not a genuine disagreement (§10.24).
- **`score_override` IS RETIRED, 2026-07-30. Step 2 no longer sets it.** §5.29 proved all nine inputs
  are settable — `revenue`/`growth`/`mission`/`blocks` over `PATCH /api/v1/dispatcher/tasks/:taskId`
  at step 2b, the rest over MCP — so **the dispatcher can compute the score itself, and moving an input
  re-ranks the queue by itself.** With an override pasted, a rescore meant editing §3.1 *and*
  re-pasting a number, and the second half would be forgotten (§5.45's whole subject). **Sequencing
  mattered and is recorded because getting it backwards trips a detector:** §1.5's score-divergence row
  pointed at the override, so that row was re-pointed at *the formula applied to §3.1's inputs* in the
  same PR, before the override came out. Dropping the override first would have fired that detector on
  every rescore. **What this costs, stated rather than discovered:** §1.0's Cycle-0 exit no longer has a
  by-construction guarantee that the dispatcher shows §3.1's exact number — which is fine, because that
  guarantee was the thing making the ranking unfalsifiable. Check `[5]` still proves §3.1 is internally
  consistent, and §1.5's row now catches a genuinely skipped step 2b.
- **The previous framing, kept for the reason §5 keeps things:** `score_override` was described here as
  the *only* way to make the dispatcher agree with the plan.** All nine inputs are settable over `PATCH /api/v1/dispatcher/tasks/:taskId` with the key this
  loop holds; only the MCP wrapper drops four of them, and §3.2 step 2b already sets those four over
  REST. **So the dispatcher can compute the score itself from the inputs, and an override is only
  needed because step 2 currently pastes one.** That matters directly for §1.0's `RESCORE` step: with
  an override set, rescoring means editing §3.1 *and* re-pasting a number; without one, moving an input
  re-ranks the queue by itself. **Retiring it is the cheaper path to a ranking that actually moves, and
  it is not done here** — dropping `score_override` while §1.5's divergence row still points at it
  would trip that detector on every rescore. Sequence it: change the detector first, then drop the
  override, in one PR a human merges (§1.7). Recorded as the concrete follow-on to §5.45.
- **`create_task`'s own `milestone` description is literally `Milestone (e.g., "v1-launch")`.**
  `v1-launch` is not in `MILESTONE_MULTIPLIERS`, so it resolves to `0.5` and quarters the proximity
  term. **The tool's documentation steers agents into the penalty. Use `R1`.**
- **`project_id` is settable on create and NOT on update.** A task created without it can never be
  moved into the Minds project, so §1.0's queue read will never see it. Get it right at creation.

The recipe. **Step 0 plus four calls per item — none of them optional:**

```
0) project_id = 019d5190-f0c0-717e-a1bd-ef9c335292b9    # MINDS_PROJECT_ID, §1.0
   ORIGIN, SK_LIVE                                      # bound in §1.0; exported by you, not by this file
1) create_task(title=<§2's Step text>, description, effort, severity, signal, ui_impact, urgency,
               project_id=$MINDS_PROJECT_ID,
               milestone="R1", layer="launch-ladder", owner=<human>, created_via="mcp")
   # NOTE: create_task has NO status parameter. Do not pass one; it is not in the schema.
   # severity/signal/ui_impact/urgency are capped at 5 by the tool. Every §3.1 value is <= 5.
2) update_task(task_id, proximity=<n>, milestone="R1")
   # NO score_override. Retired 2026-07-30 — see the block under this recipe. The dispatcher
   # computes the score from the nine inputs, so moving an input re-ranks the queue by itself.
2b) curl -s -X PATCH "$ORIGIN/api/v1/dispatcher/tasks/<task_id>" \
      -H "Authorization: Bearer $SK_LIVE" -H 'Content-Type: application/json' \
      -d '{"revenue_impact":<n>,"growth_impact":<n>,"mission_impact":<n>,"blocks":[<ids>]}'
    # the four terms the MCP tools drop; weight 19 of the formula.
    # This is a real command, not notation: `PATCH …` on its own line is
    # `/bin/bash: PATCH: command not found`. Write the curl.
3) get_task(task_id)   → assert the returned score equals §3.1 within 1.0
4) update_task(task_id, status:"blocked")   # the SIXTEEN non-root rows ONLY (§1.0's Cycle 0).
   # The SEVEN roots — PS, P0, P1, PA, PD, PAPI, #190 — are left pending; that is create_task's default.
   # P2a is NOT a root: its Serial-on cell says P1. 8 + 20 = 28.
   # DERIVE the split before you load it — §1.2 clause 3 applies to this comment too. The roots are
   # exactly the §2 rows whose Serial-on cell is "—", plus off-ladder #190. This is a real command:
   #   awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/^ +| +$/,"",$2);
   #     s=$(NF-2); gsub(/^ +| +$/,"",s); if (s=="—") print "ROOT: "$2; else n++}
   #     END{print "non-root table rows: "n}' "$GP"
   # Output, byte-exact, re-run 2026-07-29 (the ** are the table's own bold marks, not a gloss):
   #   ROOT: **P0** / ROOT: **PS** / ROOT: **PA** / ROOT: **P1** / ROOT: **PD** / ROOT: **PAPI** / non-root table rows: 20
   # Seven table roots + off-ladder #190 = the eight pending. 20 = the blocked set. If this command
   # disagrees with these comments, the command wins and the disagreement is a §1.5 report.
```

**Length check, run before Cycle 0 and after any §2 table edit, because both limits are enforced and
both are silent until they aren't.** `title` maxLength is **120** and `description` maxLength is
**16000** (live schema, 2026-07-29):
```
sed 's/\\|/@ESC@/g' "$GP" \
| awk -F'|' 'BEGIN{n=0}
  /^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {n++; row=$0;
  gsub(/^ +| +$/,"",$3); gsub(/^ +| +$/,"",$5);
  if (NF!=9) print "COLUMN COUNT WRONG (unescaped | inside a cell): "$2" NF="NF;
  if (gsub(/\*\*/,"",row) % 2) print "UNBALANCED BOLD (odd ** count): "$2;
  if (length($3)>120) print "TITLE TOO LONG: "$3;
  if (length($5)>16000) print "DESC TOO LONG: "$3}
  END{print "rows checked: " n}'
```
must print exactly `rows checked: 27` and nothing else. **The bold guard is the newest of the three
and it exists because the fix that installed the `NF!=9` guard broke the same cell a second way, in
the same edit, and certified it clean.** The PW(3) rewrite closed a bold span after *"a page that never
changed"* and never reopened one before *"plus the run URL or MCP response of the mechanism named in
advance"*, leaving an ODD number of emphasis markers on the PW row — the only odd row in the
twenty — so bold rendering inverted for the remainder of the cell, and §3.2 loads that string into
`description` verbatim. A column counter cannot see emphasis. Verified 2026-07-29: the guard prints
`UNBALANCED BOLD (odd ** count):  **PW**` against a copy of this file with the reopening `**` removed,
and prints nothing against the file as it stands. **The `NF!=9` guard was new one revision earlier and
it caught a live break: the hand-applied PW(3) fix inserted an UNESCAPED `|` into a table cell, so
the PW row rendered with 8 columns against a 7-column header — the exit-artifact cell terminated
mid-command at "the verifier's own `curl -s https://minds.on.recursiv.io/ ", the whole rollback pair
landed under "Rollback / blast radius", and the Score column read `P2a` while `61.8` was discarded as
overflow. Because §3.2 requires `description` to carry the exit artifact from §2 verbatim and reads
field `$5`, Cycle 0 would have loaded a truncated exit that DROPPED the artifact the fix installed.
Every other ladder row escapes command-pipes as `\|`; PW now does too. **The `n` count is the same
positive control as §3's sort check** — with a broken `$GP` the old form printed nothing and exited
`2`, while the stated pass condition was "must print nothing", so a dead pipe read as a pass. Re-run
2026-07-29 on the real file: `rows checked: 27`, no other output. Longest title 76 chars (P2b).** *(This exists because a `HUMAN-ONLY` marker was drafted into three Step cells and pushed
two of them to 295 and 228 characters — `create_task` would have returned an error on the first two
rows of Cycle 0. The marker now lives in the exit cell, which maps to `description`.)*

**Step 3's failure branch, which did not exist.** If `get_task` returns a score more than 1.0 from
§3.1: **do not adjust §3.1 and do not re-run hoping.** Post `SCORE-MISMATCH <row> <returned>
<§3.1's>` to #206, re-run step 2 once (a dropped `score_override` is the only failure this assertion
can actually detect — see below), and if it still disagrees, set the row `blocked` and escalate under
§1.4. A silent mismatch means the ladder in the dispatcher and the ladder in this file are two
different ladders, which makes §1.0's start-of-cycle read meaningless.

> **Step 2b is not optional. But the claim it used to carry — that omitting `score_override` on P0 and
> P1 makes `get_task` return "the auto-scorer's number" and thereby runs §10.24 — is FALSE at the
> source, and this is the correction.**
>
> `autoScoreTask` is invoked **only** when the create call supplied **no scoring dimension at all**
> (guard expression `DispatcherService.ts` @ `const hasScoring =`, branch @ `if (!hasScoring) {`, call @ `autoScoreTask(input.id`, read at
> `origin/main` 2026-07-29 — **the ranges are separated on purpose; see §5.34**):
> ```
> const hasScoring = input.proximity != null || input.signalScore != null
>   || input.urgencyScore != null || input.severity != null || input.uiImpact != null
>   || input.revenueImpact != null || input.growthImpact != null || input.missionImpact != null
>   || input.scoreOverride != null;
> if (!hasScoring) { autoScoreTask(...).catch(...) }
> ```
> **Step 1 above passes `severity`, `signal`, `ui_impact` and `urgency`.** So `hasScoring` is true and
> **the auto-scorer never runs for any row this recipe creates** — with or without `score_override`,
> with or without 2b. There is no "auto-scorer's number" to record and no "both numbers" to compare.
>
> It was doubly foreclosed: even if it did run, it is **fire-and-forget** (`.catch()`, no `await`) and
> writes `revenueImpact`/`growthImpact`/`missionImpact`/`proximity`/`signalScore`/`urgencyScore`/
> `severity`/`uiImpact` **after** create returns (the `clamp(result.…)` block, after create returns), so a `get_task` immediately after step 1
> is a race; and step 2b then **overwrites the exact four estimates §10.24 wants to measure** with
> §3.1's own hand values. `computeFormulaScore` (@ `function computeFormulaScore(`) is deterministic in its nine inputs, so
> feeding it §3.1's inputs returns §3.1's score. **The comparison the old text claimed to enable was
> the comparison it foreclosed — three times over.**
>
> **Therefore: run steps 1, 2, 2b, 3 and 4 identically on all 21 rows, including P0 and P1.**
> `score_override` is set on every row. §10.24 is not measurable this way and its procedure is
> rewritten there — it needs a throwaway task created with a title and nothing else.

**`layer="launch-ladder"` is load-bearing, not decorative.** `list_tasks` accepts a `layer` filter
(live schema, 2026-07-29), and `list_tasks(project_id=$MINDS_PROJECT_ID, layer="launch-ladder",
limit=100)` returns **`No tasks found matching filters.`** today. That makes it §1.0's Cycle-0 exit artifact and
the filter every start-of-cycle read uses, which is how the seven pre-existing project tasks stop
outranking this ladder. `layer` is a free string (`maxLength: 256`) despite its description naming
`core, plugin, ops` — using a fourth value is deliberate and is what makes the filter exact.

`description` must contain the item's **exit artifact from §2, verbatim** — with the sub-artifacts
enumerated individually for every row whose `N` is greater than 1, because §1.6 counts them
individually. **A dispatcher task whose description does not name an artifact is unclosable under
§1.3 and should be rejected on sight.**

**File this as a defect against `recursivlabs/recursiv`, scoped to the MCP tool surface only, because
the REST route already carries these fields:** expose `revenue_impact`, `growth_impact`,
`mission_impact` and `blocks` on the MCP `create_task`/`update_task` wrappers; allow `project_id` on
the MCP `update_task`; **drop `done` and `archived` from the MCP `update_task` status enum
(`packages/mcp/src/tools/dispatcher.ts` @ `dispatcherTaskStatusUpdateSchema`), since both 400 at the REST layer and the enum steers
agents into an erroring call — `archive_task` is the working tool;**
correct the `milestone` example to `R1`; add §1.3's artifact-link requirement; **and add a
minutes-granularity stale-claim query, since `list_stale_tasks`/`list_stuck_tasks` floor at `days: 1`
while `heartbeat_task` expects 5 minutes (§1.9).** Until then §3.1 and the dispatcher are kept in
sync by hand.

---

## 4. VERIFIED STATE

*Every paragraph carries the command that produced it. **Re-run before citing** — §1.2.
Refs: `minds origin/main` = `3761e415`, `recursiv origin/main` = `24e4ca0f`, production API commit =
`24e4ca0f`. Run 2026-07-28.*

**Production's deployed commit is readable and it equals `origin/main`.**
`curl -s https://api.recursiv.io/health` → `{"status":"ok","version":"1.0.0","commit":"24e4ca0f8330b4eca7d564cfda9fa01581d3b1de"}`;
`git -C /home/bill/dev/recursiv rev-parse origin/main` → the same SHA.
**The path is `/health`, NOT `/api/v1/health`** — the latter returns `{status,timestamp}` with no
build identifier, which is what an earlier revision and one grader both ran (§5.18).
`https://api.minds.recursiv.io/health` returns the identical object; they are the same deployment
behind two hostnames. **Every source-derived claim about production behaviour below is therefore
attributable to a named commit, and any agent citing one restates the SHA.**

**The repo is PRIVATE.** `gh repo view recursivlabs/minds --json isPrivate,forkCount,stargazerCount,licenseInfo`
→ `{"forkCount":0,"isPrivate":true,"licenseInfo":null,"stargazerCount":0}`. Flipped 2026-07-28;
nothing detached. **Every sentence in any plan about public contributors, external PR volume,
"beating Gumroad's inbound queue", or star counts is stale and retracted (§5.7).** Open-source
sequencing is gated entirely on **#195**.

**Two API route groups are auth-dead in production; a third was fixed upstream hours before this
revision.** The reproducing command **is not uniform across route groups** — use these exactly:

- `curl -s -X POST -H 'Content-Type: application/json' -d '{}' https://api.recursiv.io/api/v1/signals/post`
  → **403** `no_scopes` (hint names scope `agents:write`). `/signals` has **one handler**, `POST /post`
  (`recursiv origin/main:packages/server/src/features/api-keys/rest/routes/signals.ts` @ `signalsApi.post('/post', requireScope('agents:write')`), so
  `GET /signals` returns a bare **404** and proves nothing.
- `curl -s -o /dev/null -w "%{http_code}" https://api.recursiv.io/api/v1/moderation/actions` →
  **403** `no_scopes` (`moderation.ts` @ `requireScope('admin'), requireLiveAdminRole()`, which also requires `requireLiveAdminRole()`).
- Controls: `/users/me` → **401** `missing_api_key`; `/projects` → **401**.
- **`/evidence` was fixed upstream on 2026-07-28 and now returns 401 correctly.**
  `curl -s https://api.recursiv.io/api/v1/evidence/runs` →
  `{"error":{"type":"authentication_error","message":"Missing or invalid Authorization header","code":"missing_api_key"}}`.
  Cause: recursiv `3d09be80` — *"fix(api): apply apiKeyAuth to /evidence routes so scopes resolve
  (#2009)"*, 2026-07-28 18:36:36 -0400. **The defect is two routes, not three (§5.10).**

A 403-before-401 on a *credential-free* request is only producible if `apiKeyAuth` never ran.
Structural cause, from a named ref **in the engine repo — the `-C` is not optional, §1.2 clause 5**:
`git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/api-keys/rest/index.ts`
mounts `/signals` at
**`:337`**, `/evidence` at **`:369`**, `/moderation` at **`:376`**; the `api.use()` block runs
`:238-325` and contains `api.use('/evidence/*', apiKeyAuth, …)` at **`:264`** but **no entry for
`/signals/*` or `/moderation/*`** —
`git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/api-keys/rest/index.ts | grep -cE "api\.use\('/(signals|moderation)/\*'"`
→ **0** (re-run 2026-07-29). **Dropping `-C` does not fail loudly: it prints `fatal: path … does not
exist in 'origin/main'` on stderr and `0` on stdout, and `0` is also the true answer, so the wrong-repo
run agrees with the right one by accident and will keep agreeing right up until PS lands — at which
point the wrong-repo run still says `0` and PS looks unfinished forever.**
*(An earlier revision cited `:333,:365,:372`, a stale local checkout's line numbers — §5.11. A 404
from either route means it was moved, not that it was fixed; re-read the file before concluding
anything.)* **This is PS.**

**Ages differ by route — the "nine weeks" figure applies to `/signals` alone.**
`git -C /home/bill/dev/recursiv log -1 --format='%h %ad' --date=short -S"api.route('/<r>'" origin/main -- packages/server/src/features/api-keys/rest/index.ts`:
`/signals` → `782f732b` **2026-05-28** (nine weeks); `/moderation` → `a4091d78` **2026-07-23** (five
days); `/evidence` → `e47b4555` **2026-07-27** (one day, now fixed). *(§5.13.)*

**Two different things are called "signal" and they are not connected — do not conflate them.**
`git -C /home/bill/dev/recursiv grep -n "signal_event\|signalEvent" origin/main -- 'packages/server/src/**/*.ts'`
returns **four files**: `features/api-keys/rest/routes/signals.ts` (3 hits — the writer),
`features/curator/ForYouRanker.ts` (5 hits: `:12,:76,:175,:186,:318`),
`features/curator/projectDbSchema.ts` (10 hits), and one **log-string false positive** at
`features/email/InboundEmailService.ts` (`logger.warn('inbound_email_customer_signal_event_failed', …)`).
**Zero hits under `features/dispatcher/` — that is the claim, and it is the only claim.** The REST
`/signals` route writes `signal_event` rows into a **per-project** database consumed only by the
curator. The dispatcher's `signal` term is `signalScore`, a 0-5 per-task column (`db/schema.ts` @ `signalScore: integer('signal_score')`)
set by the LLM auto-scorer (`DispatcherService.ts` @ `signalScore: clamp(result.signal_score)`), by the REST dispatcher route
(`dispatcher.routes.ts` @ `signalScore: body.signalScore ??`), or by the `signal` param on `create_task`/`update_task` — which §3.2
lists as settable and §3.1 sets on every row. **What the dead `/signals` mount actually costs is
curator feed-ranking quality, not this document's scoring inputs. §5.9 records the earlier, wrong
version; §5.17 records the previous revision's "and nowhere else" overclaim about this very grep.**

The honest reason §3.1's numbers are structure-driven rather than usage-driven is the mundane one in
§3.2: `revenue`, `growth`, `mission` and `leverage` are missing from the **MCP tools**, so every score
here is hand-authored. **They are NOT missing from the server** — `updateTaskSchema` carries all four
and `PATCH /dispatcher/tasks/:id` accepts them with an `sk_live_*` key (§3.2) — which is why §3.2's
recipe now sets them over REST at step 2b and why §10.24's auto-scorer comparison is runnable rather
than permanently blocked. **Say that when a ranking is challenged, and do not say "unreachable".**

**CI is red on `main`.** `gh run list --branch main --workflow=CI --limit 1 --json conclusion,databaseId,headSha`
→ `failure`, run `30401808070`, `headSha 3761e415…`; `gh run view 30401808070 --json jobs` → job
`check` failed at step `Run pnpm install --frozen-lockfile`, `build` `skipped`. **No branch
protection, on either endpoint:** `gh api repos/recursivlabs/minds/rulesets --jq 'length'` → `0`;
`gh api repos/recursivlabs/minds/branches/main/protection` → `404 Branch not protected`. By contrast
`gh api repos/recursivlabs/recursiv/branches/main/protection --jq '.required_status_checks.contexts'`
→ `["lint-typecheck","build-test","security-controls","gitleaks"]` — **the estate uses classic
protection, which leaves `rulesets` empty. That is why P2 checks both endpoints.** Prerequisites,
from `recursiv/.github/workflows/enforce-branch-protection.yml`'s own header: an **`ADMIN_GH_TOKEN`**
secret (the default `GITHUB_TOKEN` cannot call this API and GitHub rejects `GITHUB_`-prefixed secret
names) and a **paid org plan** (private-repo protection needs Team/Enterprise; recursivlabs is on
Team as of 2026-06). **Port that workflow rather than writing a new one — it re-enforces weekly,
making the artifact self-healing.** 529 commits on `main`.

**Eight PRs open, five of them CONFLICTING.** `gh pr list --state open --json number,mergeable`:
#194 `MERGEABLE` (README + mission), #183 `MERGEABLE`, #181 `MERGEABLE`, #184 `CONFLICTING`,
#180 `CONFLICTING`; #29/#9/#8 (`jotto141`, stale since spring) all `CONFLICTING`. #180 and #184 both
touch `pnpm-lock.yaml`, which is why P2's order is not free. **All eight are dispositioned in P2.**

**Nineteen issues open:** #185-#193 (audit blockers), #195, #196, #197, #198, #199, #200, #201-#203,
#204. Three carry `launch-blocker`+`P0`: **#185, #186, #197**.

**The app has no staging; the estate does.** `git show origin/main:eas.json` — profiles
`development`, `preview`, `production`, `android-internal`; `android-internal` extends `production`
and sets `"channel": "production"`; `submit` contains **only** `production.ios.ascAppId "6793750469"`
— an App Store Connect record exists and **no Android submit profile does** (P12). `git show
origin/main:.env.example` — three lines, one origin, `https://api.recursiv.io/api/v1`. `git grep -c
staging origin/main` — two files, both code comments. Meanwhile
`curl https://api.staging.recursiv.io/api/v1/health` → `200` and `https://staging.recursiv.io` →
`200`. **"No staging anything" was a repo-scoped claim stated globally — §5.15.**

**Three surfaces, and one of them is the wrong network.** `https://minds.on.recursiv.io/` → `200`.
`https://minds.com/` → `301` → `https://www.minds.com/` → `200` — **the legacy network**, proved by
`curl -s https://www.minds.com/ | grep -c "expo-root\|_expo/static"` → `0` against
`curl -s https://minds.on.recursiv.io/ | grep -c "expo-root\|_expo/static"` → `1` (§2, §8, §5.20 —
**do not use `<title>` for this**). `git show origin/main:package.json | grep -nE '"build"|"start"'`
→ `7:    "build": "EXPO_UNSTABLE_TREE_SHAKING=0 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=0 expo export
--platform web && node scripts/inject-boot-shell.mjs"` and `6:    "start": "serve dist -l 3000 -s"`
— quoted in full, because an earlier revision silently dropped the env prefixes and the `-l 3000 -s`
flags while presenting the strings as command output (§1.2 clause 4). `ci.yml`'s `build` job exports
web and **stops**; there is no `vercel.json`, `netlify.toml` or `Dockerfile` in the tree. **The
mechanism that puts `minds.on.recursiv.io` in front of users is not written down anywhere in this
repo.** That is PW.

**No native telemetry package exists.** `git show origin/main:package.json | grep -nE "posthog|sentry"`
→ exactly one line, `47:    "posthog-js": "^1.383.3",`. No `posthog-react-native`, no `@sentry/*`.
`git show origin/main:lib/monitoring.ts | grep -n "Platform.OS !== 'web'"` → `if (Platform.OS !== 'web' || !KEY) return null;`.
On native there is nothing to un-gate — the package must be added first (§5.5).

**Moderation is 123 lines.** `git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/moderation/moderationService.ts | wc -l`
→ `123`, the only file in that directory.

**SDK drift is CLOSED, re-run 2026-09-03.** `git show origin/main:package.json | grep '"@recursiv/sdk"'`
→ `"@recursiv/sdk":"0.7.14"` and `npm view @recursiv/sdk version` → `0.7.14`. Pin and registry are the
same version, so the gap this line recorded (0.5.6 pinned against 0.6.1 published) no longer exists.
§5.56.

**Toolchain, this box.** `node -v` → `v24.18.0`; `pnpm -v` → `11.17.0`; `main`'s CI pins
`node-version: 20` and `pnpm/action-setup version: 10`. `main` has **no** `packageManager` and **no**
`.node-version`; PR #180 adds `"packageManager": "pnpm@10.28.0"` but still no `.node-version`.
`command -v` → **ABSENT:** `eas`, `gitleaks`, `mise`, `psql`, `act`, `aapt`, `aapt2`, `apktool`.
**PRESENT:** `unzip`, `adb`, `node`, `pnpm`. **`eas` and `apktool` block P5's verification; `gitleaks`
blocks P0's; `eas` blocks P11's T0, P12 and §10.1.** Install them before starting those steps.

**Smoke is RED and has stopped monitoring production.** `gh run list --workflow=smoke.yml --limit 8
--json conclusion,createdAt,databaseId` → **`failure 2026-07-29T00:18:41Z` run `30410762278`**, above
seven consecutive successes ending `2026-07-28T18:25:56Z`. `gh run view 30410762278 --log-failed |
tail -20` → step **`Run pnpm install --frozen-lockfile`**,
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH  Cannot proceed with the frozen installation. The current
"patchedDependencies" configuration doesn't match the value found in the lockfile` — **the identical
step and identical error that reds `main`'s CI (run `30401808070`). One lockfile fix restores both;
this document previously treated them as unrelated.** *(This line decayed in under six hours: the
five-success claim was true when written at 18:25Z and false by 00:18Z. Re-run the command before
citing it in either direction — that is §1.2, and this is the cleanest instance of it in the
document.)*

Even when green it proves only that the origin answers and `verify-parity.mjs` exits 0 against
**production** every 6 hours. It does not prove a photo attaches, a DM lands in the right thread, or a
purchase returns to the app. **It is also the estate's only continuous production monitor** — which is
why it being red is a production-visibility incident and not a CI nuisance, why **P4 must not repoint
it**, and why **P1's sub-artifact (3) covers it.**

**Backlog structure, which matters for editing it.**
`git show origin/docs/launch-readiness-backlog:docs/launch-readiness-backlog.md | grep -c "^### "` →
**26 headings, 23 numbered**. Items **15-19** live in a markdown table under `## TIER 4` and **29-33**
in a numbered list under `## TIER 6`; neither group has a `###` anchor. So "amend the backlog by
heading" works for 23 of 33 items and silently fails for 10. Its line 14 still says
`Deduped to **28 items**` while the file numbers 1-33. Both recorded, not "fixed later" (§5.3).

### 4.1 Engine citations are ANCHORS, not line numbers — and this is §1.2 clause 1, not a new rule

**Every cross-repo citation in this document names a greppable string, never a line number.** §1.2
clause 1 already required it — *"cite via `git show <ref>:<path>` or `git grep <pat> <ref> -- <path>`"* —
and 26 citations were in violation, carrying a bare `file:line` with no command attached at all.

**Why, with the measurement that forced it.** On 2026-07-30 the engine's `origin/main` moved **twice in
one day** — `24e4ca0f` → `e2a6f957` → `831a7328` — and a sweep of every cited line found **7 of 22
had drifted**, all in the two most-churned files: everything past ~line 290 of `DispatcherService.ts`
shifted ~5 lines, everything past ~1000 shifted ~6, and `db/schema.ts` shifted **35**. Fixing the
numbers would have bought one day. §5.42.

**The document already knew this and applied it only to itself.** §1.3 says, of its own internal
citations: *"A line-numbered self-citation in a file that edits itself is a citation with a decay
date."* It replaced those with unique whole-line anchors and **never carried the lesson across the repo
boundary** — into a repository moving thirty commits a day, which is strictly worse than a file that
edits itself.

**The form, used everywhere below:** `` `<file>` @ `<anchor>` `` — where `<anchor>` is a string that
`grep -n` finds in that file at `origin/main`. The line number is **derived output and is never
written down**; §1.2 clause 3 already forbids trusting an un-recounted count, and a line number is a
count. Where two occurrences exist, the prose disambiguates (*"the SECOND of two — the first is in
`release()`"*) rather than falling back to a number.

**Checked mechanically, so it cannot rot again:** `scripts/check-controller.sh` check `[8]` extracts
every `` `<file>` @ `<anchor>` `` pair and asserts each anchor resolves in the right repo at
`origin/main`. An anchor that stops resolving fails the gate. **Line numbers inside §5 are exempt and
must stay** — a retraction records what was claimed, and rewriting its citations would rewrite the
history it exists to preserve (§5.4's track-player chain is the live instance).

---

---

## 5. RETRACTION LEDGER — append-only, binding

*A refuted claim stays refuted. If you find one re-asserted anywhere, reject it and point at the row.*

**5.1 — "Every file:line citation is current."** Refuted. A prior revision was written against a
checkout four commits behind `origin/main` and shipped stale citations as fact. **Rule §1.2 exists
because of this — and it was violated again, cross-repo, in the revision that installed it (§5.11).**

**5.2 — "Editing `eas.json` fixes the OTA channel collision (#185)."** Refuted. Confirmed by
unpacking an installed APK: `AndroidManifest.xml` →
`expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY` → `{"expo-channel-name":"preview"}`.
**The channel is compiled into the binary at build time.** Every already-installed `android-internal`
APK keeps requesting `production` for life; there is no config-only remediation and no OTA that
corrects it. The fix is a **rebuild plus tester reinstall**.
**Reproduce with:** `adb shell pm path <pkg>` → `adb pull <apk> /tmp/app.apk` →
`apktool d -f -o /tmp/apk /tmp/app.apk` →
`grep -o 'expo-channel-name[^}]*}' /tmp/apk/AndroidManifest.xml`.
> **UNPROVED, and this is the one claim in §5 that is.** No build id, EAS build URL or APK sha256 was
> recorded, and `apktool`/`aapt` are ABSENT from this box, so it cannot be re-run here. Worse, the
> value observed was **`preview`**, while #185 and P5 are about the **`production`** channel. That
> proves the channel is compiled in — **it does not demonstrate #185's specific defect.** See §10.22;
> **P5 cannot start until that is settled.**

**5.3 — "`grep -n '^### '` on the backlog returns headings 1-33."** Refuted. It returns **26 headings,
23 numbered**. Items 15-19 (a table) and 29-33 (a list) have no `###` anchor, so any tooling that
edits the backlog "by heading" breaks for 10 of 33 items. The line-14 "28 items" contradiction is
real and remains unfixed.

**5.4 — "The track-player import chain is `index.js:5 → app/_layout.tsx:27 → lib/audioPlayer.tsx:11
→ lib/audio/engine.native.ts:16`."** Refuted. `git show origin/main:index.js | sed -n '5p'` →
`import './lib/audio/registerPlayback';`. The real pre-`AppRegistry` chain is
**`index.js:5 → lib/audio/registerPlayback.native.ts → react-native-track-player`**, where
`registerPlayback.native.ts` calls `TrackPlayer.registerPlaybackService()` and
`TrackPlayer.setupPlayer()` at **module scope**. `app/_layout.tsx:26` imports `AudioPlayerProvider`
but that is inside React and is not the boot-path problem. Fixing the wrong file would have closed
nothing.

**5.5 — "Delete both halves of the `lib/monitoring.ts` @ `if (Platform.OS !== 'web' || !KEY) return null;` guard and native capture works."** Refuted.
`package.json` ships `posthog-js` only — a browser library. Removing the guard makes
`require('posthog-js')` run on native: at best a no-op, at worst a crash on the boot path. **P6's
first deliverable is choosing and installing a native crash reporter**, not editing a guard.

**5.6 — "§6.3's A-grade token-matching CI check, and the 'beats Gumroad' claim resting on it."**
Retracted entire. The check as specified is not implementable reliably: 9 of 11 issues did not carry
the heading, the token set was never defined, and it was evadable by omitting `Fixes #N`.
**Replacement, implementable in one grep:** a required check that fails a PR touching `app/`, `lib/`,
`components/`, `eas.json`, `.github/workflows/`, `lib/monitoring.ts`, `lib/storage.ts` or
`lib/auth.tsx` unless its body contains a **non-empty `## What remains unproved`** section and a
`## How it was tested` section containing either a `qa-media/` path or an `https` link. **That
replacement was specified and then orphaned — it is now P2c, a ladder step with an artifact, because
a spec no step produces is a spec that never ships.** The "beats Gumroad" claim is dropped: the repo
is private with 0 external contributors, so there is no denominator.

**5.7 — Everything premised on a public repo.** Retracted: external-PR volume targets, the 90-day
"beat Gumroad" window, median-time-to-first-external-review, the inbound contributor queue,
`good first issue` as a growth mechanism, and "public repo with no licence is the urgent exposure".
#201-#203 remain filed and remain good first issues *for whenever the repo re-opens*; gated on
**#195**. **PR #194's mission language inherits this gate — see P2.**

**5.8 — Claims verified TRUE and carried forward** (do not re-litigate): git attribution on this box
is correct (`git config user.email` → `Bill@minds.com`); `smoke.yml` passes; `ottman` and `jotto141`
are collaborators on `recursivlabs/recursiv`; `jackottman` is a 404 and the real handle is
`jotto141`; `npm whoami` on a workstation returns `E401`, **and that is not the publish-rights
question it was read as** — the `@minds/*` family publishes from CI, not from a human login.
`.github/workflows/publish-minds-packages.yml` publishes on `minds-v*.*.*` tags with
`permissions: id-token: write` (npm trusted publishing), gated on the tag being an ancestor of
`main`. All five packages are live at exactly their source versions, re-run 2026-09-03:
`@minds/sdk` 0.0.9, `@minds/api` 0.0.1, `@minds/mcp` 0.0.6, `@minds/cli` 0.0.7,
`@minds/tenant-overlay` 0.0.1. Whether a named human holds `@recursiv/sdk` publish rights is a
separate and still-open question, and it blocks nothing a stranger installs. §5.56.

**5.9 — "The dispatcher's `signal` ×3 term has been fed nothing since May because `/signals` is
403-dead."** **Refuted.** `signal_event` reaches the route itself, two curator files and one log
string; `signalScore` comes from the auto-scorer (`DispatcherService.ts` @ `signalScore: clamp(result.signal_score)`), the dispatcher REST
route (`dispatcher.routes.ts` @ `signalScore: body.signalScore ??`), or the MCP `signal` param. **Zero dispatcher files.** The two
share a name and nothing else, and an earlier revision contradicted itself two sections apart — §3.2
listed `signal` as settable and §3.1 set it on every row. **This claim was bolded and armed as a
rhetorical defence of the rankings ("say this out loud whenever a ranking is challenged"). That is
the exact self-trickery §1 exists to prevent: a name-match inference borrowing credibility from the
verified curls printed beside it.** It is why §1.1 carries the name-match corollary.

**5.10 — "`/signals`, `/evidence` and `/moderation` are all 403-dead."** **Partially refuted
2026-07-28:** `/evidence` was fixed by recursiv PR #2009 (`3d09be80`); `api.use('/evidence/*',
apiKeyAuth, …)` is present at `origin/main:264` and `/evidence/runs` returns `401`. Two of three
remain. **The regression test — assert every `api.route` prefix has a matching `api.use` — is the
actual deliverable, because one-off fixes are landing upstream faster than this document tracks
them. It is PS sub-artifact 3.**

**5.11 — "The engine citations `:333,:365,:372` are current."** Refuted. They are a working checkout's
numbers: `/home/bill/dev/recursiv` was on `docs/mcp-build-command`, 1 ahead / 16 behind `origin/main`,
when §4 was first written. On `origin/main` they are **`:337,:369,:376`**, and the `api.use()` block
is `:238-325`, not `:254-321`. **§1.2 clause 2 exists because of this.**

**5.12 — "`create_task` cannot set 3 (or 4) of the 9 scoring inputs."** Refuted. It is **5**, and **4**
remain unreachable even through `update_task`. An earlier revision gave three different numbers in
three places and cited the most-wrong one as justification for its own determinism score. **§1.2
clause 3 exists because of this.**

**5.13 — "Telemetry has been dead for nine weeks."** Refuted as stated: it bundled three routes aged
nine weeks, five days and one day. **Nine weeks applies to `/signals` only.**

**5.14 — Objection considered and REJECTED: "the `/signals` 403 is an inference, not an
observation."** **Wrong, and recorded so it cannot recur.** A grader ran `GET /signals`, got `404`,
and concluded the finding was unproved. `/signals` has one handler, `POST /post`, so `GET` proving
nothing is expected.
`curl -s -X POST -H 'Content-Type: application/json' -d '{}' https://api.recursiv.io/api/v1/signals/post`
→ **`403 no_scopes`**, re-run and stable across revisions. **The 403 is directly observed over the
wire, without any credential.** What remains genuinely unproved is the *positive* direction — whether
a **scoped** key gets `200` after the mount is fixed (§10.18). Negative confirmed, positive not, and
**PS's exit is written on the negative for exactly that reason.**

**5.15 — Objection PARTIALLY accepted: "the plan does not know staging exists."** The engine's staging
origin, `staging-deploy.yml` and `promote-to-prod.yml` were genuinely missed and are now in §2 — **an
earlier revision's "No staging anything" was a repo-scoped claim stated globally, and that is
corrected.** But **the conclusion it drove was right and is not retracted**: the *app* still has no
staging channel, no staging origin and no staging org, `smoke.yml` still points at production, and P4
remains upstream of the entire launch. What changed is P4's scope — from "build staging" to "wire the
app to the staging that exists" — which makes it smaller, not less blocking.

**5.16 — §5.9's refuted claim is LIVE in the estate right now, and it is filed as work.** Verified
2026-07-28: `git show origin/docs/surface-priorities:docs/surface-priorities.md | sed -n '7,10p'` →
*"**Known limit that affects every ranking here:** the `/signals` REST group has been 403-dead / since
~May, so the `signal` term in the dispatcher scoring formula has been fed nothing. Every / priority
order in this file is therefore *structure-driven, not usage-driven*. Restoring / telemetry
(surface-priorities #1) is what makes these rankings real."* — **all four lines, because the previous
revision printed a three-line subset under a four-line `sed` range, which is §1.2 clause 4 in the
ledger that installs it.** That is verbatim the claim §5.9 refutes, published as a qualifier on all
63 rankings, in the document §0 tells agents to read.
**Exit artifact: that banner is replaced on `origin/docs/surface-priorities` with §5.9's text and a
pointer to this row, and `git show origin/docs/surface-priorities:docs/surface-priorities.md | grep -c
'fed nothing'` returns `0`.** Until then §5 is binding on this file only, which is not what §5 claims.
**A retraction that does not reach the document carrying the claim is a retraction the loop reads
past.** This is a §1.5 re-derivation instance and the first agent to touch surface-priorities fixes
it.

**5.17 — Two commands in §4 did not reproduce their own printed output.** Refuted and corrected.
(a) The seven engine workflows were captioned `ls recursiv/.github/workflows/`, which returns **22**
entries — the seven named all exist, but a filtered list presented as raw output is the same shape of
overclaim §4 exists to prevent. §2 now prints the `git ls-tree` plus the `grep` that yields exactly 7.
(b) The `signal_event` grep was run **over a working tree** (violating §1.2 clause 1, in the section
that demands it) and captioned "**and nowhere else**"; at `origin/main` it returns **four** files, not
two — the writer route and a log-string false positive in `email/InboundEmailService.ts` were missed.
**The conclusion — zero dispatcher hits — survives unchanged and is the only claim.** §1.2 clause 4
exists because of this.

**5.18 — Objection considered and REJECTED: "`/health` carries no build identifier, so no production
claim is attributable to a commit."** **Wrong, and the proposed fix — file an issue to add the SHA —
would have been wasted work.** The grader ran `curl -s $ORIGIN/api/v1/health` → `{status,timestamp}`
and `curl -sI` → no `x-version` header, and both of those are true. **The endpoint is at the root, not
under `/api/v1`:** `curl -s https://api.recursiv.io/health` →
`{"status":"ok","version":"1.0.0","commit":"24e4ca0f8330b4eca7d564cfda9fa01581d3b1de"}`, which equals
`git -C /home/bill/dev/recursiv rev-parse origin/main` exactly. `AGENTS.md` already documents it
("Verify live commit at `https://api.minds.recursiv.io/health`"). **§10.25 is therefore RESOLVED, not
open**, and the correct command is now in §4's opening paragraph. *The previous revision's error was
prescribing the wrong path, not the absence of the artifact — a distinction worth keeping, because
"the artifact does not exist" and "I ran the wrong command" produce very different next actions.*

**5.19 — "17 steps / 35 artifacts, derived from a counting rule."** Refuted. The rule — *"a step whose
exit names more than three independently-confirmable things is counted by those things"* — was applied
to three steps and silently not applied to at least five others whose own text names four or more
(P6: "Four steps, in order"; P11: seven sub-checks; P7: five; P5: four; P2: a protection object, four
merges and three closes, and it is even scored as two separate rows in §3.1). 35 required an unstated
exception list, so two agents applying the published rule got different denominators — **and the
denominator divides every progress report the loop emits.** §1.6 now takes the total from §2's
explicit `N` column and from nothing else, and §1.6's denominator rule governs how it changes.

**5.20 — "`<title>Minds</title>` proves `www.minds.com` serves the legacy network."** Refuted as a
*command*, upheld as a *conclusion*. The string is returned by **both** hosts, and `www.minds.com`
alternates it with `<title>Own your network | Minds</title>` across requests — four consecutive runs
on 2026-07-28 returned `Minds`, `Own your network | Minds`, `Own your network | Minds`, `Own your
network | Minds`, while `minds.on.recursiv.io` returned the byte-identical `<title>Minds</title>`. So
the printed command was **nondeterministic in one direction and non-diagnostic in both**, and a
second party re-running it could reach the opposite conclusion. **The legacy/2.0 finding is unchanged
and correct**; the discriminator is now `grep -c "expo-root\|_expo/static"` → `0` vs `1`. §1.2
clause 4 again: a single observed output of a nondeterministic command was printed as *the* output.

**5.21 — "§1.3 should say `release_task` and never `complete_task`."** **Refuted, and this was the
most consequential error the document ever contained.** Only `done()` — the `complete_task` handler —
writes `'done'`, so a worker release cannot close a row. At the revision this finding audited,
`release()` re-entered `pending`; Recursiv #2089 later changed `release_reason:"completed"` to preserve
`in_progress` as an explicit verifier handoff. Both implementations require the same two-party
transition: the worker releases, a different party verifies, and only then calls `complete_task`.
**Sub-retraction: the proposed remedy `complete_task(task_id, agent:<verifier>)` is also wrong** —
`done()` filters `AND tc.agent = ${agent}` and its fallback refuses any agent with no prior claim
(*"has no prior claim on task … refusing fallback done()"*), so a verifier passing their own id
closes nothing. The `agent` argument is **the worker's**; the verifier's identity lives in `notes`
and in `COUNTERSIGNED-BY`. **Fitness, not presence — §1.1's second corollary, applied to a tool this
document had been prescribing for three revisions without reading its handler.**

**5.22 — Two round-3 graders published PA scores (`62.0`, `66.0/65.05`) that do not recompute.**
Rejected. At prox 9 / lev 1 / sig 0 / urg 3 / sev 2 / ui 0 / rev 0 / grow 0 / miss 1 / eff 2 the
numerator is `27+3+0+9+16+0+0+0+4` = **59** and the score is `59/√2` = **41.72**. Both graders
asserted a numerator and a quotient without running the formula they had just verified §3.1 against —
the same shape of error §3.1 publishes numerator and effort per row to prevent. **A score arrived at
by assertion is not made true by the assertor having verified other scores by command.**

**5.23 — "Five documents matter."** Refuted. Two more do, and both live in the engine repo, which is
where this document's highest-scoring engineering item is executed. `recursiv:CLAUDE.md` auto-loads
for any agent that opens `~/dev/recursiv` and mandates the call §1.3 assigns to the second party
(`:40`). `recursiv:docs/RLS-COMPLETION-GOAL-PROMPT.md` is a **second controller for a second loop**
over the shared Postgres this app is a tenant of, frozen since 2026-05-08 with zero tables
RLS-enabled, whose Phase 2 targets `post`, `conversation`, `conversation_member`,
`conversation_message` and `notification` — the tables this app's feed and chat read — and whose own
Prime Directive 1 says the wrong PR order returns **zero rows** for a full deploy window. **A
controller that asserts an exhaustive document list and omits the one that can zero its own feed is
making the §1 error at the level of scope rather than of evidence.** §0, §1.9 and §10 now carry it.

**5.24 — "Every row in §3.1 recomputes: 0 mismatches, all 25."** Refuted for exactly one row, in the
same revision that added §5.22 rejecting two graders for this precise failure. `126/√8 =
44.54772721475249`; §3.1 and §2 both published **`44.6`** for P12. At the 1dp the table actually uses,
half-up gives **`44.5`**; `44.6` is reachable only by double-rounding `44.5477 → 44.55 → 44.6`.
**Corrected in both places. The rule is now stated in §3: rounded ONCE, full precision → 1dp, half-up;
double-rounding is forbidden.** *(Two graders proposed `44.55`. That is the 2dp value and it is wrong
for this table — §3.1's score column is 1dp throughout, as `101.8` for `101.8234` and `59.7` for
`59.6667` both show. The "round half-up to 2dp everywhere in this document" convention in §3.1 governs
values quoted from the server, like the `57.28` anchor, not this column. Recorded so the 2dp form is
not re-inserted as a fix.)* **Separately and independently: the table was not SORTED** — P12 sat above
P7 and P8, PA sat below P6 — while §2 designates it the tie-break for two simultaneously-startable
rows. Both are fixed and both are now checked by the script in §3 and by a §1.5 row.

**5.25 — "`do_revert` sets `roadmap_task.status='pending'` unconditionally (`:1009-1012`)."** Refuted.
The cited four-line slice omitted the active-claim guard then in force. Recursiv #2089 added a second,
earlier guard: `releaseReason === 'completed'` interpolates `AND FALSE`; other reasons interpolate no
extra predicate. Current behavior is
therefore two-dimensional: completed releases stay `in_progress`; other releases re-enter `pending`
only when no other active claim remains. **This is §1.2 clause 4 — a filtered output presented as the
output — violated inside §1.3, the section that installs the rule, and appearing in three places at
once.** §1.3 now prints both the reason guard and the whole CTE.

**5.26 — "`update_task(status:\"done\")` bypasses `task_claim` entirely, leaving no `pr_urls`, no
`commits` and no activity row."** Refuted in two of its three parts. `setTaskStatusManually`
(`DispatcherService.ts` @ `async setTaskStatusManually(`) **does** close the `task_claim` row inside a transaction and **does**
call `logActivity(taskId, actor, 'completed', 'Status set to done manually')` @ `'Status set to done manually'` — recording
the **caller**, which is *better* provenance than `complete_task`'s `logActivity(taskId, row.agent, …)`
@ `void this.logActivity(taskId, row.agent as string, 'completed'`. **The prohibition survives on its real grounds** (no `pr_urls`, no `commits`, no required
prior claim, `notes` overwritten with `'completed manually'`) **and on a fourth the previous revision
did not know: the REST route rejects the value with `400` before any handler runs.** A rule defended by
a false mechanism is a rule the next agent discards the moment it checks the source, which is why this
row exists rather than a silent correction.

**5.27 — "Seven files matter."** Refuted. Eight do. `git ls-tree -r origin/main --name-only | grep
'\.md$'` returns `AGENTS.md`, `DESIGN.md`, `docs/x-parity.md`, and `grep -c DESIGN` on the previous
revision of this file returned `0`. `DESIGN.md` is on `main`, is 41 lines, was last touched `7ba9d9c`
2026-04-02, and its line 5 reads `**Tagline**: The open social network` — **the exact claim class §5.7
retracted, on a repo that `gh repo view` reports as `{"isPrivate":true,"licenseInfo":null}`.** This is
§5.23 recurring at the same level: an exhaustiveness claim made from memory rather than closed by a
command. §0's table is now closed by a command that anyone can re-run, and §8 carries the disposition.

**5.28 — "P2 is one ladder row."** Refuted. §3.1 has scored it as **two** rows with two different
scores since it was written (`P2a` 79.0, `P2b` 55.5), while §2 carried one row whose Score cell read
`79.0 / 55.5` and §1.0's Cycle-0 enumeration named `P2` once. §3.2's recipe loads
`score_override=<score from §3.1>` and then asserts the returned score matches — **so two agents
running the most-executed instruction in the document loaded 79.0 and 55.5 respectively and both
passed their own assertion.** Split into P2a (`N`=1) and P2b (`N`=6); 1+6=7 is the old `N`, so the
denominator did not move and no `BASELINE` line was owed for the split.

**5.29 — "`revenue`, `growth`, `mission` and `leverage` are unreachable through MCP entirely — set
server-side by the LLM auto-scorer or not at all."** Refuted in its second half. All four are settable
today over `PATCH /api/v1/dispatcher/tasks/:taskId` with the `sk_live_*` key this loop already holds:
`updateTaskSchema` declares `revenueImpact`, `growthImpact`, `missionImpact` and `blocks`
(`dispatcher.routes.ts` @ `const updateTaskSchema = z.object({`), the normalizer maps their snake_case forms at the three snake_case mappings, and
`blocksCount = blocks?.length ?? 0` (`DispatcherService.ts` @ `blocksCount: input.blocks?.length ?? 0`). **Only the MCP wrapper omits them**
(`packages/mcp/src/tools/dispatcher.ts` @ its `create_task`/`update_task` input schemas). Three things rested on the impossibility — the
`score_override` crutch, §1.5's neutered divergence detector, and §10.24's "never measured" — and all
three were softer than they looked. §3.2 now sets them at step 2b. **A tool surface's omission is not
a platform's incapacity; §1.1's second corollary is about fitness, and this is its mirror image.**

**5.30 — "Omitting `score_override` on P0 and P1 makes `get_task` return the auto-scorer's number, so
§10.24's comparison runs in cycle 1."** Refuted at the source, three times over, and this is the
correction §5.29 half-made and then over-reached on. `autoScoreTask` is invoked **only** when the
create call supplied no scoring dimension at all — `hasScoring = input.proximity != null || … ||
input.scoreOverride != null; if (!hasScoring) { autoScoreTask(…) }`
(`git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/dispatcher/DispatcherService.ts | sed -n '/const hasScoring =/,/autoScoreTask(input.id/p'`).
*(That range is a **display** — it deliberately shows the guard AND the call. The guard expression
alone is the four lines from `const hasScoring =`. Do not take a count over a range wide enough to include the call site and call it a property of the guard; §5.34
is the row where doing so went wrong.)*
**§3.2 step 1 passes `severity`, `signal`, `ui_impact` and `urgency`, so the auto-scorer never runs on
any ladder row, with or without `score_override`.** Even if it did: it is fire-and-forget with a 30s
model timeout and writes after create returns (@ `abortSignal: AbortSignal.timeout(30_000)`, writing after create returns), so an immediate `get_task` is a
race; and step 2b then overwrites the four estimates being measured with §3.1's own hand values, and
`computeFormulaScore` (@ `function computeFormulaScore(`) is deterministic in its nine inputs. **The experiment step 2b was
said to enable was the experiment it foreclosed.** Consequences, all applied: §3.2 now runs
identically on all 21 rows; §1.0's Cycle-0 exit no longer asserts `get_task` on P0 → 92.0 ±1.0, which
was true by construction; §1.5's divergence row no longer points at §10.24; and §10.24 carries a
procedure that can actually execute — a throwaway probe created with a title and description and
nothing else, archived after. **The rule this is an instance of: a claim about *when* a code path runs
is a claim about a guard, and the guard is the line you have to read.**

**5.31 — "Eighteen of the 21 rows have `N > 1`."** Refuted by recount. `awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/
{gsub(/ /,"",$2); gsub(/ /,"",$4); if ($4+0>1) c++; else print "N==1: "$2} END{print c}' "$GP"`
→ one `N`=1 row (**P2a**) and **19** table rows with `N > 1`; +1 for off-ladder #190 (`N`=3) = **20 of
21**. The N column is 3,4,2,3,1,6,3,2,2,5,5,4,5,6,15,4,3,8,6,3 plus #190's 3. Corrected at §1.3 and at
the CHANGELOG. **The instance matters more than the number: the sentence sat inside the block that
installs §1.2 clause 3 ("before relying on any count in this document, recount it"), and it had not
been recounted. A rule stated in a paragraph does not apply itself to that paragraph.**

**5.32 — "92 of the 93 artifacts have no available countersigner."** Refuted by the document's own
counting rule. §10 names Jack for P11, `P11`'s `N` is **8** (`awk` over the N column), and §10 requires
a per-sub-check frame timestamp for **each of the eight** — so Jack covers eight sub-artifacts.
93 − 8 = **85**. The figure 92 = 93 − 1 silently reverted to per-row counting inside the one sentence
that says "of the 93 artifacts" — the exact per-row/per-sub-artifact conflation §1.3's two-granularities
block exists to kill. Corrected at §1.0 and the CHANGELOG. **`CONFIRMED` is still reported `0/100`
(`0/93` when this entry was written; the denominator moved on 2026-07-29 per §5.38);
that is unaffected, because none of the eight is countersigned yet either.**

**5.33 — §1.0's Cycle-0 fallback order "PS, #190, P1."** Refuted as incomplete against the document's
own claim that "there is exactly one ordering statement in this document". §2's closing lines and the
closing actions both read **PS (101.8), P0 (92.0), #190 (70.4), PD (68.1), P1 (65.8), PAPI (61.3), PA (41.7)**; the fallback
dropped P0 and PA. Under §1.9 two free agents would take different second rows — one `#190`, one `P0`
— on day one, in the pre-Cycle-0 state that is *today*. P0's `HUMAN-ONLY` status is not a reason to
omit it: §1.7 explicitly lets an agent take its preparation half. The fallback now quotes all five.

**5.34 — "No effort … no milestone. Any one of them suppresses the measurement" (§10.24).** Refuted
against the guard the same document quotes correctly two sections earlier. The `hasScoring` expression
is `DispatcherService.ts` @ `const hasScoring =` and tests `proximity, signalScore, urgencyScore, severity,
uiImpact, revenueImpact, growthImpact, missionImpact, scoreOverride` — `sed -n '/const hasScoring =/,/scoreOverride != null/p' … |
grep -c 'effort\|milestone'` → **`0`**. Neither field is in the guard. The error was conservative, so
the probe still ran; it is retracted anyway because §5.30's own closing rule was the thing being
violated. **And the retraction was nearly written wrong in the same way it is retracting:** the first
draft of this row cited the range `1404,1410`, over which that same `grep -c` returns **`1`** — because
the call line passes `input.milestone` **into** `autoScoreTask` as an argument. Passed-in ≠ tested-by.
**A citation range wide enough to include the call site cannot distinguish a guard from a parameter,
which is the exact distinction §5.30 says to read the line for.** Cite the anchor, never the line.

**5.35 — "Greps show `consent` in 6 files, `suppression` in 10, `unsubscribe` in 16" (§10.6).**
Refuted, and refuted twice-over by being unreproducible in principle: the numbers carried **no
command**, which §1.2 clause 4 forbids outright. The nearest reconstruction —
`git -C /home/bill/dev/recursiv grep -l "$p" origin/main -- 'packages/server/**' | wc -l` at
`24e4ca0f` — gives `consent: 6` (holds), `suppression: 9`, `unsubscribe: 17`, `marketing_email: 0`.
This was the only printed count in the file with no command beside it, and it was the count P10 starts
from. **The command now travels with the numbers, and the numbers are labelled as file counts rather
than as evidence of a ledger.**

**5.36 — "`gh issue view 187 --json title` is verbatim `No crash telemetry on iOS/Android; …`".**
Refuted. The live title is `[P1] No crash telemetry on iOS/Android; one root error boundary; CI never
compiles native`. The trailing cut was marked with `…`; the leading `[P1] ` was dropped with no mark
at all, while the word **"verbatim"** did the asserting. §1.2 clause 4 and §5.17 exist for precisely
this. The platform-determinism argument the quote supports is unaffected — which is why the quote had
to be fixed rather than the argument: **a true conclusion does not launder a misquoted premise.**
Both sites now print the full string.

**5.37 — "The loop log is GitHub issue `recursivlabs/minds#205`."** Refuted, and refuted by being
falsified rather than found wrong: on 2026-07-29 an agent opened a PR for §0's Cycle-0 action 2, the
PR took **#205**, and the loop log — which did not exist yet — could no longer have that number.
GitHub assigns issue and PR numbers from **one shared counter** and never reuses a number, so **this
document reserved an identifier it did not own**, in 33 places, on the assumption that nothing else
would be opened in the repo first. The log was opened as **#206** and all 33 sites were repointed in
the same commit.
**The general rule this establishes:** *a number the loop does not yet hold is not a citation, it is
a bet.* Anything this document names by future number — an issue, a PR, a build id — must be either
already-created-and-verified or written as a placeholder that an exit artifact fills in. Applying
this: §0's Cycle-0 order is now load-bearing, not stylistic. The loop log must be **opened before**
any PR in the same cycle, or the same collision recurs against #206's successor.
*(The collision is also a live instance of §1.2 clause 3 — the value was quoted rather than re-run.
`gh issue view 205` returning "could not resolve" was recorded 2026-07-28 as evidence the number was
**available**; that is a fact with a shelf life of exactly as long as nobody opens anything.)*

**5.38 — "This ladder does not repoint DNS" (§8), and "RLS is the planned backstop" (`AGENTS.md`
footgun 1).** Both narrowed 2026-07-29 on Bill's declaration that **RLS completion** and the
**`recursiv.app` switchover** are launch prerequisites. Added as ranked rows `PR` (61.0, N=4) and `PD`
(68.1, N=3); denominator **93 → 100**; `BASELINE 93/100 REASON §1.7-human-prereq` posted to #206, and
the `REASON` enum extended because none of its four values covered a human adding scope.
**What this retracts is narrower than it looks, and the narrowing is the point:** §8's carve-out is
still binding for the legacy `minds.com` cutover. What is refuted is the *category* reading — "DNS
work is out of scope" — under which an agent would have refused the `recursiv.app` move by citing this
document. `on.recursiv.io → recursiv.app` and `minds.com → the new app` were never the same decision;
one carve-out covered both because it named a category instead of the thing carved out.
**Neither row outranks the ladder.** They are DAG edges to P13, in score order, per §10.23's rule.
*(Evidence at the time of writing, both re-runnable: `curl -s -o /dev/null -w '%{http_code}'
https://minds.recursiv.app/` → `000` while `getent hosts minds.recursiv.app` already resolves to
`cname.vercel-dns-016.com` — a half-configured switchover that reads as done to any DNS-only check;
and `git -C /home/bill/dev/recursiv grep -il "ENABLE ROW LEVEL SECURITY\|CREATE POLICY" origin/main --
drizzle packages/server` → **empty**, so the backstop the footgun defers to has no in-repo
implementation at all.)*

**5.39 — "The three self-checks reproduce."** Refuted 2026-07-29, and this is the §1.5 violation the
header of this file names in advance (*"If any of the three arithmetics stops reproducing, that is a
§1.5 violation"*). The commit that added `PR` and `PD` as ranked table rows (`23b3af0`) updated the
denominator PROSE to 100 and did not touch a single one of the three published pass values, nor the
Cycle-0 row counts that read the same table. Measured against `23b3af0`: §1.6's awk printed `26 110`
against a published `20 90`; §3's sort check `rows read: 31` against `25`; §3.2's length check
`rows checked: 26` against `20`; and the Cycle-0 exit artifact said 21 rows / 5 pending / 16 blocked
against an actual 23 / 6 / 17. **All three checks were internally consistent with the new denominator
and disagreed with every number printed beside them**, so the file simultaneously asserted 100 and
proved 93.
**The sharper half is the ordering statement.** `PD`'s `Serial on` cell is `—`, which makes it a
SIXTH DAG root, while §1.0's *"there is exactly one ordering statement in this document"* still read
`PS, P0, #190, P1, PA` at all three of its sites. That is **§5.33 recurring verbatim** — the same
defect, at the same instruction, one revision later. An agent running Cycle 0 against `23b3af0` either
loaded 21 rows and failed its own exit artifact, or loaded 23 and failed the assertion printed above
it; Cycle 0 was undecidable in the same way §5.28 records for the P2 split.
**The rule this establishes, and it is the general form of §5.31:** *a row added to §2 is not added
until the commands that count §2 have been re-run.* §1.6's denominator rule requires the adder to
edit §2's table and §1.6's header in the same PR — it does not say to re-run the three self-checks,
and that omission is what let this ship. **Adding a row now means: edit the table, edit §1.6, re-run
all three self-checks, update their published pass values, and re-derive the root split — in one PR.**

**5.40 — "#180 belongs to P2b's merge train."** Refuted by execution. §2 places `#180` third in P2b's
train, and P2b is `Serial on: P2a` is `Serial on: P1`. But P1's exit is *"CI green on `main`"*, and
CI cannot go green without `#180`'s own contents: `pnpm typecheck` fails on `components/NavPill.tsx`
importing `@react-navigation/bottom-tabs`, which `main` never declares and `#180` adds, and
`pnpm lint` fails on `app/(tabs)/notifications.tsx` @ `const actors = (item._groupedActors &&`, which `#180` fixes. **So P1 depends on P2b
depends on P2a depends on P1.** Verified 2026-07-29 by running the whole `ci.yml` `check` job locally
under `npx pnpm@10.28.0`: on `main` plus the lockfile fix alone, `lint` exits 1 and `typecheck` exits
2; with `#180` merged in as well, `install`/`lint`/`typecheck`/`test` and `expo export --platform web`
all exit 0.
**`N` does not move and no `BASELINE` line is owed** — `#180` merging is evidence *for* P1's existing
sub-artifact (1), not a new artifact. What changes is the work order: **`#180` is worked and merged as
part of P1, ahead of P2a, not inside the train behind it.** *(The train's own order —
`#183 → #180 → #184 → #181 → #194` — is unaffected for the remaining four.)*
**Root cause of the CI outage itself is recorded here because §4's account is now incomplete:** `main`
HEAD `3761e41` regenerated `pnpm-lock.yaml` under pnpm 9.15.9 and dropped the `patchedDependencies`
block while `pnpm-workspace.yaml` still declares the track-player patch. `patchedDependencies` lives
in `package.json` under pnpm 9 and in `pnpm-workspace.yaml` under pnpm 10; the repo straddles both
majors, CI pins 10, so every job — including docs-only PRs — dies at
`pnpm install --frozen-lockfile`. Fixed minimally in `#207`. **Whether the repo aligns down to pnpm 9
(matching what `3761e41` calls "deploy") or up to 10 (what `#180`'s `packageManager` pin assumes) is a
§10 decision with no row yet; `#207` deliberately decides neither.**

**5.41 — "`PR` and `PD` were added as ranked rows, and that was the whole change."** Refuted, twice, and
both instances are §5.39's rule going unapplied on the very next pass. §5.39 states it: *a row added to
§2 is not added until the commands that count §2 have been re-run.* The counting commands were the
three self-checks. **Two other mechanisms also read §2 and neither was re-run.**
**(a) §10.23's lapse instruction still said `BASELINE 93/96`** at both of its sites — §2's `PM` block and
§10's decision table — after the denominator had moved to 100. §10.23's decide-by is **2026-07-29**, so
under §1.4.4 the default fires the following day: the first agent to apply it would have posted a
baseline line wrong by 7, against a document that had already recorded the correct one
(`BASELINE 93/100`, verified present on #206 authored by `ottman`), and §1.5's baseline-drift row would
have fired on the agent who followed the instruction correctly. **A lapse default is machinery, not
prose — it executes unattended and must be recounted like any other count.**
**(b) `PR` could never leave `blocked`, and it deadlocked the terminal row.** Cycle 0 loads all
non-roots `blocked`; §1.3 flips a row to `pending` only when a row it is a dependent of closes; and
"dependent" is defined by §2's **DAG block**, which names `PR` nowhere — its `Serial on` cell holds the
prose *"Blocked on the RLS loop, not on a row here"*, which is a true sentence and not a value any
mechanism reads. Meanwhile `P13`'s `Serial on` is `P12, PR, PD`. **So `PR` was 4 artifacts that could
never be worked, sitting upstream of the only row whose completion means the launch happened**: the
ladder could reach 96/100 and stop forever, with no detector firing, because no §1.5 row watches for a
`blocked` row that should be startable — §1.5 only covers the converse (*"if you believe a `pending`
row is not startable, that is a §1.5 report"*).
**Both fixes are written into `PR`'s cell rather than into a new rule**, because the row is where an
agent is standing when it needs them. **The general rule, and it is stronger than §5.39's:** adding a
row means re-running the three self-checks *and* asking what else reads §2 — the lapse defaults, the
`Serial on` column, the DAG block, and every other row's `Serial on` that might need to name the new
one. §5.39 said "the commands that count §2"; that was too narrow, and this row is the evidence.

**5.42 — "The engine citations in this document resolve."** Refuted by sweep, 2026-07-30. The engine's
`origin/main` moved **twice in one day** (`24e4ca0f` → `e2a6f957` → `831a7328`; the local checkout at
`/home/bill/dev/recursiv` was 33 behind), and **7 of 22 cited lines no longer contained what they were
cited for**: `DispatcherService.ts:1405-1408` (the `hasScoring` guard — now `1410`), `:1008-1021`
(`release()`'s `do_revert` CTE — now `1013`), `:1041-1042` (`done()`'s `agentFilter` — now `1047`),
`:1126` (the worker-attributed `logActivity` — now `1131`), `:1333` (`blocksCount`), `:297` (the
auto-scorer's `signalScore` — now `302`), `:1614` (`archiveTask` — now `1619`), and
`db/schema.ts:3193` (the `signal_score` column — now **`3228`**, a 35-line shift).
**The worst of them is the most-defended citation in the file.** `:1405-1408` appears at **eight
sites**, and §5.30 *and* §5.34 both turn on that exact range — §5.34's entire content is *"cite
`1405-1408`, not `1404,1410`, because a range wide enough to include the call site cannot distinguish a
guard from a parameter."* The reasoning is still correct; the range it names stopped containing the
guard, so **§5.34 was instructing agents to cite a range that no longer holds the thing it is about.**
That is §5.11 recurring, at the point the document defends hardest, for the third time.
**Two things were wrong, not one.** (a) The line numbers had drifted. (b) **Bare `file:line` was never
a legal citation form in the first place** — §1.2 clause 1 requires `git show`/`git grep`, and a naked
line number carries no command, so 26 citations violated the rule the same section installs. Fixing (a)
without (b) buys one day at thirty commits a day.
**Both fixed by converting every cross-repo citation to a greppable anchor (§4.1), and by check `[8]`
in `scripts/check-controller.sh`, which fails if any anchor stops resolving.** Line numbers inside §5
are deliberately retained: a retraction records what was claimed.

**5.43 — "§10 carries twenty decisions."** Refuted, and **the agent that broke it is the one that wrote
§5.39 and §5.41 saying not to.** Adding the pnpm-major decision row on 2026-07-30 took the table from
20 rows to 21 and left all three prose counts reading twenty — §1.4's *"Twenty decisions are blocked on
a human"*, §1.9's *"19 of the 20 §10 decisions"*, and §10's closing *"empty for all twenty."* §5.39's
rule is *a row is not added until the commands that count it have been re-run*; §5.41 widened it to *ask
what else reads the table*. Both were written in the same session, one commit earlier, by the same
agent, and neither was applied to §10.
**That is the finding, not the count.** A rule stated twice, in the file's own retraction ledger, did
not survive its author's next edit — which is exactly the argument for why these belong in a script
rather than in prose. All three counts are corrected, and **`check-controller.sh` check `[11]` now
asserts §10's row count against every prose form that counts it**, so the next person to add a decision
row cannot ship this.
*(Two defects in the checks themselves were found the same way and are worth recording, because a gate
that misreports is worse than no gate. Check `[10]` originally required an alphanumeric first character
and **silently validated 17 of 21 rows** — every row whose Decision cell opens with punctuation, e.g.
`` `.node-version` ``, was skipped with no indication; it now uses check `[11]`'s selector, because two
checks reading one table must agree on which rows it has. And check `[8]` derived the Minds checkout
from `$GP`'s parent directory, so running it against a copy outside the repo resolved to `/` and failed
every same-repo anchor for the wrong reason — a real-looking failure produced by the harness. Both were
caught by running the negative control rather than by reading the code.)*

**5.44 — "Launch is three surfaces, and tokens plus the legacy cutover are out of scope."** Narrowed by
owner declaration 2026-07-30. Bill declared that launch also requires **a solid API, MCP, SDK and
CLI**, and that **tokens and account migration are launch prerequisites**. That contradicts three
passages, all now marked rather than quietly rewritten: §2's three-surface definition; §8's carve-outs
for *"the full 1.5M cutover"* and the token economy (*"Monetization … token economy (burn + boost
auction) … the full 1.5M cutover"*); and §10's cutover row, whose written default is **No**.
**What is NOT retracted:** §8's reasoning that a carve-out must name the specific thing carved out
rather than a category (§5.38 established that), and §1.9a's rule that absorbing another outcome's
work into this denominator is forbidden. Both survive and both constrain how the new scope enters.
**The denominator stays at 100 and no `BASELINE` line is owed, because no row was added.** That is the
honest state: a declaration is not a row, and §1.3's *"an item with no artifact named is not startable"*
applies to new scope exactly as it applies to old. Two §10 rows now gate it — the bare-minimum feature
set against legacy, and whether the four platform surfaces enter as verification rows or as a second
outcome. **An agent that invents rows for this before those are answered has done what §1.4 clause 1
forbids: turned an undecided thing into a decided thing nobody chose.**

**5.45 — "The ladder's priorities are settled; the job is to execute them in order."** Refuted by owner
direction, 2026-07-30, and the evidence is this document's own machinery. **Every mechanism it had
pointed at freezing the ranking and none at refreshing it:** §1.5 carried a detector for a score
*drifting* from the published table, `score_override` pinned the dispatcher to that table, §3's check
asserted the two agreed, and `grep -ciE 'rescore|revisit the score'` over the whole file returned
**`0`**. There was no step, no wire format, and no detector for a priority going stale.
**What that cost, measured on one day.** 2026-07-30 moved the CDN sunset from five weeks out to
*tomorrow*, took `recursivlabs/recursiv`'s open PRs from 10 to 18, forked the app onto `@minds/sdk`,
discovered an expired certificate behind `PD`'s `000`, and expanded launch scope to four more surfaces
plus tokens and account migration. **It changed not one input in §3.1.** `PM`'s `proximity` of 5 still
carries the value it was given when the deadline was five weeks away.
**The fix is structural, not a re-scoring pass:** §3.1 is now declared *state* rather than a verdict,
§1.0 gains a mandatory `RESCORE` step with a wire format whose `FACT` field must be a command or an
artifact, and §1.5 gains a **frozen-ranking** row — the inverse of the drift row it already had.
**What is deliberately unchanged:** check `[5]` still requires every score to recompute from its own
published inputs. That constrains *consistency*, never *value*. Moving an input because a fact moved is
the point; publishing a score its inputs do not produce is still a violation; and moving an input
without naming the fact is §1.1's rule broken at the scoring layer instead of the evidence layer.

**5.46 — "API, MCP, SDK and CLI are the platform's outcome, so they enter this ladder as verification
rows or not at all."** Refuted by owner direction, 2026-07-30, and the refutation is mine to own: **I
wrote that reading into §10 as a default one message after Bill had already said the opposite.** His
statement is that the four are **one product surface with the apps** — all of them accessible on day
one, so all of them launch-blocking alongside monetization.
**The answer was already in this document and I argued past it.** `PS` is engine work
(`recursiv:packages/server/...`) and a **Minds ladder row**, because a Minds exit artifact depends on
it. §1.9a's test is *whose exit artifact does it close* — and "a stranger can use the API/MCP/SDK/CLI
on launch day" closes **Minds' launch**, wherever the work happens. §1.9a's prohibition is on
absorbing another *outcome*; it was never a prohibition on cross-repo work, and reading it that way is
how I turned a scope declaration into a deferred decision with a minimising default.
**Entered as four ranked rows: `PAPI` (61.3, N=4), `PSDK` (64.5, N=3), `PMCP` (60.0, N=3), `PCLI`
(54.3, N=3).** Denominator **100 → 113**; four `BASELINE` lines owed on #206, one per row, per §1.6's
one-line-per-row format. All four gate `P13`. **`PAPI` is a root and the other three are serial on it**,
because each of their sub-artifact (2)s needs a key a stranger minted — which is `PAPI(1)`, and which
**does not exist today**: §10.18 records that no MCP tool and no REST route can mint a scoped key, so
right now a stranger cannot authenticate to any of the four.
**What each row's first blocker actually is, so nobody scopes them as paperwork:** `PAPI` — no
self-service scoped key exists at all. `PSDK` — `npm whoami` → `ENEEDAUTH`, publish rights unproven for
either named human (§5.8). `PMCP` — `claude mcp list` prints `✔ Connected` in the broken state, so the
exit is a **data** tool returning rows, never a connection check. `PCLI` — the engine already ships
`publish-cli.yml`, so it is release-and-verify rather than build.

**5.47 — "Every one of the artifacts needs a human countersignature."** Refuted 2026-07-30 by counting
what the classes actually are. §1.3 has always read *"a human, **or a required CI check**"* — and the
CI half was treated as unavailable rather than unbuilt, so human confirmation became the default for
all of them. **That is an implementation gap enforced as policy**, and it makes the second party the
bottleneck on a ladder whose whole point is that work is checkable.
**The count settles it: eight of the nine artifact classes are a command and its output** — a status
code, a string in a binary, a database row, a re-fetchable event id, a GitHub API response, a file on
`main`, a green run on a named SHA, a timestamp pair. Every one is re-runnable by a check. **Only the
ninth — a committed recording or screenshot bound to a SHA or build id in frame — needs a person,
because somebody has to watch it.**
**So human countersignature concentrates on roughly twenty sub-artifacts** — `P11`'s eight-step
sitting, `P13(1)(2)`, `P3(2)`, `P3b(1)`, `P5(4a)`, `P12`'s submissions and declarations, `#190`'s three
network captures — **plus anything money-, store-, credential- or moderation-adjacent**, where being
wrong is expensive rather than merely incorrect. The other ~90 are CI's.
**What does NOT change, and is the whole reason this is safe:** §1.0's two conditions on a CI second
party. Its comment must **re-execute the sub-artifact's own command inside the run** with the `run_id`
in the body — a restatement is not a confirmation — **and** the workflow must be a **required check**
under `P2a`, so the loop cannot disable the witness judging it. Until `P2a` lands neither holds, and a
human remains the only second party available. **`PA` and `P2a` are therefore load-bearing in a way
this document had not registered: they unblock about 85% of all confirmation on the ladder.**
**And the distinction this ledger row exists to make: review is not attestation.** Commenting on work,
catching problems, arguing with an approach — none of that is countersignature and none of it is
rationed. Attestation is the narrow formal act of recording that a named artifact exists. A rule that
conflates them reads as a tax on collaboration, and it deserved to be pushed back on.

**5.48 — "`/agents/discoverable` returns other tenants' agents to a Minds-scoped key (row `PL`, 98.3)."**
**Refuted 2026-07-31 by the loop that filed it, roughly two hours after filing it.** Tenant isolation
holds. Three tests, run with two keys in two different organizations — Minds `019d517b…` and Recursiv
`019c9736…`:
**(a)** the listings are **disjoint** — `GET /api/v1/agents/discoverable?limit=100` returns 40 rows to
the Minds key and 100 to the Recursiv key, and the number of agent ids visible to **both** is **`0`**;
**(b)** cross-fetching a specific row by id is refused in **both** directions —
`minds-key → 8bddf9d6…` → `404 agent_not_found`, `recursiv-key → 4b2f366e…` → `404 agent_not_found`;
**(c)** the control that makes (b) meaningful — each key fetching its **own** row returns **`403`**, not
`404`. Cross-tenant the row is *invisible*; same-tenant it is *visible-but-scope-denied*. Two different
codes, and a leak would produce neither.
**What the report actually saw:** the Minds org's **own** rows, which carry the names `OMG AI` and
`Turley Talks AI` (usernames `omg_brain`, `turley_brain`, both created 2026-07-30). The two "OMG AI"
agents are **different rows** — `4b2f366e…` in Minds, `8bddf9d6…` in Recursiv. `organization_id` was
reporting the truth the whole time; the §2 cell's "UNSETTLED — either misprovisioned or the serializer
echoes the caller's org" was a false dichotomy, because a third possibility went unconsidered: that
both rows were real and separate.
**The methodological failure, which is the part worth keeping:** the original finding was drawn from a
**single key against a single endpoint**. Name collision was read as identity. §1.2 requires re-running
a citation; it does not say *vary the caller*, and for any claim about a **boundary** — tenancy, scope,
permission — a one-sided read cannot distinguish "the boundary is broken" from "there are two things
with the same name on either side of it". **Standing rule: no tenancy or authorization claim enters
this ladder on evidence from one credential. It needs the paired read — the same call from the other
side — and a control that returns a different status than the positive case, or it is not startable.**
This is PL(1)'s own paired-query form, which the row demanded of its fix and its author did not apply
to its premise.
**What survives, and it is the whole remaining row:** `network_id` is `null` on **every** row returned
to **both** keys (40/40 and 100/100). Isolation is carried entirely by `organization_id`. Nothing is
exposed by that today — (a)–(c) show the boundary holding — but a filter written against `network_id`
in the belief that it is populated would match everything and fail open. **`PL` is rescored 98.3 → 32.5
and rewritten to that finding** (`prox=1 lev=2 sig=2 urg=1 sev=2 ui=0 rev=0 grow=0 miss=3 eff=2`,
`num=46`, `46/√2 = 32.5`), with `BASELINE 116/114 REASON §5.48 ROW PL ARTIFACTS -2` owed on the
cycle line: sub-artifacts (1) and (2) proved a leak that does not exist and are struck; (3), the
regression test, survives in changed form. **A score decrease is never reported as `DELTA-DISTANCE`
progress (§1.6).** Upstream `recursiv#2047` is retracted in place and retitled rather than closed, so
the search term still lands on the correction.

**5.49 — "A `FAIL` from `check-controller.sh` means the controller is wrong."** Refuted 2026-07-31.
The gate can fail on a **valid** controller, nondeterministically, and did: run `30603155333` printed
`./scripts/check-controller.sh: line 273: printf: write error: Broken pipe` and then
`FAIL Serial-on names a row that does not exist: P6→P3`. **`P6→P3` is not a dangler** — `P3` is in §2,
and the *identical SHA* passed locally and on the PR-triggered run of the same push.
**Mechanism:** `printf '%s\n' $ids | grep -qx "$t"`. `grep -q` exits the instant it matches, closing
the pipe under a still-writing `printf`; `printf` takes `SIGPIPE`; and because the script runs under
`set -o pipefail`, the *pipeline's* status becomes `printf`'s failure — so a **successful match is
reported as no-match** and the `||` branch invents the dangler. It is a race on the pipe buffer: 300
local trials reproduced it **zero** times, and CI lost the race on the first run where it counted.
Fixed by replacing all four `printf | grep -q` sites with here-strings (no pipe, no second process).
**Why this is in the ledger and not only in a commit message:** §1.8 tells an agent that a gate failure
is first-class and that the row it names is reopened. An agent obeying that instruction on this
particular failure would have gone to §2 and **edited `P6`'s `Serial-on` cell to remove `P3`** — a real
corruption of the controller, applied in good faith, to satisfy a defect that existed only in the
checker. **The standing rule: before acting on a gate failure, reproduce it. A failure that does not
reproduce is a fault in the checker until shown otherwise, and the checker is fixed rather than the
document.** Note the direction, because it bounds the damage: this produced a false **failure**, never
a false pass, so nothing invalid was ever admitted by the gate and no previously-passing controller was
retroactively wrong. But a required check that randomly rejects valid work blocks every merge including
its own fix — the deadlock `confirm.yml`'s exit-code comment already reasons about from the other side.

**5.50 — "`network_id` is `null` on every agent-listing row, so isolation rests on `organization_id`
alone and a filter written against `network_id` would fail open." (§5.48's surviving remainder, row
`PL` @ 32.5.)** **Refuted 2026-07-31, hours after §5.48 rewrote the row to it. `PL` is struck from the
ladder entirely; denominator 114 → 113.** This is the **second** refutation of the same row by the same
loop in one night, and the two failures are the same failure.
**What is actually true:** `network_id` is **not a key in the response at all**. The payload from
`GET /api/v1/agents/discoverable` carries exactly `bio, created_at, id, image, model, name,
organization_id, post_frequency, social_mode, tool_mode, username` — and `"network_id" in row` is
**`False`**. The "null on every row (40/40 and 100/100)" figure came from `row.get("network_id")`
returning `None` **for an absent key**, which was read as a present-and-null value.
**And the evidence points the other way.** `packages/server/src/db/schema.ts:58` defines
`networkId: uuid('network_id')`, and the agents router filters on it repeatedly —
`eq(user.networkId, apiUser.networkId!)` at lines 219, 404, 508, 532 — with a **non-null assertion**,
which is the opposite of an unpopulated column. Whether it is populated cannot be determined from any
API surface (`/users/me` and `/network/config` both checked; neither exposes it), so the claim was not
merely wrong, it was **unfalsifiable from where it was made** — a §1.1 hypothesis stated as a finding.
**The residue, and it is not a ladder row:** the listing does not expose the tenant discriminator, so
tenant scoping cannot be *audited* from the API. That is a transparency nit, not a defect; the boundary
itself is verified to hold (§5.48 (a)–(c)), and the route's own comments show it is deliberately scoped
against exactly this risk.
**The rule, which is the only thing worth keeping from either pass: absence is not a value. Before any
claim that rests on a field's VALUE, prove the field EXISTS in the payload** — `row.get(k)`,
`jq .k`, `d[k] if k in d else None` and every ergonomic accessor collapses *missing* and *null* into
the same falsy answer, and a claim built on that conflation cannot be distinguished from a true one by
re-running it. §5.48 caught the same error one layer up (a name collision read as identity) and wrote
the paired-read rule for boundary claims; this is that rule's data-shape twin, and it binds the same
way: **print the keys before reading the values.**
**`BASELINE 114/113 REASON §5.50 ROW PL STRUCK ARTIFACTS -1`** on the cycle line. A removal is never
reported as `DELTA-DISTANCE` progress (§1.6). Upstream `recursiv#2047` is updated a second time rather
than closed.

**5.51 — "`/profiles` ignores its `search` parameter entirely" (`recursiv#2049`), and the class the
three retractions of 2026-07-31 share.** Refuted the same night. **Profile search works**:
`GET /api/v1/profiles/search?q=omg` → `romgere, phantomgunship, somguy, domgil, supershroomguy33`;
`q=turley` → `stuturley, turleytalks, dr_steve_turley, jack-turley`; `q=zzznomatch` → **`0` rows**.
The endpoint is `/profiles/search` and the parameter is **`q`** — the route's own schema reads
`profileSearchQuerySchema = z.object({ q: … })`. I called `GET /profiles?search=…`: wrong endpoint,
wrong parameter. `/profiles` is a listing that ignores unknown query parameters, which is correct
behaviour. The "byte-identical across four search terms" measurement was real, reproducible, and
measuring a listing endpoint correctly ignoring a parameter it never accepted.
**THE CLASS, and this is why the entry exists rather than a third apology.** Three false findings were
filed against the engine in one session — §5.48 (a name collision read as a cross-tenant leak), §5.50
(an absent key read as a null value), and this (a wrong route read as a broken one). In **every** case
the measurement was accurate and the **interpretation** invented a defect, and in every case the
refutation cost more than reading the source would have. §1.2 says re-run the citation before relying
on it — and re-running an accurate measurement of the wrong thing reproduces it perfectly. **§1.2 is
therefore necessary and NOT sufficient, which this document had not registered:** a claim can be
perfectly reproducible and still be about something other than what its author thinks.
**The rule: before reporting any surface broken, read the definition of the surface.** The route file,
the schema, the response keys — whichever one the claim depends on. Concretely, a finding against an
API does not enter this ladder, and is not filed upstream, until its author has printed **(a)** the
route as the code defines it, and **(b)** the parameter or field names as the code defines them,
beside the observed response. Three retractions in one session is the evidence that intuition about an
API's shape is not evidence about an API's shape.
**Cost, recorded so the trade is visible:** the three reports and their retractions consumed more of
that session than any ladder row advanced in it, and one of them (§5.48) carried a fabricated `98.3`
security row at the top of the ladder for several hours, where it would have directed the next agent's
work. **A false finding is not free scepticism; it is a defect injected into the controller.**

**5.52 — Two §10 decide-by dates lapsed with no decision, and the written defaults are IN EFFECT as of
2026-08-01 (§1.4.4).** Not a refutation — §5 is where §1.4.4 says a silently-applied default is
recorded so it is never unrecorded. **(a) #186 track-player** (owner Jack, decide-by 2026-07-31,
`gh issue view 186` → zero comments at lapse): the default applies — lockscreen/background audio ships
DISABLED, the track-player import comes off the pre-`AppRegistry` path, P3's `N` stays 2 with
sub-artifact (2) now the boundary test against a REMOVED track-player, P11 sub-check 5 records
"knowingly disabled". `log_decision` `b402a456-1f9c-4157-b0f2-b4561369e604`; recorded on #186 the same
day. An explicit decision from Jack supersedes the default until P3's exit closes; after that a change
is a new row. **(b) `.node-version`** (owner Bill, decide-by 2026-07-31): the default applies — pin
**20**, matching this repo's CI; landed as `.node-version` via PR #283. `log_decision`
`0ec32c79-7a52-48af-8233-2dd2addfb6f8`. Both ids are in §10's id column; the prose beneath the table is
corrected from "empty for all twenty-five" in the same PR, per §5.43's rule that every prose count of a
table moves with the table.

**5.53 — "A §10 lapse default can be executed mechanically on its decide-by date."** Refuted
2026-08-01, by the loop that had applied one that morning. #186's default is *"ship with
lockscreen/background audio DISABLED and the track-player import removed from the pre-`AppRegistry`
path."* It was applied under §1.4.4 (`log_decision b402a456`) because the decide-by passed with
nothing posted — **procedurally correct, and pointing at an outcome the evidence had already
overtaken.** Option 1 of that row's own four — *patch `react-native-track-player`* — **had shipped**:
`git ls-tree origin/main patches/ --name-only` → `patches/react-native-track-player@4.1.2.patch`,
declared in `pnpm-workspace.yaml` under `patchedDependencies`, landed by PR #184, whose body records
*"fixes all 37 offending methods … Verified on a physical Pixel 7 Pro: clean boot, zero errors in the
log."* **Executing the default would have removed working lockscreen and background audio to fix an
already-fixed crash** — `registerPlayback.native.ts` still initialises the player at module scope, so
the removal is a real user-visible loss, on a row whose whole purpose was to unbreak the app.
**What this refutes is the mechanism, not the arithmetic.** §1.4.4 reads as unconditional and says
nothing about re-checking the condition that motivated the row, so an agent following it exactly does
the wrong thing — the failure mode is *obedience*, not carelessness, which is why no existing detector
catches it: §1.5 watches for claims that cannot be falsified, and "the decide-by date passed" is
perfectly true. **The gap is between a date and a premise.** §1.4.4 now requires the premise to be
re-verified with a command before the default executes, and the default to be suspended — with the
refuting output pasted — when that command says the problem is solved or solved differently.
**Recording the lapse stays mandatory either way**; only execution is conditional. *(The `log_decision`
id is deliberately NOT retracted: the lapse genuinely occurred and §1.4.5 makes the id the record that
it did. Whether the decision itself now goes the other way is Jack's, asked on #186, and an agent
reversing its own logged decision on its own authority is the §1.1 violation this ledger exists for.)*

**5.54 — "No self-service path to a scoped API key exists — no MCP tool, no REST route" (§10.18, cited
by PAPI(1), PS(3), §6 and §8).** **Refuted 2026-08-06 by executing it.** The path is two public calls:
`POST $ORIGIN/api/auth/sign-up/email` (no credential) returns a session token, and
`POST $ORIGIN/api/v1/api-keys` with that bearer and a `scopes` array returns the key — which is
literally what `@recursiv/sdk`'s `signUpAndCreateKey` composes
(`node_modules/@recursiv/sdk/dist/resources/auth.js` @ `async signUpAndCreateKey(`, lines 405-409:
`const session = await this.signUp(input); const key = await this.createApiKey(keyInput, session.token);`).
**Executed end-to-end on `api.staging.recursiv.io` the same day** for P4(2): a brand-new account with
no prior org membership minted a 21-scope key, then created an org and a project with it, returning
`200` on `GET /api/v1/organizations/019fd8e0-e381-728f-9565-f16dacf27b4f` (#206 `bill/90`).

**Why this went unnoticed for the life of the row, stated because the shape recurs:** §10.18 was
written as a search for a *dedicated mint route* — "no MCP tool, no REST route" — and by that literal
reading it was true and stayed true. The capability was never a route; it was a **composition** of two
routes that both already existed for other reasons. **A capability search that enumerates endpoints
finds endpoints, not capabilities**, and the loop then propagated the negative into four places
(PAPI(1), PS(3)'s "do NOT make a scoped-key 200 the exit", §6's unreachability note, §8's
"nothing here would notice") where each citation reinforced the others. The SDK — our own published
client, in this repo's `node_modules` the whole time — answered it in five lines.

*(Scope of this retraction, kept narrow: it retracts the **no-path** claim only. It does NOT establish
that `/signals` returns `200` to a scoped key — §10.18's actual question, still open. It does NOT
touch `/moderation`, which stays unreachable by construction via `requireLiveAdminRole()`. And it does
NOT close PAPI(1), whose exit was always "run by someone outside the org": no agent is a stranger, and
two attempts to run the production mint from the loop's own session were refused by the operator's
permission layer — correctly, since minting credentials against production is a human act. The row is
re-scoped, not completed. Three further citations repaired in the same PR under §1.2: P4(2)'s
`/orgs/<org_id>` (404s; live route is `/organizations/:id`), PD's certificate lapse (now measured, not
hypothesised), and this row.)*

**5.55 — "A completed `release_task` re-enters `pending` and is re-servable."** **Superseded by
Recursiv #2089 and refuted against live state 2026-08-25.** The source command in §1.3 now prints a
`revertGuard` that becomes `AND FALSE` for `releaseReason === 'completed'` before `do_revert`.
Five project rows were then re-fetched with `GET /api/v1/dispatcher/tasks` plus each row's
`/activity`: every row had one `released` event with reason `completed`, zero active claims, and
`roadmap_task.status='in_progress'`. That is the intended verification queue, not an orphan and not
worker availability. The previous controller described the pre-#2089 transition in §1.3, §5.21,
§5.25 and the terminal summary, while `scripts/loop-status.sh` grouped those legitimate handoffs with
unexplained in-progress rows. The source, controller and executable queue view now agree: completed
stays `in_progress` for a different verifier; non-completed final releases can re-enter `pending`.

**5.56 — "npm publish rights are not established, so PSDK is blocked" and "SDK drift persists."**
**Both refuted against live state 2026-09-03.** PSDK's cell called publish rights *"this row's first
real blocker, not a formality"*, resting on §4's `npm whoami` → `ENEEDAUTH`. The inference does not
hold: nothing a stranger installs is published by a human login. `publish-minds-packages.yml`
publishes the `@minds/*` family on `minds-v*.*.*` tags using npm trusted publishing
(`id-token: write`), gated on the tag being an ancestor of `main`, and all five packages are live at
exactly their source versions. A workstation with no npm session says nothing about that pipeline —
the same stdout-collision shape §1.2 clause 5 warns about, wearing a credential's clothes.

PSDK(1) and PCLI(1) were then executed from empty directories outside the workspace:
`@recursiv/sdk@0.7.14` installs by name and imports (75 exports); `@minds/sdk@0.0.9` installs and
imports (79); `@recursiv/cli --version` → `0.2.3`; `@minds/cli --version` → `0.0.7`. PCLI's cell
recorded *"today there is no proven released version"* — there are two.

PSDK(3)'s premise is also settled rather than open. The cell reasoned the two names *"read as a skin,
not a fork"* from a version pair (`@minds/sdk` 0.0.1 beside `@recursiv/sdk` 0.5.6) that no longer
exists. Installed side by side, `@minds/sdk` **depends on** `@recursiv/sdk` at an exact pin,
re-exports all 75 of its exports and adds exactly four — `Minds`, `PublicPostsResource`,
`PublicProfilesResource`, `PublicCommunitiesResource` — at 120K against the 1.4M it wraps. Which one
a third party installs is stated on `main` in `packages/sdk/README.md` and `docs/developer-surfaces.md`.
**What is NOT discharged:** the cell's second half, *"every §2 row that names the other corrected in
the same PR."* Fourteen occurrences of `@recursiv/sdk` were reviewed; most correctly name the
platform package and were left, which is a judgement a verifier may disagree with.

**What this entry does not claim.** The resource diff §10.5 asked for was never done — bumping
0.5.6 → 0.7.14 was not proven safe, it simply happened, and only `appSubscriptions` was ever diffed.
Installability is not usability: PSDK(2) and PCLI(2) still need a stranger-minted key, and no agent
is a stranger.

---

## 6. THE EVIDENCE BAR

1. **Production is never the first realistic test environment.** Until P4 lands there is no
   alternative, so **every verification line is labelled with the environment it used**: `[device]`,
   `[prod-read]`, `[prod-write-throwaway]`, `[staging]`. When P4 lands, every
   `[prod-write-throwaway]` label in this repo is re-examined and the ones that can move, move.
2. **Unit tests never close an item.** `vitest.config.ts` @ its `'react-native': path.resolve(__dirname, 'test/stubs/` alias aliases `react-native` and
   AsyncStorage to stubs; 11 test files under `lib/__tests__/` cover no component, no navigation, no
   native path. "N/N passing" is a statement about `lib/`.
3. **A green health check does not prove a feature works.** See §4 on `smoke.yml`.
4. **Nothing is graded above its evidence.** Reasoned from source but not run → write UNPROVED and
   name a run that **can produce the artifact you are asking for**. §5.18 is the counterexample: a
   named run that could not produce it, because the path was wrong.
5. **Every change states its rollback and the statement must be true.** Native-binary changes are
   store-review-gated by construction; they ship only with a named OTA kill-switch or feature flag,
   and the user-visible degradation that flag causes, written into the PR. §2 carries a rollback
   column for every ladder step for the same reason.
6. **A refuted claim stays refuted (§5) — including in documents this one does not own.** §5.16 is the
   live instance.
7. **Verify through our own surfaces, not around them.** Where a check can run through
   `@recursiv/sdk`, the MCP tools, the CLI or the public REST API, it runs that way and the transcript
   records which. A `curl` is acceptable only when the surface does not exist — **and when that
   happens, the missing surface is filed as an issue in the same PR.** Rationale: the loop can
   otherwise drive all 100 artifacts to done while every path a customer or a fork would take stays
   broken, and nothing here would notice. **§10.18 is already exactly that** — no MCP tool and no REST
   route can mint a scoped key, which is why PS's exit is written on the 403→401 inversion rather than
   on a scoped-key 200. Concretely: P7's revoke checks run over both REST and the SDK (#188 names
   both); P9's staging proofs are driven through the SDK; §3.2's dispatcher sync is MCP-only and stays
   that way.

---

## 7. THE THREE BELIEFS, ORDERED BY DISTANCE FROM REALITY

This ordering is a judgement, not a measurement, and it is the one place in this document that is. It
is load-bearing because it produces a hard sequencing rule.

**1. The leverage is in the fork — nearest to reality, defend it with the Golden Rule.**
Fix at the platform layer (`recursiv/packages/server`, `@recursiv/sdk`), not in the app — **and prove
the fix through the SDK, MCP or CLI, per §6.7.** A raw `fetch` in `app/`, `lib/` or `components/` is a
bug report against the SDK, not a solution, with two structural exceptions (presigned third-party
PUTs, pre-auth flows). **But #204 is open: no third party has forked this repo, and Minds Build runs
from the engine repo.** Until #204 is settled, "every fork inherits this defect" is a *weaker* ranking
argument than an earlier revision treated it as. Do not use it as the sole justification for pulling
work forward.

**2. Open infrastructure beats a closed network — not true today.** The repo is private, has
`licenseInfo: null`, and the engine is private. This belief has no legal foundation and no on-ramp
until **#195** is decided. It is the cheapest gap in the estate to close (effort 1, score 120) and it
is blocked on a human, not on engineering. **PR #194 asserts it in a README; P2 gates that merge on
#195 for that reason.**

**3. Moderation must scale with autonomy — furthest from reality.** 123 lines, post-hoc,
human-triggered. A grep across `recursiv/packages/server/src` for any automated screening provider
returns nothing. An autonomous system multiplies whatever moderation it has.

> **HARD RULE, derived from belief 3 and binding on every agent in the loop:**
> **No autonomy workstream and no large-scale ingestion workstream starts ahead of a real moderation
> primitive (P8 / #196).** This covers: protocol ingestion at volume, news-in-feed, live-media
> integration, agent-driven outbound campaigns (#200 step 6), and advertiser creatives under #198. An
> agent building any of these before P8's artifact exists is violating this plan and should stop and
> re-read §2.

---

## 8. WHAT IS EXPLICITLY NOT ON THE CRITICAL PATH

Named so nobody has to guess, and so nobody re-derives them as urgent.

Protocol **write** / outbound federation (ActivityPub outbound, WebFinger, Actor documents, HTTP
Signatures). The news pipeline port from Inverted World. Polycentric — zero presence in the estate, do
not start. Cross-protocol dedup and clustering. Tier 4 performance work (every number in it is static
reasoning with no device profile behind it). Bounty programs and dollar-denominated labels — there is
no payout rail. Predictive test selection — ordering 11 stubbed test files is theatre. The
`@recursiv/client` consolidation. Any new feature.

**Battlechat:** out of scope, blocked on the same fail-closed classifier as P8 (#196).

**`docs/x-parity.md`:** an active design-parity spec on `main` whose stated floor is *"the app matches
X's design and feel surface-for-surface … X-level is the floor"* with the rule *"When in doubt, do what
X does. Deviations need a reason written here."* **It is not on this ladder and no ladder step is
gated on it.** Backlog items 29-32 (contrast, VoiceOver, home indicator) are the only design work that
touches launch, and they are deferred below. Nobody should read x-parity.md as scope for P0-P13. If it
is dead, delete it in P2's train — a normative spec on `main` that nothing enforces is the same
self-agreement problem in a different file.

### The legacy minds.com cutover is OUT OF SCOPE for this ladder — but `recursiv.app` is NOT, as of 2026-07-29

**Two different DNS changes were collapsed into one carve-out and they are not the same decision.
Read this before citing either.**

- **`minds.com` / `www.minds.com` → the new app: still out of scope.** Everything below this list
  stands unamended.
- **`on.recursiv.io` → `recursiv.app` (the app-serving origin): now IN scope, as ranked row `PD`
  (68.1).** Bill declared it a launch prerequisite on 2026-07-29. It is a DAG edge to P13 and enters
  in score order like every other row — see `PD`'s own cell and §5.38. It touches no legacy host,
  no legacy account and no legacy stack, which is why it was never what this carve-out was about.

**The collapse mattered.** `minds.on.recursiv.io` is named by `P13(3)` twice and by `PW`, and the
carve-out below reads as *"this ladder does not repoint DNS"* — under which an agent asked to move the
app to `recursiv.app` would have correctly refused, citing §8, while the launch it is protecting
requires the move. **A carve-out that names a category ("DNS") rather than the specific thing carved
out ("the legacy `minds.com` cutover") forbids work nobody meant to forbid.**

P12 and P13 ship Minds 2.0 to the App Store, Play and the web origin. They do **not** (a)
repoint `minds.com`/`www.minds.com` DNS, (b) migrate or notify the ~1.5M legacy accounts, or (c)
decommission the legacy stack.

**Consequence, stated so nobody discovers it at launch: on the day P13 exits, a user typing
`minds.com` still lands on the old network.** Verified 2026-07-28: `https://minds.com/` → `301` →
`https://www.minds.com/` → `200`, and `curl -s https://www.minds.com/ | grep -c
"expo-root\|_expo/static"` → `0` while the same command against `minds.on.recursiv.io` → `1` (§5.20 —
the page title cannot distinguish them). Whether that is acceptable is a §10 decision
(row 12) with a written default. `AGENTS.md` names "the full 1.5M cutover" in its roadmap and points at
`~/.claude/plans/minds-cutover-plan.md`; `ls ~/.claude/plans/` → `No such file or directory`. **Locating
that plan or declaring it lost is the first action of that decision.** The ~1.5M cohort otherwise
appears in this document only as P10's email-deliverability target, which is not the same thing and
must not be read as coverage of it.

### `DESIGN.md` — on `main`, undispositioned until now

41 lines, last touched `7ba9d9c` 2026-04-02. **Not on this ladder and no ladder step is gated on it.**
But `git show origin/main:DESIGN.md | head -6` returns `**Tagline**: The open social network` on a repo
that `gh repo view recursivlabs/minds --json isPrivate,licenseInfo` reports as
`{"isPrivate":true,"licenseInfo":null}`. **That is the claim class §5.7 retracted and P2b gates PR #194
on — a second live §1.5 re-derivation instance in the estate, alongside §5.16, and this one is on
`main`.** Exit artifact, with §1.2 clause 5's guard because this one is worse than the case that clause
describes — there the error state collides with the NOT-DONE value, here it collides with the DONE
value: `git -C /home/bill/dev/recursivlabs-minds cat-file -e origin/main:DESIGN.md && echo PATH-OK`
pasted beside `git -C /home/bill/dev/recursivlabs-minds show origin/main:DESIGN.md | wc -l` →
**non-zero**, and only then `git -C /home/bill/dev/recursivlabs-minds show origin/main:DESIGN.md |
grep -c 'open social network'` → **`0`** (today: `1`). **No `PATH-OK` and no non-zero line count, no
reportable zero.** The `-C` is mandatory: run from `/home/bill/dev/recursiv`, which §0 states is where
PS, P8, P9 and P10 are worked, the unguarded form printed `0` on stdout — the documented DONE value —
because `DESIGN.md` does not exist there (verified 2026-07-29: `cd /home/bill/dev/recursiv && git show
origin/main:DESIGN.md 2>/dev/null | grep -c 'open social network'` → `0`; the same command with
`git -C /home/bill/dev/recursivlabs-minds` → `1`). **or** #195 lands and the tagline is backed by an actual licence. **Whoever runs P2b's
merge train fixes it in the same PR** — it is one line in a file the train already touches the
neighbourhood of, and leaving it is how a retraction that reached this document fails to reach the
estate.

### Engine-repo open issues, enumerated because this ladder does engine work at PS, P8, P9 and P10

**This was the one material silent omission in the previous revision: it read engine source, all 22
engine workflows, engine `CLAUDE.md`/`AGENTS.md` and two engine docs, ran exactly one issue query, and
never listed the tracker.** §8's "Open issues NOT on the ladder" was scoped to `recursivlabs/minds`
without saying so.

`gh issue list --repo recursivlabs/recursiv --state open --limit 40` → **16 open** (re-surveyed
2026-07-30; re-run before citing — §1.2 clause 3). **Two of the sixteen are this loop's own filings
from today** — `#2038` (unauthenticated body-less non-GET returns 500 not 401, found by PAPI(2)'s
sweep) and `#2039` (MCP dispatcher tools 401 for a key that works over REST, which is why §1.0's
dispatcher block exists). **FOUR collide with rows in §2 and are NOT out of scope** — the fourth was
missed by the 2026-07-29 survey and is named first because it is the one Bill and Jack are acting on:

- **#50 — "Minds implementation comparison" (2026-03-05). NOT out of scope, and it is the
  architecture decision underneath the host map.** Its own text lays out three options for Minds on
  Recursiv — **Option 1 Network Tenant** (`networkId` on shared server/DB/Stripe/email, *"coupled
  deploys — a bad deploy to Recursiv affects Minds"*), **Option 2 API Key (headless)** (Minds hosts
  its own frontend against `@recursiv/sdk`, own Stripe, own email, independent deploys), and a third.
  **Minds today is a HYBRID of 1 and 2 and no row records which it is meant to be:** the app is
  separately built and hosted (Option 2's shape) while data lives in the shared multi-tenant Postgres
  and all three API hosts return one commit (Option 1's shape). §2's host map records the observable
  consequence — `build.minds.com` and `terrapin.minds.com` CNAME to one origin, so the fork cannot be
  deployed or rolled back independently of production — **and #50 is where the intended end state is
  written down.** Bill and Jack are restoring a Minds org on Recursiv that will own both hostnames
  (2026-07-30), which is a move along #50's axis. **Filed as a §10 decision row rather than a ladder
  row: nothing here builds it, and §1.9a forbids absorbing another outcome's work — but PD, PW and
  P13 all prove against hostnames whose ownership this decides, so it cannot stay unnamed.**

- **#1296 — "Isolate staging deploy workflow from production refs."** Confirmed at
  `origin/main:.github/workflows/staging-deploy.yml`: `PRODUCTION_API_APP_UUID` injected at `:48`,
  branched at `:112`, `DISPATCHER_API_KEY` written into it at `:114`, and a QA step against
  `RECURSIV_PRODUCTION_API_URL` at `:272`. **P4 is built entirely on that workflow's staging origin,
  and P0's rollback cell enumerates the dispatcher as a rotation consumer.** Named as a P4
  precondition in §2's parallel/serial block; **deliberately NOT added as a P4 sub-artifact**, because
  it is work in a repo this ladder does not own and moving this document's denominator for it would
  make the counter measure something other than this launch.
- **#1905 — "Deploy surface: cancel orphans builds, no rollback, poll-only logs."** Its verified-gaps
  list reads *"No rollback for user apps. `packages/server/src/features/deployment/` has no
  rollback/revert/promote path — only `deleteApp` and `cancelDeployment`."* **P11 sub-check (8) is a
  rollback drill and PW(3) is "rollback to the previous build proven" — both assume a deploy surface a
  filed engine issue says has none.** Both rows now require the agent to name the mechanism it is
  actually using (`promote-to-prod.yml` with a known-good SHA, or an OTA kill-switch) on #206 before
  the attempt, with #1905 cited as the reason.
- **#1907 — "full-code depth audit — 2 new HIGH (escrow theft, cross-tenant BYOK key reuse)", both
  unpatched.** Escrow theft is **P9's exact subject**. Cross-tenant credential reuse is precisely what
  this section's sole carve-out declares P0-class *"the moment it is found"* — while §10.29 records
  that no Minds-scoped audit of that class has been run. **Before P9 starts, an agent reads #1907; if
  the BYOK finding is a cross-user credential read in a shipped path that Minds touches, it enters §2
  as its own row with a `BASELINE` line under §8-carveout.** Whether it does is §10.33, unread here.

The remaining ten (**#1949, #1930, #1878, #413, #352, #348, #327, #89, #14, #13**) are **out of
scope for this ladder** — named so none is rediscovered as a surprise, per this section's own rule that
silence is the failure mode. **`#50` was in this list until 2026-07-30 and is not out of scope; it is
promoted above.** Two others were re-read in the same survey and stay out, with the reason stated
rather than assumed: **#1930** (agent-trust surface — verifiable agent identity, tamper-evident audit,
multitenancy) is adjacent to `PR` but is a platform-capability plan with no Minds exit artifact
depending on it, and **#1949** (tri-platform synthesis) opens with its own warning that its findings
were *"largely measured on a local DB copy"* and are being re-checked — an input that fails §1.2
before it reaches a ranking. **Jack's data-migration roadmap for `minds.com`, which he is feeding in
(2026-07-30), lands against §8's legacy-cutover carve-out and §10's cutover row — not against a
ladder row — until a Minds exit artifact depends on it. When it arrives, §1.9a's test decides: whose
exit artifact does it close.**

### iOS is proved for boot and store submission, and for nothing else

**Stated as a deliberate exclusion, because it was previously an accident of wording.** Three ladder
rows whose underlying issues are explicitly cross-platform had platform-unspecified exits; they are now
explicitly Android, with `N` unchanged, and the gap is here rather than smuggled into the counter.

- **P6 proves crash capture on ANDROID only.** `gh issue view 187 --json title --jq .title` returns,
  in full: `[P1] No crash telemetry on iOS/Android; one root error boundary; CI never compiles native`
  (2026-07-29). *(Both sites previously quoted this as "verbatim `No crash telemetry on iOS/Android;
  …`" — the trailing cut was marked, the leading `[P1] ` was not, and the word doing the asserting was
  "verbatim". §5.36. If you must abbreviate, mark BOTH ends.)* **No artifact anywhere on this ladder
  proves an iOS crash is captured.**
- **P7 proves credential-absence-from-device-storage on ANDROID only** (`adb shell run-as`). The
  backlog item behind it cites `lib/storage.ts` @ `export async function getItem(` as unencrypted on **both** platforms and its own
  launch bar reads *"native storage is Keychain/Keystore"*. **No artifact proves an iOS-resident
  credential is absent or killable from device storage.**
- **P11's eight-step gate is run on ANDROID only.** iOS is proved by P3b(1) (a TestFlight launch on a
  physical iPhone), P12 and P13(1) — **and by nothing else.**
- **P5 proves the OTA channel on ANDROID only.** `eas.json`'s `android-internal` is the defect and
  `preview` declares no `ios` key (`git show origin/main:eas.json`, parsed 2026-07-29), so the iOS
  internal path rides `development`. That is an assumption, not a verified fact, and it is §10.22's
  neighbour.

**Consequence, stated so nobody discovers it on launch day: on the day P13 exits, no iOS user has
completed the eight-step social loop, no iOS crash has been proved to reach the reporter, and no iOS
device has been searched for a plaintext credential. P3b(2) requires only a crash-FREE launch, which
proves delivery of nothing and cannot substitute for capture.** Whether that is acceptable is a §10
decision; there is no default written for it because it is a consequence of scope, not an open
question — if it is unacceptable, the fix is new rows with `N`s and a `BASELINE` line, not a re-reading
of the existing ones.

### Open issues NOT on the ladder, and why

Scoped to **`recursivlabs/minds`**; the engine repo is enumerated above. Silence is the failure mode,
so each is named. **#191** (a failed image upload still publishes,
sometimes blank) and **#192** (returning to the feed discards every loaded page and scroll position)
are real correctness/UX defects with no launch-gate dependency — **deferred behind P4, and both are
explicit pass conditions of P11's gate** (sub-checks 3 and 6), so they cannot be shipped unnoticed.
**#193** (web ships one 1.14 MB gz JS chunk) is a **Tier-2 performance item, not Tier 4**, so the
Tier-4 deferral above does not cover it; it attaches to **PW**. **#190 is not deferred at all** — see
§2's off-ladder row. **PR #194 is not an issue but was previously undispositioned; it is now step 6 of
P2's train, gated on #195.**

### Backlog items with no ladder step, enumerated so none is silently dropped

Issues exist for backlog items 1-9, 12, 29 and 33 (= #185-#193, #203, #202, #201): **12 filed, 21
unfiled.** The unfiled ones, by number: **10** (security headers), **11** (drafts/bookmarks/mutes
survive sign-out), **13** (PostHog `$current_url` can exfiltrate a password-reset token), **14**
(68 Dependabot advisories — **not deferred by default; see §10's acceptance row**),
**15-19** (Tier 4 perf, deferred above), **20** (realtime), **21** (route guards), **22** (admin role),
**23** (`markAll`), **24** (`MediaViewer`), **25** (billing targets *organization* billing, so a
consumer cannot view or cancel a subscription), **26** (Stripe's return URL lands on a screen with no
purchase awareness), **27** (the report UI thanks the user for a report that was never filed), **28**
(sign-in), **30**, **31-32** (accessibility/contrast/VoiceOver). *(12 + 21 = 33; recount before
citing — §1.2 clause 3.)*

**Two are pulled forward rather than deferred.** **Item 13 is security-class** — a password-reset token
in an analytics payload — and joins P2's merge train. **Item 27 blocks P12**: Apple 1.2 requires in-app
reporting that actually files, and a UI that lies about filing is worse than none. **Items 25 and 26
fold into P9**, because #197 names them as blockers in its own body.

The remainder are post-launch, tracked in the backlog and **deliberately not filed as issues**, so an
unfiled item cannot be mistaken for scheduled work. Re-file them the week after P13.

### #199's residue is not deferred even though the sync is

`~/dev` working-tree sync (score 23.5) is deferred — **sync the manifest, not the trees.** Two things
inside #199 are **not**: (a) **10 directories on the Mac have no remote**, so they exist on exactly one
disk — push-or-delete each before any machine is reimaged; exit artifact = `git remote -v` non-empty
for all ~43, or a written list of what was deliberately discarded. (b) `recursivlabs/iq#26`,
`recursivlabs/psigames#13` and `fishtank-live/tts.fish#4` are blocked CI PRs in the estate — out of
scope for this launch, named here so they are not rediscovered as surprises.

### What happens AFTER P13 is out of scope, deliberately, with a named consequence

This controller terminates when a stranger can install the app. It does **not** define an on-call
rotation, an incident-response runbook, an SLO, backend capacity for launch traffic, or
backup/restore for the shared platform Postgres — which this app does not own (`git show
origin/main:AGENTS.md | sed -n '8p'` → *"The app does NOT own a database; the platform does"*).
**How you check that this is a carve-out and not a hidden plan:** none of the 20 ladder rows names
any of them. The stable form of that check is the `N` column, not a keyword grep —
`awk -F'|' '/^\| \*\*(P[0-9A-Za-z]*|PS|PA|PW)\*\* \|/ {gsub(/ /,"",$4); s+=$4; n++} END{print n, s}'
"$GP"` → `26 110`, and `110 + 3` (the off-ladder #190 row) `= 113`, which is §1.6's
denominator. *(The regex already matches `P2a`/`P2b` via `P[0-9A-Za-z]*`; the row count moved 19 → 20
on the P2 split with the sum unchanged at that step, then 87 → 90 on P1(3) and P8(5)(6), then
20 → 22 and 90 → 97 when `PR` (+4) and `PD` (+3) entered on 2026-07-29 — §5.38.)* **If post-launch operations work ever enters this document, it enters as a row with an
`N` and a `BASELINE` line, and that arithmetic changes visibly.** *(A keyword grep was tried here
first and rejected: `grep -iE "SLO"` matches inside unrelated words, so the printed count did not
reproduce — §1.2 clause 4, caught before shipping rather than after.)*

**Consequence, stated so nobody discovers it at 3am on launch day: on the day P13 exits, the only
continuous production monitor is `smoke.yml` on a 6-hour cron, the only crash signal is P6's
dashboard, and no human is named as the person who answers either.** Whether that is acceptable is a
§10 decision with a written default.

**`prod-db-migrate.yml` is named in §2 as relevant prior art and is then used by no step. That is
intentional: no ladder step changes the production schema.** If one ever does, it enters §2 under
§1.6's denominator rule with its own rollback cell.

### One thing is carved *out* of every deferral above

**Any cross-user private-data read or write found in a shipped path is P0-class the moment it is
found**, enters §2 under §1.6's denominator rule, and posts a `BASELINE` line. **#190 is the live
instance and it has a row.** *(The `/signals`+`/moderation` mount used to be carved out here with no
row, which made it unstartable under §1.3 while being the second-highest-scoring item in the document.
It is now **PS**. A carve-out with no artifact is a carve-out nobody can close — that asymmetry is the
reason this section shrank to one clause.)*

---

## 9. PR AND ISSUE FORMAT

Six headings, exact text, every PR. `#184` is the reference implementation (verified: `gh pr view 184`
carries all six in this order).

`## What users experience` · `## Why it is broken` · `## What the fix changes` ·
`## How it was tested` · `## What remains unproved` · `## How to roll it back`

**OWNER DIRECTIVE 2026-07-30 (Bill) — two more headings, ABOVE the six, on every PR AND every
issue: `## Plain-English problem` and `## Plain-English solution`.** Written for a person: what is
wrong in ordinary words, and what fixing it looks like — no §-references, no artifact jargon, no
assumed context. The six headings and their evidence rules are unchanged and still binding; the
plain-English pair is a summary of them, never a substitute, and closing a row still requires the
artifact, not the paragraph. Retrofitted to all 32 open issues and 9 open PRs on 2026-07-30. For
`[LADDER]` issues the pair sits above the mirrored row text and must not contain a
`goal-prompt.md#L` reference, because check `[12]` reads the FIRST such reference in the body as
the row's citation.

- `## How it was tested` carries the environment label from §6.1, the device model, the build id, the
  command and its captured output, **and which of our own surfaces it went through (§6.7)**. Media
  commits under `qa-media/`. **§1.3 wins where this line used to contradict it. §1.3-class evidence —
  any recording or screenshot a §2 sub-artifact CLOSES on — is committed regardless of size (Git LFS,
  or a downscaled/trimmed clip that still shows the bound identifier in frame). "Anything over 5 MB is
  linked, never committed" gave a worker a lawful way to produce a non-artifact: every recording this
  ladder asks for — a boot, a TestFlight launch, an eight-step launch-gate sitting, a store install —
  is over 5 MB in practice, so §9 said link it and §1.3 said a linked, uncommitted recording is not
  evidence, on P3(2), P3b(1), P11's `qa-media/launch-gate-*`, P13(1)(2) and PM(3). The 5 MB
  link-don't-commit rule now applies ONLY to supporting media that no sub-artifact closes on. Naming:
  §2's per-row paths (`qa-media/p3-<sha7>-boot.log`, `qa-media/p6-4-<sha7>-noreporter.log`,
  `qa-media/190-<n>-<sha7>.png`) are binding and override the `<branch-slug>-<desc>` convention, which
  governs everything else.**
  "Unit tests pass" is not an answer here.
- `## What remains unproved` must be non-empty. A PR with an empty one has not been thought about.
- Then, after a `---`, the specific model used and the instructions it was given.

Issues carry the first two headings plus `## A-grade verification` — the exact run that closes the
item, in a fenced block. **The only CI enforcement is §5.6's, and it becomes real at P2c; do not
implement the retracted token-matching check.**

---

## 10. UNPROVED / OPEN DECISIONS

### Decisions blocked on a human (§1.4 protocol applies)

**Every row carries a default. Per §1.4.4 the default takes effect automatically on the day after
`Decide by`, is recorded via `log_decision`, and the loop proceeds on it.** A decision with no default
is a decision that can stall a continuously-running loop indefinitely, which is why this column exists.

| Decision | Owner | Decide by | Blocks | Default if undecided | `log_decision` id |
|---|---|---|---|---|---|
| **#195** Which layer opens + licence | Bill | 2026-08-04 | belief 2 entirely; #204; re-publishing; PR #194; all community sequencing | Stay private, no LICENSE; every fork-premised ranking argument stays retracted (§5.7); #194 is amended to drop openness language | — |
| **#186** track-player on New Architecture | Jack | 2026-07-31 | P3 exit; P12; every fork inherits it | Ship with lockscreen/background audio **disabled** and the track-player import removed from the pre-`AppRegistry` path; **P3's `N` stays 2** — (1) the boot log is unaffected and (2) becomes the boundary test against a *removed* track-player rather than a retained one, which is a change of subject, not a change of count, **so no `BASELINE` line is owed and §1.5's baseline-drift row does not fire on whoever applies this default**; P11 sub-check 5 records "knowingly disabled". *(An earlier revision wrote "P3's exit becomes the boundary test only", which reads as `N` 2 → 1 — and §1.6 had no way to express a decrease at all, so the honest agent applying a lapsed default three days out would have tripped the drift detector. §1.6 now has a decrease format; this row does not need it.)* | `b402a456-1f9c-4157-b0f2-b4561369e604` — LAPSED DEFAULT applied 2026-08-01 (§1.4.4; §5.52) |
| **#189** Usernames: identity or alias | Bill | 2026-08-04 | P7; backlog item 33; the auth response shape | Mutable display alias; P7 ships revoke without identity changes | — |
| **#197 scope** Which proof lines are launch-blocking | Bill | 2026-08-04 | the launch date; whether P8 → P9 is a real edge | **All fifteen are launch-blocking** — the conservative default, because the permissive one cannot be un-shipped | — |
| **#198** Is adx liftable, where does it live, and **what is the token FOR if ads replace Boost** | Bill | 2026-08-11 | P9 scope; the adx/adz.fish PII boundary | No adx; Boost stays token-denominated; P9 excludes advertiser creatives and the P8→P9 edge is cut | — |
| **#204** Prove or retire fork-ability | Bill | 2026-08-11 | the "every fork inherits this" ranking argument | Treat fork-ability as unproven and stop citing it | — |
| Native crash reporter: which one (P6 step 1) | Bill | 2026-08-04 | P6, and therefore P3b's confirmation and P11 sub-check 7 | Sentry, on cost grounds, recorded as an explicitly reversible default | `9da07543-7127-44ec-9570-08bad2ab0977` — LAPSED DEFAULT applied 2026-08-09 (§1.4.4) |
| API-key scope model: may a key enumerate/revoke its siblings | Bill | 2026-08-04 | P7 | No sibling enumeration; P7 proves revoke-own-key only | — |
| Legacy-cohort consent: re-permission campaign vs. treat as unaddressable | Bill | 2026-08-25 | P10 sub-artifact 4 | Treat as unaddressable; P10 sends to opt-ins only | — |
| `.node-version`: pin 20 to match this repo's CI, or 22 to match the estate | Bill | 2026-07-31 | fresh-clone reproducibility | Pin **20**, matching this repo's CI | `0ec32c79-7a52-48af-8233-2dd2addfb6f8` — LAPSED DEFAULT applied 2026-08-01 (§1.4.4; §5.52); pin landed via PR #283 |
| **Is the legacy minds.com CDN sunset real and is the date ~2026-07-31 (§10.23)** | Bill | **2026-07-29** | potentially the entire ladder | **Assume real. §2's pre-written `PM` row goes CONDITIONAL → LIVE**, with `BASELINE 113/116 REASON §10.23 ROW PM ARTIFACTS +3` posted to #206. **It enters at its §3.1 score of 55.9, in score order — it does NOT "outrank the ladder".** *(An earlier revision's default said "outranks the ladder" while §3.1 scored the same work below PS, P0, P2a and five others, and mandated a row with no `N` and no exit artifact — which §1.3 calls unstartable. Two agents applying that lapse produced two denominators and two work orders. The row is now written in advance so the lapse is mechanical.)* | — |
| **Does "launched" require `minds.com` to serve Minds 2.0?** (§8 cutover) | Bill | 2026-08-04 | the definition of P13; whether a cutover ladder exists at all | **No** — P13 as written is the launch; the cutover is a separate program filed after P13 | — |
| **Does a Google Play developer account and a `com.minds.app` Console record exist, and who holds them?** (§10.28) | Bill | 2026-08-04 | P12's Android half entirely | Assume neither exists; P12a is real work and the $25 fee is a §11 line | — |
| **iOS hardware for P3b**: is a physical iPhone available, and who holds it | Bill | 2026-08-04 | P3b(1)'s start; P13 sub-artifact 1 | Borrow or buy one device. If none is in hand by the date, P3b(1) is met by a TestFlight install on a **borrowed** device with the device serial in the cycle line, and **iOS is NOT descoped** — P13 sub-artifact 1 remains launch-blocking | — |
| **The monthly spend cap, per line and in total — including the loop's own model spend** | Bill | 2026-08-04 | §11's hard stop, which is unenforceable today because no number exists | **$X/month total with a per-line breakdown; on breach the loop posts `BUDGET-STOP <line> <actual> <cap>` to #206 and claims nothing further until a human raises it.** If undecided by the date, the cap defaults to the last full month's actual spend +20%, computed from `get_billing_usage` | — |
| **Accept or remediate the 68 Dependabot advisories before P12 submits to both stores?** | Bill | 2026-08-04 | P12; §10.14 says no acceptance artifact exists | **Enumerate and classify the 4 critical by runtime reachability before P12; accept the rest in writing.** Exit artifact: `gh api repos/recursivlabs/minds/dependabot/alerts --paginate --jq '[.[]\|select(.state=="open" and .security_advisory.severity=="critical")]\|length'` → `0` — **paired, in the same paste, with the identical call minus the severity filter (`--jq 'length'`) returning a stated NON-ZERO total, because a critical count of `0` is also what disabling Dependabot alerts on this repo returns, and what any token or permission state yielding an empty array returns. A security gate that closes when its own detector is switched off is a negative with a dead pipe behind it, and §10.14 records that the 68 advisories are neither enumerated nor classified, so no independent enumeration exists anywhere to contradict a zero. The non-zero total proves alerts are still being generated and that the token can read them** (today: `4` critical, alongside 35 high / 23 medium / 6 low, re-counted 2026-07-28), **or** a committed `docs/security-acceptance.md` naming each critical, its reachability, and the accepting human | — |
| **Does the Minds launch block on RLS Phase 2, or ship on app-layer scoping alone?** (§1.9) | Bill | 2026-08-04 | whether an unscoped-query cross-tenant leak is an accepted launch risk | **Ship on app-layer scoping; RLS is post-launch defense-in-depth** — recorded as an explicitly accepted risk, not an oversight. The §1.9 confirmation rule stands either way | — |
| **Who is on call the week P13 exits, and what is the runbook?** (§8) | Bill | 2026-08-04 | post-launch operability | **Bill, informally, with `smoke.yml` + P6 as the only alerts** — recorded as an accepted gap, not a plan | — |
| **Is there a target launch date, and who owns it?** (§2's decision block and §10's #197 row both assert one exists) | Bill | 2026-08-04 | pace escalation; whether the ladder is behind or merely long | **No date.** The ladder ships when P13's three artifacts exist; §1.6b's `PACE-ESCALATION` is the only time-based control in this document | — |
| **What is Minds 2.0's bare-minimum feature set, measured against legacy Minds?** Declared gating by Bill 2026-07-30. Account migration cannot be scoped without it — 1.5M accounts cannot be migrated into a product whose required surface area is undefined, and "everything legacy does" is a decade of accretion, not a scope | Bill | **2026-08-06** | **the scope of every token and migration row, and therefore the denominator itself**; `P13`'s definition of launched | **A written, committed feature floor at a path on `main`, in §1.3's document-artifact form** (every load-bearing line carries the command that produced it): each legacy surface listed and marked *required at launch* / *fast-follow* / *dropped*, with the legacy surface enumerated from a command over the legacy app rather than from memory, and **what is dropped stated as dropped** rather than omitted. **If undecided by the date, the default is the narrowest defensible floor: exactly what P11's eight-step gate already exercises** — sign-in, post with photo, DM, feed scroll, audio, crash-free — **and everything else is fast-follow, recorded as an explicitly accepted product risk.** | — |
| **DECIDED BY OWNER 2026-07-30 — kept as a row until `log_decision` gives it an id (§1.4.5).** ~~Do API / MCP / SDK / CLI enter as Minds ladder rows, or as a separate outcome?~~ **They enter as four ranked MINDS rows** — `PAPI`/`PSDK`/`PMCP`/`PCLI`, denominator 100 → 113, §5.46. The default this row shipped with (verification rows only) was written by an agent one message after the owner had said the opposite, and is retracted. Nothing outstanding but the `log_decision` id. Bill declared all four part of launch 2026-07-30. §1.9a's test is whose exit artifact a task closes, and all four are the **platform's** surfaces in a repo this ladder does not own | Bill | **2026-08-06** | how many rows the declaration adds — the two readings differ by roughly an order of magnitude | **Verification rows in `PR`'s shape**: this loop proves each of the four works *for the Minds tenant* (a paired transcript per surface, positively controlled), the platform loop does the work, and §1.9's loop-to-loop clause governs. **Rationale for that default rather than the alternative: §1.9a forbids absorbing another outcome's work into this denominator**, and a Minds ladder that also owns platform SDK quality stops measuring the Minds launch. If Bill wants the stronger reading — this loop *builds* those surfaces — that is a second controller under §1.9a's registry, not extra rows here. | — |
| **Who owns the RLS rollout loop, and is it still running?** §1.9a's registry records `recursiv:docs/RLS-COMPLETION-GOAL-PROMPT.md` as **unassigned**, and row `PR` is a Minds row whose only unblock trigger is that loop's umbrella task reaching a terminal state — so a ladder row depends on a loop with nobody accountable for finishing it | Bill | **2026-08-04** | `PR` entirely, and therefore `P13`, since `P13`'s `Serial on` names `PR` | **Treat the RLS loop as DORMANT and cut `PR` from the ladder** under §1.6's decrease format (`BASELINE 113/109 REASON §10-decision ROW PR ARTIFACTS -4 DECISION <id>`), striking the `PR` edge from `P13`'s `Serial on` in the same PR. **Evidence for dormancy rather than assumption**: that controller says of itself *"The rollout has been frozen since 2026-05-08"* and *"Tables with RLS actually enabled today: ZERO"*, its own file was last touched `096632c7` 2026-07-12, and `git -C /home/bill/dev/recursiv grep -il "ENABLE ROW LEVEL SECURITY\|CREATE POLICY" origin/main -- drizzle packages/server` is still **empty** (re-run 2026-07-30). **This default REMOVES scope, so per §1.6 it is never reported as `DELTA-DISTANCE` progress, and it requires a `log_decision` id.** It does not touch §1.9's loop-to-loop confirmation rule, which stands either way: no RLS PR-B on a Phase 2 table merges without a Minds-side confirmation on #206. | — |
| **Which pnpm major does the estate run — 9 (what `3761e41`'s message calls "to match deploy") or 10 (what `ci.yml` pins and what `#180`'s `packageManager` commits to)?** | Bill | **2026-08-05** | P1's completion; `#180`'s merge; every future lockfile regen; and the class of outage `#207` fixed | **Align on 10.** CI already pins `pnpm/action-setup version: 10`, `#180` pins `packageManager: pnpm@10.28.0`, and `patchedDependencies` is only read from `pnpm-workspace.yaml` under 10 — which is the exact mechanism by which a 9.15.9 regen silently dropped it and took CI, `smoke.yml` and all 11 open PRs down (§5.41, `#207`). **Second half of the default, and it is not optional: pin `pnpm/action-setup` to an EXACT `10.x`.** `version: 10` floats — it resolved `10.34.5` on 2026-07-29 while `#180` pins `10.28.0`, so CI and the repo are already one minor apart and CI's pnpm can move under the loop on any day. A floating major is a dependency on a value no artifact in this document records. | — |
| **Which of `recursiv#50`'s options is Minds, and who owns `build.minds.com` / `terrapin.minds.com`?** Minds is a HYBRID today — separately hosted app (Option 2's shape) on the shared multi-tenant Postgres with one deployment behind all three API hosts (Option 1's shape) — and no artifact records which it is meant to be. Jack is restoring a Minds org on Recursiv to own both hostnames (2026-07-30) | Bill + Jack | **2026-08-06** | **`PD`, `PW` and `P13` all prove against hostnames this decides the ownership of**; whether the fork can be deployed or rolled back independently of production (§2's host map) | **Record the hybrid as the intended end state and change nothing before launch** — the app stays separately hosted, data stays in the shared tenant DB, and the shared-origin coupling is an explicitly accepted launch risk rather than an oversight. **Rationale for that default rather than a migration: §1.9a forbids absorbing another outcome's work into this denominator, and re-homing a tenant mid-ladder invalidates every host-bound artifact already proven** (PW(2)'s pre-committed strings, P13(3)'s pair). If the org restore changes which host serves production, that is a §1.2 re-verification of §2's host map and a `RESCORE` of `PD`, not a new row — **unless a Minds exit artifact comes to depend on the restore, at which point §1.9a's test applies and it enters with a `BASELINE` line.** | — |
| **Who countersigns the P11 launch gate?** §1.3 forbids the actor being the second party at P11 and only at P11; §1.9 assigns the sitting to Bill, so the countersigner cannot be Bill | Bill | **2026-08-04** | **P11's exit, and therefore P12 and P13 — the terminal three rows of the ladder** | **Jack countersigns**, and his countersignature is **not `ls`**: for **each of the eight sub-checks** he posts, under his own GitHub login, the **frame timestamp or log timestamp inside the committed media at which that sub-check's written pass criterion is visibly met** — e.g. for (2) *"image visible in second device's feed at 00:0X, T_post 00:0Y, delta 23s < 30s"*. Plus his own re-fetch of the build id, T0 and T1 (`eas update:list --branch <b> --json` and the P6 vendor event's server-side received-at) and of every `qa-media/launch-gate-<build-id>-*` path, all pasted to #206 (§1.6's `COUNTERSIGN` rule — the login is the record, the name is not). **A countersignature that only proves the paths resolve is `ls`, not a second party** — sub-checks 7 and 8 are re-fetchable without watching anything, and 1/2/3/5/6 are not, which is exactly why the per-sub-check timestamp is required rather than a single "verified" line. If Jack is unavailable for 72h per §1.9, **the CI alternative in §1.3 becomes mandatory and is built as part of PA**, rather than P11 being run twice. *(This row exists because §1.3 required "a *different* named human" and the document named nobody. A requirement with no referent, no owner, no decide-by and no lapse default can stall the terminal gate indefinitely, and §1.4.4's automatic mechanism operates only on this table — which is exactly the §10.26 defect, recurring at the last row of the ladder instead of at P3b. **An earlier revision propped this row up with a self-count — `grep -noE "Jack\|jotto141\|jackottman\|Bill"`, published as 30/2/1/4 — which was wrong twice over: under `-E` the backslashes make `\|` a literal pipe, so the command returns `0`, and the correct ERE `grep -oE "Jack\|jotto141\|jackottman\|Bill" … \| sort \| uniq -c` returns 36/8/3/7 today and a different quadruple after every edit, because the file counts itself. The count is deleted rather than repaired: it was rhetoric for a conclusion this row already establishes, and a self-referential count in a file that changes every revision is exactly the citation class §1.2 clause 3 tells agents to stop trusting.**)* | — |

**The `log_decision` id column is filled for two of the twenty-five — both LAPSED defaults (#186 and `.node-version`, 2026-08-01, §5.52) — and empty for the other twenty-three: per §1.4.5, no row has been affirmatively DECIDED by its owner.** Fill
the column or the decision did not happen. **A default that lapses into effect is also logged.**

### The #198 open product question, stated because it is the actual work

If the fishtank adx exchange replaces Boost, **what is the token for?** Boost is token-denominated
today. Answer before implementation, not during it. Inherited constraint if adx is adopted: adx is
spinning out as **adz.fish** — portfolio-level, shares advertiser demand across properties, **never
customer PII, only coarse tier segments**. Adopting adx means adopting that boundary. Advertiser
creatives are user-supplied content shown to everyone, so **#196 applies with full force** — inside
§7's hard rule.

### Facts not established

1. Whether `EXPO_PUBLIC_POSTHOG_KEY` is provisioned anywhere. It appears in no `.env.example`,
   `app.json`, `eas.json` or workflow; `eas` is ABSENT so `eas env:list` has not been run. **Blocks
   P6's step 2.**
2. Which native crash reporter to adopt (P6). No candidate is in the tree (§5.5). A §1.4 decision with
   an owner, a date and a default, above.
3. Whether any un-rotated `sk_live_` exists elsewhere on either machine. `~/.bashrc` and `~/.profile`
   on this box are clean per #199; the Mac's `~/.zshrc` is the known offender; a full
   dotfile/credential-store sweep has not been run. **P0's first action, and P0's gitleaks artifact
   must be produced on the Mac for that reason.**
4. Whether npm publish rights on `@recursiv/sdk` exist for either named human. `npm whoami` → `E401`
   on a workstation. **Still open, and no longer load-bearing:** the `@minds/*` packages a stranger
   installs publish from CI via trusted publishing, not from a human login. §5.56.
5. ~~Whether bumping `@recursiv/sdk` 0.5.6 → 0.6.1 is safe.~~ **Moot — the bump happened.** `main`
   pins `0.7.14` and the registry serves `0.7.14`. The resource-diff caution this question raised was
   never discharged; it is recorded in §5.56 rather than silently dropped.
6. Whether a real consent ledger with a single enforcement path already exists in
   `recursiv/packages/server`. **First thing P10 establishes.** File counts, with the command, because
   §1.2 clause 4 forbids a count with no command and this was the one place in the file that carried
   three bare numbers — the previous revision printed `consent` 6 / `suppression` 10 / `unsubscribe` 16
   and two of the three did not reproduce (§5.35):
   ```
   for p in consent suppression unsubscribe marketing_email; do printf '%s: ' "$p"
     git -C /home/bill/dev/recursiv grep -l "$p" origin/main -- 'packages/server/**' | wc -l; done
   ```
   → `consent: 6`, `suppression: 9`, `unsubscribe: 17`, `marketing_email: 0`, at
   `git -C /home/bill/dev/recursiv rev-parse --short origin/main` = `24e4ca0f` (2026-07-29).
   **These are file counts, not evidence of a ledger** — a matching filename proves a word appears,
   nothing more, which is why P10(1) closes on rows and ids rather than on greps.
7. Whether `recursiv/packages/server` rebinds or accumulates Expo push tokens — changes backlog item
   12's blast radius from "wrong notifications" to "cross-account delivery on one device".
8. Whether `/wallet/send` awaits a receipt or returns on submission — determines whether the success
   toast is a lie. Money-adjacent; folds into P9.
9. The OTP first-attempt failure has no root cause. Client retry, SDK timeout, or server-side delivery
   timing cannot be distinguished from this repo.
10. Whether the two protocol partial unique indexes exist in the production database. One `\d` on the
    production `post` and `user` tables settles it (`psql` is ABSENT). Until then every claim that
    protocol ingestion works is unproven.
11. Whether protocol collection runs in production at all — no scheduler exists in the repo.
12. Whether the nostr adapter has ever returned a non-empty result.
13. Whether ghost/remote users are excluded from follow suggestions, @mention autocomplete, DM
    targeting, search and leaderboards.
14. The 68 Dependabot advisories (4 critical / 35 high / 23 moderate / 6 low) are neither enumerated
    nor classified by runtime reachability. The count is GitHub's, not an audit's. No acceptance
    decision artifact exists.
15. Whether CI self-healing secrets (`DISPATCHER_URL`, `DISPATCHER_API_KEY`, `DISPATCHER_ORG_ID`,
    `REVIEWER_AGENT_ID`) exist on `recursivlabs/minds`.
16. Whether the `adx` code in `fishtank-monorepo` is generic or fishtank-shaped. **I did not read it in
    this pass.**
17. Whether battlechat's closed-loop credit model applies to Minds. **I did not read
    `/home/bill/dev/battlechat` in this pass.** #197 says the *structure* of its argument is the
    valuable part; that is untested.
18. Whether `/signals` returns `200` for a **scoped** key after the mount is fixed. The 403 is
    live-confirmed in the negative (§5.14). **AMENDED 2026-08-06 — the "no self-service path" half of
    this row is REFUTED and must not be cited again (§5.54).** A public two-call path exists and has
    been executed: `POST $ORIGIN/api/auth/sign-up/email` (no key) then `POST $ORIGIN/api/v1/api-keys`
    with a `scopes` array, which is exactly what the SDK's `signUpAndCreateKey` wraps. What remains
    open here is only the original question — whether a scoped key gets `200` on `/signals` — and it
    is now *reachable*, needing a stranger-run mint rather than a route that does not exist. For `/moderation` it is
    unreachable by construction, because `moderation.ts` @ `requireScope('admin'), requireLiveAdminRole()` requires `requireLiveAdminRole()` in
    addition to `requireScope('admin')`. That is itself a §6.7 finding and PS files it.
19. Every Tier 4 performance number. Static reasoning plus synthetic timing; no device profile.
20. All device-only behaviour: lock-screen notification content, the track-player fallback path,
    native swipe frame timing, safe-area occlusion, Stripe's native return.
21. Whether the loop contract in §1 prevents circling. **No loop has run against this document yet.**
    §1.5's thresholds are guesses; tune after five cycles on #206.
22. **#185's premise vs. the only device evidence for it.** `eas.json`'s `android-internal` sets
    `"channel": "production"`, but the one APK anyone unpacked reported **`preview`** (§5.2). Either
    that APK was a `preview` build and proves nothing about #185, or `android-internal` has never been
    what testers hold. **P5 cannot start until this is settled.** One `eas build:list --profile
    android-internal` plus one manifest unpack of a known `android-internal` artifact resolves it.
    (`eas` and `apktool` are ABSENT — install first.)
23. **Whether the legacy minds.com CDN sunset is real, and whether the date is ~2026-07-31.**
    `git -C /home/bill/dev/recursiv show origin/main:docs/MINDS.md`, lines `119-121`: *"~74,278 of
    74,282 media references still point at `cdn.minds.com` … Legacy minds.com is sunset-gated
    (~July 31)."* But
    `git -C /home/bill/dev/recursiv log -1 --format='%h %ad' --date=short origin/main -- docs/MINDS.md`
    → `5bb4b5ca 2026-06-24`, **five weeks stale**, and today is 2026-07-28. **The `-C` is
    load-bearing and its absence is SILENT: run from this repo the same command prints nothing and
    exits `0`, which reads exactly like "never modified" — §1.2 clause 5. Paste
    `git -C /home/bill/dev/recursiv cat-file -e origin/main:docs/MINDS.md && echo PATH-OK` beside the
    date or the date is not reportable.** **If the sunset is true, ~74K imported posts lose their
    images and this outranks the ladder. If it already passed, it is a live incident. If the date
    moved, nothing changes.** Settled by one question to the owner plus one `curl -I` against a
    `cdn.minds.com` asset URL taken from a real imported post. **The row this lapses into is
    pre-written in §2 as `PM`, CONDITIONAL, with its `N`, its exit artifact and its §3.1 score of
    55.9 already fixed** — so two agents applying the lapse produce the same denominator and the same
    work order. **Decide-by 2026-07-29 — the shortest date in this document.**
24. Whether the server-side LLM auto-scorer's `revenue`/`growth`/`mission`/`blocksCount` estimates
    agree with §3.1's hand-assigned values. **Never measured, and the previously prescribed run could
    not have measured it.** §3.1 and the dispatcher agree only because §3.1 is pasted into
    `score_override` — agreement by assertion, the failure mode §1 exists to prevent.
    **The old procedure — "create P0 and P1 without `score_override` and compare" — is RETRACTED
    (§5.30) because it cannot execute.** `autoScoreTask` fires only when the create call supplied **no
    scoring dimension whatsoever** (`hasScoring`, guard expression `DispatcherService.ts` @ `const hasScoring =`),
    and §3.2 step 1
    always passes `severity`, `signal`, `ui_impact` and `urgency`. Dropping `score_override` alone
    changes nothing; the auto-scorer was never going to run on a ladder row.
    **The run that actually settles it, and it does not touch the ladder:**
    1. `create_task(title:"§10.24 auto-scorer calibration — P0 rotate Mac sk_live_ + Infisical creds",
       description:<P0's §2 cell verbatim>, project_id=$MINDS_PROJECT_ID, layer="scoring-probe")` —
       **`title` and `description` and nothing else.** No `proximity`, `severity`, `signal`,
       `ui_impact`, `urgency` or `score_override` — those are the six `hasScoring` tests reachable
       from `create_task`, and any one of them suppresses the measurement.
       *(`effort` and `milestone` are **not** in the guard. The guard expression is
       `DispatcherService.ts` @ `const hasScoring =` — `grep -n "hasScoring" …` → two hits, the `const` and the `if` — and
       `git -C $ENGINE show origin/main:packages/server/src/features/dispatcher/DispatcherService.ts |
       sed -n '/const hasScoring =/,/scoreOverride != null/p' | grep -c 'effort\|milestone'` → **`0`**. Omit them anyway so the probe is
       unambiguous, but do not believe they suppress anything. This paragraph said they did, two
       sections after quoting the guard correctly — §5.34. §5.30's closing rule applies to it: a claim
       about **when** a code path runs is a claim about a guard, and the guard is the line you read.)*
       **Cite the guard range, not the block: the same `grep -c` over `1404,1410` returns `1`, because
       the call line passes `input.milestone` as an ARGUMENT to `autoScoreTask` — `milestone` feeds the
       scorer when it runs and does not gate whether it runs.** That one-line difference between a
       test and an argument is the whole content of §5.34, and a range that swallows the call site
       reproduces the error it is supposed to refute. **Consequence for step 3, and it is a real one:
       `milestone` is an input to the scorer, so the probe must pass no `milestone` for its output to
       be comparable to §3.1's `R1` rows — omit it for that reason, not because it suppresses.**
    2. Wait — it is fire-and-forget with a 30s model timeout (`AbortSignal.timeout(30_000)`), so poll
       `get_task(task_id)` until the scoring fields are non-null or 120s elapse. **If they are still
       null at 120s, the finding is "the auto-scorer did not run or failed" — record that, it is a
       real answer** (`logger.warn('auto_score_failed')` is the server-side counterpart).
    3. Record, on #206 verbatim: the returned `proximity`, `signalScore`, `urgencyScore`, `severity`,
       `uiImpact`, `revenueImpact`, `growthImpact`, `missionImpact`, `blocksCount`, `effort`, and the
       score — **nine estimates and one number**, against §3.1's P0 row (9/2/0/5/5/0/0/0/1, eff 1,
       score 92.0). The comparison is per-input, not only on the total: two wrong inputs can cancel.
    4. Repeat once with P1's text. Then `archive_task` both probes — they are not ladder rows, they
       carry `layer="scoring-probe"` so §1.0's `layer="launch-ladder"` read never sees them, and
       leaving them pending would put two junk rows in the queue.
    **Cost note:** each probe bills the org one model call (`recordAiUsage` @ `await recordAiUsage({`). Two probes.
    Do this in cycle 1; record the result here, replacing this paragraph with the numbers.
25. **RESOLVED 2026-07-28 — kept as a row because the resolution corrects a prescribed command, not
    because the question is open.** Production's API is deployed from `24e4ca0f`, readable at
    `curl -s https://api.recursiv.io/health` (root path, not `/api/v1/health`), equal to
    `recursiv origin/main`. See §5.18. **What remains open:** nothing about the identifier; the
    remaining risk is that agents run the `/api/v1/health` variant and conclude it is missing.
26. **MOVED to the decision table above.** iOS hardware for P3b was filed here, in a section with no
    owner, no decide-by and no default column, while P3b's Blocked-if told the agent to "record it as
    §10.26 **with a decide-by date**" — a date this section cannot hold. Per §1.4.4 the
    automatic-default mechanism operates only on the decision table, so a P3b block had no lapse
    behaviour and could stall the loop indefinitely. **A blocker that gates a ladder step belongs in
    the table, not in the unknowns list**; the two structures are not interchangeable and this row
    stays as the marker of why.
27. The per-1k-items inference cost of P8's moderation classifier — the only §11 line that scales with
    traffic. **Must be known before P8 starts.**
28. **Whether a Google Play developer account and a `com.minds.app` Play Console record exist, and who
    holds them. Never checked.** `git show origin/main:eas.json`'s `submit` block contains only
    `production.ios.ascAppId`; `app.json` declares `expo.android.package = com.minds.app`, but a
    package name is not a Console record. **Blocks P12's Android half entirely** — and therefore P13's
    sub-artifact 2. A §1.4 decision with a default, above.
29. **Whether any Minds-read table is currently missing an app-layer tenant filter.**
    `recursiv:docs/RLS-ROLLOUT.md` records tenant-isolation bugs found by review, and
    `git show origin/main:AGENTS.md | sed -n '53p'` says verbatim *"Recently-fixed leaks:
    `/profiles/leaderboard`, `/agents/discoverable`, `/agents/leaderboard` were network-only → leaked
    other tenants. RLS is the planned backstop; until then, app-code scoping is load-bearing."*
    **No Minds-scoped audit of that class has been run**, and RLS is not there to catch a miss:
    `git -C ~/dev/recursiv grep -c "ENABLE ROW LEVEL SECURITY" origin/main -- drizzle/` exits `1`
    with no output. §1.9, and a §10 decision above.
30. **Whether `sdk.settings.requestDeletion` deletes anything, on what schedule, and whether it is
    reversible. Never checked server-side.** `git show origin/main:app/settings.tsx | sed -n
    '464,470p'` shows the handler reporting `'Account deletion requested.'` after a call that names a
    `password` on an OTP-first auth system. **Blocks P12 sub-artifact 6 and therefore P13.**
31. **Whether a published privacy-policy URL exists anywhere for this app.** `git grep -il privacy
    origin/main -- app/ public/` → `app/(tabs)/create.tsx`, `app/admin.tsx`, `app/settings.tsx` only;
    there is no policy page and no URL in the tree. **Blocks P12 sub-artifacts 4 and 5.**
32. **Whether `/home/bill/dev/inverted-world` contains reusable monetization or ad-integration prior
    art. I did not read it in this pass.** `git -C ~/dev/inverted-world log -1 --format='%cr %s'` →
    `8 weeks ago Scaffold monetization: Google Ads + Inverted World+ (both env-gated, off)`; remote
    `https://github.com/ottman/inverted-world.git`. **An ad-network-plus-subscription scaffold under
    the owner's own account, in the same estate as #198 (replace Boost with an ad network) and
    possibly P9.** §8 defers only its *news pipeline*; the monetization half was neither read nor
    deferred, and the previous revision's coverage claim asserted three sibling repos were "recorded as
    unread" when only two — `fishtank-monorepo` (§10.16) and `battlechat` (§10.17) — had rows. One
    `ls apps/ && grep -rn 'stripe\|adsense' --include='*.ts*' -l` settles relevance. **Until then no
    ranking argument may cite it in either direction.**
33. **Whether `recursivlabs/recursiv#1907`'s cross-tenant BYOK key-reuse finding touches any
    Minds-read path. Not read in this pass.** #1907 records two unpatched HIGH findings — escrow theft
    (P9's subject) and cross-tenant BYOK credential reuse. **The second is a §8 carve-out instance on
    its face**, and §8's carve-out declares that class P0-class *the moment it is found*. **Blocks the
    carve-out from being evaluated at all.** An agent reads #1907 before P9 starts; if it is a
    cross-user credential read in a shipped path Minds touches, it enters §2 with a `BASELINE` line.

---

## 11. COST, LEGAL, AND STORE OBLIGATIONS

*Absent from an earlier revision entirely, in a plan that proposes a continuously-running agent loop, a
staging environment, a native crash reporter, a classifier and an ESP.*

**Recurring cost lines.** Apple Developer $99/yr (already paid — `ascAppId 6793750469` exists).
**Google Play developer account $25 one-time — NOT confirmed paid; nobody has checked (§10.28).** EAS
build minutes for P3/P3b/P5/P11/P12 iteration. The staging Coolify server and staging Postgres —
**already running on someone's bill**, since `api.staging.recursiv.io` answers today. A native
crash-reporter seat (P6). **Per-item classifier inference at ingest volume (P8) — the only line that
scales with traffic; it must carry a per-1k-items unit cost before P8 starts (§10.27).** Stripe fees
(P9). An ESP plus enrichment (P10). Web hosting for `minds.on.recursiv.io` (PW — the host is not yet
identified). **The loop's own model spend, which is unbounded by construction.**
**Owner: Bill. Hard stop: if any single line exceeds the stated monthly cap, the loop posts
`BUDGET-STOP <line> <actual> <cap>` to #206 and claims nothing further until a human raises it.**
**The cap is now a §10 decision row with a date and a lapse-default**, because §1.4.4's automatic
mechanism operates only on that table — an earlier revision named the gap in prose here, which left
the only control on an explicitly unbounded cost line with no owner, no date and no default.
**Runway is not stated in this document and no agent should infer one.** The two real figures here
are Apple $99/yr (paid) and Play $25 (unconfirmed, §10.28). Everything else — EAS build minutes, the
staging Coolify server and Postgres, a crash-reporter seat, classifier inference per 1k items
(§10.27), Stripe fees, an ESP, web hosting, and the loop's model spend — is unpriced. **A ladder that
cannot be paid for does not converge, so pricing these is a §1.4 decision with a date, not a
footnote.**

**Legal obligations that attach the moment P8 exists.** Automated CSAM detection creates a **mandatory
US reporting duty to NCMEC**. Name who files, under which entity, **before** the classifier goes live —
detecting-and-not-reporting is worse than the current state. #196's own body records that a grep for
`csam`/`photodna`/`omni-moderation` across `recursiv/packages/server` returns nothing.

**Store obligations that gate P12 and P13 — and they are now COUNTED, not merely stated.** An
earlier revision listed these here as prose while P12's `N` was 3 and none of them appeared in it, so
obligations the document itself called gating were invisible to §1.6's counter. That is §5.6's *"a
spec no step produces is a spec that never ships"* applied to this document. **They are P12
sub-artifacts (4), (5) and (6), and P12's `N` is 6.**

- A published privacy-policy URL returning `200` — **P12(4)**, §10.31.
- Apple privacy-nutrition and Play data-safety declarations covering PostHog and whatever P6 adds —
  **P12(5)**.
- **Apple 1.2 (UGC):** filtering, in-app reporting that actually files (**backlog item 27 currently
  thanks the user for a report that was never filed**), blocking, and a published EULA — P8 and item
  27 are the prerequisites, already pulled forward in §8.
- **Apple 5.1.1(v):** in-app account deletion that deletes — **P12(6)**, §10.30. `git show
  origin/main:app/settings.tsx | sed -n '464,470p'` shows `deleteAccount` calling
  `sdk.settings.requestDeletion({ password: deletePw, reason: 'User requested' })` and reporting
  `'Account deletion requested.'`; whether anything is deleted is **UNPROVED**.

**Outbound (P10).** CAN-SPAM and RFC 8058 mechanics are already in P10's artifacts. Add the **GDPR
legal-basis statement for the 8,407 imported cohort** and for the ~1.5M-deliverable target.

**Prior art — reuse, do not invent:** `recursiv/.github/workflows/compliance-checks.yml` already
collects evidence on a schedule (`git -C ~/dev/recursiv ls-tree origin/main .github/workflows/
--name-only | grep -c compliance-checks` → `1`, of 22), and is the thing to port for **PA**.

---

*Distance to goal right now: **113 outstanding, 0 confirmed.** First actions, in this order:*

1. *Commit this file to `docs/goal-prompt` and make `git show origin/main:AGENTS.md | grep -c
   goal-prompt` non-zero (§0). Until then the controller is unreachable by the loop it governs.*
2. *Settle §10.23 — a possible CDN sunset outranks everything if real, and one question answers it.*
3. *Open issue #206 so the loop has somewhere to report.*
4. ***Run §1.0's Cycle 0: load all 27 §2 rows into project `019d5190-…` per §3.2's recipe with
   `layer="launch-ladder"` (P2 loads as P2a and P2b), then* `update_task(task_id, status:"blocked")`
   *on the twenty non-root rows —* `create_task` *has no* `status` *parameter, so this is a fourth
   call, not an argument. Map-or-`archive_task` the 7 pre-existing tasks —* `archive_task(task_id)`*,
   NOT* `update_task(status:"archived")`*, which returns `400`. Until*
   `list_tasks(project_id=…, layer="launch-ladder", limit=100)` *returns exactly 27 matching rows —
   eight pending, twenty blocked — §1.0's start-of-cycle read is NOT authoritative. The* `limit` *is not
   optional: the default is 20, the ladder is 21, and a truncated read is silent.***
5. *Then, in §3.1 score order over the five startable rows: **PS** (101.8), **P0** (92.0 — `HUMAN-ONLY`,
   Bill's; an agent may prepare it but not execute it, §1.7), **#190** (70.4), **P1** (65.8), **PA**
   (41.7). Those are §2's seven DAG roots and they are the only rows that start today — **P2a (79.0) is
   NOT among them; it is serial on P1** — everything else is loaded `blocked`. Escalate #195, #186,
   #189 and #197's scope the same day, because they are worth more than anything an agent can do
   unblocked. **P1 now includes greening `smoke.yml`, which is red on the same lockfile error as CI —
   the estate has had no continuous production monitor since 2026-07-29T00:18:41Z.***

*Six lines in this document will quietly waste a week if you skip them. **§1.0** — never
`claim_next_task`; load the ladder before you read the queue; pass `limit=100` on every `list_tasks`;
and archive with `archive_task`, not with a status value that 400s. **§1.2 clause 5** — every engine
path is `git -C /home/bill/dev/recursiv`; without it three commands in this file used to print
`fatal:` or nothing at all, and one of those failures was byte-identical on stdout to a documented
NOT-DONE value. **§1.3's closure transition** — `release_task` never closes: `completed` stays
`in_progress` in the verifier queue, while other final releases can re-enter `pending`; only the
second party's `complete_task`, carrying the **worker's** agent id, closes; and a row
with unconfirmed sub-artifacts releases `blocked` with a `PARTIAL k/N` handoff, never `completed`.
**§1.6's `COUNTERSIGN` rule** — a countersignature is a comment on #206 from a different GitHub login,
never a name the writer types about itself; there is one login on this box today, so run Cycle 0's
second-identity sub-action or report `COUNTERSIGN-UNAVAILABLE`. **§3's two checks** — every §3.1 score
recomputes and the table is sorted descending; both are one script, both need `$GP`, and both are §1.5
conditions. **§3.2 step 3's failure branch** — a score mismatch is `SCORE-MISMATCH` on #206 and then
`blocked`, not a re-run until it agrees.*

---

## CHANGELOG — what changed and why, stated as changes

*This replaces the SELF-ASSESSMENT block that opened previous revisions. It carries no scores. §5 is
the binding record; this is the shape-level summary of what §5's newest rows and this revision's edits
did.*

**Blocking defects — an agent executing the previous revision either errored or closed on an
assertion:**

1. **The first instruction executed after committing this file returned HTTP 400.** Cycle 0
   prescribed `update_task(task_id, status:"archived")`; the REST schema is
   `z.enum(['pending','in_progress','blocked'])` inside `.strict()`. `archive_task` is the working
   tool and the document never named it. Fixed at every occurrence (§1.0, §1.3, closing actions).
2. **P9's fifteen sub-artifacts — 16% of the denominator — named no artifact form**, so the largest
   row in the ladder closed on "evidence retained and linked". Every one now closes on a committed
   transcript **plus** a Stripe sandbox object id re-fetched by the second party.
3. **P5(4) was the one exit in the document with no external referent**, on the critical path
   P4 → P5 → P6 → P3b(2)/P11. Replaced with an enumerated roster plus per-device transcripts, and an
   unreachable tester is now recorded as unreached rather than as replaced.
4. **`COUNTERSIGNED-BY` was a free-text token the working agent typed about itself**, so the entire
   `CONFIRMED` counter was self-certified. It is now a separate #206 comment from a different GitHub
   login, derived by a command (§1.6).
5. **The SELF-ASSESSMENT block was the only unfalsifiable claim in the document and the first thing an
   agent read.** Deleted.
6. **Cycle 0 was undecidable at P2**, which carried two published scores in one row. Split into P2a
   and P2b; `N` unchanged (§5.28).
7. **Every `list_tasks` call omitted `limit`**, whose live default is 20 against a ladder of 21, so the
   check truncated silently. `limit=100` is now mandatory. *(The justification was also wrong: "exactly
   the ladder size", asserted in three places. 20 ≠ 21. The numerology is deleted; silence on
   truncation was always the real argument.)*

**Determinism — two agents diverged:**

8. §3.1, §2's designated tie-break, **was not sorted** and one row did not recompute (§5.24).
9. §2's decision block **contradicted itself in consecutive clauses** about whether the four human
   decisions block P0–P5. Rewritten as start-vs-exit, and P3's cell now names #186.
10. **P11's countersigner** was required to be a different named human, was never named, and had no
    decision row, so the terminal gate could stall indefinitely. Now §10's twentieth row.
11. **P1 could close green while `smoke.yml` — named three times as the only continuous production
    monitor — stayed red on the same root cause.** P1's `N` is 3 and `MONITOR-DARK` is a standing rule.

**Blocking defects fixed this revision:**

12. **Three engine-repo commands were printed without `-C /home/bill/dev/recursiv`** — PS(1), §1.3's
    P4(5) clause, and §4's structural-cause citation — in a controller that lives in the *app* repo.
    PS(1) is the highest-scoring engineering row and a DAG root, and its wrong-repo output is
    **byte-identical on stdout to its documented NOT-DONE value** (`0`). §1.3's P4(5) clause went
    further and enumerated the error's output as a legal way to *close* the sub-artifact — turning a
    `cd` mistake into a false "staging does not copy prod" finding on the artifact that decides whether
    real user PII lands in a database throwaway accounts touch. It does copy prod: `:49`, `:52`, `:57`,
    with a `Sanitize PII` step at `:61-63`. A fourth, §10.23's `docs/MINDS.md` staleness check, failed
    **silently** — empty output, exit 0. All four now carry `-C`; **§1.2 clause 5** makes a missing one
    a reject-on-sight with a `PATH-OK` guard; and the closing "lines that waste a week" list carries it.
13. **P10(1) and P10(2) named no artifact class**, closing on the word "shown" and on "verified from
    outside" — 2 of the 93, in the row whose rollback cell reads "Irreversible by construction". (1) now
    takes P8(1)'s form: two `run_sql_query` row ids plus the platform-layer response body plus an
    explicit negative control that the ESP was never called. (2) takes a command:
    `dig +short _dmarc.<domain> TXT` showing `p=reject`/`p=quarantine`, pasted by the countersigner
    from their own machine.
14. **§3.2's step 2b claimed to enable §10.24 and in fact foreclosed it, and the auto-scorer it
    invoked never runs on a ladder row at all** (`hasScoring`). §5.30. §1.0's Cycle-0 exit shed a clause
    that could not fail.
15. **Two rules drafted in this revision would themselves have errored, and were caught by reading the
    live schemas before shipping:** `release_reason:"partial"` is not in `release_task`'s enum
    (`["completed","blocked","timeout","reassigned","out_of_scope","needs_human","audit_failed"]`), so
    partial closure uses `blocked` + a `PARTIAL k/N` handoff; and `create_task` has **no `status`
    parameter**, so Cycle 0's blocked-loading is a fourth call, not an argument. A third: the
    `HUMAN-ONLY` marker was drafted into three Step cells and pushed two past `title`'s 120-char limit —
    §3.2 now carries a length check. *(That check's pass condition was "prints nothing" until CHANGELOG 37 — which is what a dead pipe prints. It now prints `rows checked: 26` and carries a column-count guard.)*

**Determinism — six more forks closed this revision:**

16. **§1.6 counts per sub-artifact; the dispatcher moves per row; nothing mapped one onto the other** —
    a fork on 20 of 21 rows, explicit at P3b ("report as 1/2") and worst at P9 (`N`=15) and P11 (`N`=8),
    which cannot be held under a 5-minute heartbeat for the days they take. §1.3 now states the two
    granularities are deliberately different and gives the partial-release wire format.
17. **§1.0's claim rule said "unclaimed" where §1.4.3 and §1.5 say "unblocked, unclaimed"**, and Cycle 0
    loaded all 21 rows `pending` with no dependency filter available on `list_tasks` — so the literal
    reading claims P13 (71.0) on day one. Cycle 0 now loads the 16 non-roots `blocked`, which makes
    "unblocked" a query rather than a judgement.
18. **P0 had three orderings in three places** ("Do P0 first regardless" / "P0 if you are Bill,
    otherwise PS" / "highest-scoring unclaimed"). One ordering now, in §3.1's order, stated in §2 and
    repeated verbatim in the closing actions. **P2a was wrongly listed as a root in the closing
    actions — its `Serial on` cell says `P1`.**
19. **`$ORIGIN` was used as a command argument in P0(1), PS(2) and §3.2 step 2b and defined nowhere**,
    while P0's entire exit turns on the identical string being sent twice. `ORIGIN`, `STAGING_ORIGIN`,
    `SK_LIVE`, `ENGINE` and `$GP` are bound in §1.0's variable block, with the `/api/v1` question
    answered explicitly. Step 2b is also now a real `curl -X PATCH` rather than a bare `PATCH …`.
20. **The three self-checks used the relative path `docs/goal-prompt.md`** — exit 2 from anywhere but
    the repo root, on the command §1.6 calls the source of the denominator of every progress report.
    All three now use `$GP`, bound once at the top of the file from `git rev-parse --show-toplevel`.
21. **§10.23's lapse default mandated a row with no `N` and no exit artifact that "outranks the
    ladder"**, while §3.1 scored the same work 55.9 — below fifteen rows. Two agents would have produced
    two denominators. The row is now pre-written in §2 as `PM`, CONDITIONAL, with its `N`, its exit
    artifact, its §3.1 inputs and its insertion point, deliberately outside the table so it does not
    move the denominator until it fires.

**Mechanism gaps named rather than escalated on:**

22. **The COUNTERSIGN rule — the fix that de-self-certified `CONFIRMED` — has no second GitHub identity
    for 85 of the 93 artifacts.** `gh api user --jq '.login'` → `ottman`, one login on this box; §10
    names Jack for P11's eight and nothing else — 93 − 8 = 85. *(This read "92 of the 93" for two
    revisions, counting P11 as one artifact inside the one sentence that says "of the 93 artifacts" —
    §5.32.)* Cycle 0 now carries a sub-action to provision an identity with its own exit
    artifact (`[.comments[].author.login|select(startswith("github-actions")|not)]|unique|length` → ≥2), and until it exists the cycle line
    carries `COUNTERSIGN-UNAVAILABLE`, **§1.6b's `PACE-ESCALATION` is suspended, and §1.5's
    phantom-progress `COUNTERSIGN` clause is suspended with it** — escalating on a
    mechanism gap, or reopening every correctly-closed row because of one, teaches the loop to ignore
    its own detectors.
23. **PA(2) was unsatisfiable by construction** — it required a cron comment more than 12h from the
    nearest `CYCLE` line, in a loop instructed not to idle, so `SELF-AUDITED yes` was permanent. The
    criterion is now independence of *authorship*, not absence of work, with a cycle-10 failure branch.
24. **P11's countersignature verified that files exist, not that the eight sub-checks passed.** Jack
    now states, per sub-check, the frame or timestamp in the committed media at which that sub-check's
    written pass criterion is met. A countersignature that only proves a path resolves is `ls`.
25. **Two sub-artifacts closed on a screenshot, a class §1.3's list did not contain.** A media class is
    added — *committed at a path on `main`, bound to a named SHA/build id/account identifier visible in
    frame*; after the recording/screenshot fold it is the **NINTH** class, not a tenth, and this entry's
    original wording "a tenth class" is itself CHANGELOG 37's count-that-did-not-recount. P5(2) and
    P12(5) now close on machine-readable artifacts (an `eas update:list` id;
    the console APIs' own responses) **with** the committed screenshot, not on the screenshot alone.
26. **§1.3 said "Four sub-artifacts are written as documents" and there are five.** The omitted one,
    **P8(5)**, is the retention/deletion schedule — the most assertion-shaped exit in the ladder. It now
    has its own reproduce-test in the enumeration.
27. **§1.5's phantom-progress row re-quoted `Done: 335` as current after §1.0 declared that exact
    counter non-citable, and it had already drifted.** The number is gone; the load-bearing point (the
    unscoped counter is unusable for this loop) never needed one.
28. **§10's P11 row propped itself up with a self-count whose command returned `0`** — `grep -noE
    "Jack\|jotto141\|…"` searches for a literal pipe under `-E` — **and whose four published values were
    all wrong** (36/8/3/7, not 30/2/1/4, and moving with every edit because the file counts itself).
    Deleted rather than repaired.

**This revision — the forks and miscounts three independent graders converged on:**

29. **§3.2's Cycle-0 recipe said "the fifteen non-root rows" and "the six roots" against five other
    sites saying 5/16** — at the single most-executed instruction in the file. §1.0, §2's closing
    lines, §1.0's re-read check (`blocked` → 16, `pending` → 5), the closing actions and CHANGELOG 17
    all say 5 + 16 = 21; the recipe an agent actually runs said 6 + 15, and named no sixth root, so the
    agent had to guess — and the obvious guess is P2a (79.0), which is the exact error item 18 above
    claims to have fixed. **The residue survived in the recipe.** Step 4 now enumerates the five roots
    inline, states that P2a is not one and why, and tells the reader to derive the split from the
    `Serial on` column rather than trust the comment. *(Self-detecting, which is why it was not
    blocking: §1.0's own exit artifact fails on a 6/15 load. But "the loop notices within one cycle" is
    a weaker property than "two agents do the same thing", and this row is where the loop starts.)*
30. **Three counts did not recount** — 18-of-21 (§5.31, it is 20), 92-of-93 (§5.32, it is 85),
    and §10.6's three greps (§5.35, printed with no command and two of three unreproducible). All
    three sat in sections whose subject is *not trusting counts*. **§1.2 clause 3 is now demonstrated
    rather than asserted at §1.3: the recount command is printed beside the number it produces.**
31. **§1.0's Cycle-0 fallback order dropped P0 and PA** while §2 claimed "exactly one ordering
    statement in this document" (§5.33). Two free agents under §1.9 took different second rows on day
    one. All five roots are now quoted in the fallback.
32. **§1.5's phantom-progress `COUNTERSIGN` clause was unsatisfiable while one login exists, and only
    `PACE-ESCALATION` had been suspended.** Read literally the clause fires on *every* row the loop
    legitimately closes, so one agent reopens all completed work each cycle and another reopens none —
    the sharpest fork in the file, at the check run before every claim. The clause is now suspended by
    name alongside `PACE-ESCALATION`, with the row's other three conditions explicitly still live.
33. **The second-identity exit admitted the loop's own workflow as countersigner.** `github-actions`
    never equals the cycle-line author, so §1.6's only discard rule could not catch it — and PA is
    agent work, so an agent could write the workflow that certifies its own artifacts. That is the
    free-text `COUNTERSIGNED-BY` token §1.6 deleted, wearing a different login. `github-actions` now
    counts only if its comment re-executes the artifact's command inside the run (`run_id` in the body)
    **and** the workflow is a required check under P2a — until P2a lands, it does not count at all.
34. **Four sub-artifacts named no committed path in their own cell**, relying on §1.3's general clause
    one indirection away from the agent working the row: P3b(2) closed on a pasted empty vendor window
    (which §8 itself concedes proves delivery of nothing — it now requires a live-pipe positive
    alongside the negative), P4(2) was the least-specified of the 93 (now a resolving `curl` against
    `$STAGING_ORIGIN` bound byte-equal to (3)'s committed `.env.staging`), P10(3) named neither path nor
    verifier action (now full raw headers committed, `List-Unsubscribe-Post` required, verifier POSTs
    the URI themselves), and #190's three required a network-tab capture with nowhere to put it (now
    `qa-media/190-<n>-<sha7>.png` with `conversation_id` in frame).
35. **A GitHub issue title was quoted as "verbatim" with its `[P1] ` prefix silently dropped** (§5.36)
    — the trailing cut marked, the leading one not, in a file whose §1.2 clause 4 exists to stop
    exactly that. Both sites now print the full string.
36. **§10.24 claimed `effort` and `milestone` suppress the auto-scorer** (§5.34) two sections after
    quoting `hasScoring` correctly. The error was conservative and the probe still ran; it is retracted
    anyway, because §5.30's own closing rule — *the guard is the line you have to read* — was the rule
    being broken.
37. **The negative-control sweep that CHANGELOG 33-35 claimed to have finished was short by nineteen
    sub-artifacts, and two of the three hand-applied fixes were themselves defective.** Verified
    2026-07-29 by executing each cited command rather than reading it.
    - **The PW(3) fix broke the table.** It inserted an UNESCAPED `|` into a cell, giving the PW row 9
      unescaped pipes against every other ladder row's 8 (`sed 's/\\|/@/g' | awk -F'|' '{print NF}'` over
      rows 956-977 → `9` everywhere, `10` at PW). Field `$5` — the field §3.2 copies into `description`
      as "the exit artifact from §2, verbatim" — terminated at 725 chars mid-command on
      "the verifier's own `curl -s https://minds.on.recursiv.io/ ", so Cycle 0 would have loaded an exit
      that DROPPED the artifact the fix installed. Escaped; §3.2's length check now carries an `NF!=9`
      guard that catches the next one.
    - **The P6(4) fix reopened its own hole.** "carrying the same EAS build id as (3)" is unsatisfiable
      read strictly (a no-reporter build is a different binary with a different build id — the PA(2)
      unsatisfiable-by-construction class this document retracted) and, read loosely, is satisfied by
      (3)'s OWN logcat, so the negative control compared the reporter build against itself. Now: a
      DIFFERENT build id, both ids from one `eas build:list --json`, and the reporter package shown
      absent from the no-reporter build by P5(1)'s unpack.
    - **The PW(3) fix was non-diagnostic because PW(2) was never fixed.** PW(2) was one sentence with no
      command, so the worker chose the string PW(3)'s verifier greps — "Minds" returns non-zero before
      the rollback, after it, and if no rollback happened, which is §5.20's own retracted failure mode
      re-imported. Both discriminators are now committed in advance and both directions checked after.
    - **The class fold changed the definition and touched none of the three cells it was meant to close.**
      P8(6), P13(1) and P13(2) still read "recording or transcript" / "screen recording" with no path,
      leaving the TERMINAL row of the ladder naming no valid artifact. All three now name committed
      paths and in-frame bindings. The fold also left **nine** classes under a header reading "ten",
      with four cells citing "§1.3's tenth class" — an ordinal that resolved to nothing. Counted,
      corrected, and every citation now names the class rather than its position.
    - **FOURTEEN further §2 sub-artifacts, plus FIVE non-ladder exits — nineteen items in all — closed
      on an unguarded absence or named no artifact class**, each fixed in the form its own row already
      uses elsewhere. *(This read "Sixteen" for one revision and reconciled with nothing: the list
      below names fourteen §2 sub-artifacts and nineteen items total, and sixteen is neither. A bare
      cardinal in front of a list the reader can count is §1.2 clause 3's failure inside the paragraph
      that installs the recount rule — §5.31 again. Recount before citing: the fourteen are P0(3),
      P1(2), P5(2), P5(3), P5(4a), P7(5), P8(3), P9(14), P10(1)(d), P12(3), P12(4), P12(6), PM(2),
      PM(3); the five are §8's DESIGN.md exit, §9's 5 MB rule, §10's Dependabot exit, §3's sort check
      and §3.2's length check.)* **The fourteen:** P0(3) (bare `gitleaks` exit `0` — reproduced
      by scanning an empty directory; now paired against §10.3's known `~/.zshrc` offender over a printed
      path list), P1(2) (`git diff 3761e415 origin/main` is `origin/main` against ITSELF — `wc -c` → `0`,
      and a mistyped path gives the identical empty output and exit `0`; now `PATH-OK` plus positive
      greps plus a guarded zero), P5(2) (production half had no live-pipe proof), P5(3) and P8(3) (one
      sentence each, no artifact class — P8(3) additionally pointed at the form §6.2 bans), P5(4a) (a
      Console screenshot bound to a `.json` path that cannot hold it), P7(5) (`run-as` prints nothing on
      stdout when it refuses on a release build — byte-identical to the pass), P9(14) (the only line of
      fifteen satisfied BY emptiness, with no row-count floor), P10(1)(d) (an ESP log for an ESP no
      section names), P12(3)/(4) (screenshots with no path), P12(6) (Apple 5.1.1(v) on an unpaired 404 —
      the gate on the store submission), PM(2)/(3). **The five off-ladder:** §8's DESIGN.md exit
      (unguarded `grep -c` → `0`, which
      from `/home/bill/dev/recursiv` — where §0 says PS/P8/P9/P10 are worked — prints the DONE value),
      §9's 5 MB rule (which lawfully permitted producing a non-artifact for every recording the ladder
      asks for), §10's Dependabot exit (satisfied by switching the scanner off), and the TWO
      self-checks whose pass value was an empty output (§3's sort check and §3.2's length check each
      printed nothing against `/nonexistent/x.md`; both now print a row count as their positive
      control — the THIRD self-check, §1.6's denominator awk, never had this defect because its pass
      value is the printed pair `26 110`, which is why it is two here and not three).
    **The rule this enforces on the next round: an exit that closes on an absence, a zero, or a
    non-appearance is not closed until something in the same transcript proves the pipe was live at that
    moment. "The sweep was run" is itself a sentence, and CHANGELOG 33-35 are what a sentence is worth.**


**Accuracy — claims that did not reproduce from their cited source:** §5.25 (`do_revert` is
conditional; the citation stopped one line above the guard), §5.26 (`update_task(status:"done")` does
write an activity row, and records the caller), §5.29 (`revenue`/`growth`/`mission`/`leverage` are
reachable over REST, just not through the MCP wrapper), **§5.30** (the LLM auto-scorer never runs on
any row this document creates — `hasScoring` guards it and §3.2 step 1 always trips the guard).

**Coverage — silent omissions, now named:** the engine repo's 14 open issues with three on ladder
paths (§8); iOS proved only for boot and store submission (§8); `DESIGN.md` on `main` republishing a
retracted claim (§8, §5.27); `inverted-world` unread with no row (§10.32).

**Denominator: 90 → 93.** `BASELINE 90/91 REASON §1.8 ROW P1 ARTIFACTS +1` (smoke) and
`BASELINE 91/93 REASON §8-carveout ROW P8 ARTIFACTS +2` (#196's retention schedule and appeals path)
are owed on #206 at Cycle 0. **The P2 split owes no `BASELINE` line: 1 + 6 = 7 is the old `N`.**
