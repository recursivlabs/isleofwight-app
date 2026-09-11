import { z } from "zod";
import type { Recursiv } from "@recursiv/sdk";
import { Scopes, type ScopedToolRegistry } from "@recursiv/mcp";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

const MINDS_NETWORK_ID =
  process.env.MINDS_NETWORK_ID ?? "0f1fcb0f-11c0-41f2-9406-943a88f48b59";

export function registerMindsUtilityTools(
  registry: ScopedToolRegistry,
  client: Recursiv,
) {
  registry.tool(
    "list_notifications",
    "List recent notifications for the authenticated user",
    [Scopes.NOTIFICATIONS_READ],
    {
      status: z
        .enum(["unread", "read", "all"])
        .optional()
        .describe("Filter by status"),
      limit: z.number().optional().describe("Max notifications to return"),
      cursor: z.string().optional().describe("Pagination cursor"),
      organization_id: z
        .string()
        .optional()
        .describe("Optional organization scope"),
    },
    async (params: {
      status?: "unread" | "read" | "all";
      limit?: number;
      cursor?: string;
      organization_id?: string;
    }) => {
      const result = await client.notifications.list(params);
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  registry.tool(
    "get_network_config",
    "Get public Minds network configuration: branding, features, auth methods, and capabilities",
    [],
    {},
    async () => {
      const result = await client.network.getConfig();
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  registry.tool(
    "get_my_invite_codes",
    "Get the authenticated user's invite codes and remaining generation allowance",
    [Scopes.USERS_READ],
    {},
    async () => {
      const result = await client.inviteCodes.myCodes();
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  registry.tool(
    "get_link_preview",
    "Fetch Open Graph / Twitter card metadata for a public URL",
    [],
    {
      url: z.string().url().describe("Public URL to preview"),
    },
    async ({ url }: { url: string }) => {
      const result = await client.linkPreview.get(url);
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  registry.tool(
    "get_public_moderation_log",
    "Read the privacy-safe public Minds moderation action log and principles",
    [],
    {
      network_id: z
        .string()
        .uuid()
        .optional()
        .describe("Network UUID; defaults to the main Minds network"),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    },
    async ({
      network_id,
      limit,
      offset,
    }: {
      network_id?: string;
      limit?: number;
      offset?: number;
    }) => {
      const result = await client.moderation.publicLog(
        network_id ?? MINDS_NETWORK_ID,
        { limit, offset },
      );
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  registry.tool(
    "list_my_moderation_actions",
    "List moderation decisions affecting the authenticated user or content they own",
    [Scopes.POSTS_READ],
    {},
    async () => {
      const result = await client.moderation.mine();
      return textResult(JSON.stringify(result, null, 2));
    },
  );

  registry.tool(
    "appeal_moderation_action",
    "Appeal a moderation decision affecting the authenticated user or content they own",
    [Scopes.POSTS_WRITE],
    {
      action_id: z.string().uuid().describe("Moderation action UUID"),
      statement: z
        .string()
        .min(10)
        .max(2000)
        .describe("Missing context or reason the decision should change"),
    },
    async ({
      action_id,
      statement,
    }: {
      action_id: string;
      statement: string;
    }) => {
      const result = await client.moderation.appeal(action_id, statement);
      return textResult(JSON.stringify(result, null, 2));
    },
  );
}
