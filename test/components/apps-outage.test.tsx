import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectsApi = vi.hoisted(() => ({
  create: vi.fn(),
  deploy: vi.fn(),
  deployments: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
}));
const captureException = vi.hoisted(() => vi.fn());

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: { projects: projectsApi } }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));

import AppsScreen from '../../app/apps';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Apps outage honesty', () => {
  it('reports an outage instead of presenting it as no apps, and retries in place', async () => {
    projectsApi.list.mockRejectedValue(new Error('apps offline'));

    render(<AppsScreen />);

    expect(
      await screen.findByText("Couldn't load your apps · Tap to retry"),
    ).toBeInTheDocument();
    // The failure must NOT render the "no apps" empty state.
    expect(screen.queryByText('No apps yet')).not.toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { screen: 'apps', step: 'load-projects' },
    );

    projectsApi.list.mockResolvedValue({
      data: [{ id: 'app-1', name: 'Demo App', status: 'deployed' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading apps' }));

    expect(await screen.findByText('Demo App')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your apps · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('treats a 200 whose body carries no list as an outage', async () => {
    projectsApi.list.mockResolvedValue({});

    render(<AppsScreen />);

    expect(
      await screen.findByText("Couldn't load your apps · Tap to retry"),
    ).toBeInTheDocument();
    expect(screen.queryByText('No apps yet')).not.toBeInTheDocument();
  });

  it('still shows the real empty state when the server answers with zero apps', async () => {
    projectsApi.list.mockResolvedValue({ data: [] });

    render(<AppsScreen />);

    expect(await screen.findByText('No apps yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry loading apps' }),
    ).not.toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });
});
