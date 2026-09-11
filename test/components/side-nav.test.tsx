import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => {
  const socket = { on: vi.fn(), off: vi.fn() };
  return {
    socket,
    notifications: vi.fn(async () => ({ data: [] })),
    conversations: vi.fn(async () => ({ data: [] })),
    communities: vi.fn(async () => ({ data: [] })),
  };
});

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'viewer-1', name: 'Viewer', username: 'viewer' },
    sdk: {
      notifications: { list: runtime.notifications },
      chat: { conversations: runtime.conversations },
      communities: { list: runtime.communities },
      realtime: {
        connect: vi.fn(async () => {}),
        socket: runtime.socket,
        getSocket: () => runtime.socket,
        onMessage: vi.fn(() => () => {}),
      },
    },
  }),
}));

const colors = {
  accent: '#d4a844',
  accentMuted: '#332b19',
  accentSubtle: '#211d14',
  bg: '#050505',
  borderSubtle: '#222222',
  glass: '#181818',
  glassBorder: '#333333',
  surfaceHover: '#202020',
  text: '#ffffff',
  textMuted: '#888888',
  textSecondary: '#bbbbbb',
  token: '#8ab4f8',
  tokenMuted: '#182536',
  verified: '#4aa3ff',
  verifiedMuted: '#16283b',
};

vi.mock('../../lib/theme', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/theme')>();
  return {
    ...actual,
    useTheme: () => ({ colors, isDark: true }),
    useColors: () => colors,
  };
});

import { SideNav } from '../../components/SideNav';

describe('SideNav', () => {
  beforeEach(() => {
    runtime.notifications.mockClear();
    runtime.conversations.mockClear();
    runtime.communities.mockClear();
    runtime.socket.on.mockClear();
    runtime.socket.off.mockClear();
  });

  it('does not mount the retired inbox data pipeline', async () => {
    render(<SideNav collapsed={false} onToggle={() => {}} />);

    // Positive control: effects ran and the visible notification badge data
    // source was refreshed. This prevents a broken/no-effect render from making
    // the two negative assertions pass vacuously.
    await waitFor(() => expect(runtime.notifications).toHaveBeenCalledTimes(1));

    expect(runtime.conversations).not.toHaveBeenCalled();
    expect(runtime.communities).not.toHaveBeenCalled();
    expect(runtime.socket.on).toHaveBeenCalledTimes(1);
    expect(runtime.socket.on).toHaveBeenCalledWith('notification', expect.any(Function));
    expect(screen.queryByText('Messages')).not.toBeInTheDocument();
  });

  it('names every destination when the rail is collapsed to icons', () => {
    render(<SideNav collapsed onToggle={() => {}} />);

    for (const label of [
      'Minds home',
      'Home',
      'Discover',
      'Chat',
      'Notifications',
      'Live',
      'Groups',
      'Minds AI',
      'Wallet',
      'Bookmarks',
      'Settings',
      'Upgrade — see Plus and Pro',
      'View profile for Viewer',
    ]) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});
