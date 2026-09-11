import { getItemSync, getItem, setItem } from './storage';
import { captureMessage } from './monitoring';

const STORAGE_KEY = 'minds:muted';

let mutedUsers: Set<string> = new Set();

// Sync hydrate on web
const cached = getItemSync(STORAGE_KEY);
if (cached) try { mutedUsers = new Set(JSON.parse(cached)); } catch {}

// Has anything been written since this module loaded? The async hydrate below
// must not clobber a newer in-memory value.
let dirty = false;

// Async hydrate on native.
//
// This used to assign unconditionally, which loses data on web: the sync
// hydrate above populates the set, the user toggles a mute while the promise
// is still in flight, and then this resolves with the PRE-toggle value and
// overwrites it. The next persist() writes that stale set back to storage, so
// the toggle is lost permanently rather than just visually.
//
// Skipping when `dirty` keeps the common native path (nothing written yet)
// working exactly as before, and makes the racing case a no-op instead of a
// silent revert.
getItem(STORAGE_KEY).then(saved => {
  if (dirty) return;
  if (saved) try { mutedUsers = new Set(JSON.parse(saved)); } catch {}
});

function persist() {
  dirty = true;
  // storage.setItem reports failure now (#316) — a full store, or Safari
  // private browsing where every write throws. Ignoring that here would
  // reinstate exactly the silence #316 removed: the in-memory value says
  // saved, storage does not have it, and the change is gone on reload.
  //
  // Reported rather than surfaced: this module imports only from lib/, so it
  // has no way to reach the UI. THE USER IS STILL NOT TOLD — they find out by
  // losing the change. What this buys is that we can see it happening.
  void setItem(STORAGE_KEY, JSON.stringify([...mutedUsers])).then(ok => {
    if (!ok) captureMessage('muted: failed to persist', { consequence: 'the user\u2019s muted accounts will be lost on reload' });
  });
}

/**
 * Drop the in-memory set. MUST be called on sign-out.
 *
 * Clearing the storage key alone is not enough: this module holds the set in a
 * module-level variable that outlives a sign-out, so without this the next user
 * in the same session sees the previous user's mutes — and the first write
 * under the new account persists them back under the new key. The storage half
 * of this was fixed in #304; this is the half that was missed.
 */
export function clearMuted(): void {
  mutedUsers = new Set();
  dirty = true;
}

export function isMuted(userId: string): boolean {
  return mutedUsers.has(userId);
}

export function toggleMute(userId: string): boolean {
  if (mutedUsers.has(userId)) {
    mutedUsers.delete(userId);
    persist();
    return false;
  }
    mutedUsers.add(userId);
    persist();
    return true;
}

export function getMutedUsers(): string[] {
  return [...mutedUsers];
}

export function filterMuted(posts: any[]): any[] {
  if (mutedUsers.size === 0) return posts;
  return posts.filter(p => {
    const authorId = p.author?.id || p.userId || p.user_id;
    return !mutedUsers.has(authorId);
  });
}
