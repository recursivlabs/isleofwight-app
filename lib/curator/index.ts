/**
 * Builds the Minds-specific request shape for the generic Recursiv
 * curator endpoint (sdk.curator.run). The platform handles the actual
 * fetch / LLM / write pipeline; this file owns Minds' config —
 * persona voices, interest → RSS map, paste-in normalisation.
 *
 * Anything app-specific (Minds branding, the 4 personas, the 24-tag
 * interest map) lives here, not in the Recursiv repo.
 */

import { MINDS_PERSONA_INSTRUCTIONS, type MindsPersona } from './prompts';
import { getSourcesForInterests, type MindsRssSource } from './sources';

export type { MindsPersona } from './prompts';
export { MINDS_PERSONA_INSTRUCTIONS, MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } from './prompts';
export { getSourcesForInterests } from './sources';
export type { MindsInterest, MindsRssSource } from './sources';

export interface BuildCuratorRequestInput {
  agentName?: string;
  ownerName?: string;
  interests: string[];
  vibes?: string[];
  persona?: MindsPersona;
  pasteSources?: {
    rss?: string[];
    substack?: string[];
    youtube?: string[];
  };
  targetSize?: number;
  fresh?: boolean;
}

export type CuratorRequestSource =
  | { type?: 'rss'; url: string; name?: string }
  | { type: 'web_search'; query: string; freshness?: 'pd' | 'pw' | 'pm' | 'py'; limit?: number; name?: string }
  | { type: 'minds_internal'; networkId: string; freshnessDays?: number; followIds?: string[]; limit?: number; name?: string };

export interface CuratorRequest {
  sources: CuratorRequestSource[];
  prompt: { system: string; user_template: string };
  model?: string;
  target_size?: number;
  fresh?: boolean;
}

/**
 * Assemble the request that minds-app sends to sdk.curator.run.
 */
export function buildCuratorRequest(input: BuildCuratorRequestInput): CuratorRequest {
  const persona: MindsPersona = input.persona ?? 'curious';
  const personaInstructions = MINDS_PERSONA_INSTRUCTIONS[persona];

  // System prompt: agent identity + voice rules + hard constraints.
  const system = [
    `You are ${input.agentName ?? 'an AI agent'}, a personal curator agent on Minds for ${input.ownerName ?? 'your owner'}.`,
    `Owner's interests: ${input.interests.join(', ') || 'general'}.`,
    `Format preferences: ${(input.vibes ?? []).join(', ') || 'a mix'}.`,
    personaInstructions,
    '',
    'Rules:',
    '- Maximum 20 words.',
    '- Do not repeat the title.',
    '- Do not pretend to be human; you are an AI agent.',
    '- Flag uncertainty if the content\'s quality or truth is in question.',
    '- Never hallucinate facts not present in the input content.',
    '',
    'Output: only the one-line take. No preamble, no formatting, no attribution.',
  ].join('\n');

  // Per-item user-prompt template. Server fills the placeholders.
  const user_template = [
    'Content to annotate:',
    'Title: {{title}}',
    'Source: {{source}}',
    'URL: {{url}}',
    'Summary: {{summary}}',
  ].join('\n');

  // Sources = interest defaults + paste-ins, normalised to RSS URLs.
  const interestSources = getSourcesForInterests(input.interests);
  const pasteRss: MindsRssSource[] = [];
  for (const url of input.pasteSources?.rss ?? []) {
    if (url.trim()) pasteRss.push({ name: 'Custom RSS', url: url.trim() });
  }
  for (const url of input.pasteSources?.substack ?? []) {
    if (url.trim()) {
      const base = url.trim().replace(/\/+$/, '');
      pasteRss.push({ name: 'Substack', url: `${base}/feed` });
    }
  }
  for (const url of input.pasteSources?.youtube ?? []) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/youtube\.com\/channel\/(UC[\w-]+)/);
    if (m) {
      pasteRss.push({
        name: 'YouTube channel',
        url: `https://www.youtube.com/feeds/videos.xml?channel_id=${m[1]}`,
      });
    }
    // @handle / /c/ forms need a server lookup to resolve; skip silently.
  }

  // Multi-source mix: RSS feeds for the user's interests + paste-ins
  // come first; on top of that we always layer one Brave web_search
  // pulled from the same interests. The `minds_internal` source is
  // intentionally NOT included — it requires a `networkId`, and until
  // Phase 2 lands the Minds-only network it would pull from the shared
  // Recursiv default network and surface unrelated platform/swarm
  // content. Add it back when minds-app has a real Minds network ID
  // to scope the pull to.
  const rssSources: CuratorRequestSource[] = [...interestSources, ...pasteRss].map((s) => ({
    type: 'rss',
    url: s.url,
    name: s.name,
  }));

  const interestQuery = input.interests.length > 0
    ? input.interests.slice(0, 5).join(' ')
    : 'long reads this week';

  const dynamicSources: CuratorRequestSource[] = [
    { type: 'web_search', query: interestQuery, freshness: 'pw', limit: 8, name: 'Web' },
  ];

  return {
    sources: [...rssSources, ...dynamicSources],
    prompt: { system, user_template },
    target_size: input.targetSize,
    fresh: input.fresh,
  };
}
