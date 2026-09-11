import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const authMock = vi.hoisted(() => ({
  user: { id: 'viewer-1', name: 'Viewer' } as any,
  isLoading: false,
  sdk: null as any,
}));

const captureException = vi.hoisted(() => vi.fn());

vi.mock('../../lib/auth', () => ({ useAuth: () => authMock }));
vi.mock('../../lib/monitoring', () => ({ captureException }));

import { ConversationView } from '../../app/(tabs)/chat';

// A realtime stub that "connects" to nothing: connectRealtime resolves null,
// the join/leave/listen surface exists, and no polling fallback is provoked.
// The captured onMessage listener lets a test deliver a socket message.
const realtimeStub = () => {
  const listeners: Array<(msg: any) => void> = [];
  return {
    connect: vi.fn(async () => null),
    getSocket: () => null,
    disconnect: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    onMessage: vi.fn((cb: (msg: any) => void) => {
      listeners.push(cb);
      return () => {};
    }),
    __deliver: (msg: any) => { for (const cb of listeners) cb(msg); },
  };
};

function makeSdk(messages: (...args: any[]) => Promise<any>) {
  return {
    chat: {
      conversation: vi.fn(async (id: string) => ({
        data: {
          id,
          members: [
            { id: 'viewer-1', name: 'Viewer' },
            { id: 'alice-1', name: 'Alice' },
          ],
        },
      })),
      messages: vi.fn(messages),
      markAsRead: vi.fn(async () => ({})),
    },
    realtime: realtimeStub(),
  };
}

const aliceMessage = {
  id: 'message-1',
  content: 'The history is still here',
  sender: { id: 'alice-1', name: 'Alice' },
  created_at: '2026-09-01T12:00:00.000Z',
};

beforeEach(() => {
  captureException.mockClear();
});

describe('Chat thread outage honesty', () => {
  it('reports an outage instead of presenting an existing thread as brand new, and retries in place', async () => {
    const sdk = makeSdk(async () => { throw new Error('chat history offline'); });
    authMock.sdk = sdk;

    render(<ConversationView conversationId="convo-outage-1" onBack={() => {}} />);

    expect(
      await screen.findByText("Couldn't load messages · Tap to retry"),
    ).toBeInTheDocument();
    // The failure must NOT render the new-thread invitation over a thread
    // whose history simply could not be fetched.
    expect(screen.queryByText('Start the conversation')).not.toBeInTheDocument();
    // The failure reaches monitoring instead of vanishing.
    expect(captureException).toHaveBeenCalled();

    sdk.chat.messages.mockImplementation(async () => ({ data: [aliceMessage] }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading messages' }));

    expect(await screen.findByText('The history is still here')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load messages · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('keeps the retry control when a live message lands over the missing history', async () => {
    // Codex review finding on #764: a socket-delivered (or freshly sent)
    // message makes the list non-empty, which removed the empty-state retry
    // while the history was still missing — recoverable only by reopening
    // the thread. The retry must not depend on the list being empty.
    const sdk = makeSdk(async () => { throw new Error('chat history offline'); });
    authMock.sdk = sdk;

    render(<ConversationView conversationId="convo-outage-live-1" onBack={() => {}} />);

    expect(
      await screen.findByText("Couldn't load messages · Tap to retry"),
    ).toBeInTheDocument();

    await act(async () => {
      sdk.realtime.__deliver({
        id: 'ws-1',
        conversationId: 'convo-outage-live-1',
        content: 'A message that arrived live',
        sender: { id: 'alice-1', name: 'Alice' },
        created_at: '2026-09-05T16:00:00.000Z',
      });
    });

    expect(await screen.findByText('A message that arrived live')).toBeInTheDocument();
    // The list is non-empty now — the outage affordance must survive that.
    expect(
      screen.getByRole('button', { name: 'Retry loading messages' }),
    ).toBeInTheDocument();

    sdk.chat.messages.mockImplementation(async () => ({
      data: [
        aliceMessage,
        {
          id: 'ws-1',
          content: 'A message that arrived live',
          sender: { id: 'alice-1', name: 'Alice' },
          created_at: '2026-09-05T16:00:00.000Z',
        },
      ],
    }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading messages' }));

    expect(await screen.findByText('The history is still here')).toBeInTheDocument();
    expect(screen.getByText('A message that arrived live')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load messages · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('still shows the real new-thread state when the server answers with zero messages', async () => {
    const sdk = makeSdk(async () => ({ data: [] }));
    authMock.sdk = sdk;

    render(<ConversationView conversationId="convo-empty-1" onBack={() => {}} />);

    expect(await screen.findByText('Start the conversation')).toBeInTheDocument();
    expect(
      screen.queryByText("Couldn't load messages · Tap to retry"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry loading messages' }),
    ).not.toBeInTheDocument();
  });
});
