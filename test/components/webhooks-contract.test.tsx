import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The engine's webhooks are INBOUND: POST /webhooks mints a receiving
// endpoint on the platform and RegisterWebhookInput has no url field. The
// screen previously collected a delivery URL, required it to submit, then
// silently discarded it — and rendered `w.url`, a field the API never sends,
// so every card's title was blank. These tests pin the screen to the shapes
// the SDK actually has (WebhookRegistration / RegisterWebhookInput).

const webhooksApi = vi.hoisted(() => ({
  list: vi.fn(),
  register: vi.fn(),
  delete: vi.fn(),
}));
// One stable sdk reference: the screen's load() is memoized on it, and a
// fresh object per render would re-trigger the loading state mid-test.
const sdkMock = vi.hoisted(() => ({ webhooks: webhooksApi }));

vi.mock('../../lib/guards', () => ({ withAdminGuard: (Screen: any) => Screen }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ sdk: sdkMock }),
}));
vi.mock('../../lib/recursiv', () => ({ ORG_ID: 'org-1', BASE_URL: 'https://api.test' }));

import WebhooksScreen from '../../app/webhooks';

// Contract-shaped payload, exactly as the engine returns it.
const registration = {
  id: 'wh-1',
  provider: 'custom',
  endpoint: '/api/v1/webhooks/inbound/wh-1',
  events: ['post.created'],
  status: 'active',
  last_received_at: null,
  created_at: '2026-09-06T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Webhooks screen contract shape', () => {
  it('renders the engine-issued endpoint on each card, never a url field', async () => {
    webhooksApi.list.mockResolvedValue({ data: [registration] });

    render(<WebhooksScreen />);

    expect(await screen.findByText('/api/v1/webhooks/inbound/wh-1')).toBeTruthy();
    expect(screen.getByText('post.created')).toBeTruthy();
    expect(screen.getByText('custom · active')).toBeTruthy();
  });

  it('registers with a typed RegisterWebhookInput — no url key, events filter from the form', async () => {
    webhooksApi.list.mockResolvedValue({ data: [] });
    webhooksApi.register.mockResolvedValue({ data: registration });

    render(<WebhooksScreen />);
    await screen.findByText('No webhooks registered');

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByPlaceholderText('post.created, user.signup'), {
      target: { value: 'post.created, user.signup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(webhooksApi.register).toHaveBeenCalledTimes(1));
    const input = webhooksApi.register.mock.calls[0][0];
    expect(input).toEqual({ provider: 'custom', events: ['post.created', 'user.signup'] });
    expect(Object.keys(input)).not.toContain('url');
  });

  it('registers with the events filter omitted when the form is left empty', async () => {
    webhooksApi.list.mockResolvedValue({ data: [] });
    webhooksApi.register.mockResolvedValue({ data: registration });

    render(<WebhooksScreen />);
    await screen.findByText('No webhooks registered');

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));

    await waitFor(() => expect(webhooksApi.register).toHaveBeenCalledTimes(1));
    expect(webhooksApi.register.mock.calls[0][0]).toEqual({ provider: 'custom', events: undefined });
  });

  it('unwraps the SingleResponse envelope from list()', async () => {
    webhooksApi.list.mockResolvedValue({ data: [] });

    render(<WebhooksScreen />);

    expect(await screen.findByText('No webhooks registered')).toBeTruthy();
  });
});
