import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReferralLink, captureRefFromUrl, clearPendingRef, getPendingRef, pickCode } from '../referral';

// pickCode decides which invite code becomes someone's shareable link. Getting
// it wrong hands out a DEAD link — a used or expired code produces a ?ref= that
// credits nobody, and neither the sharer nor the recipient can tell.

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('buildReferralLink', () => {
  it('produces an openable signup URL and encodes the invite code', () => {
    expect(buildReferralLink('MINDS/A B', 'https://minds.example/'))
      .toBe('https://minds.example/?ref=MINDS%2FA%20B');
  });
});

describe('pickCode — never hand out a dead link', () => {
  it('takes the first plain string from generate()', () => {
    expect(pickCode({ data: { codes: ['ABC123'] } })).toBe('ABC123');
  });

  it('takes an active, unused code from myCodes()', () => {
    expect(pickCode({ data: { codes: [{ code: 'GOOD', status: 'active' }] } })).toBe('GOOD');
  });

  it('REFUSES a code that has already been redeemed', () => {
    // Returning it would produce a link that silently credits nobody.
    expect(pickCode({ data: { codes: [{ code: 'SPENT', status: 'active', used_by: 'u1' }] } })).toBeNull();
  });

  it('REFUSES an expired code', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(pickCode({ data: { codes: [{ code: 'OLD', status: 'active', expires_at: past }] } })).toBeNull();
  });

  it('accepts a code expiring in the future', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    expect(pickCode({ data: { codes: [{ code: 'FRESH', expires_at: future }] } })).toBe('FRESH');
  });

  it('treats a malformed expires_at as expired rather than valid', () => {
    // new Date('nonsense').getTime() is NaN and NaN > now is false, so this
    // fails CLOSED. Asserted so a future "tidy up" cannot flip it open.
    expect(pickCode({ data: { codes: [{ code: 'BAD', expires_at: 'nonsense' }] } })).toBeNull();
  });

  it('skips spent codes to reach a good one', () => {
    const res = { data: { codes: [
      { code: 'SPENT', used_by: 'u1' },
      { code: 'USABLE', status: 'active' },
    ] } };
    expect(pickCode(res)).toBe('USABLE');
  });

  it('survives empty and malformed shapes', () => {
    expect(pickCode(null)).toBeNull();
    expect(pickCode({})).toBeNull();
    expect(pickCode({ data: { codes: [] } })).toBeNull();
  });
});

describe('captureRefFromUrl — attribution must not be lost silently', () => {
  function withUrl(search: string) {
    vi.stubGlobal('window', { location: { search }, localStorage: window.localStorage });
  }

  it('stores a valid code and reports success', async () => {
    withUrl('?ref=FRIEND1');
    expect(await captureRefFromUrl()).toBe(true);
    expect(await getPendingRef()).toBe('FRIEND1');
  });

  it('rejects a malformed code rather than storing it', async () => {
    withUrl(`?ref=${encodeURIComponent('../../etc/passwd')}`);
    expect(await captureRefFromUrl()).toBe(false);
    expect(await getPendingRef()).toBeNull();
  });

  it('reports FALSE when the write fails — the regression', async () => {
    // Previously fire-and-forget: a failed write lost the attribution and the
    // caller had no way to know.
    withUrl('?ref=FRIEND2');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(await captureRefFromUrl()).toBe(false);
  });
});

// The other half of the same story. captureRefFromUrl was fixed to await and
// report; clearPendingRef kept the shape it was fixed FROM -- an un-awaited
// setItem whose result was discarded -- so a failed clear was indistinguishable
// from a successful one.
//
// Bounded consequence, and worth saying plainly rather than dressing up:
// redemption is server-side idempotent per code, so a code that fails to clear
// is re-submitted next sign-in and does nothing. The cost is a stale code
// lingering for whoever signs up next on that device, and nobody being able to
// tell it happened.
describe('clearPendingRef — a failed clear must not look like a successful one', () => {
  it('clears a captured code and reports success', async () => {
    localStorage.setItem('minds:pendingRef', 'FRIEND9');
    expect(await clearPendingRef()).toBe(true);
    expect(await getPendingRef()).toBeNull();
  });

  it('reports FALSE when the write fails', async () => {
    localStorage.setItem('minds:pendingRef', 'FRIEND9');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(await clearPendingRef()).toBe(false);
  });

  it('a failed clear really did leave the code behind — the boolean matches reality', async () => {
    localStorage.setItem('minds:pendingRef', 'FRIEND9');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(await clearPendingRef()).toBe(false);
    vi.restoreAllMocks();
    expect(await getPendingRef()).toBe('FRIEND9');
  });

  it('never throws — signup must not fail because a cleanup write did', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    await expect(clearPendingRef()).resolves.toBe(false);
  });
});
