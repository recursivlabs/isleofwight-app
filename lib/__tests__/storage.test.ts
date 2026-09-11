import { afterEach, describe, expect, it, vi } from 'vitest';
import { getItem, getItemSync, removeItem, setItem } from '../storage';

// storage.setItem swallowed write failures and resolved void, so a full or
// unavailable store was indistinguishable from a successful save. Everything
// that persists — the API key, bookmarks, mutes, preferences, drafts — goes
// through here, so the silence propagated to all of them.

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

describe('storage — round trip', () => {
  it('writes, reads and removes', async () => {
    expect(await setItem('k', 'v')).toBe(true);
    expect(await getItem('k')).toBe('v');
    expect(getItemSync('k')).toBe('v');
    await removeItem('k');
    expect(await getItem('k')).toBeNull();
  });

  it('reports a missing key as null rather than throwing', async () => {
    expect(await getItem('never-written')).toBeNull();
    expect(getItemSync('never-written')).toBeNull();
  });
});

describe('storage — a failed write must be reportable', () => {
  it('resolves FALSE when the store rejects the write (quota, private mode)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(await setItem('k', 'v')).toBe(false);
  });

  it('still does not throw — a failed save must never crash the caller', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    await expect(setItem('k', 'v')).resolves.toBe(false);
  });

  it('resolves TRUE on a normal write — the positive control', async () => {
    // Without this, the two above would pass against a setItem that always
    // returned false, which would be a different bug with the same green.
    expect(await setItem('k', 'v')).toBe(true);
  });
});

describe('storage — a failed REMOVE must be reportable', () => {
  // The same argument as the writes above, pointed the other way, and with a
  // worse consequence. A remove that fails is how one person's bookmarks, mutes,
  // DM mute/archive metadata and unsent drafts stay on a device for whoever signs
  // in next. sign-out is the only thing standing between two accounts here.
  //
  // The web branch was the sharp edge: it caught the failure internally and
  // resolved normally, so a caller wrapping the call in .catch() could not have
  // observed it even in principle. Unobservable, not merely unhandled.
  it('resolves FALSE when the store rejects the removal', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(await removeItem('k')).toBe(false);
  });

  it('still does not throw — a failed clear must never crash sign-out', async () => {
    // sign-out must complete even when a key will not go away: a crash here
    // leaves the user signed IN with their session intact, which is worse.
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    await expect(removeItem('k')).resolves.toBe(false);
  });

  it('resolves TRUE on a normal removal — the positive control', async () => {
    // Without this, the two above would pass against a removeItem that always
    // returned false, and sign-out would report a leak on every single call.
    await setItem('k', 'v');
    expect(await removeItem('k')).toBe(true);
    expect(await getItem('k')).toBeNull();
  });
});
