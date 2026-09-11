import type * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  setThemeMode: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: ({ children, accessibilityRole, accessibilityLabel }: any) => (
    <div role={accessibilityRole} aria-label={accessibilityLabel}>{children}</div>
  ),
  ScrollView: ({ children }: any) => <div>{children}</div>,
  Pressable: ({
    children,
    onPress,
    accessibilityRole,
    accessibilityLabel,
    accessibilityState,
    style: _style,
    hitSlop: _hitSlop,
    ...props
  }: any) => (
    <button
      type="button"
      onClick={onPress}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-checked={props['aria-checked'] ?? accessibilityState?.checked}
      aria-expanded={props['aria-expanded'] ?? accessibilityState?.expanded}
      aria-selected={props['aria-selected']}
    >
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </button>
  ),
  Platform: { OS: 'web' },
  Linking: { openURL: vi.fn() },
  useWindowDimensions: () => ({ width: 1200, height: 900 }),
}));

vi.mock('@expo/vector-icons/Ionicons', () => ({
  default: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}));

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '2.0.1' } } }));
vi.mock('expo-router', () => ({
  Redirect: () => null,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onPress, disabled, loading }: any) => (
    <button type="button" onClick={onPress} disabled={disabled || loading}>{children}</button>
  ),
  Input: ({ placeholder }: any) => <input placeholder={placeholder} />,
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Avatar: () => null,
  Skeleton: () => null,
}));

vi.mock('../../components/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../../components/Container', () => ({ Container: ({ children }: any) => <main>{children}</main> }));
vi.mock('../../components/ScreenHeader', () => ({ ScreenHeader: () => null }));
vi.mock('../../components/TotpQrCode', () => ({ TotpQrCode: () => null }));
vi.mock('../../lib/auth', () => ({
  useAuth: mocks.useAuth,
}));
vi.mock('../../lib/recursiv', () => ({
  BASE_ORIGIN: '',
  BASE_URL: '',
  SITE_URL: 'https://minds.on.minds.io',
}));
vi.mock('../../lib/storage', () => ({ getItem: vi.fn(async () => null) }));
vi.mock('../../lib/preferences', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../lib/theme', () => ({
  useTheme: () => ({ mode: 'system', setMode: mocks.setThemeMode, colors: {} }),
  useColors: () => ({
    accent: '#d4a844',
    borderSubtle: '#333',
    error: '#f66',
    glass: '#222',
    text: '#fff',
    textMuted: '#aaa',
    textOnAccent: '#111',
  }),
}));
vi.mock('../../lib/support', () => ({ openSupportConversation: vi.fn() }));
vi.mock('../../lib/accountExport', () => ({ saveAccountExport: vi.fn() }));
vi.mock('../../lib/accountDeletion', () => ({
  deletionRequest: vi.fn(),
  deletionRequiresPassword: vi.fn(),
}));

import SettingsScreen, { SettingRow, Toggle } from '../../app/settings';

beforeEach(() => {
  mocks.useAuth.mockReturnValue({
    isLoading: false,
    sdk: undefined,
    signOut: vi.fn(),
    signOutEverywhere: vi.fn(),
    user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
  });
});

