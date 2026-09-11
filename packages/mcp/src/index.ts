#!/usr/bin/env node
/**
 * minds-mcp — Model Context Protocol server for the Minds platform.
 *
 * Curated wrapper over @recursiv/mcp. By default it exposes read-only
 * social/content tools under the Minds namespace and authenticates via
 * MINDS_API_KEY (with RECURSIV_API_KEY accepted as a fallback). Write
 * tools and platform/dev tools require explicit environment opt-in.
 *
 * To contribute at the platform layer (new tools, registry behavior,
 * scope handling), head to https://github.com/recursivlabs/recursiv —
 * tools added there appear here automatically.
 */
// Evaluated for its side effects BEFORE @recursiv/mcp: several shared
// registrars capture env defaults at module scope, so dotenv loading and the
// MINDS_* -> RECURSIV_* mirroring must run ahead of that package's evaluation.
import "./env-setup.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Recursiv } from "@recursiv/sdk";
import {
  ScopedToolRegistry,
  registerSocialTools,
  registerProjectTools,
  registerAgentTools,
  registerSandboxTools,
  registerMemoryTools,
  registerDispatcherTools,
  registerGoalsTools,
  registerSwarmTools,
  registerTemplateTools,
  registerRemainingTools,
  registerDevTools,
  registerPlatformTools,
  registerSelfEvaluateTools,
} from "@recursiv/mcp";
import { registerMindsUtilityTools } from "./minds-tools.js";
import { writeMindsMcpStderr } from "./redacted-stderr.js";
import {
  mindsWriteToolsEnabled,
  mindsPlatformToolsEnabled,
  resolveMindsGrantedScopes,
} from "./scope-policy.js";

const apiKey = process.env.MINDS_API_KEY ?? process.env.RECURSIV_API_KEY;

if (!apiKey) {
  writeMindsMcpStderr(
    "[minds-mcp] Missing MINDS_API_KEY (or RECURSIV_API_KEY) environment variable.",
  );
  process.exit(1);
}

const baseUrl =
  process.env.MINDS_API_URL ??
  process.env.RECURSIV_BASE_URL ??
  "https://api.minds.com/api/v1";

// We intentionally use Recursiv directly here (not Minds from @minds/sdk)
// because the registrar functions are typed against Recursiv. Behavior
// is identical — the Minds class is a thin composition over Recursiv.
const client = new Recursiv({ apiKey, baseUrl });

const server = new McpServer({
  name: "Minds — open AI social platform and developer surface, powered by Recursiv",
  version: "0.0.1",
  description:
    "Curated Minds social/content tool surface. Read-only by default; write tools and Recursiv platform/dev tools require explicit environment opt-in. Authenticated via MINDS_API_KEY.",
});

const grantedScopes = resolveMindsGrantedScopes();
const registry = new ScopedToolRegistry(server, grantedScopes);

if (mindsWriteToolsEnabled() && !process.env.RECURSIV_ORG_ID && !process.env.RECURSIV_ORGANIZATION_ID) {
  writeMindsMcpStderr(
    "[minds-mcp] Write tools were enabled without MINDS_ORG_ID or RECURSIV_ORG_ID. RED social writes will not have the admin approval gate configured.",
  );
}

registerSocialTools(registry, client);
registerAgentTools(registry, client);
registerMemoryTools(registry, client);
registerMindsUtilityTools(registry, client);

if (mindsPlatformToolsEnabled()) {
  const anonClient = new Recursiv({ anonymous: true, baseUrl });
  registerProjectTools(registry, client);
  registerSandboxTools(registry, anonClient);
  registerDispatcherTools(registry, client);
  // Goals sit alongside the dispatcher, not apart from it: a task without the
  // goal it serves is a to-do, and reading the Minds roadmap through this
  // server returned 78 tasks and no way to see what any of them was for.
  // Same `commands:read` scope the dispatcher tools already require, so any
  // key that can list tasks can already list the goals they belong to.
  registerGoalsTools(registry, client);
  registerSwarmTools(registry, client);
  registerTemplateTools(registry, client);
  registerRemainingTools(registry, client);
  registerDevTools(registry, client);
  registerPlatformTools(registry, client);
  registerSelfEvaluateTools(registry, client);
} else {
  writeMindsMcpStderr(
    "[minds-mcp] Platform/dev tools are disabled by default. Set MINDS_MCP_ENABLE_PLATFORM_TOOLS=1 and explicit MINDS_API_KEY_SCOPES if you need project, sandbox, dispatcher, billing, wallet, database, storage, or admin tools.",
  );
}

if (grantedScopes !== null) {
  const scopeList = [...grantedScopes].join(", ");
  writeMindsMcpStderr(
    `[minds-mcp] Scope filter active — registered ${registry.registered} tools, skipped ${registry.skipped} (scopes: ${scopeList})`,
  );
}

server.registerResource(
  "server_manifest",
  "minds://server/manifest",
  {
    title: "Minds MCP manifest",
    description: "Machine-readable metadata about the Minds MCP server.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            name: "minds",
            version: "0.0.1",
            transport: "stdio",
            baseUrl,
            authEnvVars: ["MINDS_API_KEY", "RECURSIV_API_KEY"],
            poweredBy: "recursiv",
            registeredTools: registry.registered,
          },
          null,
          2,
        ),
      },
    ],
  }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  writeMindsMcpStderr("[minds-mcp] server error:", err);
  process.exit(1);
});
