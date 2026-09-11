import type * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const walletApi = vi.hoisted(() => ({
  getMyWallet: vi.fn(),
  getLedger: vi.fn(),
  send: vi.fn(),
}));

vi.mock('react-native', () => ({
  View: ({ children, accessibilityRole, accessibilityLabel }: any) => (
    <div role={accessibilityRole} aria-label={accessibilityLabel}>{children}</div>
  ),
  TextInput: (props: any) => <input {...props} />,
  Platform: { OS: 'web' },
  Pressable: ({
    children,
    onPress,
    disabled,
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
      disabled={disabled}
      role={accessibilityRole}
      aria-label={accessibilityLabel}
      aria-selected={props['aria-selected'] ?? accessibilityState?.selected}
    >
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </button>
  ),
  Modal: ({ visible, children }: any) => visible ? <div>{children}</div> : null,
  FlatList: ({ data, ListHeaderComponent, renderItem, ListEmptyComponent }: any) => (
    <div>
      {ListHeaderComponent}
      {data.length
        ? data.map((item: any, index: number) => (
            <div key={item.id}>{renderItem({ item, index })}</div>
          ))
        : ListEmptyComponent}
    </div>
  ),
  Linking: { openURL: vi.fn() },
}));

vi.mock('@expo/vector-icons/Ionicons', () => ({
  default: ({ name }: { name: string }) => <span aria-hidden="true">{name}</span>,
}));

vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onPress, disabled }: any) => (
    <button type="button" onClick={onPress} disabled={disabled}>{children}</button>
  ),
  Skeleton: () => <span>Loading</span>,
  Avatar: () => null,
  RightRailLayout: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/Container', () => ({
  Container: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('../../components/ScreenHeader', () => ({ ScreenHeader: () => null }));
vi.mock('../../components/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../../lib/monitoring', () => ({ captureException: vi.fn() }));
vi.mock('../../lib/referral', () => ({ getReferralLink: vi.fn(async () => null) }));
vi.mock('../../lib/time', () => ({ formatTimestamp: () => 'now' }));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    accentMuted: '#322a15',
    bg: '#111',
    border: '#333',
    borderSubtle: '#333',
    error: '#f66',
    errorMuted: '#311',
    overlay: 'rgba(0,0,0,0.5)',
    shadow: '#000',
    success: '#3c6',
    successMuted: '#132',
    surface: '#222',
    surfaceHover: '#292929',
    text: '#fff',
    textMuted: '#aaa',
    textOnAccent: '#111',
    textSecondary: '#ccc',
  }),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: {
      posts: {
        client: {
          get: walletApi.getLedger,
        },
      },
      wallet: {
        getMyWallet: walletApi.getMyWallet,
        getBalance: vi.fn(),
        send: walletApi.send,
      },
      inviteCodes: {
        myCodes: vi.fn(async () => ({ data: { codes: [] } })),
        leaderboard: vi.fn(async () => ({ data: [] })),
      },
    },
  }),
}));

import WalletScreen from '../../app/wallet';

describe('Wallet control accessibility', () => {
  beforeEach(() => {
    walletApi.getMyWallet.mockResolvedValue({
      data: { configured: true, address: '0x1234', balance: '12' },
    });
    walletApi.send.mockClear();
    walletApi.send.mockResolvedValue({ data: { hash: '0xabc' } });
    walletApi.getLedger.mockReset().mockImplementation(async (path: string) => path.includes('token-balance')
      ? { data: { offchain_minds: 12, entries: 0 } }
      : { data: [], meta: { has_more: false } });
  });

  it('names wallet actions and exposes activity filters as selected tabs', async () => {
    render(<WalletScreen />);

    expect(await screen.findByRole('button', { name: 'Send ETH' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Receive ETH' })).toBeEnabled();
    expect(await screen.findByText('MINDS')).toBeInTheDocument();
    expect(screen.getByText('Off-chain · 0 transactions · on-chain 12 ETH')).toBeInTheDocument();

    const tablist = screen.getByRole('tablist', { name: 'Wallet activity' });
    const all = screen.getByRole('tab', { name: 'All' });
    const received = screen.getByRole('tab', { name: 'Received' });
    const sent = screen.getByRole('tab', { name: 'Sent' });
    expect(tablist).toContainElement(all);
    expect(tablist).toContainElement(received);
    expect(tablist).toContainElement(sent);
    expect(all).toHaveAttribute('aria-selected', 'true');
    expect(received).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(received);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: 'Received' })).toHaveAttribute('aria-selected', 'true');
    });
    expect(walletApi.send).not.toHaveBeenCalled();
  });

  it('does not offer Base transfers when the account has no on-chain wallet', async () => {
    walletApi.getMyWallet.mockResolvedValue({
      data: { configured: false, address: null, balance: null },
    });

    render(<WalletScreen />);

    const send = await screen.findByRole('button', { name: 'Send ETH' });
    const receive = screen.getByRole('button', { name: 'Receive ETH' });
    expect(send).toBeDisabled();
    expect(receive).toBeDisabled();
    expect(screen.getByText('On-chain transfers unavailable')).toBeInTheDocument();

    await userEvent.click(receive);
    expect(screen.queryByRole('button', { name: 'Copy address' })).not.toBeInTheDocument();
    expect(walletApi.send).not.toHaveBeenCalled();
  });

  it('reports a ledger outage instead of presenting it as a zero balance and empty history', async () => {
    walletApi.getLedger.mockRejectedValue(new Error('ledger offline'));

    render(<WalletScreen />);

    expect(await screen.findByText('Activity unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
    expect(screen.getByText('MINDS balance unavailable · on-chain 12 ETH')).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: 'Retry wallet balance and activity' });
    walletApi.getLedger.mockImplementation(async (path: string) => path.includes('token-balance')
      ? { data: { offchain_minds: 12, entries: 0 } }
      : { data: [], meta: { has_more: false } });
    await userEvent.click(retry);

    await waitFor(() => expect(screen.queryByText('Activity unavailable')).not.toBeInTheDocument());
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText('Off-chain · 0 transactions · on-chain 12 ETH')).toBeInTheDocument();
  });
});
