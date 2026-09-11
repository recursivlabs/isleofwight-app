import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const authMock = vi.hoisted(() => ({
  user: null as null | { id: string },
  isLoading: false,
  sdk: null as any,
}));

const useConversations = vi.hoisted(() => vi.fn((): any => ({
  conversations: [],
  loading: false,
  refresh: vi.fn(),
})));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock,
}));

vi.mock('../../lib/hooks', () => ({ useConversations }));

import ChatScreen from '../../app/(tabs)/chat';
import ChatThreadScreen from '../../app/chat/[id]';

describe('Chat authentication gate', () => {
  beforeEach(() => {
    authMock.user = null;
    authMock.sdk = null;
    useConversations.mockReturnValue({
      conversations: [],
      loading: false,
      refresh: vi.fn(),
    });
  });

  it('sends a signed-out inbox visitor through OTP without mounting chat data', () => {
    __setLocalSearchParams({});
    render(<ChatScreen />);

    expect(screen.getByTestId('router-redirect')).toHaveAttribute(
      'data-href',
      '/auth/sign-in?auth=otp&returnTo=%2Fchat',
    );
    expect(screen.queryByText('Messages')).not.toBeInTheDocument();
    expect(useConversations).not.toHaveBeenCalled();
  });

  it('preserves the requested thread across OTP', () => {
    __setLocalSearchParams({ id: 'conversation-123' });
    render(<ChatThreadScreen />);

    expect(screen.getByTestId('router-redirect')).toHaveAttribute(
      'data-href',
      '/auth/sign-in?auth=otp&returnTo=%2Fchat%2Fconversation-123',
    );
  });

  it('creates and opens a profile DM carried through OTP', async () => {
    const dm = vi.fn().mockResolvedValue({ data: { id: 'conversation-456' } });
    authMock.user = { id: 'viewer-1' };
    authMock.sdk = {
      chat: {
        dm,
        conversation: vi.fn().mockResolvedValue({ data: { id: 'conversation-456', participants: [] } }),
        messages: vi.fn().mockResolvedValue({ data: [] }),
      },
    };
    __setLocalSearchParams({ userId: 'profile-123', focused: '1' });

    render(<ChatScreen />);

    await waitFor(() => expect(dm).toHaveBeenCalledWith({
      user_id: 'profile-123',
      organization_id: expect.any(String),
    }));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'conversation-456', focused: '1' },
    });
  });

  it('exposes inbox conversations as named controls with unread and preview context', async () => {
    authMock.user = { id: 'viewer-1' };
    authMock.sdk = {};
    useConversations.mockReturnValue({
      conversations: [{
        id: 'conversation-1',
        members: [
          { id: 'viewer-1', name: 'Viewer' },
          { id: 'alice-1', name: 'Alice' },
        ],
        unread_count: 2,
        last_message: {
          id: 'message-1',
          content: 'See you at noon',
          created_at: '2026-09-04T12:00:00.000Z',
        },
      }],
      loading: false,
      refresh: vi.fn(),
    });

    render(<ChatScreen />);

    expect(await screen.findByRole('button', {
      name: /Open conversation with Alice\. 2 unread messages\. Last message: See you at noon\./,
    })).toBeInTheDocument();
  });
});
