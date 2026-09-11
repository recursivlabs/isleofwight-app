import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';
import { ToastProvider } from '../../components/Toast';

const authMock = vi.hoisted(() => ({
  value: {
    sdk: null as any,
    user: null as any,
    signOut: vi.fn(),
    refreshUser: vi.fn(),
  },
}));
const profileMock = vi.hoisted(() => ({
  profile: {
    id: 'profile-123',
    name: 'Public Author',
    username: 'public-author',
    bio: '',
  },
  isFollowing: false,
  setIsFollowing: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
}));
const shareMock = vi.hoisted(() => vi.fn());
const publicProfilesMock = vi.hoisted(() => ({
  get: vi.fn(),
  followers: vi.fn(),
  following: vi.fn(),
}));
const profileFeedsMock = vi.hoisted(() => ({
  posts: [] as any[],
  articles: [] as any[],
  replies: [] as any[],
}));
const cropperMock = vi.hoisted(() => ({
  props: null as null | { onDone: (result: { uri: string }) => void },
}));

vi.mock('../../lib/auth', () => ({ useAuth: () => authMock.value }));
vi.mock('../../components/ImageCropper', () => ({
  ImageCropper: (props: { onDone: (result: { uri: string }) => void }) => {
    cropperMock.props = props;
    return null;
  },
  CROP_AVATAR: { width: 512, height: 512 },
}));
vi.mock('../../lib/moderation', () => ({
  getFollowRelationship: () => Promise.resolve({ follows_you: false }),
  getBlockedUsers: () => Promise.resolve({ data: [], error: false }),
  getMutedUsers: () => Promise.resolve({ data: [], error: false }),
  blockUser: () => Promise.resolve(),
  unblockUser: () => Promise.resolve(),
  muteUser: () => Promise.resolve(),
  unmuteUser: () => Promise.resolve(),
}));
vi.mock('../../lib/follows', () => ({ afterFollowChange: vi.fn() }));
vi.mock('../../lib/recursiv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/recursiv')>();
  return {
    ...actual,
    publicMinds: { publicProfiles: publicProfilesMock },
  };
});

vi.mock('../../lib/hooks', () => {
  const feed = (posts: any[]) => ({
    posts,
    loading: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  });
  return {
    useProfile: () => ({
      profile: profileMock.profile,
      loading: false,
      error: null,
      isFollowing: profileMock.isFollowing,
      setIsFollowing: profileMock.setIsFollowing,
      refresh: profileMock.refresh,
    }),
    useMyProfile: () => ({ refresh: vi.fn() }),
    useCommunities: () => ({ communities: [] }),
    useConversations: () => ({ conversations: [] }),
    useProfilePosts: (_authorId: string, opts?: { replies?: boolean; articles?: boolean }) =>
      feed(opts?.replies ? profileFeedsMock.replies : opts?.articles ? profileFeedsMock.articles : profileFeedsMock.posts),
  };
});

import UserProfileScreen from '../../app/user/[username]';
import { SITE_URL } from '../../lib/recursiv';

