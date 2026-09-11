import * as React from 'react';
import { useAuth } from './auth';
import { ORG_ID, publicMinds } from './recursiv';
import { getCached, setCache, isFresh, invalidatePrefix, subscribeToInvalidations, fetchDeduped } from './cache';
import { filterMuted } from './muted';
import { loadPreferences, markCuratedNow } from './onboarding';
import { buildCuratorRequest } from './curator';
import { getPreference } from './preferences';
import { captureException } from './monitoring';
import { communityDescription, dedupePosts, isArticlePost } from './models';

// Once-per-session guard for the personal-agent config upsert (see recurate).
const ensuredPersonalThisSession = false;

/**
 * Fetch posts from the feed.
 * All calls scoped to the Minds org.
 */
export function usePosts(sort: 'score' | 'latest' | 'following' | 'personal' = 'latest', limit = 20) {
  const { sdk, user } = useAuth();
  const cacheKey = `posts:${sort}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  // A persisted page can paint immediately, but once its 30-second freshness
  // window has elapsed the primary feed is still revalidating. Expose that
  // state so secondary desktop discovery work can wait for the core timeline
  // request instead of competing with it for database connections.
  const [loading, setLoading] = React.useState(!cached || !isFresh(cacheKey));
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  // The platform returns an opaque keyset cursor on stable post-list sorts.
  // Keep the raw-row offset alongside it as an automatic fallback while an
  // older API is deployed (or during rollback). For You remains offset-based.
  const cursorRef = React.useRef<string | null>(null);
  const followingIdsRef = React.useRef<Set<string> | null>(null);
  const myCommunityIdsRef = React.useRef<Set<string> | null>(null);
  // Concurrency control. Without these, every onEndReached tick near the
  // bottom fired another identical page fetch while one was in flight, a
  // focus-refresh racing a loadMore corrupted the shared offset (silently
  // skipping pages), and errors retried instantly on every scroll frame —
  // client load scaled inversely with backend health.
  const reqIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const failuresRef = React.useRef(0);
  const cooldownUntilRef = React.useRef(0);

  const fetchPosts = React.useCallback(async (refresh = false, silent = false) => {
    if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
    const s = sdk;
    if (!s) return;
    // Appends never overlap (same offset twice); a refresh supersedes
    // whatever is running instead of racing it.
    if (inFlightRef.current && !refresh) return;
    const myReq = ++reqIdRef.current;
    inFlightRef.current = true;
    // A superseded request must not commit state or advance the offset.
    const stale = () => reqIdRef.current !== myReq;
    try {
      if (refresh) {
        if (!silent) setRefreshing(true);
        offsetRef.current = 0;
        cursorRef.current = null;
      }

      // The Following feed is now served by the server's follow-graph path
      // (following=true → posts from everyone you follow, network-scoped,
      // reverse-chron, reposts included). The old client-side approach fetched
      // the follow set (capped at 500) and filtered locally, which both missed
      // followees beyond the cap and broke entirely for imported/multi-network
      // accounts whose followees' posts are org_id NULL. No local follow set
      // needed anymore.

      // Load user's communities for personalized "For You" feed
      if (sort === 'score' && user?.id && !myCommunityIdsRef.current) {
        try {
          const commRes = await s.communities.list({ limit: 100, organization_id: ORG_ID || undefined } as any);
          const joined = (commRes.data || []).filter((c: any) => c.is_member || c.isMember);
          myCommunityIdsRef.current = new Set(joined.map((c: any) => c.id));
        } catch {
          myCommunityIdsRef.current = new Set();
        }
      }

      // 'personal' (For You) is now served by the server-side recommender
      // (sdk.curator.forYou — a cheap, LLM-free ranking of existing app posts),
      // NOT the old per-user agent brief. It needs no audience/org param (the
      // key's project scope drives it). Other sorts page the shared post list.
      const baseParams: Record<string, any> = { limit };
      // Imported legacy posts are project-scoped with org_id NULL. Org-scoping
      // the discovery/trending fetch ('score') hides them, leaving only the few
      // native org posts (looked like "all one user"). Network scope includes
      // the imported content. The 'following' feed is ALSO network-scoped: it is
      // a raw reverse-chron stream of everyone the user follows (served by the
      // server's follow-graph path), and a followed author's imported posts have
      // org_id NULL — org-scoping the fetch would hide them, leaving the feed
      // empty for imported/multi-network accounts. Other sorts keep org scope.
      if (ORG_ID && sort !== 'score' && sort !== 'following') {
        baseParams.organization_id = ORG_ID;
      }
      // Server-authoritative Following feed: the server filters to the caller's
      // follow graph (network-scoped, reverse-chron, reposts included). The
      // client-side follow filter below stays as a harmless secondary pass.
      if (sort === 'following') {
        baseParams.following = 'true';
      }
      // Server-side engagement ordering for discovery/trending, so high-voted
      // imported posts surface instead of only the most-recent (which one active
      // user can dominate). Client still re-sorts for the joined-community boost.
      if (sort === 'score') {
        baseParams.sort = 'score';
      }

      // Client-side filters (followed authors, muted users) can wipe out an
      // entire server page, so pagination must be tracked in RAW server rows:
      // advancing the offset by the filtered count refetches the same rows
      // forever once a page filters to zero, and deriving hasMore from the
      // filtered count truncates the feed after any heavily-filtered page.
      // When a page filters to nothing, keep pulling (bounded) so the user
      // never sees an empty append while posts remain.
      const baseOffset = refresh ? 0 : offsetRef.current;
      let pageCursor = sort === 'personal' ? null : (refresh ? null : cursorRef.current);
      let rawCount = 0;
      let more = true;
      let data: any[] = [];
      for (let page = 0; page < 5 && more; page++) {
        const pageOffset = baseOffset + rawCount;
        const pageKey = pageCursor ? `cursor:${pageCursor}` : `offset:${pageOffset}`;
        const res: any = await fetchDeduped(`req:${cacheKey}:${pageKey}`, () =>
          sort === 'personal' && typeof (s as any).curator?.forYou === 'function'
            // For You → the server-side recommender (ranks existing posts;
            // returns the same shape as posts.list, so the rest is unchanged).
            // Guard: if the deployed SDK predates forYou, fall back to the
            // org-scoped post list so the feed degrades gracefully (no crash).
            ? (s as any).curator.forYou({ limit, offset: pageOffset })
            : s.posts.list({
                ...baseParams,
                ...(pageCursor ? { cursor: pageCursor } : { offset: pageOffset }),
              } as any));
        const raw = res.data || [];
        rawCount += raw.length;
        more = res.meta?.has_more ?? raw.length >= limit;
        if (sort !== 'personal') {
          pageCursor = typeof res.meta?.next_cursor === 'string'
            ? res.meta.next_cursor
            : null;
        }
        let visible = raw;
        // The server's follow-graph path (following=true) is authoritative and
        // already returns only followed authors' posts — and it covers the FULL
        // follow graph, not the client's 500-cap sample. Re-applying the
        // client-side follow filter here would wrongly DROP posts from followees
        // beyond that 500-cap (jack follows ~3k). So skip it for 'following'.
        // (followingIdsRef is still fetched for other uses; harmless if unused.)
        visible = filterMuted(visible);
        data = data.concat(visible);
        if (data.length > 0 || raw.length === 0 || stale()) break;
      }
      if (stale()) return;

      // Collapse reposts of the same original (and orphaned legacy reminds that
      // share one image with no reposted_from link) so a single viral post /
      // remind chain doesn't fill discovery/trending. Shared helper normalizes
      // the media URL (strips query string / trailing slash) so CDN variants of
      // the same image collapse — the old inline key matched the raw first-media
      // URL and let cache-busted dups (the "john Untitled" noise) slip through.
      data = dedupePosts(data);

      if (sort === 'score') {
        // Boost posts from communities the user has joined
        const myComms = myCommunityIdsRef.current;
        data = [...data].sort((a: any, b: any) => {
          const aBoost = myComms?.has(a.community_id) ? 5 : 0;
          const bBoost = myComms?.has(b.community_id) ? 5 : 0;
          return ((b.score || 0) + bBoost) - ((a.score || 0) + aBoost);
        });
      } else if (sort === 'latest') {
        data = [...data].sort((a: any, b: any) =>
          new Date(b.createdAt || b.created_at || 0).getTime() -
          new Date(a.createdAt || a.created_at || 0).getTime()
        );
      }

      // Pre-cache individual posts
      data.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });

      if (refresh) {
        setPosts(data);
        setCache(cacheKey, data);
      } else {
        setPosts(prev => {
          // Deduplicate by ID
          const seen = new Set(prev.map((p: any) => p.id));
          const newOnly = data.filter((p: any) => !seen.has(p.id));
          const merged = [...prev, ...newOnly];
          setCache(cacheKey, merged);
          return merged;
        });
      }
      setHasMore(more);
      offsetRef.current = baseOffset + rawCount;
      cursorRef.current = pageCursor;
      failuresRef.current = 0;
      cooldownUntilRef.current = 0;
    } catch (err: any) {
      captureException(err, { hook: 'usePosts', sort });
      if (!stale()) {
        setError(err.message || 'Failed to load posts');
        // Exponential cooldown (2s → 4s → … → 30s cap) so a degraded API
        // isn't hammered by every scroll tick near the bottom of the feed.
        failuresRef.current += 1;
        cooldownUntilRef.current = Date.now() + Math.min(2000 * 2 ** (failuresRef.current - 1), 30_000);
      }
    } finally {
      if (!stale()) {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [sdk, sort, limit, user?.id, cacheKey]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) {
      // Even when the cache is fresh, state must swap to THIS sort's data —
      // early-returning without setPosts left the previous tab's posts
      // rendered under the new tab until the TTL lapsed. Pagination refs
      // belong to the old sort too, so reset them or the next loadMore
      // fetches from the wrong offset with the wrong follow/community sets.
      setPosts(cached);
      offsetRef.current = cached.length;
      cursorRef.current = null;
      followingIdsRef.current = null;
      myCommunityIdsRef.current = null;
      setHasMore(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setPosts(cached || []);
    offsetRef.current = 0;
    cursorRef.current = null;
    followingIdsRef.current = null;
    myCommunityIdsRef.current = null;
    fetchPosts(true);
    // sdk in deps: this effect's first run fires while the session is still
    // restoring (sdk null), and fetchPosts no-ops by design (no shared-key
    // fallback anymore). Without re-firing when sdk lands, the feed (and the
    // trending/discover surfaces built on usePosts) stranded on empty/error.
  }, [cacheKey, sdk]);

  // Silent re-fetch — used by tab focus, polling, and any background
  // freshness check. Just re-queries the post list. Does NOT trigger
  // the curator (which is a 10-20s RSS + LLM round-trip and shouldn't
  // fire on every tab switch). Passes silent=true so the FlatList's
  // RefreshControl doesn't flash a stuck inset on focus.
  const refresh = React.useCallback(() => fetchPosts(true, true), [fetchPosts]);

  // React to cache invalidation while MOUNTED. Dropping the cached entry alone
  // only fixes the next mount, so unfollowing someone left their posts sitting
  // in the following feed you were looking at until you navigated away and
  // back. Now the feed that was invalidated re-pulls in place.
  //
  // Silent on purpose: this fires from someone else's action (a follow toggle
  // on a profile, in the sidebar, in discover), and a spinner appearing on a
  // feed the user is reading reads as a glitch, not as feedback.
  React.useEffect(() => {
    return subscribeToInvalidations((key) => {
      if (key === cacheKey || cacheKey.startsWith(key)) {
        offsetRef.current = 0;
        cursorRef.current = null;
        followingIdsRef.current = null;
        myCommunityIdsRef.current = null;
        fetchPosts(true, true);
      }
    });
  }, [cacheKey, fetchPosts]);

  // Mirror of `posts` for non-setState reads (loadNew computes its diff
  // against the list as-rendered without risking a stale closure).
  const postsRef = React.useRef<any[]>(posts);
  postsRef.current = posts;

  // X-style "N new posts" pill: fetch the newest page for this feed and
  // PREPEND anything not already on screen. Unlike refresh(), this never
  // replaces the list mid-read — it injects the new content on top, so
  // tapping the pill shows exactly what it promised. Returns how many
  // posts were added (0 → the events were for posts outside this feed).
  const loadNew = React.useCallback(async (): Promise<number> => {
    if (!sdk) return 0;
    try {
      const params: Record<string, any> = { limit, offset: 0 };
      if (sort === 'following') params.following = 'true';
      else if (ORG_ID) params.organization_id = ORG_ID;
      // Chronological fetch even on For You: the pill counts NEW posts, and
      // the recommender's ranking may place them below the fold — fetching
      // latest guarantees the promised posts are what gets prepended.
      const res: any = await sdk.posts.list(params as any);
      const fresh = dedupePosts(filterMuted(res.data || []));
      const seen = new Set(postsRef.current.map((p: any) => p.id));
      const newOnly = fresh.filter((p: any) => p.id && !seen.has(p.id));
      if (newOnly.length === 0) return 0;
      newOnly.forEach((p: any) => setCache(`post:${p.id}`, p));
      setPosts(prev => {
        // Re-diff against prev — the list may have changed since postsRef.
        const prevIds = new Set(prev.map((p: any) => p.id));
        const merged = [...newOnly.filter((p: any) => !prevIds.has(p.id)), ...prev];
        setCache(cacheKey, merged);
        return merged;
      });
      // New rows shift an offset-paged stream, but a keyset cursor remains
      // anchored to the last row already shown and must not be adjusted.
      if (!cursorRef.current) offsetRef.current += newOnly.length;
      return newOnly.length;
    } catch {
      return 0;
    }
  }, [sdk, sort, limit, cacheKey]);

  // User-initiated pull-to-refresh on the personal feed actually asks
  // the agent for fresh content: ensures the personal agent exists,
  // builds the Minds-flavoured curator request locally, calls the
  // generic Recursiv curator primitive, then re-fetches. Only triggered
  // on explicit user gestures — focus refreshes stay silent. When the
  // user has disabled AI in Settings we never call the curator and just
  // re-fetch chronologically.
  // Fire-and-forget curator refresh. Returns fast (status: fresh /
  // already-running / started) instead of awaiting the 5-15s pipeline.
  // Background work updates curation_run when it completes; the user
  // sees fresher content on the NEXT view, not after a long spinner.
  // Falls back to the legacy awaited path only if refreshIfStale isn't
  // available on the SDK (older client / staging).
  // Pull-to-refresh on the For You feed. The feed is now ranked server-side by
  // the recommender (sdk.curator.forYou), so "recurate" is just a re-fetch —
  // which re-ranks against the latest posts + signals. No per-user LLM
  // round-trip. Kept under the same name so call sites are unchanged.
  const recurate = React.useCallback(async () => {
    return fetchPosts(true);
  }, [fetchPosts]);

  const loadMore = React.useCallback(() => {
    if (Date.now() < cooldownUntilRef.current) return;
    if (hasMore && !loading && !refreshing) fetchPosts(false);
  }, [fetchPosts, hasMore, loading, refreshing]);

  return { posts, setPosts, loading, error, refreshing, refresh, recurate, loadMore, loadNew, hasMore };
}

/**
 * Discover Posts feed — the master search console's Posts tab.
 *
 * Unlike usePosts (which the main Feed uses and bakes in follow/community
 * personalization), this is a THIN paginator over the raw /posts list with the
 * server params the console exposes as filters:
 *   - order: 'new'  → recency (no sort param, server default)
 *            'top'  → sort=score (all-time top, server ORDER BY score)
 *            'hot'  → sort=hot (Reddit-style engagement/age decay computed in
 *                     SQL across the WHOLE corpus — not a client window)
 *   - since:  ISO string → ?since= (server filters created_at >= since; honored)
 *   - until:  ISO string → ?until= (server filters created_at <= until; honored)
 *   - tagId:  string → ?tag_ids= (topic filter via post_tag join; honored)
 *
 * Every filter here maps to a server param the /posts route honors (verified in
 * packages/server/.../rest/routes/posts.ts), so the returned pages are ALREADY
 * the right sort + window — the caller only needs dedup. A light client re-sort
 * stays in the caller as defense (stable ordering across merged pages), but the
 * server is the source of truth. Infinite scroll via loadMore.
 */
export function useDiscoverPosts(opts: { order: 'new' | 'top' | 'hot'; since?: string; until?: string; tagId?: string; limit?: number }) {
  const { order, since, until, tagId, limit = 30 } = opts;
  const { sdk } = useAuth();
  // Server sort: 'top' → score (all-time), 'hot' → SQL hot decay over the whole
  // corpus, 'new' → server default (recency). All three are real server orders.
  const serverSort = order === 'top' ? 'score' : order === 'hot' ? 'hot' : undefined;
  const cacheKey = `discover-posts:${serverSort || 'recent'}:${since || ''}:${until || ''}:${tagId || ''}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  const cursorRef = React.useRef<string | null>(null);
  const reqIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);

  const buildParams = React.useCallback((offset: number, cursor: string | null) => {
    const p: Record<string, any> = { limit };
    // Hot ranking changes with the clock, so it intentionally remains offset
    // paginated. Stable recency/score feeds use the platform cursor when the
    // deployed API returns one, and automatically fall back to offset when it
    // does not (including during rollback).
    if (cursor && serverSort !== 'hot') p.cursor = cursor;
    else p.offset = offset;
    // Network scope (org_id NULL legacy posts included) — same reasoning as
    // usePosts('score'): org-scoping the discovery fetch hides imported content.
    if (serverSort) p.sort = serverSort;
    else if (ORG_ID) p.organization_id = ORG_ID;
    // Date window — server filters created_at by these (honored). The caller
    // keeps a withinRange() client filter as cheap defense, but the server has
    // already windowed the rows so the feed is accurate over the FULL corpus
    // (not just whatever the first page happened to contain).
    if (since) p.since = since;
    if (until) p.until = until;
    if (tagId) p.tag_ids = tagId;
    return p;
  }, [serverSort, since, until, tagId, limit]);

  const fetchPage = React.useCallback(async (refresh: boolean) => {
    if (!sdk) return; // identity-scoped; never fall back to the shared app key
    if (inFlightRef.current && !refresh) return;
    const myReq = ++reqIdRef.current;
    inFlightRef.current = true;
    const stale = () => reqIdRef.current !== myReq;
    try {
      if (refresh) {
        setRefreshing(true);
        offsetRef.current = 0;
        cursorRef.current = null;
      }
      const offset = refresh ? 0 : offsetRef.current;
      const cursor = serverSort === 'hot' ? null : (refresh ? null : cursorRef.current);
      const pageKey = cursor ? `cursor:${cursor}` : `offset:${offset}`;
      const res: any = await fetchDeduped(`req:${cacheKey}:${pageKey}`, () =>
        sdk.posts.list(buildParams(offset, cursor) as any));
      if (stale()) return;
      const raw = res.data || [];
      const more = res.meta?.has_more ?? raw.length >= limit;
      const visible = filterMuted(raw);
      visible.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
      setPosts((prev) => {
        const base = refresh ? [] : prev;
        const seen = new Set(base.map((p: any) => p.id));
        const merged = [...base, ...visible.filter((p: any) => !seen.has(p.id))];
        setCache(cacheKey, merged);
        return merged;
      });
      setHasMore(more);
      offsetRef.current = offset + raw.length;
      cursorRef.current = serverSort === 'hot' || typeof res.meta?.next_cursor !== 'string'
        ? null
        : res.meta.next_cursor;
    } catch (err: any) {
      captureException(err, { hook: 'useDiscoverPosts', order });
    } finally {
      if (!stale()) { inFlightRef.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [sdk, cacheKey, buildParams, limit, order, serverSort]);

  // Refetch from scratch whenever the server query (sort/since/tag) changes.
  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    setPosts(fresh || []);
    setLoading(!fresh);
    offsetRef.current = 0;
    cursorRef.current = null;
    setHasMore(true);
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, sdk]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !loading && !refreshing && !inFlightRef.current) fetchPage(false);
  }, [fetchPage, hasMore, loading, refreshing]);

  return { posts, loading, refreshing, hasMore, loadMore, refresh: () => fetchPage(true) };
}

