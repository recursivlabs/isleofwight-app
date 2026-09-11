import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const publicLog = vi.hoisted(() => vi.fn().mockResolvedValue({
  data: { principles: [], actions: [] },
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => ({
    sdk: null,
    user: null,
    accountRestriction: null,
    signOut: vi.fn(),
  }),
}));

vi.mock('../../lib/recursiv', () => ({
  NETWORK_ID: 'minds-network',
  createPublicSdk: () => ({ moderation: { publicLog } }),
}));

import ModerationScreen from '../../app/moderation';

describe('public moderation page semantics', () => {
  it('uses one primary heading, a nested intro heading, and a route-specific title', async () => {
    render(<ModerationScreen />);

    expect(document.title).toBe('Moderation & appeals — Minds');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Moderation & appeals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'How moderation works' })).toBeInTheDocument();
    expect(await screen.findByText('No moderation actions have been recorded yet.')).toBeInTheDocument();
  });
});
