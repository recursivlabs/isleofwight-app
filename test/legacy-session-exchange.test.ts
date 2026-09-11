import { describe, expect, it, vi } from 'vitest';
import { legacySessionExchange } from '../lib/legacySessionExchange';

describe('legacySessionExchange', () => {
  it('posts the legacy token with the app-project header and returns the session and user', async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      expect(url).toBe('https://api.minds.com/api/auth/legacy-handoff');
      expect(init.headers['x-recursiv-app-project']).toBe('proj');
      expect(JSON.parse(init.body)).toEqual({ legacy_token: 'x'.repeat(40) });
      return new Response(JSON.stringify({ token: 't', session: { token: 't' }, user: { id: 'u1', username: 'john' } }), { status: 200 });
    });
    const out = await legacySessionExchange('https://api.minds.com', 'proj', 'x'.repeat(40), fetchMock as any);
    expect(out).toEqual({ sessionToken: 't', user: { id: 'u1', username: 'john' } });
  });

  it('throws with the server code on a non-2xx', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'nope', code: 'legacy_token_invalid' }), { status: 401 }));
    await expect(legacySessionExchange('https://api.minds.com', 'proj', 'x'.repeat(40), fetchMock as any)).rejects.toMatchObject({ code: 'legacy_token_invalid', status: 401 });
  });

  it('throws when the body carries no session', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ user: { id: 'u1' } }), { status: 200 }));
    await expect(legacySessionExchange('https://api.minds.com', 'proj', 'x'.repeat(40), fetchMock as any)).rejects.toMatchObject({ code: 'legacy_handoff_failed' });
  });
});
