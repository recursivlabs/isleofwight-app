import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.hoisted(() => ({
  user: null as null | { id: string; created_at?: string },
  isLoading: false,
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock,
}));

import AuthLayout from '../../app/(auth)/_layout';

describe('AuthLayout', () => {
  beforeEach(() => {
    authMock.user = null;
    authMock.isLoading = false;
  });

  it('renders auth screens for a signed-out person', () => {
    render(<AuthLayout />);
    expect(screen.getByTestId('router-slot')).toBeInTheDocument();
  });

  it('does not flash an auth form while a stored session resolves', () => {
    authMock.isLoading = true;
    const { container } = render(<AuthLayout />);
    expect(container).toBeEmptyDOMElement();
  });

  it('takes a fresh signup to the username handoff', () => {
    authMock.user = { id: 'new-user', created_at: new Date().toISOString() };
    render(<AuthLayout />);
    expect(screen.getByTestId('router-redirect')).toHaveAttribute(
      'data-href',
      '/auth/pick-username',
    );
  });

  it('keeps an established account away from the username handoff', () => {
    authMock.user = { id: 'existing-user', created_at: '2012-10-01T15:47:15.000Z' };
    render(<AuthLayout />);
    expect(screen.getByTestId('router-redirect')).toHaveAttribute('data-href', '/(tabs)');
  });
});
