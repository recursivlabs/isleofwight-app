import { describe, expect, it, vi } from 'vitest';
import {
  belongsInChatInbox,
  conversationParticipantId,
  conversationParticipantIsAgent,
  conversationRecipient,
  conversationRecipientRoute,
  hasNewPersistedUserTurn,
  hasPersistedUniqueUserContent,
  resolveUniqueUserContentPersistence,
  conversationRequestStatus,
  normalizeConversationRecipient,
  runPreparedChatDelivery,
  uniqueContentRetryDecision,
} from '../chatRequests';

describe('chat message requests', () => {
  it('keeps older API responses in the primary inbox', () => {
    expect(conversationRequestStatus({ id: 'legacy' })).toBe('accepted');
    expect(belongsInChatInbox({ id: 'legacy' }, 'primary')).toBe(true);
  });

  it('separates pending requests from primary conversations', () => {
    const request = { id: 'request', request_status: 'pending' };
    expect(belongsInChatInbox(request, 'primary')).toBe(false);
    expect(belongsInChatInbox(request, 'requests')).toBe(true);
  });

  it('does not surface declined conversations in either inbox', () => {
    const declined = { id: 'declined', requestStatus: 'declined' };
    expect(belongsInChatInbox(declined, 'primary')).toBe(false);
    expect(belongsInChatInbox(declined, 'requests')).toBe(false);
  });
});

describe('chat recipient normalization', () => {
  it('prefers the nested user id in participant-wrapper responses', () => {
    expect(conversationParticipantId({ id: 'membership-1', user: { id: 'user-2' } }))
      .toBe('user-2');
  });

  it('requires an explicit actor kind instead of treating missing metadata as human', () => {
    expect(conversationParticipantIsAgent({ id: 'agent-1' })).toBeNull();
    expect(normalizeConversationRecipient({ id: 'agent-1', name: 'Cold actor' })).toBeNull();
  });

  it('resolves a cold one-to-one agent to the agent route', () => {
    const recipient = conversationRecipient({
      type: 'one_on_one',
      members: [
        { id: 'me', is_ai: false, name: 'Me' },
        { id: 'agent-1', is_ai: true, name: 'Minds AI' },
      ],
    }, 'me');

    expect(recipient).toMatchObject({ id: 'agent-1', name: 'Minds AI', isAgent: true });
    if (!recipient) throw new Error('expected an agent recipient');
    expect(conversationRecipientRoute(recipient)).toBe('agent');
  });

  it('resolves a cold one-to-one human to the human route', () => {
    const recipient = conversationRecipient({
      type: 'one_on_one',
      participants: [
        { user: { id: 'me', isAi: false, name: 'Me' } },
        { user: { id: 'human-1', isAi: false, name: 'Ada' } },
      ],
    }, 'me');

    expect(recipient).toMatchObject({ id: 'human-1', name: 'Ada', isAgent: false });
    if (!recipient) throw new Error('expected a human recipient');
    expect(conversationRecipientRoute(recipient)).toBe('human');
  });

  it('falls back to populated members when participants is present but empty', () => {
    const recipient = conversationRecipient({
      type: 'one_on_one',
      participants: [],
      members: [
        { id: 'me', is_ai: false },
        { id: 'human-1', is_ai: false, name: 'Grace' },
      ],
    }, 'me');

    expect(recipient).toMatchObject({ id: 'human-1', name: 'Grace', isAgent: false });
  });

  it('falls back to members when a partial participant list cannot resolve a counterparty', () => {
    const recipient = conversationRecipient({
      type: 'one_on_one',
      participants: [{ user: { id: 'me', isAi: false } }],
      members: [
        { id: 'me', is_ai: false },
        { id: 'agent-1', is_ai: true, name: 'Samson' },
      ],
    }, 'me');

    expect(recipient).toMatchObject({ id: 'agent-1', name: 'Samson', isAgent: true });
  });

  it('keeps a group containing an agent on normal chat delivery', () => {
    const recipient = conversationRecipient({
      type: 'group',
      name: 'Launch room',
      members: [
        { id: 'me', is_ai: false },
        { id: 'agent-1', is_ai: true },
        { id: 'human-1', is_ai: false },
      ],
    }, 'me');

    expect(recipient).toMatchObject({ name: 'Launch room', isAgent: false });
    if (!recipient) throw new Error('expected a group recipient');
    expect(conversationRecipientRoute(recipient)).toBe('human');
  });

  it('fails closed for an unresolved or malformed one-to-one conversation', () => {
    expect(conversationRecipient({
      type: 'one_on_one',
      members: [{ id: 'me', is_ai: false }, { id: 'unknown' }],
    }, 'me')).toBeNull();
    expect(conversationRecipient({
      type: 'one_on_one',
      members: [{ id: 'me', is_ai: false }],
    }, 'me')).toBeNull();
    expect(conversationRecipient({
      type: 'one_on_one',
      members: [
        { id: 'me', is_ai: false },
        { id: 'human-1', is_ai: false },
        { id: 'human-2', is_ai: false },
      ],
    }, 'me')).toBeNull();
    expect(conversationRecipient({
      type: 'mystery',
      members: [{ id: 'me', is_ai: false }, { id: 'human-1', is_ai: false }],
    }, 'me')).toBeNull();
  });
});

