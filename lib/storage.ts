import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Synchronous read — returns cached value on web, null on native (use getItem for native). */
export function getItemSync(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return null;
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  return AsyncStorage.getItem(key);
}

/**
 * Write a value. Resolves TRUE when the write succeeded, FALSE when it did not.
 *
 * It used to swallow the failure and resolve void, which made a full or
 * unavailable store indistinguishable from a successful save. `localStorage`
 * throws `QuotaExceededError` when it is full — and in Safari private browsing
 * it throws on every write — so this is a real state, not a theoretical one.
 *
 * What that silence cost, in order of severity:
 *   - `persistSession` writes the API key. A silent failure leaves someone
 *     apparently signed in for the session and signed OUT on reload, with
 *     nothing to explain it.
 *   - bookmarks / mutes / preferences persist through here. The in-memory set
 *     says saved, storage does not have it, and the save is lost on reload.
 *   - drafts persist through here. An unsent post silently not saved.
 *
 * The return value is ADDITIVE: every existing `await setItem(...)` call is
 * unaffected, and callers that care can now check. Callers that should check
 * and do not are a follow-up, not a reason to keep the failure invisible.
 */
export async function setItem(key: string, value: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  }
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove a key. Returns whether it actually went away.
 *
 * Same argument as `setItem` above, pointed the other way, and with a worse
 * consequence. A failed REMOVE is what leaves one person's data on a device for
 * the next person who signs in: bookmarks, mutes, the per-conversation
 * mute/archive maps that reveal which DM threads someone hid, and drafts — their
 * unsent words in the next user's composer.
 *
 * The web branch was the sharp edge: it caught the failure and returned normally,
 * so a caller wrapping the whole thing in `.catch()` still could not see it. The
 * failure was unobservable rather than merely unhandled.
 *
 * The return value is ADDITIVE: every existing `await removeItem(...)` call is
 * unaffected, and callers that care can now check.
 */
export async function removeItem(key: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try { window.localStorage.removeItem(key); return true; } catch { return false; }
  }
  try {
    await AsyncStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
