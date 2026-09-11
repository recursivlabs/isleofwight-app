import type * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boostApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../components', () => ({
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onPress, disabled }: any) => (
    <button type="button" onClick={onPress} disabled={disabled}>{children}</button>
  ),
}));

vi.mock('../../components/Container', () => ({
  Container: ({ children }: { children?: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('../../components/ScreenHeader', () => ({ ScreenHeader: () => null }));
vi.mock('../../components/Toast', () => ({ showToast: vi.fn() }));
vi.mock('../../lib/monitoring', () => ({ captureException: vi.fn() }));
vi.mock('../../lib/theme', () => ({
  useColors: () => ({
    accent: '#d4a844',
    accentMuted: '#322a15',
    bg: '#111',
    boost: '#d4a844',
    border: '#333',
    borderSubtle: '#333',
    error: '#f66',
    errorMuted: '#311',
    success: '#3c6',
    surface: '#222',
    text: '#fff',
    textMuted: '#aaa',
    textSecondary: '#ccc',
  }),
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: {
      posts: {
        client: {
          get: boostApi.get,
          post: boostApi.post,
        },
      },
    },
  }),
}));

import BoostScreen from '../../app/boost';

const healthyApi = async (path: string) => {
  if (path.includes('/boosts/balance')) return { data: { balance_micros: 5_000_000 } };
  if (path.includes('/boosts/mine')) {
    return {
      data: [{
        id: 'c1',
        status: 'active',
        review_status: 'approved',
        post_content: 'Hello world',
        impressions_served: 10,
        spent_micros: 1_000_000,
        budget_micros: 5_000_000,
      }],
    };
  }
  throw new Error(`unexpected path ${path}`);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Boost dashboard outage honesty', () => {
  it('reports an outage instead of presenting it as no boosts, and retries in place', async () => {
    boostApi.get.mockRejectedValue(new Error('boosts offline'));

    render(<BoostScreen />);

    expect(
      await screen.findByText("Couldn't load your Boost balance or boosts · Tap to retry"),
    ).toBeInTheDocument();
    // The failure must NOT render the "you have no boosts" pitch.
    expect(
      screen.queryByText(/Boost puts your post in front of people beyond your followers/),
    ).not.toBeInTheDocument();

    boostApi.get.mockImplementation(healthyApi);
    await userEvent.click(screen.getByRole('button', { name: 'Retry Boost balance and boosts' }));

    expect(await screen.findByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByText("Couldn't load your Boost balance or boosts · Tap to retry"),
      ).not.toBeInTheDocument(),
    );
  });

  it('still shows the real empty state when the server answers with zero boosts', async () => {
    boostApi.get.mockImplementation(async (path: string) => {
      if (path.includes('/boosts/balance')) return { data: { balance_micros: 0 } };
      if (path.includes('/boosts/mine')) return { data: [] };
      throw new Error(`unexpected path ${path}`);
    });

    render(<BoostScreen />);

    expect(
      await screen.findByText(/Boost puts your post in front of people beyond your followers/),
    ).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry Boost balance and boosts' })).not.toBeInTheDocument();
  });

  it('names the half that failed when only one request fails', async () => {
    boostApi.get.mockImplementation(async (path: string) => {
      if (path.includes('/boosts/balance')) throw new Error('balance offline');
      if (path.includes('/boosts/mine')) return { data: [] };
      throw new Error(`unexpected path ${path}`);
    });

    render(<BoostScreen />);

    expect(
      await screen.findByText("Couldn't load your Boost balance · Tap to retry"),
    ).toBeInTheDocument();
    // Campaigns genuinely answered empty, so the empty state is honest here.
    expect(
      screen.getByText(/Boost puts your post in front of people beyond your followers/),
    ).toBeInTheDocument();
  });
});
