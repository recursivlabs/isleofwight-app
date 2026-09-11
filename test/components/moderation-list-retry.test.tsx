import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const moderation = vi.hoisted(() => ({
  getBlockedUsers: vi.fn(),
  getMutedUsers: vi.fn(),
  unblockUser: vi.fn(),
  unmuteUser: vi.fn(),
}));

vi.mock('../../lib/moderation', () => moderation);

import BlockedScreen from '../../app/blocked';
import MutedScreen from '../../app/muted';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('moderation list retry', () => {
  it.each([
    ['blocked', BlockedScreen, moderation.getBlockedUsers, 'Blocked Person'],
    ['muted', MutedScreen, moderation.getMutedUsers, 'Muted Person'],
  ])('lets the user retry a failed %s list load in place', async (_kind, ListScreen, getUsers, name) => {
    getUsers
      .mockResolvedValueOnce({ data: [], hasMore: false, error: true })
      .mockResolvedValueOnce({
        data: [{ id: 'person-1', name, username: 'person', image: null }],
        hasMore: false,
      });

    render(<ListScreen />);

    expect(await screen.findByText("Couldn't load")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(name)).toBeInTheDocument();
  });
});
