// Feed screen states: loaded list, the "Build your feed" empty state, the
// error state with a working Retry, and skeletons-while-loading. The data
// layer (usePosts) is mocked so each state is driven deliberately.
import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from 'expo-router';

const authMock = vi.hoisted(() => {
  const sdk = {
    realtime: { connect: vi.fn(async () => {}) },
    agents: { ensurePersonal: vi.fn(async () => ({})) },
  };
  return {
    value: {
      sdk,
      user: {
        id: 'viewer-1',
        username: 'viewer',
        name: 'Viewer',
        // Complete profile → the "Complete your profile" nudge stays out of
        // these states' way.
        image: 'https://example.com/a.png',
        bio: 'has a bio',
      },
    },
  };
});
vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock.value,
}));

// One stable object per suite; each test mutates the fields it cares about.
const feed = vi.hoisted(() => ({
  posts: [] as Array<Record<string, unknown>>,
  setPosts: vi.fn(),
  loading: false,
  error: null as string | null,
  refreshing: false,
  refresh: vi.fn(),
  recurate: vi.fn(),
  loadMore: vi.fn(),
  loadNew: vi.fn(async () => 0),
  hasMore: false,
}));

const feedInsertMocks = vi.hoisted(() => ({
  people: vi.fn(() => null),
  groups: vi.fn(() => null),
}));

vi.mock('../../components/FeedInserts', () => ({
  FeedPeopleInsert: feedInsertMocks.people,
  FeedGroupsInsert: feedInsertMocks.groups,
}));

vi.mock('../../lib/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/hooks')>();
  return { ...actual, usePosts: () => feed };
});

vi.mock('../../lib/resolvePersonalAgent', () => ({
  resolvePersonalAgent: vi.fn(async () => null),
  invalidatePersonalAgent: vi.fn(),
}));

import FeedScreen from '../../app/(tabs)/index';

const post = (id: string, author: string, content: string) => ({
  id,
  content,
  author: { id: `${author}-id`, name: author, username: author.toLowerCase() },
  created_at: new Date().toISOString(),
  score: 1,
  reply_count: 0,
});

beforeEach(() => {
  feed.posts = [];
  feed.loading = false;
  feed.error = null;
  feed.refreshing = false;
  feed.hasMore = false;
  feedInsertMocks.people.mockClear();
  feedInsertMocks.groups.mockClear();
});

describe('feed screen', () => {
  it('exposes feed views as tabs and the composer entry as a named button', async () => {
    render(<FeedScreen />);

    const tablist = screen.getByRole('tablist', { name: 'Feed views' });
    const forYou = screen.getByRole('tab', { name: 'For You' });
    const following = screen.getByRole('tab', { name: 'Following' });
    expect(tablist).toContainElement(forYou);
    expect(tablist).toContainElement(following);
    expect(forYou).toHaveAttribute('aria-selected', 'true');
    expect(following).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(following);
    expect(forYou).toHaveAttribute('aria-selected', 'false');
    expect(following).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Create a post' }));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/create');
  });

  it('renders the loaded posts', async () => {
    feed.posts = [post('p1', 'Sarah', 'First post body'), post('p2', 'Marcus', 'Second post body')];
    render(<FeedScreen />);
    expect(await screen.findByText('First post body')).toBeInTheDocument();
    expect(screen.getByText('Second post body')).toBeInTheDocument();
    expect(screen.getByText('Sarah')).toBeInTheDocument();
    expect(screen.getByText('Marcus')).toBeInTheDocument();
  });

  it('defers discovery inserts while a stale feed page is revalidating', async () => {
    feed.posts = Array.from({ length: 12 }, (_, index) =>
      post(`p${index}`, `Author ${index}`, `Post ${index}`),
    );
    feed.loading = true;

    render(<FeedScreen />);

    expect(await screen.findByText('Post 0')).toBeInTheDocument();
    expect(feedInsertMocks.people).not.toHaveBeenCalled();
    expect(feedInsertMocks.groups).not.toHaveBeenCalled();
  });

  it('restores discovery inserts after the primary feed settles', async () => {
    feed.posts = Array.from({ length: 12 }, (_, index) =>
      post(`p${index}`, `Author ${index}`, `Post ${index}`),
    );

    render(<FeedScreen />);

    await waitFor(() => expect(feedInsertMocks.people).toHaveBeenCalled());
  });

  it('shows the "Build your feed" empty state when For You has no posts', async () => {
    render(<FeedScreen />);
    expect(await screen.findByText('Build your feed')).toBeInTheDocument();
    expect(
      screen.getByText('Follow people and explore communities to fill your feed with great posts.'),
    ).toBeInTheDocument();
  });

  it('the empty state routes to Discover', async () => {
    render(<FeedScreen />);
    await userEvent.click(await screen.findByText('Discover people'));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/discover');
  });

  it('shows the error state with a Retry that refetches', async () => {
    feed.error = 'network down';
    render(<FeedScreen />);
    expect(await screen.findByText("Couldn't load your feed.")).toBeInTheDocument();
    await userEvent.click(screen.getByText('Retry'));
    await waitFor(() => expect(feed.refresh).toHaveBeenCalled());
  });

  it('shows skeletons (not the empty state, not an error) while loading', () => {
    feed.loading = true;
    render(<FeedScreen />);
    expect(screen.queryByText('Build your feed')).not.toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your feed.")).not.toBeInTheDocument();
  });

  it('shows "You\'re all caught up" once the list is exhausted', async () => {
    feed.posts = [post('p1', 'Sarah', 'Only post')];
    feed.hasMore = false;
    render(<FeedScreen />);
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });
});
