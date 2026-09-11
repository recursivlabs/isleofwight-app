import * as React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../../components';
import { useProfiles, useProfileLeaderboard, useFollowingIds } from '../../../lib/hooks';
import { filterJunkCreators } from '../../../lib/quality';
import { useAuth } from '../../../lib/auth';
import { ORG_ID } from '../../../lib/recursiv';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { isSelfProfile, profileFollowerCount, profilePostCount } from '../../../lib/models';
import { FilterMenu, FilterBar, PersonRow, ListSkeleton } from '../../../lib/discover';
import { afterFollowChange } from '../../../lib/follows';

// ──────────────────────────────────────────────────────────────────────────
// People tab — server-ranked leaderboards + filter chips, or search results when
// the shared search box has a query. Chips: Most followers / Most active /
// Suggested — each a GENUINELY distinct ordering:
//
//   Most active     → /profiles/leaderboard?sort=engagement (post_count +
//                     reactions, true top-N across the whole corpus)
//   Most followers  → /profiles/leaderboard?sort=followers (network follower
//                     count, true top-N) — a real signal, not all-zeros
//   Suggested       → a directory-wide blend (active, then followed) since the
//                     payload carries no closeness signal
//
// The /profiles directory list (server max 200) returns identity columns only —
// no counts — so it can't rank these on its own. We present the leaderboard rows
// directly (they carry the real counts) and hydrate bio/image from the directory
// join by id. Both leaderboards now return follower_count + post_count + engagement.
// ──────────────────────────────────────────────────────────────────────────

type PeopleSort = 'followers' | 'active' | 'suggested';
const CHIPS: { key: PeopleSort; label: string }[] = [
  { key: 'followers', label: 'Most followers' },
  { key: 'active', label: 'Most active' },
  { key: 'suggested', label: 'Suggested' },
];

