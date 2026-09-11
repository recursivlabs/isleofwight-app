import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: null, sdk: null }),
}));

vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));

vi.mock('../../lib/hooks', () => ({
  useRelatedProfiles: () => [],
  useGroupMembers: () => ({ members: [], total: null }),
  useRelatedGroups: () => [],
  useAgents: () => ({ agents: [] }),
  useCommunities: () => ({
    communities: [{
      id: 'community-1',
      name: 'Meme Supreme',
      description: "We&#039;re here &amp; ready.",
      member_count: 8_023,
    }],
  }),
  useFollowingIds: () => ({ followingIds: new Set<string>() }),
  useForYouTop: () => ({ posts: [] }),
  useProfiles: () => ({ profiles: [] }),
  useProfileLeaderboard: () => ({
    entries: [{
      id: 'creator-1',
      name: 'Ada Lovelace',
      username: 'ada',
      bio: 'Builds useful things.',
      follower_count: 12,
    }],
  }),
  useTodayEdition: () => ({
    edition: {
      stories: [{
        id: 'story-1',
        headline: 'Accessible discovery',
        posts: [{
          id: 'post-1',
          created_at: '2026-08-27T00:00:00.000Z',
          author: { id: 'creator-1', name: 'Ada Lovelace' },
        }],
      }],
    },
  }),
}));

const colors = {
  accent: '#d4a844',
  accentHover: '#c69a35',
  accentMuted: '#332b19',
  bg: '#050505',
  border: '#333333',
  borderSubtle: '#222222',
  glass: '#181818',
  surface: '#111111',
  surfaceHover: '#202020',
  text: '#ffffff',
  textInverse: '#050505',
  textMuted: '#888888',
  textSecondary: '#bbbbbb',
};

vi.mock('../../lib/theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/theme')>();
  return { ...actual, useColors: () => colors };
});

import { FeedSidebar } from '../../components/FeedSidebar';

describe('FeedSidebar navigation', () => {
  it('exposes global search as a named button and preserves the command shortcut', () => {
    const onKeyDown = vi.fn();
    window.addEventListener('keydown', onKeyDown);
    render(<FeedSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Search anywhere' }));

    expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'k', metaKey: true }));
    window.removeEventListener('keydown', onKeyDown);
  });

  it('exposes the upgrade CTA as an internal link', () => {
    render(<FeedSidebar />);

    expect(screen.getByRole('link', { name: 'See Plus and Pro plans' }))
      .toHaveAttribute('href', '/upgrade');
  });

  it('names right-rail destinations and follow actions by purpose', () => {
    render(<FeedSidebar />);

    expect(screen.getByRole('link', { name: 'Today on Minds' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all Today on Minds' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open story: Accessible discovery' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trending Channels' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all Trending Channels' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders imported group descriptions as readable text', () => {
    render(<FeedSidebar context="communities" />);

    expect(screen.getByText("We're here & ready.")).toBeInTheDocument();
    expect(screen.queryByText(/&#039;|&amp;/)).not.toBeInTheDocument();
  });
});
