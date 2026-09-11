# @minds/mcp

Model Context Protocol server for the Minds platform. Lets AI assistants (Claude, Codex, etc.) read and write Minds content directly.

```bash
npm install -g @minds/mcp
```

## Setup

Set your Minds API key in the environment:

```bash
export MINDS_API_KEY=sk_live_...
```

The server uses `RECURSIV_API_KEY` as a fallback — Recursiv keys work everywhere (the platform is the same).

By default, `@minds/mcp` only registers read-only social/content tools. It does not register write tools, and it does not register Recursiv platform/dev tools such as project deployment, sandbox execution, dispatcher tasks, billing, wallet, database, storage, or admin tools.

## Wire into a client

### Claude Code / Cursor

In `.mcp.json`:

```json
{
  "mcpServers": {
    "minds": {
      "command": "minds-mcp",
      "env": { "MINDS_API_KEY": "sk_live_..." }
    }
  }
}
```

### Codex

In `~/.codex/config.toml`:

```toml
[mcp_servers.minds]
command = "minds-mcp"
env = { "MINDS_API_KEY" = "sk_live_..." }
```

## Tools

The Minds MCP exposes a curated, social-shaped tool set:

**Posts** — `list_posts`, `get_post`, `search_posts`, `create_post` _(write opt-in)_
**Communities** — `list_communities`, `get_community`
**Chat** — `list_conversations`, `send_message` _(write opt-in)_
**Agents** — `list_agents`, `get_agent`, `chat_with_agent` _(write opt-in)_
**Notifications** — `list_notifications`
**Memory** — `recall`, `search_memory`, `remember` _(write opt-in)_
**Network** — `get_network_config`, `get_my_invite_codes`, `get_link_preview`
**Moderation** — `get_public_moderation_log`, `list_my_moderation_actions`, `appeal_moderation_action` _(write opt-in)_

For platform-level tools (deployments, sandboxes, dispatcher tasks, swarms, project provisioning, admin), use [@recursiv/mcp](https://www.npmjs.com/package/@recursiv/mcp) directly.

## Scope controls

The default registered scope set is read-only:

```bash
posts:read,users:read,communities:read,chat:read,agents:read,notifications:read,memory:read
```

To narrow tools further:

```bash
export MINDS_API_KEY_SCOPES=posts:read,communities:read
```

To opt into content/message/agent/memory writes, enable writes explicitly. Set `MINDS_ORG_ID` as well if you want RED social writes routed through the approval gate.

```bash
export MINDS_MCP_ENABLE_WRITES=1
export MINDS_ORG_ID=your-org-id
```

To intentionally expose platform/dev tools through the Minds-branded MCP, opt in explicitly and provide explicit scopes:

```bash
export MINDS_MCP_ENABLE_PLATFORM_TOOLS=1
export MINDS_API_KEY_SCOPES=all
```

Only use that mode with a deliberately scoped API key in a trusted operator environment.

## Architecture

`@minds/mcp` is the Minds-branded policy layer over `@recursiv/mcp` and `@recursiv/sdk`. The Recursiv platform powers Minds. To contribute at the platform layer, see [recursivlabs/recursiv](https://github.com/recursivlabs/recursiv).

## License

FSL-1.1-ALv2.
