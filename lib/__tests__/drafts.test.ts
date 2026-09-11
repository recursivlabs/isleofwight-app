import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  saveDraft,
  saveDraftConfirmed,
  getLatestDraft,
  clearDraft,
  clearDraftConfirmed,
  deleteDraftConfirmed,
} from '../drafts';

beforeEach(() => {
  clearDraft();
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('drafts', () => {
  it('saves and restores a recent draft', () => {
    saveDraft('hello world');
    expect(getLatestDraft()?.content).toBe('hello world');
  });

  it('keeps only a single slot (regression: old code accumulated ghosts)', () => {
    saveDraft('first');
    saveDraft('second');
    expect(getLatestDraft()?.content).toBe('second');
  });

  it('clearDraft removes the draft (cleared on successful post)', () => {
    saveDraft('to be posted');
    clearDraft();
    expect(getLatestDraft()).toBeNull();
  });

  it('does NOT restore a draft older than 24h (regression: resurrecting posted text)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    saveDraft('stale text');
    expect(getLatestDraft()?.content).toBe('stale text');
    vi.setSystemTime(new Date('2026-01-02T01:00:00Z')); // +25h
    expect(getLatestDraft()).toBeNull();
  });

  it('reports when the in-memory draft did not reach durable storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => { throw new Error('storage full'); });

    const result = await saveDraftConfirmed('keep this visible');

    expect(result.persisted).toBe(false);
    expect(getLatestDraft()?.content).toBe('keep this visible');
    setItem.mockRestore();
  });

  it('clears a published draft by removing the key, even when writes are full', async () => {
    await saveDraftConfirmed('already published');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full');
    });

    try {
      await expect(clearDraftConfirmed()).resolves.toBe(true);
      expect(localStorage.getItem('minds:drafts:v2')).toBeNull();
      expect(getLatestDraft()).toBeNull();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });

  it('reports a failed published-draft removal without restoring it in memory', async () => {
    await saveDraftConfirmed('already published');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    try {
      await expect(clearDraftConfirmed()).resolves.toBe(false);
      expect(getLatestDraft()).toBeNull();
      expect(localStorage.getItem('minds:drafts:v2')).toContain('already published');
    } finally {
      removeItem.mockRestore();
    }
  });

  it('keeps a draft available when an explicit discard cannot be persisted', async () => {
    const draft = await saveDraftConfirmed('keep until discard works');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    try {
      await expect(deleteDraftConfirmed(draft.id)).resolves.toBe(false);
      expect(getLatestDraft()?.content).toBe('keep until discard works');
    } finally {
      removeItem.mockRestore();
    }
  });
});

// A draft is an UNSENT POST. It outlived sign-out in a module-level cache, so
// the next user in the same session opened the composer and found the previous
// user's words in it, ready to publish under their own name.
//
// #304 intended to cover this and missed: it removed the key 'drafts' while
// this module has used 'minds:drafts:v2' since the v2 bump — so neither the
// storage copy nor the in-memory copy was ever cleared.
describe('clearDrafts — the cross-user leak', () => {
  it("does not hand the previous user's unsent post to the next one", async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../drafts');

    m.saveDraft("alice's unsent thoughts");
    expect(m.getLatestDraft()?.content).toBe("alice's unsent thoughts");

    // Sign-out: auth.tsx removes minds:drafts:v2 AND calls this.
    localStorage.removeItem('minds:drafts:v2');
    m.clearDrafts();

    expect(m.getLatestDraft()).toBeFalsy();
  });

  it("a write after clear does NOT resurrect the previous user's text", async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../drafts');

    m.saveDraft("alice's unsent thoughts");
    localStorage.removeItem('minds:drafts:v2');
    m.clearDrafts();

    m.saveDraft("bob's own post");
    const stored = localStorage.getItem('minds:drafts:v2') || '';
    expect(stored).toContain("bob's own post");
    expect(stored).not.toContain("alice's unsent thoughts");
  });

  it('the key auth.tsx clears is the key this module writes', async () => {
    // The #304 defect in one assertion: a mismatched key silently clears
    // nothing, and no test would have noticed.
    vi.resetModules();
    localStorage.clear();
    const m = await import('../drafts');
    m.saveDraft('anything');
    expect(localStorage.getItem('minds:drafts:v2')).toBeTruthy();
    expect(localStorage.getItem('drafts')).toBeNull();
  });
});
