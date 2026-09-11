import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';

const publicApi = vi.hoisted(() => ({
  listCommunities: vi.fn(),
  listPosts: vi.fn(),
}));

vi.mock('../../lib/recursiv', () => ({
  publicMinds: {
    publicCommunities: { list: publicApi.listCommunities },
    publicPosts: { list: publicApi.listPosts },
  },
}));

vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    border: '#333',
    surface: '#171717',
    textSecondary: '#aaa',
    text: '#fff',
    textInverse: '#000',
  }),
}));

import { SignedOutDiscover } from '../../components/SignedOutDiscover';

describe('signed-out Discover', () => {
  beforeEach(() => {
    vi.mocked(router.push).mockReset();
    publicApi.listCommunities.mockResolvedValue({
      data: [{
        id: 'technology-community',
        slug: 'technology-20034560',
        name: 'Technology',
        privacy: 'public',
        memberCount: 20_000,
        postCount: 8_000,
      }],
    });
    publicApi.listPosts.mockResolvedValue({ data: [] });
  });

  it('offers real public exploration before explaining what a session unlocks', async () => {
    render(<SignedOutDiscover returnTo="/discover?q=privacy" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Discover what’s happening' })).toBeInTheDocument();
    expect(screen.getByText(/explore active public groups now/i)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /open public group technology/i }))
      .toHaveAttribute('href', '/community/technology-community');
  });

  it('turns the signed-out communities route into a real public group preview', async () => {
    publicApi.listPosts.mockResolvedValue({
      data: [{
        id: 'group-post',
        content: 'A substantive public update from the Technology group today.',
      }],
    });

    render(
      <SignedOutDiscover
        returnTo="/discover/communities"
        section="communities"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Discover public groups' }))
      .toBeInTheDocument();
    expect(screen.getByText(/explore a public group now/i)).toBeInTheDocument();
    expect(await screen.findByText('Latest in the Technology group')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open technology post/i }))
      .toHaveAttribute('href', '/post/group-post');
    expect(screen.getByRole('link', { name: /see all posts in technology/i }))
      .toHaveAttribute('href', '/community/technology-community');
    expect(screen.queryByRole('link', { name: /minds live/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /public moderation log/i })).not.toBeInTheDocument();
  });

  it('ranks real public groups and excludes hidden or private directory rows', async () => {
    publicApi.listCommunities.mockResolvedValue({
      data: [
        { id: 'small-id', slug: 'small', name: 'Small but real', privacy: 'public', memberCount: 2, postCount: 3 },
        { id: 'wildlife-id', slug: 'wildlife', name: 'Wildlife', privacy: 'public', memberCount: 12_000, postCount: 16_000 },
        { id: 'ideas-id', slug: 'big-ideas', name: 'Big Ideas', privacy: 'public', memberCount: 100, postCount: 500 },
        { id: 'music-id', slug: 'music', name: 'Music', privacy: 'public', memberCount: 2_000, postCount: 4_000 },
        { id: 'private', slug: 'private', name: 'Private', privacy: 'private', memberCount: 99_000 },
        { id: 'hidden', slug: 'hidden', name: 'Hidden import', privacy: 'public', importHidden: true, memberCount: 99_000 },
      ],
    });

    render(<SignedOutDiscover returnTo="/groups" section="communities" />);

    expect(await screen.findByText('Popular public groups')).toBeInTheDocument();
    const groupLinks = screen.getAllByRole('link', { name: /open public group/i });
    expect(groupLinks).toHaveLength(3);
    expect(groupLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/community/wildlife-id',
      '/community/music-id',
      '/community/ideas-id',
    ]);
    expect(screen.queryByText('Private')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden import')).not.toBeInTheDocument();
    expect(publicApi.listCommunities).toHaveBeenCalledWith({ limit: 12, privacy: 'public' });
  });

  it.each([
    ['Continue with email', 'otp'],
    ['Log in with password', 'login'],
  ] as const)('opens %s and preserves the requested Discover URL', async (label, auth) => {
    render(<SignedOutDiscover returnTo="/discover?q=privacy" />);
    await userEvent.click(screen.getByRole('button', { name: label }));

    expect(router.push).toHaveBeenCalledWith(
      `/auth/sign-in?auth=${auth}&returnTo=%2Fdiscover%3Fq%3Dprivacy`,
    );
  });

  it.each([
    ['Public groups', '/groups'],
    ['Minds Live', '/live'],
    ['Public moderation log', '/moderation'],
  ] as const)('exposes the public %s preview as a real web link', (label, href) => {
    render(<SignedOutDiscover returnTo="/discover" />);

    expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toHaveAttribute('href', href);
  });

  it('shows readable public posts and skips URL-only previews', async () => {
    publicApi.listPosts.mockResolvedValue({
      data: [
        { id: 'link-only', content: 'https://example.com/a-bare-link' },
        {
          id: 'post-1',
          title: 'A readable update about local AI hardware',
          content: 'https://example.com/local-ai',
        },
        {
          id: 'post-2',
          content: 'Another public update with enough context to understand the conversation.',
        },
      ],
    });
    render(<SignedOutDiscover returnTo="/discover" />);

    expect(await screen.findByText('Latest in Technology')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open technology post: a readable update/i }))
      .toHaveAttribute('href', '/post/post-1');
    expect(screen.getByRole('link', { name: /another public update with enough context/i }))
      .toHaveAttribute('href', '/post/post-2');
    expect(screen.queryByText('https://example.com/a-bare-link')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /see all posts in technology/i }))
      .toHaveAttribute('href', '/community/technology-community');
    await waitFor(() => {
      expect(publicApi.listPosts).toHaveBeenCalledWith({ communityId: 'technology-community', limit: 12 });
    });
  });

  it('does not advertise a fabricated community when the public directory fails', async () => {
    publicApi.listCommunities.mockRejectedValueOnce(new Error('directory unavailable'));

    render(<SignedOutDiscover returnTo="/discover" />);

    await waitFor(() => expect(publicApi.listCommunities).toHaveBeenCalled());
    expect(screen.queryByRole('link', { name: /technology community/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /public groups/i })).toHaveAttribute('href', '/groups');
  });
});
