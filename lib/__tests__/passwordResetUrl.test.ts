import { describe, expect, it } from 'vitest';
import {
  parsePasswordResetUrl,
  PASSWORD_RESET_FRAGMENT_KEY,
  PASSWORD_RESET_FRAGMENT_VALUE,
  passwordResetRedirectUrl,
} from '../passwordResetUrl';

describe('password reset URL privacy', () => {
  it('opts into fragment delivery on the reset route', () => {
    expect(passwordResetRedirectUrl('https://minds.on.recursiv.io')).toBe(
      `https://minds.on.recursiv.io/reset-password#${PASSWORD_RESET_FRAGMENT_KEY}=${PASSWORD_RESET_FRAGMENT_VALUE}`,
    );
  });

  it('reads a fragment token and returns a token-free history path', () => {
    expect(
      parsePasswordResetUrl('https://minds.on.recursiv.io/reset-password?source=email#token=secret&native=0'),
    ).toEqual({
      token: 'secret',
      error: null,
      cleanPath: '/reset-password?source=email#native=0',
    });
  });

  it('keeps already-issued query links working and removes the rollout marker', () => {
    const marker = `${PASSWORD_RESET_FRAGMENT_KEY}=${PASSWORD_RESET_FRAGMENT_VALUE}`;
    expect(
      parsePasswordResetUrl(`https://minds.on.recursiv.io/reset-password?token=legacy#${marker}`),
    ).toEqual({
      token: 'legacy',
      error: null,
      cleanPath: '/reset-password',
    });
  });

  it('prefers fragment delivery if both token formats are present', () => {
    expect(
      parsePasswordResetUrl('https://minds.on.recursiv.io/reset-password?token=legacy#token=current')?.token,
    ).toBe('current');
  });

  it('removes invalid-link errors from browser history too', () => {
    expect(parsePasswordResetUrl('https://minds.on.recursiv.io/reset-password?error=INVALID_TOKEN')).toEqual({
      token: null,
      error: 'INVALID_TOKEN',
      cleanPath: '/reset-password',
    });
  });
});
