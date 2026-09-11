import { getItemSync, getItem, setItem, removeItem } from './storage';
import { captureMessage } from './monitoring';

// v2: the old key accumulated orphaned drafts (posted text that kept
// repopulating the composer because autosave re-stamped restored drafts). The
// bump abandons those orphans for a clean slate; the new lifecycle (single
// slot, cleared on post, staleness guard, no re-stamp of untouched restores)
// keeps it correct going forward.
const DRAFTS_KEY = 'minds:drafts:v2';

interface Draft {
  id: string;
  content: string;
  communityId?: string;
  communityName?: string;
  savedAt: string;
}

let draftsCache: Draft[] = [];

// Sync hydrate on web
const cached = getItemSync(DRAFTS_KEY);
if (cached) try { draftsCache = JSON.parse(cached); } catch {}

// Has anything been written since load? The async hydrate must not clobber it.
let dirty = false;

// Async hydrate on native.
//
// Previously unconditional: on web the sync hydrate above populates the cache,
// the user types (autosave writes), and then this resolves with the PRE-typing
// value and overwrites it. The next persist writes that stale draft back, so
// what they wrote is lost from storage too.
getItem(DRAFTS_KEY).then(saved => {
  if (dirty) return;
  if (saved) try { draftsCache = JSON.parse(saved); } catch {}
});

async function persistDrafts(): Promise<boolean> {
  dirty = true;
  // An unsent post silently not saved is the worst of the four caches this
  // pattern appears in — the user typed it, and it is gone. storage.setItem
  // reports failure (#316); discarding that here would hide it.
  // An empty draft store is a deletion, not another allocation. In
  // particular, localStorage can reject writes when its quota is full while
  // still allowing removeItem to free the old published draft.
  const clearing = draftsCache.length === 0;
  const ok = clearing
    ? await removeItem(DRAFTS_KEY)
    : await setItem(DRAFTS_KEY, JSON.stringify(draftsCache));
  if (!ok) captureMessage('drafts: failed to persist', {
    consequence: clearing ? 'a discarded draft may reappear' : 'an unsent post will be lost',
  });
  return ok;
}

function replaceDraft(content: string, communityId?: string, communityName?: string): string {
  const id = Date.now().toString();
  draftsCache = [{ id, content, communityId, communityName, savedAt: new Date().toISOString() }];
  return id;
}

/**
 * Drop the in-memory drafts. MUST be called on sign-out.
 *
 * `draftsCache` is module-level and outlives a sign-out, so without this the
 * next user in the same session sees the previous user's unsent post in their
 * composer — their words, in someone else's mouth, ready to publish.
 *
 * #304 intended to cover this and MISSED: it removed the key `'drafts'` while
 * this module has used `minds:drafts:v2` since the v2 bump. The storage half
 * was therefore never cleared either; both are fixed here.
 */
export function clearDrafts(): void {
  draftsCache = [];
  dirty = true;
}

export function getDrafts(): Draft[] {
  return draftsCache;
}

// We keep a SINGLE in-progress draft. Every autosave overwrites it rather
// than appending — the old "keep 10" behaviour meant each debounced save
// minted a fresh id, so posting only cleared the last one and earlier copies
// of the same text lingered forever (the "ghost draft" that kept repopulating
// the composer). One slot, cleared on post, fixes that for good.
export function saveDraft(content: string, communityId?: string, communityName?: string): string {
  const id = replaceDraft(content, communityId, communityName);
  void persistDrafts();
  return id;
}

/** Save to the in-memory slot and report whether durable device storage agreed. */
export async function saveDraftConfirmed(
  content: string,
  communityId?: string,
  communityName?: string,
): Promise<{ id: string; persisted: boolean }> {
  const id = replaceDraft(content, communityId, communityName);
  return { id, persisted: await persistDrafts() };
}

export function deleteDraft(id: string): void {
  draftsCache = draftsCache.filter(d => d.id !== id);
  void persistDrafts();
}

/** Delete one draft and restore the in-memory copy if storage refuses. */
export async function deleteDraftConfirmed(id: string): Promise<boolean> {
  const previous = draftsCache;
  draftsCache = draftsCache.filter(d => d.id !== id);
  const persisted = await persistDrafts();
  if (!persisted) draftsCache = previous;
  return persisted;
}

// Nuke the draft entirely — called on a successful post.
export function clearDraft(): void {
  draftsCache = [];
  void persistDrafts();
}

/** Clear after publishing and report whether the old durable copy is gone. */
export async function clearDraftConfirmed(): Promise<boolean> {
  draftsCache = [];
  return persistDrafts();
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // only auto-restore "obviously recent" drafts

export function getLatestDraft(): Draft | null {
  const d = draftsCache[0];
  if (!d) return null;
  // Don't repopulate the composer with a stale draft (e.g. something already
  // posted days ago). Only restore work from roughly the current session.
  const age = Date.now() - new Date(d.savedAt).getTime();
  if (!Number.isFinite(age) || age > DRAFT_TTL_MS) return null;
  return d;
}
