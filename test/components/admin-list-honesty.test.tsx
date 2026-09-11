import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The three admin list tabs must not turn "could not reach an answer" into a
// verdict: an outage is not "Requires admin access", and it is not an empty
// network either. Only a server-returned 401/403 may read as permissions.
const adminApi = vi.hoisted(() => ({
  getLaunchStats: vi.fn(),
  getSignupsByDay: vi.fn(),
  listUsers: vi.fn(),
  listPosts: vi.fn(),
  listReports: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  deleteUser: vi.fn(),
  setUserRole: vi.fn(),
  deletePost: vi.fn(),
}));
const organizationsApi = vi.hoisted(() => ({ members: vi.fn() }));
const postsApi = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), delete: vi.fn() }));
const communitiesApi = vi.hoisted(() => ({ list: vi.fn(), delete: vi.fn() }));

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: {
      admin: adminApi,
      organizations: organizationsApi,
      posts: postsApi,
      communities: communitiesApi,
      profiles: { get: vi.fn(), getByUsername: vi.fn() },
      reports: { dismiss: vi.fn(), resolve: vi.fn() },
      moderation: { apply: vi.fn(), resolveAppeal: vi.fn() },
      agents: { chat: vi.fn() },
    },
  }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));

import AdminScreen from '../../app/admin';

const denied = (msg: string) => Object.assign(new Error(msg), { status: 403 });

beforeEach(() => {
  vi.clearAllMocks();
  // The dashboard mounts first on every render of the screen; keep it quiet.
  adminApi.getLaunchStats.mockResolvedValue({ data: {} });
  adminApi.getSignupsByDay.mockResolvedValue({ data: [] });
});

describe('Admin Users tab honesty', () => {
  it('reports an outage as an outage with a retry, never as a permissions verdict', async () => {
    adminApi.listUsers.mockRejectedValue(new Error('gateway timeout'));
    organizationsApi.members.mockRejectedValue(new Error('gateway timeout'));

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Users'));

    expect(await screen.findByText('Users could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('Requires admin access to view users.')).not.toBeInTheDocument();

    adminApi.listUsers.mockResolvedValue({ data: [{ id: 'u1', username: 'alice' }] });
    await userEvent.click(screen.getByText('Try again'));

    expect(await screen.findByText('@alice')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Users could not be loaded.')).not.toBeInTheDocument(),
    );
  });

  it('renders the permissions verdict, without a retry, only when the server said 401/403', async () => {
    adminApi.listUsers.mockRejectedValue(denied('forbidden'));
    organizationsApi.members.mockRejectedValue(denied('forbidden'));

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Users'));

    expect(await screen.findByText('Requires admin access to view users.')).toBeInTheDocument();
    expect(screen.queryByText('Try again')).not.toBeInTheDocument();
  });

  it('labels the org-members fallback and applies the active search to it', async () => {
    adminApi.listUsers.mockRejectedValue(denied('forbidden'));
    organizationsApi.members.mockResolvedValue({
      data: [
        { user: { id: 'u1', username: 'alice', name: 'Alice A' } },
        { user: { id: 'u2', username: 'bob', name: 'Bob B' } },
      ],
    });

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Users'));

    // Unfiltered fallback shows everyone, visibly labeled as the fallback.
    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(
      screen.getByText(/showing organization members instead/),
    ).toBeInTheDocument();

    // A search against the fallback must not present unrelated rows as results.
    await userEvent.type(screen.getByPlaceholderText('Search users...'), 'ali');
    await userEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('@alice')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('@bob')).not.toBeInTheDocument());
  });
});

describe('Admin Content tab honesty', () => {
  it('reports an outage as an outage with a retry, never as a permissions verdict', async () => {
    adminApi.listPosts.mockRejectedValue(new Error('gateway timeout'));
    postsApi.list.mockRejectedValue(new Error('gateway timeout'));

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Content'));

    expect(await screen.findByText('Content could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('Requires admin access to view content.')).not.toBeInTheDocument();

    adminApi.listPosts.mockResolvedValue({ data: [{ id: 'p1', title: 'Hello world' }] });
    await userEvent.click(screen.getByText('Try again'));

    expect(await screen.findByText('Hello world')).toBeInTheDocument();
  });

  it('applies the active search to the plain-posts fallback instead of ignoring it', async () => {
    adminApi.listPosts.mockRejectedValue(denied('forbidden'));
    postsApi.list.mockResolvedValue({
      data: [
        { id: 'p1', title: 'Launch checklist' },
        { id: 'p2', title: 'Unrelated ramble' },
      ],
    });

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Content'));

    expect(await screen.findByText('Launch checklist')).toBeInTheDocument();
    expect(screen.getByText('Unrelated ramble')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Search posts...'), 'launch');
    await userEvent.click(screen.getByText('Search'));

    expect(await screen.findByText('Launch checklist')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Unrelated ramble')).not.toBeInTheDocument(),
    );
  });
});

describe('Admin Communities tab honesty', () => {
  it('reports a failed listing instead of presenting it as no communities, and retries in place', async () => {
    communitiesApi.list.mockRejectedValue(new Error('gateway timeout'));

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Communities'));

    expect(await screen.findByText('Communities could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No communities')).not.toBeInTheDocument();

    communitiesApi.list.mockResolvedValue({ data: [{ id: 'c1', name: 'General' }] });
    await userEvent.click(screen.getByText('Try again'));

    expect(await screen.findByText('General')).toBeInTheDocument();
  });

  it('still shows the real empty state when the server answers with zero communities', async () => {
    communitiesApi.list.mockResolvedValue({ data: [] });

    render(<AdminScreen />);
    await userEvent.click(screen.getByText('Communities'));

    expect(await screen.findByText('No communities')).toBeInTheDocument();
    expect(screen.queryByText('Communities could not be loaded.')).not.toBeInTheDocument();
  });
});
