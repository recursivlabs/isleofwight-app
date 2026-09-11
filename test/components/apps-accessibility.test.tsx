import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projectsApi = vi.hoisted(() => ({
  create: vi.fn(),
  deploy: vi.fn(),
  deployments: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
}));

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: { projects: projectsApi } }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));

import AppsScreen from '../../app/apps';

describe('Apps navigation accessibility', () => {
  beforeEach(() => {
    projectsApi.create.mockClear();
    projectsApi.deploy.mockClear();
    projectsApi.list.mockResolvedValue({
      data: [{ id: 'app-1', name: 'Demo App', status: 'deployed' }],
    });
    // Contract shape: projects.get resolves the SingleResponse envelope.
    projectsApi.get.mockResolvedValue({ data: { id: 'app-1', name: 'Demo App' } });
    projectsApi.deployments.mockResolvedValue({ data: [] });
  });

  it('names page, app, and detail navigation without creating or deploying', async () => {
    render(<AppsScreen />);

    expect(await screen.findByRole('button', { name: 'Go back' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open app Demo App' }));

    expect(await screen.findByRole('button', { name: 'Back to apps' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Demo App' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back to apps' }));

    expect(screen.getByRole('button', { name: 'Open app Demo App' })).toBeInTheDocument();
    expect(projectsApi.create).not.toHaveBeenCalled();
    expect(projectsApi.deploy).not.toHaveBeenCalled();
  });
});
