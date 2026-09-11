import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const emailApi = vi.hoisted(() => ({
  createCampaign: vi.fn(),
  getCampaign: vi.fn(),
  getCampaignStats: vi.fn(),
  listCampaigns: vi.fn(),
  pauseCampaign: vi.fn(),
  resumeCampaign: vi.fn(),
  startCampaign: vi.fn(),
}));
const captureException = vi.hoisted(() => vi.fn());

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: { email: emailApi } }),
}));
// The components barrel reaches lib/recursiv, whose real module imports the
// workspace SDK package; mock it out the same way the other screen tests do.
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));

import EmailScreen from '../../app/email';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Email campaigns outage honesty', () => {
  it('reports an outage instead of presenting it as no campaigns, and retries in place', async () => {
    emailApi.listCampaigns.mockRejectedValue(new Error('email offline'));

    render(<EmailScreen />);

    expect(
      await screen.findByText("Couldn't load your campaigns · Tap to retry"),
    ).toBeInTheDocument();
    // The failure must NOT render the "no campaigns" empty state.
    expect(screen.queryByText('No campaigns yet')).not.toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { screen: 'email', step: 'load-campaigns' },
    );

    emailApi.listCampaigns.mockResolvedValue({
      data: [{ id: 'c1', name: 'Welcome series', subject: 'Hello there', status: 'sent' }],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading email campaigns' }),
    );

    expect(await screen.findByText('Welcome series')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your campaigns · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('treats a 200 whose body carries no list as an outage', async () => {
    emailApi.listCampaigns.mockResolvedValue({});

    render(<EmailScreen />);

    expect(
      await screen.findByText("Couldn't load your campaigns · Tap to retry"),
    ).toBeInTheDocument();
    expect(screen.queryByText('No campaigns yet')).not.toBeInTheDocument();
  });

  it('still shows the real empty state when the server answers with zero campaigns', async () => {
    emailApi.listCampaigns.mockResolvedValue({ data: [] });

    render(<EmailScreen />);

    expect(await screen.findByText('No campaigns yet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry loading email campaigns' }),
    ).not.toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });
});
