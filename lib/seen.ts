// Lightweight "recently seen" tracker for feed rotation. The For You recommender
// returns a stable ranking, so without this the same post sat at the top for days
// (Jack's report). We record which posts a viewer has already had at the top of
// For You, then lead the next visit with the ones they HAVEN'T seen — X-style
// rotation, sized for our scale: a single capped list in the per-user cache, no
// server change. Recommender order is preserved WITHIN the seen/unseen groups, so
// ranking still holds; only "what leads" rotates.
import { getCached, setCache } from './cache';

const KEY = 'minds:foryou:seen';
const CAP = 800; // ~40 screens of history; oldest fall off so nothing hides forever

/** The set of post ids the viewer has recently seen at the top of For You. */
export function getSeenSet(): Set<string> {
  try {
    const arr = getCached(KEY);
    return new Set(Array.isArray(arr) ? (arr as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Record post ids as seen (most-recent first, capped). No-op on empty. */
export function markSeen(ids: Array<string | undefined>): void {
  const clean = ids.filter((x): x is string => !!x);
  if (!clean.length) return;
  try {
    const cur = getCached(KEY);
    const prev: string[] = Array.isArray(cur) ? (cur as string[]) : [];
    const fresh = new Set(clean);
    const next = [...clean, ...prev.filter((id) => !fresh.has(id))].slice(0, CAP);
    setCache(KEY, next);
  } catch {}
}
