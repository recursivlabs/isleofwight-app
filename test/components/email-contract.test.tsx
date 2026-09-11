import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The campaign detail view must work against the shape the SDK actually
// returns: email.getCampaign() and email.getCampaignStats() resolve to the
// SingleResponse envelope { data: ... }, never the payload itself (GET
// /email/campaigns/:id and /:id/stats answer { data: campaign } / { data:
// stats }). Reading fields off the envelope rendered a blank subject, a
// status badge stuck on "draft", and — since `undefined === 'sending'` —
// no Start/Pause/Resume button could ever appear. The stats card had a
// second layer of the same defect: the payload speaks in *_count fields,
// and the bare names showed 0 on every row of every campaign. Same defect
// class as #766 / PR #772 / PR #791.

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
const showToast = vi.hoisted(() => vi.fn());

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: { email: emailApi } }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));
vi.mock('../../components/Toast', () => ({ showToast }));

import EmailScreen from '../../app/email';

// Contract-shaped payloads, exactly as the engine returns them.
const campaignDetail = {
  data: {
    id: 'c1',
    name: 'Welcome series',
    subject: 'Hello there',
    from_email: 'team@minds.com',
    status: 'sending',
    html_content: '<h1>Hi</h1>',
  },
};
const campaignStats = {
  data: {
    id: 'c1',
    name: 'Welcome series',
    status: 'sending',
    total_recipients: 200,
    sent_count: 120,
    delivered_count: 118,
    open_count: 42,
    click_count: 7,
    bounce_count: 2,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  emailApi.listCampaigns.mockResolvedValue({
    data: [{ id: 'c1', name: 'Welcome series', subject: 'Hello there', status: 'sending' }],
  });
});

describe('Email campaign detail contract shape', () => {
  it('renders the detail view from the unwrapped { data } payload, action button included', async () => {
    emailApi.getCampaign.mockResolvedValue(campaignDetail);
    emailApi.getCampaignStats.mockResolvedValue(campaignStats);

    render(<EmailScreen />);
    await userEvent.click(await screen.findByText('Welcome series'));

    // Subject and from address read campaign fields; with the envelope
    // un-unwrapped both rendered blank.
    expect(await screen.findByText('Subject: Hello there')).toBeInTheDocument();
    expect(screen.getByText('From: team@minds.com')).toBeInTheDocument();
    // A 'sending' campaign must offer Pause. Off the envelope, status read
    // undefined and NO action button ever rendered.
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('shows the real *_count stats, not a column of zeros', async () => {
    emailApi.getCampaign.mockResolvedValue(campaignDetail);
    emailApi.getCampaignStats.mockResolvedValue(campaignStats);

    render(<EmailScreen />);
    await userEvent.click(await screen.findByText('Welcome series'));

    expect(await screen.findByText('Stats')).toBeInTheDocument();
    for (const value of ['120', '118', '42', '7', '2']) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
  });

  it('pauses with the real campaign id, never undefined off the envelope', async () => {
    emailApi.getCampaign.mockResolvedValue(campaignDetail);
    emailApi.getCampaignStats.mockResolvedValue(campaignStats);
    emailApi.pauseCampaign.mockResolvedValue({ data: { status: 'paused' } });

    render(<EmailScreen />);
    await userEvent.click(await screen.findByText('Welcome series'));
    await userEvent.click(await screen.findByText('Pause'));

    await waitFor(() => expect(emailApi.pauseCampaign).toHaveBeenCalledTimes(1));
    expect(emailApi.pauseCampaign).toHaveBeenCalledWith('c1');
  });

  it('reports a failed detail load instead of silently ignoring the tap', async () => {
    emailApi.getCampaign.mockRejectedValue(new Error('campaign fetch failed'));
    emailApi.getCampaignStats.mockRejectedValue(new Error('stats fetch failed'));

    render(<EmailScreen />);
    await userEvent.click(await screen.findByText('Welcome series'));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Failed to load campaign.', 'error'),
    );
    // The list stays; no half-open detail view.
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('hides the stats card when stats fail, instead of rendering a zero-filled one', async () => {
    emailApi.getCampaign.mockResolvedValue(campaignDetail);
    emailApi.getCampaignStats.mockRejectedValue(new Error('stats fetch failed'));

    render(<EmailScreen />);
    await userEvent.click(await screen.findByText('Welcome series'));

    // Detail renders fine without stats…
    expect(await screen.findByText('Subject: Hello there')).toBeInTheDocument();
    // …but a stats card of fabricated zeros must not. The old code kept the
    // truthy envelope (or null-from-catch dodged only by luck) and painted
    // "0" for every metric of a campaign that had already sent.
    expect(screen.queryByText('Stats')).not.toBeInTheDocument();
  });
});
