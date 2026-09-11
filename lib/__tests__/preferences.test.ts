import { describe, it, expect, vi } from 'vitest';
import { getPreference, setPreference } from '../preferences';

describe('preferences', () => {
  it('returns sensible defaults', () => {
    expect(getPreference('aiEnabled')).toBe(true);
    expect(getPreference('defaultFeed')).toBe('foryou');
    expect(getPreference('showNsfw')).toBe(false);
  });

  it('set then get round-trips and persists in-memory', () => {
    setPreference('defaultFeed', 'following');
    expect(getPreference('defaultFeed')).toBe('following');
    setPreference('showNsfw', true);
    expect(getPreference('showNsfw')).toBe(true);
    // restore defaults so test order doesn't leak
    setPreference('defaultFeed', 'foryou');
    setPreference('showNsfw', false);
  });
});

describe('confirmed chat preferences', () => {
  it('rolls mute, archive, and unread state back when storage rejects the write', async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../preferences');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    try {
      await expect(m.toggleConversationMuteConfirmed('failed-thread')).resolves.toEqual({
        muted: false,
        persisted: false,
      });
      await expect(m.archiveConversationConfirmed('failed-thread')).resolves.toBe(false);
      await expect(m.setForcedUnreadConfirmed('failed-thread', true)).resolves.toBe(false);

      expect(m.isConversationMuted('failed-thread')).toBe(false);
      expect(m.isConversationArchived('failed-thread')).toBe(false);
      expect(m.isForcedUnread('failed-thread')).toBe(false);
    } finally {
      setItem.mockRestore();
    }
  });

  it('persists each confirmed chat action before returning success', async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../preferences');

    await expect(m.toggleConversationMuteConfirmed('saved-thread')).resolves.toEqual({
      muted: true,
      persisted: true,
    });
    await expect(m.archiveConversationConfirmed('saved-thread')).resolves.toBe(true);
    await expect(m.setForcedUnreadConfirmed('saved-thread', true)).resolves.toBe(true);

    const stored = localStorage.getItem('minds:preferences') || '';
    expect(stored).toContain('saved-thread');
  });

  it('serializes rapid mute toggles instead of losing the second intent', async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../preferences');

    const [first, second] = await Promise.all([
      m.toggleConversationMuteConfirmed('rapid-thread'),
      m.toggleConversationMuteConfirmed('rapid-thread'),
    ]);

    expect(first).toEqual({ muted: true, persisted: true });
    expect(second).toEqual({ muted: false, persisted: true });
    expect(m.isConversationMuted('rapid-thread')).toBe(false);
  });

  it('does not require storage to clear an unread override that is already absent', async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../preferences');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    try {
      await expect(m.setForcedUnreadConfirmed('server-read-thread', false)).resolves.toBe(true);
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      setItem.mockRestore();
    }
  });
});

// ── Sign-out must not hand DM metadata to the next user ────────────────────
//
// `prefs` is module-level and outlives a sign-out. It is not only settings: it
// carries the per-conversation muted / archived / forced-unread maps, which
// reveal which threads a person kept, hid, and marked to return to. #304
// cleared the storage key; this covers the in-memory half.
describe('clearPreferences — the cross-user leak', () => {
  it('resets conversation state so the next user inherits nothing', async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../preferences');

    m.toggleConversationMute('alice-thread');
    m.archiveConversation('alice-secret-thread');
    expect(m.isConversationMuted('alice-thread')).toBe(true);
    expect(m.isConversationArchived('alice-secret-thread')).toBe(true);

    // Sign-out: auth.tsx removes the key AND calls this.
    localStorage.removeItem('minds:preferences');
    m.clearPreferences();

    // Bob, same session, no reload.
    expect(m.isConversationMuted('alice-thread')).toBe(false);
    expect(m.isConversationArchived('alice-secret-thread')).toBe(false);
  });

  it('a write after clear does NOT persist the previous user conversation map', async () => {
    vi.resetModules();
    localStorage.clear();
    const m = await import('../preferences');

    m.archiveConversation('alice-secret-thread');
    localStorage.removeItem('minds:preferences');
    m.clearPreferences();

    m.archiveConversation('bob-thread');
    const stored = localStorage.getItem('minds:preferences') || '';
    expect(stored).toContain('bob-thread');
    expect(stored).not.toContain('alice-secret-thread');
  });
});
