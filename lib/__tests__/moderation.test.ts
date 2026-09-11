import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blockUser, muteUser, unblockUser, unmuteUser } from '../moderation';

// block/mute threw on a failed response; unblock/unmute ignored theirs. So
// UNDOING a moderation action could fail silently: the UI dropped the person
// from the blocked list, the server still blocked them, and they reappeared on
// the next load with nothing explaining why.
//
// The asymmetry is the bug. These tests assert all four behave the same way,
// so restoring either half of it fails here.

function mockFetch(ok: boolean) {
  const fn = vi.fn(async () => ({ ok, status: ok ? 200 : 500 }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => { localStorage.setItem('minds:api_key', 'k'); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('moderation — a failed request must never look like success', () => {
  it('blockUser rejects on a failed response', async () => {
    mockFetch(false);
    await expect(blockUser('u1')).rejects.toThrow();
  });

  it('muteUser rejects on a failed response', async () => {
    mockFetch(false);
    await expect(muteUser('u1')).rejects.toThrow();
  });

  it('unblockUser rejects on a failed response — the regression', async () => {
    mockFetch(false);
    await expect(unblockUser('u1')).rejects.toThrow();
  });

  it('unmuteUser rejects on a failed response — the regression', async () => {
    mockFetch(false);
    await expect(unmuteUser('u1')).rejects.toThrow();
  });
});

describe('moderation — the happy path still resolves', () => {
  // Positive control: without these, the four tests above would also pass
  // against a function that threw unconditionally.
  it('all four resolve when the server accepts', async () => {
    mockFetch(true);
    await expect(blockUser('u1')).resolves.toBeUndefined();
    await expect(unblockUser('u1')).resolves.toBeUndefined();
    await expect(muteUser('u1')).resolves.toBeUndefined();
    await expect(unmuteUser('u1')).resolves.toBeUndefined();
  });

  it('hits the DELETE verb when undoing', async () => {
    const fn = mockFetch(true);
    await unblockUser('u42');
    const [url, init] = fn.mock.calls[0] as any[];
    expect(String(url)).toContain('/profiles/u42/block');
    expect(init.method).toBe('DELETE');
  });
});

// A failed LIST load used to return an empty array, which both screens render
// as "No blocked accounts" / "No muted accounts" — identical to the genuine
// empty state. On a moderation screen that is not a cosmetic problem: it tells
// someone their blocks are gone when they are not.
describe('moderation — a failed list load must be distinguishable from an empty one', () => {
  it('getBlockedUsers reports error on a failed response', async () => {
    mockFetch(false);
    const { getBlockedUsers } = await import('../moderation');
    const r = await getBlockedUsers({ limit: 10, offset: 0 });
    expect(r.data).toEqual([]);
    expect(r.error).toBe(true);      // ← the discriminator
  });

  it('getMutedUsers reports error on a failed response', async () => {
    mockFetch(false);
    const { getMutedUsers } = await import('../moderation');
    const r = await getMutedUsers({ limit: 10, offset: 0 });
    expect(r.error).toBe(true);
  });

  it.each([
    ['blocked', 'getBlockedUsers'],
    ['muted', 'getMutedUsers'],
  ] as const)('marks a thrown network failure on the %s list', async (_list, method) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const moderation = await import('../moderation');

    const r = await moderation[method]({ limit: 10, offset: 0 });

    expect(r).toEqual({ data: [], hasMore: false, error: true });
  });

  it('a genuinely empty list is NOT flagged as an error', async () => {
    // The positive control that makes the two above mean something: without it
    // they would pass against a function that set error unconditionally.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ data: [], has_more: false }),
    })));
    const { getBlockedUsers } = await import('../moderation');
    const r = await getBlockedUsers({ limit: 10, offset: 0 });
    expect(r.data).toEqual([]);
    expect(r.error).toBeFalsy();
  });
});