export default function DiscoverPeople() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string }>();
  const colors = useColors();
  const { sdk, user } = useAuth();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Sort lives in the URL so it deep-links + survives back/forward.
  const sort: PeopleSort = (params.sort === 'active' || params.sort === 'suggested') ? params.sort : 'followers';
  const setSort = React.useCallback((k: PeopleSort) => router.setParams({ sort: k === 'followers' ? undefined : k } as any), [router]);
  // No topic filter on People: the /profiles payload + server route carry no tag
  // field, so a topic control would be a dead chip here (it lives on Posts).
  // 200 is the server's max for /profiles — fetch the largest pool it allows so
  // the directory + leaderboard re-rank the whole corpus, not just ~60.
  const { profiles, loading: profilesLoading, error: profilesError } = useProfiles(200);
  // Two server-ranked leaderboards give the authoritative ordering + real counts
  // (the /profiles directory carries no follower/post counts). "Most active" uses
  // the engagement-ranked board; "Most followers" uses the follower-ranked board —
  // each is the true top-N across the WHOLE corpus, not a re-sort of a page.
  const { entries: activeBoard, byId: engagementById, loading: activeLoading } = useProfileLeaderboard(100, 'engagement');
  const { entries: followerBoard, byId: followerById, loading: followerLoading } = useProfileLeaderboard(100, 'followers');
  // The viewer's REAL following set — the directory/leaderboard payloads carry no
  // per-row follow flag, so this is the only reliable source for the "Following"
  // pill state. Seeds followedIds below so already-followed creators render filled.
  const { followingIds } = useFollowingIds();

  // Profile fields (bio, image, website…) the leaderboard rows don't carry,
  // joined by id from the directory so the rows render richly.
  const profileById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles || []) if (p?.id) m.set(p.id, p);
    return m;
  }, [profiles]);

  // Merge a leaderboard row with its directory profile (counts win from the
  // board; identity/bio win from whichever has them).
  const hydrate = React.useCallback((row: any) => {
    const p = profileById.get(row?.id);
    return p ? { ...p, ...row } : row;
  }, [profileById]);

  // Search people via the SDK (the same path the old discover used).
  const [searchedPeople, setSearchedPeople] = React.useState<any[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  // A failed search must say so: swallowing it into an empty list renders
  // "No Results · Try a different search term", which is wrong advice when the
  // request never came back. searchAttempt lets the failure state retry the
  // same query without the member having to retype it.
  const [searchError, setSearchError] = React.useState(false);
  const [searchAttempt, setSearchAttempt] = React.useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: searchAttempt is the retry generation — bumping it re-runs the same query after a failure.
  React.useEffect(() => {
    if (!isSearching || !sdk) { setSearchedPeople([]); setSearchLoading(false); setSearchError(false); return; }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: query, limit: 20, organization_id: ORG_ID || undefined } as any);
        if (!cancelled) { setSearchedPeople(res.data || []); setSearchError(false); }
      } catch {
        if (!cancelled) { setSearchedPeople([]); setSearchError(true); }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, isSearching, sdk, searchAttempt]);

  // Activity score: leaderboard engagement (post_count + reactions) joined by id,
  // falling back to any count on the directory payload.
  const activityScore = React.useCallback((p: any): number => {
    const board = engagementById.get(p?.id);
    if (board?.engagement) return board.engagement;
    return profilePostCount(p) || board?.postCount || 0;
  }, [engagementById]);

  // Follower score: real network follower count from the follower-ranked board.
  const followerScore = React.useCallback((p: any): number => {
    return followerById.get(p?.id)?.followerCount ?? profileFollowerCount(p) ?? 0;
  }, [followerById]);

  const ranked = React.useMemo(() => {
    if (sort === 'active') {
      // Present the engagement board directly (already server-ranked, real counts).
      const board = (activeBoard || []).map(hydrate);
      return board.length ? board : [...(profiles || [])].sort((a, b) => activityScore(b) - activityScore(a));
    }
    if (sort === 'followers') {
      // Present the follower board directly (true top-N by network followers).
      const board = (followerBoard || []).map(hydrate);
      return board.length ? board : [...(profiles || [])].sort((a, b) => followerScore(b) - followerScore(a));
    }
    // Suggested — a blend over the full directory: most active + followed first.
    // (No closeness signal in the payload; this is the sensible fallback.)
    return [...(profiles || [])].sort((a, b) => {
      const e = activityScore(b) - activityScore(a);
      if (e) return e;
      const f = followerScore(b) - followerScore(a);
      if (f) return f;
      return 0;
    });
  }, [sort, activeBoard, followerBoard, profiles, hydrate, activityScore, followerScore]);

  const data = filterJunkCreators(isSearching ? searchedPeople : ranked);
  const baseLoading = sort === 'followers' ? followerLoading : sort === 'active' ? activeLoading : profilesLoading;
  const loading = (isSearching ? searchLoading : baseLoading) && data.length === 0;

  // Follow state, keyed by user id. The real source of truth is the viewer's
  // OWN following list (useFollowingIds) — the /profiles + leaderboard payloads
  // DON'T carry a per-row follow flag, so seeding only from is_following/etc.
  // left every pill stuck on "Follow". We seed from the viewer's following set
  // (so already-followed creators render the filled "Following" pill), still
  // honour any payload flag if present, then toggle optimistically on tap. A Set
  // means the pill stays correct across re-renders without re-fetching per row.
  const [followedIds, setFollowedIds] = React.useState<Set<string>>(new Set());
  // Both seeding effects MUST return `prev` when nothing was added. `data` is
  // rebuilt every render (filterJunkCreators returns a fresh array), so the
  // second effect runs on every render — an updater that always returns a new
  // Set changes state identity every time, which re-renders, which re-runs the
  // effect: an unconditional re-render loop that pegged the tab's CPU forever.
  // Returning `prev` lets React bail out (Object.is) and the loop settle.
  React.useEffect(() => {
    if (!followingIds || followingIds.size === 0) return;
    setFollowedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of followingIds) {
        if (!next.has(id)) { next.add(id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [followingIds]);
  React.useEffect(() => {
    setFollowedIds((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const p of data || []) {
        const known = p?.is_following ?? p?.isFollowing ?? p?.following;
        if (known === true && p?.id && !next.has(p.id)) { next.add(p.id); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [data]);

  const handleFollow = async (userId: string) => {
    if (!sdk || !userId || userId === user?.id) return;
    const wasFollowing = followedIds.has(userId);
    // Optimistic toggle.
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(userId); else next.add(userId);
      return next;
    });
    try {
      if (wasFollowing) await sdk.profiles.unfollow(userId);
      else await sdk.profiles.follow(userId);
      afterFollowChange();
    } catch {
      // Revert on failure.
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(userId); else next.delete(userId);
        return next;
      });
    }
  };
  const toUser = (u: any) => router.push(`/${u.username || u.id}` as any);

  if (loading) return <ListSkeleton />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item: any, i) => `u-${item.id || i}`}
      renderItem={({ item }) => (
        <PersonRow person={item} onPress={() => toUser(item)} onFollow={() => handleFollow(item.id)} isFollowed={followedIds.has(item.id)} canFollow={!isSelfProfile(item, user)} />
      )}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <>
          {!isSearching && (
            <FilterBar>
              <FilterMenu options={CHIPS} value={sort} icon="swap-vertical" onChange={setSort} />
            </FilterBar>
          )}
          {data.length > 0 && (
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              <Text variant="caption" color={colors.textMuted}>
                {isSearching
                  ? `${data.length} result${data.length !== 1 ? 's' : ''}`
                  : sort === 'followers'
                    ? `Top ${data.length} by followers`
                    : sort === 'active'
                      ? `Top ${data.length} most active`
                      : `${data.length}${data.length >= 200 ? '+' : ''} creators on the network`}
              </Text>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        // Outage honesty: a failed request must never wear the empty state's
        // clothes. "No Results" tells the member to change their query, and
        // "As creators join…" tells them the network is empty — both are wrong
        // when the truth is the request didn't come back.
        isSearching && searchError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.accent} />
            <Text variant="h2" color={colors.text} align="center">Search Unavailable</Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
              Couldn&apos;t search people. Check your connection and try again.
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Retry people search" onPress={() => setSearchAttempt((a) => a + 1)}>
              <Text variant="bodyMedium" color={colors.accent}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : !isSearching && profilesError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.accent} />
            <Text variant="h2" color={colors.text} align="center">Couldn&apos;t Load Creators</Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
              Something went wrong reaching the network. Try again in a moment.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
            <Ionicons name="person-outline" size={40} color={colors.accent} />
            <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Channels'}</Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
              {isSearching ? 'Try a different search term.' : 'As creators join, they show up here.'}
            </Text>
          </View>
        )
      }
    />
  );
}
