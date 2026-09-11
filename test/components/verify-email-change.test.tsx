import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();
const verifyMock = vi.fn();
const refreshUserMock = vi.fn();
const paramsMock = { value: { token: 'valid-token' } };

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useLocalSearchParams: () => paramsMock.value,
}));

vi.mock('expo-linking', () => ({ useURL: () => null }));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: () => <span /> }));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({ surface: '#111', border: '#222', textSecondary: '#aaa', success: 'green', error: 'red', accent: 'gold' }),
}));
vi.mock('../../components/Container', () => ({ Container: ({ children }: any) => <div>{children}</div> }));
vi.mock('../../components', () => ({
  Text: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, onPress }: any) => <button type="button" onClick={onPress}>{children}</button>,
}));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: { settings: { verifyEmailChange: verifyMock } },
    user: { id: 'user-1' },
    refreshUser: refreshUserMock,
  }),
}));

import VerifyEmailChangeScreen from '../../app/verify-email-change';

describe('email change confirmation screen', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    verifyMock.mockReset();
    refreshUserMock.mockReset();
    paramsMock.value = { token: 'valid-token' };
  });

  it('verifies once, refreshes the account, and returns to settings', async () => {
    verifyMock.mockResolvedValue({ data: { success: true, new_email: 'new@example.com' } });
    refreshUserMock.mockResolvedValue(undefined);
    render(<VerifyEmailChangeScreen />);

    expect(screen.getByText('Confirming your email')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Email updated')).toBeTruthy());
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith('valid-token');
    expect(refreshUserMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Your email is now new@example.com.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Back to settings' }));
    expect(replaceMock).toHaveBeenCalledWith('/settings');
  });

  it('shows an actionable expired-link error without retrying automatically', async () => {
    verifyMock.mockRejectedValue(new Error('Invalid or expired verification token.'));
    render(<VerifyEmailChangeScreen />);

    await waitFor(() => expect(screen.getByText('Could not update email')).toBeTruthy());
    expect(screen.getByText('Invalid or expired verification token.')).toBeTruthy();
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(refreshUserMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Request a new link' })).toBeTruthy();
  });
});
