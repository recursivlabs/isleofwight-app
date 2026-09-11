import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Modal, TextInput, Image, Share } from 'react-native';
import { showToast } from '../../components/Toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { Text, Avatar, Button, PostCard, Skeleton, RightRailLayout, AgentBadge, FeedSidebar } from '../../components';
import { ImageCropper, CROP_AVATAR, CROP_BANNER } from '../../components/ImageCropper';
import { Badge, getBadges } from '../../components/Badge';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TabBar } from '../../components/TabBar';
import { useAuth } from '../../lib/auth';
import { isValidUsername, sanitizeUsername } from '../../lib/username';
import { useProfile, useMyProfile, useCommunities, useProfilePosts } from '../../lib/hooks';
import { ORG_ID, publicMinds, SITE_URL } from '../../lib/recursiv';
import { otpSignInPath } from '../../lib/authRedirect';
import { getFollowRelationship, blockUser, unblockUser, muteUser, unmuteUser, getBlockedUsers, getMutedUsers } from '../../lib/moderation';
import { ReportModal } from '../../components/ReportModal';
import { getCached, invalidate, fetchDeduped } from '../../lib/cache';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { isArticlePost, profileFollowerCount, profileFollowingCount } from '../../lib/models';
import { usePageTitle } from '../../lib/usePageTitle';
import { formatCount } from '../../lib/discover';
import { afterFollowChange } from '../../lib/follows';
import { ProfileBioToggle } from '../../components/ProfileBioToggle';
import { ProfileUserRow } from '../../components/ProfileUserRow';
import { ProfileBio } from '../../components/ProfileBio';
import { chatConversationHref } from '../../lib/chatNavigation';
import { captureException } from '../../lib/monitoring';

const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;

// Owner gets a Saved tab (private bookmarks). Visitors don't. Both
// share the same primary tab order so the IA reads the same way.
// Saved (bookmarks) moved to the top-level /bookmarks page; Communities removed
// from the profile (it lives in the Groups nav + directory).
const OWNER_TABS = ['posts', 'articles', 'replies', 'followers', 'following'] as const;
const OTHER_TABS = ['posts', 'articles', 'replies', 'followers', 'following'] as const;
type ProfileTab = typeof OWNER_TABS[number];

const RELATIONSHIP_PAGE_SIZE = 50;

function firstSearchParam(value: unknown): string {
  const firstValue = Array.isArray(value) ? value[0] : value;
  return firstValue == null ? '' : String(firstValue);
}

function firstValidUsername(...values: unknown[]): string {
  for (const value of values) {
    const candidate = firstSearchParam(value);
    if (isValidUsername(candidate)) return candidate;
  }
  return '';
}

