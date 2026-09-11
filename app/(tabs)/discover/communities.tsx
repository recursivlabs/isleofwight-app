import * as React from 'react';
import { View, FlatList, Pressable, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../../../components';
import { useCommunities } from '../../../lib/hooks';
import { spacing, radius } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { communityDescription, timestampOf } from '../../../lib/models';
import { FilterMenu, FilterBar, CommunityRow, ListSkeleton, communityMemberCount, communityActivity } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Communities tab — leaderboard + filter chips. There's no community search
// endpoint, so a query client-filters the loaded list. Chips: Most members /
// Most active (members + posts*2) / Newest (created_at). The list payload now
// carries member_count + post_count + created_at, so "Most active" is a
// genuinely distinct ordering from "Most members" (it weights post volume).
// ──────────────────────────────────────────────────────────────────────────

type CommSort = 'members' | 'active' | 'newest';
const CHIPS: { key: CommSort; label: string }[] = [
  { key: 'members', label: 'Most members' },
  { key: 'active', label: 'Most active' },
  { key: 'newest', label: 'Newest' },
];

export default function DiscoverCommunities() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string }>();
  const colors = useColors();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Sort lives in the URL so it deep-links + survives back/forward.
  const sort: CommSort = (params.sort === 'active' || params.sort === 'newest') ? params.sort : 'members';
  const setSort = React.useCallback((k: CommSort) => router.setParams({ sort: k === 'members' ? undefined : k } as any), [router]);
  // No topic filter on Communities: the /communities payload + server route carry
  // no tag field, so a topic control would be a dead chip here (it lives on Posts).
  // 100 is the server's max for /communities — fetch the whole set (~95 live) so
  // the count is accurate and the chips re-sort the FULL corpus, not a page.
  const { communities, loading } = useCommunities(100);

  const ranked = React.useMemo(() => {
    let list = [...(communities || [])];
    if (isSearching) {
      const q = query.toLowerCase();
      list = list.filter((c: any) =>
        (c.name || '').toLowerCase().includes(q) ||
        communityDescription(c).toLowerCase().includes(q));
    }
    if (sort === 'newest') {
      return list.sort((a, b) => new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    }
    if (sort === 'active') {
      return list.sort((a, b) => communityActivity(b) - communityActivity(a));
    }
    return list.sort((a, b) => communityMemberCount(b) - communityMemberCount(a));
  }, [communities, sort, isSearching, query]);

  const toCommunity = (c: any) => router.push(`/community/${c.id}` as any);

  // New Community button — lives in a FIXED header row (NOT the FlatList's
  // ListHeaderComponent), so it's always visible top-right regardless of scroll
  // position or whether the list is empty. Routes to the create-community flow.
  const newCommunityButton = (
    <Pressable
      onPress={() => router.push('/(tabs)/create?mode=community' as any)}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingLeft: spacing.md, paddingRight: spacing.md, paddingVertical: 7,
        borderRadius: radius.full, backgroundColor: colors.accent,
        opacity: pressed ? 0.85 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name="add" size={16} color={colors.textOnAccent} />
      <Text variant="caption" color={colors.textOnAccent} style={{ fontFamily: 'Roboto-Medium' }}>New Community</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Fixed tab header row — title + always-visible New Community button. */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
        }}
      >
        <Text variant="h3">Communities</Text>
        {newCommunityButton}
      </View>

      {loading && (communities || []).length === 0 ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={ranked}
          keyExtractor={(item: any, i) => `c-${item.id || i}`}
          renderItem={({ item }) => <CommunityRow community={item} onPress={() => toCommunity(item)} />}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {!isSearching && (
                <FilterBar>
                  <FilterMenu options={CHIPS} value={sort} icon="swap-vertical" onChange={setSort} />
                </FilterBar>
              )}
              {ranked.length > 0 && (
                <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
                  <Text variant="caption" color={colors.textMuted}>
                    {isSearching ? `${ranked.length} result${ranked.length !== 1 ? 's' : ''}` : `${ranked.length} communities to join`}
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
              <Ionicons name="people-outline" size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Groups'}</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                {isSearching ? 'Try a different search term.' : 'Be the first to start one.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
