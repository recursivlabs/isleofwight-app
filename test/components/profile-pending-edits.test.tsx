import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { __setLocalSearchParams, router } from '../component-stubs/expo-router';

const mocks = vi.hoisted(() => ({
  profile: { id: 'profile-123', name: 'Profile Owner', username: 'profile-owner', bio: 'Original biography' },
  update: vi.fn(),
  refresh: vi.fn(),
  refreshUser: vi.fn(),
  cropper: null as null | { uri?: string | null; onDone: (result: { uri: string }) => void },
}));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: { profiles: { update: mocks.update } },
    user: { id: mocks.profile.id, username: 'profile-owner' },
    refreshUser: mocks.refreshUser,
  }),
}));
vi.mock('../../components/FeedSidebar', () => ({ FeedSidebar: () => null }));
vi.mock('../../components/ImageCropper', () => ({
  ImageCropper: (props: { uri?: string | null; onDone: (result: { uri: string }) => void }) => {
    mocks.cropper = props;
    return props.uri ? <button onClick={() => props.onDone({ uri: 'blob:finished-crop' })}>Finish profile crop</button> : null;
  },
  CROP_AVATAR: { width: 512, height: 512 },
}));
vi.mock('../../lib/hooks', () => ({
  useProfile: () => ({ profile: mocks.profile, loading: false, error: null, refresh: mocks.refresh }),
  useMyProfile: () => ({ refresh: vi.fn() }),
  useCommunities: () => ({ communities: [] }),
  useConversations: () => ({ conversations: [] }),
  useProfilePosts: () => ({ posts: [], loading: false, error: null, hasMore: false, refresh: vi.fn(), loadMore: vi.fn() }),
}));
vi.mock('../../lib/moderation', () => ({
  getFollowRelationship: () => Promise.resolve({ follows_you: false }),
  getBlockedUsers: () => Promise.resolve({ data: [], error: false }),
  getMutedUsers: () => Promise.resolve({ data: [], error: false }),
  blockUser: vi.fn(), unblockUser: vi.fn(), muteUser: vi.fn(), unmuteUser: vi.fn(),
}));

import UserProfileScreen from '../../app/user/[username]';

const originalCreateObjectURL = URL.createObjectURL;

beforeEach(() => {
  mocks.profile = { id: 'profile-123', name: 'Profile Owner', username: 'profile-owner', bio: 'Original biography' };
  mocks.update.mockReset();
  mocks.refresh.mockReset();
  mocks.refreshUser.mockReset();
  mocks.cropper = null;
  __setLocalSearchParams({ username: 'profile-owner' });
});

afterEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectURL });
});

async function beginSave(changeFields = true, newUsername?: string) {
  let resolveSave!: (value: { data: typeof mocks.profile }) => void;
  let rejectSave!: (reason: Error) => void;
  mocks.update.mockReturnValue(new Promise((resolve, reject) => { resolveSave = resolve; rejectSave = reject; }));
  const accepted = changeFields
    ? { ...mocks.profile, name: 'Submitted name', bio: 'Submitted biography' }
    : { ...mocks.profile };
  if (newUsername) accepted.username = newUsername;
  mocks.refresh.mockImplementation(async () => { mocks.profile = accepted; });
  const view = render(<UserProfileScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: accepted.name } });
  fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: accepted.bio } });
  if (newUsername) {
    // A genuine user focus unlocks the mount-time username autofill shield.
    fireEvent.focus(screen.getByPlaceholderText('username'));
    fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: newUsername } });
  }
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ name: accepted.name, bio: accepted.bio }));
  if (newUsername) expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ username: newUsername }));
  return {
    accept: async () => { await act(async () => { resolveSave({ data: accepted }); }); },
    reject: async (reason: Error) => { await act(async () => { rejectSave(reason); }); },
    unmount: view.unmount,
  };
}

