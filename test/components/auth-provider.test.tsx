// AuthProvider behavior, executed for real — the first tests to actually run
// lib/auth.tsx (signout-completeness.test.ts could only read its source).
//
// The network is mocked at the SDK boundary (@minds/sdk); storage is jsdom's
// real localStorage via lib/storage's web path, so persistence assertions
// check what a browser would actually hold.
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Text } from 'react-native';

const sdkMock = vi.hoisted(() => ({
  sendOtp: vi.fn(async () => ({})),
  verifyOtpAndCreateKey: vi.fn(),
  signUpAndCreateKey: vi.fn(),
  signInAndCreateKey: vi.fn(),
  revokeCurrentKey: vi.fn(async () => ({})),
  revokeAllSessions: vi.fn(async () => ({ data: { success: true } })),
  signOutSession: vi.fn(async () => undefined),
  usersMe: vi.fn(),
}));

vi.mock('@minds/sdk', () => {
  class Minds {
    apiKey: string;
    auth = {
      sendOtp: sdkMock.sendOtp,
      verifyOtpAndCreateKey: sdkMock.verifyOtpAndCreateKey,
      signUpAndCreateKey: sdkMock.signUpAndCreateKey,
      signInAndCreateKey: sdkMock.signInAndCreateKey,
      revokeCurrentKey: sdkMock.revokeCurrentKey,
      signOut: sdkMock.signOutSession,
    };
    settings = { revokeAllSessions: sdkMock.revokeAllSessions };
    users = { me: sdkMock.usersMe };
    constructor(config: { apiKey: string }) {
      this.apiKey = config?.apiKey;
    }
  }
  return { Minds };
});

// Side-effect boundaries that are not under test: push tokens, telemetry,
// the welcome-DM bootstrap, referral capture.
vi.mock('../../lib/notifications', () => ({
  registerPushToken: vi.fn(async () => null),
  registerTokenWithServer: vi.fn(async () => {}),
  unregisterTokenWithServer: vi.fn(async () => {}),
}));
vi.mock('../../lib/monitoring', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));
vi.mock('../../lib/mindsAI', () => ({
  bootstrapMindsAI: vi.fn(async () => {}),
}));
vi.mock('../../lib/referral', () => ({
  captureRefFromUrl: vi.fn(async () => {}),
  getPendingRef: vi.fn(async () => null),
  clearPendingRef: vi.fn(async () => true),
}));

import { AuthProvider, useAuth } from '../../lib/auth';

// The full set of storage keys sign-out must remove. Mirrors the list that
// lib/__tests__/signout-completeness.test.ts derives from the source.
const SIGNOUT_KEYS = [
  'minds:api_key',
  'minds:session_token',
  'minds:user',
  'minds:project_id',
  'minds:auth_version',
  'minds:bookmarks',
  'minds:muted',
  'minds:preferences',
  'minds:drafts:v2',
];

const AUTH_VERSION = '9';

type AuthValue = ReturnType<typeof useAuth>;
const probe: { current: AuthValue | null } = { current: null };

function Probe() {
  const auth = useAuth();
  probe.current = auth;
  return (
    <Text>
      {auth.isLoading ? 'auth:loading' : auth.isAuthenticated ? `auth:in:${auth.user?.username}` : 'auth:out'}
    </Text>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const serverUser = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  name: 'Jack',
  email: 'jack@example.com',
  username: 'jack',
  image: null,
  bio: 'hi',
  ...over,
});

function seedStoredSession(user = serverUser()) {
  window.localStorage.setItem('minds:auth_version', AUTH_VERSION);
  window.localStorage.setItem('minds:api_key', 'stored-key');
  window.localStorage.setItem('minds:user', JSON.stringify(user));
  window.localStorage.setItem('minds:project_id', 'proj-1');
}

async function signInAs(user = serverUser()) {
  sdkMock.signInAndCreateKey.mockResolvedValue({
    apiKey: 'key-abc',
    user,
    session: { token: 'sess-xyz' },
  });
  sdkMock.usersMe.mockResolvedValue({ data: user });
  renderAuth();
  await screen.findByText('auth:out');
  await act(async () => {
    await probe.current?.signIn(user.email, 'hunter2');
  });
}

