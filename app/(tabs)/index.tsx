import * as React from 'react';
import { View, FlatList, RefreshControl, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate, runOnJS } from 'react-native-reanimated';
import { haptics } from '../../lib/haptics';
import { useRouter, useFocusEffect, useNavigation, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Header, FeedTabs, PostCard, Text, Container, FeedSidebar, Button, Avatar } from '../../components';
import { FeedPeopleInsert, FeedGroupsInsert } from '../../components/FeedInserts';
import { FeedSidebarSkeleton } from '../../components/FeedSidebarSkeleton';
import { FeedSkeletons } from '../../components/PostSkeleton';
import { ORG_ID } from '../../lib/recursiv';
import { useAuth } from '../../lib/auth';
import { usePosts } from '../../lib/hooks';
import { getPreference } from '../../lib/preferences';
import { registerShortcut } from '../../lib/keyboard';
import { getItem, setItem } from '../../lib/storage';
import { loadPreferences, isAgentCtaDismissed, markAgentCtaDismissed, isAgentSetUp } from '../../lib/onboarding';
import { MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } from '../../lib/curator/prompts';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { resolvePersonalAgent } from '../../lib/resolvePersonalAgent';
import { onHomeScrollToTop } from '../../lib/scrollSignals';
import { getCached } from '../../lib/cache';
import { getSeenSet, markSeen } from '../../lib/seen';
import { postReplyCount } from '../../lib/models';

const PROFILE_NUDGE_DISMISSED_KEY = 'minds:profileNudge:dismissed';
type FeedTab = 'foryou' | 'following';

