/**
 * In-memory cache with stale-while-revalidate pattern.
 * Persists to localStorage on web for instant loads after refresh.
 *
 * CRITICAL: the persisted cache is NAMESPACED PER USER ID. The cache holds
 * identity-scoped data (profile, conversations, communities, personal feed), so
 * a single shared key let one account's cached data render under another in the
 * same browser — the "my identity flashed / communities I'm not in showed up"
 * bug. Each account now reads/writes only `minds:cache:v3:<userId>`, so accounts
 * can never see each other's cache. The namespace is resolved synchronously at
 * boot from the stored auth user, so the very first render is already correct.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEntry = {
  data: any;
  timestamp: number;
};

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const store = new Map<string, CacheEntry>();
const BASE_KEY = 'minds:cache:v4';
const AUTH_USER_KEY = 'minds:user'; // matches KEYS.user in lib/auth.tsx

// Sweep EVERY older cache key (shared minds:cache / minds:cache:v2, and the
// per-user minds:cache:v3:* namespaces). v3 could still hold a poisoned
// is_member=true entry from before the server fix, which kept the phantom
// QA/Support communities in the sidebar. Bumping to v4 + this sweep guarantees
// no stale community/membership data survives a deploy.
if (isWeb) {
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith('minds:cache:') && !k.startsWith(BASE_KEY)) stale.push(k);
    }
    for (const k of stale) window.localStorage.removeItem(k);
  } catch {}
}

// Resolve the current user's id synchronously from the stored auth user, so the
// first hydrate already uses the correct per-user namespace (no wrong-identity
// flash before auth finishes booting).
function readStoredUserId(): string | null {
  if (!isWeb) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch { return null; }
}

let activeNamespace = readStoredUserId() || 'anon';
let STORAGE_KEY = `${BASE_KEY}:${activeNamespace}`;

// Data is "fresh" for 30 seconds — won't refetch at all
const FRESH_MS = 30_000;

/** How long a persisted entry is worth restoring on a later launch. */
const PERSIST_TTL_MS = 10 * 60_000;

function serialize(): string {
  const obj: Record<string, CacheEntry> = {};
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.timestamp < PERSIST_TTL_MS) obj[key] = entry;
  }
  return JSON.stringify(obj);
}

/** Restores entries into the store; returns the keys it actually restored. */
function deserializeInto(saved: string | null): string[] {
  if (!saved) return [];
  const restored: string[] = [];
  try {
    const parsed = JSON.parse(saved) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      // Never let a restored entry overwrite something fetched since launch.
      if (now - entry.timestamp < PERSIST_TTL_MS && !store.has(key)) {
        store.set(key, entry);
        restored.push(key);
      }
    }
  } catch {}
  return restored;
}

// Debounced persist. NATIVE PERSISTS TOO.
//
// This whole mechanism used to be `if (!isWeb) return` at the top of both
// functions — so the phone, the platform where a cold start actually costs the
// user something, threw its cache away on every launch and re-fetched the feed
// from scratch before it could draw a single post. The browser, which has a
// warm HTTP cache and a back button, was the only place that got instant loads.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const key = STORAGE_KEY;
    try {
      const payload = serialize();
      if (isWeb) window.localStorage.setItem(key, payload);
      else void AsyncStorage.setItem(key, payload).catch(() => {});
    } catch {}
  }, 1000);
}

// Bumped on every namespace switch so an in-flight async hydrate that resolves
// after the user changed can be discarded instead of pouring one account's
// cache into another's namespace.
let hydrateGeneration = 0;

/**
 * Capture before an async mutation and compare before applying its result.
 * Namespace switches and clears advance this synchronously, even before auth
 * finishes updating React state. The value contains no account identity.
 */
export function getCacheGeneration(): number {
  return hydrateGeneration;
}

function hydrate(): Promise<void> {
  store.clear();
  const generation = ++hydrateGeneration;
  const key = STORAGE_KEY;

  if (isWeb) {
    try { deserializeInto(window.localStorage.getItem(key)); } catch {}
    return Promise.resolve();
  }

  // Native: AsyncStorage is async, so this is AWAITED during boot rather than
  // left to land whenever. Notifying listeners afterwards wouldn't help — their
  // invalidation handlers kick off a network fetch, and the hook state was
  // already seeded from an empty store at mount, so the restored entries would
  // sit there unread. Finishing before first render is what actually makes the
  // feed paint from cache. It's one small read inside a window already spent
  // holding the splash.
  return AsyncStorage.getItem(key)
    .then((saved) => {
      if (generation !== hydrateGeneration) return; // user changed under us
      deserializeInto(saved);
    })
    .catch(() => {});
}

