// Helpers for ensuring a personal agent has DM'd the user their intro
// message at least once. Used by:
//   - app/agent.tsx (post on first-time setup)
//   - app/(tabs)/chat.tsx back-fill (post on first chat-tab visit if
//     setup completed before this code shipped + intro was lost)
//
// Idempotent — only posts when the agent thread has zero agent-authored
// messages. Caller is responsible for invalidating the conversations
// cache afterwards so the Recent sidebar refetches.

import { ORG_ID } from './recursiv';
import { fetchDeduped } from './cache';

// Plain, no-possessive greeting. Earlier version templated the user's
// first name ("Hey jack, ...") but Jack's stored display name had a
// trailing 's, so the intro rendered "Hey jack's, I'm...". Generic
// greeting dodges the whole class of name-parsing bugs.
const INTRO_DM_BODY = [
  "Hi, I'm Minds AI. I work only for you.",
  '',
  "I'm your own assistant here on Minds. I learn what you care about and bring you the best of it, help you keep up with your groups, draft replies in your voice, and answer questions about anything on the network or the open web.",
  '',
  'A few things worth knowing:',
  '- Just reply here anytime. Ask me something, or tell me a topic you follow and I will find the best of it for you.',
  '- You are in control. Change my name, my style, the model I run on, and what I can see in Settings.',
  '- Not interested right now? You can turn me off in Settings in one tap, and back on whenever.',
  '',
  'Our chats are private between us and never train a shared model.',
].join('\n');

export const INTRO_DM_TEMPLATE = (_firstName?: string): string => INTRO_DM_BODY;

export function firstName(name: string | null | undefined): string {
  if (!name) return 'there';
  // Strip trailing possessive ('s) and other punctuation so a stored
  // name of "jack's" doesn't render as "Hey jack's, ..." anywhere
  // else that uses this helper.
  const first = name.trim().split(/\s+/)[0] || 'there';
  return first.replace(/['’]s$/i, '').replace(/[^\p{L}\p{N}-]+$/u, '') || 'there';
}

/**
 * Ensure a personal agent's DM thread has at least one agent-authored
 * message. No-ops if the thread already has one. Returns the
 * conversation id when present so callers can route the user into it.
 *
 * Dedup check uses the SDK's `sender` field shape (server returns
 * `sender: { id, name, is_ai }`, NOT `author`). Earlier code looked
 * at `author.id` which was always undefined — so every back-fill
 * reposted the intro. Jack's thread ended up with 4 copies.
 */
export async function ensureIntroDM(
  sdk: any,
  agentId: string,
  _userName?: string | null | undefined,
): Promise<string | null> {
  if (!sdk || !agentId) return null;
  // De-dupe the whole back-fill. The chat tab AND the SideNav both run an
  // intro back-fill on a web load, so without this each one independently
  // hit chat.dm + chat.messages for the SAME agent thread — doubling the
  // request load (and racing two intro posts). Coalescing on the agent id
  // collapses concurrent callers onto a single shared run.
  return fetchDeduped(`req:intro-dm:${agentId}`, () => doEnsureIntroDM(sdk, agentId));
}

async function doEnsureIntroDM(sdk: any, agentId: string): Promise<string | null> {
  const dmRes: any = await sdk.chat.dm({ user_id: agentId, organization_id: ORG_ID || undefined } as any);
  const conversationId: string | undefined = dmRes?.data?.id;
  if (!conversationId) return null;
  try {
    const existing: any = await sdk.chat.messages?.(conversationId, { limit: 50 });
    const messages: any[] = existing?.data ?? [];
    const alreadyPosted = messages.some((m) => {
      const sid = m.sender?.id ?? m.author?.id ?? m.sender_id ?? m.senderId;
      const isAi = m.sender?.is_ai ?? m.sender?.isAi ?? m.author?.is_ai ?? m.author?.isAi;
      return sid === agentId || isAi === true;
    });
    if (alreadyPosted) return conversationId;
    await sdk.chat.sendAsAgent({
      agent_id: agentId,
      conversation_id: conversationId,
      content: INTRO_DM_BODY,
    });
  } catch (err) {
    console.warn('[ensureIntroDM] failed to post intro', err);
    throw err;
  }
  return conversationId;
}
