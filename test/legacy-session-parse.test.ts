import { describe, expect, it } from 'vitest';
import { pickLegacyToken } from '../lib/legacySessionParse';

const oauth = {
  authType: 0,
  user: { guid: '100000000000000134', username: 'john', email: ' John@Minds.com ' },
  accessToken: { access_token: 'a'.repeat(40), access_token_expires: 1790000000 },
  refreshToken: { refresh_token: 'r'.repeat(40), refresh_token_expires: 1800000000 },
};
const cookie = { authType: 1, user: { guid: '100000000000091089', username: 'animals' }, sessionToken: `eyJ${'c'.repeat(60)}` };

describe('pickLegacyToken', () => {
  it('picks the active OAuth session access token', () => {
    const raw = JSON.stringify({ tokensData: [cookie, oauth], activeIndex: 1 });
    expect(pickLegacyToken(raw)).toEqual({ token: 'a'.repeat(40), guid: '100000000000000134', username: 'john', email: 'john@minds.com', authType: 'oauth' });
  });

  it('picks a cookie session token as a bearer', () => {
    const raw = JSON.stringify({ tokensData: [cookie], activeIndex: 0 });
    expect(pickLegacyToken(raw)).toMatchObject({ token: cookie.sessionToken, guid: '100000000000091089', authType: 'cookie' });
  });

  it('falls back to the first session when the index is out of range', () => {
    const raw = JSON.stringify({ tokensData: [oauth], activeIndex: 7 });
    expect(pickLegacyToken(raw)?.guid).toBe('100000000000000134');
  });

  it('returns null for nothing stored, bad JSON, an empty list, or a session without a usable token', () => {
    expect(pickLegacyToken(null)).toBeNull();
    expect(pickLegacyToken('{not json')).toBeNull();
    expect(pickLegacyToken(JSON.stringify({ tokensData: [], activeIndex: 0 }))).toBeNull();
    expect(pickLegacyToken(JSON.stringify({ tokensData: [{ authType: 0, user: { guid: '1' }, accessToken: { access_token: 'short' } }], activeIndex: 0 }))).toBeNull();
  });

  it('keeps invalid stored email values out of the sign-in hint', () => {
    const raw = JSON.stringify({
      tokensData: [{ ...cookie, user: { ...cookie.user, email: 'not an email' } }],
      activeIndex: 0,
    });
    expect(pickLegacyToken(raw)?.email).toBeNull();
  });
});
