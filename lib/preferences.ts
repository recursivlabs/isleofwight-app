import { getItemSync, getItem, setItem } from './storage';
import { captureMessage } from './monitoring';

const PREFS_KEY = 'minds:preferences';

/** Feed shown when the home tab is opened. */
export type DefaultFeed = 'foryou' | 'following';

interface Preferences {
  showNsfw: boolean;
  autoplayVideo: boolean;
  /**
   * Master AI switch. When false, the personal-agent surfaces are
   * disabled or hidden across the app: no curator runs, agent hidden
   * from Chat list, agent-sourced alerts suppressed, For You falls
   * back to chronological. Default true (opt-out, not opt-in) because
   * the agent IS the differentiator — but legacy Minds users with
   * anti-AI sensibilities can flip it off and the network still works
   * the way they remember.
   */
  aiEnabled: boolean;
  /**
   * Which feed tab opens by default on the home screen. Default 'foryou'
   * so a new user lands on the agent-curated brief; existing users can
   * switch to 'following' if they prefer the chronological social-graph
   * stream as their main loop.
   */
  defaultFeed: DefaultFeed;
  /**
   * Conversation ids the user has muted (device-local). A muted thread still
   * receives messages but its unread badge is dimmed and it doesn't draw
   * attention — Signal-style per-chat mute. Server-side mute (cross-device +
   * push suppression) is a follow-up; this is the local layer.
   */
  mutedConversations: string[];
  /** Conversations hidden from the chat list via swipe-archive (device-local). */
  archivedConversations: string[];
  /** Conversations manually flagged unread via swipe (Mail-style). */
  forcedUnreadConversations: string[];
}

const defaults: Preferences = {
  showNsfw: false,
  autoplayVideo: true,
  aiEnabled: true,
  defaultFeed: 'foryou',
  mutedConversations: [],
  archivedConversations: [],
  forcedUnreadConversations: [],
};

let prefs: Preferences = { ...defaults };

// Sync hydrate on web
const cached = getItemSync(PREFS_KEY);
if (cached) try { prefs = { ...defaults, ...JSON.parse(cached) }; } catch {}

// Has anything been written since load? The async hydrate must not clobber it.
let dirty = false;

// Async hydrate on native.
//
// Previously unconditional, which loses a setting on web: the sync hydrate
// above populates prefs, the user flips a toggle while this promise is in
// flight, and it resolves with the PRE-toggle value and overwrites it. The next
// persist() writes that stale object back, so the change is lost from storage
// too — not merely from the screen.
getItem(PREFS_KEY).then(saved => {
  if (dirty) return;
  if (saved) try { prefs = { ...defaults, ...JSON.parse(saved) }; } catch {}
});

async function persist(): Promise<boolean> {
  dirty = true;
  // storage.setItem reports failure now (#316) — a full store, or Safari
  // private browsing where every write throws. Ignoring that here would
  // reinstate exactly the silence #316 removed: the in-memory value says
  // saved, storage does not have it, and the change is gone on reload.
  //
  // This module cannot show UI itself. Confirmed callers below use the return
  // value to roll back and explain the failure; legacy fire-and-forget callers
  // still get monitoring rather than a silent loss.
  const ok = await setItem(PREFS_KEY, JSON.stringify(prefs));
  if (!ok) captureMessage('preferences: failed to persist', { consequence: 'the user\u2019s preferences will be lost on reload' });
  return ok;
}

let confirmedMutationQueue: Promise<void> = Promise.resolve();

function copyPreferences(): Preferences {
  return {
    ...prefs,
    mutedConversations: [...prefs.mutedConversations],
    archivedConversations: [...prefs.archivedConversations],
    forcedUnreadConversations: [...prefs.forcedUnreadConversations],
  };
}

