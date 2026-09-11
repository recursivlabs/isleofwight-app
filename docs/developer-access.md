# Developer access

Run this before doing repository work:

```bash
bash scripts/bootstrap-dev-access.sh
```

The bootstrap asks which role applies, starts provider login flows, and then
runs a read-only preflight. It never prints secret values and never asks a
developer to paste a shared production key.

## Profiles

- `owner`: Bill's normal local setup. Requires the developer's own GitHub and
  Infisical identities and verifies the live Minds dispatcher.
- `external`: the default for outside contributors. Requires the developer's
  own GitHub identity and Minds repository access. Recursiv repository access
  is optional and should be granted only for engine-scoped assignments. This
  profile does not grant or request the shared production dispatcher credential.
- `launch-operator`: only for a person explicitly authorized by an owner to
  operate the production launch ladder. Access is granted through that person's
  own Infisical identity so it remains attributable and revocable.

Non-interactive checks are available with:

```bash
bash scripts/dev-access-check.sh --profile owner
bash scripts/dev-access-check.sh --profile external
bash scripts/dev-access-check.sh --profile launch-operator
```

If the Infisical CLI is installed outside `PATH`, point the scripts at the
executable without copying any secret into the shell:

```bash
INFISICAL_BIN=/absolute/path/to/infisical bash scripts/dev-access-check.sh --profile owner
```

The shared loader first validates `--plain` output, then uses the CLI's JSON
shape as a compatibility fallback. Empty successful output, malformed JSON,
missing CLI, and command/session failure remain distinct failure states.

## Failure labels

The preflight distinguishes missing tools, expired or sandbox-hidden provider
sessions, repository access denial, unavailable secrets, rejected credentials,
and optional capabilities. A Codex sandbox may be unable to read credentials
stored in the macOS Keychain even when they work in a host terminal; that is
reported as `AUTH_OR_KEYRING_UNAVAILABLE`, not as proof that the account or
secret does not exist.

## Adding an outside developer

1. Invite their own GitHub account with the least repository role their task
   needs. Never give them another developer's GitHub token.
2. Start them with `--profile external`.
3. If their assigned work needs a protected environment, invite their own
   identity to the narrowest Infisical environment and role that suffices.
4. Use `launch-operator` only when production dispatcher access is part of the
   assignment. Do not send `MINDS_NETWORK_API_KEY` in chat, email, or a shell
   command.
5. Remove the person's GitHub and Infisical access when the engagement ends.

Provider-console, deployment-MCP, store-console, and DNS access are separate
capabilities. Passing this preflight does not imply those permissions.
