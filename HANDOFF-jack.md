# JACK — verify it, decide four things, start your loop

The goal is you and Bill each running a continuous loop against one plan, coordinating without
colliding. This is what you need to do that. **Neither loop starts until you both sign off.**

## 1. Verify before you read further

```bash
cd ~/dev/recursivlabs-minds && git fetch origin
git checkout origin/fix/controller-reconcile-counts
./scripts/check-controller.sh
```

Expect `ALL CHECKS PASSED — denominator 113, 26 table rows + #190, 7 pending / 20 blocked`. Eleven
checks assert the plan against itself and against the live repos: every score recomputes from its own
inputs, every cross-repo citation still resolves at `origin/main`, no §-reference dangles, no blocked
row is unreachable. It blocked me five times today on things I'd otherwise have shipped.

## 2. Yours to decide

- **#186 track-player — due tomorrow, 2026-07-31.** If it lapses the default fires unattended: ship
  with lockscreen/background audio **disabled**, track-player off the pre-`AppRegistry` path. It also
  decides whether #184 is the right fix.
- **pnpm 9 or 10.** `3761e41` says 9.15.9 "to match deploy"; CI and #180 assume 10. That disagreement
  is what broke CI for every PR. You own the deploy side. `action-setup version: 10` also floats — it
  resolved `10.34.5` against #180's `10.28.0` pin.
- **Approve #205.** Three-line pointer in `AGENTS.md` plus removal of a duplicated roadmap and two dead
  paths. Until it merges, `git show origin/main:AGENTS.md | grep -c goal-prompt` → `0`.
- **#29 / #9 / #8 are yours.** Marked close-not-rebase, deliberately left open for your call — #9 is
  50 files against a tree that has moved months.

## 3. Starting your loop — four rules, and one of them is the unlock

**Your loop id is `jack`. Cycle lines read `CYCLE jack/<n>`** — a shared counter makes two loops both
post `CYCLE 7`, which breaks `DELTA-DISTANCE` and the circling detector while the log still looks fine.

**Your loop countersigning Bill's artifacts is what takes progress off zero.** The counter reads
`0/113` not because nothing is done but because nobody can sign off on their own work and this box has
one GitHub login. A loop under `jotto141` is a different login not driven by his — §1.0 already admits
exactly that. **Two loops is the fix, not a workaround.** You may never countersign your own loop's
work, in any cycle.

**Rescore by PR, never a direct push.** Both loops re-derive §3.1 every cycle; two direct writes
silently lose one, and the gate can't catch it because consistency survives a lost update.

**Don't claim across an outcome boundary.** `claim_task` arbitrates work correctly but can't see the
controller registry (§1.9a), so it will happily grant you a row belonging to another controller.

Start with the 7 startable rows in score order: **PS 101.8 · P0 92.0 · #190 70.4 · PD 68.1 · P1 65.8 ·
PAPI 61.3 · PA 41.7.** P0 is human-only.

## 4. What changed today, so nothing surprises you

Launch scope went from three surfaces to **seven** — the apps plus **API, MCP, SDK and CLI**, which are
one product surface with them, accessible on day one. That added four rows and moved the artifact count
**100 → 113**. Tokens and account migration are now launch prerequisites too, but **no rows exist for
them yet**: two decisions gate the scope (the bare-minimum feature set against legacy, due 2026-08-06),
and inventing rows before that is forbidden. Priorities now re-derive each cycle from facts rather than
sitting fixed.

## 5. Known open

`controller-gate.yml` is **live in CI** (12 checks, green on `931146b`) but not yet a **required
check** — `main` has no branch protection, so `P2a` is what makes it a witness the loop can't
disable. Check `[8]` skips in CI until an `ENGINE_REPO_TOKEN` secret exists. The RLS controller has no owner. And
`minds.recursiv.app` returns `000` on an expired Vercel cert — zone on Cloudflare, record grey-cloud
through to Vercel.
