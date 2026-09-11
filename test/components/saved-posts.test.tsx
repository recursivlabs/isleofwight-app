import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const bookmarksMock = vi.hoisted(() => ({
  ids: [] as string[],
  persist: vi.fn(async () => true),
}));
const cacheMock = vi.hoisted(() => {
  const entries = new Map<string, any>();
  return {
    entries,
    getCached: vi.fn((key: string) => entries.get(key)),
    setCache: vi.fn((key: string, value: any) => entries.set(key, value)),
  };
});
const authMock = vi.hoisted(() => {
  const posts = { get: vi.fn(), list: vi.fn() };
  return { posts, value: { sdk: { posts } } };
});

vi.mock('../../lib/bookmarks', () => ({
  getBookmarks: () => [...bookmarksMock.ids],
}));
vi.mock('../../lib/cache', () => ({
  getCached: cacheMock.getCached,
  setCache: cacheMock.setCache,
}));
vi.mock('../../lib/auth', () => ({ useAuth: () => authMock.value }));
vi.mock('../../components/PostCard', () => ({
  PostCard: ({ post, onVoteChange, onBookmarkChange }: any) => {
    const [saved, setSaved] = React.useState(bookmarksMock.ids.includes(post.id));
    return (
    <article>
      <span>{post.content}</span>
      {onVoteChange ? (
        <button type="button" onClick={() => onVoteChange(post.id, 0, null)}>
          Remove like {post.id}
        </button>
      ) : null}
        <button type="button" onClick={async () => {
          const next = !saved;
          const setPresence = (present: boolean) => {
            bookmarksMock.ids = bookmarksMock.ids.filter((id) => id !== post.id);
            if (present) bookmarksMock.ids.push(post.id);
          };
          // Match toggleBookmarkConfirmed: memory changes before persistence;
          // failed storage rolls back without notifying the owning screen.
          setPresence(next);
          if (!await bookmarksMock.persist()) {
            if (bookmarksMock.ids.includes(post.id) === next) setPresence(saved);
            return;
          }
          setSaved(next);
          onBookmarkChange?.(post.id, next);
        }}>
          {saved ? 'Remove bookmark' : 'Bookmark'} {post.id}
        </button>
    </article>
    );
  },
}));

