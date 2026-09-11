import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// #766 — the screen must work against the shapes the SDK actually returns
// (the SingleResponse envelope { data: ... }) and send the shapes the engine
// actually accepts (a partial UpdateSecurityPolicyInput; { template_url }).

const settingsApi = vi.hoisted(() => ({
  connectGitHub: vi.fn(),
  disconnectGitHub: vi.fn(),
  get: vi.fn(),
  setDefaultTemplate: vi.fn(),
}));
const securityApi = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));
const captureException = vi.hoisted(() => vi.fn());

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: { organizationSettings: settingsApi, organizationSecurity: securityApi },
  }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));

import OrgSettingsScreen from '../../app/org-settings';

// Contract-shaped payloads, exactly as the engine returns them.
const connectedSettings = {
  data: {
    github_owner: 'my-org',
    github_connected: true,
    default_template_url: 'https://github.com/my-org/template',
  },
};
const securityPolicy = {
  data: {
    require_two_factor: false,
    two_factor_grace_period_days: 7,
    session_timeout_minutes: null,
    idle_timeout_minutes: null,
    ip_allowlist: [],
    ip_allowlist_enabled: false,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Organization settings contract shape (#766)', () => {
  it('prefills from the unwrapped settings payload and shows Disconnect for a connected org', async () => {
    settingsApi.get.mockResolvedValue(connectedSettings);
    securityApi.get.mockResolvedValue(securityPolicy);

    render(<OrgSettingsScreen />);

    expect(await screen.findByText('Disconnect')).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-org')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('https://github.com/my-org/template'),
    ).toBeInTheDocument();
  });

  it('shows no Disconnect button for a fresh org ({data: null})', async () => {
    settingsApi.get.mockResolvedValue({ data: null });
    securityApi.get.mockResolvedValue(securityPolicy);

    render(<OrgSettingsScreen />);

    expect(await screen.findByText('GitHub Integration')).toBeInTheDocument();
    expect(screen.queryByText('Disconnect')).not.toBeInTheDocument();
  });

  it('renders the Require 2FA toggle from a contract-shaped security response', async () => {
    settingsApi.get.mockResolvedValue({ data: null });
    securityApi.get.mockResolvedValue(securityPolicy);

    render(<OrgSettingsScreen />);

    expect(await screen.findByText('Security Policies')).toBeInTheDocument();
    expect(screen.getByText('Require 2FA')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('sends only the changed field to the security PUT — a valid UpdateSecurityPolicyInput, never the envelope', async () => {
    settingsApi.get.mockResolvedValue({ data: null });
    securityApi.get.mockResolvedValue(securityPolicy);
    securityApi.update.mockResolvedValue({ data: { success: true } });

    render(<OrgSettingsScreen />);

    await screen.findByText('Require 2FA');
    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(securityApi.update).toHaveBeenCalledTimes(1));
    expect(securityApi.update).toHaveBeenCalledWith('org-1', {
      require_two_factor: true,
    });
  });

  it('sends template_url — the key the engine validates — when setting the default template', async () => {
    settingsApi.get.mockResolvedValue(connectedSettings);
    securityApi.get.mockResolvedValue(securityPolicy);
    settingsApi.setDefaultTemplate.mockResolvedValue({ data: {} });

    render(<OrgSettingsScreen />);

    await screen.findByText('Set Template');
    await userEvent.click(screen.getByText('Set Template'));

    await waitFor(() =>
      expect(settingsApi.setDefaultTemplate).toHaveBeenCalledWith('org-1', {
        template_url: 'https://github.com/my-org/template',
      }),
    );
  });
});