/** Serialize UI-confirmed mutations so a failed write can safely roll back. */
async function confirmMutation<T>(mutate: () => T): Promise<{ value: T; persisted: boolean }> {
  const run = confirmedMutationQueue.then(async () => {
    const previous = copyPreferences();
    const value = mutate();
    const persisted = await persist();
    if (!persisted) prefs = previous;
    return { value, persisted };
  });
  confirmedMutationQueue = run.then(() => undefined, () => undefined);
  return run;
}

/**
 * Reset to defaults. MUST be called on sign-out.
 *
 * This module is the most sensitive of the three that cache user state, because
 * `prefs` is not only settings: it carries the per-conversation muted /
 * archived / forced-unread maps. Those are DM METADATA — they reveal which
 * threads a person kept, hid, and marked to come back to.
 *
 * Clearing the storage key is not enough; `prefs` is module-level and outlives
 * a sign-out, so without this the next user in the same session inherits that
 * map and their first write persists it under the new account. #304 fixed the
 * storage half for this key; this is the half it missed.
 */
export function clearPreferences(): void {
  prefs = { ...defaults };
  dirty = true;
}

export function getPreference<K extends keyof Preferences>(key: K): Preferences[K] {
  return prefs[key];
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  prefs[key] = value;
  void persist();
}

// ── Per-conversation mute (device-local) ──
export function isConversationMuted(conversationId: string): boolean {
  return prefs.mutedConversations.includes(conversationId);
}

export function isConversationArchived(conversationId: string): boolean {
  return prefs.archivedConversations.includes(conversationId);
}

export function archiveConversation(conversationId: string): void {
  if (!prefs.archivedConversations.includes(conversationId)) {
    prefs.archivedConversations = [...prefs.archivedConversations, conversationId];
    void persist();
  }
}

/** Archive only when the device store confirms the change. */
export async function archiveConversationConfirmed(conversationId: string): Promise<boolean> {
  const result = await confirmMutation(() => {
    if (!prefs.archivedConversations.includes(conversationId)) {
      prefs.archivedConversations = [...prefs.archivedConversations, conversationId];
    }
  });
  return result.persisted;
}

export function isForcedUnread(conversationId: string): boolean {
  return prefs.forcedUnreadConversations.includes(conversationId);
}

export function setForcedUnread(conversationId: string, on: boolean): void {
  const set = new Set(prefs.forcedUnreadConversations);
  if (on) set.add(conversationId); else set.delete(conversationId);
  prefs.forcedUnreadConversations = Array.from(set);
  void persist();
}

/** Change the local unread override only when the device store confirms it. */
export async function setForcedUnreadConfirmed(conversationId: string, on: boolean): Promise<boolean> {
  // No device write is needed when the override already matches. In
  // particular, a successful server mark-read must not be turned into a local
  // storage error when there was no forced-unread flag to clear.
  if (prefs.forcedUnreadConversations.includes(conversationId) === on) return true;
  const result = await confirmMutation(() => {
    const set = new Set(prefs.forcedUnreadConversations);
    if (on) set.add(conversationId); else set.delete(conversationId);
    prefs.forcedUnreadConversations = Array.from(set);
  });
  return result.persisted;
}

/** Toggle mute for a conversation; returns the new muted state. */
export function toggleConversationMute(conversationId: string): boolean {
  const set = new Set(prefs.mutedConversations);
  const muted = !set.has(conversationId);
  if (muted) set.add(conversationId); else set.delete(conversationId);
  prefs.mutedConversations = Array.from(set);
  void persist();
  return muted;
}

/** Toggle mute and return only the state that reached durable device storage. */
export async function toggleConversationMuteConfirmed(
  conversationId: string,
): Promise<{ muted: boolean; persisted: boolean }> {
  const result = await confirmMutation(() => {
    const previous = prefs.mutedConversations.includes(conversationId);
    const set = new Set(prefs.mutedConversations);
    if (previous) set.delete(conversationId); else set.add(conversationId);
    prefs.mutedConversations = Array.from(set);
    return { previous, next: !previous };
  });
  return {
    muted: result.persisted ? result.value.next : result.value.previous,
    persisted: result.persisted,
  };
}