export default function FeedScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();
  // Honor the user's saved default. New accounts land on 'foryou'; if
  // a user flips the preference in Settings, this is what runs on
  // every cold open.
  const [activeTab, setActiveTab] = React.useState<FeedTab>(() => getPreference('defaultFeed'));
  // Allow other screens to deep-link a tab (e.g. the composer sends you to
  // 'following' after posting so you see your new post).
  const params = useLocalSearchParams<{ tab?: string; posted?: string }>();
  React.useEffect(() => {
    if (params.tab === 'following' || params.tab === 'foryou') setActiveTab(params.tab);
  }, [params.tab]);
  const [nudgeDismissed, setNudgeDismissed] = React.useState(true); // start true to avoid flash before storage read

  // Load persisted nudge dismissal so it stays dismissed across refreshes.
  React.useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const stored = await getItem(`${PROFILE_NUDGE_DISMISSED_KEY}:${user.id}`);
      setNudgeDismissed(stored === 'true');
    })();
  }, [user?.id]);

  const dismissNudge = React.useCallback(() => {
    setNudgeDismissed(true);
    if (user?.id) {
      setItem(`${PROFILE_NUDGE_DISMISSED_KEY}:${user.id}`, 'true');
    }
  }, [user?.id]);

  // Calibration nudge: legacy users land on For You with no saved taste
  // Agent-setup CTA: show at top of For You feed when user has no
  // personal agent AND hasn't dismissed. Once they set one up OR dismiss,
  // it stays gone. Hard-default to "hide" so we don't flash the CTA
  // before storage + agents.list resolve.
  const [agentCtaState, setAgentCtaState] = React.useState<'hidden' | 'show'>('hidden');

  React.useEffect(() => {
    if (!user?.id || !sdk) return;
    let active = true;
    (async () => {
      const [dismissed, setUp, personal] = await Promise.all([
        isAgentCtaDismissed(),
        isAgentSetUp(),
        resolvePersonalAgent(sdk).catch(() => null),
      ]);
      if (!active) return;
      // The For You feed is now ranked server-side by the recommender — it no
      // longer requires the user to set up a personal agent, so the setup CTA
      // is retired. (The personal agent still exists as an optional DM /
      // ask-agent surface, just not a feed prerequisite.)
      void dismissed; void setUp; void personal;
      setAgentCtaState('hidden');

      // One-time persona heal: some personal agents were provisioned with the
      // generic org (sales/SDR) system prompt, so they mis-describe their role
      // ("I'm your SDR…"). If the current prompt is empty or sales-flavoured,
      // stamp the Minds curator persona once. Guarded by a storage flag and a
      // marker test so we never clobber a user's deliberately customised voice.
      if (personal) {
        const curPrompt = String(personal.ai_system_prompt || personal.aiSystemPrompt || '');
        const looksWrong = !curPrompt.trim() || /\b(SDR|Apollo|outbound|lead[-\s]?gen|sales pipeline|CRM)\b/i.test(curPrompt);
        // Scoped to the user, like every other flag in this file. It was a
        // DEVICE-GLOBAL key gating a PER-USER operation: once anyone on this
        // device was healed, the flag read '1' for everybody after them, so the
        // second account to sign in here kept the wrong SDR persona forever and
        // nothing retried it. It is also not cleared on sign-out, so the stale
        // '1' outlived the account that set it.
        //
        // Re-checking costs nothing for already-healed users: `looksWrong` is
        // false once the prompt is correct, so the miss on the new key shape is
        // a no-op rather than a re-heal.
        const alreadyHealed = await getItem(`minds:agentPersonaHealed:${user.id}`);
        if (looksWrong && alreadyHealed !== '1' && active) {
          try {
            await (sdk as any).agents.ensurePersonal({ overrides: { system_prompt: MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } });
            await setItem(`minds:agentPersonaHealed:${user.id}`, '1');
          } catch {}
        }
      }
    })();
    return () => { active = false; };
  }, [user?.id, sdk]);

  const dismissAgentCta = React.useCallback(() => {
    setAgentCtaState('hidden');
    void markAgentCtaDismissed();
  }, []);

  // For You is always the server-side recommender (a cheap, LLM-free SQL ranker —
  // no agent/AI involved). It is NOT gated by the personal-agent setting; that
  // toggle only controls whether the personal-agent DM shows in the inbox.
  const sortMap = {
    foryou: 'personal',
    following: 'following',
  } as const;
  const { posts, setPosts, loading: postsLoading, error: feedError, refreshing, refresh, recurate, loadMore, loadNew, hasMore } = usePosts(sortMap[activeTab] as any);
  // The desktop rail can derive trends and fallback creators from the page the
  // timeline already ranked. Keep the last For You page while Following is
  // selected so the rail never starts its old, separate 40-post ranking.
  const sidebarForYouPostsRef = React.useRef<any[]>([]);
  if (activeTab === 'foryou' && posts.length > 0) sidebarForYouPostsRef.current = posts;
  // Gate infinite-scroll to one loadMore per delivered page (see FlatList).
  const canLoadMoreRef = React.useRef(true);

  // For You is ranked server-side by the recommender now — pull-to-refresh just
  // re-fetches (which re-ranks). No more "your agent is curating…" banner.

  // Horizontal-swipe nav between feed filters. Pan past 60px without
  // significant vertical drift cycles to the next/previous tab. Vertical
  // scrolling on the FlatList is unaffected because Pan only activates
  // when the gesture's horizontal motion clearly dominates.
  const FEED_TAB_ORDER: FeedTab[] = ['foryou', 'following'];
  // X-style pager: the feed follows your FINGER between For You and Following.
  // pagerX translates the live list; the neighbor's cached page renders beside
  // it as the incoming preview; past the threshold (or with velocity) a spring
  // completes the page and the tab switch commits under it. Pure Reanimated —
  // no native pager dep, so it ships over OTA.
  const pagerX = useSharedValue(0);
  const [dragging, setDragging] = React.useState(false);
  const pagerWidthRef = React.useRef(400);
  const commitTab = React.useCallback((next: FeedTab) => {
    setActiveTab(next);
    pagerX.value = 0;
    setDragging(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const endDrag = React.useCallback(() => setDragging(false), []);
  const swipeGesture = React.useMemo(() => {
    const idx = FEED_TAB_ORDER.indexOf(activeTab);
    const hasNext = idx < FEED_TAB_ORDER.length - 1;
    const hasPrev = idx > 0;
    return Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-12, 12])
      .onStart(() => { runOnJS(setDragging)(true); })
      .onChange((e) => {
        let x = e.translationX;
        if (!hasNext && x < 0) x = x / 4; // rubber-band at the edges
        if (!hasPrev && x > 0) x = x / 4;
        pagerX.value = x;
      })
      .onEnd((e) => {
        const W = pagerWidthRef.current;
        const goNext = hasNext && (pagerX.value < -W * 0.35 || e.velocityX < -600);
        const goPrev = hasPrev && (pagerX.value > W * 0.35 || e.velocityX > 600);
        if (goNext) {
          pagerX.value = withTiming(-W, { duration: 180 }, (f) => { if (f) runOnJS(commitTab)(FEED_TAB_ORDER[idx + 1]); });
        } else if (goPrev) {
          pagerX.value = withTiming(W, { duration: 180 }, (f) => { if (f) runOnJS(commitTab)(FEED_TAB_ORDER[idx - 1]); });
        } else {
          pagerX.value = withTiming(0, { duration: 160 }, (f) => { if (f) runOnJS(endDrag)(); });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, commitTab, endDrag]);
  const pagerStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pagerX.value }] }));
  const previewLeftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pagerX.value }] }));
  // Incoming preview: the OTHER tab's cached first posts, positioned beside
  // the live list so the drag reveals real content, not a blank.
  const otherTab: FeedTab = activeTab === 'foryou' ? 'following' : 'foryou';
  const otherSortKey = otherTab === 'foryou' ? 'personal' : 'following';
  const previewPosts: any[] = React.useMemo(
    () => (dragging ? (getCached(`posts:${otherSortKey}:20`) || []).slice(0, 8) : []),
    [dragging, otherSortKey],
  );

  // Fresh-since-last-visit: track when the user last opened the feed,
  // then count posts created since that moment for a small "new
  // content" dot on the For You tab. Stored in AsyncStorage so it
  // persists across app launches. Updated when the user opens the feed
  // (we mark "now" as last-visit on tab focus).
  const [lastVisitAt, setLastVisitAt] = React.useState<number | null>(null);
  const FEED_LAST_VISIT_KEY = 'minds:feed:lastVisitAt';
  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const stored = await getItem(`${FEED_LAST_VISIT_KEY}:${user.id}`);
      if (!active) return;
      const ts = stored ? Number(stored) : null;
      setLastVisitAt(Number.isFinite(ts as any) ? (ts as any) : null);
      // Mark this open as "now" — only after we've read the previous
      // value, so the count below reflects posts since the LAST visit
      // not this one.
      setItem(`${FEED_LAST_VISIT_KEY}:${user.id}`, String(Date.now()));
    })();
    return () => { active = false; };
  }, [user?.id]);

  const freshCounts = React.useMemo(() => {
    if (!lastVisitAt) return undefined;
    // The fresh-content dot only makes sense on For You (a curated stream of
    // posts you haven't seen). On Following it lit up from your OWN new post,
    // which is nonsensical — so never show it there, and never count your own
    // posts toward it on any tab.
    if ((sortMap[activeTab] === 'personal' ? 'foryou' : activeTab) !== 'foryou') return undefined;
    const since = lastVisitAt;
    const count = (posts || []).filter((p: any) => {
      const ts = new Date(p.createdAt || p.created_at || 0).getTime();
      const authorId = p.author?.id || p.authorId || p.user_id;
      return ts > since && authorId !== user?.id;
    }).length;
    if (count === 0) return undefined;
    return { foryou: count } as any;
  }, [posts, lastVisitAt, activeTab, user?.id]);

  // Tap the Feed tab while already on Feed → scroll the list to the top.
  // Standard X / Twitter / Instagram behavior.
  const listRef = React.useRef<FlatList<any> | null>(null);
  // X signature scroll behavior: the wordmark header slides away as you
  // scroll down and returns the moment you scroll up; the feed tabs pin to
  // the top. Delta-accumulated so any upward motion reveals it instantly.
  const HEADER_H = 48;
  const headerHidden = useSharedValue(0); // 0 shown .. 1 hidden
  const lastScrollY = React.useRef(0);
  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(headerHidden.value, [0, 1], [HEADER_H, 0]),
    opacity: interpolate(headerHidden.value, [0, 1], [1, 0]),
    overflow: 'hidden' as const,
  }));
  const onFeedScroll = (y: number) => {
    const dy = y - lastScrollY.current;
    lastScrollY.current = y;
    if (y <= 8) { headerHidden.value = withTiming(0, { duration: 160 }); return; }
    if (dy > 4) headerHidden.value = withTiming(1, { duration: 200 });
    else if (dy < -4) headerHidden.value = withTiming(0, { duration: 160 });
  };
  // Header wordmark tap while on home → jump to top (X behavior).
  React.useEffect(() => onHomeScrollToTop(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }), []);
  const navigation = useNavigation();
  React.useEffect(() => {
    const unsub = (navigation as any).addListener?.('tabPress', () => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  // Per-tab scroll memory. When the user switches between For You and
  // Following and back, restore the offset they left. iMessage / X
  // expectation: tabs feel like separate stacks, not one shared scroll.
  const scrollOffsets = React.useRef<Record<FeedTab, number>>({ foryou: 0, following: 0 });
  const prevTabRef = React.useRef<FeedTab>(activeTab);
  React.useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    const offset = scrollOffsets.current[activeTab] || 0;
    // Defer one tick so the new tab's list has mounted with its data.
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [activeTab]);


  // Live "new posts" pill (X/Bluesky parity). The server fans out a
  // 'feed_update' event to org members whenever someone posts; we count them
  // and surface a tap-to-load banner instead of making the user pull-to-refresh
  // to discover there's new content.
  const [newPostsAvailable, setNewPostsAvailable] = React.useState(0);

  // LIVE COUNTERS on your own posts (the aha loop): every engagement
  // notification the socket delivers bumps the matching feed row's counter
  // in place, in lockstep with the badge ticking up — post, then watch it
  // take off without touching refresh. Server truth reconciles on the next
  // fetch; the increment is only ever applied to a row already on screen.
  React.useEffect(() => {
    if (!sdk) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock?.on) return;
        const onEngagement = (n: any) => {
          const t = n?.targetType || n?.target_type || '';
          if (!/post_reaction|post_reply|post_repost/.test(t)) return;
          const m = String(n?.actionUrl || '').match(/\/post\/([0-9a-fA-F-]{8,})/);
          const postId = m?.[1];
          if (!postId) return;
          setPosts(prev => {
            let hit = false;
            const next = prev.map(p => {
              if (p.id !== postId) return p;
              hit = true;
              if (t.includes('reaction')) return { ...p, score: (p.score || 0) + 1, upvote_count: (p.upvote_count || 0) + 1 };
              if (t.includes('reply')) {
                const repliesCount = postReplyCount(p) + 1;
                return { ...p, repliesCount, reply_count: repliesCount };
              }
              return { ...p, reposts_count: (p.reposts_count || 0) + 1 };
            });
            return hit ? next : prev;
          });
        };
        sock.on('notification', onEngagement);
        cleanup = () => sock.off?.('notification', onEngagement);
      } catch {}
    })();
    return () => { cleanup?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk]);
  React.useEffect(() => {
    if (!sdk) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock) return;
        const onFeedUpdate = (data: any) => {
          // Never count your OWN posts — you already see them the moment you
          // post. Only OTHERS' new posts make the pill a real "fresh content
          // arrived while you're here" signal (X-style).
          const authorId = data?.authorId || data?.author_id || data?.author?.id;
          if (authorId && user?.id && authorId === user.id) return;
          setNewPostsAvailable(n => Math.min(n + 1, 99));
        };
        sock.on('feed_update', onFeedUpdate);
        cleanup = () => sock.off?.('feed_update', onFeedUpdate);
      } catch {}
    })();
    return () => { cleanup?.(); };
  }, [sdk, user?.id]);
  // Reset the counter when switching tabs (each tab is its own stream).
  React.useEffect(() => { setNewPostsAvailable(0); }, [activeTab]);
  // Stable vote handler + renderItem so PostCard's React.memo actually holds.
  // The old inline onVoteChange closure was a new function every render, which
  // defeated the memo and re-rendered EVERY visible card on any parent update
  // (scroll state, tab, etc.) — a major feed-scroll perf drag.
  const handleVoteChange = React.useCallback((postId: string, newScore: number, newVote: any) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: newScore, userReaction: newVote } : p));
  }, []);
  const renderPost = React.useCallback(({ item }: any) => (
    <PostCard post={item} compact onVoteChange={handleVoteChange} />
  ), [handleVoteChange]);
  // For You weaves connection nudges INTO the scroll (not a sidebar): a
  // "People you might like" card early, "Groups to join" a bit deeper. Same
  // ranked data as Discover, junk-filtered. Only on For You, only once there
  // are enough posts that the inserts don't dominate a thin feed. A stale
  // cached page remains visible while For You revalidates, but its discovery
  // inserts must wait: mounting the people card starts profiles, leaderboard,
  // and following queries that otherwise compete with the primary timeline.
  // Re-arm infinite scroll once the page it asked for has landed. Anchoring the
  // gate to a scroll event meant web (no momentum on wheel/trackpad) fired
  // loadMore exactly once per mount and then stopped.
  React.useEffect(() => { canLoadMoreRef.current = true; }, [posts.length]);

  // The order the reader is currently looking at. Rotation decides what LEADS,
  // once — it must not re-run on every appended page, or the whole list re-sorts
  // under the reader mid-scroll and rows they already passed move around them.
  // That churn is what read as the feed duplicating.
  const orderRef = React.useRef<string[]>([]);
  const orderKeyRef = React.useRef<string | null>(null);
  const prevLenRef = React.useRef(0);

  const feedData = React.useMemo(() => {
    if (activeTab !== 'foryou' || postsLoading || !posts || posts.length < 5) return posts;

    // Reset on a tab change or a refresh (a refresh replaces the list, so it is
    // shorter than what we had). Anything else is an append.
    const shrank = posts.length < prevLenRef.current;
    if (orderKeyRef.current !== activeTab || shrank) {
      orderRef.current = [];
      orderKeyRef.current = activeTab;
    }
    prevLenRef.current = posts.length;

    const byId = new Map<string, any>(posts.filter((p: any) => p?.id).map((p: any) => [p.id, p]));
    let ordered: any[];

    if (orderRef.current.length === 0) {
      // First page: lead with posts you haven't seen before, so the feed doesn't
      // open on the same row every visit. Recommender order is kept within each
      // group, so ranking still holds — only "what leads" rotates.
      const seen = getSeenSet();
      const unseen = posts.filter((p: any) => p?.id && !seen.has(p.id));
      ordered = unseen.length >= 3
        ? [...unseen, ...posts.filter((p: any) => !p?.id || seen.has(p.id))]
        : posts;
      orderRef.current = ordered.filter((p: any) => p?.id).map((p: any) => p.id);
    } else {
      // Appends: every row already on screen keeps the position it has. New rows
      // go on the end, in the order the server ranked them.
      const kept = orderRef.current.filter((id) => byId.has(id));
      const keptSet = new Set(kept);
      const fresh = posts.filter((p: any) => p?.id && !keptSet.has(p.id));
      orderRef.current = [...kept, ...fresh.map((p: any) => p.id)];
      ordered = [...kept.map((id) => byId.get(id)), ...fresh];
    }

    const out: any[] = [];
    ordered.forEach((p, i) => {
      out.push(p);
      if (i === 3) out.push({ __insert: 'people', id: '__insert-people' });
      // A groups card every 20 rows after the tenth, each showing a DIFFERENT
      // three. One fixed card at row 9 meant a long scroll saw the same
      // suggestions repeatedly and never anything else.
      if (i >= 9 && (i - 9) % 20 === 0) {
        const slot = (i - 9) / 20;
        out.push({ __insert: 'groups', id: `__insert-groups-${slot}`, slot });
      }
    });
    return out;
  }, [posts, activeTab, postsLoading]);
  // Mark the posts the viewer lands on (top of the rotated feed) as seen, so the
  // NEXT visit rotates them down and leads with fresh content. Fires once per
  // fetch (feedData identity changes only when posts change), after a short delay
  // so a quick bounce-through doesn't burn the whole feed.
  React.useEffect(() => {
    if (activeTab !== 'foryou' || !feedData?.length) return;
    const topIds = (feedData as any[]).filter((x) => !x?.__insert).slice(0, 12).map((x) => x?.id);
    if (!topIds.length) return;
    const t = setTimeout(() => markSeen(topIds), 2500);
    return () => clearTimeout(t);
  }, [feedData, activeTab]);
  const renderRow = React.useCallback(({ item }: any) => {
    if (item?.__insert === 'people') return <FeedPeopleInsert />;
    if (item?.__insert === 'groups') return <FeedGroupsInsert slot={item.slot ?? 0} />;
    return renderPost({ item });
  }, [renderPost]);
  const loadNewPosts = React.useCallback(async () => {
    haptics.tap();
    setNewPostsAvailable(0);
    // The user has now asked for fresh posts, so the feed is no longer stale
    // and the staleness clock restarts from this fetch. #192.
    setFeedStale(false);
    lastFeedFetchRef.current = Date.now();
    // Fetch-and-prepend (X behavior): the new posts are injected on TOP of
    // what you're reading, then we scroll up to them. A plain refresh()
    // looked like a no-op — silent replace, and on For You the recommender
    // could rank the "new" posts below the fold entirely.
    const added = await loadNew();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    // Nothing new in this feed's latest page (e.g. Following events from
    // authors you don't follow) — fall back to a full refresh so the tap
    // still visibly does something.
    if (!added) refresh();
  }, [loadNew, refresh]);

  // Landing from the composer (`posted` param): jump to the top of Following
  // and pull the fresh page so YOUR post is the first thing on screen — even
  // if you were hundreds of rows deep when you hit Post. The loop must feel
  // like: post → see it land → watch engagement come in.
  const lastPostedRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!params.posted || params.posted === lastPostedRef.current) return;
    lastPostedRef.current = params.posted;
    scrollOffsets.current.following = 0;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    loadNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.posted]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const unsubs = [
      registerShortcut('n', () => router.push('/(tabs)/create')),
      registerShortcut('/', () => router.push('/(tabs)/discover' as any)),
      registerShortcut('g', () => router.push('/(tabs)/chat')),
      registerShortcut('escape', () => refresh()),
    ];
    return () => unsubs.forEach(u => u());
  }, [router, refresh]);

  // Refetch posts when returning from create screen
  // #192: this used to call refresh() on EVERY focus, and refresh() replaces
  // the list wholesale (usePosts -> fetchPosts(reset) -> setPosts(data)). So
  // opening a post and coming back threw away pages 2..N and dropped the
  // reader wherever the now-shorter list put them — the single most common
  // navigation in the app, undoing their scroll every time.
  //
  // Refresh only when the data is actually stale. Inside the window the list
  // is left exactly as it was, which is what preserves both the loaded pages
  // and the offset. The "N new posts" pill already covers the live case: it
  // PREPENDS rather than replacing, so fresh content is still reachable
  // without a reader losing their place.
  const lastFeedFetchRef = React.useRef<number>(Date.now());
  // Was 5 min, which made the feed feel frozen (the "not updating" complaint):
  // the "new posts" pill only offered a refresh after five minutes. 90s matches
  // how X/Bluesky surface fresh content, while still using the scroll-safe
  // prepend path (#192) rather than an on-focus re-fetch.
  const FEED_STALE_MS = 90 * 1000;
  // #192 — returning to the feed used to call refresh() here, which is
  // fetchPosts(true, true): offset back to 0, an unconditional setPosts(data)
  // and setCache, so every loaded page AND the cached copy were replaced. Open
  // a post, press back, and the ~80 posts you had scrolled through were gone —
  // on For You re-ranked as well, so the post you had just been reading might
  // not be findable at all.
  //
  // A staleness window narrowed that to "only after 5 minutes", which is a
  // mitigation, not a fix: five minutes of scrolling is exactly the session
  // where the loss hurts most.
  //
  // So do not fetch on focus. Mark the feed stale and let the EXISTING pill
  // offer it, which is what the socket-driven new-posts path already does.
  // Tapping it runs loadNewPosts — fetch-and-PREPEND, which keeps the loaded
  // pages instead of replacing them. Refreshing becomes something the user
  // asks for, which is both what #192 requests and how X and Bluesky behave.
  const [feedStale, setFeedStale] = React.useState(false);
  useFocusEffect(
    React.useCallback(() => {
      if (Date.now() - lastFeedFetchRef.current < FEED_STALE_MS) return;
      setFeedStale(true);
    }, []),
  );

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 1024;

  // Show nudge when EITHER avatar or bio is missing (not both). Auto-hides
  // when profile is fully populated, regardless of whether the user
  // previously dismissed.
  const profileIncomplete = Boolean(user && (!user.image || !user.bio?.trim()));

  const feedContent = (
    <>
      {/* "Show new posts" pill removed — it didn't work reliably on For You /
          Following. Fresh content comes in via pull-to-refresh + rotation. */}
      {postsLoading && posts.length === 0 ? (
        <FeedSkeletons count={5} />
      ) : feedError && posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.lg }}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
          <Text variant="body" color={colors.textSecondary} align="center">Couldn't load your feed.</Text>
          <Pressable
            onPress={() => refresh()}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full,
              backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="bodyMedium" color={colors.textOnAccent}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={feedData}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
          // Throttled scroll capture for per-tab offset memory.
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            scrollOffsets.current[activeTab] = y;
            if (!isDesktopWeb) onFeedScroll(y);
          }}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS !== 'web'}
          renderItem={renderRow}
          ListHeaderComponent={
            <>
              {activeTab === 'foryou' && agentCtaState === 'show' && (
                <Pressable
                  onPress={() => router.push('/agent' as any)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                    backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                    gap: spacing.md,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                    <Ionicons name="sparkles" size={22} color={colors.accent} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="bodyMedium" color={colors.text}>Set up your personal AI agent</Text>
                      <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                        Your agent can curate this feed and help with anything you need on Minds. You control everything.
                      </Text>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation?.(); dismissAgentCta(); }} hitSlop={12}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 34 }}>
                    <View style={{
                      paddingHorizontal: spacing.md, paddingVertical: 6,
                      borderRadius: 999, backgroundColor: colors.accent,
                    }}>
                      <Text variant="caption" color={colors.textOnAccent}>Set up</Text>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation?.(); dismissAgentCta(); }}>
                      <Text variant="caption" color={colors.textMuted}>Not now</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
              {profileIncomplete && !nudgeDismissed && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                }}>
                  <Pressable onPress={() => {
                    // Prefer user.id (UUID, always URL-safe) over username.
                    // Right after signup the client may still hold an email-derived
                    // fallback like `jack+minds+1` which 404s when looked up by
                    // username. The profile route falls back to ID lookup if
                    // getByUsername fails, so passing the UUID always resolves.
                    const slug = user?.id || user?.username;
                    router.push(slug ? `/${slug}` as any : '/profile');
                  }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" color={colors.text}>Complete your profile</Text>
                      <Text variant="caption" color={colors.textMuted}>Add a photo and bio so people can find you</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={dismissNudge} hitSlop={12}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={() => router.push('/(tabs)/create')}
                accessibilityRole="button"
                accessibilityLabel="Create a post"
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Avatar uri={user?.image} name={user?.name} size="sm" />
                <Text variant="body" color={colors.textMuted}>What's on your mind?</Text>
              </Pressable>
            </>
          }
          // Explicit RefreshControl in Minds gold — the default spinner was
          // near-invisible on the dark background, so a pull looked dead.
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              // recurate = the NON-silent refresh (sets `refreshing`) — the
              // silent refresh() never flips the state the spinner binds to,
              // so the pull showed nothing at all.
              onRefresh={() => { haptics.tap(); recurate(); }}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
          // onEndReached fires repeatedly per scroll gesture (RN quirk), which
          // rapid-loaded many pages at once and made the feed jump. Gate it to
          // ONE loadMore per delivered page — see the re-arming effect above.
          //
          // This used to re-arm ONLY here, on momentum. React Native Web does
          // not emit momentum for a wheel or trackpad, so on web the gate shut
          // after the first page and infinite scroll never fired again. Kept
          // for native responsiveness; the page-landed effect is what makes it
          // work on both.
          onMomentumScrollBegin={() => { canLoadMoreRef.current = true; }}
          onEndReached={() => {
            if (canLoadMoreRef.current) {
              canLoadMoreRef.current = false;
              loadMore();
            }
          }}
          // Prefetch the next page ~2 viewport-heights before the bottom (X's
          // approach) so the row is already loaded by the time the reader gets
          // there and scrolling never stalls at a page boundary. Was 0.4 (fired
          // only near the very end, leaving a visible spinner gap). The momentum
          // guard above still caps it to one loadMore per gesture, and usePosts'
          // loadMore no-ops while a fetch is in flight, so this never double-fetches.
          onEndReachedThreshold={2}
          ListFooterComponent={
            hasMore && posts.length > 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : posts.length > 0 ? (
              <View style={{ padding: spacing['3xl'], alignItems: 'center' }}>
                <Text variant="caption" color={colors.textMuted}>You're all caught up</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            // While the feed is loading the first time, show post-shaped
            // skeletons (not a centered spinner). Spinner-replacing-list
            // looks broken; skeleton makes it feel like content is on
            // the way. Empty-state hero only renders once loading is
            // done AND the result is genuinely empty.
            postsLoading ? (
              <FeedSkeletons count={4} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
                <Ionicons name={activeTab === 'foryou' || activeTab === 'following' ? 'people-outline' : 'newspaper-outline'} size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">
                  {activeTab === 'foryou' ? 'Build your feed' : activeTab === 'following' ? 'Nothing here yet' : 'No posts yet'}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  {activeTab === 'foryou'
                    ? 'Follow people and explore communities to fill your feed with great posts.'
                    : activeTab === 'following'
                      ? 'Follow people to see their posts here.'
                      : 'Be the first to post.'}
                </Text>
                <View style={{ alignSelf: 'center' }}>
                  {activeTab === 'foryou' || activeTab === 'following' ? (
                    <Button onPress={() => router.push('/(tabs)/discover')} size="sm">Discover people</Button>
                  ) : (
                    <Button onPress={() => router.push('/(tabs)/create')} size="sm">Write a post</Button>
                  )}
                </View>
              </View>
            )
          }
          // Show the scrollbar on web. Hiding it is right on touch, where there is no
          // pointer and the gesture is obvious, and wrong on desktop: without it there is
          // no indication the page scrolls or how far through the feed you are.
          showsVerticalScrollIndicator={Platform.OS === 'web'}
        />
      )}
    </>
  );

  const feedTabsRow = (
    <FeedTabs active={activeTab} onChange={setActiveTab} unread={freshCounts} />
  );

  return (
    <Container safeTop padded={false} maxWidth={isDesktopWeb ? undefined : 600}>
      {isDesktopWeb ? <Header /> : (
        <Animated.View style={headerStyle}>
          <Header />
        </Animated.View>
      )}
      {isDesktopWeb ? (
        // X/Bluesky desktop: [timeline (≤600) | rail (340)] filling the content
        // column. The whole nav + content group is centered by the app shell.
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View style={{ flex: 1, maxWidth: 600, minWidth: 0 }}>
            {feedTabsRow}
            <View style={{ flex: 1 }}>{feedContent}</View>
          </View>
          <View style={{ width: spacing.xl }} />
          <View style={{ width: 340 }}>
            {postsLoading ? (
              // Paint the sidebar's own shape rather than a spinner over a
              // sentence. The swap to real cards is then a fill, not a lurch.
              <FeedSidebarSkeleton />
            ) : (
              <FeedSidebar feedPosts={activeTab === 'foryou' ? posts : sidebarForYouPostsRef.current} />
            )}
          </View>
        </View>
      ) : (
        <>
          {feedTabsRow}
          <GestureDetector gesture={swipeGesture}>
            <View
              style={{ flex: 1, overflow: 'hidden' }}
              onLayout={(e) => { pagerWidthRef.current = e.nativeEvent.layout.width; }}
            >
              <Animated.View style={[{ flex: 1 }, pagerStyle]}>{feedContent}</Animated.View>
              {dragging && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute', top: 0, bottom: 0, width: '100%',
                      left: activeTab === 'foryou' ? '100%' : '-100%',
                      backgroundColor: colors.bg,
                    },
                    previewLeftStyle,
                  ]}
                >
                  {previewPosts.map((p: any) => (
                    <PostCard key={p.id} post={p} compact />
                  ))}
                </Animated.View>
              )}
            </View>
          </GestureDetector>
        </>
      )}

      {/* Floating compose button removed — the pill nav's bottom-center
          Create tab covers it; two + buttons stacked was redundant. */}
    </Container>
  );
}

// #187: contain a crash to this screen so the tab bar and navigation survive.
// expo-router renders this instead of the route when it throws.
export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
