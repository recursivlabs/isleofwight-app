import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const authMock = vi.hoisted(() => ({
  value: {
    sdk: null as null | {
      posts: {
        react: ReturnType<typeof vi.fn>;
        unreact: ReturnType<typeof vi.fn>;
        create?: ReturnType<typeof vi.fn>;
      };
    },
    user: null as null | { id: string; name: string; username: string },
  },
}));

vi.mock('../../lib/auth', () => ({ useAuth: () => authMock.value }));

const hooksMock = vi.hoisted(() => ({
  post: null as any,
  setPost: vi.fn(),
  refresh: vi.fn(),
  loading: false,
  error: null as string | null,
  viewerStateResolved: true,
  conversations: [] as unknown[],
}));

vi.mock('../../lib/hooks', () => ({
  usePost: () => ({
    post: hooksMock.post,
    setPost: hooksMock.setPost,
    refresh: hooksMock.refresh,
    loading: hooksMock.loading,
    error: hooksMock.error,
    viewerStateResolved: hooksMock.viewerStateResolved,
  }),
  useSimilarPosts: () => ({ posts: [], loading: false }),
  useConversations: () => ({ conversations: hooksMock.conversations, loading: false }),
}));

import PostDetailScreen from '../../app/post/[id]';

const acceptedReply = { data: { id: 'reply-1', content: 'A reply', reply_to_id: 'post-1' } };

