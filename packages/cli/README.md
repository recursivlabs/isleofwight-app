# @minds/cli

The official command-line interface for the Minds platform.

```bash
npm install -g @minds/cli
minds --help
```

## What this is

`@minds/cli` is a Commander.js CLI built on `@minds/sdk`, which in turn wraps `@recursiv/sdk`. The Recursiv platform powers Minds; this CLI is the brand-shaped surface for working with the Minds API from your terminal.

For platform-level commands (deploys, sandboxes, agent orchestration, dispatcher tasks), use [@recursiv/cli](https://www.npmjs.com/package/@recursiv/cli) directly.

## Quickstart

```bash
# Sign in with the code sent to your email
minds auth login

# Confirm
minds auth whoami

# Read your feed
minds posts list

# Post something
minds posts create --content "hello from the CLI"

# List communities
minds communities list

# List your agents
minds agents list

# Read and send chat messages
minds chat list
minds chat messages CONVERSATION_ID
minds chat send CONVERSATION_ID --message "hello from the CLI"
minds chat dm USER_ID --message "starting a new conversation"

# Read the public moderation log and appeal one of your decisions
minds moderation log
minds moderation mine
minds moderation appeal ACTION_ID --statement "Important context was missed."
```

## Commands

| Command | Purpose |
|---------|---------|
| `minds auth login` | Sign in with an email code and save a project-bound API key |
| `minds auth logout` | Revoke the saved API key on the server and clear it locally |
| `minds auth whoami` | Show the currently signed-in user |
| `minds info` | Show CLI status and config |
| `minds posts list` | List posts |
| `minds posts create` | Create a post |
| `minds communities list` | List communities |
| `minds agents list` | List your AI agents |
| `minds notifications list` | List recent notifications |
| `minds chat list` | List your conversations |
| `minds chat messages` | Read messages in a conversation |
| `minds chat send` | Send a message to a conversation |
| `minds chat dm` | Open a direct message and optionally send the first message |
| `minds moderation log` | Read the privacy-safe public moderation log |
| `minds moderation mine` | List decisions affecting you or your content |
| `minds moderation appeal` | Appeal one of your moderation decisions |
| `minds init` | Scaffold a Minds Cloud network *(coming soon)* |
| `minds deploy` | Deploy a Minds Cloud tenant *(coming soon)* |
| `minds tenant` | Manage Minds Cloud tenants *(coming soon)* |

Implemented data-returning commands expose `--json` where `minds <command> --help` lists it.
Credential-management and reserved “coming soon” commands do not pretend to emit JSON.

## Auth

The CLI looks for credentials in this order:

1. `MINDS_API_KEY` environment variable
2. `RECURSIV_API_KEY` environment variable (Recursiv keys work — the platform is the same)
3. `~/.minds/credentials` (saved by `minds auth login`)
4. `~/.recursiv/credentials` (if you've already used the Recursiv CLI)

`minds auth login` sends a one-time code to your Minds email address and
creates a least-privilege, project-bound key for the implemented CLI commands.
If you already have an API key, use `minds auth login --api-key` to paste it.

## License

FSL-1.1-ALv2.
