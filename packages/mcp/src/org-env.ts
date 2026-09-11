type McpEnvironment = Record<string, string | undefined>;

/**
 * Make a Minds-specific organization scope authoritative for the Minds MCP.
 *
 * Hosted processes can inherit RECURSIV_* values from the parent platform.
 * Leaving those values in place makes the shared MCP registrars act on the
 * parent organization even when MINDS_ORG_ID explicitly selects Minds. Mirror
 * the selected Minds value to both shared names because @recursiv/mcp accepts
 * the canonical name and its legacy alias.
 */
export function applyMindsOrganizationEnvironment(env: McpEnvironment): string | undefined {
  const organizationId =
    env.MINDS_ORGANIZATION_ID?.trim() || env.MINDS_ORG_ID?.trim();

  if (!organizationId) return undefined;

  env.RECURSIV_ORGANIZATION_ID = organizationId;
  env.RECURSIV_ORG_ID = organizationId;
  return organizationId;
}

/**
 * Make a Minds-specific project scope authoritative for the Minds MCP.
 *
 * Same inheritance hazard as the organization scope: a hosted process can
 * carry the parent platform's RECURSIV_PROJECT_ID, and the shared registrars
 * (memory, self-evaluate, tunnel) use it as their default project. An explicit
 * MINDS_PROJECT_ID must win over that inherited value.
 */
export function applyMindsProjectEnvironment(env: McpEnvironment): string | undefined {
  const projectId = env.MINDS_PROJECT_ID?.trim();

  if (!projectId) return undefined;

  env.RECURSIV_PROJECT_ID = projectId;
  return projectId;
}
