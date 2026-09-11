import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { router } from 'expo-router';
import { __setLocalSearchParams } from '../component-stubs/expo-router';

const authMock = vi.hoisted(() => ({
  value: {
    sdk: null as any,
    user: { id: 'owner-1' } as any,
  },
}));

vi.mock('../../lib/auth', () => ({ useAuth: () => authMock.value }));

import ManageCommunityScreen from '../../app/community/manage/[id]';

describe('community deletion', () => {
  const remove = vi.fn();
  const get = vi.fn();
  const members = vi.fn();
  const requests = vi.fn();
  const bans = vi.fn();

  beforeEach(() => {
    remove.mockReset();
    get.mockReset().mockResolvedValue({
      data: {
        id: 'community-1',
        name: 'Test group',
        description: '',
        privacy: 'public',
        viewer_role: 'owner',
        member_count: 1,
      },
    });
    members.mockReset().mockResolvedValue({ data: [] });
    requests.mockReset().mockResolvedValue({ data: [] });
    bans.mockReset().mockResolvedValue({ data: [] });
    __setLocalSearchParams({ id: 'community-1' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    authMock.value.sdk = {
      communities: {
        get,
        members,
        requests,
        bans,
        delete: remove,
      },
      posts: { client: {} },
    };
  });

  it('stays on the management screen when deletion fails', async () => {
    remove.mockRejectedValue(new Error('Delete failed'));
    render(<ManageCommunityScreen />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete group' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith('community-1'));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('returns to groups after deletion succeeds', async () => {
    remove.mockResolvedValue({ data: { success: true } });
    render(<ManageCommunityScreen />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete group' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/groups'));
  });

  it('explains a partial create and points the owner at the picture retry control', async () => {
    __setLocalSearchParams({ id: 'community-1', pictureUploadFailed: '1' });
    render(<ManageCommunityScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your group was created, but its picture could not be added.',
    );
    expect(screen.getByRole('button', { name: 'Change the group picture' })).toBeInTheDocument();
  });

  it('lets an owner retry a failed management lookup instead of denying access', async () => {
    get.mockRejectedValueOnce(new TypeError('offline'));
    render(<ManageCommunityScreen />);

    expect(await screen.findByText("Couldn't load group management")).toBeInTheDocument();
    expect(screen.queryByText('Only the people who run this group can open this page')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Manage Test group')).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not turn failed management lists into empty moderation queues', async () => {
    members.mockRejectedValue(new TypeError('offline'));
    requests.mockRejectedValue(new TypeError('offline'));
    bans.mockRejectedValue(new TypeError('offline'));
    render(<ManageCommunityScreen />);

    expect(await screen.findByText('Members are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Join requests are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Banned people are unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('No members loaded.')).not.toBeInTheDocument();
  });
});
