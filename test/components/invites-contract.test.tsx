import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inviteApi = vi.hoisted(() => ({
  generate: vi.fn(),
  leaderboard: vi.fn(),
  myCodes: vi.fn(),
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

// GET /invite-codes/my-codes speaks status: 'active' | 'used' | 'expired' —
// there is no `used`/`redeemed` boolean. GET /invite-codes/leaderboard entries
// speak user_id / user_name / username / total_invited — not name / count /
// invites. These tests mock exactly what the engine serializes
// (recursiv:packages/server/src/features/api-keys/rest/routes/invite-codes.ts).
describe('Invites contract', () => {
  beforeEach(() => {
    inviteApi.generate.mockReset();
    inviteApi.myCodes.mockReset();
    inviteApi.leaderboard.mockReset();
    inviteApi.leaderboard.mockResolvedValue({ data: [] });
  });

  it('marks a used code Used and stops offering its share action', async () => {
    inviteApi.myCodes.mockResolvedValue({
      data: {
        codes: [
          { id: 'c1', code: 'MINDS-USED-CODE', status: 'used', used_at: '2026-09-01T00:00:00Z' },
          { id: 'c2', code: 'MINDS-LIVE-CODE', status: 'active', used_at: null },
        ],
        active_count: 1,
        can_generate: 3,
      },
    });

    render(<InvitesScreen />);

    expect(await screen.findByText('MINDS-USED-CODE')).toBeInTheDocument();
    expect(screen.getByText('Used')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite link for MINDS-USED-CODE/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invite link for MINDS-LIVE-CODE/ })).toBeInTheDocument();
  });

  it('marks an expired code Expired and stops offering its share action', async () => {
    inviteApi.myCodes.mockResolvedValue({
      data: {
        codes: [{ id: 'c3', code: 'MINDS-OLD-CODE', status: 'expired', used_at: null }],
        active_count: 0,
        can_generate: 0,
      },
    });

    render(<InvitesScreen />);

    expect(await screen.findByText('MINDS-OLD-CODE')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /invite link for MINDS-OLD-CODE/ })).not.toBeInTheDocument();
  });

  it('renders leaderboard display names and real invite counts', async () => {
    inviteApi.myCodes.mockResolvedValue({ data: { codes: [], active_count: 0, can_generate: 0 } });
    inviteApi.leaderboard.mockResolvedValue({
      data: [
        { user_id: 'u1', user_name: 'Alice Smith', username: 'alice', user_image: null, total_invited: 7, total_codes: 10 },
        { user_id: 'u2', user_name: 'Bob Jones', username: 'bob', user_image: null, total_invited: 3, total_codes: 5 },
      ],
    });

    render(<InvitesScreen />);

    expect(await screen.findByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('falls back to the username when an entry has no display name', async () => {
    inviteApi.myCodes.mockResolvedValue({ data: { codes: [], active_count: 0, can_generate: 0 } });
    inviteApi.leaderboard.mockResolvedValue({
      data: [{ user_id: 'u9', user_name: '', username: 'quietfox', user_image: null, total_invited: 1, total_codes: 2 }],
    });

    render(<InvitesScreen />);

    expect(await screen.findByText('quietfox')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});
