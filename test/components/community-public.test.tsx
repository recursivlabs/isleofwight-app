import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';
import { __setLocalSearchParams } from '../component-stubs/expo-router';

const publicApi = vi.hoisted(() => ({
  getCommunity: vi.fn(),
  listPosts: vi.fn(),
}));
const authMock = vi.hoisted(() => ({
  value: { sdk: null as any, user: null as any },
}));

vi.mock('react-native', () => ({
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  FlatList: ({ data, ListHeaderComponent, renderItem, ListEmptyComponent, ListFooterComponent }: any) => (
    <div>
      {ListHeaderComponent}
      {data.length ? data.map((item: any, index: number) => (
        <React.Fragment key={item.id}>{renderItem({ item, index })}</React.Fragment>
      )) : ListEmptyComponent}
      {ListFooterComponent}
    </div>
  ),
  Pressable: ({ children, onPress }: any) => <button type="button" onClick={onPress}>{children}</button>,
  ActivityIndicator: () => <span>Loading</span>,
  Alert: { alert: vi.fn() },
  TextInput: (props: any) => <input {...props} />,
  Platform: { OS: 'web' },
}));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Avatar: ({ name }: { name?: string }) => <span>{name}</span>,
  Button: ({ children, onPress }: { children?: React.ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>{children}</button>
  ),
  PostCard: ({ post }: { post: { content?: string } }) => <article>{post.content}</article>,
  Skeleton: () => <span>Skeleton</span>,
  RightRailLayout: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  FeedSidebar: () => null,
}));

vi.mock('../../components/Container', () => ({
  Container: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('../../components/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title?: string }) => <header>{title}</header>,
}));

vi.mock('../../components/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../../lib/auth', () => ({ useAuth: () => authMock.value }));
vi.mock('../../lib/cache', () => ({
  getCached: () => null,
  setCache: vi.fn(),
  invalidatePrefix: vi.fn(),
}));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    text: '#fff',
    textSecondary: '#ccc',
    textMuted: '#aaa',
    surface: '#222',
    bg: '#111',
    glassBorder: '#333',
    borderSubtle: '#333',
    error: '#f00',
  }),
}));
vi.mock('../../lib/usePageTitle', () => ({ usePageTitle: vi.fn() }));
vi.mock('../../lib/recursiv', () => ({
  ORG_ID: 'org-1',
  publicMinds: {
    publicCommunities: { get: publicApi.getCommunity },
    publicPosts: { list: publicApi.listPosts },
  },
}));

import CommunityDetailScreen from '../../app/community/[id]';

