import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';

const authMock = vi.hoisted(() => ({
  user: null as null | { id: string; plus?: boolean; pro?: boolean },
  sdk: null as any,
}));

const checkoutMock = vi.hoisted(() => ({
  openCheckout: vi.fn(async () => {}),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: authMock.user, sdk: authMock.sdk }),
}));

vi.mock('../../lib/subscription', () => ({
  openCheckout: checkoutMock.openCheckout,
}));

import UpgradeScreen from '../../app/upgrade';

describe('upgrade authentication handoff', () => {
  beforeEach(() => {
    authMock.user = null;
    authMock.sdk = null;
    checkoutMock.openCheckout.mockClear();
    vi.mocked(router.push).mockClear();
  });

  it.each([
    ['Get Plus', 'plus'],
    ['Get Pro', 'pro'],
  ] as const)('sends signed-out %s intent through authentication', async (label, tier) => {
    render(<UpgradeScreen />);
    await userEvent.click(screen.getByRole('button', { name: label }));

    expect(checkoutMock.openCheckout).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      `/auth/sign-in?auth=otp&returnTo=%2Fupgrade%3Ftier%3D${tier}`,
    );
  });

  it('starts checkout directly for an authenticated account', async () => {
    authMock.user = { id: 'viewer-1' };
    authMock.sdk = { appSubscriptions: {} };
    render(<UpgradeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Get Plus' }));

    expect(router.push).not.toHaveBeenCalled();
    expect(checkoutMock.openCheckout).toHaveBeenCalledWith(authMock.sdk, 'plus');
  });

  it('routes the current paid plan to billing without offering a lower-tier checkout', async () => {
    authMock.user = { id: 'viewer-1', pro: true };
    authMock.sdk = { appSubscriptions: {} };
    render(<UpgradeScreen />);

    expect(screen.queryByText(/Cancel anytime/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get Plus' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Included with Pro' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'View billing' }));

    expect(router.push).toHaveBeenCalledWith('/billing');
    expect(checkoutMock.openCheckout).not.toHaveBeenCalled();
  });

  it('keeps the higher tier available to a Plus member', async () => {
    authMock.user = { id: 'viewer-1', plus: true };
    authMock.sdk = { appSubscriptions: {} };
    render(<UpgradeScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'Get Pro' }));

    expect(checkoutMock.openCheckout).toHaveBeenCalledWith(authMock.sdk, 'pro');
  });

  it('exposes and activates the back control', async () => {
    render(<UpgradeScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
