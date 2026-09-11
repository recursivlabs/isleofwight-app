import * as React from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from '../components/Text';
import { Container } from '../components/Container';
import { RightRailLayout } from '../components/RightRailLayout';
import { FeedSkeletons } from '../components/PostSkeleton';
import { ScreenHeader } from '../components/ScreenHeader';
import { PostCard } from '../components/PostCard';
import { TabBar } from '../components/TabBar';
import { Button } from '../components/Button';
import { getBookmarks } from '../lib/bookmarks';
import { getCached, setCache } from '../lib/cache';
import { useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import { spacing } from '../constants/theme';

type SavedView = 'bookmarks' | 'liked';
const LIKED_PAGE_SIZE = 20;

/**
 * Saved posts has two intentionally different stores: bookmarks are private
 * local state, while likes are server-backed so they follow the signed-in user
 * across devices. Both are hydrated into the normal PostCard experience.
 */
export default function BookmarksScreen() {
  const colors = useColors();
  const { sdk } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const requestedView = (Array.isArray(params.tab) ? params.tab[0] : params.tab) === 'liked'
    ? 'liked'
    : 'bookmarks';
  const [activeView, setActiveView] = React.useState<SavedView>(requestedView);

  React.useEffect(() => {
    setActiveView(requestedView);
  }, [requestedView]);

  const selectView = React.useCallback((key: string) => {
    const next: SavedView = key === 'liked' ? 'liked' : 'bookmarks';
    setActiveView(next);
    router.setParams({ tab: next === 'liked' ? 'liked' : undefined } as any);
  }, [router]);

  const [savedPosts, setSavedPosts] = React.useState<any[]>(() =>
    getBookmarks().map((id) => getCached(`post:${id}`)).filter(Boolean) as any[]);
  const [savedLoading, setSavedLoading] = React.useState(false);
  const [savedError, setSavedError] = React.useState<string | null>(null);
  const [savedRevision, setSavedRevision] = React.useState(0);
  const savedHydrationRef = React.useRef<{ sdk: typeof sdk; removed: Set<string> } | null>(null);
  const savedSdkRef = React.useRef(sdk);
  savedSdkRef.current = sdk;

  const [likedPosts, setLikedPosts] = React.useState<any[]>([]);
  const [likedStatus, setLikedStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [likedError, setLikedError] = React.useState<string | null>(null);
  const [likedHasMore, setLikedHasMore] = React.useState(false);
  const [likedLoadingMore, setLikedLoadingMore] = React.useState(false);
  const likedCursorRef = React.useRef<string | null>(null);
  const likedOffsetRef = React.useRef(0);
  const likedRequestRef = React.useRef(false);
  const removedLikedRef = React.useRef(new Map<string, { post: any; index: number }>());

  React.useEffect(() => {
    // Read the revision so Retry deliberately re-runs this effect even though
    // it does not alter the bookmark IDs itself.
    void savedRevision;
    const ids = getBookmarks();
    const hydration = { sdk, removed: new Set<string>() };
    savedHydrationRef.current = hydration;
    const missing = ids.filter((id) => !getCached(`post:${id}`));
    if (!sdk || missing.length === 0) {
      setSavedPosts(ids.map((id) => getCached(`post:${id}`)).filter(Boolean) as any[]);
      setSavedError(null);
      setSavedLoading(false);
      return;
    }
    let cancelled = false;
    setSavedLoading(true);
    setSavedError(null);
    (async () => {
      const failedIds = new Set<string>();
      await Promise.all(missing.map(async (id) => {
        try {
          const response = await (sdk as any).posts.get(id);
          const p = response?.data ?? response;
          if (p?.id) setCache(`post:${id}`, p);
          else failedIds.add(id);
        } catch {
          failedIds.add(id);
        }
      }));
      if (cancelled) return;
      // Only confirmed removals supersede this snapshot. The live bookmark
      // store may contain an in-flight toggle that still needs to roll back.
      setSavedPosts(ids.filter((id) => !hydration.removed.has(id))
        .map((id) => getCached(`post:${id}`)).filter(Boolean) as any[]);
      const hasRemainingFailure = [...failedIds].some((id) => !hydration.removed.has(id));
      setSavedError(hasRemainingFailure ? 'Some bookmarks could not be loaded.' : null);
      setSavedLoading(false);
    })();
    return () => {
      cancelled = true;
      if (savedHydrationRef.current === hydration) savedHydrationRef.current = null;
    };
  }, [sdk, savedRevision]);

  React.useEffect(() => {
    // Reset private history whenever the authenticated SDK identity changes.
    void sdk;
    setLikedPosts([]);
    setLikedStatus('idle');
    setLikedError(null);
    setLikedHasMore(false);
    setLikedLoadingMore(false);
    likedCursorRef.current = null;
    likedOffsetRef.current = 0;
    likedRequestRef.current = false;
    removedLikedRef.current.clear();
  }, [sdk]);

  const loadLiked = React.useCallback(async (refresh: boolean) => {
    if (!sdk || likedRequestRef.current) return;
    likedRequestRef.current = true;
    setLikedError(null);
    if (refresh) setLikedStatus('loading');
    else setLikedLoadingMore(true);

    try {
      const params = {
        limit: LIKED_PAGE_SIZE,
        ...(refresh
          ? { offset: 0 }
          : likedCursorRef.current
            ? { cursor: likedCursorRef.current }
            : { offset: likedOffsetRef.current }),
      };
      const postsResource = (sdk as any).posts;
      // Minds currently ships against an older @recursiv/sdk. Prefer the new
      // convenience method once published, while using the same SDK list
      // transport in existing builds — never a raw fetch or app-only endpoint.
      const response = typeof postsResource.liked === 'function'
        ? await postsResource.liked(params)
        : await postsResource.list({ ...params, liked: true });
      const rows = Array.isArray(response?.data) ? response.data : [];
      for (const post of rows) {
        if (post?.id) setCache(`post:${post.id}`, post);
      }
      setLikedPosts((current) => {
        if (refresh) return rows;
        const merged = new Map(current.map((post: any) => [post.id, post]));
        for (const post of rows) merged.set(post.id, post);
        return [...merged.values()];
      });
      likedOffsetRef.current = refresh ? rows.length : likedOffsetRef.current + rows.length;
      likedCursorRef.current = typeof response?.meta?.next_cursor === 'string'
        ? response.meta.next_cursor
        : null;
      setLikedHasMore(response?.meta?.has_more ?? rows.length === LIKED_PAGE_SIZE);
      setLikedStatus('ready');
    } catch {
      setLikedError('Couldn’t load your liked posts.');
      setLikedStatus((current) => current === 'loading' ? 'error' : current);
    } finally {
      likedRequestRef.current = false;
      setLikedLoadingMore(false);
    }
  }, [sdk]);

  React.useEffect(() => {
    if (activeView === 'liked' && likedStatus === 'idle') {
      void loadLiked(true);
    }
  }, [activeView, likedStatus, loadLiked]);

  const handleBookmarkChange = React.useCallback((postId: string, saved: boolean) => {
    if (savedSdkRef.current !== sdk) return;
    const hydration = savedHydrationRef.current;
    if (hydration?.sdk === sdk) {
      if (saved) hydration.removed.delete(postId);
      else hydration.removed.add(postId);
    }
    if (!saved) setSavedPosts((current) => current.filter((post) => post.id !== postId));
  }, [sdk]);

  const handleLikedVoteChange = React.useCallback((postId: string, newScore: number, newVote: 'upvote' | 'downvote' | null) => {
    setLikedPosts((current) => {
      const index = current.findIndex((post) => post.id === postId);
      if (newVote !== 'upvote') {
        if (index >= 0) removedLikedRef.current.set(postId, { post: current[index], index });
        return current.filter((post) => post.id !== postId);
      }
      if (index >= 0) {
        return current.map((post) => post.id === postId
          ? { ...post, score: newScore, userReaction: newVote, user_reaction: newVote }
          : post);
      }
      // PostCard reports the previous vote again if the network mutation fails.
      // Restore the optimistically removed row in its original position.
      const removed = removedLikedRef.current.get(postId);
      if (!removed) return current;
      removedLikedRef.current.delete(postId);
      const restored = [...current];
      restored.splice(Math.min(removed.index, restored.length), 0, {
        ...removed.post,
        score: newScore,
        userReaction: newVote,
        user_reaction: newVote,
      });
      return restored;
    });
  }, []);

  const posts = activeView === 'bookmarks' ? savedPosts : likedPosts;
  const loadingInitial = activeView === 'bookmarks'
    ? savedLoading && savedPosts.length === 0
    : likedStatus === 'loading' && likedPosts.length === 0;
  const error = activeView === 'bookmarks' ? savedError : likedError;
  const retry = activeView === 'bookmarks'
    ? () => setSavedRevision((value) => value + 1)
    : () => { void loadLiked(true); };
  const emptyCopy = activeView === 'bookmarks'
    ? {
        icon: 'bookmark-outline' as const,
        title: 'No bookmarks yet',
        body: 'Save posts you want to come back to — tap the bookmark icon on any post and it shows up here.',
      }
    : {
        icon: 'heart-outline' as const,
        title: 'No liked posts yet',
        body: 'Posts you upvote show up here, so you can find the conversations and ideas you appreciated.',
      };

  return (
    <Container padded={false}>
      {/* Saved reads like a feed, so it gets the feed's rail on desktop web.
          `feed` context leads the sidebar with trending posts then creators,
          which is what belongs next to a list of posts you kept. */}
      <RightRailLayout context="feed">
      <ScreenHeader title="Saved" />
      <TabBar
        tabs={[
          { key: 'bookmarks', label: 'Bookmarks' },
          { key: 'liked', label: 'Liked' },
        ]}
        active={activeView}
        onChange={selectView}
        accessibilityLabel="Saved post views"
      />
      {loadingInitial ? (
        // Post-shaped skeletons rather than a spinner over a sentence: this is a
        // list of posts, so paint the list.
        <FeedSkeletons count={4} />
      ) : error && posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text variant="h2" color={colors.text} align="center">{error}</Text>
          <Button onPress={retry} variant="secondary">Retry</Button>
        </View>
      ) : posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.xl }}>
          <Ionicons name={emptyCopy.icon} size={44} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{emptyCopy.title}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320, lineHeight: 24 }}>
            {emptyCopy.body}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing['4xl'] }}>
          {posts.map((post: any) => (
            <PostCard
              key={post.id}
              post={post}
              compact
              onBookmarkChange={handleBookmarkChange}
              onVoteChange={activeView === 'liked' ? handleLikedVoteChange : undefined}
            />
          ))}
          {error ? (
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
              <Text variant="body" color={colors.error} align="center">{error}</Text>
              <Button onPress={retry} variant="secondary" size="sm">Retry</Button>
            </View>
          ) : null}
          {activeView === 'liked' && likedHasMore && !error ? (
            <View style={{ alignItems: 'center', padding: spacing.xl }}>
              <Button
                onPress={() => { void loadLiked(false); }}
                variant="secondary"
                size="sm"
                loading={likedLoadingMore}
              >
                Load more
              </Button>
            </View>
          ) : null}
          {activeView === 'bookmarks' && savedLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: spacing.xl }} />
          ) : null}
        </ScrollView>
      )}
      </RightRailLayout>
    </Container>
  );
}
