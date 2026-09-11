import * as React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: { id: 'person-1', username: 'ada' },
  sdk: {
    profiles: {
      follow: vi.fn(),
      unfollow: vi.fn(),
      search: async () => ({
        data: [{ id: 'person-1', name: 'Ada Lovelace', username: 'ada', bio: 'Builds useful things.', follower_count: 12 }],
      }),
    },
    posts: { search: async () => ({ data: [] }) },
    communities: { join: vi.fn(), leave: vi.fn(), list: async () => ({ data: [] }) },
  },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authState,
}));

vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));

vi.mock('../../lib/hooks', () => ({
  useTags: () => ({ tags: [{ id: 'tag-1', name: 'accessibility', slug: 'accessibility' }] }),
  useTodayEdition: () => ({
    edition: {
      stories: [{
        id: 'story-1',
        kicker: 'Technology',
        headline: 'Interfaces work for everyone',
        posts: [{
          id: 'story-post',
          content: 'A useful update.',
          author: { id: 'story-author', name: 'Story Author', username: 'story' },
        }],
      }],
    },
  }),
  useForYouTop: () => ({
    posts: [{
      id: 'top-post',
      content: 'Top post content.',
      author: { id: 'top-author', name: 'Top Author', username: 'top' },
    }],
  }),
  useProfiles: () => ({
    profiles: [
      { id: 'person-1', name: 'Ada Lovelace', username: 'ada', bio: 'Builds useful things.', follower_count: 12 },
      { id: 'person-2', name: 'Grace Hopper', username: 'grace', bio: 'Ships reliable systems.', follower_count: 20 },
      { id: 'person-3', name: 'Linus Torvalds', username: 'linus', bio: 'Builds kernels.', follower_count: 18 },
    ],
  }),
  useProfileLeaderboard: () => ({
    entries: [
      { id: 'person-1', name: 'Ada Lovelace', username: 'ada', follower_count: 12 },
      { id: 'person-2', name: 'Grace Hopper', username: 'grace', follower_count: 20 },
      { id: 'person-3', name: 'Linus Torvalds', username: 'linus', follower_count: 18 },
    ],
  }),
  useCommunities: () => ({
    communities: [
      { id: 'group-1', name: 'Open Builders', slug: 'open-builders', member_count: 50 },
      { id: 'group-2', name: 'Accessible Web', slug: 'accessible-web', member_count: 25 },
    ],
  }),
  useFollowingIds: () => ({ followingIds: new Set(['person-2']) }),
}));

vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    border: '#333333',
    borderSubtle: '#222222',
    glass: '#181818',
    glassBorder: '#333333',
    surface: '#111111',
    textMuted: '#888888',
    textSecondary: '#bbbbbb',
  }),
}));

vi.mock('../../lib/follows', () => ({ afterFollowChange: vi.fn() }));

import { DiscoverLanding, DiscoverResults } from '../../components/DiscoverExplore';

describe('Discover landing accessibility', () => {
  it('names destinations and exposes relationship actions as sibling toggle buttons', () => {
    render(<DiscoverLanding />);

    expect(screen.getByRole('link', { name: 'Open post by Story Author: A useful update.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View posts tagged #accessibility' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all Top on Minds today' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'View profile for Ada Lovelace' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile for Grace Hopper' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View group Open Builders' })).toBeInTheDocument();

    const follow = screen.getByRole('button', { name: 'Follow' });
    const following = screen.getByRole('button', { name: 'Following' });
    expect(follow).toHaveAttribute('aria-pressed', 'false');
    expect(follow.closest('[role="link"]')).toBeNull();
    expect(following).toHaveAttribute('aria-pressed', 'true');
    expect(following.closest('[role="link"]')).toBeNull();

    for (const join of screen.getAllByRole('button', { name: 'Join' })) {
      expect(join).toHaveAttribute('aria-pressed', 'false');
      expect(join.closest('[role="link"]')).toBeNull();
    }
  });

  it('keeps the signed-in profile searchable without offering self-follow', async () => {
    render(<DiscoverResults q="Ada" />);

    const ownProfileLink = await screen.findByRole('link', { name: 'View profile for Ada Lovelace' });
    expect(within(ownProfileLink.parentElement!).queryByRole('button', { name: /follow/i })).toBeNull();
  });
});