/**
 * Trending posts for the right-rail sidebar widget — a SELF-CONTAINED,
 * never-silently-empty source for "what's hot right now".
 *
 * Why this exists (root cause of the empty Trending Posts widget):
 * The sidebar previously used useDiscoverPosts({ order: 'hot' }) as its ONLY
 * source. `sort=hot` is the right ranking (Reddit-style engagement decayed by
 * age — recency-aware, not all-time bangers), but it is a SINGLE point of
 * failure: if that one request returns 0 rows (a transient server error, an
 * empty hot window, or a deploy where the hot path misbehaves) the widget has
 * NOTHING to fall back to and renders the empty state — exactly the reported
 * bug, which a pure client-side rank/dedup tweak could never fix because the
 * fetched pool itself was empty.
 *
 * The fix is a two-tier fetch with a guaranteed fallback:
 *   1. PRIMARY  → /posts?sort=hot  (engagement-weighted + age-decayed: a fresh,
 *                 modestly-engaged post out-ranks a years-old all-time banger,
 *                 so the rail feels current over a mostly-historical corpus).
 *   2. FALLBACK → /posts?sort=score (all-time top — the same discovery path the
 *                 For-You feed leans on, which is known to populate) — used ONLY
 *                 when hot returns nothing, then re-ranked client-side by the
 *                 same hotScore so the order still favors recency.
 * Either way the widget shows ~limit genuinely-good posts whenever ANY exist,
 * and only shows its empty state when the corpus is truly empty.
 *
 * Network-scoped (no organization_id, like usePosts('score')) so imported
 * legacy posts — project-scoped with org_id NULL — are included rather than
 * leaving only the handful of native org posts. The server's /posts route
 * already applies the Minds-tenant + discover quality filters (original posts
 * only, non-blank, viewer-accessible), so this never shows cross-tenant or
 * pollution rows.
 */
