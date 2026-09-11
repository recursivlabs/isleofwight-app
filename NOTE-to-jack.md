# Jack — where we are and what matters, in plain English

## What we're trying to do

Ship Minds 2.0 so that a stranger — someone with no connection to us — can install it from the
App Store, from Google Play, and open it on the web. That's the finish line. Not "feature complete,"
not "in review." A stranger installs it and it works.

## Why there's a big document about it

We're running AI agents on this continuously. The problem with that isn't that they're bad at
coding — it's that they'll tell you something is done when it isn't, and the next agent believes
them, and a week later nothing actually works.

So `docs/goal-prompt.md` is a contract that makes that impossible. Every task has to finish with
something you can point at and check yourself: a file that's on `main`, a green build on a specific
commit, a URL that returns 200, a video with a build number visible in it. If a task can't name
something like that, agents aren't allowed to start it.

It's long and dense because it's written for machines to execute, not for people to enjoy. **You
don't need to read it.** There's a script that checks it for you, which I'll get to.

## The order things have to happen in

1. **Unbreak CI.** Right now every open PR fails on the first step — even ones that only change a
   markdown file. Nothing can ship through that.
2. **Merge the small backlog** — the pointer PR, then the queued fixes.
3. **Wire up staging.** We committed to proving the money flow works in staging before launch, and
   the app has no staging environment at all yet. This is the single biggest unblock.
4. **Then** the launch checklist, store submission, and the three surfaces going live.

Everything else — token economy, federation, the 1.5M legacy account migration — is deliberately
out of scope until after launch. That's written down so nobody rediscovers it as urgent.

## What's actually holding us up

Almost none of it is engineering. It's decisions and sign-offs:

- **You and Bill both need to sign off** before the agents start working the plan. Nothing has
  started; that's on purpose.
- **22 open decisions** need a human. Each one has a written default that kicks in automatically if
  it goes past its date, so nothing stalls forever — but a default is a worse answer than yours.
- **One weird one:** progress currently reads zero and can't move, because the rule is that nobody
  can sign off on their own work, and there's only one GitHub login on this machine. Any comment
  from you on issue #206 fixes that permanently.

## The four things I'd ask you for

1. **Approve PR #205.** A small edit to `AGENTS.md` — a three-line pointer at the plan, plus it
   replaces the old roadmap section that duplicated it and two dead file paths. Until it merges,
   agents opening this repo don't find the plan at all.
2. **Comment on issue #206.** Anything. That's what unpins the progress counter.
3. **Answer #186** — track-player on New Architecture. Due tomorrow. If it lapses we ship with
   lockscreen audio disabled, which is a real product decision made by timeout rather than by you.
4. **Tell us pnpm 9 or 10.** A commit message says the lockfile was regenerated with 9.15.9 "to
   match deploy," while CI is pinned to 10. Those disagree, and that disagreement is what broke CI
   for everything. You know the deploy side; we don't.

## How to check any of this without trusting me

```bash
cd ~/dev/recursivlabs-minds && git fetch origin
git checkout origin/fix/controller-reconcile-counts
./scripts/check-controller.sh
```

Eleven checks, about five seconds. It reads the plan and verifies it against itself and against the
live repos — including re-checking that every code reference still points at the code it claims. If
it prints `ALL CHECKS PASSED`, the document is internally consistent. If it doesn't, don't trust the
document until it does.

That script found nine real errors in the last day, including one I introduced myself and then
logged against my own name. It's in there because a rule written down as prose didn't survive its
own author's next edit — three times.

## One thing you can fix in ten seconds

There's a workflow ready to run that check automatically on every change, but pushing anything into
`.github/workflows/` needs a permission this session doesn't have. If you or Bill run:

```bash
gh auth refresh -h github.com -s workflow
```

…it goes live and this stops depending on anyone remembering to run it.

## Honest list of what's still broken

- `minds.recursiv.app` returns nothing — the domain moved to Cloudflare but the certificate on the
  old host expired. DNS resolving isn't the same as the site working.
- `recursivlabs/recursiv` has 18 open PRs, up from 10 two days ago, several attacking the same
  handful of bugs. That pattern usually means something is retrying rather than converging. Worth a
  look if any of them are yours.
- Three of your older PRs (#8, #9, #29) are marked to close rather than rebase — #9 is 50 files
  against a tree that's moved months. That's flagged for your call, not done.
- The production monitor (a synthetic check every 6 hours) has been failing since yesterday
  morning, on the same CI break. So right now nothing is watching production continuously.
