# PS(3) — the route-coverage regression test, shown RED then GREEN

PS sub-artifact (3) asks for "a merged regression test asserting every `api.route('/x')` prefix has
a matching `api.use('/x/*', apiKeyAuth, …)`, **shown red on the pre-fix SHA and green after**."

The test is merged in the engine repo at
`packages/server/src/features/api-keys/__tests__/rest-auth-coverage.test.ts` (commit `3c8dfbe8`).
**A merged test is not the artifact — a merged test that FAILS on the defect it exists to catch
is.** A test that passes on both sides of a fix asserts nothing, and this file is the evidence that
this one does not.

## The pair

`scripts/assert-rest-auth-coverage.mjs` in this repo carries that test's assertion verbatim — same
two regexes, same guard-block positional logic — so it can be pointed at an arbitrary `index.ts`.
Extracting it is what makes the red half runnable at all: vitest runs the test against whatever is
in the working tree, so demonstrating red means checking out a pre-fix tree, while this reads any
revision straight from git.

```
$ cd /home/bill/dev/recursiv
$ PRE=$(git rev-parse 3c8dfbe8^)        # → 5230cec02ae318bbddbc003820bf4c2b45cef493
$ git show $PRE:packages/server/src/features/api-keys/rest/index.ts          > /tmp/pre.ts
$ git show origin/main:packages/server/src/features/api-keys/rest/index.ts   > /tmp/post.ts

$ node scripts/assert-rest-auth-coverage.mjs /tmp/pre.ts
RED — unguarded route groups: ["/signals","/moderation"]
exit=1

$ node scripts/assert-rest-auth-coverage.mjs /tmp/post.ts
GREEN — every guarded-position api.route() has a matching api.use(apiKeyAuth)
exit=0
```

Run 2026-08-01. **The red half names the two route groups PS exists for**, which is the part that
matters: it is not merely failing, it is failing *for the reason claimed*. A test that went red on
the pre-fix SHA for some unrelated reason would satisfy a naive red/green check and prove nothing.

## Why the assertion is positional rather than an allowlist

Routes mounted **before** the first `api.use(…, apiKeyAuth)` line are public by design — the
dispatcher and link-preview carry their own auth, and the Slack app plus the Bunny video webhook
must be reachable without a key. The test exempts them **by position, not by name**, so a new
public mount stays possible while a new protected mount cannot dodge the assertion by being added
to a list. That is the property that makes this a regression test rather than a snapshot.

## What this does NOT establish

- **It reads source, not behaviour.** The mounts existing is not the same as the deployed API
  enforcing them — that is PS(2), which is proven separately against production and is already
  countersigned.
- **The engine test's own CI wiring is not verified here.** This proves the assertion discriminates;
  whether the engine's pipeline runs that test on every PR is an engine-side property this repo
  cannot assert.
- The extracted script can drift from the engine test it mirrors. If they ever disagree, **the
  engine test is authoritative** and this file is stale — re-extract rather than patching.