describe('Settings control accessibility', () => {
  it('exposes actionable rows as named buttons with their expansion state', async () => {
    const onPress = vi.fn();
    const { rerender } = render(
      <SettingRow label="Change password" expanded={false} onPress={onPress} />,
    );

    const collapsed = screen.getByRole('button', { name: 'Change password' });
    expect(collapsed).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(collapsed);
    expect(onPress).toHaveBeenCalledOnce();

    rerender(<SettingRow label="Change password" expanded onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Change password' }))
      .toHaveAttribute('aria-expanded', 'true');
  });

  it('does not invent button semantics for read-only rows', () => {
    render(<SettingRow label="Email" value="member@example.com" />);

    expect(screen.queryByRole('button', { name: 'Email' })).not.toBeInTheDocument();
    expect(screen.getByText('member@example.com')).toBeInTheDocument();
  });

  it('gives custom switches a stable name and checked state', async () => {
    const onValueChange = vi.fn();
    render(<Toggle label="Public profile" value onValueChange={onValueChange} />);

    const toggle = screen.getByRole('switch', { name: 'Public profile' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('exposes the selected category state on web tabs', async () => {
    render(<SettingsScreen />);

    const account = await screen.findByRole('tab', { name: 'Account' });
    const privacy = screen.getByRole('tab', { name: 'Privacy' });
    expect(account).toHaveAttribute('aria-selected', 'true');
    expect(privacy).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(privacy);
    expect(account).toHaveAttribute('aria-selected', 'false');
    expect(privacy).toHaveAttribute('aria-selected', 'true');
  });

  it('lets an OTP-only member request a password setup link', async () => {
    const forgetPassword = vi.fn().mockResolvedValue({ success: true });
    const sdk = {
      auth: { forgetPassword },
      settings: {
        getPreferences: vi.fn().mockResolvedValue(null),
        listSessions: vi.fn().mockResolvedValue([]),
        getLoginHistory: vi.fn().mockResolvedValue([]),
        getDeletionStatus: vi.fn().mockResolvedValue(null),
      },
    };
    mocks.useAuth.mockReturnValue({
      isLoading: false,
      sdk,
      signOut: vi.fn(),
      signOutEverywhere: vi.fn(),
      user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
    });

    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: /^Change password$/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Email me a password setup link' }));

    expect(forgetPassword).toHaveBeenCalledWith({
      email: 'member@example.com',
      redirectTo: 'https://minds.on.minds.io/reset-password#recursiv-password-reset=fragment-v1',
    });
    expect(await screen.findByText('Check member@example.com for a secure link to set your password.'))
      .toBeInTheDocument();
  });

  it('offers a real sign-out-everywhere action even when no browser sessions are listed', async () => {
    const signOutEverywhere = vi.fn().mockResolvedValue(undefined);
    const sdk = {
      settings: {
        getPreferences: vi.fn().mockResolvedValue(null),
        listSessions: vi.fn().mockResolvedValue([]),
        getLoginHistory: vi.fn().mockResolvedValue([]),
        getDeletionStatus: vi.fn().mockResolvedValue(null),
      },
    };
    mocks.useAuth.mockReturnValue({
      isLoading: false,
      sdk,
      signOut: vi.fn(),
      signOutEverywhere,
      user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
    });

    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Security' }));
    const action = await screen.findByRole('button', { name: 'Sign out everywhere' });
    expect(screen.getByText('No browser sessions. App access may still be active on other devices.'))
      .toBeInTheDocument();
    await userEvent.click(action);

    expect(signOutEverywhere).toHaveBeenCalledOnce();
  });

  it('shows retryable security-data outages instead of claiming the account is clean', async () => {
    const listSessions = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ data: [] });
    const getLoginHistory = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ data: [] });
    const sdk = {
      settings: {
        getPreferences: vi.fn().mockResolvedValue(null),
        listSessions,
        getLoginHistory,
        getDeletionStatus: vi.fn().mockResolvedValue(null),
      },
    };
    mocks.useAuth.mockReturnValue({
      isLoading: false,
      sdk,
      signOut: vi.fn(),
      signOutEverywhere: vi.fn(),
      user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
    });

    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Security' }));

    expect(await screen.findByText('Sessions are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Login history is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('No browser sessions. App access may still be active on other devices.'))
      .not.toBeInTheDocument();
    expect(screen.queryByText('No login history')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry security activity' }));
    await waitFor(() => expect(listSessions).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No browser sessions. App access may still be active on other devices.'))
      .toBeInTheDocument();
    expect(screen.getByText('No login history')).toBeInTheDocument();
  });

  it('reports an account-settings outage and clears it after a successful retry', async () => {
    const getPreferences = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ data: { privacy: { profile_visibility: 'public' } } });
    const sdk = {
      settings: {
        getPreferences,
        listSessions: vi.fn().mockResolvedValue({ data: [] }),
        getLoginHistory: vi.fn().mockResolvedValue({ data: [] }),
        getDeletionStatus: vi.fn().mockResolvedValue({ data: { requested: false } }),
      },
    };
    mocks.useAuth.mockReturnValue({
      isLoading: false,
      sdk,
      signOut: vi.fn(),
      signOutEverywhere: vi.fn(),
      user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
    });

    render(<SettingsScreen />);

    expect(await screen.findByText('Some account settings could not be loaded.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry settings' }));
    await waitFor(() => expect(getPreferences).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.queryByText('Some account settings could not be loaded.')).not.toBeInTheDocument();
    });
  });

  it('keeps session results visible when only login history is unavailable', async () => {
    const sdk = {
      settings: {
        getPreferences: vi.fn().mockResolvedValue(null),
        listSessions: vi.fn().mockResolvedValue({
          data: [{
            id: 'session-1',
            user_agent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/124.0.0.0',
            is_current: true,
          }],
        }),
        getLoginHistory: vi.fn().mockRejectedValue(new TypeError('offline')),
        getDeletionStatus: vi.fn().mockResolvedValue(null),
      },
    };
    mocks.useAuth.mockReturnValue({
      isLoading: false,
      sdk,
      signOut: vi.fn(),
      signOutEverywhere: vi.fn(),
      user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
    });

    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Security' }));

    expect(await screen.findByText('Chrome on Linux')).toBeInTheDocument();
    expect(screen.queryByText('Sessions are unavailable.')).not.toBeInTheDocument();
    expect(screen.getByText('Login history is unavailable.')).toBeInTheDocument();
  });
});
