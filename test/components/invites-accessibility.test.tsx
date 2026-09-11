import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inviteApi = vi.hoisted(() => ({
  generate: vi.fn(),
  leaderboard: vi.fn(),
  myCodes: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('../../lib/auth', () => {
  const sdk = {
    inviteCodes: {
      generate: inviteApi.generate,
      leaderboard: inviteApi.leaderboard,
      myCodes: inviteApi.myCodes,
    },
  };

  return { useAuth: () => ({ sdk }) };
});

import InvitesScreen from '../../app/invites';
import { SITE_URL } from '../../lib/recursiv';

describe('Invites accessibility', () => {
  beforeEach(() => {
    inviteApi.generate.mockReset();
    inviteApi.writeText.mockReset();
    inviteApi.myCodes.mockReset();
    inviteApi.leaderboard.mockReset();
    inviteApi.myCodes.mockResolvedValue({ data: { codes: [{ code: 'MINDS-TEST-CODE', status: 'active' }] } });
    inviteApi.leaderboard.mockResolvedValue({ data: [] });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: inviteApi.writeText },
    });
  });

  it('copies a complete signup link instead of an unusable bare code', async () => {
    render(<InvitesScreen />);

    const copy = await screen.findByRole('button', { name: 'Copy invite link for MINDS-TEST-CODE' });
    await userEvent.click(copy);

    expect(inviteApi.writeText).toHaveBeenCalledWith(`${SITE_URL}/?ref=MINDS-TEST-CODE`);
    expect(screen.getByRole('button', { name: 'Invite link for MINDS-TEST-CODE copied' }))
      .toBeInTheDocument();
    expect(inviteApi.generate).not.toHaveBeenCalled();
  });

  it('shows invite outages honestly and retries both sources', async () => {
    inviteApi.myCodes
      .mockRejectedValueOnce(new Error('codes unavailable'))
      .mockResolvedValueOnce({ data: { codes: [] } });
    inviteApi.leaderboard
      .mockRejectedValueOnce(new Error('leaderboard unavailable'))
      .mockResolvedValueOnce({ data: [] });

    render(<InvitesScreen />);

    expect(await screen.findByText('Invite codes are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Invite leaderboard is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('No invite codes yet. Generate one to invite friends.')).not.toBeInTheDocument();
    expect(screen.queryByText('No leaderboard data yet.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry invite data' }));

    expect(await screen.findByText('No invite codes yet. Generate one to invite friends.')).toBeInTheDocument();
    expect(screen.getByText('No leaderboard data yet.')).toBeInTheDocument();
    expect(screen.queryByText('Invite codes are unavailable.')).not.toBeInTheDocument();
    expect(screen.queryByText('Invite leaderboard is unavailable.')).not.toBeInTheDocument();
    expect(inviteApi.myCodes).toHaveBeenCalledTimes(2);
    expect(inviteApi.leaderboard).toHaveBeenCalledTimes(2);
  });

  it('keeps available invite codes visible when only the leaderboard fails', async () => {
    inviteApi.leaderboard.mockRejectedValue(new Error('leaderboard unavailable'));

    render(<InvitesScreen />);

    expect(await screen.findByText('MINDS-TEST-CODE')).toBeInTheDocument();
    expect(screen.getByText('Invite leaderboard is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('No leaderboard data yet.')).not.toBeInTheDocument();
  });

  it('preserves existing codes when refreshing after generation fails', async () => {
    inviteApi.generate.mockResolvedValue({ data: {} });
    inviteApi.myCodes
      .mockResolvedValueOnce({ data: { codes: [{ code: 'MINDS-TEST-CODE', status: 'active' }] } })
      .mockRejectedValueOnce(new Error('codes unavailable'));

    render(<InvitesScreen />);
    expect(await screen.findByText('MINDS-TEST-CODE')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Generate Code' }));

    expect(await screen.findByText('Invite codes are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('MINDS-TEST-CODE')).toBeInTheDocument();
    expect(screen.queryByText('No invite codes yet. Generate one to invite friends.')).not.toBeInTheDocument();
  });
});