export function useTrendingPosts(limit = 5) {
  const { sdk } = useAuth();
  const cacheKey = `trending-posts:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    if (fresh?.length) { setPosts(fresh); setLoading(false); }
    let cancelled = false;
    (async () => {
      if (!sdk) return; // identity-scoped; never fall back to the shared app key
      const s = sdk;
      // Over-fetch a real pool so the client ranker + dedup have something to
      // choose from, then the caller slices to `limit`.
      const pool = Math.max(limit * 6, 30);
      // "Top this month" — window to the last 30 days (the week window had ZERO engagement on the relaunch corpus; 30d is the smallest window with real score + media) so the rail shows what's
      // trending NOW (score-ranked within the window), not the all-time greatest
      // hits. Coarse day-bucketed `since` so the fetch cache key stays stable
      // through the day.
      const since = new Date(Date.now() - 30 * 86_400_000);
      const sinceIso = since.toISOString();
      const dayBucket = sinceIso.slice(0, 10);
      const fetchSort = (sort: 'hot' | 'score') =>
        fetchDeduped(`req:trending-posts:${sort}:${pool}:${dayBucket}`, () =>
          s.posts.list({ limit: pool, sort, since: sinceIso } as any) as Promise<any>);
      try {
        // PRIMARY: score (engagement-ranked). The hot/recency pool is polluted on
        // the relaunch corpus — a simulator floods the newest posts with
        // 0-engagement emoji/gif spam, so recency-first surfaced junk with "0 pts"
        // and no media. Engagement-ranked shows posts that actually earned reach
        // (real score + media previews).
        let res: any = await fetchSort('score');
        let data: any[] = filterMuted(res?.data || []);
        // FALLBACK: hot, if score yields nothing at all.
        if (data.length === 0) {
          res = await fetchSort('hot');
          data = filterMuted(res?.data || []);
        }
        if (cancelled) return;
        data.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
        setPosts(data);
        setCache(cacheKey, data);
      } catch (err: any) {
        // Non-fatal — keep whatever cache we have; the widget renders its empty
        // state only if there was never any data.
        captureException(err, { hook: 'useTrendingPosts' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey]);

  return { posts, loading };
}

/**
 * Top posts by the SAME recommender the For You feed uses (sdk.curator.forYou),
 * so "Top on Minds" and the sidebar "Trending Posts" are just other views of For
 * You — quality-ranked (real relationships + engagement, reported/moderated
 * content down-ranked) instead of the raw score-ranked post list, which surfaced
 * spam, AI-slop, and stale content. One cached fetch, shared across surfaces.
 * Falls back to score-ranked posts.list only if the deployed SDK lacks forYou.
 */
/**
 * Today on Minds — the daily curated edition (GET /curator/today). AI-as-editor:
 * real human posts grouped into 3-6 kicker+headline stories, generated server-
 * side once a day. Cached hard (it changes ~daily); degrades to null when the
 * deployed server predates the endpoint, and callers hide the section.
 */
export function useTodayEdition() {
  const { sdk } = useAuth();
  const cacheKey = 'today-edition';
  const cached = getCached(cacheKey);
  const [edition, setEdition] = React.useState<any | null>(cached || null);
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sdk) return; // identity-scoped; never the shared app key
      try {
        const http = (sdk.posts as any)?.client;
        if (!http?.get) return;
        const res: any = await fetchDeduped('req:today-edition', () => http.get('/curator/today'));
        if (cancelled) return;
        const data = res?.data;
        if (data?.stories?.length) {
          setEdition(data);
          setCache(cacheKey, data);
        }
      } catch {
        // Endpoint not deployed yet / transient — section simply hides.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, cacheKey]);

  return { edition, loading };
}

export function useForYouTop(limit = 5, enabled = true) {
  const { sdk } = useAuth();
  const cacheKey = `foryou-top:${limit}`;
  const cached = enabled ? getCached(cacheKey) : null;
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(enabled && !cached);

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const fresh = getCached(cacheKey);
    if (fresh?.length) { setPosts(fresh); setLoading(false); }
    let cancelled = false;
    (async () => {
      if (!sdk) return; // identity-scoped; never the shared app key
      const s = sdk as any;
      try {
        const res = typeof s.curator?.forYou === 'function'
          ? await fetchDeduped(`req:foryou-top:${limit}`, () => s.curator.forYou({ limit }))
          : await fetchDeduped(`req:foryou-top-fallback:${limit}`, () => s.posts.list({ limit, sort: 'score' }));
        if (cancelled) return;
        const data = dedupePosts((res as any).data || []);
        setPosts(data);
        setCache(cacheKey, data);
      } catch (err: any) {
        captureException(err, { hook: 'useForYouTop' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey, enabled]);

  return { posts, loading };
}

/**
 * Paginated feed of a single author's posts (or replies).
 *
 * The profile screen used to one-shot `posts.list({ author_id, limit: 50 })`
 * with no offset/has_more tracking and render the result in a ScrollView —
 * so a profile capped at one page (~the first 10-50 rows) and never loaded
 * more on scroll, even for users with thousands of posts (e.g. John, 10,405).
 *
 * This mirrors useDiscoverPosts: a thin cursor paginator over the raw /posts
 * list, scoped by `author_id` server-side, with cursor/offset fallback,
 * has_more, and loadMore for infinite scroll. Set `replies: true` for the
 * Replies tab (server returns the author's replies with the parent hydrated).
 */
export function useProfilePosts(
  authorId: string | undefined,
  opts?: { replies?: boolean; articles?: boolean; limit?: number; enabled?: boolean },
) {
  const { sdk } = useAuth();
  // A profile mounts one of these per tab, but only one tab is ever on screen.
  // Fetching all of them on arrival made every profile visit pay for Replies and
  // Articles as well as Posts, and the three competed for the same connections,
  // so the tab you were actually looking at came back slower. `enabled` lets the
  // screen defer a tab until it is opened; once opened it stays enabled, so the
  // cache keeps tab switching instant.
  const enabled = opts?.enabled ?? true;
  const replies = !!opts?.replies;
  const articles = !!opts?.articles;
  // Signed-out profile cards use the compact public projection, but 30 cards
  // still make the first response unnecessarily large on a cold profile.
  // Start public visitors with a useful screenful and let the existing
  // infinite paginator fetch the rest. Signed-in profiles retain the larger
  // page because they already need the richer relationship-aware response.
  const limit = opts?.limit ?? (sdk ? 30 : 12);
  const mode = replies ? 'replies' : articles ? 'articles' : 'posts';
  const cacheKey = `profile-posts:${authorId || 'none'}:${mode}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(enabled && !cached && !!authorId && (!!sdk || !replies));
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  const cursorRef = React.useRef<string | null>(null);
  const reqIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);

  const fetchPage = React.useCallback(async (refresh: boolean) => {
    if (!authorId || !enabled) return;
    // The public API intentionally has no author-replies listing yet. The
    // signed-out profile hides this tab; make the unconditionally-mounted hook
    // settle instead of leaving an invisible request in a loading state.
    if (!sdk && replies) {
      setLoading(false);
      setRefreshing(false);
      setHasMore(false);
      return;
    }
    if (inFlightRef.current && !refresh) return;
    const myReq = ++reqIdRef.current;
    inFlightRef.current = true;
    const stale = () => reqIdRef.current !== myReq;
    try {
      if (refresh) {
        setRefreshing(true);
        setError(null);
        setHasMore(true);
        // A manual retry after a failed first page has no cached content to
        // keep on screen. Return to the loading state instead of flashing the
        // genuine-empty message while the recovery request is still running.
        if (!getCached(cacheKey)) setLoading(true);
        offsetRef.current = 0;
        cursorRef.current = null;
      }
      const offset = refresh ? 0 : offsetRef.current;
      const cursor = sdk && !refresh ? cursorRef.current : null;
      // NOTE: REST param is snake_case `author_id`; `replies=true` asks the
      // server for the author's replies with the parent hydrated. Both passed
      // via `as any` because `replies` isn't on the typed ListPostsParams.
      const requestKey = sdk
        ? `req:${cacheKey}:${cursor ? `cursor:${cursor}` : `offset:${offset}`}`
        // Posts and Articles mount together. Share their one anonymous page
        // request, then split the visibility-filtered result client-side.
        : `req:profile-posts:${authorId}:public:${limit}:${offset}`;
      const requestPage = () => sdk
        ? sdk.posts.list({
            author_id: authorId,
            limit,
            ...(cursor ? { cursor } : { offset }),
            ...(replies ? { replies: true } : {}),
            ...(articles ? { articles: true } : {}),
          } as any)
        : publicMinds.publicPosts.list({ authorId, limit, offset }) as Promise<any>;
      let res: any;
      try {
        res = await fetchDeduped<any>(requestKey, requestPage);
      } catch (firstError) {
        // A cold production author query can outlast the public transport's
        // first timeout while still warming the exact path. Posts and Articles
        // share this bounded retry through fetchDeduped, so a cold profile gets
        // one recovery attempt rather than two request storms. Authenticated
        // requests keep the SDK's own retry policy and are never doubled here.
        if (sdk) throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (stale()) return;
        res = await fetchDeduped<any>(requestKey, requestPage);
      }
      if (stale()) return;
      const page = res.data || [];
      const raw = sdk
        ? page
        : page.filter((post: any) => articles ? isArticlePost(post) : !isArticlePost(post));
      const more = res.meta?.has_more ?? page.length >= limit;
      const visible = filterMuted(raw);
      visible.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
      setPosts((prev) => {
        const base = refresh ? [] : prev;
        const seen = new Set(base.map((p: any) => p.id));
        const merged = [...base, ...visible.filter((p: any) => !seen.has(p.id))];
        setCache(cacheKey, merged);
        return merged;
      });
      setHasMore(more);
      setError(null);
      // Advance through the unfiltered server page. Posts and Articles each
      // maintain their own cursor over the same anonymous projection.
      offsetRef.current = offset + page.length;
      cursorRef.current = sdk && typeof res.meta?.next_cursor === 'string'
        ? res.meta.next_cursor
        : null;
    } catch (err: any) {
      captureException(err, { hook: 'useProfilePosts', replies, articles });
      if (!stale()) {
        setError(err?.message || 'Could not load this profile feed');
        if (offsetRef.current === 0) setHasMore(false);
      }
    } finally {
      if (!stale()) { inFlightRef.current = false; setLoading(false); setRefreshing(false); }
    }
  // `enabled` belongs here. Without it this callback keeps the value it was
  // built with, so a tab that starts disabled and is then opened calls a
  // fetchPage still closed over enabled=false and returns immediately — the
  // tab never loads at all.
  }, [sdk, authorId, cacheKey, limit, replies, articles, enabled]);

  // Refetch from scratch whenever the author (or sdk) changes.
  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    setPosts(fresh || []);
    setLoading(enabled && !fresh && !!authorId && (!!sdk || !replies));
    setError(null);
    offsetRef.current = 0;
    cursorRef.current = null;
    setHasMore(true);
    if (authorId && enabled) fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, sdk, authorId, replies, enabled]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !loading && !refreshing && !inFlightRef.current) fetchPage(false);
  }, [fetchPage, hasMore, loading, refreshing]);

  return { posts, loading, refreshing, error, hasMore, loadMore, refresh: () => fetchPage(true) };
}

