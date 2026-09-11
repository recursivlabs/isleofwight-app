import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const authMock = vi.hoisted(() => ({
  value: {
    sdk: null as any,
    user: null as any,
  },
}));

vi.mock('../../lib/auth', () => ({ useAuth: () => authMock.value }));

import BillingScreen from '../../app/billing';

describe('consumer subscription billing', () => {
  const status = vi.fn();
  const createPortalSession = vi.fn();
  const platformStatus = vi.fn();
  const platformUsage = vi.fn();

  beforeEach(() => {
    status.mockReset();
    createPortalSession.mockReset();
    platformStatus.mockReset();
    platformUsage.mockReset();
    authMock.value.user = { id: 'viewer-1', plus: false, pro: false };
    authMock.value.sdk = {
      appSubscriptions: { status, createPortalSession },
      billing: { getStatus: platformStatus, getUsage: platformUsage },
    };
  });

  it('shows the current app-user plan without querying organization billing', async () => {
    status.mockResolvedValue({
      data: {
        tier: 'pro',
        status: 'active',
        active: true,
        currentPeriodEnd: '2026-09-30T00:00:00.000Z',
      },
    });

    render(<BillingScreen />);

    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage subscription' })).toBeInTheDocument();
    expect(platformStatus).not.toHaveBeenCalled();
    expect(platformUsage).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: /Upgrade to/ })).not.toBeInTheDocument();
  });

  it('preserves lifetime or imported account entitlements when no managed subscription exists', async () => {
    authMock.value.user = { id: 'viewer-1', plus: false, pro: true };
    status.mockResolvedValue({
      data: { tier: 'free', status: 'none', active: false, currentPeriodEnd: null },
    });

    render(<BillingScreen />);

    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());
    expect(screen.getByText('Your Pro access is attached to this Minds account.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage subscription' })).not.toBeInTheDocument();
  });

  it('offers a real retry instead of claiming billing is coming soon', async () => {
    status
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce({
        data: { tier: 'free', status: 'none', active: false, currentPeriodEnd: null },
      });

    render(<BillingScreen />);

    await waitFor(() => expect(screen.getByText('Couldn’t load your subscription')).toBeInTheDocument());
    expect(screen.queryByText('Billing coming soon')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View Plus and Pro plans' })).toHaveAttribute(
      'href',
      '/upgrade',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByText('Free')).toBeInTheDocument());
    expect(status).toHaveBeenCalledTimes(2);
  });

  it('makes the free-plan upgrade path a real web link', async () => {
    status.mockResolvedValue({
      data: { tier: 'free', status: 'none', active: false, currentPeriodEnd: null },
    });

    render(<BillingScreen />);

    const link = await screen.findByRole('link', { name: 'Upgrade to Plus or Pro' });
    expect(link).toHaveAttribute('href', '/upgrade');
  });
});
