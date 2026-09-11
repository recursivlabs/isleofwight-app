import { ORG_ID } from './recursiv';
import { resolvePersonalAgent } from './resolvePersonalAgent';
import { chatConversationHref } from './chatNavigation';

export type AskAgentResult = 'opened' | 'setup' | 'failed';

// Opens the signed-in user's PERSONAL agent DM, seeds it with `prompt`, and
// navigates to the chat. The heavy LLM work happens server-side in the agent
// and is metered against the user's Minds+/Pro allowance. The result is
// explicit so a failed lookup or conversation creation never looks like a
// successful no-op to the calling surface.
export async function askAgent(sdk: any, router: any, prompt: string): Promise<AskAgentResult> {
  if (!sdk) return 'failed';
  try {
    const personal = await resolvePersonalAgent(sdk);
    // No personal agent yet → send them through setup; they can retry after.
    if (!personal) {
      router.push('/agent' as any);
      return 'setup';
    }
    const dm = await sdk.chat.dm({ user_id: personal.id, organization_id: ORG_ID || undefined } as any);
    const convoId = dm.data?.id;
    if (!convoId) return 'failed';
    // Hand the prompt to the chat screen as a route param — it sends via
    // handleSend → agents.chatStream, the ONLY path that actually triggers an
    // agent reply. Sending here with chat.send merely inserted the message
    // (no reply, not visible until refresh), which was the "asked my agent,
    // got no answer" bug.
    router.push(chatConversationHref(convoId, { prompt }) as any);
    return 'opened';
  } catch {
    return 'failed';
  }
}

// Builds the "give me context on this post" prompt from a post object.
export function buildPostContextPrompt(opts: { author?: string; content?: string; url?: string }): string {
  const author = opts.author || 'someone';
  const body = (opts.content || '').trim().slice(0, 1200);
  const parts = [
    `Give me more context on this post by @${author} — explain what it's about, any background I should know, and whether it's accurate.`,
  ];
  if (body) parts.push(`\n"${body}"`);
  if (opts.url) parts.push(`\n${opts.url}`);
  return parts.join('\n');
}
