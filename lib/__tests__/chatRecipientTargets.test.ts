import { describe, expect, it } from 'vitest';
import {
  buildChatRecipientSuggestions,
  chatRecipientSearchTerm,
  rankChatRecipientSearchResults,
  type ChatRecipientTarget,
} from '../chatRecipientTargets';

const person = (id: string, username: string, name = username): ChatRecipientTarget => ({
  id,
  username,
  name,
  kind: 'person',
});

const agent = (id: string, username: string, name = username): ChatRecipientTarget => ({
  id,
  username,
  name,
  kind: 'agent',
});

describe('chat recipient results', () => {
  it('sends a pasted @handle to search without the address marker', () => {
    expect(chatRecipientSearchTerm('  @jack  ')).toBe('jack');
    expect(chatRecipientSearchTerm('@@Jack')).toBe('Jack');
    expect(chatRecipientSearchTerm('jack minds')).toBe('jack minds');
  });

  it('puts followed people first, keeps a bounded agent section, and de-duplicates identities', () => {
    const results = buildChatRecipientSuggestions({
      followingPeople: [person('jack', 'jack', 'Jack'), person('same', 'duplicate')],
      people: [person('new', 'new-person'), person('same', 'duplicate')],
      agents: [agent('agent-1', 'minds-ai'), agent('agent-2', 'helper'), agent('agent-3', 'third')],
      currentUserId: 'viewer',
      peopleLimit: 3,
      agentLimit: 2,
    });

    expect(results.map(({ id }) => id)).toEqual(['jack', 'same', 'new', 'agent-1', 'agent-2']);
    expect(results.map(({ kind }) => kind)).toEqual(['person', 'person', 'person', 'agent', 'agent']);
  });

  it('removes the signed-in viewer from both suggestion sources', () => {
    const results = buildChatRecipientSuggestions({
      followingPeople: [person('viewer', 'me')],
      people: [person('viewer', 'me'), person('friend', 'friend')],
      agents: [],
      currentUserId: 'viewer',
    });

    expect(results.map(({ id }) => id)).toEqual(['friend']);
  });

  it('ranks an exact handle above lookalikes while preserving legitimate test-like usernames', () => {
    const results = rankChatRecipientSearchResults({
      people: [
        person('similar', 'jack00', 'Jack'),
        person('exact', 'jack', 'Jack'),
        person('qa', 'qa-jack', 'Jack QA'),
      ],
      agents: [agent('agent', 'jack-helper', 'Jack Helper')],
      query: '@jack',
      currentUserId: 'viewer',
    });

    expect(results.map(({ id }) => id)).toEqual(['exact', 'similar', 'agent', 'qa']);
    expect(results.some(({ id }) => id === 'qa')).toBe(true);
  });

  it('prefers a person over an agent when both are equally relevant', () => {
    const results = rankChatRecipientSearchResults({
      people: [person('person', 'sage')],
      agents: [agent('agent', 'sage')],
      query: 'sage',
    });

    expect(results.map(({ id }) => id)).toEqual(['person', 'agent']);
  });
});
