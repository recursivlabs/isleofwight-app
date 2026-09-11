import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_ID } from './recursiv';
import { sendSignInOtp } from './sendSignInOtp';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendSignInOtp', () => {
  it('retries one transient browser failure with the same project-scoped request', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendSignInOtp('bill@minds.com')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(fetchMock.mock.calls[0][0]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: fetchMock.mock.calls[0][1]?.method,
      body: fetchMock.mock.calls[0][1]?.body,
    });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('x-recursiv-app-project')).toBe(PROJECT_ID);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({
      email: 'bill@minds.com',
      type: 'sign-in',
    }));
  });
});
