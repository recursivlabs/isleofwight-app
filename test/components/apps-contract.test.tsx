import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The app detail view must work against the shape the SDK actually returns:
// projects.get() resolves to the SingleResponse envelope { data: ... }, never
// the project itself. Reading fields off the envelope rendered a blank detail
// header and passed `undefined` into deploy() — Deploy to Production could
// never work from the detail view. Same defect class as #766 / PR #772.

const projectsApi = vi.hoisted(() => ({
  create: vi.fn(),
  deploy: vi.fn(),
  deployments: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
}));
const captureException = vi.hoisted(() => vi.fn());
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: { projects: projectsApi } }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));
vi.mock('../../components/Toast', () => ({ showToast }));

import AppsScreen from '../../app/apps';

// Contract-shaped payloads, exactly as the engine returns them
// (GET /projects/:id and GET /projects/:id/deployments).
const projectDetail = {
  data: {
    id: 'app-1',
    name: 'Demo App',
    slug: 'demo-app',
    visibility: 'private',
    repo_url: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  projectsApi.list.mockResolvedValue({
    data: [{ id: 'app-1', name: 'Demo App' }],
  });
  projectsApi.deployments.mockResolvedValue({ data: [] });
});

describe('App detail contract shape', () => {
  it('renders the detail view from the unwrapped { data } payload', async () => {
    projectsApi.get.mockResolvedValue(projectDetail);

    render(<AppsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open app Demo App' }));

    // Header + App Info card both read project fields; with the envelope
    // un-unwrapped this rendered blank.
    expect(await screen.findByText('App Info')).toBeInTheDocument();
    expect(screen.getAllByText('Demo App').length).toBeGreaterThanOrEqual(2);
  });

  it('deploys with the real project id, never undefined off the envelope', async () => {
    projectsApi.get.mockResolvedValue(projectDetail);
    projectsApi.deploy.mockResolvedValue({ data: { id: 'dep-1' } });

    render(<AppsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open app Demo App' }));
    await userEvent.click(await screen.findByText('Deploy to Production'));

    await waitFor(() => expect(projectsApi.deploy).toHaveBeenCalledTimes(1));
    expect(projectsApi.deploy).toHaveBeenCalledWith('app-1', { type: 'production' });
  });

  it('reports a failed detail load instead of silently ignoring the tap', async () => {
    projectsApi.get.mockRejectedValue(new Error('project fetch failed'));

    render(<AppsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Open app Demo App' }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Failed to load app details.', 'error'),
    );
    // The broken fetch must not open a blank detail view.
    expect(screen.queryByText('App Info')).not.toBeInTheDocument();
  });
});