describe('public community share page', () => {
  beforeEach(() => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    __setLocalSearchParams({ id: 'technology-20034560' });
    publicApi.getCommunity.mockResolvedValue({
      data: {
        id: 'community-1',
        name: 'Technology',
        privacy: 'public',
        memberCount: 20241,
        postCount: 8871,
      },
    });
    publicApi.listPosts.mockResolvedValue({
      data: [{ id: 'post-1', content: 'A public community post' }],
      meta: { has_more: false },
    });
  });

  it('renders public metadata and posts without a signed-in SDK', async () => {
    render(<CommunityDetailScreen />);

    expect((await screen.findAllByText('Technology')).length).toBeGreaterThan(0);
    expect(await screen.findByText('A public community post')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
    expect(publicApi.getCommunity).toHaveBeenCalledWith('technology-20034560');
    expect(publicApi.listPosts).toHaveBeenCalledWith({
      communityId: 'community-1',
      limit: 20,
      offset: 0,
    });
    expect(publicApi.listPosts).toHaveBeenCalledTimes(1);
  });

  it('renders the resolved community while its first post page is still loading', async () => {
    let resolvePosts: (value: unknown) => void = () => {};
    publicApi.listPosts.mockImplementationOnce(() => new Promise((resolve) => {
      resolvePosts = resolve;
    }));

    render(<CommunityDetailScreen />);

    expect(await screen.findByRole('button', { name: 'Join' })).toBeInTheDocument();
    expect(screen.getAllByText('Technology').length).toBeGreaterThan(0);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton')).not.toBeInTheDocument();
    // The first post-page request starts in a passive effect one commit after
    // the community resolves, so it can land after Join is already visible.
    await waitFor(() => expect(publicApi.listPosts).toHaveBeenCalledTimes(1));

    await act(async () => {
      resolvePosts({
        data: [{ id: 'post-1', content: 'A public community post' }],
        meta: { has_more: false },
      });
    });

    expect(await screen.findByText('A public community post')).toBeInTheDocument();
  });

  it('returns a signed-out Join to the community after OTP authentication', async () => {
    render(<CommunityDetailScreen />);
    await screen.findByText('A public community post');

    await userEvent.click(screen.getByRole('button', { name: 'Join' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        '/auth/sign-in?auth=otp&returnTo=%2Fcommunity%2Ftechnology-20034560%3Fjoin%3D1',
      );
    });
  });

  it('consumes the Join intent once after authenticated membership resolves', async () => {
    const join = vi.fn().mockResolvedValue(undefined);
    const leave = vi.fn();
    authMock.value.sdk = {
      communities: {
        get: vi.fn().mockResolvedValue({
          data: { id: 'community-1', name: 'Technology', is_member: false },
        }),
        join,
        leave,
      },
      posts: { list: vi.fn().mockResolvedValue({ data: [], meta: { has_more: false } }) },
    };
    authMock.value.user = { id: 'viewer-1' };
    __setLocalSearchParams({ id: 'technology-20034560', join: '1' });

    render(<CommunityDetailScreen />);

    await waitFor(() => expect(join).toHaveBeenCalledWith('community-1'));
    expect(join).toHaveBeenCalledTimes(1);
    expect(leave).not.toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/community/technology-20034560');
  });

  it('waits for authenticated membership after auth hydrates before consuming Join', async () => {
    const join = vi.fn();
    const leave = vi.fn();
    let resolveCommunity: (value: unknown) => void = () => {};
    const get = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveCommunity = resolve;
    }));
    const sdk = {
      communities: {
        get,
        join,
        leave,
      },
      posts: { list: vi.fn().mockResolvedValue({ data: [], meta: { has_more: false } }) },
    };
    __setLocalSearchParams({ id: 'technology-20034560', join: '1' });

    const view = render(<CommunityDetailScreen />);
    await screen.findByText('A public community post');

    authMock.value.sdk = sdk;
    authMock.value.user = { id: 'viewer-1' };
    view.rerender(<CommunityDetailScreen />);

    await waitFor(() => expect(get).toHaveBeenCalledWith('technology-20034560'));
    expect(join).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();

    await act(async () => {
      resolveCommunity({
        data: { id: 'community-1', name: 'Technology', is_member: true },
      });
    });

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/community/technology-20034560');
    });
    expect(join).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });

  it('continues a signed-out Create Post action into the community composer', async () => {
    publicApi.getCommunity.mockResolvedValueOnce({
      data: {
        id: 'community-1',
        name: 'Research & Development',
        privacy: 'public',
      },
    });

    render(<CommunityDetailScreen />);
    await screen.findByText('A public community post');

    await userEvent.click(screen.getByRole('button', { name: 'Create Post' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        '/auth/sign-in?auth=otp&returnTo=%2Fcreate%3FcommunityId%3Dcommunity-1%26communityName%3DResearch%2520%2526%2520Development',
      );
    });
  });

  it('continues the empty-community Create Post action into the composer', async () => {
    publicApi.listPosts.mockResolvedValueOnce({ data: [], meta: { has_more: false } });

    render(<CommunityDetailScreen />);
    await screen.findByText('No posts yet');

    const createButtons = screen.getAllByRole('button', { name: 'Create Post' });
    await userEvent.click(createButtons[1]);

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        '/auth/sign-in?auth=otp&returnTo=%2Fcreate%3FcommunityId%3Dcommunity-1%26communityName%3DTechnology',
      );
    });
  });

  it('shows a retryable error instead of claiming a failed post request is empty', async () => {
    publicApi.listPosts.mockRejectedValueOnce(new Error('network unavailable'));

    render(<CommunityDetailScreen />);

    expect(await screen.findByText("Couldn't load posts")).toBeInTheDocument();
    expect(screen.queryByText('No posts yet')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('A public community post')).toBeInTheDocument();
    expect(publicApi.listPosts).toHaveBeenCalledTimes(2);
  });

  it('lets a temporary community lookup failure retry instead of calling it missing', async () => {
    publicApi.getCommunity.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<CommunityDetailScreen />);

    expect(await screen.findByText("Couldn't load community")).toBeInTheDocument();
    expect(screen.queryByText('Community not found')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect((await screen.findAllByText('Technology')).length).toBeGreaterThan(0);
    expect(publicApi.getCommunity).toHaveBeenCalledTimes(2);
  });

  it('stops loading and hides private or missing communities', async () => {
    publicApi.getCommunity.mockRejectedValueOnce(
      Object.assign(new Error('Community not found'), { status: 404 }),
    );

    render(<CommunityDetailScreen />);

    expect(await screen.findByText('Community not found')).toBeInTheDocument();
    expect(screen.queryByText('Skeleton')).not.toBeInTheDocument();
    expect(publicApi.listPosts).not.toHaveBeenCalled();
  });
});