describe('AuthProvider', () => {
  it('starts unauthenticated when nothing is stored', async () => {
    renderAuth();
    await screen.findByText('auth:out');
    expect(probe.current?.isAuthenticated).toBe(false);
    expect(probe.current?.user).toBeNull();
    expect(probe.current?.sdk).toBeNull();
  });

  it('signIn calls the SDK with the credentials and a project-scoped key request', async () => {
    await signInAs();
    expect(sdkMock.signInAndCreateKey).toHaveBeenCalledWith(
      { email: 'jack@example.com', password: 'hunter2' },
      expect.objectContaining({
        projectId: expect.any(String),
        scopes: expect.arrayContaining(['posts:read', 'posts:write', 'wallet:read']),
      }),
    );
  });

  it('successful signIn flips to authenticated and persists the session', async () => {
    await signInAs();
    await screen.findByText('auth:in:jack');
    expect(probe.current?.isAuthenticated).toBe(true);
    expect(probe.current?.user?.id).toBe('u1');
    expect(probe.current?.sdk).not.toBeNull();
    expect(window.localStorage.getItem('minds:api_key')).toBe('key-abc');
    expect(window.localStorage.getItem('minds:session_token')).toBe('sess-xyz');
    expect(window.localStorage.getItem('minds:auth_version')).toBe(AUTH_VERSION);
    expect(JSON.parse(window.localStorage.getItem('minds:user') ?? '{}').id).toBe('u1');
  });

  it('failed signIn rejects and stores no credentials', async () => {
    sdkMock.signInAndCreateKey.mockRejectedValue(new Error('Invalid credentials'));
    renderAuth();
    await screen.findByText('auth:out');
    await expect(probe.current?.signIn('jack@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
    expect(probe.current?.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('minds:api_key')).toBeNull();
    expect(window.localStorage.getItem('minds:session_token')).toBeNull();
  });

  it('signUp persists the session from the sign-up result', async () => {
    const createdAt = '2026-08-27T08:00:00.000Z';
    const user = serverUser({
      id: 'u9',
      username: 'newkid',
      email: 'new@example.com',
      name: 'New Kid',
      createdAt,
    });
    sdkMock.signUpAndCreateKey.mockResolvedValue({ apiKey: 'key-new', user, session: { token: 'sess-new' } });
    sdkMock.usersMe.mockResolvedValue({
      data: { ...user, created_at: createdAt, role: 'admin', plus: true, pro: false, founder: true },
    });
    renderAuth();
    await screen.findByText('auth:out');
    await act(async () => {
      await probe.current?.signUp('New Kid', 'new@example.com', 'pw123456');
    });
    await screen.findByText('auth:in:newkid');
    expect(window.localStorage.getItem('minds:api_key')).toBe('key-new');
    expect(probe.current?.user).toMatchObject({
      created_at: createdAt,
      role: 'admin',
      plus: true,
      pro: false,
      founder: true,
    });
    expect(JSON.parse(window.localStorage.getItem('minds:user') ?? '{}')).toMatchObject({
      created_at: createdAt,
      role: 'admin',
      plus: true,
      pro: false,
      founder: true,
    });
  });

  it('sendOtp delegates to the anonymous SDK', async () => {
    renderAuth();
    await screen.findByText('auth:out');
    await act(async () => {
      await probe.current?.sendOtp('otp@example.com');
    });
    expect(sdkMock.sendOtp).toHaveBeenCalledWith(
      { email: 'otp@example.com' },
      { projectId: expect.any(String) },
    );
  });

  it('signOut removes every key sign-out is responsible for', async () => {
    await signInAs();
    await screen.findByText('auth:in:jack');
    // Seed the user-data keys a session accumulates on a shared device.
    window.localStorage.setItem('minds:bookmarks', '["p1"]');
    window.localStorage.setItem('minds:muted', '["u2"]');
    window.localStorage.setItem('minds:preferences', '{"showNsfw":true}');
    window.localStorage.setItem('minds:drafts:v2', '[{"content":"unsent"}]');
    await act(async () => {
      await probe.current?.signOut();
    });
    for (const key of SIGNOUT_KEYS) {
      expect(window.localStorage.getItem(key), `${key} must be cleared on sign-out`).toBeNull();
    }
    expect(probe.current?.isAuthenticated).toBe(false);
    expect(probe.current?.user).toBeNull();
  });

  it('signOut revokes the server-side key it is holding', async () => {
    await signInAs();
    await act(async () => {
      await probe.current?.signOut();
    });
    expect(sdkMock.revokeCurrentKey).toHaveBeenCalled();
  });

  it('signOut still clears local state when key revocation fails', async () => {
    await signInAs();
    sdkMock.revokeCurrentKey.mockRejectedValue(new Error('offline'));
    await act(async () => {
      await probe.current?.signOut();
    });
    expect(window.localStorage.getItem('minds:api_key')).toBeNull();
    expect(probe.current?.isAuthenticated).toBe(false);
  });

  it('signOutEverywhere revokes every server credential then clears this device', async () => {
    await signInAs();
    sdkMock.revokeCurrentKey.mockClear();
    await act(async () => {
      await probe.current?.signOutEverywhere();
    });

    expect(sdkMock.revokeAllSessions).toHaveBeenCalledOnce();
    expect(sdkMock.revokeCurrentKey).not.toHaveBeenCalled();
    expect(sdkMock.signOutSession).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('minds:api_key')).toBeNull();
    expect(window.localStorage.getItem('minds:session_token')).toBeNull();
    expect(probe.current?.isAuthenticated).toBe(false);
  });

  it('keeps the current session usable when the server-wide revoke fails', async () => {
    await signInAs();
    sdkMock.revokeAllSessions.mockRejectedValueOnce(new Error('offline'));
    const auth = probe.current;
    expect(auth).not.toBeNull();
    if (!auth) throw new Error('auth probe was not mounted');

    await expect(auth.signOutEverywhere()).rejects.toThrow('offline');

    expect(window.localStorage.getItem('minds:api_key')).toBe('key-abc');
    expect(window.localStorage.getItem('minds:session_token')).toBe('sess-xyz');
    expect(probe.current?.isAuthenticated).toBe(true);
  });

  it('boot restores a stored session optimistically', async () => {
    seedStoredSession();
    sdkMock.usersMe.mockResolvedValue({ data: serverUser() });
    renderAuth();
    await screen.findByText('auth:in:jack');
    expect(probe.current?.sdk).not.toBeNull();
    expect(probe.current?.projectId).toBe('proj-1');
  });

  it('boot validation preserves account creation provenance', async () => {
    const createdAt = '2012-01-01T00:00:00.000Z';
    seedStoredSession(serverUser({ created_at: createdAt }));
    // A partial /users/me response may omit created_at while adding newer
    // fields. Canonicalization must not erase the cached provenance used by
    // the launch welcome gate.
    sdkMock.usersMe.mockResolvedValue({ data: serverUser({ role: 'admin' }) });
    renderAuth();
    await waitFor(() => expect(probe.current?.user?.role).toBe('admin'));
    expect(probe.current?.user?.created_at).toBe(createdAt);
    expect(JSON.parse(window.localStorage.getItem('minds:user') ?? '{}').created_at).toBe(createdAt);
  });

  it('boot with a stale auth version discards the stored session', async () => {
    seedStoredSession();
    // Version 8 keys can predate effective project binding even though the
    // client requested it. Version 9 deliberately forces those keys to remint.
    window.localStorage.setItem('minds:auth_version', '8');
    renderAuth();
    await screen.findByText('auth:out');
    expect(window.localStorage.getItem('minds:api_key')).toBeNull();
    expect(window.localStorage.getItem('minds:user')).toBeNull();
  });

  it('a definitive 401 during boot validation tears the session down', async () => {
    seedStoredSession();
    sdkMock.usersMe.mockRejectedValue(Object.assign(new Error('unauthorized'), { statusCode: 401 }));
    renderAuth();
    // Optimistic restore may flash first; the background validation must end
    // signed out with the credential gone.
    await screen.findByText('auth:out');
    await waitFor(() => {
      expect(window.localStorage.getItem('minds:api_key')).toBeNull();
    });
    expect(probe.current?.sdk).toBeNull();
  });

  it('a server error (500) during boot validation keeps the session', async () => {
    seedStoredSession();
    sdkMock.usersMe.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    renderAuth();
    await screen.findByText('auth:in:jack');
    // Give the background validation a beat to (wrongly) tear down.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.getByText('auth:in:jack')).toBeInTheDocument();
    expect(window.localStorage.getItem('minds:api_key')).toBe('stored-key');
  });

  it.each([
    ['account_banned', 'banned'],
    ['account_suspended', 'suspended'],
  ] as const)('a restricted account keeps its key for appeals (%s)', async (code, restriction) => {
    seedStoredSession();
    sdkMock.usersMe.mockRejectedValue(Object.assign(new Error(restriction), { status: 403, code }));
    renderAuth();
    await screen.findByText('auth:in:jack');
    await waitFor(() => {
      expect(probe.current?.accountRestriction).toBe(restriction);
    });
    expect(window.localStorage.getItem('minds:api_key')).toBe('stored-key');
    expect(probe.current?.sdk).not.toBeNull();
  });

  it('boot adopts the server identity when the stored user and key owner drift', async () => {
    seedStoredSession(); // stored display copy says u1/jack
    sdkMock.usersMe.mockResolvedValue({
      data: serverUser({ id: 'u2', username: 'sarah', name: 'Sarah', email: 'sarah@example.com' }),
    });
    renderAuth();
    await screen.findByText('auth:in:sarah');
    expect(JSON.parse(window.localStorage.getItem('minds:user') ?? '{}').id).toBe('u2');
  });
});