it('keeps newer profile name and biography edits open when an earlier save succeeds', async () => {
  const { accept } = await beginSave();

  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Newer unsaved name  ' } });
  fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: 'Newer unsaved biography' } });
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('  Newer unsaved name  ');
  expect(screen.getByPlaceholderText('Tell people about yourself')).toHaveValue('Newer unsaved biography');
  await accept();

  expect(screen.queryByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('  Newer unsaved name  ');
  expect(screen.getByPlaceholderText('Tell people about yourself')).toHaveValue('Newer unsaved biography');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(router.replace).not.toHaveBeenCalled();
});

it('preserves newer edits on a UUID profile route when the canonical handle was not changed', async () => {
  mocks.profile.id = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
  __setLocalSearchParams({ username: mocks.profile.id });
  const { accept } = await beginSave();
  expect(screen.getByPlaceholderText('username')).toHaveValue('profile-owner');
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ username: 'profile-owner' }));
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Newer UUID-route name  ' } });
  fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: 'Newer UUID-route biography' } });

  await accept();

  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('  Newer UUID-route name  ');
  expect(screen.getByPlaceholderText('Tell people about yourself')).toHaveValue('Newer UUID-route biography');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(router.replace).not.toHaveBeenCalled();
});

it('still closes and canonicalizes an unchanged successful editor on a UUID profile route', async () => {
  mocks.profile.id = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
  __setLocalSearchParams({ username: mocks.profile.id });
  const { accept } = await beginSave();
  expect(screen.getByPlaceholderText('username')).toHaveValue('profile-owner');

  await accept();

  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/profile-owner');
});

it('preserves newer text after a real rename and canonicalizes only when the author then cancels', async () => {
  const { accept } = await beginSave(true, 'renamed-profile');
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  New work after rename submission  ' } });
  fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: 'New biography after rename submission' } });

  await accept();

  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('  New work after rename submission  ');
  expect(screen.getByPlaceholderText('Tell people about yourself')).toHaveValue('New biography after rename submission');
  expect(router.replace).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');
});

it('saves newer edits after an accepted rename without refreshing the obsolete handle route', async () => {
  const { accept } = await beginSave(true, 'renamed-profile');
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Save this next name  ' } });
  fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: '  Save this next biography  ' } });

  await accept();

  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(screen.getByPlaceholderText('username')).toHaveValue('renamed-profile');
  expect(router.replace).not.toHaveBeenCalled();
  mocks.update.mockResolvedValueOnce({ data: { ...mocks.profile, username: 'renamed-profile', name: 'Save this next name', bio: 'Save this next biography' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
    username: 'renamed-profile', name: 'Save this next name', bio: 'Save this next biography',
  }));
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');
});

it('retains the accepted canonical route when a later save omits an emptied username', async () => {
  const { accept } = await beginSave(true, 'renamed-profile');
  fireEvent.change(screen.getByPlaceholderText('Tell people about yourself'), { target: { value: 'A newer biography to save' } });
  await accept();
  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  fireEvent.focus(screen.getByPlaceholderText('username'));
  fireEvent.change(screen.getByPlaceholderText('username'), { target: { value: '' } });
  expect(screen.getByPlaceholderText('username')).toHaveValue('');
  mocks.update.mockResolvedValueOnce({ data: { ...mocks.profile, username: 'renamed-profile', bio: 'A newer biography to save' } });

  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({
    username: undefined, bio: 'A newer biography to save',
  }));
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');
});

