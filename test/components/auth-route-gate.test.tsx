import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __setLocalSearchParams, __setPathname } from '../component-stubs/expo-router';

const authMock = vi.hoisted(() => ({
  user: null as null | { id: string },
  isLoading: false,
}));

vi.mock('../../lib/auth', () => ({
  useAuth: () => authMock,
}));

import { AuthRouteGate, isPrivateRoute } from '../../lib/guards';

const privateScreenRender = vi.fn();
function PrivateScreen() {
  privateScreenRender();
  return <div data-testid="private-screen">Private</div>;
}

describe('AuthRouteGate', () => {
  beforeEach(() => {
    authMock.user = null;
    authMock.isLoading = false;
    window.history.replaceState({}, '', '/');
  });

  it('routes signed-out private screens through OTP and preserves query state', () => {
    __setPathname('/create', ['(tabs)', 'create']);
    __setLocalSearchParams({ quotePostId: 'post-123' });
    window.history.replaceState({}, '', '/create?quotePostId=post-123');

    render(
      <AuthRouteGate>
        <PrivateScreen />
      </AuthRouteGate>,
    );

    expect(screen.getByTestId('router-redirect')).toHaveAttribute(
      'data-href',
      '/auth/sign-in?auth=otp&returnTo=%2Fcreate%3FquotePostId%3Dpost-123',
    );
    expect(screen.queryByTestId('private-screen')).not.toBeInTheDocument();
    expect(privateScreenRender).not.toHaveBeenCalled();
  });

  it('does not mount a private screen while a stored session resolves', () => {
    __setPathname('/billing');
    authMock.isLoading = true;

    const { container } = render(
      <AuthRouteGate>
        <PrivateScreen />
      </AuthRouteGate>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(privateScreenRender).not.toHaveBeenCalled();
  });

  it('mounts the requested private screen after authentication', () => {
    __setPathname('/notifications');
    authMock.user = { id: 'user-1' };

    render(
      <AuthRouteGate>
        <div data-testid="private-screen">Notifications</div>
      </AuthRouteGate>,
    );

    expect(screen.getByTestId('private-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('router-redirect')).not.toBeInTheDocument();
  });

  it.each([
    '/',
    '/post/post-1',
    '/user/alice',
    '/community/community-1',
    '/groups',
    '/privacy',
    '/moderation',
    '/upgrade',
  ])('keeps the public route %s available signed out', (pathname) => {
    __setPathname(pathname);

    render(
      <AuthRouteGate>
        <div data-testid="public-screen">Public</div>
      </AuthRouteGate>,
    );

    expect(screen.getByTestId('public-screen')).toBeInTheDocument();
  });

  it.each([
    '/create',
    '/notifications',
    '/(tabs)/notifications',
    '/chat/thread-1',
    '/billing',
    '/invites',
    '/bookmarks',
    '/wallet',
    '/settings',
    '/blocked',
    '/muted',
    '/feedback',
    '/admin',
    '/protocols',
    '/verify-email-change',
    '/auth/pick-username',
  ])('classifies %s as private', (pathname) => {
    expect(isPrivateRoute(pathname)).toBe(true);
  });
});