/**
 * Fetch a single post by ID.
 */
export function usePost(postId: string) {
  const { sdk } = useAuth();
  const cacheKey = `post:${postId}`;
  const viewerRequestKey = `${postId}:${sdk ? 'auth' : 'public'}`;
  const cached = getCached(cacheKey);
  const [post, setPost] = React.useState<any>(cached || null);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvedViewerRequestKey, setResolvedViewerRequestKey] = React.useState<string | null>(null);
  const [refreshToken, setRefreshToken] = React.useState(0);

  const refresh = React.useCallback(() => {
    setError(null);
    setLoading(true);
    setRefreshToken((token) => token + 1);
  }, []);

  // Reset when postId changes — never flash wrong post
  React.useEffect(() => {
    const freshCached = getCached(`post:${postId}`);
    setPost(freshCached || null);
    setLoading(!freshCached);
    setError(null);
    setResolvedViewerRequestKey(null);
  }, [postId]);

  // Always revalidate on mount (stale-while-revalidate). Replies change far
  // more often than the 30s cache window, so a fresh cache used to be served
  // WITHOUT a refetch — meaning a new reply (yours or someone else's) wouldn't
  // show until the cache expired. We still render the cached copy instantly
  // (no flash), but we always fetch the canonical post + replies in the
  // background and reconcile.
  // Retrying intentionally restarts this request after a settled failure.
  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken is the retry generation.
  React.useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    setError(null);
    (async () => {
      try {
        // Direct links are public product surfaces. Signed-in visitors keep the
        // identity-aware REST response (reaction/block state); signed-out
        // visitors use the SDK's visibility-filtered public projection. Never
        // fall back to a shared app key — that would act as the key owner.
        const res = await fetchDeduped<any>(`req:post:${postId}:${sdk ? 'auth' : 'public'}`, () =>
          sdk ? sdk.posts.get(postId) : publicMinds.publicPosts.get(postId));
        if (!cancelled) {
          setPost(res.data);
          setCache(cacheKey, res.data);
          setResolvedViewerRequestKey(viewerRequestKey);
        }
      } catch (err: any) {
        if (!cancelled) {
          captureException(err, { hook: 'usePost', postId });
          // A cached feed row can lack replies entirely. Keep its content, but
          // expose the failed refresh so the detail page can offer a retry.
          setError(err.message || 'Failed to load post');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, sdk, cacheKey, viewerRequestKey, refreshToken]);

  // Cache entries are intentionally shared between public and authenticated
  // renders so the page paints instantly. Consumers that act on viewer-only
  // fields (reaction, block state, etc.) must wait until the response for the
  // CURRENT auth state has landed instead of trusting a public cache entry.
  const viewerStateResolved = resolvedViewerRequestKey === viewerRequestKey;

  return { post, setPost, loading, error, viewerStateResolved, refresh };
}

/**
 * "More like this" — semantically related posts for the post-detail page so it
 * never dead-ends.
 *
 * Uses the existing server endpoint `GET /posts/:id/similar` (kNN over post
 * embeddings). The typed SDK has no `posts.similar()` method yet, so we reach
 * the resource's underlying HttpClient directly (same `(s as any)` escape hatch
 * the rest of this file uses for endpoints ahead of the SDK types). Returns []
 * gracefully when the seed has no embedding or the endpoint is unavailable.
 */
export function useSimilarPosts(postId: string | undefined, limit = 10) {
  const { sdk } = useAuth();
  const cacheKey = `similar-posts:${postId || 'none'}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && !!postId);

  React.useEffect(() => {
    if (!postId) { setPosts([]); setLoading(false); return; }
    const fresh = getCached(cacheKey);
    setPosts(fresh || []);
    setLoading(!fresh);
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped; never fall back to the shared app key
        // The HttpClient lives on every resource as `client`; use the posts
        // resource's to hit the un-typed similar endpoint.
        const http = (sdk.posts as any)?.client;
        if (!http?.get) { if (!cancelled) setLoading(false); return; }
        const res: any = await fetchDeduped(`req:similar:${postId}:${limit}`, () =>
          http.get(`/posts/${postId}/similar`, { limit, organization_id: ORG_ID || undefined }));
        if (!cancelled) {
          const data = filterMuted(res?.data || []);
          data.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
          setPosts(data);
          setCache(cacheKey, data);
        }
      } catch (err: any) {
        // Non-fatal — the section just renders its empty state.
        captureException(err, { hook: 'useSimilarPosts', postId });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, sdk, limit, cacheKey]);

  return { posts, loading };
}

/**
 * Fetch communities scoped to Minds org.
 */
export function useCommunities(limit = 20, opts?: { memberOnly?: boolean }) {
  const { sdk } = useAuth();
  // memberOnly → server-side `member=true`: the caller's own (accepted)
  // communities. Required at 96K communities — "mine" can no longer be derived
  // from is_member flags on page one of the public directory.
  const memberOnly = !!opts?.memberOnly;
  const cacheKey = `communities:${limit}:${memberOnly ? 'mine' : 'all'}`;
  const cached = getCached(cacheKey);
  const [communities, setCommunities] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);
  const [error, setError] = React.useState<string | null>(null);
  // True only after the first network fetch resolves this session. The sidebar
  // gates its is_member-filtered list on this so a STALE cached membership can
  // never flash before fresh server data confirms it — the intermittent phantom
  // QA/Support communities bug (the cache says joined, the server says no).
  const [fetchedOnce, setFetchedOnce] = React.useState(false);

  const fetch = React.useCallback(async () => {
    if (limit === 0) return;
    try {
      if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
      const s = sdk;
      const res = await fetchDeduped(`req:communities:${limit}:${memberOnly ? 'mine' : 'all'}`, () =>
        s.communities.list({ limit, organization_id: ORG_ID || undefined, ...(memberOnly ? { member: 'true' } : {}) } as any));
      const data = res.data || [];
      setCommunities(data);
      setCache(cacheKey, data);
    } catch (err: any) {
      setError(err.message || 'Failed to load communities');
    } finally {
      setLoading(false);
      setFetchedOnce(true);
    }
  }, [sdk, limit, cacheKey, memberOnly]);

  React.useEffect(() => {
    // Always revalidate on mount (stale-while-revalidate). We still render the
    // cached list instantly, but we MUST refetch so a stale `is_member` flag
    // can't persist — otherwise communities a user left (or that a server bug
    // once mislabeled as joined, e.g. the phantom QA/Support communities) linger
    // in the sidebar forever because the cache looked "fresh".
    if (cached) setLoading(false);
    fetch();
  }, [fetch]);

  // Refetch when any `communities:*` cache entry is invalidated (e.g. the
  // user joined or left a community on another screen) so the sidebar
  // Recents list reflects the new membership without a logout/login cycle.
  React.useEffect(() => {
    const unsub = subscribeToInvalidations((key) => {
      if (key.startsWith('communities:')) {
        fetch();
      }
    });
    return unsub;
  }, [fetch]);

  return { communities, loading, error, fetchedOnce, refresh: fetch };
}

/**
 * Fetch discoverable agents scoped to Minds org.
 */
export function useAgents(limit = 20) {
  const { sdk } = useAuth();
  const cacheKey = `agents:${limit}`;
  const cached = getCached(cacheKey);
  const [agents, setAgents] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (limit === 0) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        // Discover Agents = agents BOUND to this app (agent_project_access), not
        // every agent of the owning org. The session key is project-bound
        // (projectId=Minds), so the server's /agents/discoverable scopes to the
        // project's granted agents automatically WHEN organization_id is absent.
        // Passing organization_id forces the org-scoped path instead, which
        // surfaces operator/personal agents (aiOrganizationId === ORG) that
        // aren't part of the curated discover set — the cross-tenant-looking
        // bug. Omit it so an app with zero project agents returns [] and the
        // widget hides cleanly (no global/cross-tenant fallback).
        const res = await fetchDeduped(`req:agents:${limit}`, () => s.agents.listDiscoverable({ limit }));
        if (!cancelled) {
          const data = res.data || [];
          setAgents(data);
          setCache(cacheKey, data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey]);

  return { agents, loading, error };
}

/**
 * Fetch a user profile by username.
 */
export function useProfile(username: string) {
  const { sdk } = useAuth();
  const cacheKey = `profile:${username}`;
  const cached = getCached(cacheKey);
  const [profile, setProfile] = React.useState<any>(cached || null);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);

  // Reset when username changes — never show stale profile for different user
  React.useEffect(() => {
    const freshCached = getCached(`profile:${username}`);
    setProfile(freshCached || null);
    setLoading(!freshCached);
    setError(null);
    setIsFollowing(false);
  }, [username]);

  const loadProfile = React.useCallback(async () => {
    if (!sdk) {
      try {
        return await publicMinds.publicProfiles.getByUsername(username);
      } catch (error) {
        // `/user/:username` has historically also accepted a UUID. Preserve
        // that alias through the public users.get procedure.
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(username)) {
          return publicMinds.publicProfiles.get(username);
        }
        throw error;
      }
    }

    let res: any;
    try {
      res = await sdk.profiles.getByUsername(username);
    } catch {
      try {
        res = await sdk.profiles.get(username);
      } catch {
        try {
          const agentRes = await (sdk as any).agents.listDiscoverable({ limit: 200, organization_id: ORG_ID || undefined });
          const agents = agentRes.data || [];
          const match = agents.find((a: any) => a.username === username || a.id === username);
          if (match) {
            res = { data: { id: match.id, name: match.name, username: match.username, bio: match.bio || match.description, image: match.image || match.avatar, isAgent: true } };
          }
        } catch {}
        if (!res) throw new Error('User not found');
      }
    }
    return res;
  }, [sdk, username]);

  React.useEffect(() => {
    if (!username) return;
    // Always revalidate on mount (stale-while-revalidate). The cached profile
    // renders instantly, but we MUST re-fetch — a fresh cache used to early-
    // return here, which skipped the isFollowing fetch below, so after a page
    // refresh the follow button wrongly showed "Follow" for someone you already
    // follow (then "already following" if you clicked it).
    let cancelled = false;
    (async () => {
      try {
        const res = await loadProfile();
        if (!cancelled && res?.data) {
          setProfile(res.data);
          setCache(cacheKey, res.data);
          if (sdk && !(res.data as any).isAgent) {
            try {
              const followRes = await sdk.profiles.isFollowing(res.data.id);
              setIsFollowing(followRes.data?.is_following ?? false);
            } catch {}
          } else {
            setIsFollowing(false);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'User not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username, sdk, cacheKey, loadProfile]);

  const refresh = React.useCallback(async () => {
    if (!username) return;
    invalidatePrefix(cacheKey);
    try {
      const res = await loadProfile();
      if (res?.data) {
        setProfile(res.data);
        setCache(cacheKey, res.data);
        // Re-sync follow state too, so it survives a refresh and reflects the
        // server after a follow/unfollow.
        if (sdk && !(res.data as any).isAgent) {
          try {
            const followRes = await sdk.profiles.isFollowing(res.data.id);
            setIsFollowing(followRes.data?.is_following ?? false);
          } catch {}
        } else {
          setIsFollowing(false);
        }
      }
    } catch {}
  }, [username, sdk, cacheKey, loadProfile]);

  return { profile, setProfile, loading, error, isFollowing, setIsFollowing, refresh };
}

/**
 * Fetch the current user's profile.
 */
export function useMyProfile() {
  const { sdk, user } = useAuth();
  const cacheKey = 'myprofile';
  const cached = getCached(cacheKey);
  // Never start as null — use cached or auth user as initial value
  const [profile, setProfile] = React.useState<any>(cached || user || null);
  const [loading, setLoading] = React.useState(!cached && !user);

  const fetch = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.profiles.me();
      setProfile(res.data);
      setCache(cacheKey, res.data);
    } catch {}
    finally { setLoading(false); }
  }, [sdk]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  return { profile, loading, refresh: fetch };
}

/**
 * Fetch chat conversations.
 */
export function useConversations() {
  const { sdk, user } = useAuth();
  const cacheKey = 'conversations';
  const cached = getCached(cacheKey);
  const [conversations, setConversations] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);

  const fetch = React.useCallback(async () => {
    if (!sdk) return;
    try {
      // Post cards may expose the same share surface, and chat itself also
      // consumes this list. If more than one consumer mounts together they
      // must share the identity-scoped request instead of multiplying an
      // expensive conversation query across the whole visible feed.
      const res = await fetchDeduped(`req:conversations:${user?.id || 'unknown'}`, () =>
        sdk.chat.conversations({ limit: 50, organization_id: ORG_ID || undefined }));
      const data = res.data || [];
      setConversations(data);
      setCache(cacheKey, data);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [sdk, user?.id]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  // Match the invalidation contract used by useCommunities/usePosts so
  // any code path that calls `invalidate('conversations')` (e.g. agent
  // setup right after creating the personal-agent DM) forces this
  // sidebar to re-fetch without waiting 30s for the FRESH_MS window.
  React.useEffect(() => {
    const unsub = subscribeToInvalidations((key) => {
      if (key === cacheKey) fetch();
    });
    return unsub;
  }, [fetch]);

  return { conversations, loading, error, refresh: fetch };
}

/**
 * Fetch messages for a conversation.
 */
export function useMessages(conversationId: string) {
  const { sdk } = useAuth();
  const cacheKey = `messages:${conversationId}`;
  const cached = getCached(cacheKey);
  const [messages, setMessages] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);

  const fetch = React.useCallback(async () => {
    if (!sdk || !conversationId) return;
    try {
      const res = await sdk.chat.messages(conversationId, { limit: 50 });
      const data = res.data || [];
      setMessages(data);
      setCache(cacheKey, data);
    } catch {}
    finally { setLoading(false); }
  }, [sdk, conversationId, cacheKey]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  return { messages, setMessages, loading, refresh: fetch };
}

/**
 * Fetch tags.
 */
export function useTags(limit = 50) {
  const { sdk } = useAuth();
  const cacheKey = `tags:${limit}`;
  const cached = getCached(cacheKey);
  const [tags, setTags] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    if (fresh?.length) { setTags(fresh); setLoading(false); }
    // Fresh cache: the slow /tags aggregate isn't worth re-running.
    if (isFresh(cacheKey) && fresh?.length) return;
    let cancelled = false;
    // The /tags route aggregates post_count across the WHOLE corpus and, on a
    // large tenant, runs for tens of seconds — the "trending topics take ~30s"
    // report. Two defenses: (1) day-bucket the dedup key so every mount in the
    // day shares ONE in-flight request instead of each firing its own slow
    // query; (2) a soft timeout that unblocks `loading` after 6s so nothing sits
    // spinning — the cached chips stay on screen and the fresh list swaps in
    // whenever the server finally responds (the request is NOT aborted).
    const dayBucket = new Date().toISOString().slice(0, 10);
    const softTimer = setTimeout(() => { if (!cancelled) setLoading(false); }, 6000);
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        const res: any = await fetchDeduped(`req:tags:${limit}:${dayBucket}`, () => s.tags.list({ limit }) as Promise<any>);
        if (cancelled) return;
        const data = res?.data || [];
        if (data.length) { setTags(data); setCache(cacheKey, data); }
      } catch (err: any) {
        captureException(err, { hook: 'useTags' });
      } finally {
        clearTimeout(softTimer);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; clearTimeout(softTimer); };
  }, [sdk, limit, cacheKey]);

  return { tags, loading };
}

/**
 * Fetch org members as profiles (scoped to Minds org).
 */
export function useProfiles(limit = 20, enabled = true) {
  const { sdk } = useAuth();
  const cacheKey = `profiles:${limit}`;
  const cached = getCached(cacheKey);
  const [profiles, setProfiles] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(enabled && !cached && limit > 0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    if (limit === 0) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) {
      // An enabled consumer may mount after another surface warmed this key.
      // Adopt that page instead of returning with the state captured while the
      // hook was disabled.
      setProfiles(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        // The people directory is the app's real user base = project_members.
        // The session key is project-bound (projectId=Minds), so the server
        // scopes /profiles to project_members automatically; we pass org_id
        // only as a fallback for non-project-bound keys. (Previously this
        // used organizations.members(ORG), which returned org_members — the
        // operator team — and hid real users like project-member agents.)
        const res = await fetchDeduped(`req:profiles:${limit}`, () =>
          s.profiles.list({ limit, organization_id: ORG_ID || undefined } as any)
        );
        let data: any[] = res.data || [];
        // Filter out AI agents — they show in the Agents section
        data = data.filter((p: any) => !p.isAi && !p.is_ai && p.type !== 'agent');
        if (!cancelled) {
          setProfiles(data);
          setCache(cacheKey, data);
          // Pre-cache individual profiles so clicking is instant
          data.forEach((p: any) => {
            if (p.username) setCache(`profile:${p.username}`, p);
            if (p.id) setCache(`profile:${p.id}`, p);
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load profiles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey, enabled]);

  return { profiles, loading, error };
}

/**
 * The signed-in viewer's set of followed user ids — the real source of truth for
 * "am I following this person".
 *
 * The /profiles directory + /profiles/leaderboard payloads carry NO per-row
 * follow flag, so seeding a "Following" pill from `is_following` on those rows is
 * always false. Instead we fetch the viewer's OWN following list once
 * (sdk.profiles.following — the same call the Following feed uses) and expose it
 * as a Set, so any directory/leaderboard row can be checked for membership.
 */
export function useFollowingIds() {
  const { sdk, user } = useAuth();
  const cacheKey = user?.id ? `following-ids:${user.id}` : null;
  const cached = cacheKey ? getCached(cacheKey) : null;
  const [ids, setIds] = React.useState<Set<string>>(() => new Set<string>(cached || []));
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    if (!sdk || !user?.id || !cacheKey) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDeduped(`req:following:${user.id}`, () => sdk.profiles.following(user.id, { limit: 500 }));
        const list: string[] = (res.data || []).map((p: any) => p.id).filter(Boolean);
        if (!cancelled) {
          setIds(new Set(list));
          setCache(cacheKey, list);
        }
      } catch {
        // Leave whatever we have (empty or cached) — a failed fetch must not
        // wipe a working set.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, user?.id, cacheKey]);

  return { followingIds: ids, loading };
}

/**
 * Engagement leaderboard for people (server-ranked by post_count + reactions).
 *
 * The plain /profiles list returns NO follower/post counts — just identity
 * columns ordered by signup date — so a client-side "Most active" sort over it
 * has nothing to rank on. This endpoint (/profiles/leaderboard, server max 100)
 * returns post_count + engagement per user, network-ranked. The People tab joins
 * it onto the project-scoped directory by user id to give the "Most active" chip
 * a real signal without a server change. Returns a Map id -> {post_count,
 * engagement} so callers can enrich their own list.
 */
/**
 * Channels related to a profile: accounts the profile's followees also follow
 * (GET /profiles/:id/related). Feeds the profile rail so it is about the
 * channel on screen instead of the same network-wide top five everywhere. An
 * API without the route, or a profile with no graph, yields [] and the rail
 * falls back to trending.
 */
export function useRelatedProfiles(userId?: string | null, limit = 5) {
  const { sdk } = useAuth();
  const cacheKey = `related-profiles:${userId || ''}:${limit}`;
  const cached = userId ? getCached(cacheKey) : null;
  const [entries, setEntries] = React.useState<any[]>(cached || []);

  React.useEffect(() => {
    if (!sdk || !userId) { setEntries([]); return; }
    if (isFresh(cacheKey) && cached) { setEntries(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const http = (sdk.posts as any)?.client;
        if (!http?.get) return;
        const res: any = await fetchDeduped(`req:${cacheKey}`, () =>
          http.get(`/profiles/${encodeURIComponent(userId)}/related`, { limit, organization_id: ORG_ID || undefined }));
        if (cancelled) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        setEntries(data);
        setCache(cacheKey, data);
      } catch {
        // Older API without the route: the rail shows trending instead.
        if (!cancelled) setEntries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, userId, limit, cacheKey]);

  return entries;
}

/**
 * The first members of a group, owners and moderators first, for the group
 * page rail. GET /communities/:id/members lists accepted members with their
 * role; the server hides a private group's list from non-members, so the rail
 * asks only when the viewer may see it.
 */
export function useGroupMembers(communityId?: string | null, enabled = true, limit = 8) {
  const { sdk } = useAuth();
  const cacheKey = `group-members:${communityId || ''}:${limit}`;
  const cached = communityId ? getCached(cacheKey) : null;
  const [members, setMembers] = React.useState<any[]>(cached || []);
  const [total, setTotal] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!sdk || !communityId || !enabled) { setMembers([]); return; }
    if (isFresh(cacheKey) && cached) { setMembers(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const res: any = await fetchDeduped(`req:${cacheKey}`, () => sdk.communities.members(communityId, { limit: 40 } as any));
        if (cancelled) return;
        const rows: any[] = Array.isArray(res?.data) ? res.data : [];
        const rank = (r: string) => ({ owner: 3, admin: 2, moderator: 1 } as Record<string, number>)[r] ?? 0;
        const sorted = [...rows].sort((a, b) => rank(b.role) - rank(a.role)).slice(0, limit);
        setMembers(sorted);
        setTotal(rows.length);
        setCache(cacheKey, sorted);
      } catch {
        if (!cancelled) setMembers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, communityId, enabled, limit, cacheKey]);

  return { members, total };
}

/**
 * Groups related to the one on screen (GET /communities/:id/related):
 * ranked by how many of its members are also in the other group, with the
 * most-joined groups as the fallback. An API without the route yields [] and
 * the rail shows trending instead.
 */
export function useRelatedGroups(communityId?: string | null, limit = 5) {
  const { sdk } = useAuth();
  const cacheKey = `related-groups:${communityId || ''}:${limit}`;
  const cached = communityId ? getCached(cacheKey) : null;
  const [groups, setGroups] = React.useState<any[]>(cached || []);

  React.useEffect(() => {
    if (!sdk || !communityId) { setGroups([]); return; }
    if (isFresh(cacheKey) && cached) { setGroups(cached); return; }
    let cancelled = false;
    (async () => {
      try {
        const http = (sdk.posts as any)?.client;
        if (!http?.get) return;
        const res: any = await fetchDeduped(`req:${cacheKey}`, () =>
          http.get(`/communities/${encodeURIComponent(communityId)}/related`, { limit }));
        if (cancelled) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        setGroups(data);
        setCache(cacheKey, data);
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, communityId, limit, cacheKey]);

  return groups;
}

/**
 * The signed-out feed: newest public posts across the network, through the
 * anonymous public client. Paged by offset; the visitor reads, and every
 * write on a card asks them to sign in.
 */
export function useSignedOutFeed(limit = 20) {
  const [posts, setPosts] = React.useState<any[]>(getCached('signed-out-feed') || []);
  const [loading, setLoading] = React.useState(posts.length === 0);
  const [hasMore, setHasMore] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const offsetRef = React.useRef(0);
  const busyRef = React.useRef(false);

  const load = React.useCallback(async (refresh = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const offset = refresh ? 0 : offsetRef.current;
      const res: any = await publicMinds.publicPosts.latest({ limit, offset });
      const page = filterMuted(res?.data || []);
      offsetRef.current = offset + (res?.data?.length || 0);
      setHasMore(!!res?.meta?.has_more);
      setPosts((prev) => {
        const next = refresh ? page : dedupePosts([...prev, ...page]);
        setCache('signed-out-feed', next.slice(0, 60));
        return next;
      });
      setError(null);
    } catch (err) {
      captureException(err, { hook: 'useSignedOutFeed' });
      setError('Could not load posts');
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [limit]);

  React.useEffect(() => { load(true); }, [load]);

  return { posts, loading, hasMore, error, loadMore: () => (hasMore ? load(false) : Promise.resolve()), refresh: () => load(true) };
}

export function useProfileLeaderboard(limit = 100, sort: 'engagement' | 'followers' = 'engagement') {
  const { sdk } = useAuth();
  const cacheKey = `profile-leaderboard:${sort}:${limit}`;
  const cached = getCached(cacheKey);
  const [entries, setEntries] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);

  React.useEffect(() => {
    if (limit === 0) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key
        const s = sdk;
        const res: any = await fetchDeduped(`req:profile-leaderboard:${sort}:${limit}`, () =>
          (s as any).profiles.leaderboard({ limit, sort, organization_id: ORG_ID || undefined }));
        if (!cancelled) {
          const data = res.data || [];
          setEntries(data);
          setCache(cacheKey, data);
        }
      } catch {
        // Non-fatal: the People tab falls back to follower-only ranking.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, sort, cacheKey]);

  const byId = React.useMemo(() => {
    const m = new Map<string, { postCount: number; engagement: number; followerCount: number }>();
    for (const e of entries) {
      if (e?.id) m.set(e.id, {
        postCount: Number(e.post_count ?? e.postCount ?? 0) || 0,
        engagement: Number(e.engagement ?? 0) || 0,
        followerCount: Number(e.follower_count ?? e.followerCount ?? 0) || 0,
      });
    }
    return m;
  }, [entries]);

  // The server-ranked order of ids (top-N for this sort), so a caller can present
  // the leaderboard's exact ordering even when joining onto another list.
  const orderedIds = React.useMemo(() => entries.map((e: any) => e?.id).filter(Boolean) as string[], [entries]);

  return { entries, byId, orderedIds, loading };
}

/**
 * Search posts scoped to Minds org. Optionally composes the same time-window
 * (since/until) + topic (tag_ids) filters the Discover Posts tab exposes, so a
 * search honors the active Time + Topic pills server-side (the FTS route honors
 * since/until/tag_ids) instead of the caller client-filtering the top-N.
 */
export function useSearchPosts(query: string, opts?: { since?: string; until?: string; tagId?: string }) {
  const { sdk } = useAuth();
  const { since, until, tagId } = opts || {};
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      // Clearing the query mid-search left loading=true, so the search
      // results UI kept a spinner over an empty list. Reset both.
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        // Search posts — compose the active time/topic filters into the FTS query.
        const res = await s.posts.search({
          q: query,
          limit: 20,
          organization_id: ORG_ID || undefined,
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
          ...(tagId ? { tag_ids: tagId } : {}),
        } as any);
        if (!cancelled) setResults(res.data || []);
      } catch {
        // If posts.search fails, fall back to listing and client-side filtering
        if (!cancelled) {
          try {
            if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
            const s = sdk;
            const res = await s.posts.list({ limit: 50, organization_id: ORG_ID || undefined });
            const q = query.toLowerCase();
            const filtered = (res.data || []).filter((p: any) =>
              (p.content || '').toLowerCase().includes(q) ||
              (p.title || '').toLowerCase().includes(q) ||
              (p.author?.name || '').toLowerCase().includes(q)
            );
            if (!cancelled) setResults(filtered);
          } catch {}
        }
      }
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sdk, since, until, tagId]);

  return { results, loading };
}

/**
 * Unified search across posts, profiles, and communities.
 */
export function useSearch(query: string) {
  const { sdk } = useAuth();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [people, setPeople] = React.useState<any[]>([]);
  const [communities, setCommunities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      setPosts([]);
      setPeople([]);
      setCommunities([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        const q = query.toLowerCase();

        // Search in parallel
        const [postRes, profileRes, commRes] = await Promise.allSettled([
          s.posts.search({ q: query, limit: 10, organization_id: ORG_ID || undefined }),
          s.profiles.search ? s.profiles.search({ q: query, limit: 10, organization_id: ORG_ID || undefined }) : Promise.reject('no search'),
          s.communities.list({ limit: 50, organization_id: ORG_ID || undefined }),
        ]);

        if (!cancelled) {
          setPosts(postRes.status === 'fulfilled' ? postRes.value.data || [] : []);
          setPeople(profileRes.status === 'fulfilled' ? profileRes.value.data || [] : []);
          // Client-side filter communities since there's no search endpoint
          const allComm = commRes.status === 'fulfilled' ? commRes.value.data || [] : [];
          setCommunities(allComm.filter((c: any) =>
            (c.name || '').toLowerCase().includes(q) ||
            communityDescription(c).toLowerCase().includes(q)
          ));
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sdk]);

  return { posts, people, communities, loading };
}