function relationshipHasMore(response: any, page: any[]): boolean {
  return response?.meta?.has_more
    ?? response?.meta?.hasMore
    ?? page.length >= RELATIONSHIP_PAGE_SIZE;
}

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{
    username: string | string[];
    tab?: string | string[];
    follow?: string | string[];
  }>();
  // Expo Router can surface a single dynamic/search parameter as a one-item
  // array or a string-like wrapper after hydration. The old type assertion hid
  // those runtime shapes: the profile header stringified them correctly, but
  // username validation rejected the non-primitive value. Normalize once before
  // it reaches profile lookup, owner detection, or Edit Profile.
  const username = firstSearchParam(params.username);
  const initialTab = firstSearchParam(params.tab);
  const followIntent = firstSearchParam(params.follow);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user, refreshUser } = useAuth();
  const colors = useColors();
  const { profile, loading, error, isFollowing, setIsFollowing, refresh: refreshProfile } = useProfile(username);
  usePageTitle(
    profile
      ? `${profile.name || profile.username || username} (@${profile.username || username}) — Wight.social`
      : null,
  );
  const { refresh: refreshMyProfile } = useMyProfile();

  const isOwnProfile = !!user?.id && (user.id === profile?.id || user.username === username);

  // Check if this is the viewer's OWN AI agent. We fetch the user's
  // agents list (which includes personal agents) and check membership.
  const [isMyAgent, setIsMyAgent] = React.useState(false);
  React.useEffect(() => {
    if (!sdk || !profile?.id || !(profile.isAi || profile.is_ai)) {
      setIsMyAgent(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Dedupe the heavy owned-agents scan so two profile views (or a view
        // racing the chat/sidebar personal-agent lookup) don't each fire a
        // separate /agents?limit=100 — part of the request-storm cleanup.
        const res = await fetchDeduped('req:owned-agents:100', () => sdk.agents.list({ limit: 100 }));
        if (cancelled) return;
        const owned = (res.data || []).some((a: any) => a.id === profile.id);
        setIsMyAgent(owned);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [sdk, profile?.id, profile?.isAi, profile?.is_ai]);
  // The official @minds channel is followed by ~every user, so its follower
  // count effectively discloses the total network size, and its followers list
  // is a prime scrape/spam target. Hide both (count + tab) for all viewers.
  const isMindsChannel = (profile?.username || username || '').toLowerCase() === 'minds';
  const ALLOWED_TABS = React.useMemo(() => (isOwnProfile ? OWNER_TABS : OTHER_TABS)
    .filter((t) => !(isMindsChannel && t === 'followers'))
    // The public API exposes authored top-level posts but not an author-replies
    // listing. Don't advertise a tab that would falsely look empty.
    .filter((t) => !!sdk || t !== 'replies') as readonly ProfileTab[], [isOwnProfile, isMindsChannel, sdk]);
  const validInitialTab: ProfileTab = (ALLOWED_TABS as readonly string[]).includes(initialTab || '')
    ? (initialTab as ProfileTab)
    : 'posts';
  const [profileTab, setProfileTab] = React.useState<ProfileTab>(validInitialTab);
  React.useEffect(() => {
    if (!(ALLOWED_TABS as readonly string[]).includes(profileTab)) setProfileTab('posts');
  }, [ALLOWED_TABS, profileTab]);

  // Per-tab search (own profile only). One input that adapts to the active tab
  // and filters that tab's list client-side — there's no server search for a
  // user's own posts/replies/communities/saved/followers/following, so each is
  // filtered over the already-loaded list. Resets when the active tab changes.
  const [tabSearch, setTabSearch] = React.useState('');
  React.useEffect(() => { setTabSearch(''); }, [profileTab]);

  // Which tabs have ever been opened. A profile mounts a paginator per tab, so
  // arriving used to fire Posts, Replies AND Articles at once — three list
  // queries for one visible tab, competing with each other, which is why
  // Replies felt slow even when nobody opened it. Fetch a tab when it is first
  // opened; keep it enabled afterwards so its cache makes switching instant.
  const [openedTabs, setOpenedTabs] = React.useState<Set<string>>(
    () => new Set<string>(['posts', validInitialTab]),
  );
  React.useEffect(() => {
    setOpenedTabs((prev) => (prev.has(profileTab) ? prev : new Set(prev).add(profileTab)));
  }, [profileTab]);
  const searchQ = tabSearch.trim().toLowerCase();
  const isTabSearching = searchQ.length > 0;
  const matchText = React.useCallback((...vals: any[]) =>
    !searchQ || vals.some((v) => typeof v === 'string' && v.toLowerCase().includes(searchQ)),
    [searchQ]);
  const searchPlaceholder =
    profileTab === 'posts' ? 'Search your posts…'
    : profileTab === 'articles' ? 'Search your articles…'
    : profileTab === 'replies' ? 'Search your replies…'
    : profileTab === 'followers' ? 'Search followers…'
    : 'Search following…';

  const [followLoading, setFollowLoading] = React.useState(false);
  const followIntentStartedRef = React.useRef(false);
  const [followsYou, setFollowsYou] = React.useState(false);
  // Moderation state for the profile overflow menu. Bashy's report: you can block or mute
  // someone from one of their posts but not from their profile, and once blocked there is
  // no way back -- their profile offers no unblock, so the action is one-way from the UI.
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [modBusy, setModBusy] = React.useState(false);
  // Paginated author feeds (posts + replies). These infinite-scroll through ALL
  // the user's posts via author_id + offset + has_more, mirroring useDiscoverPosts —
  // replacing the old one-shot `posts.list({ author_id, limit: 50 })` that capped a
  // profile at a single page no matter how many posts the user had.
  const {
    posts: userPosts,
    loading: postsLoading,
    error: postsError,
    hasMore: postsHasMore,
    loadMore: loadMorePosts,
    refresh: refreshPosts,
  } = useProfilePosts(profile?.id);
  const {
    posts: userReplies,
    loading: repliesLoading,
    hasMore: repliesHasMore,
    loadMore: loadMoreReplies,
  } = useProfilePosts(profile?.id, { replies: true, enabled: openedTabs.has('replies') });
  // Articles tab: server-filtered (title + markdown), NOT a client filter over
  // the recency-paged posts — legacy blogs are sparse/old and never landed on
  // the first pages, so the tab looked empty even when the user had them.
  const {
    posts: userArticles,
    loading: articlesLoading,
    error: articlesError,
    hasMore: articlesHasMore,
    loadMore: loadMoreArticles,
    refresh: refreshArticles,
  } = useProfilePosts(profile?.id, { articles: true, enabled: openedTabs.has('articles') });
  const [followersList, setFollowersList] = React.useState<any[] | null>(null);
  const [followingList, setFollowingList] = React.useState<any[] | null>(null);
  const [relationsLoading, setRelationsLoading] = React.useState(false);
  const [followersHasMore, setFollowersHasMore] = React.useState(false);
  const [followingHasMore, setFollowingHasMore] = React.useState(false);
  const [relationLoadingMore, setRelationLoadingMore] = React.useState<'followers' | 'following' | null>(null);
  const followersOffsetRef = React.useRef(0);
  const followingOffsetRef = React.useRef(0);

  // Owner-only modals
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editUsername, setEditUsername] = React.useState('');
  // Browsers and password managers can dispatch an empty change while their
  // autofill UI attaches. Keep the handle read-only through that mount window;
  // an explicit user focus unlocks ordinary editing.
  const [editUsernameShielded, setEditUsernameShielded] = React.useState(Platform.OS === 'web');
  const editUsernameInputRef = React.useRef<React.ElementRef<typeof TextInput>>(null);
  const [editBio, setEditBio] = React.useState('');
  const [bioExpanded, setBioExpanded] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editAvatarUri, setEditAvatarUri] = React.useState<string | null>(null);
  // Uri handed to the ImageCropper; its onDone sets editAvatarUri to the crop.
  const [cropUri, setCropUri] = React.useState<string | null>(null);
  // Cover photo: picked image goes through the 3:1 cropper, then uploads on Save.
  const [editBannerUri, setEditBannerUri] = React.useState<string | null>(null);
  const [cropBannerUri, setCropBannerUri] = React.useState<string | null>(null);
  const editSession = React.useRef(0);
  const editSnapshot = React.useMemo(() => ({
    editName, editUsername, editBio, editAvatarUri, cropUri,
  }), [editName, editUsername, editBio, editAvatarUri, cropUri]);
  const latestEditSnapshot = React.useRef(editSnapshot);
  latestEditSnapshot.current = editSnapshot;
  const editorOpenRef = React.useRef(showEditProfile);
  editorOpenRef.current = showEditProfile;
  const editorContext = React.useMemo(() => ({ username, userId: user?.id, profileId: profile?.id, isOwnProfile }),
    [username, user?.id, profile?.id, isOwnProfile]);
  const latestEditorContext = React.useRef(editorContext);
  latestEditorContext.current = editorContext;
  const editorMounted = React.useRef(true);
  const acceptedCanonicalTarget = React.useRef<{ context: typeof editorContext; username: string } | null>(null);
  const closeEditProfile = () => {
    editSession.current += 1;
    editorOpenRef.current = false;
    setShowEditProfile(false);
    const target = acceptedCanonicalTarget.current;
    acceptedCanonicalTarget.current = null;
    if (target?.context === latestEditorContext.current) {
      router.replace(`/${target.username}` as any);
    }
  };
  // A save belongs to one editor visit, not a later visit with identical fields.
  // Changing the displayed owner/route or unmounting also ends that visit.
  React.useEffect(() => {
    editorMounted.current = true;
    return () => {
      editorMounted.current = false;
      editSession.current += 1;
      acceptedCanonicalTarget.current = null;
    };
  }, [editorContext]);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !showEditProfile || !editUsernameShielded) return;

    // Password-manager overlays can assign `input.value` directly without an
    // input/change event. React still owns the correct state, but it will not
    // rewrite an unchanged value prop on an unrelated render. Restore during
    // the short overlay-mount window; focusing the field cancels these timers.
    const restoreControlledValue = () => {
      const input = editUsernameInputRef.current as unknown as HTMLInputElement | null;
      if (input && input.value !== editUsername) input.value = editUsername;
    };
    restoreControlledValue();
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(restoreControlledValue)
      : null;
    const timers = [75, 250, 750].map((delay) => setTimeout(restoreControlledValue, delay));
    return () => {
      if (frame != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [editUsername, editUsernameShielded, showEditProfile]);

  const { communities } = useCommunities(isOwnProfile ? 50 : 0);

  // Reset local state on username change. (Post/reply feeds reset themselves
  // inside useProfilePosts when profile.id changes.)
  React.useEffect(() => {
    setFollowLoading(false);
    followIntentStartedRef.current = false;
    setFollowersList(null);
    setFollowingList(null);
    setFollowersHasMore(false);
    setFollowingHasMore(false);
    setRelationLoadingMore(null);
    followersOffsetRef.current = 0;
    followingOffsetRef.current = 0;
  }, [username]);

  // Lazy-load followers / following
  React.useEffect(() => {
    if (!profile?.id) return;
    if (profileTab !== 'followers' && profileTab !== 'following') return;
    const needsLoad =
      (profileTab === 'followers' && followersList === null) ||
      (profileTab === 'following' && followingList === null);
    if (!needsLoad) return;

    let cancelled = false;
    setRelationsLoading(true);
    (async () => {
      try {
        const profiles = sdk ? sdk.profiles : publicMinds.publicProfiles;
        const res = profileTab === 'followers'
          ? await profiles.followers(profile.id, { limit: RELATIONSHIP_PAGE_SIZE, offset: 0 })
          : await profiles.following(profile.id, { limit: RELATIONSHIP_PAGE_SIZE, offset: 0 });
        const list = (res.data || []) as any[];
        if (cancelled) return;
        if (profileTab === 'followers') {
          setFollowersList(list);
          setFollowersHasMore(relationshipHasMore(res, list));
          followersOffsetRef.current = list.length;
        } else {
          setFollowingList(list);
          setFollowingHasMore(relationshipHasMore(res, list));
          followingOffsetRef.current = list.length;
        }
      } catch {
        if (!cancelled) {
          if (profileTab === 'followers') {
            setFollowersList([]);
            setFollowersHasMore(false);
            followersOffsetRef.current = 0;
          } else {
            setFollowingList([]);
            setFollowingHasMore(false);
            followingOffsetRef.current = 0;
          }
        }
      } finally {
        if (!cancelled) setRelationsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileTab, profile?.id, sdk, followersList, followingList]);

  const loadMoreRelationships = React.useCallback(async (kind: 'followers' | 'following') => {
    if (!profile?.id || relationLoadingMore) return;
    const current = kind === 'followers' ? followersList : followingList;
    const hasMore = kind === 'followers' ? followersHasMore : followingHasMore;
    if (!current || !hasMore) return;

    setRelationLoadingMore(kind);
    try {
      const profiles = sdk ? sdk.profiles : publicMinds.publicProfiles;
      const offset = kind === 'followers' ? followersOffsetRef.current : followingOffsetRef.current;
      const res = kind === 'followers'
        ? await profiles.followers(profile.id, { limit: RELATIONSHIP_PAGE_SIZE, offset })
        : await profiles.following(profile.id, { limit: RELATIONSHIP_PAGE_SIZE, offset });
      const page = (res.data || []) as any[];
      const appendUnique = (previous: any[] | null) => {
        const base = previous || [];
        const seen = new Set(base.map((user: any) => user.id));
        return [...base, ...page.filter((user: any) => !seen.has(user.id))];
      };

      if (kind === 'followers') {
        setFollowersList(appendUnique);
        setFollowersHasMore(relationshipHasMore(res, page));
        followersOffsetRef.current = offset + page.length;
      } else {
        setFollowingList(appendUnique);
        setFollowingHasMore(relationshipHasMore(res, page));
        followingOffsetRef.current = offset + page.length;
      }
    } catch {
      showToast(`Could not load more ${kind}.`, 'error');
    } finally {
      setRelationLoadingMore(null);
    }
  }, [profile?.id, relationLoadingMore, followersList, followingList, followersHasMore, followingHasMore, sdk]);

  // Does this user follow you back? (for the "Follows you" badge)
  React.useEffect(() => {
    if (!sdk || !profile?.id || isOwnProfile) {
      setFollowsYou(false);
      setIsBlocked(false);
      setIsMuted(false);
      return;
    }
    let alive = true;
    getFollowRelationship(profile.id).then((r) => { if (alive) setFollowsYou(r.follows_you); });
    // Load current block/mute state so the menu offers the right verb. Without this the
    // menu would always read "Block", giving no way to reverse the action from the place
    // the user is standing.
    // BlockedPage carries an `error` flag precisely so "nothing here" can be told apart
    // from "could not look". On a failed lookup the state is left alone rather than
    // defaulting to false, which would show "Block" to someone who has already blocked
    // this account and make the menu lie about the current state.
    getBlockedUsers({ limit: 200 }).then((page) => {
      if (alive && !page.error) setIsBlocked(page.data.some((u) => u.id === profile.id));
    }).catch(() => {});
    getMutedUsers({ limit: 200 }).then((page) => {
      if (alive && !page.error) setIsMuted(page.data.some((u) => u.id === profile.id));
    }).catch(() => {});
    return () => { alive = false; };
  }, [sdk, profile?.id, isOwnProfile]);

  // Counts via the centralized, unit-tested accessors (handles the
  // followers_count vs follower_count drift that caused a real bug).
  const baseFollowerCount = profileFollowerCount(profile);
  const followingCount = profileFollowingCount(profile);
  // Optimistic follower delta, anchored to the server count it was applied on
  // top of. Deriving the shown count this way (instead of adding a free-floating
  // offset) means the moment a profile refresh lands with the already-updated
  // server count, the delta disables itself IN THE SAME RENDER — previously the
  // refetched base (+1) and the optimistic offset (+1) coexisted for one frame,
  // flashing the count +2 before a separate offset-reset state update settled it.
  const [optimisticFollow, setOptimisticFollow] = React.useState<{ base: number; delta: number } | null>(null);
  const followerCount = optimisticFollow && optimisticFollow.base === baseFollowerCount
    ? Math.max(0, baseFollowerCount + optimisticFollow.delta)
    : baseFollowerCount;

  // Infinite scroll for the Posts / Replies tabs. The profile lives inside a
  // single ScrollView (header + tabs + feed), so we detect "near bottom" on
  // scroll and page the active tab's author feed via its loadMore — same effect
  // as a FlatList's onEndReached, without restructuring the whole screen.
  // NOTE: this hook MUST stay above the early returns below (loading / error)
  // so the hook count is identical on every render — otherwise React throws
  // #310 ("rendered more hooks than during the previous render").
  const handleScroll = React.useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom > 600) return;
    if (profileTab === 'posts') loadMorePosts();
    else if (profileTab === 'articles') loadMoreArticles();
    else if (profileTab === 'replies') loadMoreReplies();
  }, [profileTab, loadMorePosts, loadMoreArticles, loadMoreReplies]);

  const applyFollowState = React.useCallback(async (nextFollowing: boolean) => {
    if (!sdk || !profile?.id || nextFollowing === isFollowing) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(nextFollowing);
    setOptimisticFollow({ base: baseFollowerCount, delta: nextFollowing ? 1 : -1 });
    try {
      if (nextFollowing) await sdk.profiles.follow(profile.id);
      else await sdk.profiles.unfollow(profile.id);
      // Server is the source of truth for counts (computed from the
      // follow table on read, no denorm). Pull a fresh profile so the
      // header reflects reality the moment the optimistic offset goes
      // away. Reset the offset once the new count lands so we don't
      // double-count.
      await refreshProfile();
      setOptimisticFollow(null);
      // Followers/Following lists drawn lazily — drop any cached
      // copy so the next tap re-pulls.
      setFollowersList(null);
      setFollowingList(null);
      // Reconcile the CURRENT user's own counts too: following someone bumps
      // your "following" count, which is shown on your own profile (a different
      // cache). Invalidate it so it's fresh the next time you view your profile
      // instead of showing a stale number until the cache expires.
      invalidate('myprofile');
      if (user?.username) invalidate(`profile:${user.username}`);
      if (user?.id) invalidate(`profile:${user.id}`);
      // The feeds built ON the follow graph are stale now too. Without this the
      // unfollowed author's posts stayed in the following feed, and survived a
      // refresh, because the cached page outlived the follow edge behind it.
      afterFollowChange();
    } catch (err: any) {
      setIsFollowing(wasFollowing);
      setOptimisticFollow(null);
      const message = err?.message || `Could not ${nextFollowing ? 'follow' : 'unfollow'} — try again.`;
      if (Platform.OS === 'web') {
        (typeof window !== 'undefined' ? window : globalThis).alert?.(message);
      } else {
        showToast(message, 'error');
      }
    } finally {
      setFollowLoading(false);
    }
  }, [sdk, profile?.id, isFollowing, setIsFollowing, baseFollowerCount, refreshProfile, user?.username, user?.id]);

  const handleToggleFollow = async () => {
    if (!sdk) {
      const profilePath = `/${profile?.username || username}`;
      router.push(otpSignInPath(`${profilePath}?follow=1`) as any);
      return;
    }
    await applyFollowState(!isFollowing);
  };

  const handleShareProfile = async () => {
    const handle = profile?.username || username;
    if (!handle) return;
    const url = `${SITE_URL}/${encodeURIComponent(handle)}`;
    const title = `${profile?.name || `@${handle}`} on Minds`;
    setShowProfileMenu(false);
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title, url });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast('Profile link copied.', 'success');
        } else {
          throw new Error('Sharing is unavailable');
        }
      } else {
        await Share.share({ title, message: url, url });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') showToast('Could not share profile.', 'error');
    }
  };

  React.useEffect(() => {
    if (
      followIntent !== '1' ||
      !sdk ||
      !profile?.id ||
      isOwnProfile ||
      followIntentStartedRef.current
    ) return;

    followIntentStartedRef.current = true;
    router.replace(`/${profile.username || username}` as any);
    if (!isFollowing) {
      void (async () => {
        try {
          const relationship = await sdk.profiles.isFollowing(profile.id);
          if (relationship.data?.is_following) {
            setIsFollowing(true);
            return;
          }
        } catch {}
        await applyFollowState(true);
      })();
    }
  }, [followIntent, sdk, profile?.id, profile?.username, username, isOwnProfile, isFollowing, setIsFollowing, applyFollowState, router]);

  // Pick the FULL image (no OS crop) and route it through our own ImageCropper —
  // the OS `allowsEditing` crop was inconsistent across iOS/Android and absent on
  // web. Our cropper guarantees a spec-perfect result on every platform.
  const handlePickEditBanner = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({ mediaTypes: picker.MediaTypeOptions.Images, quality: 1 });
        if (!result.canceled && result.assets[0]) setCropBannerUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setCropBannerUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch (error) {
      captureException(error, { action: 'edit-profile', step: 'pick-banner' });
      showToast('Could not open your photo library. Try again.', 'error');
    }
  };

  const handlePickEditAvatar = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          quality: 1,
        });
        if (!result.canceled && result.assets[0]) setCropUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setCropUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch (error) {
      captureException(error, { action: 'edit-profile', step: 'pick-avatar' });
      showToast('Could not open your photo library. Try again.', 'error');
    }
  };

  // Show the skeleton while loading AND during the brief post-fetch window where
  // profile hasn't committed yet (no error). Without the `!profile && !error`
  // guard, that transient flashed the "User not found" state before the profile
  // rendered. Not-found only shows once an error is actually set.
  if (loading || (!profile && !error)) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="" />
        <View style={{ padding: spacing['3xl'], gap: spacing.lg }}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <Skeleton width={160} height={20} />
          <Skeleton width={120} height={14} />
        </View>
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="User" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>{error || 'User not found'}</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title={`@${profile.username || username}`} />

      <RightRailLayout
        context="profile"
        rail={<FeedSidebar context="profile" relatedTo={profile?.id ? { id: profile.id } : undefined} />}
      >
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
        {/* X-style banner: 3:1 cover with the avatar overlapping its bottom
            edge inside a bg-colored ring. Flat surface tint when unset. */}
        <View style={{ width: '100%', aspectRatio: 3, backgroundColor: colors.surface }}>
          {(profile.banner || profile.banner_url) ? (
            <Image
              source={{ uri: profile.banner || profile.banner_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : null}
        </View>
        <View style={{ paddingHorizontal: spacing.xl }}>
          {/* Top row: overlapping avatar + owner action buttons (buttons sit
              just below the banner, bottom-aligned with the avatar — X). */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -40 }}>
            <View style={{ borderWidth: 4, borderColor: colors.bg, borderRadius: 999, backgroundColor: colors.bg }}>
              <Avatar uri={profile.image || profile.avatar} name={profile.name} size="xl" />
            </View>

            {isOwnProfile && (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  onPress={() => {
                    editSession.current += 1;
                    editorOpenRef.current = true;
                    const usernameSeed = firstValidUsername(
                      user?.username,
                      profile.username,
                      username,
                    );
                    setEditName(profile.name || '');
                    // The owner identity is already canonical even when this
                    // screen was opened through its UUID alias and the profile
                    // projection is still hydrating. Prefer it so Edit Profile
                    // never presents an empty handle for an existing account.
                    setEditUsername(usernameSeed);
                    setEditUsernameShielded(Platform.OS === 'web');
                    setEditBio(profile.bio || '');
                    setEditAvatarUri(null);
                    setShowEditProfile(true);

                    // A UUID-routed fresh account can reach this screen before
                    // either cached projection includes its generated handle.
                    // Ask the canonical owner endpoint only in that missing-data
                    // case. Some owner projections still omit username, so fall
                    // back to the public profile projection by the already-known
                    // owner ID. Never overwrite text the user began entering.
                    if (!usernameSeed && sdk) {
                      void (async () => {
                        let canonicalUsername = '';
                        try {
                          const res = await sdk.profiles.me();
                          canonicalUsername = firstValidUsername(res.data?.username);
                        } catch {}
                        if (!canonicalUsername) {
                          try {
                            const res = await publicMinds.publicProfiles.get(profile.id);
                            canonicalUsername = firstValidUsername(res.data?.username);
                          } catch {}
                        }
                        if (canonicalUsername) {
                          setEditUsername((current) => current || canonicalUsername);
                        }
                      })();
                    }
                  }}
                  variant="secondary"
                  size="sm"
                  style={{
                    height: 36,
                    minHeight: 36,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 0.5,
                  }}
                >
                  Edit Profile
                </Button>
              </View>
            )}
          </View>


          {/* Edit Agent CTA — only for the actual personal agent.
             `isMyAgent` is true for any owned agent (incl. user-created),
             but the `/agent` editor hardcodes the personal agent. Showing
             this CTA on user-created agent profiles + routing to `/agent`
             would silently send the user to their personal agent's editor. */}
          {isMyAgent && (((profile as any)?.agent_type === 'personal') || ((profile as any)?.agentType === 'personal')) && (
            <View style={{ marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}>
              <Text variant="bodyMedium" color={colors.text} style={{ marginBottom: spacing.xs }}>Your personal agent</Text>
              <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18, marginBottom: spacing.md }}>
                Edit your agent's name, voice, and full system prompt. You control how it works.
              </Text>
              <Pressable
                onPress={() => router.push('/agent' as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? colors.surfaceHover : colors.bg,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                })}
              >
                <Text variant="body" color={colors.text}>Edit agent</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          )}

          {/* Name + badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <Text variant="h2">{profile.name || username}</Text>
            {/* Tier + Founder badges: gold check (Minds+/Pro), Pro marker, Founder ribbon. */}
            {getBadges(profile, { full: true }).map((b) => <Badge key={b} type={b} size="sm" />)}
            {profile.role === 'admin' && (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>Admin</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
            <Text variant="body" color={colors.textMuted}>
              @{profile.username || username}
            </Text>
            {followsYou && (
              <View style={{ backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>Follows you</Text>
              </View>
            )}
          </View>
          {!!(profile.createdAt || profile.created_at) && (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              Joined {new Date(profile.createdAt || profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
          )}

          {!!profile.bio && (
            <View style={{ marginTop: spacing.md }}>
              <ProfileBio bio={String(profile.bio)} expanded={bioExpanded} />
              {/* Long bios truncate with a toggle so the profile header stays tidy. */}
              {String(profile.bio).length > 160 ? (
                <ProfileBioToggle
                  expanded={bioExpanded}
                  onToggle={() => setBioExpanded(v => !v)}
                />
              ) : null}
            </View>
          )}

          {/* Follower/Following counts */}
          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <Pressable
              onPress={() => setProfileTab('following')}
              accessibilityRole="button"
              accessibilityLabel={`${formatCount(followingCount)} Following, view list`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
            >
              <Text variant="bodyMedium">{formatCount(followingCount)}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </Pressable>
            {!isMindsChannel && (
              <Pressable
                onPress={() => setProfileTab('followers')}
                accessibilityRole="button"
                accessibilityLabel={`${formatCount(followerCount)} Followers, view list`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
              >
                <Text variant="bodyMedium">{formatCount(followerCount)}</Text>
                <Text variant="caption" color={colors.textMuted}>Followers</Text>
              </Pressable>
            )}
          </View>

          {/* Non-owner action row */}
          {!isOwnProfile && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, flexWrap: 'wrap' }}>
              <Button onPress={handleToggleFollow} loading={followLoading} variant={isFollowing ? 'secondary' : 'primary'} size="sm">
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
              <Button
                onPress={async () => {
                  if (!sdk) {
                    if (!profile?.id) return;
                    const returnTo = `/chat?userId=${encodeURIComponent(profile.id)}&focused=1`;
                    router.push(otpSignInPath(returnTo) as any);
                    return;
                  }
                  if (!profile?.id) return;
                  try {
                    const res = await sdk.chat.dm({ user_id: profile.id, organization_id: ORG_ID || undefined } as any);
                    if (res.data?.id) {
                      router.push(chatConversationHref(res.data.id) as any);
                    }
                  } catch { showToast('Could not start chat', 'error'); }
                }}
                variant="secondary"
                size="sm"
              >
                Message
              </Button>
              {/* Overflow menu. Report previously sent a hardcoded reason
                  ("Reported from profile"), so a moderator received a report with no
                  indication of what to look for -- on an account that may post hundreds
                  of times. It now uses the same reason picker as posts. */}
              <Button
                onPress={() => setShowProfileMenu(true)}
                variant="ghost"
                size="sm"
              >
                More
              </Button>
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={{ marginTop: spacing.xl }}>
          <TabBar
            tabs={ALLOWED_TABS.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))}
            active={profileTab}
            onChange={(k) => setProfileTab(k as ProfileTab)}
            scrollable
            accessibilityLabel="Profile sections"
          />
        </View>

        {/* Per-tab search — own profile only. One input that filters the active
            tab's list (posts/replies by text, communities by name, saved by text,
            followers/following by name/handle). Matches the app's search styling. */}
        {isOwnProfile && (
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.surface, borderRadius: radius.full,
                borderWidth: 0.5, borderColor: colors.glassBorder,
                paddingHorizontal: spacing.md, gap: spacing.sm,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={tabSearch}
                onChangeText={setTabSearch}
                autoCapitalize="none"
                style={{
                  flex: 1, color: colors.text, ...typography.body, paddingVertical: 9,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
              />
              {tabSearch.length > 0 && (
                <Pressable onPress={() => setTabSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Posts */}
        {profileTab === 'posts' && (() => {
          const visiblePosts = userPosts
            .filter((p: any) => !p.reply_to_id && !p.replyToId && !isArticlePost(p))
            .filter((p: any) => matchText(p.content, p.title));
          return (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : postsError && visiblePosts.length === 0 && !isTabSearching ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
              <Text variant="body" color={colors.textMuted}>Posts couldn&apos;t load</Text>
              <Button onPress={refreshPosts} variant="secondary" size="sm">Try again</Button>
            </View>
          ) : visiblePosts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching posts' : 'No posts yet'}</Text>
            </View>
          ) : (
            <>
              {visiblePosts.map((post: any) => (
                <PostCard key={post.id} post={post} compact />
              ))}
              {!isTabSearching && postsHasMore && (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Articles — long-form posts (title + markdown). PostCard renders them
            as the article card; the 'posts' tab excludes that exact shape while
            keeping ordinary plain-format posts that happen to carry a title. */}
        {profileTab === 'articles' && (() => {
          const visibleArticles = userArticles
            .filter((p: any) => matchText(p.content, p.title));
          return (
          articlesLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={80} />)}</View>
          ) : articlesError && visibleArticles.length === 0 && !isTabSearching ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
              <Text variant="body" color={colors.textMuted}>Articles couldn&apos;t load</Text>
              <Button onPress={refreshArticles} variant="secondary" size="sm">Try again</Button>
            </View>
          ) : visibleArticles.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching articles' : 'No articles yet'}</Text>
            </View>
          ) : (
            <>
              {visibleArticles.map((post: any) => (
                <PostCard key={post.id} post={post} compact />
              ))}
              {!isTabSearching && articlesHasMore && (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Replies — X-style: each reply shows "Replying to @x" (clickable to the
            parent) above the reply card. */}
        {profileTab === 'replies' && (() => {
          const visibleReplies = userReplies.filter((p: any) => matchText(p.content, p.reply_to?.content, p.reply_to?.author?.username));
          return (
          repliesLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : visibleReplies.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching replies' : 'No replies yet'}</Text>
            </View>
          ) : (
            <>
              {visibleReplies.map((post: any) => {
                const parent = post.reply_to;
                const parentHandle = parent?.author?.username;
                return (
                  <View key={post.id}>
                    {parentHandle ? (
                      <Pressable
                        onPress={() => { if (parent?.id) router.push(`/post/${parent.id}` as any); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
                      >
                        <Ionicons name="arrow-undo-outline" size={13} color={colors.textMuted} />
                        <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                          Replying to <Text variant="caption" color={colors.accent}>@{parentHandle}</Text>
                          {parent?.content ? `  ${parent.content.slice(0, 50)}` : ''}
                        </Text>
                      </Pressable>
                    ) : null}
                    <PostCard post={post} compact />
                  </View>
                );
              })}
              {repliesHasMore && (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Articles */}
        {/* Followers */}
        {profileTab === 'followers' && (() => {
          const visible = (followersList || []).filter((u: any) => matchText(u.name, u.username, u.bio));
          return (
          relationsLoading && followersList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : !followersList || visible.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching followers' : 'No followers yet'}</Text>
            </View>
          ) : (
            <>
              {visible.map((u: any) => <ProfileUserRow key={u.id} user={u} onPress={() => router.push(`/${u.username || u.id}` as any)} />)}
              {!isTabSearching && followersHasMore && (
                <View style={{ alignItems: 'center', padding: spacing.xl }}>
                  <Button
                    onPress={() => loadMoreRelationships('followers')}
                    loading={relationLoadingMore === 'followers'}
                    disabled={relationLoadingMore !== null}
                    variant="secondary"
                    size="sm"
                  >
                    Load more followers
                  </Button>
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Following */}
        {profileTab === 'following' && (() => {
          const visible = (followingList || []).filter((u: any) => matchText(u.name, u.username, u.bio));
          return (
          relationsLoading && followingList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : !followingList || visible.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching accounts' : 'Not following anyone yet'}</Text>
            </View>
          ) : (
            <>
              {visible.map((u: any) => <ProfileUserRow key={u.id} user={u} onPress={() => router.push(`/${u.username || u.id}` as any)} />)}
              {!isTabSearching && followingHasMore && (
                <View style={{ alignItems: 'center', padding: spacing.xl }}>
                  <Button
                    onPress={() => loadMoreRelationships('following')}
                    loading={relationLoadingMore === 'following'}
                    disabled={relationLoadingMore !== null}
                    variant="secondary"
                    size="sm"
                  >
                    Load more following
                  </Button>
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Communities + Saved tabs removed from the profile — Communities lives
            in the Groups nav; Saved (bookmarks) is the top-level /bookmarks page. */}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
      </RightRailLayout>

      {/* Profile overflow menu: sharing is public; moderation actions require an
          account. Blocking from a post but not a profile meant the only route to
          unblock was the settings list. */}
      <Modal visible={showProfileMenu} transparent animationType="fade" onRequestClose={() => setShowProfileMenu(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowProfileMenu(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, minWidth: 260, paddingVertical: spacing.sm }} onPress={(e) => e.stopPropagation()}>
            <Pressable
              onPress={handleShareProfile}
              accessibilityRole="button"
              style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
            >
              <Text variant="body">Share profile</Text>
            </Pressable>
            {sdk ? (
              <>
                <Pressable
                  disabled={modBusy}
                  accessibilityRole="button"
                  onPress={async () => {
                    if (!profile?.id) return;
                    setModBusy(true);
                    try {
                      if (isMuted) { await unmuteUser(profile.id); setIsMuted(false); showToast('Unmuted', 'success'); }
                      else { await muteUser(profile.id); setIsMuted(true); showToast('Muted', 'success'); }
                      setShowProfileMenu(false);
                    } catch { showToast('Could not update mute', 'error'); }
                    setModBusy(false);
                  }}
                  style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
                >
                  <Text variant="body">{isMuted ? 'Unmute' : 'Mute'} @{profile?.username}</Text>
                </Pressable>
                <Pressable
                  disabled={modBusy}
                  accessibilityRole="button"
                  onPress={async () => {
                    if (!profile?.id) return;
                    setModBusy(true);
                    try {
                      if (isBlocked) { await unblockUser(profile.id); setIsBlocked(false); showToast('Unblocked', 'success'); }
                      else { await blockUser(profile.id); setIsBlocked(true); showToast('Blocked', 'success'); }
                      setShowProfileMenu(false);
                      refreshProfile?.();
                    } catch { showToast('Could not update block', 'error'); }
                    setModBusy(false);
                  }}
                  style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
                >
                  <Text variant="body" color={isBlocked ? colors.text : colors.error}>
                    {isBlocked ? 'Unblock' : 'Block'} @{profile?.username}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { setShowProfileMenu(false); setShowReport(true); }}
                  accessibilityRole="button"
                  style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
                >
                  <Text variant="body">Report @{profile?.username}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setShowProfileMenu(false);
                  router.push(otpSignInPath(`/${profile?.username || username}`) as any);
                }}
                style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg }}
              >
                <Text variant="body" color={colors.textSecondary}>Sign in to mute, block, or report</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={async (reason, details) => {
          if (!sdk || !profile?.id) throw new Error('Sign in to report this profile');
          const trimmedDetails = details.trim();
          await sdk.reports.create({
            target_type: 'user',
            target_id: profile.id,
            reason,
            ...(trimmedDetails ? { details: trimmedDetails } : {}),
          });
        }}
      />

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <Modal visible={showEditProfile} transparent animationType="fade" onRequestClose={closeEditProfile}>
          <Pressable
            onPress={closeEditProfile}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.xl,
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.bg,
                borderRadius: radius.xl,
                padding: spacing['2xl'],
                width: '100%',
                maxWidth: 400,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text variant="h3" style={{ marginBottom: spacing.xl }}>Edit Profile</Text>

              <Pressable
                onPress={handlePickEditBanner}
                accessibilityRole="button"
                accessibilityLabel="Change cover photo"
                style={{ marginBottom: spacing.lg, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceHover, aspectRatio: 3, alignItems: 'center', justifyContent: 'center' }}
              >
                {(editBannerUri || profile.banner || (profile as any).banner_url) ? (
                  <Image source={{ uri: editBannerUri || profile.banner || (profile as any).banner_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : null}
                <View style={{ position: 'absolute', bottom: spacing.sm, right: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' }}>
                  <Ionicons name="image-outline" size={14} color="#fff" />
                  <Text variant="caption" color="#fff">Cover photo</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handlePickEditAvatar}
                accessibilityRole="button"
                accessibilityLabel="Change profile picture"
                style={{ alignSelf: 'center', marginBottom: spacing.xl, position: 'relative' }}
              >
                {editAvatarUri ? (
                  <Image source={{ uri: editAvatarUri }} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceHover }} />
                ) : (
                  <Avatar uri={profile.image} name={profile.name} size="xl" />
                )}
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg }}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </Pressable>

              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Name</Text>
              <TextInput value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, ...typography.body, marginBottom: spacing.lg, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />

              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Username</Text>
              {/* This is an account setting, not a login form. Password-manager
                  inline overlays can otherwise attach here and clear the
                  controlled value while trying to inject credential UI. */}
              <TextInput
                ref={editUsernameInputRef}
                value={editUsername}
                readOnly={Platform.OS === 'web' ? editUsernameShielded : undefined}
                onFocus={(event) => {
                  if (Platform.OS === 'web') {
                    const target = (event as any).target;
                    if (target && typeof target.value === 'string') target.value = editUsername;
                    setEditUsernameShielded(false);
                  }
                }}
                onChange={(event) => {
                  if (Platform.OS === 'web' && editUsernameShielded) {
                    // RN Web captures the incoming text before invoking this
                    // callback, so restore the DOM and let onChangeText ignore
                    // that same unsolicited mount-time event below.
                    const target = (event as any).target;
                    if (target && typeof target.value === 'string') {
                      target.value = editUsername;
                    }
                  }
                }}
                onChangeText={(t) => {
                  if (Platform.OS === 'web' && editUsernameShielded) return;
                  setEditUsername(sanitizeUsername(t));
                }}
                placeholder="username"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                {...(Platform.OS === 'web' ? {
                  // React Native Web filters arbitrary `data-*` props from
                  // TextInput. `dataSet` is its supported route to the DOM.
                  dataSet: {
                    bwignore: 'true',
                    lpignore: 'true',
                    formType: 'other',
                  },
                } as any : {})}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, ...typography.body, marginBottom: spacing.lg, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />

              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Bio</Text>
              <TextInput value={editBio} onChangeText={setEditBio} placeholder="Tell people about yourself" placeholderTextColor={colors.textMuted} multiline numberOfLines={3}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, marginBottom: spacing.xl, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button onPress={closeEditProfile} variant="secondary" fullWidth>Cancel</Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    loading={editSaving}
                    onPress={async () => {
                      if (!sdk) return;
                      const submittedSession = editSession.current;
                      const submittedSnapshot = editSnapshot;
                      const submittedContext = editorContext;
                      const isCurrentContext = () => editorMounted.current && latestEditorContext.current === submittedContext;
                      setEditSaving(true);
                      try {
                        if (editBannerUri) {
                          try {
                            const blobRes = await fetch(editBannerUri);
                            const blob = await blobRes.blob();
                            const contentType = blob.type || 'image/jpeg';
                            const client = (sdk as any).uploads?.client || (sdk as any).client;
                            const urlRes = await client.post('/uploads/banner-url', { content_type: contentType, content_length: blob.size });
                            const uploadUrl = urlRes?.data?.upload_url || urlRes?.data?.url;
                            const key = urlRes?.data?.key;
                            if (!uploadUrl || !key) throw new Error('Incomplete cover upload response');
                            const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
                            if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
                            await client.post('/uploads/banner-confirm', { key });
                            setEditBannerUri(null);
                          } catch {
                            showToast('Cover photo could not be uploaded. Try again.', 'error');
                            return;
                          }
                        }
                        if (editAvatarUri) {
                          try {
                            const blobRes = await fetch(editAvatarUri);
                            const blob = await blobRes.blob();
                            const contentType = blob.type || 'image/jpeg';
                            const uploads = sdk.uploads;
                            const uploadRes = await uploads.getAvatarUploadUrl({ content_type: contentType, content_length: blob.size });
                            const uploadUrl = (uploadRes.data as any)?.upload_url || (uploadRes.data as any)?.url;
                            const key = uploadRes.data?.key;
                            if (!uploadUrl || !key) throw new Error('Incomplete avatar upload response');
                            const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
                            if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
                            await uploads.confirmAvatarUpload(key);
                          } catch {
                            // Do not continue into profiles.update or close the
                            // editor: the selected crop is still present, so a
                            // second Save retries the complete upload.
                            showToast('Profile picture could not be uploaded. Try again.', 'error');
                            return;
                          }
                        }
                        const newUsername = editUsername.trim();
                        await sdk.profiles.update({
                          name: editName.trim(),
                          username: newUsername || undefined,
                          bio: editBio.trim(),
                        });
                        if (!isCurrentContext()) return;
                        // Record acceptance before refreshes: Cancel may arrive
                        // while they are pending. A newer draft defers this URL
                        // change until its own Save/Cancel, never loses its fields.
                        // An empty field omits username from the SDK update;
                        // it must not forget an earlier accepted rename.
                        const priorTarget = acceptedCanonicalTarget.current;
                        const acceptedUsername = newUsername || (priorTarget?.context === submittedContext ? priorTarget.username : '');
                        acceptedCanonicalTarget.current = acceptedUsername && acceptedUsername !== username
                          ? { context: submittedContext, username: acceptedUsername }
                          : null;
                        await refreshMyProfile();
                        if (!isCurrentContext()) return;
                        await refreshUser();
                        if (!isCurrentContext()) return;
                        // The visible profile has its own hook/cache, separate
                        // from the current-user profile and auth identity. UUID
                        // aliases remain valid after renames; old handles do not.
                        if (!acceptedUsername || acceptedUsername === username || !isValidUsername(username)) {
                          await refreshProfile();
                        }
                        if (!isCurrentContext()) return;
                        if (
                          !editorOpenRef.current || (
                            editSession.current === submittedSession &&
                            latestEditSnapshot.current === submittedSnapshot
                          )
                        ) {
                          // The saved fields can refresh the page without
                          // dismissing newer text, a crop, or a reopened editor.
                          closeEditProfile();
                        }
                      } catch {
                        showToast('Failed to update profile.', 'error');
                      } finally {
                        setEditSaving(false);
                      }
                    }}
                    fullWidth
                  >
                    Save
                  </Button>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Full-screen crop step: picking an avatar hands the raw image here; the
          cropped result becomes editAvatarUri for the existing upload flow. */}
      <ImageCropper
        uri={cropUri}
        spec={CROP_AVATAR}
        onCancel={() => setCropUri(null)}
        onDone={(r) => { setEditAvatarUri(r.uri); setCropUri(null); }}
      />
      <ImageCropper
        uri={cropBannerUri}
        spec={CROP_BANNER}
        onCancel={() => setCropBannerUri(null)}
        onDone={(r) => { setEditBannerUri(r.uri); setCropBannerUri(null); }}
      />
    </Container>
  );
}