describe('prepared chat delivery', () => {
  const agent = {
    conversationId: 'agent-conversation',
    recipient: { id: 'agent-1', name: 'Agent', isAgent: true, raw: {} },
  };
  const human = {
    conversationId: 'human-conversation',
    recipient: { id: 'human-1', name: 'Human', isAgent: false, raw: {} },
  };

  it('runs one agent transport and zero human writes after readiness', async () => {
    const events: string[] = [];
    const sendAgent = vi.fn(async () => { events.push('agent'); return true; });
    const sendHuman = vi.fn(async () => { events.push('human'); return true; });

    const result = await runPreparedChatDelivery({
      prepare: async () => { events.push('prepare'); return agent; },
      validate: () => { events.push('validate'); return true; },
      onReady: () => { events.push('ready'); return { optimistic: true }; },
      sendAgent,
      sendHuman,
    });

    expect(result).toBe('agent');
    expect(events).toEqual(['prepare', 'validate', 'ready', 'agent']);
    expect(sendAgent).toHaveBeenCalledOnce();
    expect(sendHuman).not.toHaveBeenCalled();
  });

  it('runs one human transport and zero agent writes after readiness', async () => {
    const sendAgent = vi.fn(async () => true);
    const sendHuman = vi.fn(async () => true);

    const result = await runPreparedChatDelivery({
      prepare: async () => human,
      validate: () => true,
      onReady: () => ({ optimistic: true }),
      sendAgent,
      sendHuman,
    });

    expect(result).toBe('human');
    expect(sendHuman).toHaveBeenCalledOnce();
    expect(sendAgent).not.toHaveBeenCalled();
  });

  it('does not report success when the selected transport cannot prove acceptance', async () => {
    const result = await runPreparedChatDelivery({
      prepare: async () => agent,
      validate: () => true,
      onReady: () => ({ optimistic: true }),
      sendAgent: async () => false,
      sendHuman: async () => true,
    });

    expect(result).toBe('unconfirmed');
  });

  const blockedCases: Array<[
    expected: 'unresolved' | 'stale',
    prepare: () => Promise<typeof human | null>,
    validate: () => boolean,
  ]> = [
    ['unresolved', async () => null, () => true],
    ['stale', async () => human, () => false],
  ];

  it.each(blockedCases)('performs zero writes and retains draft when preparation is %s', async (
    expected,
    prepare,
    validate,
  ) => {
    let draft = 'keep this message';
    let reply = 'reply-1';
    const onReady = vi.fn(() => {
      draft = '';
      reply = '';
      return {};
    });
    const sendAgent = vi.fn(async () => true);
    const sendHuman = vi.fn(async () => true);

    const result = await runPreparedChatDelivery({
      prepare,
      validate,
      onReady,
      sendAgent,
      sendHuman,
    });

    expect(result).toBe(expected);
    expect(draft).toBe('keep this message');
    expect(reply).toBe('reply-1');
    expect(onReady).not.toHaveBeenCalled();
    expect(sendAgent).not.toHaveBeenCalled();
    expect(sendHuman).not.toHaveBeenCalled();
  });
});

