import { ORG_ID } from './recursiv';
import { captureException } from './monitoring';
import { invalidate } from './cache';

// Username of the official support agent (a discoverable AI agent owned by the
// Minds team). Resolved at runtime so there's no hard-coded id to drift.
export const SUPPORT_AGENT_USERNAME = 'minds_support';

/**
 * Open (or reuse) a DM with the Minds Support agent and return the conversation
 * id. The existing chat handles the agent's streamed replies; the support
 * agent's own system prompt does tier-1. Returns null if the agent can't be
 * resolved or the DM can't be opened.
 */
export async function openSupportConversation(sdk: any): Promise<string | null> {
  try {
    const agents = (await sdk.agents.listDiscoverable({ limit: 200, organization_id: ORG_ID || undefined })).data || [];
    const support = agents.find((a: any) => a.username === SUPPORT_AGENT_USERNAME);
    if (!support?.id) return null;
    const dm = (await sdk.chat.dm({ user_id: support.id, organization_id: ORG_ID || undefined })).data;
    // Make the new support thread show in the sidebar immediately.
    invalidate('conversations');
    return dm?.id ?? null;
  } catch (e) {
    captureException(e, { action: 'open_support' });
    return null;
  }
}