describe('profile action authentication handoff', () => {
  // `delay: null` skips the macrotask user-event awaits between keystrokes.
  // These drive a full profile screen, so each keystroke is a whole re-render.
  const user = userEvent.setup({ delay: null });

  beforeEach(() => {
    authMock.value.sdk = null;
    authMock.value.user = null;
    profileMock.profile = {
      id: 'profile-123',
      name: 'Public Author',
      username: 'public-author',
      bio: '',
    };
    profileMock.isFollowing = false;
    profileMock.refresh.mockReset().mockResolvedValue(undefined);
    profileFeedsMock.posts = [];
    profileFeedsMock.articles = [];
    profileFeedsMock.replies = [];
    cropperMock.props = null;
    shareMock.mockReset();
    shareMock.mockResolvedValue(undefined);
    publicProfilesMock.get.mockReset();
    publicProfilesMock.get.mockResolvedValue({
      data: { id: 'profile-123', username: 'public-author' },
    });
    publicProfilesMock.followers.mockReset();
    publicProfilesMock.followers.mockResolvedValue({ data: [], meta: { has_more: false } });
    publicProfilesMock.following.mockReset();
    publicProfilesMock.following.mockResolvedValue({ data: [], meta: { has_more: false } });
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: shareMock });
    __setLocalSearchParams({ username: 'public-author' });
  });

  it('does not leak empty optional profile fields into native View children', () => {
    profileMock.profile = {
      ...profileMock.profile,
      bio: '',
      createdAt: '',
      created_at: '',
    } as any;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<UserProfileScreen />);

    const nativeTextWarnings = consoleError.mock.calls.filter((args) =>
      args.map(String).join(' ').includes('A text node cannot be a child of a <View>'),
    );
    consoleError.mockRestore();
    expect(nativeTextWarnings).toHaveLength(0);
  });

  it('shows a plain-format post that carries a legacy title', () => {
    profileFeedsMock.posts = [{
      id: 'titled-plain-post',
      title: 'A real post title',
      content: 'A separate plain-text body.',
      contentFormat: 'plain',
      author: {
        id: 'profile-123',
        name: 'Public Author',
        username: 'public-author',
      },
      createdAt: '2026-08-28T06:00:00.000Z',
      score: 0,
      repliesCount: 0,
      repostsCount: 0,
    }];

    render(<UserProfileScreen />);

    expect(screen.getByText('A real post title')).toBeInTheDocument();
    expect(screen.getByText('A separate plain-text body.')).toBeInTheDocument();
    expect(screen.queryByText('No posts yet')).not.toBeInTheDocument();
  });

  // The owner account menu (cog + Settings/Billing/Sign out) left the profile
  // page: Settings lives on the sidebar avatar row and in the mobile drawer.

  it('recovers the current handle for a UUID-routed owner with partial cached identity', async () => {
    const me = vi.fn().mockResolvedValue({
      data: { id: 'profile-123', username: 'canonical-handle' },
    });
    authMock.value.sdk = { profiles: { me } };
    authMock.value.user = { id: 'profile-123' };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: undefined,
      bio: '',
    } as any;
    __setLocalSearchParams({ username: '019d5190-f0c0-717e-a1bd-ef9c335292b9' });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('username')).toHaveValue('canonical-handle');
    });
    expect(me).toHaveBeenCalledTimes(1);
  });

  it('preserves a one-item route handle when owner projections omit username', async () => {
    const me = vi.fn().mockResolvedValue({ data: { id: 'profile-123' } });
    authMock.value.sdk = { profiles: { me } };
    authMock.value.user = { id: 'profile-123' };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: undefined,
      bio: '',
    } as any;
    __setLocalSearchParams({ username: ['canonical-handle'] as any });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    expect(screen.getByPlaceholderText('username')).toHaveValue('canonical-handle');
    expect(me).not.toHaveBeenCalled();
  });

  it('coerces a hydrated string-like route handle before username validation', async () => {
    const me = vi.fn().mockResolvedValue({ data: { id: 'profile-123' } });
    authMock.value.sdk = { profiles: { me } };
    authMock.value.user = { id: 'profile-123' };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: undefined,
      bio: '',
    } as any;
    const hydratedRouteHandle = {
      length: 1,
      toString: () => 'canonical-handle',
    };
    __setLocalSearchParams({ username: hydratedRouteHandle as any });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    expect(screen.getByPlaceholderText('username')).toHaveValue('canonical-handle');
    expect(me).not.toHaveBeenCalled();
  });

  it('normalizes a string-like owner handle before seeding and saving the editor', async () => {
    const update = vi.fn().mockResolvedValue({ data: { id: 'profile-123' } });
    const me = vi.fn().mockResolvedValue({ data: { id: 'profile-123' } });
    const hydratedOwnerHandle = {
      length: 1,
      toString: () => 'canonical-handle',
    };
    authMock.value.sdk = { profiles: { me, update } };
    authMock.value.user = {
      id: 'profile-123',
      username: hydratedOwnerHandle,
    };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: undefined,
      bio: '',
    } as any;
    __setLocalSearchParams({ username: '019d5190-f0c0-717e-a1bd-ef9c335292b9' });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    expect(screen.getByPlaceholderText('username')).toHaveValue('canonical-handle');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({
        name: 'Profile Owner',
        username: 'canonical-handle',
        bio: '',
      });
    });
    expect(me).not.toHaveBeenCalled();
  });

  it('keeps the editor and selected avatar available when upload fails, then retries', async () => {
    const update = vi.fn().mockResolvedValue({ data: { id: 'profile-123' } });
    const getAvatarUploadUrl = vi.fn().mockResolvedValue({
      data: { upload_url: 'https://uploads.minds.test/avatar', key: 'avatar-key' },
    });
    const confirmAvatarUpload = vi.fn().mockResolvedValue({ data: { success: true } });
    authMock.value.sdk = {
      profiles: { update },
      uploads: { getAvatarUploadUrl, confirmAvatarUpload },
    };
    authMock.value.user = { id: 'profile-123', username: 'public-author' };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: 'public-author',
      bio: '',
    };
    const avatarBlob = new Blob(['avatar'], { type: 'image/jpeg' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ blob: async () => avatarBlob } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' } as Response);

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByRole('button', { name: 'Change profile picture' })).toBeInTheDocument();
    act(() => cropperMock.props?.onDone({ uri: 'blob:cropped-avatar' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('blob:cropped-avatar'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled());
    expect(update).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(confirmAvatarUpload).toHaveBeenCalledWith('avatar-key'));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(fetchSpy).toHaveBeenCalledWith('blob:cropped-avatar');
    expect(fetchSpy.mock.calls.filter(([url]) => url === 'blob:cropped-avatar')).toHaveLength(2);
  });

  it('refreshes the visible profile after saving and reopens the editor with the saved values', async () => {
    const updatedProfile = { ...profileMock.profile, name: 'Updated Name', bio: 'A freshly saved biography.' };
    const update = vi.fn().mockResolvedValue({ data: updatedProfile });
    authMock.value.sdk = { profiles: { update } };
    authMock.value.user = { id: 'profile-123', username: 'public-author' };
    profileMock.refresh.mockImplementation(async () => { profileMock.profile = updatedProfile; });

    const page = render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: updatedProfile.name } });
    fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: updatedProfile.bio } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await within(page.container).findByText(updatedProfile.name)).toBeVisible();
    expect(within(page.container).getByText(updatedProfile.bio)).toBeVisible();
    // RN Web retains a closed fade-out modal until CSS animationend, which
    // jsdom does not emit. Assert visibility rather than DOM removal.
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    expect(screen.getByPlaceholderText('Your name')).toHaveValue(updatedProfile.name);
    expect(screen.getByPlaceholderText('Tell people about yourself')).toHaveValue(updatedProfile.bio);
  });

  it('keeps failed profile edits open and does not refresh away the draft', async () => {
    const update = vi.fn().mockRejectedValue(new Error('Profile update unavailable'));
    authMock.value.sdk = { profiles: { update } };
    authMock.value.user = { id: 'profile-123', username: 'public-author' };

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Keep this name draft  ' } });
    fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: 'Keep this biography draft.' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
    expect(screen.getByPlaceholderText('Your name')).toHaveValue('  Keep this name draft  ');
    expect(screen.getByPlaceholderText('Tell people about yourself')).toHaveValue('Keep this biography draft.');
    expect(profileMock.refresh).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('navigates to a saved new handle without refreshing the obsolete profile route', async () => {
    const update = vi.fn().mockResolvedValue({ data: { ...profileMock.profile, username: 'updated-handle' } });
    authMock.value.sdk = { profiles: { update } };
    authMock.value.user = { id: 'profile-123', username: 'public-author' };

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    const username = screen.getByPlaceholderText('username');
    await user.click(username);
    await user.clear(username);
    await user.type(username, 'updated-handle');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/updated-handle'));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ username: 'updated-handle' }));
    expect(profileMock.refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeVisible();
  });

  it('reports a profile picture picker failure so the owner can retry', async () => {
    authMock.value.sdk = { profiles: {} };
    authMock.value.user = { id: 'profile-123', username: 'public-author' };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: 'public-author',
      bio: '',
    };
    render(
      <ToastProvider>
        <UserProfileScreen />
      </ToastProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));
    const createElement = vi.spyOn(document, 'createElement')
      .mockImplementationOnce(() => { throw new Error('picture picker unavailable'); });

    try {
      await user.click(screen.getByRole('button', { name: 'Change profile picture' }));
    } finally {
      createElement.mockRestore();
    }

    expect(await screen.findByText('Could not open your photo library. Try again.')).toBeInTheDocument();
  });

  it('falls back to the public owner profile when authenticated projections omit the handle', async () => {
    const me = vi.fn().mockResolvedValue({ data: { id: 'profile-123' } });
    authMock.value.sdk = { profiles: { me } };
    authMock.value.user = { id: 'profile-123' };
    profileMock.profile = {
      id: 'profile-123',
      name: 'Profile Owner',
      username: undefined,
      bio: '',
    } as any;
    publicProfilesMock.get.mockResolvedValue({
      data: { id: 'profile-123', username: 'canonical-handle' },
    });
    __setLocalSearchParams({ username: '019d5190-f0c0-717e-a1bd-ef9c335292b9' });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('username')).toHaveValue('canonical-handle');
    });
    expect(me).toHaveBeenCalledTimes(1);
    expect(publicProfilesMock.get).toHaveBeenCalledWith('profile-123');
  });

  it('keeps password-manager autofill overlays off the profile handle editor', async () => {
    authMock.value.sdk = {};
    authMock.value.user = { id: 'profile-123', username: 'public-author' };

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }));

    const usernameInput = screen.getByPlaceholderText('username');
    expect(usernameInput).toHaveAttribute('autocomplete', 'off');
    expect(usernameInput).toHaveAttribute('data-bwignore', 'true');
    expect(usernameInput).toHaveAttribute('data-lpignore', 'true');
    expect(usernameInput).toHaveAttribute('data-form-type', 'other');
    expect(usernameInput).toHaveAttribute('readonly');
    expect(usernameInput).toHaveValue('public-author');

    // A direct DOM property write dispatches no event. The mount shield must
    // still restore React's controlled value after an overlay does this.
    (usernameInput as HTMLInputElement).value = '';
    await waitFor(() => expect(usernameInput).toHaveValue('public-author'));

    // Mount-time autofill races must not erase the existing handle.
    fireEvent.change(usernameInput, { target: { value: '' } });
    expect(usernameInput).toHaveValue('public-author');

    // Explicit user focus removes the shield and ordinary editing still works.
    await user.click(usernameInput);
    await waitFor(() => expect(usernameInput).not.toHaveAttribute('readonly'));
    await user.clear(usernameInput);
    await user.type(usernameInput, 'public-author-2');
    expect(usernameInput).toHaveValue('public-author-2');
  });

  it('lets a signed-out visitor share the public profile before authentication', async () => {
    render(<UserProfileScreen />);

    await user.click(screen.getByRole('button', { name: /^More$/ }));
    expect(screen.getByRole('button', { name: 'Share profile' })).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Share profile' }));
    expect(shareMock).toHaveBeenCalledWith({
      title: 'Public Author on Minds',
      url: `${SITE_URL}/public-author`,
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it('asks for authentication only when the visitor selects safety actions', async () => {
    render(<UserProfileScreen />);

    await user.click(screen.getByRole('button', { name: /^More$/ }));
    await user.click(screen.getByRole('button', { name: 'Sign in to mute, block, or report' }));

    expect(router.push).toHaveBeenCalledWith(
      '/auth/sign-in?auth=otp&returnTo=%2Fpublic-author',
    );
  });

  it('keeps a failed profile report open instead of claiming it was submitted', async () => {
    const createReport = vi.fn().mockRejectedValueOnce(new Error('network unavailable'));
    authMock.value.sdk = { reports: { create: createReport } };
    authMock.value.user = { id: 'viewer-123', username: 'viewer' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('button', { name: /^More$/ }));
    await user.click(screen.getByRole('button', { name: 'Report @public-author' }));
    await user.click(screen.getByText('Spam'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(createReport).toHaveBeenCalledWith({
        target_type: 'user',
        target_id: 'profile-123',
        reason: 'Spam',
      });
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Report Content')).toBeInTheDocument();
    expect(screen.queryByText('Report Submitted')).not.toBeInTheDocument();
  });

  it('returns from OTP to a one-shot DM intent for this profile', async () => {
    render(<UserProfileScreen />);

    await user.click(screen.getByRole('button', { name: 'Message' }));

    expect(router.push).toHaveBeenCalledWith(
      '/auth/sign-in?auth=otp&returnTo=%2Fchat%3FuserId%3Dprofile-123%26focused%3D1',
    );
  });

  it('returns from OTP with a one-shot Follow intent for this profile', async () => {
    render(<UserProfileScreen />);

    await user.click(screen.getByRole('button', { name: 'Follow' }));

    expect(router.push).toHaveBeenCalledWith(
      '/auth/sign-in?auth=otp&returnTo=%2Fpublic-author%3Ffollow%3D1',
    );
  });

  it('consumes the Follow intent once after authentication', async () => {
    const follow = vi.fn().mockResolvedValue(undefined);
    authMock.value.sdk = {
      profiles: {
        follow,
        unfollow: vi.fn(),
        isFollowing: vi.fn().mockResolvedValue({ data: { is_following: false } }),
      },
    };
    authMock.value.user = { id: 'viewer-123', username: 'viewer' };
    __setLocalSearchParams({ username: 'public-author', follow: '1' });

    render(<UserProfileScreen />);

    await waitFor(() => expect(follow).toHaveBeenCalledWith('profile-123'));
    expect(follow).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/public-author');
  });

  it('does not repeat or reverse a Follow the viewer already has', async () => {
    const follow = vi.fn();
    const unfollow = vi.fn();
    const isFollowing = vi.fn().mockResolvedValue({ data: { is_following: true } });
    authMock.value.sdk = { profiles: { follow, unfollow, isFollowing } };
    authMock.value.user = { id: 'viewer-123', username: 'viewer' };
    __setLocalSearchParams({ username: 'public-author', follow: '1' });

    render(<UserProfileScreen />);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/public-author'));
    await waitFor(() => expect(isFollowing).toHaveBeenCalledWith('profile-123'));
    expect(follow).not.toHaveBeenCalled();
    expect(unfollow).not.toHaveBeenCalled();
  });

  it('lets a public visitor load the next follower page without losing the first', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      id: `follower-${index}`,
      username: `first-${index}`,
      name: `First follower ${index}`,
    }));
    publicProfilesMock.followers
      .mockResolvedValueOnce({ data: firstPage, meta: { has_more: true } })
      .mockResolvedValueOnce({
        data: [
          firstPage[49],
          { id: 'follower-50', username: 'next-follower', name: 'Next follower' },
        ],
        meta: { has_more: false },
      });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('tab', { name: 'Followers' }));

    await waitFor(() => expect(screen.getByText('First follower 0')).toBeInTheDocument());
    expect(publicProfilesMock.followers).toHaveBeenNthCalledWith(
      1,
      'profile-123',
      { limit: 50, offset: 0 },
    );

    await user.click(screen.getByRole('button', { name: 'Load more followers' }));

    await waitFor(() => expect(screen.getByText('Next follower')).toBeInTheDocument());
    expect(screen.getByText('First follower 0')).toBeInTheDocument();
    expect(screen.getAllByText('First follower 49')).toHaveLength(1);
    expect(publicProfilesMock.followers).toHaveBeenNthCalledWith(
      2,
      'profile-123',
      { limit: 50, offset: 50 },
    );
    expect(screen.queryByRole('button', { name: 'Load more followers' })).not.toBeInTheDocument();
  });

  it('paginates the public following list through the same offset contract', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => ({
      id: `following-${index}`,
      username: `following-${index}`,
      name: `Following ${index}`,
    }));
    publicProfilesMock.following
      .mockResolvedValueOnce({ data: firstPage, meta: { has_more: true } })
      .mockResolvedValueOnce({
        data: [{ id: 'following-50', username: 'following-next', name: 'Following next' }],
        meta: { has_more: false },
      });

    render(<UserProfileScreen />);
    await user.click(screen.getByRole('tab', { name: 'Following' }));
    await waitFor(() => expect(screen.getByText('Following 0')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Load more following' }));

    await waitFor(() => expect(screen.getByText('Following next')).toBeInTheDocument());
    expect(publicProfilesMock.following).toHaveBeenNthCalledWith(
      2,
      'profile-123',
      { limit: 50, offset: 50 },
    );
  });
});
