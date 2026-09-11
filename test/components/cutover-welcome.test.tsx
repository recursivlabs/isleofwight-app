import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: { id: 'returning-user', created_at: '2012-01-01T00:00:00.000Z' } as any,
  accountRestriction: null as null | 'banned' | 'suspended',
  pathname: '/',
  stored: new Map<string, string>(),
  readGate: null as Promise<void> | null,
  push: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
  useWindowDimensions: () => ({ width: 1024, height: 768 }),
  View: ({ children, role, accessibilityRole, accessibilityLabel, accessibilityViewIsModal: _modal, style: _style }: any) => (
    <div role={role ?? accessibilityRole} aria-label={accessibilityLabel}>{children}</div>
  ),
  Modal: ({ visible, children }: any) => visible ? <div>{children}</div> : null,
  ScrollView: ({ children, accessibilityRole, accessibilityLabel, style: _style, contentContainerStyle: _contentStyle, ..._props }: any) => (
    <div role={accessibilityRole} aria-label={accessibilityLabel}>{children}</div>
  ),
  Pressable: ({ children, onPress, accessibilityRole, accessibilityLabel, style: _style, hitSlop: _hitSlop }: any) => (
    <button type="button" role={accessibilityRole} aria-label={accessibilityLabel} onClick={onPress}>
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </button>
  ),
  Text: ({ children }: any) => <span>{children}</span>,
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('@expo/vector-icons/Ionicons', () => ({ default: ({ name }: { name: string }) => <span>{name}</span> }));
vi.mock('expo-router', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: state.push }),
}));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ user: state.user, accountRestriction: state.accountRestriction }),
}));
vi.mock('../../lib/storage', () => ({
  getItem: vi.fn(async (key: string) => {
    const gate = state.readGate;
    if (gate) await gate;
    return state.stored.get(key) ?? null;
  }),
  setItem: vi.fn(async (key: string, value: string) => { state.stored.set(key, value); return true; }),
}));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#ffd048', accentMuted: '#332a12', border: '#333', borderSubtle: '#222',
    overlay: 'rgba(0,0,0,.7)', shadow: '#000', surfaceRaised: '#181818', text: '#fff',
    textMuted: '#999', textOnAccent: '#111', textSecondary: '#ccc',
  }),
}));

import { CutoverWelcome } from '../../components/CutoverWelcome';
import { cutoverWelcomeKeys } from '../../lib/cutoverWelcome';

const LAUNCH_AT = '2026-08-31T04:00:00.000Z';
const DURING_LAUNCH = Date.parse('2026-09-01T04:00:00.000Z');

function renderWelcome() {
  return render(<CutoverWelcome launchAt={LAUNCH_AT} now={DURING_LAUNCH} />);
}

describe('CutoverWelcome', () => {
  beforeEach(() => {
    state.user = { id: 'returning-user', created_at: '2012-01-01T00:00:00.000Z' };
    state.accountRestriction = null;
    state.pathname = '/';
    state.stored.clear();
    state.readGate = null;
    state.push.mockReset();
  });

  it('shows the welcome once, then leaves the 30-day banner', async () => {
    renderWelcome();

    expect(await screen.findByRole('alert', { name: 'Welcome back to Minds' })).toBeInTheDocument();
    expect(screen.queryByRole('summary')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Continue to Minds' }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await screen.findByRole('summary')).toHaveTextContent('Welcome to Minds 2.0');
    expect(state.stored.get(cutoverWelcomeKeys('returning-user').modalDismissed)).toBe('1');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss welcome banner' }));
    await waitFor(() => expect(screen.queryByRole('summary')).not.toBeInTheDocument());
    expect(state.stored.get(cutoverWelcomeKeys('returning-user').bannerDismissed)).toBe('1');
  });

  it('does not call a brand-new member a returning user', async () => {
    state.user = { id: 'new-user', created_at: '2026-08-31T04:00:00.000Z' };
    renderWelcome();

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByRole('summary')).not.toBeInTheDocument();
    expect(state.stored.size).toBe(0);
  });

  it('opens feedback without claiming the transition is complete', async () => {
    renderWelcome();
    await userEvent.click(await screen.findByRole('button', { name: 'Tell us what is missing' }));
    expect(state.push).toHaveBeenCalledWith('/feedback');
  });

  it('fails closed when the deployment has no authorized launch instant', async () => {
    render(<CutoverWelcome launchAt="" now={DURING_LAUNCH} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByRole('summary')).not.toBeInTheDocument();
    expect(state.stored.size).toBe(0);
  });

  it('does not render outside the global 30-day window', async () => {
    render(<CutoverWelcome launchAt={LAUNCH_AT} now={Date.parse('2026-09-30T04:00:00.000Z')} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.queryByRole('summary')).not.toBeInTheDocument();
  });

  it('suppresses the campaign on restricted and auth routes', async () => {
    state.accountRestriction = 'suspended';
    const { rerender } = renderWelcome();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());

    state.accountRestriction = null;
    state.pathname = '/auth/sign-in';
    rerender(<CutoverWelcome launchAt={LAUNCH_AT} now={DURING_LAUNCH} />);
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('does not let a stale storage read overwrite the next signed-in account', async () => {
    const oldKeys = cutoverWelcomeKeys('returning-user');
    state.stored.set(oldKeys.modalDismissed, '1');
    state.stored.set(oldKeys.bannerDismissed, '1');
    let releaseOldRead: (() => void) | undefined;
    state.readGate = new Promise<void>((resolve) => { releaseOldRead = resolve; });

    const { rerender } = renderWelcome();
    state.user = { id: 'next-user', created_at: '2013-01-01T00:00:00.000Z' };
    state.readGate = null;
    rerender(<CutoverWelcome launchAt={LAUNCH_AT} now={DURING_LAUNCH} />);

    expect(await screen.findByRole('alert', { name: 'Welcome back to Minds' })).toBeInTheDocument();
    releaseOldRead?.();
    await waitFor(() => {
      expect(screen.getByRole('alert', { name: 'Welcome back to Minds' })).toBeInTheDocument();
    });
  });

  it('activates and expires in a long-lived session without a reload', async () => {
    vi.useFakeTimers();
    try {
      const launch = Date.parse(LAUNCH_AT);
      vi.setSystemTime(launch - 1_000);
      render(<CutoverWelcome launchAt={LAUNCH_AT} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(1_001); });
      expect(screen.getByRole('alert', { name: 'Welcome back to Minds' })).toBeInTheDocument();

      await act(async () => { await vi.advanceTimersByTimeAsync(30 * 24 * 60 * 60 * 1000); });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('summary')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
