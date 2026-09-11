import { describe, expect, it } from 'vitest';
import { parseEmailChangeUrl } from '../emailChangeUrl';

describe('email change URL privacy', () => {
  it('reads a fragment token and removes it from browser history', () => {
    expect(parseEmailChangeUrl('https://minds.example/verify-email-change?source=email#token=a+b%26c&native=0')).toEqual({
      token: 'a b&c',
      cleanPath: '/verify-email-change?source=email#native=0',
    });
  });

  it('keeps legacy query links usable while removing the token', () => {
    expect(parseEmailChangeUrl('https://minds.example/verify-email-change?token=legacy&source=email')).toEqual({
      token: 'legacy',
      cleanPath: '/verify-email-change?source=email',
    });
  });

  it('prefers a fragment token when both formats are present', () => {
    expect(parseEmailChangeUrl('https://minds.example/verify-email-change?token=old#token=current')?.token).toBe('current');
  });
});
