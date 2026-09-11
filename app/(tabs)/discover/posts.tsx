import * as React from 'react';
import { View, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button, PostCard } from '../../../components';
import { useDiscoverPosts, useSearchPosts, useTags } from '../../../lib/hooks';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { postScore, postReplyCount, timestampOf, dedupePosts } from '../../../lib/models';
import {
  FilterMenu,
  FilterBar,
  TopicsPill,
  hotScore,
  withinRange,
  sinceForRange,
  TIME_RANGE_CHIPS,
  ListSkeleton,
  type TimeRange,
} from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Posts tab — the master search console's default. ALL posts, paginated
// (infinite scroll), with filters that change the SERVER query:
//
//   sort menu:   New  → recency (server default order)
//                Top  → ?sort=score (all-time top)
//                Hot  → ?sort=hot (SQL engagement/age decay over the corpus)
//   time menu:   Today / This week / This month / All time
//                → computes a `since` ISO passed as ?since= (server filters
//                  created_at; a client withinRange() pass stays as defense)
//   topics pill: opens a weighted tag-cloud modal → ?tag_ids=<id> (server
//                filters via the post_tag join). Hides when no tags exist.
//
// When the shared search box has a query, server FTS (/posts/search?q=) takes
// over and results render in the same list — and the Time + Topics pills compose
// into that search (the FTS route honors since/tag_ids). All of sort/range/tag/q
// live in the URL so deep-links + back/forward work.
// ──────────────────────────────────────────────────────────────────────────

type PostSort = 'new' | 'top' | 'hot';
const SORT_CHIPS: { key: PostSort; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'top', label: 'Top' },
  { key: 'hot', label: 'Hot' },
];

