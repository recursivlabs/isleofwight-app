# Minds developer surfaces

This document separates **source present**, **package built**, **package published**, and **live API
usable**. Those are four different claims. Re-run the commands before citing the dated registry
snapshot; `pnpm docs:check` keeps the source inventory synchronized but deliberately does not turn a
network outage or an unpublished package into a CI docs failure.

## Five Minds-owned packages

| Package | Source | Package README | Source version |
|---|---|---|---:|
| `@minds/sdk` | `packages/sdk/package.json` | `packages/sdk/README.md` | `0.0.10` |
| `@minds/api` | `packages/api/package.json` | `packages/api/README.md` | `0.0.1` |
| `@minds/mcp` | `packages/mcp/package.json` | `packages/mcp/README.md` | `0.0.6` |
| `@minds/cli` | `packages/cli/package.json` | `packages/cli/README.md` | `0.0.7` |
| `@minds/tenant-overlay` | `packages/tenant-overlay/package.json` | `packages/tenant-overlay/README.md` | `0.0.1` |

Re-fetch source versions:

```sh
for manifest in packages/*/package.json; do
  jq -r '[.name,.version] | @tsv' "$manifest"
done
```

### Public npm snapshot — not equal to source

Public registry responses observed 2026-09-04, before the `@minds/sdk@0.0.10` release tag:

| Package | `latest` returned by `registry.npmjs.org` | Gap |
|---|---:|---|
| `@minds/sdk` | `0.0.9` | Source `0.0.10` is prepared in this PR and publishes only after merge. |
| `@minds/api` | `0.0.1` | Matches source. |
| `@minds/mcp` | `0.0.6` | Matches source. |
| `@minds/cli` | `0.0.7` | Matches source. |
| `@minds/tenant-overlay` | `0.0.1` | Matches source. |

Re-fetch without npm credentials:

```sh
for package_path in sdk api mcp cli tenant-overlay; do
  if metadata="$(wget -qO- "https://registry.npmjs.org/@minds%2f${package_path}/latest")"; then
    printf '%s\n' "$metadata" | jq -r '[.name,.version] | @tsv'
  else
    printf '@minds/%s\t%s\n' "$package_path" 'not returned by public registry'
  fi
done
```

The publication workflow lives at `.github/workflows/publish-minds-packages.yml`. Release tags must
point to a commit already on `main`; the workflow builds and dry-packs every package, then publishes
only package versions that are not already on npm. This keeps a one-package release from failing on
the other four packages' existing versions.

## SDK surface

`@minds/sdk` defaults to `https://api.minds.com/api/v1`, adds anonymous visibility-filtered public
post, profile, and community reads, and exposes the underlying `Recursiv` client. `packages/sdk/src/client.ts` currently
declares these resources:

`auth`, `accounts`, `posts`, `users`, `communities`, `chat`, `projects`, `agents`, `tags`, `sandbox`,
`profiles`, `organizations`, `notifications`, `settings`, `billing`, `appSubscriptions`, `freeTier`, `inviteCodes`,
`inviteCodesAdmin`, `admin`, `email`, `storage`, `databases`, `github`, `deployments`,
`integrations`, `projectBrain`, `organizationSettings`, `organizationSecurity`, `projectSettings`,
`uploads`, `wallet`, `protocols`, `inbox`, `network`, `simulator`, `commands`, `brain`, `memory`,
`dispatcher`, `swarms`, `templates`, `media`, `webhooks`, `jobs`, `curator`, `reports`, `moderation`,
`linkPreview`, `realtime`, `publicPosts`, `publicProfiles`, `publicCommunities`, and `recursiv`.

`pnpm docs:check` parses the `readonly` declarations and requires every resource name above. Runtime
parity is separately exercised by `pnpm packages:runtime` and the SDK tests; a list in Markdown does
not prove a server endpoint works.

## REST/API surface

- Canonical origin: `https://api.minds.com`
- Versioned base: `https://api.minds.com/api/v1`
- Better Auth base: `https://api.minds.com/api/auth`
- Typed endpoint map: `packages/api/src/index.ts`
- Full generated registry/status census: [`docs/api-endpoints.md`](./api-endpoints.md)
- Generator: `scripts/gen-api-endpoints.sh`

The generated census reads Recursiv's route registry and probes the Minds production origin
unauthenticated. `401` is the expected protected-route response; every other code is an observation
to investigate, not an automatic failure and not proof that an authenticated call works.

## MCP surface

`@minds/mcp` is read-only by default. Writes require `MINDS_MCP_ENABLE_WRITES=1`; platform/dev tools
require `MINDS_MCP_ENABLE_PLATFORM_TOOLS=1`; `MINDS_API_KEY_SCOPES` narrows or explicitly broadens
the registered set. The Minds-owned utilities layered over `@recursiv/mcp` are:

- `list_notifications`
- `get_network_config`
- `get_my_invite_codes`
- `get_link_preview`
- `get_public_moderation_log`
- `list_my_moderation_actions`
- `appeal_moderation_action`

The social, agent, and memory registrars come from `@recursiv/mcp`; do not freeze their entire tool
list here. The package README documents the curated names developers use, while package tests prove
scope filtering and write/platform opt-ins.

## CLI surface

Implemented leaf commands parsed from `packages/cli/src/bin/minds.ts`:

- `minds auth login`, `minds auth logout`, `minds auth whoami`
- `minds info`
- `minds posts list`, `minds posts create`
- `minds communities list`
- `minds agents list`
- `minds notifications list`
- `minds chat list`, `minds chat messages`, `minds chat send`, `minds chat dm`
- `minds moderation log`, `minds moderation mine`, `minds moderation appeal`

Reserved commands that intentionally print “coming soon”:

- `minds init`
- `minds deploy`
- `minds tenant`

`pnpm docs:check` derives the leaf commands and requires the package README to contain each one. It
does not call a placeholder implemented, and it does not call a source command publicly installable.

## Proof ladder

Run locally from this repository:

```sh
pnpm docs:check        # route/resource/tool/command/package documentation coverage
pnpm packages:check    # build + typecheck + tests + runtime smoke + dry-pack
```

Then, in a clean directory, install the **registry versions** and run an authenticated Minds call.
That clean-room transcript—not this source tree—is the publication/use artifact. Jack's owner lane
controls that work.
