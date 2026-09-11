import { Scopes } from "@recursiv/mcp";

/**
 * Minds MCP is intended for social/content workflows by default. The
 * Recursiv MCP package has a backwards-compatible "register everything"
 * default when no scope env var is set; that is too broad for a branded
 * consumer app surface.
 */
export const DEFAULT_MINDS_MCP_READ_SCOPES = [
  Scopes.POSTS_READ,
  Scopes.USERS_READ,
  Scopes.COMMUNITIES_READ,
  Scopes.CHAT_READ,
  Scopes.AGENTS_READ,
  Scopes.NOTIFICATIONS_READ,
  Scopes.MEMORY_READ,
] as const;

export const DEFAULT_MINDS_MCP_WRITE_SCOPES = [
  Scopes.POSTS_WRITE,
  Scopes.CHAT_WRITE,
  Scopes.AGENTS_WRITE,
  Scopes.MEMORY_WRITE,
] as const;

export const DEFAULT_MINDS_MCP_SCOPES = [
  ...DEFAULT_MINDS_MCP_READ_SCOPES,
] as const;

export function parseScopeList(raw: string): Set<string> | null {
  const trimmed = raw.trim();
  if (trimmed === "*" || trimmed.toLowerCase() === "all") {
    return null;
  }

  return new Set(
    trimmed
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  );
}

export function resolveMindsGrantedScopes(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> | null {
  const raw = env.MINDS_API_KEY_SCOPES ?? env.RECURSIV_API_KEY_SCOPES;
  if (raw) {
    return parseScopeList(raw);
  }

  const defaults = mindsWriteToolsEnabled(env)
    ? [...DEFAULT_MINDS_MCP_READ_SCOPES, ...DEFAULT_MINDS_MCP_WRITE_SCOPES]
    : DEFAULT_MINDS_MCP_READ_SCOPES;
  return new Set(defaults);
}

export function mindsWriteToolsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.MINDS_MCP_ENABLE_WRITES;
  return (
    raw === "1" || raw?.toLowerCase() === "true" || raw?.toLowerCase() === "yes"
  );
}

export function mindsPlatformToolsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env.MINDS_MCP_ENABLE_PLATFORM_TOOLS;
  return (
    raw === "1" || raw?.toLowerCase() === "true" || raw?.toLowerCase() === "yes"
  );
}
