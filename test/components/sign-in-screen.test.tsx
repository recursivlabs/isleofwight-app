import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { __setLocalSearchParams } from '../component-stubs/expo-router';

import SignInCompatibilityRoute from '../../app/(auth)/sign-in';

describe('sign-in compatibility route', () => {
  it('redirects into the canonical login state', () => {
    render(<SignInCompatibilityRoute />);

    expect(screen.getByTestId('router-redirect')).toHaveAttribute(
      'data-href',
      JSON.stringify({ pathname: '/', params: { auth: 'login' } }),
    );
  });

  it('preserves the requested post-auth destination', () => {
    __setLocalSearchParams({ returnTo: '/post/post-123?ref=invite' });
    render(<SignInCompatibilityRoute />);

    expect(screen.getByTestId('router-redirect')).toHaveAttribute(
      'data-href',
      JSON.stringify({
        pathname: '/',
        params: { auth: 'login', returnTo: '/post/post-123?ref=invite' },
      }),
    );
  });
});
