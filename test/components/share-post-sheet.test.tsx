import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: { sdk: null as null | Record<string, unknown>, user: null as null | { id: string } },
  clipboard: vi.fn(async () => {}),
  toast: vi.fn(),
  conversations: [] as any[],
  profileSearch: vi.fn(),
  resolvePersonalAgent: vi.fn(),
}));

vi.mock('../../lib/auth', () => ({ useAuth: () => mocks.auth }));
vi.mock('../../lib/hooks', () => ({ useConversations: () => ({ conversations: mocks.conversations }) }));
vi.mock('../../components/Toast', () => ({ useToast: () => ({ show: mocks.toast }) }));
vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.clipboard }));
vi.mock('../../lib/resolvePersonalAgent', () => ({
  resolvePersonalAgent: mocks.resolvePersonalAgent,
}));

import { SharePostSheet } from '../../components/SharePostSheet';
import { router } from '../component-stubs/expo-router';

describe('SharePostSheet', () => {
  beforeEach(() => {
    mocks.auth.sdk = null;
    mocks.auth.user = null;
    mocks.conversations = [];
    mocks.profileSearch.mockReset();
    mocks.resolvePersonalAgent.mockResolvedValue(null);
  });

  it('gives a signed-out visitor a useful public copy-link action', async () => {
    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Share post' })).toBeInTheDocument();
    expect(screen.getByText('Anyone with this link can open the post.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Search people…')).not.toBeInTheDocument();
    expect(screen.queryByText('Minds AI')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy post link' }));

    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledWith('http://localhost:3000/post/post-1'));
    expect(mocks.toast).toHaveBeenCalledWith('Link copied');
  });

  it('keeps internal recipients available to authenticated viewers', () => {
    mocks.auth.sdk = {};
    mocks.auth.user = { id: 'viewer-1' };

    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={vi.fn()} />);

    expect(screen.getByText('Send in Minds')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search people…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send post to Minds AI' })).toBeInTheDocument();
  });

  it('reports a recipient-search outage and recovers in place', async () => {
    mocks.profileSearch.mockRejectedValue(new Error('search offline'));
    mocks.auth.sdk = {
      profiles: { search: mocks.profileSearch },
      chat: { dm: vi.fn(), send: vi.fn() },
    };
    mocks.auth.user = { id: 'viewer-1' };

    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText('Search people…'), 'Alice');

    expect(await screen.findByText("Couldn't search people")).toBeInTheDocument();
    expect(screen.queryByText('No people found')).not.toBeInTheDocument();

    mocks.profileSearch.mockResolvedValue({
      data: [{ id: 'user-2', name: 'Alice', username: 'alice' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Retry people search' }));

    expect(await screen.findByRole('button', { name: 'Send post to Alice' })).toBeInTheDocument();
    expect(mocks.profileSearch).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Alice' }));
  });

  it('keeps the sheet open and reports a failed direct-message delivery', async () => {
    const onClose = vi.fn();
    const dm = vi.fn().mockResolvedValue({ data: { id: 'conversation-2' } });
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    mocks.auth.sdk = { chat: { dm, send } };
    mocks.auth.user = { id: 'viewer-1' };
    mocks.conversations = [{
      id: 'conversation-1',
      members: [{ id: 'viewer-1' }, { id: 'user-2', name: 'Alice' }],
    }];

    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send post to Alice' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      'Could not send post to Alice. Try again.',
      'error',
    ));
    expect(onClose).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('treats a missing conversation id as failure instead of a silent no-op', async () => {
    const onClose = vi.fn();
    const send = vi.fn();
    mocks.auth.sdk = {
      chat: { dm: vi.fn().mockResolvedValue({ data: {} }), send },
    };
    mocks.auth.user = { id: 'viewer-1' };
    mocks.conversations = [{
      id: 'conversation-1',
      members: [{ id: 'viewer-1' }, { id: 'user-2', name: 'Alice' }],
    }];

    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send post to Alice' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      'Could not send post to Alice. Try again.',
      'error',
    ));
    expect(send).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reports an unavailable Minds AI instead of silently clearing the spinner', async () => {
    const onClose = vi.fn();
    mocks.auth.sdk = { chat: { dm: vi.fn(), send: vi.fn() } };
    mocks.auth.user = { id: 'viewer-1' };
    mocks.resolvePersonalAgent.mockResolvedValue(null);

    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send post to Minds AI' }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      'Could not send post to Minds AI. Try again.',
      'error',
    ));
    expect(onClose).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('still closes and opens the conversation after a successful delivery', async () => {
    const onClose = vi.fn();
    const send = vi.fn().mockResolvedValue({ data: { id: 'message-1' } });
    mocks.auth.sdk = {
      chat: {
        dm: vi.fn().mockResolvedValue({ data: { id: 'conversation-2' } }),
        send,
      },
    };
    mocks.auth.user = { id: 'viewer-1' };
    mocks.conversations = [{
      id: 'conversation-1',
      members: [{ id: 'viewer-1' }, { id: 'user-2', name: 'Alice' }],
    }];

    render(<SharePostSheet visible post={{ id: 'post-1' }} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send post to Alice' }));

    await waitFor(() => expect(send).toHaveBeenCalledWith({
      conversation_id: 'conversation-2',
      content: 'http://localhost:3000/post/post-1',
    }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/chat/[id]',
      params: { id: 'conversation-2', focused: '1' },
    });
  });
});
