# PSDK and PCLI — clean-environment verification

Both rows ask the same question: **does a stranger, starting from nothing, get a working thing?**
Run 2026-08-01 from empty directories on this box. Every command is inline; re-run rather than
trusting this file (§1.2).

## PSDK(1) — installs and imports from an empty directory: PASS

```
$ mkdir /tmp/psdk-clean && cd /tmp/psdk-clean && npm init -y && npm i @recursiv/sdk
found 0 vulnerabilities
$ node -e "console.log(require('@recursiv/sdk/package.json').version)"   → 0.6.1
$ npm view @recursiv/sdk version                                          → 0.6.1
$ node -e "const s=require('@recursiv/sdk'); console.log(Object.keys(s).slice(0,8).join(', '))"
AdminResource, AgentsResource, AppSubscriptionsResource, AuthResource,
AuthenticationError, AuthorizationError, BillingResource, BrainResource
```

Resolved version equals the published version, and the import yields real resource classes rather
than an empty object.

## PSDK(2) — an authenticated call returns real data: PASS, with a base-URL gotcha

```
$ node -e "
  const { Recursiv } = require('@recursiv/sdk');
  const c = new Recursiv({ apiKey: process.env.K, baseUrl: 'https://api.minds.com/api/v1' });
  c.users.me().then(u => console.log(JSON.stringify(u).slice(0,120)));"
{"data":{"id":"64b981e6-…","name":"Bill Ottman","username":"ottman", …
```

**The `/api/v1` suffix is required and its absence fails in a misleading way.** With
`baseUrl: 'https://api.minds.com'` the same call throws `NotFoundError: Not Found` — a 404, not an
auth error. Anyone debugging that will suspect their key first, because "Not Found" reads like a
missing user rather than a missing path segment. Worth stating in the SDK's own README; it is the
first thing a Minds-tenant consumer hits.

**Negative control**, so the 200 above means the key did something:

```
$ node -e "… new Recursiv({ apiKey: 'sk_live_notarealkey', baseUrl: 'https://api.minds.com/api/v1' }) …"
AuthenticationError: Invalid API key.
```

Real key → the user object; invalid key → `AuthenticationError`. The pair is the artifact; either
half alone is not.

## PSDK(3) — the `@minds/sdk` / `@recursiv/sdk` relationship: FACTS, decision still owed

`@minds/sdk@0.0.1` is **a thin skin, not a fork**:

```
$ npm i @minds/sdk && node -e "const p=require('@minds/sdk/package.json');
    console.log(p.version, JSON.stringify(p.dependencies))"
0.0.1 {"@recursiv/sdk":"0.5.6"}
$ node -e "console.log(Object.keys(require('@minds/sdk')).slice(0,6).join(', '))"
AdminResource, AgentsResource, AppSubscriptionsResource, AuthResource,
AuthenticationError, AuthorizationError
```

It re-exports the same surface. **But it pins `@recursiv/sdk` at `0.5.6` while `0.6.1` is
published** — so a third party who installs the Minds-branded package silently gets an SDK one
minor behind the one this repo's own rows verify against, and a bug fixed in `0.6.x` is not fixed
for them. That is the concrete cost of leaving the naming question open, and it is the fact the
§10 decision should be made against.

**This file does not make that decision** — §1.4 forbids an agent turning an undecided thing into a
decided one. It records what is true so whoever decides is not deciding from memory.

## PCLI(1) — installs by name, `--version` matches the published release: PASS

```
$ mkdir /tmp/pcli-clean && cd /tmp/pcli-clean && npm init -y && npm i @recursiv/cli
found 0 vulnerabilities
$ npx recursiv --version           → 0.1.13
$ npm view @recursiv/cli version   → 0.1.13
```

## PCLI(2) — blocked by `recursivlabs/recursiv#2080`, not by a credential

The CLI cannot be pointed at any host but `api.recursiv.io`, so a Minds-tenant key always returns a
server-originated `Invalid API key.` The full paired evidence — including the bogus-host control
that distinguishes *never read* from *mis-parsed* — is in the upstream issue. **PCLI(3) is
deliberately held until that lands**, so the documented install path records a working
authenticated command rather than enshrining a broken one.

## What this does NOT establish

- **Everything above ran under an ORG MEMBER's key.** PSDK(2)'s exit says a key **a stranger
  minted**; this is the same artifact form under the wrong identity, and the row does not close on
  it. What it does establish is that the remaining gap is the account, not the software.
- **This box is not a clean machine.** Node 24 and a warm npm cache; `npm i` from empty directories
  is the closest available approximation, not a container.
- **`@minds/sdk` was imported, not exercised.** No authenticated call was made through the skin, so
  whether its pinned `0.5.6` behaves identically on the calls these rows care about is untested.

## 2026-08-05 — the published state caught up with main, re-verified from clean environments

The gaps the sections above recorded are closed at the REGISTRY level now, not just on `main`:

- `@recursiv/sdk` **0.6.2** — tag `sdk-v0.6.2`, run 30954019899. Clean install; `GoalsResource`
  exported; **live authenticated `goals.list` against `api.minds.com` returned real data** through
  the published package (member key — PSDK(2) still wants the stranger form).
- `@minds/{sdk,mcp,cli}` **0.0.2** — `publish-minds-skins.yml` (main `16b83e47`, from recursiv#2159),
  tag `minds-v0.0.2`, run 31016893933. All three from one empty directory:

```
$ npm i @minds/mcp        # recursiv#2060's EUNSUPPORTEDPROTOCOL repro
found 0 vulnerabilities    # installs clean — #2060 CLOSED with this transcript
$ node --input-type=module -e "import * as m from '@minds/sdk'; console.log(typeof m.GoalsResource)"
function                   # the skin re-exports the goals surface
$ npm ls @recursiv/sdk
└── @recursiv/sdk@0.6.2    # the stale 0.5.6 pin the 2026-08-01 section measured is gone
$ node -e "console.log(require('@minds/cli/package.json').version)"
0.0.2
```

- `@recursiv/cli` **0.1.14** (the #2080 base-URL fix) is tagged after recursiv#2127 lands; until
  then the published 0.1.13 remains the pre-fix build and PCLI(2)'s clean-env pair stays owed.

## 2026-08-05 — PCLI(2): the pair, against the PUBLISHED CLI

`@recursiv/cli` **0.1.14** (recursiv#2127 → tag `cli-v0.1.14` → publish run green → registry
verified) ships the #2080 fix. From an empty directory — this section is also PCLI(3)'s documented
install path, with the version commands beside it:

```
$ npm i @recursiv/cli          # the install path
found 0 vulnerabilities
$ npx recursiv --version
0.1.14
$ npm view @recursiv/cli version
0.1.14                          # published == installed
```

The authenticated pair, Minds-org key:

```
$ RECURSIV_API_KEY=$KEY RECURSIV_API_BASE_URL=https://api.minds.com npx recursiv users me
User
  id: 64b981e6-aad8-455e-b092-189165d607a6
  name: Bill Ottman
  username: ottman                        ← the user object, through the Minds host

$ RECURSIV_API_KEY=$KEY RECURSIV_API_BASE_URL=https://nonexistent-host-xyz-12345.invalid npx recursiv users me
fetch failed                              ← a CONNECTION error, not "Invalid API key." — the variable routes

$ RECURSIV_API_KEY=$KEY npx recursiv users me
Invalid API key.                          ← default host unchanged, and correctly server-originated
```

The 2026-08-01 section's finding ("written, never read") is closed at the published surface. What
remains for the row: PCLI(3) documents this working install path, and the stranger-key form of the
authenticated call (PAPI(1)) still wants its sitting.
