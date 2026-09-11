/**
 * The 2FA row on Settings → Security must report the SERVER's answer, not a
 * hardcoded guess. It used to be `useState(false)` with no read anywhere, so an
 * account with 2FA on saw "Not enabled" on every visit — a false negative on
 * the one row that exists to reassure, and an invitation to "Enable" again.
 *
 * The status comes from GET /profiles/me, the signed-in payload the engine
 * serializes with `two_factor_enabled` (packages/server/src/features/api-keys/
 * rest/routes/profiles.ts, /me handler — the /users/me payload behind the auth
 * user does NOT carry it). Mocks are engine-shaped: `{ data: { ...,
 * two_factor_enabled } }`.
 */
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
    success: '#5c5',
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

import SettingsScreen from '../../app/settings';

// Exactly what the engine's GET /profiles/me serializes for a signed-in user
// (formatUser fields plus the /me-only extras), trimmed to the fields in play.
function profilesMePayload(twoFactorEnabled: boolean) {
  return {
    data: {
      id: 'user-1',
      name: 'Member',
      username: 'member',
      image: null,
      bio: null,
      is_ai: false,
      email: 'member@example.com',
      email_verified: true,
      role: 'user',
      two_factor_enabled: twoFactorEnabled,
      followers_count: 2,
      following_count: 3,
      updated_at: '2026-09-01T00:00:00.000Z',
    },
  };
}

function makeSdk(profilesMe: ReturnType<typeof vi.fn>) {
  return {
    profiles: { me: profilesMe },
    settings: {
      getPreferences: vi.fn().mockResolvedValue(null),
      listSessions: vi.fn().mockResolvedValue({ data: [] }),
      getLoginHistory: vi.fn().mockResolvedValue({ data: [] }),
      getDeletionStatus: vi.fn().mockResolvedValue(null),
    },
  };
}

function signIn(sdk: any) {
  mocks.useAuth.mockReturnValue({
    isLoading: false,
    sdk,
    signOut: vi.fn(),
    signOutEverywhere: vi.fn(),
    user: { id: 'user-1', name: 'Member', username: 'member', email: 'member@example.com' },
  });
}

async function openSecurity() {
  render(<SettingsScreen />);
  await userEvent.click(await screen.findByRole('tab', { name: 'Security' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Settings → Security: two-factor status honesty', () => {
  it('reports Enabled with a Reconfigure action when the server says 2FA is on', async () => {
    const profilesMe = vi.fn().mockResolvedValue(profilesMePayload(true));
    signIn(makeSdk(profilesMe));

    await openSecurity();

    expect(await screen.findByText('Enabled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconfigure' })).toBeInTheDocument();
    expect(screen.queryByText('Not enabled')).not.toBeInTheDocument();
    expect(profilesMe).toHaveBeenCalled();
  });

  it('reports Not enabled with an Enable action when the server says 2FA is off', async () => {
    signIn(makeSdk(vi.fn().mockResolvedValue(profilesMePayload(false))));

    await openSecurity();

    expect(await screen.findByText('Not enabled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
  });

  it('says the status could not be checked — never "Not enabled" — when /profiles/me fails, and retries in place', async () => {
    const profilesMe = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(profilesMePayload(true));
    signIn(makeSdk(profilesMe));

    await openSecurity();

    expect(await screen.findByText('Could not check status')).toBeInTheDocument();
    expect(screen.queryByText('Not enabled')).not.toBeInTheDocument();
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(profilesMe).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Enabled')).toBeInTheDocument();
    expect(screen.queryByText('Could not check status')).not.toBeInTheDocument();
  });

  it('keeps the action disabled while the status is still unknown', async () => {
    let answer!: (value: unknown) => void;
    const profilesMe = vi.fn().mockImplementation(
      () => new Promise((resolve) => { answer = resolve; }),
    );
    signIn(makeSdk(profilesMe));

    await openSecurity();

    expect(await screen.findByText('Checking…')).toBeInTheDocument();
    // The pending window must not offer Enable: an account that already has
    // 2FA could start re-enrollment before the server answers.
    expect(screen.getByRole('button', { name: 'Enable' })).toBeDisabled();

    answer(profilesMePayload(true));
    expect(await screen.findByText('Enabled')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconfigure' })).toBeEnabled();
  });

  it('treats a payload without the field as unanswerable, not as 2FA off', async () => {
    const payload = profilesMePayload(false) as any;
    delete payload.data.two_factor_enabled;
    signIn(makeSdk(vi.fn().mockResolvedValue(payload)));

    await openSecurity();

    expect(await screen.findByText('Could not check status')).toBeInTheDocument();
    expect(screen.queryByText('Not enabled')).not.toBeInTheDocument();
  });
});
