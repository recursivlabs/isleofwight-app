import { getItemSync, getItem, setItem } from './storage';
import { captureMessage } from './monitoring';

const STORAGE_KEY = 'minds:bookmarks';

let bookmarks: Set<string> = new Set();

// Sync hydrate on web
const cached = getItemSync(STORAGE_KEY);
if (cached) try { bookmarks = new Set(JSON.parse(cached)); } catch {}

// Has anything been written since this module loaded? The async hydrate below
// must not clobber a newer in-memory value.
let dirty = false;

// Async hydrate on native.
//
// This used to assign unconditionally, which loses data on web: the sync
// hydrate above populates the set, the user toggles a bookmark while the promise
// is still in flight, and then this resolves with the PRE-toggle value and
// overwrites it. The next persist() writes that stale set back to storage, so
// the toggle is lost permanently rather than just visually.
//
// Skipping when `dirty` keeps the common native path (nothing written yet)
// working exactly as before, and makes the racing case a no-op instead of a
// silent revert.
getItem(STORAGE_KEY).then(saved => {
  if (dirty) return;
  if (saved) try { bookmarks = new Set(JSON.parse(saved)); } catch {}
});

async function persist(): Promise<boolean> {
  dirty = true;
  // storage.setItem reports failure now (#316) — a full store, or Safari
  // private browsing where every write throws. Ignoring that here would
  // reinstate exactly the silence #316 removed: the in-memory value says
  // saved, storage does not have it, and the change is gone on reload.
  //
  // Reported rather than surfaced: this module imports only from lib/, so it
  // has no way to reach the UI. THE USER IS STILL NOT TOLD — they find out by
  // losing the change. What this buys is that we can see it happening.
  const ok = await setItem(STORAGE_KEY, JSON.stringify([...bookmarks]));
  if (!ok) captureMessage('bookmarks: failed to persist', { consequence: 'the user\u2019s bookmarks will be lost on reload' });
  return ok;
}

function setBookmarkPresence(postId: string, present: boolean): void {
  if (present) bookmarks.add(postId);
  else bookmarks.delete(postId);
}

/**
 * Drop the in-memory set. MUST be called on sign-out.
 *
 * Clearing the storage key alone is not enough: this module holds the set in a
 * module-level variable that outlives a sign-out, so without this the next user
 * in the same session sees the previous user's bookmarks — and the first write
 * under the new account persists them back under the new key. The storage half
 * of this was fixed in #304; this is the half that was missed.
 */
export function clearBookmarks(): void {
  bookmarks = new Set();
  dirty = true;
}

export function isBookmarked(postId: string): boolean {
  return bookmarks.has(postId);
}

export function toggleBookmark(postId: string): boolean {
  const next = !bookmarks.has(postId);
  setBookmarkPresence(postId, next);
  void persist();
  return next;
}

/** Toggle a bookmark and report only a state that reached durable storage. */
export async function toggleBookmarkConfirmed(
  postId: string,
): Promise<{ saved: boolean; persisted: boolean }> {
  const previous = bookmarks.has(postId);
  const next = !previous;
  setBookmarkPresence(postId, next);
  const persisted = await persist();
  if (!persisted && bookmarks.has(postId) === next) {
    // Storage still has the previous state. Roll memory back too, unless a
    // newer toggle for this post already superseded this attempt.
    setBookmarkPresence(postId, previous);
  }
  return { saved: persisted ? next : previous, persisted };
}

export function getBookmarks(): string[] {
  return [...bookmarks];
}
