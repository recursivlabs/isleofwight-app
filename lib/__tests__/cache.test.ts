import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setCache, getCached, getCacheGeneration, setCacheUser, isFresh, invalidate, invalidatePrefix, clearAll } from '../cache';

beforeEach(() => clearAll());
afterEach(() => vi.useRealTimers());

describe('cache', () => {
  it('keeps the generation stable for ordinary writes and the same namespace', async () => {
    await setCacheUser('generation-user-a');
    const generation = getCacheGeneration();
    setCache('k', 1);
    invalidate('k');
    await setCacheUser('generation-user-a');
    expect(getCacheGeneration()).toBe(generation);
  });

  it('invalidates captured generations even when switching back to the original account', async () => {
    await setCacheUser('generation-user-a');
    const generation = getCacheGeneration();
    await setCacheUser('generation-user-b');
    expect(getCacheGeneration()).not.toBe(generation);
    await setCacheUser('generation-user-a');
    expect(getCacheGeneration()).not.toBe(generation);
  });

  it('changes generation synchronously when clearing a session', async () => {
    const generation = getCacheGeneration();
    const cleared = clearAll();
    expect(getCacheGeneration()).not.toBe(generation);
    await cleared;
  });

  it('stores and retrieves a value', () => {
    setCache('k', { a: 1 });
    expect(getCached('k')).toEqual({ a: 1 });
    expect(getCached('missing')).toBeNull();
  });

  it('isFresh is true right after set, false after the 30s window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    setCache('k', 1);
    expect(isFresh('k')).toBe(true);
    vi.setSystemTime(new Date('2026-01-01T00:00:31Z')); // +31s
    expect(isFresh('k')).toBe(false);
    // stale-while-revalidate: value is still readable, just not fresh
    expect(getCached('k')).toBe(1);
  });

  it('invalidate removes a single key', () => {
    setCache('k', 1);
    invalidate('k');
    expect(getCached('k')).toBeNull();
  });

  it('invalidatePrefix removes all keys with the prefix', () => {
    setCache('post:1', 'a');
    setCache('post:2', 'b');
    setCache('user:1', 'c');
    invalidatePrefix('post:');
    expect(getCached('post:1')).toBeNull();
    expect(getCached('post:2')).toBeNull();
    expect(getCached('user:1')).toBe('c');
  });
});

// clearAll's own contract is "called on sign-out so a signed-out browser holds
// no identity-scoped data". It used to swallow the web failure and, on native,
// fire the removal without awaiting it from a synchronous function — so a failed
// clear was unobservable, and sign-out could return before the removal had even
// been attempted. auth.tsx cites this function as the precedent for the same
// argument it makes about local storage, so it needs the same guarantee.
describe('clearAll reports whether the persisted namespace was cleared', () => {
  it('drops the in-memory store and reports success', async () => {
    setCache('k', 1);
    expect(await clearAll()).toBe(true);
    expect(getCached('k')).toBeNull();
  });

  it('reports FALSE when the persisted removal fails', async () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(await clearAll()).toBe(false);
  });

  it('still drops the in-memory copy even when the persisted removal fails', async () => {
    // Half-cleared is the right failure: the running session must not keep
    // serving the signed-out account's data just because the disk write failed.
    setCache('k', 1);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(await clearAll()).toBe(false);
    expect(getCached('k')).toBeNull();
  });

  it('never throws — a failed clear must not crash sign-out', async () => {
    // Throwing here would leave the user signed IN with their session intact,
    // which is strictly worse than a cache that outlives the sign-out.
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    await expect(clearAll()).resolves.toBe(false);
  });

  it('POSITIVE CONTROL: a normal clear reports TRUE, so FALSE means something', async () => {
    expect(await clearAll()).toBe(true);
  });
});
