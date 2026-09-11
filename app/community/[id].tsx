import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Image } from 'expo-image';
import { showToast } from '../../components/Toast';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Avatar, Button, PostCard, Skeleton, RightRailLayout, FeedSidebar } from '../../components';
import { formatCount } from '../../lib/discover';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID, publicMinds } from '../../lib/recursiv';
import { otpSignInPath } from '../../lib/authRedirect';
import { invalidatePrefix, getCached, setCache } from '../../lib/cache';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { usePageTitle } from '../../lib/usePageTitle';
import { communityDescription } from '../../lib/models';
import { ProfileBioToggle } from '../../components/ProfileBioToggle';
import { canRunGroup, groupAdmin } from '../../lib/groupAdmin';
import { chatConversationHref } from '../../lib/chatNavigation';

// Roughly three lines of body text at the group page's measure.
const DESCRIPTION_FOLD_CHARS = 180;

export default function CommunityDetailScreen() {
  const { id, join: joinIntent } = useLocalSearchParams<{ id: string; join?: string }>();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();

  // Seed from cache so revisiting a community renders its header + posts
  // instantly instead of flashing a full-screen skeleton on every open. The
  // network fetch below still runs and reconciles in the background.
  const cachedCommunity = getCached(`community:${id}`);
  const cachedPosts = getCached(`community-posts:${id}`);
  const [community, setCommunity] = React.useState<any>(cachedCommunity || null);
  usePageTitle(community?.name ? `${community.name} — Isle of Wight Social` : null);
  const [posts, setPosts] = React.useState<any[]>(cachedPosts || []);
  const [loading, setLoading] = React.useState(!cachedCommunity);
  const [communityLoadError, setCommunityLoadError] = React.useState<'not_found' | 'temporary' | null>(null);
  const [communityLoadAttempt, setCommunityLoadAttempt] = React.useState(0);
  const [postsLoading, setPostsLoading] = React.useState(!cachedPosts);
  const [postsError, setPostsError] = React.useState<string | null>(null);
  const [isMember, setIsMember] = React.useState(!!(cachedCommunity?.is_member || cachedCommunity?.isMember));
  const [membershipResolution, setMembershipResolution] = React.useState<{
    sdk: unknown;
    id: string;
    attempt: number;
  } | null>(null);
  const [joinLoading, setJoinLoading] = React.useState(false);
  const joinIntentStartedRef = React.useRef(false);
  // A legacy group description can run to 500 characters. Show three lines and
  // a "Show more" so the feed starts above the fold.
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const offsetRef = React.useRef(0);
  const focusedCommunityRef = React.useRef<string | null>(null);
  const isCreator = Boolean(user?.id) && (
    community?.created_by?.id === user?.id || community?.createdBy?.id === user?.id
  );
  // Who runs this group: the server's viewer_role (owner, admin, moderator),
  // with the creator treated as owner where a legacy member row never arrived.
  const viewerRole: string | null = community?.viewer_role ?? (isCreator ? 'owner' : null);
  const canManage = canRunGroup(viewerRole);
  const moderationDelete = React.useCallback(async (postId: string) => {
    if (!sdk || !community?.id) throw new Error('Sign in to moderate');
    await groupAdmin(sdk).removePost(community.id, postId);
  }, [sdk, community?.id]);
  const moderationPin = React.useCallback(async (postId: string, pinned: boolean) => {
    if (!sdk || !community?.id) throw new Error('Sign in to moderate');
    const admin = groupAdmin(sdk);
    if (pinned) await admin.pinPost(community.id, postId); else await admin.unpinPost(community.id, postId);
    const at = pinned ? new Date().toISOString() : null;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, pinned_at: at } : p)));
  }, [sdk, community?.id]);
  // Pinned posts first, newest pin on top; the rest keep the feed's order.
  const orderedPosts = React.useMemo(() => {
    const pinned = posts.filter((p) => p.pinned_at || p.pinnedAt);
    if (!pinned.length) return posts;
    pinned.sort((a, b) => new Date(b.pinned_at || b.pinnedAt).getTime() - new Date(a.pinned_at || a.pinnedAt).getTime());
    return [...pinned, ...posts.filter((p) => !(p.pinned_at || p.pinnedAt))];
  }, [posts]);
  const returnTo = id ? `/community/${id}` : '/discover/communities';
  const membershipResolved = !!membershipResolution &&
    membershipResolution.sdk === sdk &&
    membershipResolution.id === id &&
    membershipResolution.attempt === communityLoadAttempt;

  // Switching community→community reuses this same screen (the route param
  // changes WITHOUT a remount), so the initial cache-seeded state above only
  // runs on first mount. Re-seed every per-community piece from the NEW id's
  // cache on each id change — otherwise the previous community's header + posts
  // linger and swap in stages. Skip the first run (already seeded).
  const lastIdRef = React.useRef(id);
  React.useEffect(() => {
    if (lastIdRef.current === id) return;
    lastIdRef.current = id;
    const cc = getCached(`community:${id}`);
    const cp = getCached(`community-posts:${id}`);
    setCommunity(cc || null);
    setPosts(cp || []);
    setLoading(!cc);
    setPostsLoading(!cp);
    setPostsError(null);
    setCommunityLoadError(null);
    setIsMember(!!(cc?.is_member || cc?.isMember));
    setMembershipResolution(null);
    joinIntentStartedRef.current = false;
    setHasMore(true);
    offsetRef.current = 0;
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setMembershipResolution(null);
    setCommunityLoadError(null);
    (async () => {
      try {
        const communities = sdk ? sdk.communities : publicMinds.publicCommunities;
        const res = await communities.get(id);
        if (!cancelled && res.data) {
          setCommunity(res.data);
          setCache(`community:${id}`, res.data);
          setIsMember(!!(res.data as any).is_member || !!(res.data as any).isMember);
          setCommunityLoadError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          // A 404 is an authoritative missing/private result. Transport errors
          // and 5xx responses are temporary; never tell someone a community
          // was removed just because Minds could not reach it.
          if (err?.status === 404) setCommunity(null);
          setCommunityLoadError(err?.status === 404 ? 'not_found' : 'temporary');
          setPostsLoading(false);
        }
      }
      if (!cancelled) {
        setLoading(false);
        setMembershipResolution(sdk ? { sdk, id, attempt: communityLoadAttempt } : null);
      }
    })();
    return () => { cancelled = true; };
  }, [id, sdk, communityLoadAttempt]);

  const retryCommunity = React.useCallback(() => {
    setCommunityLoadError(null);
    setLoading(true);
    setCommunityLoadAttempt((attempt) => attempt + 1);
  }, []);

  const PAGE_SIZE = 20;

  const fetchPosts = React.useCallback(async (refresh = true) => {
    if (!community?.id) return;
    if (refresh) {
      offsetRef.current = 0;
      setPostsError(null);
      setPostsLoading(true);
    }
    try {
      const res = sdk
        ? await sdk.posts.list({
          limit: PAGE_SIZE,
          offset: refresh ? 0 : offsetRef.current,
          organization_id: ORG_ID || undefined,
          community_id: community.id,
        } as any)
        : await publicMinds.publicPosts.list({
          communityId: community.id,
          limit: PAGE_SIZE,
          offset: refresh ? 0 : offsetRef.current,
        });
      const data = res.data || [];
      if (refresh) {
        setPosts(data);
        setCache(`community-posts:${id}`, data);
      } else {
        setPosts(prev => {
          const ids = new Set(prev.map((p: any) => p.id));
          return [...prev, ...data.filter((p: any) => !ids.has(p.id))];
        });
      }
      offsetRef.current = (refresh ? 0 : offsetRef.current) + data.length;
      setHasMore(res.meta?.has_more ?? data.length === PAGE_SIZE);
    } catch {
      if (refresh) setPostsError("Couldn't load posts");
    } finally {
      setPostsLoading(false);
      setLoadingMore(false);
    }
  }, [id, sdk, community?.id]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !postsLoading && !loadingMore) {
      setLoadingMore(true);
      fetchPosts(false);
    }
  }, [hasMore, postsLoading, loadingMore, fetchPosts]);

  // Load the first page when the resolved community changes.
  React.useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Refetch after returning from create, but skip the focus callback paired
  // with each newly-resolved community: the effect above already owns that
  // first page. Without this guard a focused screen issued the same cold public
  // query twice and doubled load on the slowest path.
  useFocusEffect(React.useCallback(() => {
    if (!community?.id) return;
    if (focusedCommunityRef.current !== community.id) {
      focusedCommunityRef.current = community.id;
      return;
    }
    fetchPosts();
  }, [community?.id, fetchPosts]));

  // True while the membership button is hovered (web) so a "Joined" pill can
  // flip to a red "Leave" affordance — the Signal/Discord pattern. On native
  // (no hover) the press itself routes through a confirm dialog.
  const [leaveHover, setLeaveHover] = React.useState(false);

  const doLeaveOrJoin = React.useCallback(async () => {
    if (!sdk || !community?.id) return;
    setJoinLoading(true);
    const wasMember = isMember;
    setIsMember(!wasMember); // optimistic
    try {
      if (wasMember) await sdk.communities.leave(community.id);
      else await sdk.communities.join(community.id);
      // Reflect the new membership on the cached community record so a back-nav
      // (which re-seeds from cache) doesn't show the stale Join/Joined state.
      setCommunity((prev: any) => prev ? { ...prev, is_member: !wasMember, isMember: !wasMember } : prev);
      setCache(`community:${community.id}`, { ...(getCached(`community:${community.id}`) || community), is_member: !wasMember, isMember: !wasMember });
      // Invalidate cached community lists so the SideNav "Recents" picks up
      // the new membership state on its next mount / refresh. Without this,
      // re-joining a community wouldn't add it back to the sidebar until
      // the next cache TTL or a full logout/login cycle.
      invalidatePrefix('communities:');
    } catch {
      setIsMember(wasMember); // revert on failure
      showToast(wasMember ? 'Could not leave community' : 'Could not join community', 'error');
    }
    setJoinLoading(false);
  }, [sdk, community, isMember]);

  const handleJoinLeave = () => {
    if (!community?.id) return;
    if (!user || !sdk) {
      router.push(otpSignInPath(`${returnTo}?join=1`) as any);
      return;
    }
    // Joining is a low-stakes, instant action. Leaving is destructive (you lose
    // the community from your sidebar + feed boost), so gate it behind a confirm.
    if (!isMember) { doLeaveOrJoin(); return; }
    const title = `Leave ${community.name || 'this community'}?`;
    const message = "You'll stop seeing its posts in your feed. You can rejoin anytime.";
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) doLeaveOrJoin();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => doLeaveOrJoin() },
      ]);
    }
  };

  React.useEffect(() => {
    if (
      joinIntent !== '1' ||
      !user ||
      !sdk ||
      !community?.id ||
      !membershipResolved ||
      joinIntentStartedRef.current
    ) return;

    joinIntentStartedRef.current = true;
    router.replace(returnTo as any);
    if (!isMember) void doLeaveOrJoin();
  }, [joinIntent, user, sdk, community?.id, membershipResolved, isMember, doLeaveOrJoin, router, returnTo]);

  // Resolve the community identity first, then render its real header while the
  // first post page continues loading below it. Public community post queries
  // can be cold at import scale; hiding the already-resolved name, counts and
  // actions behind that second request made the whole page look hung.
  if (loading) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title={community?.name || ''} />
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Skeleton width={64} height={64} borderRadius={32} />
            <View style={{ flex: 1, gap: spacing.sm }}>
              <Skeleton width={180} height={20} />
              <Skeleton width={120} height={12} />
            </View>
          </View>
          <Skeleton width="90%" height={14} />
          <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Skeleton width={40} height={40} borderRadius={20} />
                  <Skeleton width={140} height={14} />
                </View>
                <Skeleton width="100%" height={48} />
              </View>
            ))}
          </View>
        </View>
      </Container>
    );
  }

  if (!community) {
    const loadFailed = communityLoadError === 'temporary';
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Group" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <Ionicons name={loadFailed ? 'cloud-offline-outline' : 'people-outline'} size={40} color={loadFailed ? colors.error : colors.accent} />
          <Text variant="h2" color={colors.text}>
            {loadFailed ? "Couldn't load community" : 'Community not found'}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={{ maxWidth: 300, textAlign: 'center' }}>
            {loadFailed
              ? 'Minds could not reach this community. Check your connection and try again.'
              : 'This community may have been removed or the link is incorrect.'}
          </Text>
          {loadFailed ? <Button onPress={retryCommunity} size="sm">Retry</Button> : null}
        </View>
      </Container>
    );
  }

  const memberCount = community.member_count || community.memberCount || 0;
  const postCount = community.post_count || community.postCount || 0;
  const readableDescription = communityDescription(community);
  const createPostReturnTo = `/create?communityId=${encodeURIComponent(community.id)}&communityName=${encodeURIComponent(community.name || 'Group')}`;

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title={community.name} />

      <RightRailLayout
        context="community"
        rail={community ? (
          <FeedSidebar
            context="community"
            group={{ id: community.id, name: community.name, privacy: community.privacy, isMember, memberCount: community.member_count }}
          />
        ) : undefined}
      >
      <FlatList
        data={orderedPosts}
        keyExtractor={(item) => item.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {community.banner ? (
              <View
                style={{
                  aspectRatio: 3,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  backgroundColor: colors.surface,
                }}
              >
                <Image
                  source={{ uri: community.banner }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={`${community.name} community banner`}
                />
              </View>
            ) : null}

            {/* Community info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Avatar
                uri={community.image || community.avatar}
                name={community.name}
                size="xl"
                accessibilityLabel={`${community.name} community avatar`}
              />
              <View style={{ flex: 1 }}>
                <Text variant="h2">{community.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{formatCount(memberCount)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{formatCount(postCount)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {readableDescription ? (
              <View>
                <Text
                  variant="body"
                  color={colors.textSecondary}
                  style={{ lineHeight: 22 }}
                  numberOfLines={descExpanded ? undefined : 3}
                >
                  {readableDescription}
                </Text>
                {readableDescription.length > DESCRIPTION_FOLD_CHARS && (
                  <ProfileBioToggle expanded={descExpanded} onToggle={() => setDescExpanded((v) => !v)} />
                )}
              </View>
            ) : null}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
              {/* Members see a "Joined" pill that flips to a red "Leave" on
                  hover (web) — and always confirms before leaving. Non-members
                  see a primary "Join". */}
              <View
                {...(Platform.OS === 'web'
                  ? { onMouseEnter: () => setLeaveHover(true), onMouseLeave: () => setLeaveHover(false) }
                  : {})}
              >
                <Button
                  onPress={handleJoinLeave}
                  loading={joinLoading}
                  variant={isMember ? (leaveHover ? 'primary' : 'secondary') : 'primary'}
                  size="sm"
                  accentColor={isMember && leaveHover ? colors.error : undefined}
                >
                  {isMember ? (leaveHover ? 'Leave' : 'Joined') : 'Join'}
                </Button>
              </View>
              {isMember && user ? (
                <Button
                  onPress={async () => {
                    if (!sdk) return;
                    try {
                      const res: any = await sdk.chat.communityConversation(community.id);
                      const convId = res?.data?.id || res?.id;
                      if (!convId) throw new Error('no room');
                      router.push(chatConversationHref(convId) as any);
                    } catch {
                      showToast('Chat is not ready for this group yet', 'error');
                    }
                  }}
                  variant="secondary"
                  size="sm"
                >
                  Chat
                </Button>
              ) : null}
              <Button
                onPress={() => user
                  ? router.push({ pathname: '/(tabs)/create', params: { communityId: community.id, communityName: community.name } } as any)
                  : router.push(otpSignInPath(createPostReturnTo) as any)}
                variant="secondary"
                size="sm"
              >
                Create Post
              </Button>
              {canManage && (
                <Button
                  onPress={() => router.push(`/community/manage/${community.id}` as any)}
                  variant="ghost"
                  size="sm"
                >
                  Manage
                </Button>
              )}
            </View>

            {/* Separator */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }} />

            {/* Posts header */}
            <Text variant="label" color={colors.textMuted}>Posts</Text>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} compact canModerate={canManage} moderationDelete={moderationDelete} moderationPin={moderationPin} />}
        ListEmptyComponent={
          postsLoading ? (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : postsError ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
              <Text variant="h2" color={colors.text}>{postsError}</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
                Check your connection and try again.
              </Text>
              <Button onPress={() => fetchPosts()} size="sm">
                Retry
              </Button>
            </View>
          ) : (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
              <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text}>No posts yet</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
                Be the first to post in this community.
              </Text>
              <Button
                onPress={() => user
                  ? router.push({ pathname: '/(tabs)/create', params: { communityId: community?.id, communityName: community?.name } } as any)
                  : router.push(otpSignInPath(createPostReturnTo) as any)}
                size="sm"
              >
                Create Post
              </Button>
            </View>
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
        showsVerticalScrollIndicator={false}
      />
      </RightRailLayout>
    </Container>
  );
}
