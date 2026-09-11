import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  chatDmCommand,
  chatListCommand,
  chatMessagesCommand,
  chatSendCommand,
} from './chat';
import { log, printJson } from '../lib/output.js';

const sdk = vi.hoisted(() => ({
  conversations: vi.fn(),
  messages: vi.fn(),
  send: vi.fn(),
  dm: vi.fn(),
}));

vi.mock('../lib/client.js', () => ({
  createClient: () => ({ chat: sdk }),
}));

vi.mock('../lib/output.js', () => ({
  log: {
    info: vi.fn(),
    dim: vi.fn(),
    success: vi.fn(),
  },
  printJson: vi.fn(),
  exitWithError: (message: string) => {
    throw new Error(message);
  },
}));

describe('minds chat', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists conversations through the SDK', async () => {
    sdk.conversations.mockResolvedValue({
      data: [{
        id: 'conversation-1',
        type: 'dm',
        name: null,
        community_id: null,
        members: [{ id: 'user-1', name: 'Alice', username: 'alice', image: null, is_ai: false }],
        last_message: {
          id: 'message-1',
          content: 'Hello\nfrom Minds',
          sender_name: 'Alice',
          created_at: '2026-08-26T12:00:00.000Z',
        },
        request_status: 'accepted',
        created_at: '2026-08-26T11:00:00.000Z',
      }],
    });

    await chatListCommand({ limit: '10', offset: '2' });

    expect(sdk.conversations).toHaveBeenCalledWith({ limit: 10, offset: 2 });
    expect(log.info).toHaveBeenCalledWith('conversation-1  Alice');
    expect(log.dim).toHaveBeenCalledWith('  Alice: Hello from Minds');
  });

  it('prints messages oldest to newest for terminal reading', async () => {
    sdk.messages.mockResolvedValue({
      data: [
        {
          id: 'new',
          content: 'Second',
          sender: { id: 'user-2', name: 'Bob', username: 'bob', image: null },
          reply_to_id: null,
          media: [],
          reactions: [],
          created_at: '2026-08-26T12:01:00.000Z',
        },
        {
          id: 'old',
          content: 'First',
          sender: { id: 'user-1', name: 'Alice', username: 'alice', image: null },
          reply_to_id: null,
          media: [],
          reactions: [],
          created_at: '2026-08-26T12:00:00.000Z',
        },
      ],
    });

    await chatMessagesCommand('conversation-1', { limit: '25', cursor: 'next-page' });

    expect(sdk.messages).toHaveBeenCalledWith('conversation-1', { limit: 25, cursor: 'next-page' });
    expect(vi.mocked(log.info).mock.calls).toEqual([
      ['2026-08-26T12:00:00.000Z  Alice: First'],
      ['2026-08-26T12:01:00.000Z  Bob: Second'],
    ]);
  });

  it('sends a trimmed message through the SDK', async () => {
    sdk.send.mockResolvedValue({
      data: {
        id: 'message-1',
        conversation_id: 'conversation-1',
        sender_id: 'user-1',
        content: 'hello',
        reply_to_id: null,
        created_at: '2026-08-26T12:00:00.000Z',
      },
    });

    await chatSendCommand('conversation-1', { message: '  hello  ', replyToId: 'message-0' });

    expect(sdk.send).toHaveBeenCalledWith({
      conversation_id: 'conversation-1',
      content: 'hello',
      reply_to_id: 'message-0',
    });
    expect(log.success).toHaveBeenCalledWith('Sent message message-1 to conversation-1');
  });

  it('rejects an empty message before making an API request', async () => {
    await expect(chatSendCommand('conversation-1', { message: '   ' }))
      .rejects.toThrow('--message cannot be empty');
    expect(sdk.send).not.toHaveBeenCalled();
  });

  it('opens a DM and can send its first message', async () => {
    sdk.dm.mockResolvedValue({ data: { id: 'conversation-2', type: 'dm', created: true } });
    sdk.send.mockResolvedValue({
      data: {
        id: 'message-2',
        conversation_id: 'conversation-2',
        sender_id: 'user-1',
        content: 'Hi Bob',
        reply_to_id: null,
        created_at: '2026-08-26T12:00:00.000Z',
      },
    });

    await chatDmCommand('user-2', { message: 'Hi Bob', json: true });

    expect(sdk.dm).toHaveBeenCalledWith({ user_id: 'user-2' });
    expect(sdk.send).toHaveBeenCalledWith({ conversation_id: 'conversation-2', content: 'Hi Bob' });
    expect(printJson).toHaveBeenCalledWith({
      conversation: { id: 'conversation-2', type: 'dm', created: true },
      message: expect.objectContaining({ id: 'message-2' }),
    });
  });
});
