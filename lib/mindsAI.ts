// Minds AI onboarding: on first sign-in, every user gets a personal agent
// ("Minds AI") and a one-time welcome DM from it in their inbox. No opt-in
// gate — the agent is there by default and can be turned off in Settings.
//
// Design notes:
//  - Idempotent + non-clobbering. ensurePersonal is find-or-create; we only
//    apply Minds branding (name/model/prompt) when the agent is NEWLY created,
//    so a user who already customized their agent keeps their settings.
//  - Fire-and-forget from the auth flow: never block or fail sign-in on this.
//  - Welcome DM dedup lives in ensureIntroDM (posts only if the thread has zero
//    agent-authored messages), so re-running on every sign-in is safe.

import { ensureIntroDM } from './agentIntro';
import { invalidate } from './cache';

// Default Gemini for the personal agent (customer-agent default; never Sonnet).
const MINDS_AI_MODEL = 'google/gemini-3.1-pro-preview';
const MINDS_AI_NAME = 'Minds AI';
const MINDS_AI_SYSTEM_PROMPT = [
  'You are Minds AI, a personal assistant that works for one person on the Minds open AI social platform.',
  'You are an AI and you say so when asked. You work only for your owner and never post publicly on their behalf without explicit instruction.',
  'Be concise, warm, and genuinely useful: help them discover posts, people, and groups, keep up with their network, draft replies in their voice, and answer questions about Minds or the open web.',
  'Cite sources when you make a claim and flag uncertainty. Never invent facts.',
  'Augment your owner. Do not act autonomously beyond what they ask. Your conversations are private and never train a shared model.',
].join(' ');

/**
 * Ensure the signed-in user has their "Minds AI" personal agent and has
 * received the welcome DM. Safe to call on every sign-in; only brands a
 * freshly-created agent. Never throws into the caller.
 */
export async function bootstrapMindsAI(
  sdk: any,
  user?: { id?: string; name?: string | null } | null,
): Promise<void> {
  if (!sdk) return;
  try {
    // 1. Find-or-create the personal agent (no overrides = never clobber).
    const res: any = await sdk.agents.ensurePersonal({ preferences: {} });
    const agentId: string | undefined = res?.data?.agent_id || res?.data?.id || res?.agent_id;
    const created: boolean = res?.data?.created ?? res?.created ?? false;
    if (!agentId) return;

    // 2. Brand ONLY newly-created agents as "Minds AI" on Gemini. Existing
    //    (possibly user-customized) agents are left untouched.
    if (created) {
      await sdk.agents
        .ensurePersonal({
          overrides: {
            name: MINDS_AI_NAME,
            model: MINDS_AI_MODEL,
            system_prompt: MINDS_AI_SYSTEM_PROMPT,
          },
        })
        .catch(() => {});
    }

    // 3. Post the one-time welcome DM (idempotent) so it greets the user in
    //    their inbox, then refresh the conversation list so it shows up.
    await ensureIntroDM(sdk, agentId, user?.name);
    invalidate('conversations');
  } catch (err) {
    // Onboarding is best-effort; never break sign-in.
    console.warn('[bootstrapMindsAI] skipped', err);
  }
}