describe('agent turn persistence proof', () => {
  const baseline = new Set(['existing-user-turn', 'existing-agent-reply']);

  it('accepts only a new exact user-authored row', () => {
    expect(hasNewPersistedUserTurn({
      messages: [
        { id: 'existing-agent-reply', sender: { id: 'agent-1' }, content: 'Earlier reply' },
        { id: 'new-user-turn', sender: { id: 'user-1' }, content: 'yes' },
      ],
      baselineMessageIds: baseline,
      userId: 'user-1',
      content: 'yes',
    })).toBe(true);
  });

  it('rejects an unrelated new reply and an existing same-text user row', () => {
    expect(hasNewPersistedUserTurn({
      messages: [
        { id: 'new-agent-reply', sender: { id: 'agent-1' }, content: 'yes' },
        { id: 'existing-user-turn', sender: { id: 'user-1' }, content: 'yes' },
      ],
      baselineMessageIds: baseline,
      userId: 'user-1',
      content: 'yes',
    })).toBe(false);
  });

  it('fails closed when the pre-request baseline was unavailable', () => {
    expect(hasNewPersistedUserTurn({
      messages: [{ id: 'new-user-turn', sender: { id: 'user-1' }, content: 'yes' }],
      baselineMessageIds: null,
      userId: 'user-1',
      content: 'yes',
    })).toBe(false);
  });
});

describe('unique voice URL persistence proof', () => {
  it('never authorizes a duplicate after an ambiguous transport attempt', () => {
    expect(uniqueContentRetryDecision(false, 'unknown')).toBe('send');
    expect(uniqueContentRetryDecision(true, 'found')).toBe('confirmed');
    expect(uniqueContentRetryDecision(true, 'absent')).toBe('hold');
    expect(uniqueContentRetryDecision(true, 'unknown')).toBe('hold');
  });

  it('accepts only an own message containing the exact unique URL', () => {
    const url = 'https://media.example/unique-voice.webm';
    expect(hasPersistedUniqueUserContent({
      messages: [{ id: 'voice-row', sender: { id: 'user-1' }, content: url }],
      userId: 'user-1',
      uniqueContent: url,
    })).toBe(true);
    expect(hasPersistedUniqueUserContent({
      messages: [{ id: 'other-row', sender: { id: 'user-2' }, content: url }],
      userId: 'user-1',
      uniqueContent: url,
    })).toBe(false);
  });

  it('finds the exact own URL in the largest single page', async () => {
    const fetchPage = vi.fn(async ({ limit, offset }: { limit: number; offset: number }) => ({
      data: [{ id: 'voice-row', sender: { id: 'user-1' }, content: 'voice://unique' }],
      meta: { has_more: true },
      requested: { limit, offset },
    }));

    await expect(resolveUniqueUserContentPersistence({
      fetchPage,
      userId: 'user-1',
      uniqueContent: 'voice://unique',
    })).resolves.toBe('found');
    expect(fetchPage).toHaveBeenCalledWith({ limit: 100, offset: 0 });
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it('reports absence only when the max-size page is complete', async () => {
    const fetchPage = vi.fn(async () => ({
      data: [{ id: 'stable-head', sender: { id: 'user-2' }, content: 'other' }],
      meta: { has_more: false },
    }));

    await expect(resolveUniqueUserContentPersistence({
      fetchPage,
      userId: 'user-1',
      uniqueContent: 'voice://missing',
    })).resolves.toBe('absent');
    expect(fetchPage).toHaveBeenCalledOnce();
  });

  it('fails closed on fetch errors, malformed pagination, or a truncated page', async () => {
    await expect(resolveUniqueUserContentPersistence({
      fetchPage: async () => { throw new Error('offline'); },
      userId: 'user-1',
      uniqueContent: 'voice://unique',
    })).resolves.toBe('unknown');

    await expect(resolveUniqueUserContentPersistence({
      fetchPage: async () => ({ data: [] }),
      userId: 'user-1',
      uniqueContent: 'voice://unique',
    })).resolves.toBe('unknown');

    const truncatedFetch = vi.fn(async () => ({
        data: [{ id: 'still-more', sender: { id: 'user-2' }, content: 'other' }],
        meta: { has_more: true },
      }));
    await expect(resolveUniqueUserContentPersistence({
      fetchPage: truncatedFetch,
      userId: 'user-1',
      uniqueContent: 'voice://unique',
    })).resolves.toBe('unknown');
    expect(truncatedFetch).toHaveBeenCalledOnce();
  });
});
