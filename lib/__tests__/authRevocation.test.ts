import { describe, expect, it, vi } from 'vitest';
import { revokeStoredCredentials } from '../authRevocation';

describe('stored auth credential revocation', () => {
  it('revokes both credential classes when leaving an account', async () => {
    const revokeApiKey = vi.fn().mockResolvedValue(undefined);
    const revokeSession = vi.fn().mockResolvedValue(undefined);

    const failed = await revokeStoredCredentials({
      apiKey: 'api-key',
      sessionToken: 'session-token',
      revokeApiKey,
      revokeSession,
    });

    expect(revokeApiKey).toHaveBeenCalledWith('api-key');
    expect(revokeSession).toHaveBeenCalledWith('session-token');
    expect(failed).toEqual([]);
  });

  it('still revokes the session when API-key revocation fails', async () => {
    const revokeApiKey = vi.fn().mockRejectedValue(new Error('offline'));
    const revokeSession = vi.fn().mockResolvedValue(undefined);

    const failed = await revokeStoredCredentials({
      apiKey: 'api-key',
      sessionToken: 'session-token',
      revokeApiKey,
      revokeSession,
    });

    expect(revokeSession).toHaveBeenCalledWith('session-token');
    expect(failed).toEqual(['api_key']);
  });

  it('skips credential classes that were never stored', async () => {
    const revokeApiKey = vi.fn();
    const revokeSession = vi.fn();

    const failed = await revokeStoredCredentials({
      apiKey: null,
      sessionToken: null,
      revokeApiKey,
      revokeSession,
    });

    expect(revokeApiKey).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
    expect(failed).toEqual([]);
  });
});