it('consumes a renamed canonical route only once when Cancel occurs during delayed identity refresh', async () => {
  const { accept } = await beginSave(true, 'renamed-profile');
  let finishRefresh!: () => void;
  mocks.refreshUser.mockReturnValueOnce(new Promise<void>((resolve) => { finishRefresh = resolve; }));

  await accept();
  expect(mocks.refreshUser).toHaveBeenCalledOnce();
  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');

  await act(async () => { finishRefresh(); });

  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it('does not redirect from an unmounted editor when an earlier rename is accepted', async () => {
  const { accept, unmount } = await beginSave(true, 'renamed-profile');
  unmount();

  await accept();

  expect(router.replace).not.toHaveBeenCalled();
  expect(mocks.refreshUser).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it('canonicalizes an accepted real rename if Cancel already closed the editor and it stayed closed', async () => {
  const { accept } = await beginSave(true, 'renamed-profile');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).not.toHaveBeenCalled();

  await accept();

  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it('preserves a reopened editor after an earlier real rename and canonicalizes on its explicit close', async () => {
  const { accept } = await beginSave(true, 'renamed-profile');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Reopened editor work' } });

  await accept();

  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('Reopened editor work');
  expect(router.replace).not.toHaveBeenCalled();
  expect(mocks.refresh).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(router.replace).toHaveBeenCalledExactlyOnceWith('/renamed-profile');
});

it('keeps a newer avatar draft visible when the earlier name and biography save succeeds', async () => {
  const { accept } = await beginSave();
  expect(mocks.cropper).not.toBeNull();
  act(() => { mocks.cropper!.onDone({ uri: 'blob:newer-avatar' }); });
  const avatar = () => screen.getByRole('button', { name: 'Change profile picture' }).querySelector('img');
  expect(avatar()).toHaveAttribute('src', 'blob:newer-avatar');

  await accept();

  expect(screen.getByRole('button', { name: 'Change profile picture' })).toBeVisible();
  expect(avatar()).toHaveAttribute('src', 'blob:newer-avatar');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(router.replace).not.toHaveBeenCalled();
});

it('does not close a reopened editor session when an older unchanged-handle save succeeds', async () => {
  const { accept } = await beginSave(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  // Identical values still belong to a new editor session after Cancel.
  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('Profile Owner');

  await accept();

  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('Profile Owner');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(router.replace).not.toHaveBeenCalled();
});

it('still closes an unchanged successful save and shows its refreshed profile', async () => {
  const { accept } = await beginSave();

  await accept();

  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
  expect(screen.getByText('Submitted name')).toBeVisible();
  expect(mocks.refresh).toHaveBeenCalledOnce();
  expect(router.replace).not.toHaveBeenCalled();
});

it('keeps failed edits visible and allows a successful retry', async () => {
  const { reject } = await beginSave();
  fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: '  Retry this newer name  ' } });

  await reject(new Error('Profile update unavailable'));

  expect(screen.getByPlaceholderText('Your name')).toBeVisible();
  expect(screen.getByPlaceholderText('Your name')).toHaveValue('  Retry this newer name  ');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  mocks.update.mockResolvedValueOnce({ data: { ...mocks.profile, name: 'Retry this newer name' } });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); });

  expect(mocks.update).toHaveBeenCalledTimes(2);
  expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'Retry this newer name' }));
  expect(screen.getByPlaceholderText('Your name')).not.toBeVisible();
});

it('keeps the editor available for a new crop that was started while an earlier save was pending', async () => {
  const { accept } = await beginSave();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:pending-crop') });
  const createElement = document.createElement.bind(document);
  let pickerInput: HTMLInputElement | undefined;
  const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const element = createElement(tag, options);
    if (tag === 'input') pickerInput = element as HTMLInputElement;
    return element;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change profile picture' }));
  createSpy.mockRestore();
  expect(pickerInput).toBeDefined();
  fireEvent.change(pickerInput!, { target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] } });
  expect(screen.getByRole('button', { name: 'Finish profile crop' })).toBeVisible();

  await accept();
  fireEvent.click(screen.getByRole('button', { name: 'Finish profile crop' }));

  expect(screen.getByRole('button', { name: 'Save' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Change profile picture' }).querySelector('img')).toHaveAttribute('src', 'blob:finished-crop');
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(router.replace).not.toHaveBeenCalled();
});