function pendingReply() {
  let resolve!: (value: typeof acceptedReply) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<typeof acceptedReply>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function renderReplyComposer(create: ReturnType<typeof vi.fn>) {
  authMock.value.sdk = { posts: { react: vi.fn(), unreact: vi.fn(), create } };
  authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
  __setLocalSearchParams({ id: 'post-1' });
  render(<PostDetailScreen />);
  return screen.getByPlaceholderText('Write a reply...');
}

describe('public post detail interactions', () => {
  beforeEach(() => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    hooksMock.post = {
      id: 'post-1',
      content: 'A public post',
      created_at: '2026-08-24T12:00:00.000Z',
      repliesCount: undefined,
      replies: [],
      score: 10,
      userReaction: null,
      author: { id: 'author-1', name: 'Public Author', username: 'public-author' },
    };
    hooksMock.loading = false;
    hooksMock.error = null;
    hooksMock.viewerStateResolved = true;
    hooksMock.setPost.mockReset();
    hooksMock.refresh.mockReset();
  });

  it('replaces raw request errors with an understandable retry action', async () => {
    hooksMock.post = null;
    hooksMock.error = 'Internal server error';
    __setLocalSearchParams({ id: 'post-1' });

    render(<PostDetailScreen />);

    expect(screen.getByText("Couldn't load post")).toBeInTheDocument();
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(hooksMock.refresh).toHaveBeenCalledOnce();
  });

  it('shows the canonical total when the detail response pages reply bodies', async () => {
    hooksMock.post.repliesCount = 399;
    hooksMock.post.replies = [{ id: 'reply-1', content: 'Loaded reply', reply_to_id: 'post-1' }];
    __setLocalSearchParams({ id: 'post-1' });
    render(<PostDetailScreen />);

    expect(await screen.findByText('399 replies')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply to post, 399 replies' })).toBeInTheDocument();
  });

  it('shows an explicit sign-in action instead of a dead reply composer', async () => {
    __setLocalSearchParams({ id: 'post-1' });
    render(<PostDetailScreen />);

    expect(screen.queryByPlaceholderText('Write a reply...')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reply to post, 0 replies' }));

    expect(router.push).toHaveBeenCalledWith(
      '/auth/sign-in?auth=otp&returnTo=%2Fpost%2Fpost-1%3Freply%3D1',
    );
  });

  it('focuses the reply composer when an authenticated viewer taps Reply', async () => {
    authMock.value.sdk = { posts: { react: vi.fn(), unreact: vi.fn() } };
    authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
    __setLocalSearchParams({ id: 'post-1' });
    render(<PostDetailScreen />);

    const composer = screen.getByPlaceholderText('Write a reply...');
    expect(composer).not.toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Reply to post, 0 replies' }));

    expect(composer).toHaveFocus();
  });

  it('keeps the exact draft visible while sending and clears it only after acceptance', async () => {
    const pending = pendingReply();
    const create = vi.fn().mockReturnValue(pending.promise);
    const composer = renderReplyComposer(create);
    const draft = '  Keep this draft\n ';
    fireEvent.change(composer, { target: { value: draft } });
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });

    try {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ content: draft.trim(), reply_to_id: 'post-1' }));
      expect(composer).toHaveValue(draft);
      const send = screen.getByRole('button', { name: 'Send reply' });
      expect(send).toBeDisabled();
      expect(send).toHaveAttribute('aria-busy', 'true');
    } finally {
      await act(async () => { pending.resolve(acceptedReply); });
    }
    expect(composer).toHaveValue('');
  });

  it.each(['success', 'failure'] as const)('preserves edits made while a reply is pending after %s', async (outcome) => {
    const pending = pendingReply();
    const create = vi.fn().mockReturnValue(pending.promise);
    const composer = renderReplyComposer(create);
    fireEvent.change(composer, { target: { value: 'Original reply' } });
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
    const nextDraft = '  New words typed while waiting\n ';
    fireEvent.change(composer, { target: { value: nextDraft } });

    await act(async () => {
      if (outcome === 'success') pending.resolve(acceptedReply);
      else pending.reject(new Error('Temporary reply failure'));
    });

    expect(composer).toHaveValue(nextDraft);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed draft byte-for-byte and permits retry with Send reply', async () => {
    const pending = pendingReply();
    const create = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(acceptedReply);
    const composer = renderReplyComposer(create);
    const draft = '  Preserve whitespace around my reply\n ';
    fireEvent.change(composer, { target: { value: draft } });
    fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
    await act(async () => { pending.reject(new Error('Temporary reply failure')); });

    expect(composer).toHaveValue(draft);
    const send = screen.getByRole('button', { name: 'Send reply' });
    expect(send).toBeEnabled();
    expect(send).toHaveAttribute('aria-busy', 'false');
    await userEvent.click(send);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ content: draft.trim(), reply_to_id: 'post-1' }));
    expect(composer).toHaveValue('');
  });

  it('sends once when Enter repeats within one render batch and while pending', async () => {
    const pending = pendingReply();
    const create = vi.fn().mockReturnValue(pending.promise);
    const composer = renderReplyComposer(create);
    fireEvent.change(composer, { target: { value: 'Only one reply' } });

    try {
      act(() => {
        fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
        fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
      });
      fireEvent.keyDown(composer, { key: 'Enter', code: 'Enter' });
      expect(create).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => { pending.resolve(acceptedReply); });
    }
  });

  it('focuses the reply composer when the viewer returns from OTP', async () => {
    __setLocalSearchParams({ id: 'post-1', reply: '1' });
    const view = render(<PostDetailScreen />);
    expect(screen.queryByPlaceholderText('Write a reply...')).not.toBeInTheDocument();

    authMock.value.sdk = { posts: { react: vi.fn(), unreact: vi.fn() } };
    authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
    view.rerender(<PostDetailScreen />);

    const composer = await screen.findByPlaceholderText('Write a reply...');
    await waitFor(() => expect(composer).toHaveFocus());
    expect(router.replace).toHaveBeenCalledWith('/post/post-1');
  });

  it('reopens the Repost chooser only after authenticated viewer state resolves', async () => {
    authMock.value.sdk = { posts: { react: vi.fn(), unreact: vi.fn() } };
    authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
    hooksMock.viewerStateResolved = false;
    __setLocalSearchParams({ id: 'post-1', repost: '1' });

    const view = render(<PostDetailScreen />);
    expect(screen.queryByText('Remind')).not.toBeInTheDocument();

    hooksMock.viewerStateResolved = true;
    view.rerender(<PostDetailScreen />);

    expect(await screen.findByText('Remind')).toBeInTheDocument();
    expect(screen.getByText('Quote Post')).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith('/post/post-1');
  });

  it('resumes a signed-out Upvote only after authenticated viewer state resolves', async () => {
    const react = vi.fn(async () => ({}));
    const unreact = vi.fn(async () => ({}));
    authMock.value.sdk = { posts: { react, unreact } };
    authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
    hooksMock.viewerStateResolved = false;
    __setLocalSearchParams({ id: 'post-1', reaction: 'upvote' });

    const view = render(<PostDetailScreen />);
    expect(react).not.toHaveBeenCalled();

    hooksMock.viewerStateResolved = true;
    view.rerender(<PostDetailScreen />);

    await waitFor(() => expect(react).toHaveBeenCalledWith('post-1', 'upvote'));
    expect(unreact).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/post/post-1');
  });

  it('treats a resumed Upvote as desired state and never toggles it off', async () => {
    const react = vi.fn(async () => ({}));
    const unreact = vi.fn(async () => ({}));
    authMock.value.sdk = { posts: { react, unreact } };
    authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
    (hooksMock.post as any).userReaction = 'upvote';
    __setLocalSearchParams({ id: 'post-1', reaction: 'upvote' });

    render(<PostDetailScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/post/post-1'));
    expect(react).not.toHaveBeenCalled();
    expect(unreact).not.toHaveBeenCalled();
  });

  it('replaces an opposite reaction when resuming the requested desired state', async () => {
    const react = vi.fn(async () => ({}));
    const unreact = vi.fn(async () => ({}));
    authMock.value.sdk = { posts: { react, unreact } };
    authMock.value.user = { id: 'viewer-1', name: 'Viewer', username: 'viewer' };
    (hooksMock.post as any).userReaction = 'downvote';
    __setLocalSearchParams({ id: 'post-1', reaction: 'upvote' });

    render(<PostDetailScreen />);

    await waitFor(() => expect(react).toHaveBeenCalledWith('post-1', 'upvote'));
    expect(unreact).toHaveBeenCalledWith('post-1');
    expect(unreact.mock.invocationCallOrder[0]).toBeLessThan(react.mock.invocationCallOrder[0]);
  });
});
