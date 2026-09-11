import { describe, expect, it, vi } from 'vitest';
import { safeErrorSummary, verifyStagingOrg } from '../scripts/verify-staging-org.mjs';

const env: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  STAGING_BASE_URL: 'https://api.staging.recursiv.io/api/v1',
  STAGING_QA_EMAIL: 'qa@example.test',
  STAGING_QA_PASSWORD: 'not-a-real-password',
  STAGING_ORG_ID: '019fd8e0-e381-728f-9565-f16dacf27b4f',
  STAGING_PROJECT_ID: '019fd8e0-e4e9-703a-b259-8cbb8519d9cb',
};
const authenticatedUserId = '019fd8e0-f0c0-717e-a1bd-ef9c335292b9';

function fakeSdk(revokeError?: Error) {
  const revokeCurrentKey = vi.fn(async () => {
    if (revokeError) throw revokeError;
    return {};
  });
  const signInAndCreateKey = vi.fn(async (_credentials: unknown, _keyInput: Record<string, unknown>) => ({
    apiKey: 'secret-test-key',
    user: { id: authenticatedUserId },
  }));
  class FakeRecursiv {
    auth: { signInAndCreateKey?: typeof signInAndCreateKey; revokeCurrentKey?: typeof revokeCurrentKey };

    constructor(options: { apiKey?: string }) {
      this.auth = options.apiKey ? { revokeCurrentKey } : { signInAndCreateKey };
    }
  }
  return { FakeRecursiv, revokeCurrentKey, signInAndCreateKey };
}

