// Mark-all-read must be scoped to the tab being looked at.
//
// One account is both a person (Social tab) and an operator (Builds tab), and
// both kinds of notification share one table. The server's
// POST /notifications/read-all honours ?category= for exactly this reason
// (recursiv packages/server/src/features/api-keys/rest/routes/notifications.ts:
// "Clearing a social surface must not also clear the operator's unread agent
// and deploy rows"). The screen used to call markAllAsRead() unscoped from its
// open-the-tab focus effect, so merely opening Notifications — which defaults
// to Social — marked every unread Builds row read server-side before anyone
// had seen it.
import type * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  // Passthrough: the helper's own scoping contract (raw ?category= endpoint on
  // the pinned SDK) is unit-tested in test/social-notifications.test.ts; here
  // we assert the SCREEN hands it the right category.
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

// Exactly what GET /notifications serializes per row at the engine
// (notifications.ts L160–L176): snake_case fields, enriched actor, post_preview.
const socialRow = {
  id: 'notification-social-1',
  target_type: 'post_reply',
  target_id: 'post-1',
  title: 'Alice replied to you',
  body: 'a reply',
  image_url: null,
  action_url: '/post/post-1',
  status: 'unread',
  created_at: '2026-09-05T12:00:00.000Z',
  read_at: null,
  actor: { id: 'alice-1', name: 'Alice', username: 'alice', image: null, is_ai: false },
  post_preview: { id: 'post-1', excerpt: 'This is worth reading', media_url: null, media_type: null },
};

const systemRow = {
  id: 'notification-system-1',
  target_type: 'task_claimed',
  target_id: 'task-1',
  title: 'Working on: nightly backfill',
  body: null,
  image_url: null,
  action_url: null,
  status: 'unread',
  created_at: '2026-09-05T12:05:00.000Z',
  read_at: null,
  actor: null,
  post_preview: null,
};

describe('Notifications mark-read scope', () => {
  beforeEach(() => {
    mocks.markAllAsRead.mockReset().mockResolvedValue(undefined);
    mocks.markAsRead.mockReset().mockResolvedValue(undefined);
    mocks.sdk.notifications.markAllAsRead = mocks.markAllAsRead;
    mocks.sdk.notifications.markAsRead = mocks.markAsRead;
    mocks.loadSocialPage.mockReset().mockImplementation(async (_list, opts) => ({
      items: (opts?.category ?? 'social') === 'social' ? [socialRow] : [systemRow],
      cursor: undefined,
      hasMore: false,
    }));
  });

  it('renders the social row the serializer actually sends (positive control)', async () => {
    render(<NotificationsScreen />);
    await screen.findByRole('button', {
      name: /Open notification: Alice replied to you\. This is worth reading\. Unread\./,
    });
  });

  it('opening the tab clears ONLY the social category, never the whole stream', async () => {
    render(<NotificationsScreen />);
    await screen.findByRole('button', { name: /Alice replied to you/ });

    await waitFor(() => expect(mocks.markAllAsRead).toHaveBeenCalled());
    for (const call of mocks.markAllAsRead.mock.calls) {
      expect(call[0]).toBe('social');
    }
  });

  it('the Builds tab clears ONLY the system category', async () => {
    render(<NotificationsScreen />);
    await screen.findByRole('button', { name: /Alice replied to you/ });

    mocks.markAllAsRead.mockClear();
    await userEvent.click(screen.getByRole('tab', { name: 'Builds' }));
    await screen.findByText(/Working on: nightly backfill/);

    await waitFor(() => expect(mocks.markAllAsRead).toHaveBeenCalled());
    for (const call of mocks.markAllAsRead.mock.calls) {
      expect(call[0]).toBe('system');
    }
  });

  it('asks the loader for the category of the active tab', async () => {
    render(<NotificationsScreen />);
    await screen.findByRole('button', { name: /Alice replied to you/ });
    expect(mocks.loadSocialPage.mock.calls.at(0)?.[1]).toMatchObject({ category: 'social' });

    await userEvent.click(screen.getByRole('tab', { name: 'Builds' }));
    await screen.findByText(/Working on: nightly backfill/);
    expect(mocks.loadSocialPage.mock.calls.at(-1)?.[1]).toMatchObject({ category: 'system' });
  });
});
