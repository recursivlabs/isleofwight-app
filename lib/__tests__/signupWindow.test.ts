import { describe, expect, it } from 'vitest';
import { NEW_ACCOUNT_WINDOW_MS, isFreshSignup } from '../signupWindow';

// #189: a device-local "picked a username" flag meant an existing user signing
// in on a NEW PHONE was forced through the username picker, and accepting its
// email-derived guess silently RENAMED their account — breaking every link and
// @mention to them. One sign-in minted `bill-1` on an account created in 2012.
//
// This predicate is the guard. Its failure direction is the design: when in
// doubt, treat the account as ESTABLISHED and never rename anybody.

const NOW = Date.parse('2026-08-02T12:00:00.000Z');

describe('isFreshSignup — only a genuine new signup may be re-prompted', () => {
  it('is true for an account created seconds ago', () => {
    expect(isFreshSignup(new Date(NOW - 5_000).toISOString(), NOW)).toBe(true);
  });

  it('is FALSE for an account created in 2012 — the reported bug', () => {
    // The literal account from the issue.
    expect(isFreshSignup('2012-10-01T15:47:15.000Z', NOW)).toBe(false);
  });

  it('is false just outside the window, true just inside', () => {
    expect(isFreshSignup(new Date(NOW - NEW_ACCOUNT_WINDOW_MS - 1).toISOString(), NOW)).toBe(false);
    expect(isFreshSignup(new Date(NOW - NEW_ACCOUNT_WINDOW_MS + 1).toISOString(), NOW)).toBe(true);
  });
});

describe('isFreshSignup — every uncertain input must fail SAFE', () => {
  // Each of these could plausibly be read as "no creation date, so this must be
  // a new account". That reading destroys identities. Assert the opposite.
  it('treats undefined as established', () => {
    expect(isFreshSignup(undefined, NOW)).toBe(false);
  });

  it('treats null and empty string as established', () => {
    expect(isFreshSignup(null, NOW)).toBe(false);
    expect(isFreshSignup('', NOW)).toBe(false);
  });

  it('treats an unparseable date as established', () => {
    expect(isFreshSignup('not-a-date', NOW)).toBe(false);
  });

  it('treats a FUTURE timestamp as established, not as a fresh signup', () => {
    // Clock skew between device and server is real; a future created_at must
    // not read as "created just now".
    expect(isFreshSignup(new Date(NOW + 60_000).toISOString(), NOW)).toBe(false);
  });
});
