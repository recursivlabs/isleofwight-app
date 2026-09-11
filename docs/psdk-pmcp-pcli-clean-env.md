# The four published packages, installed from a clean environment

**PSDK(1), PMCP(1), PCLI(1) — the "installs by name in a clean environment" halves, executed 2026-08-06.**
Every line below is a command's output. A second party re-runs any of them and gets the same result;
nothing here is asserted.

## What was already true and nobody had checked

All four packages are **published on the public registry today**:

```
$ for p in @recursiv/sdk @minds/sdk @recursiv/cli @recursiv/mcp; do printf "%-16s " "$p"; npm view "$p" version; done
@recursiv/sdk    0.7.0
@minds/sdk       0.0.2
@recursiv/cli    0.2.0
@recursiv/mcp    0.5.0
```

PCLI's cell already suspected this — *"the engine already ships `publish-cli.yml`, so this is a
release-and-verify row, not a build-it row"* — and it is true of all three rows, not just PCLI.

**This does not retire §5.8.** `npm whoami` → `ENEEDAUTH` on this machine, so *publish rights* remain
unestablished for either named human; what is established is that publishing has **already happened**,
which is a different claim and the one these sub-artifacts actually need. A future release still needs
someone who can authenticate.

## The clean environment

```
$ rm -rf cleanenv && mkdir cleanenv && cd cleanenv && npm init -y
$ npm install @recursiv/sdk @recursiv/cli @recursiv/mcp
$ npm ls --depth=0
cleanenv@1.0.0
+-- @recursiv/cli@0.2.0
+-- @recursiv/mcp@0.5.0
`-- @recursiv/sdk@0.7.0
```

Empty directory, no workspace, no lockfile from this repo, packages resolved by name from the registry.

## PSDK(1) — installs and imports

```
$ node --input-type=module -e "import { Recursiv } from '@recursiv/sdk'; console.log('import OK, typeof Recursiv =', typeof Recursiv);"
import OK, typeof Recursiv = function
```

Resolved version **0.7.0**.

> ⚠ **Version drift, found by this check and not previously recorded here.** The registry's latest is
> **0.7.0**; this repo pins **0.5.6** (`git show origin/main:package.json`). Two minors behind on the
> package that §2 names in ten places as the surface verification runs through — so every "verified
> through `@recursiv/sdk`" claim on this ladder was verified through 0.5.6, not through what a stranger
> installing today receives. `docs/sdk-upgrade-0.6.1.md` exists on `main` and stops short of 0.7.0.
> **This is not a PSDK sub-artifact and is not counted as one** — it is a §1.2-class finding filed
> where the next reader will hit it.

## PCLI(1) — installs, `--version` matches the published release

```
$ npx --no-install recursiv --version
0.2.0
```

Byte-equal to the registry's `@recursiv/cli` version above. *(Node emits an unrelated
`ExperimentalWarning: localStorage is not available` on stderr; the version string is on stdout.)*

## PMCP(1) — installs, and the binary refuses correctly without a credential

```
$ node -e "const p=require('./node_modules/@recursiv/mcp/package.json'); console.log(p.name, p.version, JSON.stringify(p.bin))"
@recursiv/mcp 0.5.0 {"recursiv-mcp":"./dist/bin.js"}

$ echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{…}}' | node node_modules/@recursiv/mcp/dist/bin.js
Missing RECURSIV_API_KEY environment variable. Set it to your Recursiv API key.
```

A named refusal, not a hang and not a false green — which is the behaviour PMCP's whole row is about.

## PMCP(3) — the false-green detector, run

Not new work: `scripts/check-mcp-data-tools.sh` exists and `scripts/confirm-artifacts.sh:201` already
runs it as the sub-artifact. Executed here to show it still discriminates:

```
$ MINDS_KEY=… bash scripts/check-mcp-data-tools.sh
MCP data-tool check — origin https://api.minds.com
  ..    connection/identity reachable (whoami-class, status 200) — NOT evidence of a working server
  PASS  data tool returned 5 row(s) — the server is working, not merely connected
```

The middle line is the point: the connection check passes *and is explicitly refused as evidence*,
because `claude mcp list` prints `✔ Connected` in exactly the broken state this detects.

## What these transcripts do NOT establish

- **PSDK(2), PMCP(2), PCLI(2)** — each needs *one authenticated call under a **stranger-minted** key*.
  A key belonging to this org is not that key, and no agent is a stranger. All three inherit PAPI(1)'s
  stranger sitting; §5.54 established the mint path exists, which makes them reachable, not done.
- **PSDK(3)** — the `@minds/sdk` (0.0.2) vs `@recursiv/sdk` (0.7.0) question. Both are published and
  both are in `package.json`. Which one third parties are told to install is a product decision, not
  a command's output; it is Bill's and is not decided here.
- **Publish rights** (§5.8) — see above.
