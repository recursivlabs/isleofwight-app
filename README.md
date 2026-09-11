# Isle of Wight community network

A copy of the Minds app, branded for the Isle of Wight and pointed at its own project on the Minds instance.

- Upstream: https://github.com/recursivlabs/minds (remote `upstream`). Pull engine and app fixes from there.
- Project, org and site defaults live in `lib/recursiv.ts`.
- Brand assets: `assets/logo-dark-mode.svg`, `assets/logo-light-mode.svg`, `assets/bulb.svg`, `assets/splash.png`, `assets/icon.png`, `assets/favicon.png`, `public/og-*.png`.

# Minds

**Every other social platform lets you make an account. This one is built so you can make the
platform.**

Minds 2.0 is an open AI social platform — feed, discovery, communities, chat, agents, Boost,
wallet, and developer surfaces — running on
[Recursiv](https://recursiv.io), and it is that platform's **reference client**: the worked
example of how to build a social product on `@recursiv/sdk`. Three things you can do here that
you cannot do on X, Threads, Bluesky, or Mastodon:

**1. Pick the model that reads your feed, and write its instructions yourself.**
Every account gets a personal agent. You choose Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus
4.6, or GPT-5.5 from a server-enforced allowlist, and its system prompt is a plain text box you
edit ([`app/agent.tsx`](./app/agent.tsx)). Its default instructions say it works for you alone
and never posts publicly on your behalf — and you can rewrite that line, because it is your
prompt, not ours.

**2. Read the ranking formula instead of guessing at it.**
For You is a weighted sum of six named terms: engagement
`log1p(netVotes + 2 × unique commenters + 3 × reposts)`; exponential recency; velocity
(`engagement / (ageDays + 2)^1.5`, so a post gaining traction now beats an equally-engaged old
one); your follow and community graph; authors you have upvoted before; and semantic affinity —
cosine similarity to the mean embedding of the posts you recently upvoted. Posts you already
upvoted are dropped so the feed keeps moving. *Unique* commenters — distinct reply authors, not
raw reply rows — is the deliberate anti-gaming choice: 500 replies from 3 accounts move almost
nothing. *(The ranker runs server-side in the Recursiv engine, which is not yet public — see
[Honest status](#honest-status). The weights above are quoted from it verbatim so the formula is
readable even while the engine is closed.)*

**3. Make the thing, not just a post about the thing.**
The same client that composes a post creates communities, creates agents, and creates and
deploys a real Recursiv project to production ([`app/apps.tsx`](./app/apps.tsx) — admin-gated
today, see [Honest status](#honest-status)). Software is an object in the social graph here, not
a link you paste into one.

And the app you are reading about is one *instance*, not the only one. Minds has its own
tenant-scoped network, project, API key, deployment, secrets, and domains, assembled from the same
engine as other Recursiv apps. Its rows live in Recursiv's shared multi-tenant Postgres and are
scoped to the Minds network/project; it does **not** own a separate database.
`terrapin.minds.com`, `build.minds.com`, and `api.minds.com` are three live surfaces. Standing up
your own is the product.

---

## Why this exists

Three beliefs, ordered by how far each is from reality. They are beliefs, not achievements —
[Honest status](#honest-status) says where each one actually stands.

**1. The unit of value is a platform you can stand up, not an account you can open.**
Anyone can build a social app; what is rare is one worth copying, where the data layer, auth,
ranking, moderation, and agent primitives are the *platform's* job, so a new instance inherits
capability instead of technical debt. Hence this repo's one rule above all others (see
[The golden rule](#the-golden-rule)): a fix in the platform reaches every instance, a fix in app
code reaches one. Minds is the existence proof of the isolated instance. Whether a third party
can fork *this repo* and get a working app is a separate claim, and it is not yet proven.

**2. Open infrastructure beats a closed network.**
A social network's moat has historically been its walled garden. We think the durable position
is now the opposite: being the substrate other people build on. Concretely, content flows in
from networks we do not control — nine source adapters exist today, including ActivityPub,
Bluesky, Nostr, RSS, Hacker News, and email. It also means the code has to be usable, and that
is the part not done: `publish`, `reply`, and `react` are still commented out of the adapter
interface, and this repo has no license. Until both change, this is a direction, not a fact.

**3. Moderation has to scale with autonomy, or autonomy does not ship.**
An autonomous system multiplies whatever moderation it has, so automated, auditable,
fail-closed moderation is not a later feature of autonomy — it is the gate on being allowed to
build it. Today the entire moderation surface in this client is
[`lib/moderation.ts`](./lib/moderation.ts): 137 lines of block, mute, and follow state, all
human-triggered. There is no automated content screening. That gap is the honest reason
autonomy is not shipping yet.

---

## Architecture in 60 seconds

```
┌─────────────────────────────────────────────────┐
│  Minds product  (this repo)                     │
│  Expo app + @minds SDK/API/MCP/CLI packages     │
│  iOS · Android · web · developer surfaces       │
└───────────────────────┬─────────────────────────┘
                        │  @recursiv/sdk  (never raw fetch)
┌───────────────────────▼─────────────────────────┐
│  Recursiv platform                              │
│  auth · orgs/projects · feed ranking · agents   │
│  realtime · storage · moderation · protocols    │
└─────────────────────────────────────────────────┘
```

**This repo owns the Minds product surfaces.** It owns no database; all data access goes through
the typed SDK layer. **The Recursiv platform is the backend** — multi-tenant, with Minds as one
tenant scoped by network / project / org IDs. One app codebase ships to iOS, Android, and web,
while the public packages under `packages/` ship the Minds API, SDK, MCP, CLI, and tenant branding.

| Package | Purpose |
|---|---|
| `@minds/sdk` | Minds-default TypeScript client with full Recursiv SDK parity |
| `@minds/api` | Typed REST endpoint contract and shared API types |
| `@minds/mcp` | Minds-branded, policy-limited MCP server |
| `@minds/cli` | `minds` command-line client |
| `@minds/tenant-overlay` | Minds-owned branding consumed by the Recursiv tenant runtime |

The route-complete product inventory is [`docs/product-surfaces.md`](./docs/product-surfaces.md).
The source-versus-published developer inventory is
[`docs/developer-surfaces.md`](./docs/developer-surfaces.md). `pnpm docs:check` fails when an app
route, SDK resource, Minds-owned MCP tool, CLI command, or workspace package disappears from those
docs, so “documented” is a check rather than a memory.

Discovery is not a keyword feed: every post carries a 768-dimension embedding
(`text-embedding-3-small`, stored in pgvector), powering semantic search, "more like this", and
the per-viewer taste vector in the For You ranking above.

For the full internal map, read [`AGENTS.md`](./AGENTS.md) — written for contributors (human or
agent), including the footguns we learned the hard way.

---

## Quickstart

Requires **Node 20** (what CI tests) and **pnpm 10** — `npm i -g pnpm@10`. On pnpm 11 (today's
corepack default) every script aborts during the dependency pre-check before it runs at all.

```bash
git clone https://github.com/recursivlabs/minds.git
cd minds
pnpm install
pnpm dev            # Expo dev server — press w for web, a for Android, i for iOS
pnpm packages:check # build, typecheck, test, and dry-pack all public packages
```

### State of the tree — verify it; do not trust a dated paragraph

The old README froze one bad day in prose: it said the lockfile, typecheck, lint, and CI were red
and that [#180](https://github.com/recursivlabs/minds/pull/180) was open. #180 merged on 2026-07-30,
and later CI runs are green. The durable answer is the current command or run, not either snapshot:

```bash
pnpm install --frozen-lockfile
pnpm docs:check
pnpm packages:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# Maintainers: current main, including the run URL and SHA
gh run list --repo recursivlabs/minds --workflow CI --branch main --limit 5
```

CI runs those checks on Node 20 and the `pnpm` version pinned in `packageManager`. A badge can be
stale or a job can still be running, so open the run and bind the conclusion to its commit before
citing it.

You will need environment values to talk to a live backend. Ask a maintainer — do not commit
credentials, and do not paste them into an issue.

---

## The golden rule

> **Fix generic capabilities in Recursiv and Minds-specific developer surfaces in `packages/`,
> not as one-off app workarounds.**

Because Minds is the reference client for the SDK, a fix that lands in app code instead of the
platform is a fix no other instance inherits — the reference drifts, and every downstream app
re-implements the same bug. The first question is almost always *"where does this belong in the
platform?"*, not *"how do I patch it here?"* Concretely:

- Use `@minds/sdk` or `@recursiv/sdk` for API calls. A raw `fetch` is a signal that the SDK has a
  gap — fix the typed client layer, don't route around it.
- Fix shared components (`PostCard`, `VoteButtons`, theme tokens, the auth flow) rather than the
  screen that happens to show the symptom.
- Keep feature folders self-contained.
- Use design tokens from `constants/theme.ts`. Hardcoded colors break light/dark mode for every
  fork, not just this app.

---

## Contributing

Contributions are welcome, including from agents. A few norms:

- **Every PR explains, in plain English:** what a user experiences, why it is broken, what the
  fix changes, how it was tested, **what remains unproved**, and how to roll it back. That
  "unproved" section is not optional and not a weakness — it is how reviewers know what they are
  actually approving.
- **Evidence beats assertion.** Unit tests alone do not close a user-facing bug. A device
  recording, a captured network trace, a built-bundle measurement, or a live-backend transcript
  does.
- **Small PRs, one concern each.** If a branch fixes two unrelated things, it is two branches.
- Run `pnpm docs:check`, `pnpm packages:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` before pushing; all should be green.

Good first issues are the current open results under [`good first issue`][gfi]. Do not copy issue
numbers into this README: the previous three examples all closed while the prose kept calling them
open.
Broader known work lives under [the `audit` label](https://github.com/recursivlabs/minds/labels/audit):
an evidence-graded backlog where every issue carries a file:line anchor and a specific
verification bar. Issues marked `upstream-sdk` belong in the platform, not this repo.

[gfi]: https://github.com/recursivlabs/minds/labels/good%20first%20issue

---

## Honest status

This project is pre-1.0 and this section is deliberately unflattering. It exists so nobody has
to reverse-engineer our confidence level from marketing copy. Re-run the linked checks: status is
allowed to move faster than this README.

| Area | Where it actually stands |
|---|---|
| **Build health** | CI-gated, not claimed permanently green. `pnpm install --frozen-lockfile`, docs/package checks, lint, typecheck, unit tests, staging browser e2e, web export, and boot smoke are enforced by `.github/workflows/ci.yml`. Use the commands above and the current [CI runs](https://github.com/recursivlabs/minds/actions/workflows/ci.yml); #180 is merged. |
| **Fork-ability** | **Unproven, and stated that way on purpose.** This repo is the SDK's reference client, and the platform demonstrably stands up tenant-scoped instances — Minds is one. But no third party has forked *this repo* yet, and Minds Build runs from the engine repo rather than a fork of this one. Settling that is tracked in [#204](https://github.com/recursivlabs/minds/issues/204). Raw platform HTTP bypasses remain in app code; re-count and classify `rg -n '\bfetch\s*\(' app lib` instead of trusting a frozen number. |
| **Open source** | **Not yet — and the repo is private again as of 2026-07-28,** closed until launch. It carries no license, and the platform is not public either. The intent above is real; none of it is available to anyone outside the org today. Which layer opens, and when, is [#195](https://github.com/recursivlabs/minds/issues/195). |
| **Protocol interop** | Foundation only. A `ProtocolAdapter` contract exists with **read/ingest** implemented; `publish`, `reply` and `react` are commented out and identity federation is explicitly Phase 2. Today this is aggregation, not federation. |
| **Moderation** | Block/mute/follow, reporting, a privacy-safe public moderation log, account-bound decisions, and appeals now exist across app, SDK, MCP, and CLI. Automated pre-publication content screening is still absent, so autonomous publishing remains gated rather than silently fail-open. See [`docs/moderation-coverage.md`](./docs/moderation-coverage.md). |
| **Making apps in-app** | Real but gated. The composer has `agent`, `app` and `community` modes, and `app/apps.tsx` creates, lists and deploys Recursiv projects — but that screen is behind `withAdminGuard`, and the composer's `?mode=app` deep link has no UI entry point. Agent creation (`app/agent.tsx`) is open to every signed-in account; app creation is not. |
| **Mobile telemetry** | Native Sentry wiring now exists in `lib/nativeMonitoring.native.ts`; PostHog remains web-only. The remaining gap is live hardware-to-vendor receipt and negative-control proof, so wiring must not be reported as operational monitoring. |
| **Release safety** | `eas.json` now separates development, preview, staging, internal, and production channels. Store upload/review, production rollback, and the final launch-gate sitting remain unproved controller work. |
| **Developer packages** | Five source packages live under `packages/`, but source is ahead of the public npm registry and two packages are not publicly returned at all. Jack owns the active publication lane. Read the dated, re-fetchable matrix in [`docs/developer-surfaces.md`](./docs/developer-surfaces.md); source presence is not install proof. |

If a claim in this README ever outruns the evidence, that is a bug. Please file it.

---

## License

**Not yet chosen.** This is a deliberate open decision, not an oversight — which layer is open
(app, SDK, or the whole platform) shapes what "fork Minds" means, so it is being made explicitly
rather than by default. Until a `LICENSE` file exists, default copyright applies and no
permission to use, modify, or redistribute is granted.

Follow or weigh in on [#195](https://github.com/recursivlabs/minds/issues/195) if you want a say
in it.