void hydrate(); // initial hydrate for the stored user (or anon)

/**
 * Point the cache at a user's namespace. Called by auth on boot/sign-in/sign-out
 * so each account reads + writes only its own cache. Switching users clears the
 * in-memory store and loads the new user's persisted namespace — the previous
 * user's data can never bleed through.
 */
export function setCacheUser(userId: string | null): Promise<void> {
  const next = userId || 'anon';
  if (next === activeNamespace) return Promise.resolve();
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; } // drop any pending write to the old namespace
  activeNamespace = next;
  STORAGE_KEY = `${BASE_KEY}:${next}`;
  return hydrate();
}

export function getCached(key: string): any | null {
  const entry = store.get(key);
  if (!entry) return null;
  return entry.data;
}

export function isFresh(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < FRESH_MS;
}

export function setCache(key: string, data: any): void {
  store.set(key, { data, timestamp: Date.now() });
  schedulePersist();
}

// Simple pub-sub so data hooks can re-fetch when their cached entry is
// invalidated — e.g. SideNav's `useCommunities` reacting to a join/leave
// in the community screen without a full logout/login.
type InvalidationListener = (key: string) => void;
const listeners = new Set<InvalidationListener>();

export function subscribeToInvalidations(listener: InvalidationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(key: string) {
  for (const fn of listeners) {
    try { fn(key); } catch { /* ignore */ }
  }
}

export function invalidate(key: string): void {
  store.delete(key);
  schedulePersist();
  notify(key);
}

/**
 * Wipe the active namespace's cache (in-memory + its localStorage key). Called
 * on sign-out so a signed-out browser holds no identity-scoped data.
 */
export async function clearAll(): Promise<boolean> {
  // The in-memory half stays synchronous — it happens before the first await, so
  // callers see the same immediate effect they always did.
  store.clear();
  hydrateGeneration++; // strand any hydrate still in flight
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }

  // The PERSISTED half is what changed. This used to swallow on web and, on
  // native, fire `void AsyncStorage.removeItem(...).catch(() => {})` from a
  // synchronous function — so sign-out returned before the removal had even been
  // attempted, and a failure was unobservable in both branches.
  //
  // This function's own contract is "called on sign-out so a signed-out browser
  // holds no identity-scoped data". A silent failure violates exactly that, and
  // nothing anywhere would say so. It now awaits and reports.
  try {
    if (isWeb) {
      window.localStorage.removeItem(STORAGE_KEY);
      return true;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function invalidatePrefix(prefix: string): void {
  const removed: string[] = [];
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed.push(key);
    }
  }
  schedulePersist();
  for (const key of removed) notify(key);
  if (removed.length === 0) notify(prefix); // still wake listeners
}

/**
 * Patch a single post wherever it appears in cached LISTS (personal feed,
 * `profile-posts:*`, discover, etc.), not just the standalone `post:<id>` entry.
 *
 * Why: casting a vote only updated `post:<id>`, so the channel/profile and feed
 * lists — which persist to localStorage for instant loads after refresh —
 * reloaded their STALE cached copy and the vote appeared lost on refresh. This
 * walks every cached entry and merges `patch` into the matching post so the cast
 * vote (and its new score) survives a reload across every view.
 */
export function patchPostInCaches(postId: string, patch: Record<string, any>): void {
  let touched = false;
  for (const entry of store.values()) {
    const d = entry.data;
    if (!d) continue;
    const arrays: any[][] = [];
    if (Array.isArray(d)) arrays.push(d);
    else if (typeof d === 'object') {
      for (const k of ['items', 'posts', 'data', 'results']) {
        if (Array.isArray((d as any)[k])) arrays.push((d as any)[k]);
      }
    }
    for (const arr of arrays) {
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        if (p && (p.id === postId || p.guid === postId)) {
          arr[i] = { ...p, ...patch };
          touched = true;
        }
      }
    }
  }
  if (touched) schedulePersist();
}

// ── Request deduplication ────────────────────────────────────────────────
// Concurrent callers fetching the same resource share one promise instead of
// issuing duplicate requests. Multiple mounted hook instances (e.g. the
// sidebar and a screen both rendering useCommunities, or two usePost(id)
// consumers) used to multiply API QPS by the number of consumers, and the
// duplicate responses raced each other into the cache.
const inflight = new Map<string, Promise<any>>();

export function fetchDeduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
