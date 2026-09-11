import { describe, expect, it } from 'vitest';
import { otpSignInPath, rootPostAuthDestination, safeReturnTo, signInPath } from './authRedirect';

describe('authentication redirects', () => {
  it('preserves an internal post route through OTP sign-in', () => {
    expect(otpSignInPath('/post/post-1')).toBe('/auth/sign-in?auth=otp&returnTo=%2Fpost%2Fpost-1');
    expect(safeReturnTo('/post/post-1?thread=latest')).toBe('/post/post-1?thread=latest');
  });

  it('uses the unambiguous authentication route for password login', () => {
    expect(signInPath('login', '/discover/posts?q=privacy')).toBe(
      '/auth/sign-in?auth=login&returnTo=%2Fdiscover%2Fposts%3Fq%3Dprivacy',
    );
  });

  it.each([
    'https://attacker.example/post/1',
    '//attacker.example/post/1',
    '/\\attacker.example/post/1',
    '/post/1\nLocation: https://attacker.example',
  ])('rejects unsafe return destination %s', value => {
    expect(safeReturnTo(value)).toBe('/(tabs)');
  });

  it('falls back for missing or excessively long destinations', () => {
    expect(safeReturnTo(undefined)).toBe('/(tabs)');
    expect(safeReturnTo(`/${'a'.repeat(2_048)}`)).toBe('/(tabs)');
  });

  it('preserves validated feed state through the signed-in root redirect', () => {
    expect(rootPostAuthDestination({ tab: 'following', posted: '1787960824781' })).toBe(
      '/(tabs)?tab=following&posted=1787960824781',
    );
    expect(rootPostAuthDestination({ tab: 'foryou' })).toBe('/(tabs)?tab=foryou');
  });

  it('drops invalid root feed params and lets an explicit return path win', () => {
    expect(rootPostAuthDestination({ tab: 'admin', posted: 'not-a-timestamp' })).toBe('/(tabs)');
    expect(rootPostAuthDestination({
      returnTo: '/post/post-1?reply=1',
      tab: 'following',
      posted: '1787960824781',
    })).toBe('/post/post-1?reply=1');
  });
});