import BookmarksScreen from '../../app/bookmarks';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('Saved posts', () => {
  beforeEach(() => {
    bookmarksMock.ids = [];
    bookmarksMock.persist.mockReset().mockResolvedValue(true);
    cacheMock.entries.clear();
    cacheMock.getCached.mockClear();
    cacheMock.setCache.mockClear();
    authMock.posts.get.mockReset();
    authMock.posts.list.mockReset();
    __setLocalSearchParams({});
  });

  it('hydrates a bookmarked post from the SDK response envelope', async () => {
    bookmarksMock.ids = ['saved-1'];
    authMock.posts.get.mockResolvedValue({
      data: { id: 'saved-1', content: 'Saved from the server' },
    });

    render(<BookmarksScreen />);

    expect(await screen.findByText('Saved from the server')).toBeInTheDocument();
    expect(authMock.posts.get).toHaveBeenCalledWith('saved-1');
    expect(cacheMock.setCache).toHaveBeenCalledWith(
      'post:saved-1',
      expect.objectContaining({ id: 'saved-1' }),
    );
  });

  it('keeps a removed bookmark absent when another bookmark finishes loading', async () => {
    bookmarksMock.ids = ['saved-a', 'saved-b'];
    cacheMock.entries.set('post:saved-a', { id: 'saved-a', content: 'Already loaded bookmark' });
    let resolveHydration!: (response: { data: { id: string; content: string } }) => void;
    authMock.posts.get.mockReturnValue(new Promise((resolve) => { resolveHydration = resolve; }));
    render(<BookmarksScreen />);

    expect(authMock.posts.get).toHaveBeenCalledExactlyOnceWith('saved-b');
    await userEvent.click(screen.getByRole('button', { name: 'Remove bookmark saved-a' }));
    expect(bookmarksMock.ids).toEqual(['saved-b']);
    expect(screen.queryByText('Already loaded bookmark')).not.toBeInTheDocument();

    await act(async () => resolveHydration({
      data: { id: 'saved-b', content: 'Newly loaded bookmark' },
    }));

    expect(screen.getByText('Newly loaded bookmark')).toBeInTheDocument();
    expect(bookmarksMock.ids).toEqual(['saved-b']);
    expect(screen.queryByText('Already loaded bookmark')).not.toBeInTheDocument();
  });

  it('keeps an unconfirmed removal visible through hydration and failed persistence', async () => {
    bookmarksMock.ids = ['saved-a', 'saved-b'];
    cacheMock.entries.set('post:saved-a', { id: 'saved-a', content: 'Bookmark kept after storage failure' });
    const hydration = deferred<{ data: { id: string; content: string } }>();
    const removal = deferred<boolean>();
    authMock.posts.get.mockReturnValue(hydration.promise);
    bookmarksMock.persist.mockReturnValueOnce(removal.promise);
    render(<BookmarksScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove bookmark saved-a' }));
    expect(bookmarksMock.ids).toEqual(['saved-b']);
    expect(screen.getByText('Bookmark kept after storage failure')).toBeInTheDocument();
    await act(async () => hydration.resolve({
      data: { id: 'saved-b', content: 'Newly loaded bookmark' },
    }));
    expect(screen.getByText('Newly loaded bookmark')).toBeInTheDocument();
    expect(screen.getByText('Bookmark kept after storage failure')).toBeInTheDocument();

    await act(async () => removal.resolve(false));

    expect(bookmarksMock.ids).toEqual(['saved-b', 'saved-a']);
    expect(screen.getByText('Bookmark kept after storage failure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove bookmark saved-a' })).toBeInTheDocument();
  });

  it.each([true, false])('respects removal from Liked while that bookmark is still hydrating (lookup succeeds: %s)', async (succeeds) => {
    bookmarksMock.ids = ['saved-a', 'saved-b'];
    cacheMock.entries.set('post:saved-a', { id: 'saved-a', content: 'Cached bookmark' });
    const hydration = deferred<{ data: { id: string; content: string } }>();
    authMock.posts.get.mockReturnValue(hydration.promise);
    authMock.posts.list.mockResolvedValue({
      data: [{ id: 'saved-b', content: 'Liked and bookmarked post' }],
      meta: { has_more: false },
    });
    render(<BookmarksScreen />);

    await userEvent.click(screen.getByRole('tab', { name: 'Liked' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove bookmark saved-b' }));
    expect(bookmarksMock.ids).toEqual(['saved-a']);
    await userEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    if (succeeds) {
      await act(async () => hydration.resolve({
        data: { id: 'saved-b', content: 'Liked and bookmarked post' },
      }));
    } else {
      await act(async () => hydration.reject(new Error('Removed bookmark lookup failed')));
    }

    expect(screen.getByText('Cached bookmark')).toBeInTheDocument();
    expect(screen.queryByText('Liked and bookmarked post')).not.toBeInTheDocument();
    expect(screen.queryByText('Some bookmarks could not be loaded.')).not.toBeInTheDocument();
  });

  it('includes a genuinely re-saved bookmark when Retry starts a new load', async () => {
    bookmarksMock.ids = ['saved-a', 'saved-b'];
    const savedA = { id: 'saved-a', content: 'Re-saved bookmark' };
    cacheMock.entries.set('post:saved-a', savedA);
    const firstLoad = deferred<{ data: { id: string; content: string } }>();
    authMock.posts.get
      .mockReturnValueOnce(firstLoad.promise)
      .mockResolvedValueOnce({ data: { id: 'saved-b', content: 'Loaded on retry' } });
    authMock.posts.list.mockResolvedValue({ data: [savedA], meta: { has_more: false } });
    render(<BookmarksScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove bookmark saved-a' }));
    await act(async () => firstLoad.reject(new Error('Temporary hydration failure')));
    expect(screen.getByText('Some bookmarks could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Liked' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bookmark saved-a' }));
    expect(bookmarksMock.ids).toEqual(['saved-b', 'saved-a']);
    await userEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Loaded on retry')).toBeInTheDocument();
    expect(screen.getByText('Re-saved bookmark')).toBeInTheDocument();
    expect(screen.queryByText('Some bookmarks could not be loaded.')).not.toBeInTheDocument();
    expect(authMock.posts.get).toHaveBeenCalledTimes(2);
  });

  it('loads the caller\'s likes through the SDK and removes an unvoted row immediately', async () => {
    authMock.posts.list.mockResolvedValue({
      data: [{ id: 'liked-1', content: 'A post worth revisiting', user_reaction: 'upvote' }],
      meta: { has_more: false, next_cursor: null },
    });
    render(<BookmarksScreen />);

    await userEvent.click(screen.getByRole('tab', { name: 'Liked' }));

    expect(await screen.findByText('A post worth revisiting')).toBeInTheDocument();
    expect(router.setParams).toHaveBeenCalledWith({ tab: 'liked' });
    expect(authMock.posts.list).toHaveBeenCalledWith({ limit: 20, offset: 0, liked: true });
    await userEvent.click(screen.getByRole('button', { name: 'Remove like liked-1' }));
    await waitFor(() => expect(screen.queryByText('A post worth revisiting')).not.toBeInTheDocument());
    expect(screen.getByText('No liked posts yet')).toBeInTheDocument();
  });

  it('offers a working retry when liked posts fail to load', async () => {
    authMock.posts.list
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce({ data: [], meta: { has_more: false } });
    render(<BookmarksScreen />);

    await userEvent.click(screen.getByRole('tab', { name: 'Liked' }));
    expect(await screen.findByText('Couldn’t load your liked posts.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No liked posts yet')).toBeInTheDocument();
    expect(authMock.posts.list).toHaveBeenCalledTimes(2);
  });

  it('opens the liked view directly from the URL and restores the default URL', async () => {
    __setLocalSearchParams({ tab: 'liked' });
    authMock.posts.list.mockResolvedValue({
      data: [{ id: 'liked-deep-link', content: 'Opened from a liked-post link' }],
      meta: { has_more: false },
    });

    render(<BookmarksScreen />);

    expect(screen.getByRole('tab', { name: 'Liked' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Opened from a liked-post link')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Bookmarks' }));
    expect(screen.getByRole('tab', { name: 'Bookmarks' })).toHaveAttribute('aria-selected', 'true');
    expect(router.setParams).toHaveBeenLastCalledWith({ tab: undefined });
  });
});
