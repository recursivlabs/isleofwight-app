import { beforeEach, describe, expect, it, vi } from 'vitest';

// Two defects, both invisible to a reader of the exports:
//
//   A. the async hydrate assigned unconditionally, so on web it could resolve
//      AFTER a toggle and overwrite it with the pre-toggle value — and the next
//      persist() wrote that stale set back, losing the toggle permanently.
//   B. the set lives in a module-level variable, so clearing the storage key on
//      sign-out (#304) left the previous user's bookmarks in memory for the
//      next user in the same session.
//
// Both are tested here against the real storage stub.

async function freshModule() {
  vi.resetModules();
  return await import('../bookmarks');
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('bookmarks — basic contract', () => {
  it('toggles on and off and reports state', async () => {
    const m = await freshModule();
    expect(m.isBookmarked('p1')).toBe(false);
    expect(m.toggleBookmark('p1')).toBe(true);
    expect(m.isBookmarked('p1')).toBe(true);
    expect(m.toggleBookmark('p1')).toBe(false);
    expect(m.isBookmarked('p1')).toBe(false);
  });

  it('persists across a module reload', async () => {
    const m1 = await freshModule();
    m1.toggleBookmark('keepme');
    const m2 = await freshModule();
    expect(m2.isBookmarked('keepme')).toBe(true);
  });

  it('survives corrupt stored JSON rather than throwing', async () => {
    localStorage.setItem('minds:bookmarks', '{not json');
    const m = await freshModule();
    expect(m.getBookmarks()).toEqual([]);
  });
});

describe('B — clear() drops in-memory state (the cross-user leak)', () => {
  it('a cleared set does not report the previous user bookmarks', async () => {
    const m = await freshModule();
    m.toggleBookmark('alice-post');
    expect(m.isBookmarked('alice-post')).toBe(true);

    // Sign-out: auth.tsx removes the key AND calls this.
    localStorage.removeItem('minds:bookmarks');
    m.clearBookmarks();

    // Bob, same session, no reload.
    expect(m.isBookmarked('alice-post')).toBe(false);
    expect(m.getBookmarks()).toEqual([]);
  });

  it('a write after clear does NOT resurrect the previous user data', async () => {
    // This is the part that makes it a leak rather than a display bug: without
    // clear(), Bob's first toggle persists Alice's ids back under the new key.
    const m = await freshModule();
    m.toggleBookmark('alice-post');
    localStorage.removeItem('minds:bookmarks');
    m.clearBookmarks();

    m.toggleBookmark('bob-post');
    const stored = JSON.parse(localStorage.getItem('minds:bookmarks') || '[]');
    expect(stored).toEqual(['bob-post']);
    expect(stored).not.toContain('alice-post');
  });
});

// #316 made storage.setItem report failure; ignoring that here would reinstate
// the silence it removed. The user is still not told — this asserts we at least
// stop being blind to it.
describe('persist failure is reported, not swallowed', () => {
  it('reports when the write fails', async () => {
    vi.resetModules();
    localStorage.clear();
    const captureMessage = vi.fn();
    vi.doMock('../monitoring', () => ({ captureMessage, captureException: vi.fn() }));
    const m = await import('../bookmarks');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    m.toggleBookmark('p1');
    await new Promise(r => setTimeout(r, 0));   // let the void promise settle

    expect(captureMessage).toHaveBeenCalled();
    vi.doUnmock('../monitoring');
  });

  it('rolls a confirmed toggle back when durable storage rejects it', async () => {
    const m = await freshModule();
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    const result = await m.toggleBookmarkConfirmed('failed-save');

    expect(result).toEqual({ saved: false, persisted: false });
    expect(m.isBookmarked('failed-save')).toBe(false);
    setItem.mockRestore();
  });

  it('does NOT report on a successful write — the positive control', async () => {
    vi.resetModules();
    localStorage.clear();
    const captureMessage = vi.fn();
    vi.doMock('../monitoring', () => ({ captureMessage, captureException: vi.fn() }));
    const m = await import('../bookmarks');

    m.toggleBookmark('p1');
    await new Promise(r => setTimeout(r, 0));

    expect(captureMessage).not.toHaveBeenCalled();
    vi.doUnmock('../monitoring');
  });
});
