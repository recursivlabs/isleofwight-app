import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => {
  const listPosts = vi.fn();
  const forYou = vi.fn();
  const conversations = vi.fn();
  const listProfiles = vi.fn();
  return {
    listPosts,
    forYou,
    conversations,
    listProfiles,
    client: {
      posts: { list: listPosts },
      curator: { forYou },
      chat: { conversations },
      profiles: { list: listProfiles },
    },
  };
});

vi.mock('./auth', () => ({
  useAuth: () => ({
    sdk: sdk.client,
    user: { id: 'viewer-1' },
  }),
}));

vi.mock('./recursiv', () => ({
  ORG_ID: 'org-test',
  publicMinds: {
    publicProfiles: {},
    publicPosts: {},
  },
}));

import { invalidatePrefix, setCache } from './cache';
import { useConversations, useDiscoverPosts, useForYouTop, usePosts, useProfilePosts, useProfiles } from './hooks';

describe('post-feed keyset pagination', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    invalidatePrefix('profile-posts:cursor-author');
    invalidatePrefix('posts:latest:1');
    invalidatePrefix('discover-posts:score');
    invalidatePrefix('foryou-top:');
    invalidatePrefix('conversations');
    invalidatePrefix('profiles:200');
    sdk.listPosts.mockReset();
    sdk.forYou.mockReset();
    sdk.conversations.mockReset();
    sdk.listProfiles.mockReset();
  });

  it('shares one conversation request across concurrent consumers', async () => {
    let resolveConversations!: (value: { data: any[] }) => void;
    sdk.conversations.mockReturnValue(new Promise((resolve) => { resolveConversations = resolve; }));

    const first = renderHook(() => useConversations());
    const second = renderHook(() => useConversations());

    await waitFor(() => expect(sdk.conversations).toHaveBeenCalledTimes(1));
    act(() => resolveConversations({ data: [{ id: 'conversation-1' }] }));
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
      expect(second.result.current.loading).toBe(false);
    });
  });

  it('does not rank a separate For You pool when a parent supplies feed posts', async () => {
    const { result } = renderHook(() => useForYouTop(40, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sdk.forYou).not.toHaveBeenCalled();
  });

  it('does not load the people directory until its consumer is enabled', async () => {
    sdk.listProfiles.mockResolvedValue({ data: [{ id: 'profile-1', username: 'one' }] });
    const { result, rerender } = renderHook(
      ({ enabled }) => useProfiles(200, enabled),
      { initialProps: { enabled: false } },
    );

    expect(result.current.loading).toBe(false);
    expect(sdk.listProfiles).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(sdk.listProfiles).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.profiles).toEqual([{ id: 'profile-1', username: 'one' }]));
  });

  it('reports a stale persisted feed as loading while it revalidates', () => {
    const now = vi.spyOn(Date, 'now');
    now.mockReturnValue(1_000);
    setCache('posts:personal:20', [{ id: 'cached-post' }]);
    now.mockReturnValue(31_001);
    sdk.forYou.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePosts('personal'));

    expect(result.current.posts).toEqual([{ id: 'cached-post' }]);
    expect(result.current.loading).toBe(true);
    now.mockRestore();
  });

  it('uses the platform cursor for the next main-feed page', async () => {
    sdk.listPosts
      .mockResolvedValueOnce({
        data: [{ id: 'feed-1', content: 'First page', createdAt: '2026-08-25T12:00:00Z' }],
        meta: { has_more: true, next_cursor: 'feed-cursor-2' },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'feed-2', content: 'Second page', createdAt: '2026-08-25T11:00:00Z' }],
        meta: { has_more: false, next_cursor: null },
      });

    const { result } = renderHook(() => usePosts('latest', 1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sdk.listPosts).toHaveBeenNthCalledWith(1, {
      limit: 1,
      organization_id: 'org-test',
      offset: 0,
    });

    act(() => result.current.loadMore());

    await waitFor(() => expect(sdk.listPosts).toHaveBeenCalledTimes(2));
    expect(sdk.listPosts).toHaveBeenNthCalledWith(2, {
      limit: 1,
      organization_id: 'org-test',
      cursor: 'feed-cursor-2',
    });
    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual(['feed-1', 'feed-2']);
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('uses the platform cursor for the next authenticated profile page', async () => {
    sdk.listPosts
      .mockResolvedValueOnce({
        data: [{ id: 'post-1', content: 'First page' }],
        meta: { has_more: true, next_cursor: 'cursor-page-2' },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'post-2', content: 'Second page' }],
        meta: { has_more: false, next_cursor: null },
      });

    const { result } = renderHook(() => useProfilePosts('cursor-author', { limit: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sdk.listPosts).toHaveBeenNthCalledWith(1, {
      author_id: 'cursor-author',
      limit: 1,
      offset: 0,
    });

    act(() => result.current.loadMore());

    await waitFor(() => expect(sdk.listPosts).toHaveBeenCalledTimes(2));
    expect(sdk.listPosts).toHaveBeenNthCalledWith(2, {
      author_id: 'cursor-author',
      limit: 1,
      cursor: 'cursor-page-2',
    });
    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual(['post-1', 'post-2']);
      expect(result.current.hasMore).toBe(false);
    });
  });

  it('uses the platform cursor for the next discovery page', async () => {
    sdk.listPosts
      .mockResolvedValueOnce({
        data: [{ id: 'discover-1', content: 'Top page one' }],
        meta: { has_more: true, next_cursor: 'discover-cursor-2' },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'discover-2', content: 'Top page two' }],
        meta: { has_more: false, next_cursor: null },
      });

    const { result } = renderHook(() => useDiscoverPosts({ order: 'top', limit: 1 }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sdk.listPosts).toHaveBeenNthCalledWith(1, {
      limit: 1,
      offset: 0,
      sort: 'score',
    });

    act(() => result.current.loadMore());

    await waitFor(() => expect(sdk.listPosts).toHaveBeenCalledTimes(2));
    expect(sdk.listPosts).toHaveBeenNthCalledWith(2, {
      limit: 1,
      cursor: 'discover-cursor-2',
      sort: 'score',
    });
    await waitFor(() => {
      expect(result.current.posts.map((post) => post.id)).toEqual(['discover-1', 'discover-2']);
      expect(result.current.hasMore).toBe(false);
    });
  });
});
