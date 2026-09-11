import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __setLocalSearchParams } from '../component-stubs/expo-router';

const mocks = vi.hoisted(() => ({
  signedIn: false,
  getPost: vi.fn(),
  getPublicPost: vi.fn(),
}));
vi.mock('../../lib/auth', () => {
  const sdk = { posts: { get: mocks.getPost } };
  const user = { id: 'viewer', name: 'Viewer', username: 'viewer' };
  return { useAuth: () => ({ sdk: mocks.signedIn ? sdk : null, user: mocks.signedIn ? user : null }) };
});
vi.mock('../../lib/recursiv', () => ({
  ORG_ID: 'test-org',
  publicMinds: { publicPosts: { get: mocks.getPublicPost } },
}));
vi.mock('../../lib/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/hooks')>(),
  useSimilarPosts: () => ({ posts: [], loading: false }),
  useConversations: () => ({ conversations: [], loading: false }),
}));
vi.mock('../../lib/monitoring', () => ({ captureException: vi.fn() }));

import PostDetailScreen from '../../app/post/[id]';
import { invalidatePrefix, setCache } from '../../lib/cache';

const cachedPost = {
  id: 'refresh-test-post',
  content: 'The cached post remains readable',
  author: { id: 'author', name: 'Author', username: 'author' },
  created_at: '2026-09-07T12:00:00Z',
};
const recoveredPost = {
  ...cachedPost,
  content: 'The refreshed post',
  replies: [{ id: 'reply-1', content: 'The fetched reply', reply_to_id: cachedPost.id }],
};

function pendingPost() {
  let resolve!: (value: { data: typeof recoveredPost }) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{ data: typeof recoveredPost }>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.signedIn = false;
  mocks.getPost.mockReset();
  mocks.getPublicPost.mockReset();
  invalidatePrefix('post:refresh-test-post');
  __setLocalSearchParams({ id: cachedPost.id });
});

describe('post-detail cached refresh recovery', () => {
  it.each([false, true])('recovers a failed detail refresh without dropping cached content (signed in: %s)', async (signedIn) => {
    mocks.signedIn = signedIn;
    const getPost = signedIn ? mocks.getPost : mocks.getPublicPost;
    const first = pendingPost();
    const retry = pendingPost();
    getPost.mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise);
    setCache(`post:${cachedPost.id}`, cachedPost);
    render(<PostDetailScreen />);

    expect(screen.getByText(cachedPost.content)).toBeInTheDocument();
    await act(async () => { first.reject(new Error('Internal provider failure')); });

    expect(await screen.findByText("Couldn't refresh this post")).toBeInTheDocument();
    expect(screen.getByText(cachedPost.content)).toBeInTheDocument();
    expect(screen.queryByText('Internal provider failure')).not.toBeInTheDocument();
    expect(screen.queryByText('No replies yet')).not.toBeInTheDocument();
    expect(screen.queryByText(/not migrated yet/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText(cachedPost.content)).toBeInTheDocument();
    await waitFor(() => expect(getPost).toHaveBeenCalledTimes(2));
    await act(async () => { retry.resolve({ data: recoveredPost }); });

    expect(await screen.findByText(recoveredPost.content)).toBeInTheDocument();
    expect(screen.getByText('The fetched reply')).toBeInTheDocument();
    expect(screen.queryByText("Couldn't refresh this post")).not.toBeInTheDocument();
    expect(signedIn ? mocks.getPublicPost : mocks.getPost).not.toHaveBeenCalled();
  });

  it('keeps previously loaded replies visible when refreshing them fails', async () => {
    setCache(`post:${cachedPost.id}`, recoveredPost);
    mocks.getPublicPost.mockRejectedValue(new Error('Temporary outage'));
    render(<PostDetailScreen />);

    expect(await screen.findByText("Couldn't refresh this post")).toBeInTheDocument();
    expect(screen.getByText(recoveredPost.content)).toBeInTheDocument();
    expect(screen.getByText('The fetched reply')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('still uses the full-page retry state when no cached post exists', async () => {
    mocks.getPublicPost.mockRejectedValue(new Error('Temporary outage'));
    render(<PostDetailScreen />);

    expect(await screen.findByText("Couldn't load post")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't refresh this post")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });
});