describe('P4.2 staging organization proof', () => {
  it('reports safe structured auth diagnostics without exposing credentials', () => {
    const error = Object.assign(new Error(`throttled ${env.STAGING_QA_EMAIL}`), {
      name: 'RecursivError',
      status: 429,
      code: 'signin_failed',
      retryAfter: 30,
    });

    const output = safeErrorSummary(error, [env.STAGING_QA_EMAIL, env.STAGING_QA_PASSWORD]);

    expect(output).toContain('name=RecursivError');
    expect(output).toContain('status=429');
    expect(output).toContain('code=signin_failed');
    expect(output).toContain('retry_after=30');
    expect(output).toContain('message=throttled <redacted>');
    expect(output).not.toContain(env.STAGING_QA_EMAIL);
    expect(output).not.toContain(env.STAGING_QA_PASSWORD);
  });

  it('binds a 200 response id to the configured staging id without logging credentials', async () => {
    const { FakeRecursiv, revokeCurrentKey, signInAndCreateKey } = fakeSdk();
    const output: string[] = [];
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      json: async () => ({ data: { id: env.STAGING_ORG_ID, name: 'Minds staging' } }),
    }));

    await verifyStagingOrg({
      env,
      RecursivImpl: FakeRecursiv as any,
      fetchImpl: fetchImpl as any,
      log: (line: string) => output.push(line),
    });

    expect(signInAndCreateKey).toHaveBeenCalledWith(
      { email: env.STAGING_QA_EMAIL, password: env.STAGING_QA_PASSWORD },
      expect.objectContaining({
        projectId: env.STAGING_PROJECT_ID,
        scopes: ['organizations:read'],
      }),
    );
    const keyInput = signInAndCreateKey.mock.calls[0]?.[1];
    expect(keyInput).not.toHaveProperty('organizationId');
    expect(['userId', 'organizationId', 'projectId'].filter((field) => keyInput?.[field])).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      `${env.STAGING_BASE_URL}/organizations/${env.STAGING_ORG_ID}`,
      expect.objectContaining({ headers: { Authorization: 'Bearer secret-test-key' } }),
    );
    expect(output).toContain('HTTP 200');
    expect(output).toContain(`authenticated.user.id=${authenticatedUserId}`);
    expect(output).toContain(`configured.id=${env.STAGING_ORG_ID}`);
    expect(output).toContain(`response.id=${env.STAGING_ORG_ID}`);
    expect(output.join('\n')).not.toContain(env.STAGING_QA_EMAIL);
    expect(output.join('\n')).not.toContain(env.STAGING_QA_PASSWORD);
    expect(output.join('\n')).not.toContain('secret-test-key');
    expect(revokeCurrentKey).toHaveBeenCalledOnce();
  });

  it('honors one server cooldown before proving the staging organization', async () => {
    vi.useFakeTimers();
    const { FakeRecursiv, signInAndCreateKey } = fakeSdk();
    signInAndCreateKey.mockRejectedValueOnce(Object.assign(new Error('throttled'), {
      status: 429,
      retryAfter: 1,
    }));
    const output: string[] = [];
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      json: async () => ({ data: { id: env.STAGING_ORG_ID } }),
    }));

    const proof = verifyStagingOrg({
      env,
      RecursivImpl: FakeRecursiv as any,
      fetchImpl: fetchImpl as any,
      log: (line: string) => output.push(line),
    });
    await vi.runAllTimersAsync();
    await proof;
    vi.useRealTimers();

    expect(signInAndCreateKey).toHaveBeenCalledTimes(2);
    expect(output).toContain(
      '::warning::Staging authentication rate-limited; retrying once after 1s server cooldown.',
    );
    expect(output).toContain('P4.2 STAGING ORG BINDING PASS');
  });

  it('rejects a sign-in result that cannot identify the authenticated user', async () => {
    const { FakeRecursiv, revokeCurrentKey, signInAndCreateKey } = fakeSdk();
    signInAndCreateKey.mockResolvedValueOnce({ apiKey: 'secret-test-key', user: { id: 'not-a-uuid' } });

    await expect(
      verifyStagingOrg({ env, RecursivImpl: FakeRecursiv as any, fetchImpl: vi.fn() as any, log: () => {} }),
    ).rejects.toThrow('did not return a valid authenticated user id');
    expect(revokeCurrentKey).toHaveBeenCalledOnce();
  });

  it('rejects a row from the wrong organization and still revokes the temporary key', async () => {
    const { FakeRecursiv, revokeCurrentKey } = fakeSdk();
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => ({ data: { id: 'wrong-org' } }) }));

    await expect(
      verifyStagingOrg({ env, RecursivImpl: FakeRecursiv as any, fetchImpl: fetchImpl as any, log: () => {} }),
    ).rejects.toThrow('staging organization id mismatch');
    expect(revokeCurrentKey).toHaveBeenCalledOnce();
  });

  it('rejects a non-200 response and still revokes the temporary key', async () => {
    const { FakeRecursiv, revokeCurrentKey } = fakeSdk();
    const fetchImpl = vi.fn(async () => ({ status: 404, json: async () => ({ error: 'not found' }) }));

    await expect(
      verifyStagingOrg({ env, RecursivImpl: FakeRecursiv as any, fetchImpl: fetchImpl as any, log: () => {} }),
    ).rejects.toThrow('returned HTTP 404');
    expect(revokeCurrentKey).toHaveBeenCalledOnce();
  });

  it('refuses a production or lookalike origin before transmitting credentials', async () => {
    const { FakeRecursiv, signInAndCreateKey } = fakeSdk();
    const fetchImpl = vi.fn();

    await expect(
      verifyStagingOrg({
        env: { ...env, STAGING_BASE_URL: 'https://api.minds.com/api/v1' },
        RecursivImpl: FakeRecursiv as any,
        fetchImpl: fetchImpl as any,
        log: () => {},
      }),
    ).rejects.toThrow('refusing non-staging API origin');
    expect(signInAndCreateKey).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('does not report a pass when the temporary key cannot be revoked', async () => {
    const { FakeRecursiv } = fakeSdk(new Error('revoke unavailable'));
    const output: string[] = [];
    const fetchImpl = vi.fn(async () => ({
      status: 200,
      json: async () => ({ data: { id: env.STAGING_ORG_ID } }),
    }));

    await expect(
      verifyStagingOrg({
        env,
        RecursivImpl: FakeRecursiv as any,
        fetchImpl: fetchImpl as any,
        log: (line: string) => output.push(line),
      }),
    ).rejects.toThrow('revoke unavailable');
    expect(output).not.toContain('P4.2 STAGING ORG BINDING PASS');
  });
});
