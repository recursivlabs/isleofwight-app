import { describe, expect, it, vi } from 'vitest';
import {
  persistConversationDeletion,
  persistChatReaction,
  reportConversationSpam,
  setOwnChatReactionPresence,
} from './chatActions';

describe('reportConversationSpam', () => {
  it('reports the other nested conversation participant', async () => {
    const reports = {
      clientReady: true,
      create: vi.fn(function (this: { clientReady: boolean }) {
        if (!this.clientReady) throw new Error('lost resource context');
        return Promise.resolve({ data: { id: 'report-1' } });
      }),
    };

    const reported = await reportConversationSpam({
      sdk: { reports },
      conversation: {
        id: 'conversation-1',
        participants: [
          { user: { id: 'viewer-1' } },
          { user: { id: 'user-2' } },
        ],
      },
      currentUserId: 'viewer-1',
    });

    expect(reported).toBe(true);
    expect(reports.create).toHaveBeenCalledWith({
      target_type: 'user',
      target_id: 'user-2',
      reason: 'spam',
      details: 'Reported from chat list (conversation conversation-1)',
    });
  });

  it('returns false when the report is rejected', async () => {
    const reported = await reportConversationSpam({
      sdk: { reports: { create: vi.fn().mockRejectedValue(new Error('offline')) } },
      conversation: { id: 'conversation-1', members: [{ id: 'user-2' }] },
      currentUserId: 'viewer-1',
    });

    expect(reported).toBe(false);
  });

  it('returns false when there is no reportable participant', async () => {
    const create = vi.fn();

    const reported = await reportConversationSpam({
      sdk: { reports: { create } },
      conversation: { id: 'conversation-1', participants: [{ id: 'viewer-1' }] },
      currentUserId: 'viewer-1',
    });

    expect(reported).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('chat reaction persistence', () => {
  it('changes only the current user reaction for the selected emoji', () => {
    const reactions = [
      { type: '👍', user_id: 'viewer-1', user_name: 'Viewer' },
      { type: '👍', user_id: 'user-2', user_name: 'Alice' },
      { type: '❤️', user_id: 'viewer-1', user_name: 'Viewer' },
    ];

    const removed = setOwnChatReactionPresence({
      reactions,
      emoji: '👍',
      userId: 'viewer-1',
      userName: 'Viewer',
      present: false,
    });
    expect(removed).toEqual([
      { type: '👍', user_id: 'user-2', user_name: 'Alice' },
      { type: '❤️', user_id: 'viewer-1', user_name: 'Viewer' },
    ]);

    const restored = setOwnChatReactionPresence({
      reactions: [...removed, { type: '😂', user_id: 'user-3' }],
      emoji: '👍',
      userId: 'viewer-1',
      userName: 'Viewer',
      present: true,
      reaction: reactions[0],
    });
    expect(restored).toContainEqual(reactions[0]);
    expect(restored).toContainEqual({ type: '😂', user_id: 'user-3' });
  });

  it('returns the rejected error so the caller can roll back and report it', async () => {
    const failure = new Error('offline');
    const chat = {
      clientReady: true,
      reactToMessage: vi.fn(function (this: { clientReady: boolean }) {
        if (!this.clientReady) throw new Error('lost resource context');
        return Promise.reject(failure);
      }),
    };

    const result = await persistChatReaction({ sdk: { chat }, messageId: 'message-1', emoji: '👍' });

    expect(result).toEqual({ ok: false, error: failure });
    expect(chat.reactToMessage).toHaveBeenCalledWith('message-1', { type: '👍' });
  });
});

describe('conversation deletion persistence', () => {
  it('calls through the bound SDK chat resource', async () => {
    const chat = {
      clientReady: true,
      deleteConversation: vi.fn(function (this: { clientReady: boolean }) {
        if (!this.clientReady) throw new Error('lost resource context');
        return Promise.resolve();
      }),
    };

    const result = await persistConversationDeletion({
      sdk: { chat },
      conversationId: 'conversation-1',
    });

    expect(result).toEqual({ ok: true });
    expect(chat.deleteConversation).toHaveBeenCalledWith('conversation-1');
  });

  it('returns the rejected error so the inbox can keep the row available', async () => {
    const failure = new Error('offline');

    const result = await persistConversationDeletion({
      sdk: { chat: { deleteConversation: vi.fn().mockRejectedValue(failure) } },
      conversationId: 'conversation-1',
    });

    expect(result).toEqual({ ok: false, error: failure });
  });
});
