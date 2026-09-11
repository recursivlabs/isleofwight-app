import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const publicSdk = vi.hoisted(() => ({
  getByUsername: vi.fn(),
  get: vi.fn(),
  getPost: vi.fn(),
  listPosts: vi.fn(),
}));

vi.mock('./auth', () => ({
  useAuth: () => ({ sdk: null, user: null }),
}));

vi.mock('./recursiv', () => ({
  ORG_ID: 'org-test',
  publicMinds: {
    publicProfiles: {
      getByUsername: publicSdk.getByUsername,
      get: publicSdk.get,
    },
    publicPosts: {
      get: publicSdk.getPost,
      list: publicSdk.listPosts,
    },
  },
}));

import { invalidatePrefix } from './cache';
import { usePost, useProfile, useProfilePosts } from './hooks';

describe('signed-out public profile loading', () => {
  beforeEach(() => {
    invalidatePrefix('profile:anonymous-profile-test');
    publicSdk.getByUsername.mockReset();
    publicSdk.get.mockReset();
    publicSdk.getPost.mockReset();
    publicSdk.listPosts.mockReset();
    publicSdk.getByUsername.mockResolvedValue({
      data: {
        id: 'user-1',
        username: 'anonymous-profile-test',
        name: 'Public Profile',
      },
    });
  });

  it('retries a failed public post in place', async () => {
    invalidatePrefix('post:retry-public-post');
    publicSdk.getPost
      .mockRejectedValueOnce(new Error('Internal server error'))
      .mockResolvedValueOnce({ data: { id: 'retry-public-post', content: 'Recovered post' } });

    const { result } = renderHook(() => usePost('retry-public-post'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Internal server error');
    expect(result.current.post).toBeNull();

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.post?.id).toBe('retry-public-post'));

    expect(result.current.error).toBeNull();
    expect(publicSdk.getPost).toHaveBeenCalledTimes(2);
  });

  it('settles the profile hook from the keyless SDK instead of leaving a permanent skeleton', async () => {
    const { result } = renderHook(() => useProfile('anonymous-profile-test'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.profile).toMatchObject({
      id: 'user-1',
      username: 'anonymous-profile-test',
      name: 'Public Profile',
    });
    expect(publicSdk.getByUsername).toHaveBeenCalledWith('anonymous-profile-test');
    expect(publicSdk.get).not.toHaveBeenCalled();
  });

  it('loads and splits one anonymous author page into posts and articles', async () => {
    invalidatePrefix('profile-posts:public-author-test');
    publicSdk.listPosts.mockResolvedValue({
      data: [
        { id: 'post-1', content: 'Short post', contentFormat: 'plain' },
        { id: 'article-1', title: 'Long read', content: '# Story', contentFormat: 'markdown' },
      ],
      meta: { has_more: false },
    });

    const { result } = renderHook(() => ({
      posts: useProfilePosts('public-author-test', { limit: 30 }),
      articles: useProfilePosts('public-author-test', { articles: true, limit: 30 }),
    }));

    await waitFor(() => {
      expect(result.current.posts.loading).toBe(false);
      expect(result.current.articles.loading).toBe(false);
    });

    expect(result.current.posts.posts.map((post) => post.id)).toEqual(['post-1']);
    expect(result.current.articles.posts.map((post) => post.id)).toEqual(['article-1']);
    expect(publicSdk.listPosts).toHaveBeenCalledWith({
      authorId: 'public-author-test',
      limit: 30,
      offset: 0,
    });
  });

  it('defaults signed-out profiles to a smaller first page', async () => {
    invalidatePrefix('profile-posts:quick-public-author');
    publicSdk.listPosts
      .mockResolvedValueOnce({
        data: Array.from({ length: 12 }, (_, index) => ({
          id: `post-${index + 1}`,
          content: 'First screenful',
        })),
        meta: { has_more: true },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'post-13', content: 'Next page' }],
        meta: { has_more: false },
      });

    const { result } = renderHook(() => useProfilePosts('quick-public-author'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.posts).toHaveLength(12);
    expect(result.current.hasMore).toBe(true);
    expect(publicSdk.listPosts).toHaveBeenCalledWith({
      authorId: 'quick-public-author',
      limit: 12,
      offset: 0,
    });

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.posts).toHaveLength(13));

    expect(publicSdk.listPosts).toHaveBeenLastCalledWith({
      authorId: 'quick-public-author',
      limit: 12,
      offset: 12,
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('retries one failed anonymous page instead of turning a cold profile into an empty one', async () => {
    invalidatePrefix('profile-posts:cold-public-author');
    publicSdk.listPosts
      .mockRejectedValueOnce(new Error('Public request timed out'))
      .mockResolvedValueOnce({
        data: [{ id: 'post-after-warmup', content: 'Loaded on the bounded retry' }],
        meta: { has_more: false },
      });

    const { result } = renderHook(() => useProfilePosts('cold-public-author', { limit: 30 }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.posts.map((post) => post.id)).toEqual(['post-after-warmup']);
    expect(publicSdk.listPosts).toHaveBeenCalledTimes(2);
  });

  it('reports a final anonymous failure and recovers through refresh', async () => {
    invalidatePrefix('profile-posts:retry-public-author');
    publicSdk.listPosts.mockRejectedValue(new Error('Public request timed out'));

    const { result } = renderHook(() => useProfilePosts('retry-public-author', { limit: 30 }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.posts).toEqual([]);
    expect(result.current.error).toBe('Public request timed out');
    expect(result.current.hasMore).toBe(false);

    let resolveRetry: (value: unknown) => void = () => {};
    publicSdk.listPosts.mockImplementation(() => new Promise((resolve) => {
      resolveRetry = resolve;
    }));
    act(() => {
      void result.current.refresh();
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveRetry({
        data: [{ id: 'post-after-manual-retry', content: 'Recovered' }],
        meta: { has_more: false },
      });
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.posts.map((post) => post.id)).toEqual(['post-after-manual-retry']);
  });
});
