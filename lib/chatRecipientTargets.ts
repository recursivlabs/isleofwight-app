export type ChatRecipientTarget = {
  id: string;
  name: string;
  username?: string | null;
  avatar?: string | null;
  kind: 'person' | 'agent';
};

export const chatRecipientSearchTerm = (value?: string | null) => (value || '').trim().replace(/^@+/, '');

const normalize = (value?: string | null) => chatRecipientSearchTerm(value).toLowerCase();

function uniqueTargets(targets: ChatRecipientTarget[], currentUserId?: string | null) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (!target.id || target.id === currentUserId || seen.has(target.id)) return false;
    seen.add(target.id);
    return true;
  });
}

/**
 * Empty-query suggestions favor people the viewer follows, then other people,
 * with a short agent section after them. This keeps agents discoverable without
 * letting a large project agent catalog crowd humans out of the first viewport.
 */
export function buildChatRecipientSuggestions({
  followingPeople,
  people,
  agents,
  currentUserId,
  peopleLimit = 10,
  agentLimit = 4,
}: {
  followingPeople: ChatRecipientTarget[];
  people: ChatRecipientTarget[];
  agents: ChatRecipientTarget[];
  currentUserId?: string | null;
  peopleLimit?: number;
  agentLimit?: number;
}) {
  const peopleFirst = uniqueTargets([...followingPeople, ...people], currentUserId)
    .filter((target) => target.kind === 'person')
    .slice(0, peopleLimit);
  const agentSection = uniqueTargets(agents, currentUserId)
    .filter((target) => target.kind === 'agent')
    .slice(0, agentLimit);
  return uniqueTargets([...peopleFirst, ...agentSection], currentUserId);
}

function searchScore(target: ChatRecipientTarget, query: string) {
  const q = normalize(query);
  const username = normalize(target.username);
  const name = normalize(target.name);
  if (username === q) return 0;
  if (name === q) return 1;
  if (username.startsWith(q)) return 2;
  if (name.startsWith(q)) return 3;
  return 4;
}

/** Keep the API's relevance order within each score band, but make an exact
 * handle/name beat lookalikes and prefer a person over an agent on a true tie. */
export function rankChatRecipientSearchResults({
  people,
  agents,
  query,
  currentUserId,
}: {
  people: ChatRecipientTarget[];
  agents: ChatRecipientTarget[];
  query: string;
  currentUserId?: string | null;
}) {
  return uniqueTargets([...people, ...agents], currentUserId)
    .map((target, index) => ({ target, index, score: searchScore(target, query) }))
    .sort((left, right) => (
      left.score - right.score
      || Number(left.target.kind === 'agent') - Number(right.target.kind === 'agent')
      || left.index - right.index
    ))
    .map(({ target }) => target);
}
