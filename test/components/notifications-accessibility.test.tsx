import type * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from 'expo-router';

const mocks = vi.hoisted(() => ({
  loadSocialPage: vi.fn(),
  markAllAsRead: vi.fn(),
  markAsRead: vi.fn(),
  sdk: {
    notifications: {
      list: vi.fn(),
      markAllAsRead: vi.fn(),
      markAsRead: vi.fn(),
    },
    realtime: { connect: vi.fn().mockResolvedValue(undefined) },
  },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: mocks.sdk }),
}));
vi.mock('../../lib/socialNotifications', () => ({
  loadSocialPage: mocks.loadSocialPage,
  markCategoryRead: (notifications: { markAllAsRead: (c?: string) => Promise<unknown> }, category: string) =>
    notifications.markAllAsRead(category),
}));
vi.mock('../../lib/monitoring', () => ({ captureException: vi.fn() }));
vi.mock('../../lib/cache', () => ({ invalidate: vi.fn() }));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    accentMuted: '#332b17',
    accentSubtle: '#221d12',
    bg: '#111',
    border: '#444',
    borderSubtle: '#333',
    error: '#f66',
    surface: '#222',
    surfaceHover: '#292929',
    surfaceRaised: '#333',
    text: '#fff',
    textMuted: '#aaa',
    textOnAccent: '#111',
    textSecondary: '#ccc',
  }),
}));
vi.mock('../../components', () => ({
  Header: () => null,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Avatar: ({ name }: { name?: string }) => <span>{name}</span>,
  Skeleton: () => null,
  RightRailLayout: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('../../components/ScreenHeader', () => ({
  ScreenHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('../../components/Toast', () => ({ showToast: vi.fn() }));
vi.mock('react-native-gesture-handler', () => ({
  Swipeable: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

import NotificationsScreen from '../../app/(tabs)/notifications';

describe('Notifications accessibility', () => {
  beforeEach(() => {
    mocks.markAllAsRead.mockReset().mockResolvedValue(undefined);
    mocks.markAsRead.mockReset().mockResolvedValue(undefined);
    mocks.sdk.notifications.markAllAsRead = mocks.markAllAsRead;
    mocks.sdk.notifications.markAsRead = mocks.markAsRead;
    mocks.loadSocialPage.mockReset().mockResolvedValue({
      items: [{
        id: 'notification-1',
        status: 'unread',
        target_type: 'post_reply',
        target_id: 'post-1',
        action_url: '/post/post-1',
        actor: { id: 'alice-1', name: 'Alice' },
        post_preview: { excerpt: 'This is worth reading' },
        created_at: '2026-09-04T12:00:00.000Z',
      }],
      cursor: undefined,
      hasMore: false,
    });
  });

  it('exposes a notification as a named control and opens its target', async () => {
    render(<NotificationsScreen />);

    const row = await screen.findByRole('button', {
      name: /Open notification: Alice replied to you\. This is worth reading\. Unread\./,
    });
    await userEvent.click(row);

    await waitFor(() => expect(mocks.markAsRead).toHaveBeenCalledWith('notification-1'));
    expect(router.push).toHaveBeenCalledWith('/post/post-1');
  });
});
