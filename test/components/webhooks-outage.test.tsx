import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const webhooksApi = vi.hoisted(() => ({
  list: vi.fn(),
  register: vi.fn(),
  delete: vi.fn(),
}));
const captureException = vi.hoisted(() => vi.fn());
// One stable sdk reference: the screen's load() is memoized on it, and a
// fresh object per render would re-trigger the loading state mid-test.
const sdkMock = vi.hoisted(() => ({ webhooks: webhooksApi }));

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: sdkMock }),
}));
// The components barrel reaches lib/recursiv, whose real module imports the
// workspace SDK package; mock it out the same way the other screen tests do.
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1' }));
vi.mock('../../lib/monitoring', () => ({ captureException }));

import WebhooksScreen from '../../app/webhooks';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Webhooks outage honesty', () => {
  it('reports an outage instead of presenting it as no webhooks, and retries in place', async () => {
    webhooksApi.list.mockRejectedValue(new Error('webhooks offline'));

    render(<WebhooksScreen />);

    expect(
      await screen.findByText("Couldn't load your webhooks · Tap to retry"),
    ).toBeInTheDocument();
    // The failure must NOT render the "no webhooks" empty state.
    expect(screen.queryByText('No webhooks registered')).not.toBeInTheDocument();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { screen: 'webhooks', step: 'load-webhooks' },
    );

    // With a stable sdk, the mount fires exactly one load; the recovery below
    // must come from the retry click, not an automatic re-run.
    expect(webhooksApi.list).toHaveBeenCalledTimes(1);
    webhooksApi.list.mockResolvedValue({
      data: [{
        id: 'w1', provider: 'custom', endpoint: 'https://api.example.test/webhooks/inbound/w1',
        events: ['post.created'], status: 'active', last_received_at: null, created_at: '2026-09-01T00:00:00Z',
      }],
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading webhooks' }),
    );

    expect(await screen.findByText('https://api.example.test/webhooks/inbound/w1')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your webhooks · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('treats a 200 whose body carries no list as an outage', async () => {
    webhooksApi.list.mockResolvedValue({});

    render(<WebhooksScreen />);

    expect(
      await screen.findByText("Couldn't load your webhooks · Tap to retry"),
    ).toBeInTheDocument();
    expect(screen.queryByText('No webhooks registered')).not.toBeInTheDocument();
  });

  it('still shows the real empty state when the server answers with zero webhooks', async () => {
    webhooksApi.list.mockResolvedValue({ data: [] });

    render(<WebhooksScreen />);

    expect(await screen.findByText('No webhooks registered')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry loading webhooks' }),
    ).not.toBeInTheDocument();
    expect(captureException).not.toHaveBeenCalled();
  });
});
