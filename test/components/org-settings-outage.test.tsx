import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const healthySecurity = {
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

describe('Organization settings outage honesty', () => {
  it('reports an outage on both halves instead of rendering silently empty, and retries in place', async () => {
    settingsApi.get.mockRejectedValue(new Error('settings offline'));
    securityApi.get.mockRejectedValue(new Error('security offline'));

    render(<OrgSettingsScreen />);

    expect(
      await screen.findByText(
        "Couldn't load organization settings or security policies · Tap to retry",
      ),
    ).toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { screen: 'org-settings', step: 'load-settings' },
    );
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { screen: 'org-settings', step: 'load-security' },
    );

    // A fresh org legitimately has no settings row ({data: null}) — the retry
    // must clear the banner on that answer, not mistake it for an outage.
    settingsApi.get.mockResolvedValue({ data: null });
    securityApi.get.mockResolvedValue(healthySecurity);
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Retry organization settings and security policies',
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText(
          "Couldn't load organization settings or security policies · Tap to retry",
        ),
      ).not.toBeInTheDocument(),
    );
  });

  it('names the half that failed when only the security fetch fails', async () => {
    settingsApi.get.mockResolvedValue({ data: null });
    securityApi.get.mockRejectedValue(new Error('security offline'));

    render(<OrgSettingsScreen />);

    expect(
      await screen.findByText("Couldn't load security policies · Tap to retry"),
    ).toBeInTheDocument();
  });

  it('names the half that failed when only the settings fetch fails', async () => {
    settingsApi.get.mockRejectedValue(new Error('settings offline'));
    securityApi.get.mockResolvedValue(healthySecurity);

    render(<OrgSettingsScreen />);

    expect(
      await screen.findByText("Couldn't load organization settings · Tap to retry"),
    ).toBeInTheDocument();
  });

  it('shows no banner when both halves answer', async () => {
    settingsApi.get.mockResolvedValue({ data: null });
    securityApi.get.mockResolvedValue(healthySecurity);

    render(<OrgSettingsScreen />);

    expect(await screen.findByText('GitHub Integration')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Retry organization settings and security policies',
      }),
    ).not.toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });
});