export default function DiscoverPosts() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; sort?: string; range?: string; tag?: string }>();
  const colors = useColors();

  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  // Filter state lives in the URL so deep-links + filters are shareable.
  // Default sort is Top (highest-scoring) — absent param → 'top'.
  const sort: PostSort = (params.sort === 'new' || params.sort === 'hot') ? params.sort : 'top';
  // Default time range depends on sort. Top means "the best posts" — on the
  // relaunch corpus the genuinely high-engagement content is all imported
  // (older than a week), so a default 'week' window hid every top post and left
  // only this week's low-engagement/spam. Top therefore defaults to ALL-TIME so
  // it actually shows top posts. New/Hot stay windowed to 'week' for freshness.
  const rangeDefault: TimeRange = sort === 'top' ? 'month' : 'week';
  const range: TimeRange =
    (params.range === 'today' || params.range === 'week' || params.range === 'month' || params.range === 'all')
      ? (params.range as TimeRange)
      : rangeDefault;
  const tagId = typeof params.tag === 'string' && params.tag ? params.tag : null;

  const setParam = React.useCallback((patch: Record<string, string | undefined>) => {
    router.setParams(patch as any);
  }, [router]);

  // The server date window — passed as ?since= (and client-filtered as fallback).
  const since = React.useMemo(() => sinceForRange(range), [range]);

  // SEARCH is ALL-TIME. Search is intent-driven: when a user searches "bitcoin"
  // they want any matching content regardless of recency. The browse Time pill
  // defaults to "This Week" (fresh content for browsing), but composing that
  // window into the FTS query windows old legacy posts out and returns 0
  // results — the "bitcoin → 0" bug. So search IGNORES the browse Time pill
  // entirely and queries the whole corpus (no ?since).

  // All topics for the tag-cloud modal (server returns them ranked by post_count,
  // max 100). ~40 auto-topics exist; the Topics pill hides itself when empty.
  const { tags } = useTags(100);

  // The paginated feed. Each order maps to a real server sort: 'new' → recency,
  // 'top' → ?sort=score (all-time), 'hot' → ?sort=hot (SQL engagement/age decay
  // over the WHOLE corpus). 'since' windows server-side. So the pages come back
  // already correctly ordered + windowed — the caller only dedups + stabilizes.
  const { posts, loading, hasMore, loadMore, refreshing, refresh } = useDiscoverPosts({
    order: sort,
    since,
    tagId: tagId || undefined,
    limit: 30,
  });

  // Server FTS when searching. Search is ALL-TIME (no `since`) so old legacy
  // content still matches — only the Topic pill composes into the query. The
  // browse Time pill is intentionally NOT applied to search (see SEARCH note above).
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query, {
    tagId: tagId || undefined,
  });

  // Rank + window the fetched pages. Dedup collapses repost/remind noise.
  // The server already applied the sort (hot/score/recency) + the time window
  // (?since) + topic (?tag_ids) — this client pass is a stabilizer over the
  // merged pages (consistent order as pages append) plus cheap date defense.
  const ranked = React.useMemo(() => {
    let list = dedupePosts([...(posts || [])]);
    // Client-side time window — defensive; the server already filtered by ?since.
    if (range !== 'all') list = list.filter((p: any) => withinRange(p, range));
    if (sort === 'hot') {
      list.sort((a, b) => hotScore(b) - hotScore(a));
    } else if (sort === 'top') {
      list.sort((a, b) => (postScore(b) + postReplyCount(b)) - (postScore(a) + postReplyCount(a)));
    } else {
      // new — strict recency.
      list.sort((a, b) => new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    }
    return list;
  }, [posts, sort, range]);

  // Search results: the topic + time filters are applied server-side (the FTS
  // route honors tag_ids + since), so here we only dedup. We must NOT re-filter
  // by tagId client-side — the server strips auto-topic tags from each post's
  // `tags` array, so a client `tags.includes(tagId)` check would wrongly zero
  // out every result when a topic is selected.
  const searched = React.useMemo(() => {
    return dedupePosts([...(searchResults || [])]);
  }, [searchResults]);

  const data = isSearching ? searched : ranked;
  const firstLoad = (isSearching ? searchLoading : loading) && data.length === 0;

  // When a client-side filter (time range / topic) thins the fetched pages to
  // very few rows, the short list can't scroll, so onEndReached never fires and
  // the user is stranded. Auto-pull more pages (bounded by hasMore) until we
  // have a screenful or run out. Drops out for free once the server honors the
  // filters and returns full pages. Search is a fixed FTS top-N — skip it.
  React.useEffect(() => {
    if (isSearching || loading || !hasMore) return;
    if ((range !== 'all' || tagId) && data.length < 12) {
      loadMore();
    }
  }, [isSearching, loading, hasMore, range, tagId, data.length, loadMore]);

  // Pagination only drives the non-search feed (search is a fixed top-N FTS).
  const onEndReached = isSearching ? undefined : loadMore;
  const showFooter = !isSearching && hasMore && data.length > 0;

  if (firstLoad) return <ListSkeleton />;

  return (
    <FlatList
      refreshControl={
        isSearching ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        )
      }
      data={data}
      keyExtractor={(item: any, i) => `p-${item.id || i}`}
      renderItem={({ item }) => <PostCard post={item} compact />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent=<FilterBar>
            {!isSearching && (
              <FilterMenu
                options={SORT_CHIPS}
                value={sort}
                icon="swap-vertical"
                onChange={(k) => setParam({ sort: k === 'top' ? undefined : k })}
              />
            )}
            {/* Time pill is a BROWSE control only — search is always all-time
               (recency-windowing a search returns 0 for legacy content), so we
               hide it while a query is active. */}
            {!isSearching && (
              <FilterMenu
                options={TIME_RANGE_CHIPS}
                value={range}
                icon="time-outline"
                onChange={(k) => setParam({ range: k === 'all' ? undefined : k })}
              />
            )}
            <TopicsPill
              tags={tags as any}
              activeId={tagId}
              onPick={(id) => setParam({ tag: id || undefined })}
            />
          </FilterBar>
      ListFooterComponent={showFooter ? (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Posts'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {isSearching ? 'Try a different search term.' : (range !== 'all' || tagId) ? 'Nothing in this filter yet — try widening the range.' : 'Be the first to create something.'}
          </Text>
          {!isSearching && <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>}
        </View>
      }
    />
  );
}
