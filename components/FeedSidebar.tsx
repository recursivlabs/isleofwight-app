import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { LinkPressable } from './LinkPressable';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Card } from './Card';
import { Avatar } from './Avatar';
import { Badge, getBadges } from './Badge';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { useForYouTop, useCommunities, useProfiles, useProfileLeaderboard, useAgents, useFollowingIds, useTodayEdition, useRelatedProfiles, useGroupMembers, useRelatedGroups } from '../lib/hooks';
import { formatTimestamp } from '../lib/time';
import { isJunkCreator } from '../lib/quality';
import { communityDescription, isSelfProfile, profileFollowerCount, postScore, postReplyCount, postRepostCount } from '../lib/models';
import { engagementScore, cardLabel, postTitle, postThumb, dedupePosts, communityActivity, agentPopularity } from '../lib/discover';
import { computeTrends } from '../lib/trends';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { afterFollowChange } from '../lib/follows';

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

// Exclude AI agents (they have their own section) and simulator/QA/parody bot
// accounts from the human "Channels" rail — those test accounts post/engage a
// lot and used to dominate it.

// Advances once per sidebar mount so the recommendation window rotates on
// navigation / refresh (not just on a timer). Module-scoped so it persists
// across mounts within a session.
let sidebarRotSeed = 0;

function SidebarSection({ title, icon, children, onSeeAll }: {
  title: string;
  icon: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
}) {
  const colors = useColors();
  return (
    <Card style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        {/* The whole title (icon + label) deep-links into the matching Discover
            feed — not just the "See all" affordance — so the header reads as a
            real window into discovery. */}
        <Pressable
          onPress={onSeeAll}
          disabled={!onSeeAll}
          hitSlop={8}
          accessibilityRole={onSeeAll ? 'link' : undefined}
          accessibilityLabel={onSeeAll ? title : undefined}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, ...(onSeeAll && Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) }}
        >
          <Ionicons name={icon as any} size={15} color={colors.accent} />
          <Text variant="label" style={{ fontSize: 13 }}>{title}</Text>
        </Pressable>
        {onSeeAll && (
          <Pressable
            onPress={onSeeAll}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel={`See all ${title}`}
            style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}
          >
            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>See all</Text>
          </Pressable>
        )}
      </View>
      {children}
    </Card>
  );
}

function SidebarItem({ avatar, name, subtitle, description, onPress, badge, isAgent, action, user }: {
  avatar?: string | null;
  name: string;
  subtitle?: string;
  description?: string;
  onPress: () => void;
  badge?: string;
  // Full user row, so the item can render tier badges (Minds+/Pro/Founder).
  user?: any;
  isAgent?: boolean;
  // One-tap CTA on the right (follow a creator, join a community, message an
  // agent). `active` flips the affordance to a confirmed/done state.
  action?: { icon: string; onPress: () => void; active?: boolean; label: string };
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="link"
        accessibilityLabel={`View ${name}`}
        style={({ pressed, hovered }: any) => ({
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          paddingVertical: spacing.sm, borderRadius: radius.sm,
          backgroundColor: hovered ? colors.glass : 'transparent',
          opacity: pressed ? 0.7 : 1,
          ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
        })}
      >
        <Avatar uri={avatar} name={name} size="sm" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text variant="body" numberOfLines={1} style={{ fontSize: 15, flexShrink: 1 }}>{name}</Text>
            {user && getBadges(user).map((b) => <Badge key={b} type={b} size="sm" />)}
            {/* Agents are ALWAYS labeled (AI-transparency commitment). The Trending
                Agents widget passes `isAgent` without a user row, so render the
                square AI badge here directly. */}
            {isAgent && <Badge type="agent" size="sm" />}
            {badge && (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: radius.sm }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 9 }}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle ? <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13 }}>{subtitle}</Text> : null}
          {description ? <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ fontSize: 13, marginTop: 1, lineHeight: 17 }}>{description}</Text> : null}
        </View>
      </Pressable>
      {action && (
        <Pressable
          onPress={action.onPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ selected: !!action.active }}
          {...(Platform.OS === 'web' ? { 'aria-pressed': !!action.active } as any : {})}
          style={({ pressed }: any) => ({
            width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
            backgroundColor: action.active ? colors.accentMuted : colors.surface,
            borderWidth: 0.5, borderColor: action.active ? colors.accent : colors.borderSubtle,
            opacity: pressed ? 0.6 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Ionicons name={action.icon as any} size={15} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

// Which page the rail is on — used to reorder the widgets so the most relevant
// "next step" leads. The rail shows the same 4 discovery widgets everywhere, but
// context decides which one is on top (e.g. a community page leads with more
// communities; a profile leads with more creators to follow).
export type SidebarContext = 'feed' | 'discover' | 'profile' | 'community' | 'communities' | 'wallet' | 'notifications';

export function FeedSidebar({ context = 'feed', feedPosts, relatedTo, group }: {
  context?: SidebarContext;
  feedPosts?: any[];
  relatedTo?: { id: string };
  /** The group on screen: its rail leads with the people in it. */
  group?: { id: string; name?: string; privacy?: string; isMember?: boolean; memberCount?: number };
} = {}) {
  const router = useRouter();
  const colors = useColors();
  const { sdk, user } = useAuth();
  // A profile rail is about the channel on screen: co-followed accounts first.
  const relatedChannels = useRelatedProfiles(relatedTo?.id, 5);
  // A group rail is about the group on screen: its people first. A private
  // group shows them to members only; a public one to anyone signed in.
  const canSeeMembers = !!group && (group.privacy === 'public' || !!group.isMember);
  const { members: groupMembers } = useGroupMembers(group?.id, canSeeMembers, 8);
  // Groups related to this one, by shared members; trending is the fallback.
  const relatedGroups = useRelatedGroups(group?.id, 5);
  // Tier-aware upsell (X-style): free → sell Plus, Plus → sell Pro, Pro → a
  // "you're on Pro" reminder. The card always upsells the NEXT tier up.
  const currentTier: 'free' | 'plus' | 'pro' =
    (user?.pro || (user as any)?.is_pro) ? 'pro' : (user?.plus || (user as any)?.is_plus) ? 'plus' : 'free';
  const nextTier = currentTier === 'free' ? 'Plus' : currentTier === 'plus' ? 'Pro' : null;
  // The viewer's real follow graph — so the CTA shows "following" for people you
  // already follow instead of a misleading "+".
  const { followingIds } = useFollowingIds();

  // Override maps: id -> desired state. Seeded from the real follow graph /
  // community membership; a tap writes the toggled state optimistically and
  // reverts on failure.
  const [followOverride, setFollowOverride] = React.useState<Map<string, boolean>>(new Map());
  const [joinOverride, setJoinOverride] = React.useState<Map<string, boolean>>(new Map());
  // Accepts a user row or a bare id. Priority: optimistic override → the row's
  // own server is_following flag (reliable, not subject to the 100-cap on the
  // following-list fetch) → the following-graph set as a last-resort fallback.
  const isFollowing = (u: any) => {
    const id = typeof u === 'string' ? u : u?.id;
    if (followOverride.has(id)) return !!followOverride.get(id);
    const flag = typeof u === 'object' ? (u?.is_following ?? u?.isFollowing) : undefined;
    if (flag != null) return !!flag;
    return followingIds?.has(id) ?? false;
  };
  const isJoined = (c: any) => joinOverride.has(c.id) ? !!joinOverride.get(c.id) : !!(c.is_member ?? c.isMember);
  const toggleFollow = React.useCallback((id: string, currently: boolean) => {
    if (!sdk || id === user?.id) return;
    const next = !currently;
    setFollowOverride((p) => new Map(p).set(id, next));
    Promise.resolve(next ? sdk.profiles.follow(id) : sdk.profiles.unfollow(id))
      .then(() => afterFollowChange())
      .catch(() => setFollowOverride((p) => new Map(p).set(id, currently)));
  }, [sdk, user?.id]);
  const toggleJoin = React.useCallback((id: string, currently: boolean) => {
    if (!sdk) return;
    const next = !currently;
    setJoinOverride((p) => new Map(p).set(id, next));
    Promise.resolve(next ? (sdk as any).communities.join(id) : (sdk as any).communities.leave(id))
      .catch(() => setJoinOverride((p) => new Map(p).set(id, currently)));
  }, [sdk]);
  // The sidebar is a mini-version of the same engagement-quality system as the
  // Feed's For You and the Discover tabs — every widget reuses the SAME hook +
  // ranking the corresponding Discover tab uses, so "popular" means one thing
  // everywhere. We fetch a real pool (not 5) so the client-side ranking has
  // something to choose from, then take the top 5.

  // Posts → useTrendingPosts: fetches the engagement-ranked (score) list, which
  // is robust to the simulator flooding recent posts with 0-engagement spam
  // (that polluted the recency/hot pool and left the rail full of "0 pts", no-
  // media junk). We re-rank the pool by engagementScore client-side so the rail
  // leads with posts that actually earned reach.
  // The desktop feed already has a personalized page in memory. Reuse it for
  // trends and creator fallbacks instead of launching a second full For You
  // ranking (the old rail requested 40 posts while the timeline requested 20).
  // Other pages still fetch their own pool because they do not own feed data.
  const { posts: fetchedTopPosts } = useForYouTop(40, feedPosts === undefined);
  const posts = feedPosts ?? fetchedTopPosts;
  // Today on Minds drives the rail's lead section. The old "Trending Posts"
  // widget was an all-time engagement leaderboard with no time signal at all, so
  // it could only ever read as "old things that scored well" — three competing
  // stat numbers per row and nothing telling you anything happened recently.
  // The edition already groups REAL posts under an editorial headline, and it
  // regenerates daily, so it is the better source for a rail whose whole job is
  // to say people are here and something is happening now.
  // The daily edition is scoped to the whole network on the server, so it
  // would show another app's posts here. Off until the server scopes it.
  const todayEdition: any = null;
  // Creators → the server-ranked FOLLOWER leaderboard (real reach, the People
  // tab's authoritative top-N), hydrated with directory identity and filtered of
  // AI/bot accounts. The old post-count sort let simulator/parody accounts win.
  const { profiles } = useProfiles(120);
  const { entries: creatorBoard } = useProfileLeaderboard(100, 'engagement');
  // Communities → members + recent activity (members + posts*2): the Communities
  // tab's "Most active" sort.
  const { communities } = useCommunities(60);
  // Agents → "Popular": native featured order lifted by any usage signal.
  const { agents } = useAgents(40);

  const profileById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles || []) if (p?.id) m.set(p.id, p);
    return m;
  }, [profiles]);

  // FRESHNESS: rotate which slice of each ranked pool is shown so the rail
  // evolves instead of showing the same five forever. Primarily driven by
  // NAVIGATION — each mount advances the shared seed, so moving between pages
  // (or a refresh) surfaces new recommendations. A slow 3-min tick is a gentle
  // fallback for someone who lingers on one page. Never shuffles under the cursor.
  const [rot, setRot] = React.useState(() => ++sidebarRotSeed);
  React.useEffect(() => {
    const id = setInterval(() => setRot((r) => r + 1), 180000);
    return () => clearInterval(id);
  }, []);
  const rotateWindow = React.useCallback(<T,>(arr: T[], size: number): T[] => {
    if (arr.length <= size) return arr.slice(0, size);
    const off = (rot * size) % arr.length;
    return [...arr.slice(off), ...arr.slice(0, off)].slice(0, size);
  }, [rot]);

  // POSTS: hot-rank, dedup, then keep AT MOST ONE post per author so a single
  // prolific poster can't fill the entire rail (the "5 posts from one account"
  // problem). Fall back to raw order if hot-ranking collapses on a legacy corpus.
  const pool = posts || [];
  // Rank by real engagement (votes + replies + media), highest first, so the
  // rail leads with posts that earned reach — not whatever is newest.
  const rankedPosts = dedupePosts([...pool].sort((a: any, b: any) => engagementScore(b) - engagementScore(a)));
  // FRESHNESS: rotate the ranked pool by the shared seed so posts evolve like the
  // other rail sections do. This section alone ignored the rotation and showed the
  // same top five forever — the "stale constantly" complaint. Still all
  // engagement-ranked good content, just a rotating window over the top pool.
  const postSource = rankedPosts.length >= 3 ? rankedPosts : dedupePosts([...pool]);
  const rotatedPosts = postSource.length <= 5
    ? postSource
    : (() => { const off = (rot * 5) % postSource.length; return [...postSource.slice(off), ...postSource.slice(0, off)]; })();
  const trending: any[] = [];
  const seenAuthors = new Set<string>();
  for (const p of rotatedPosts) {
    const aid = String(p?.author?.id || p?.author?.username || p?.owner_guid || p?.ownerGuid || '');
    if (aid && seenAuthors.has(aid)) continue;
    if (aid) seenAuthors.add(aid);
    trending.push(p);
    if (trending.length >= 5) break;
  }

  // CREATORS: present the follower board's exact order (already ranked, real
  // counts), hydrated with directory bio/identity, minus AI/bot/test accounts.
  const rankedPeople = ((creatorBoard || []).length
    ? (creatorBoard || []).map((row: any) => { const p = profileById.get(row?.id); return p ? { ...p, ...row } : row; })
    : [...(profiles || [])])
    .filter((u: any) => !isJunkCreator(u))
    .filter((u: any) => !isSelfProfile(u, user))
    // The official @minds channel is the network's own account, not a creator to
    // follow — keep it out of the human Creators rail.
    .filter((u: any) => (u?.username || '').toLowerCase() !== 'minds');
  // Rotate through the top ~96 creators, but only ones with a real bio/
  // description — keeps the rail full + varied without surfacing empty-profile
  // accounts.
  // Prefer creators with a real bio, but NEVER let that empty the rail — on the
  // relaunch corpus most profiles have no bio yet, which hid "Trending Channels"
  // entirely. Fall back to the full ranked list when the bio-filtered pool is thin.
  // Prefer channels that carry SOME context to click on — a bio, or at least a
  // real follower count the row already shows. A nameless, zero-follower, no-bio
  // account ("Rolf Oldejans" with nothing under it) is exactly what nobody taps,
  // so it sinks below anyone with a reason to click.
  const withContext = rankedPeople
    .filter((u: any) => ((u?.bio || u?.description || u?.briefdescription || '') as string).trim().length > 0 || profileFollowerCount(u) > 0);
  // Last-resort pool: the authors of the trending posts. On a thin relaunch
  // corpus the follower leaderboard + directory can both come back empty, which
  // hid "Trending Channels" entirely. Real post authors are always present, so
  // the widget never blanks.
  const authorsFromPosts: any[] = [];
  {
    const seen = new Set<string>();
    for (const p of pool) {
      const a = p?.author;
      const id = a && String(a.id || a.username || '');
      if (a && id && !seen.has(id) && !isJunkCreator(a) && !isSelfProfile(a, user) && (a.username || '').toLowerCase() !== 'minds') {
        seen.add(id);
        authorsFromPosts.push(a);
      }
    }
  }
  const creatorPool = (withContext.length >= 5 ? withContext : rankedPeople.length ? rankedPeople : authorsFromPosts).slice(0, 96);
  const topPeople = rotateWindow(creatorPool, 5);
  const rankedCommunities = [...(relatedGroups.length ? relatedGroups : (communities || []))]
    .filter((c: any) => !group || c.id !== group.id)
    .sort((a: any, b: any) => communityActivity(b) - communityActivity(a));
  const topCommunities = rotateWindow(rankedCommunities, 5);
  const rankedAgents = (agents || [])
    .filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id))
    .sort((a: any, b: any) => agentPopularity(b) - agentPopularity(a));
  const visibleAgents = rotateWindow(rankedAgents, 5);

  // "What's happening" — emergent topics from the community signal (hashtags +
  // shared links people are actually posting), ranked by distinct-people ×
  // velocity so it reads as a live conversation, not one loud account.
  const trends = React.useMemo(() => computeTrends(pool, 5), [pool]);

  // The discovery widgets. Rendered in a context-dependent order so the most
  // relevant "next step" leads on each page (below).
  const sections: Record<string, React.ReactNode> = {
    whatsHappening: trends.length >= 2 ? (
      <SidebarSection
        title="Trending on Isle of Wight Social"
        icon="pulse-outline"
        onSeeAll={() => router.push('/(tabs)/discover' as any)}
      >
        {trends.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => router.push(t.href as any)}
            accessibilityRole="link"
            accessibilityLabel={`Open trend: ${t.label}`}
            style={({ hovered }: any) => ({
              paddingVertical: spacing.md - 2,
              marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm,
              backgroundColor: hovered ? colors.glass : 'transparent',
              gap: 4,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
            })}
          >
            {/* Eyebrow: the topic tag people are gathering under. */}
            <Text variant="caption" color={colors.accent} style={{ fontSize: 11.5, fontFamily: 'Roboto-Medium', letterSpacing: 0.3, textTransform: 'uppercase' }} numberOfLines={1}>
              Trending{t.type === 'topic' ? ` · ${t.label}` : ` · ${t.label}`}
            </Text>
            {/* The story: a real line from the top post (falls back to the topic). */}
            <Text variant="body" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20, fontFamily: 'Roboto-Medium' }}>
              {t.preview || t.label}
            </Text>
            {/* Stacked avatars + how many people are in it. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 1 }}>
              {t.avatars.length > 0 && (
                <View style={{ flexDirection: 'row' }}>
                  {t.avatars.slice(0, 3).map((a, i) => (
                    <View key={i} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 1.5, borderColor: colors.bg, borderRadius: 999 }}>
                      <Avatar uri={a} name="" size="xs" />
                    </View>
                  ))}
                </View>
              )}
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13 }}>
                {t.authorCount.toLocaleString()} {t.authorCount === 1 ? 'person' : 'people'} discussing
              </Text>
            </View>
          </Pressable>
        ))}
      </SidebarSection>
    ) : null,
    posts: (() => {
      // "Today on Minds", not an all-time engagement leaderboard.
      //
      // The previous widget rendered title + author + "↑129 · 7 replies · 16
      // reminds" + a 44px thumb, ranked by all-time engagement. Three competing
      // numbers per row, and NOTHING anywhere saying when any of it happened —
      // so the rail could only read as "old posts that scored well", which is
      // the opposite of what a discovery rail is for.
      //
      // This renders the daily curated edition instead: an editorial headline
      // (a reason to care), the faces of the people in that conversation
      // (somebody is here), and how recently it moved (it is happening now).
      // The stat triple is gone; presence and recency replace it.
      const stories = (todayEdition?.stories || []).filter((s: any) => (s?.posts || []).length > 0);
      if (stories.length === 0) return null;
      return (
        <SidebarSection
          title="Today on the island"
          icon="flame-outline"
          onSeeAll={() => router.push('/(tabs)/discover' as any)}
        >
          {stories.slice(0, 4).map((story: any) => {
            const storyPosts = story.posts || [];
            // Unique humans in the conversation — the "people are here" signal.
            const seen = new Set<string>();
            const faces: any[] = [];
            for (const sp of storyPosts) {
              const a = sp?.author;
              if (!a?.id || seen.has(a.id)) continue;
              seen.add(a.id);
              faces.push(a);
            }
            const newest = storyPosts
              .map((sp: any) => sp?.created_at || sp?.createdAt)
              .filter(Boolean)
              .sort()
              .pop();
            const lead = storyPosts.find((sp: any) => postThumb(sp)?.url);
            const thumb = lead ? postThumb(lead) : { url: null, hasVideo: false };
            return (
              <Pressable
                key={story.id}
                onPress={() => router.push(`/post/${storyPosts[0].id}` as any)}
                accessibilityRole="link"
                accessibilityLabel={`Open story: ${story.headline}`}
                style={({ pressed, hovered }: any) => ({
                  paddingVertical: spacing.sm,
                  marginHorizontal: -spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.sm,
                  backgroundColor: hovered ? colors.glass : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {story.kicker ? (
                      <Text
                        variant="caption"
                        color={colors.accent}
                        numberOfLines={1}
                        style={{ fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: 'Roboto-Medium' }}
                      >
                        {story.kicker}
                      </Text>
                    ) : null}
                    <Text variant="body" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20, marginTop: 2 }}>
                      {story.headline}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      {/* Overlapping faces: presence, not a stat. */}
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {faces.slice(0, 3).map((a: any, i: number) => (
                          <View key={a.id} style={{ marginLeft: i === 0 ? 0 : -7, borderRadius: 999, borderWidth: 1.5, borderColor: colors.bg }}>
                            <Avatar uri={a.image} name={a.name || ''} size="xs" />
                          </View>
                        ))}
                      </View>
                      <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 12.5, flexShrink: 1 }}>
                        {faces.length > 0
                          ? `${faces.length.toLocaleString()} ${faces.length === 1 ? 'person' : 'people'}`
                          : `${storyPosts.length} posts`}
                        {newest ? `  ·  ${formatTimestamp(newest)}` : ''}
                      </Text>
                    </View>
                  </View>
                  {thumb.url ? (
                    <View style={{ width: 52, height: 52, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.surface }}>
                      <Image source={{ uri: thumb.url }} style={{ width: 52, height: 52 }} contentFit="cover" transition={120} />
                      {thumb.hasVideo && (
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
                          <Ionicons name="play" size={16} color="#fff" />
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </SidebarSection>
      );
    })(),
    members: group && groupMembers.length > 0 ? (
      <SidebarSection
        title="Members"
        icon="people-outline"
        onSeeAll={() => router.push(`/community/manage/${group.id}` as any)}
      >
        {groupMembers.map((u: any) => {
          const role = u.role === 'owner' ? 'Owner' : u.role === 'admin' ? 'Admin' : u.role === 'moderator' ? 'Moderator' : '';
          return (
            <SidebarItem
              key={u.id}
              user={u}
              avatar={u.image}
              name={u.name || u.username || 'Member'}
              subtitle={u.username ? `@${u.username}` : undefined}
              badge={role || undefined}
              onPress={() => router.push(`/${u.username || u.id}` as any)}
            />
          );
        })}
      </SidebarSection>
    ) : null,
    related: relatedChannels.length > 0 ? (
      <SidebarSection
        title="Related Channels"
        icon="people-circle-outline"
        onSeeAll={() => router.push('/(tabs)/discover/people?sort=followers' as any)}
      >
        {relatedChannels.map((u: any) => {
          const followers = profileFollowerCount(u);
          return (
            <SidebarItem
              key={u.id}
              user={u}
              avatar={u.image}
              name={u.name || 'User'}
              subtitle={followers > 0
                ? `${followers.toLocaleString()} ${followers === 1 ? 'follower' : 'followers'}`
                : (u.username ? `@${u.username}` : undefined)}
              description={u.bio || u.description}
              onPress={() => router.push(`/${u.username || u.id}` as any)}
              action={{ icon: isFollowing(u) ? 'checkmark' : 'add', active: isFollowing(u), label: isFollowing(u) ? 'Following' : 'Follow', onPress: () => toggleFollow(u.id, isFollowing(u)) }}
            />
          );
        })}
      </SidebarSection>
    ) : null,
    creators: topPeople.length > 0 ? (
      <SidebarSection
        title="Trending Channels"
        icon="person-outline"
        onSeeAll={() => router.push('/(tabs)/discover/people?sort=followers' as any)}
      >
        {topPeople.map((u: any) => {
          const followers = profileFollowerCount(u);
          return (
            <SidebarItem
              key={u.id}
              user={u}
              avatar={u.image}
              name={u.name || 'User'}
              subtitle={followers > 0
                ? `${followers.toLocaleString()} ${followers === 1 ? 'follower' : 'followers'}`
                : (u.username ? `@${u.username}` : undefined)}
              description={u.bio || u.description}
              onPress={() => router.push(`/${u.username || u.id}` as any)}
              action={{ icon: isFollowing(u) ? 'checkmark' : 'add', active: isFollowing(u), label: isFollowing(u) ? 'Following' : 'Follow', onPress: () => toggleFollow(u.id, isFollowing(u)) }}
            />
          );
        })}
      </SidebarSection>
    ) : null,
    communities: topCommunities.length > 0 ? (
      <SidebarSection
        title={group ? (relatedGroups.length ? 'Related groups' : 'More groups') : 'Trending Groups'}
        icon="people-outline"
        onSeeAll={() => router.push('/(tabs)/discover/communities' as any)}
      >
        {topCommunities.map((c: any) => (
          <SidebarItem
            key={c.id}
            avatar={c.image}
            name={c.name || 'Group'}
            subtitle={`${(c.memberCount || c.member_count || 0).toLocaleString()} ${(c.memberCount || c.member_count || 0) === 1 ? 'member' : 'members'}`}
            description={communityDescription(c)}
            onPress={() => router.push(`/community/${c.id}` as any)}
            action={{ icon: isJoined(c) ? 'checkmark' : 'add', active: isJoined(c), label: isJoined(c) ? 'Joined' : 'Join', onPress: () => toggleJoin(c.id, isJoined(c)) }}
          />
        ))}
      </SidebarSection>
    ) : null,
    agents: false && visibleAgents.length > 0 ? (
      <SidebarSection
        title="Trending Agents"
        icon="hardware-chip-outline"
        onSeeAll={() => router.push('/(tabs)/discover/agents' as any)}
      >
        {visibleAgents.map((a: any) => (
          <SidebarItem
            key={a.id}
            avatar={a.image || a.avatar}
            name={a.name || 'Agent'}
            description={a.bio || a.description}
            isAgent
            onPress={() => router.push(`/${a.username || a.id}` as any)}
            action={{ icon: isFollowing(a) ? 'checkmark' : 'add', active: isFollowing(a), label: isFollowing(a) ? 'Following' : 'Follow', onPress: () => toggleFollow(a.id, isFollowing(a)) }}
          />
        ))}
      </SidebarSection>
    ) : null,
  };

  // KISS: TWO widgets per rail, not five. One content signal (real trending
  // posts) + one people signal (who to follow), both quality-filtered. The weak
  // topic-extraction "What's happening" and the niche Agents/Groups widgets are
  // dropped — less, but each one is good. Content and people are what matter.
  const ORDERS: Record<SidebarContext, string[]> = {
    feed: ['whatsHappening', 'posts', 'creators'],
    discover: ['whatsHappening', 'posts', 'creators'],
    notifications: ['whatsHappening', 'posts', 'creators'],
    profile: ['creators', 'posts'],
    community: ['communities', 'creators'],
    communities: ['communities', 'creators'],
    wallet: ['posts', 'creators'],
  };
  // A profile leads with channels related to it; trending is the fallback when
  // the graph has nothing to say (or the API does not serve the route yet).
  const sectionOrder = context === 'profile' && relatedChannels.length > 0
    ? ['related', 'posts']
    : context === 'community' && group
      ? ['members', 'communities']
      : (ORDERS[context] || ORDERS.feed);

  return (
    <ScrollView
      style={{
        width: '100%' as any,
        ...(Platform.OS === 'web'
          ? { position: 'sticky' as any, top: 0, maxHeight: '100vh' as any }
          : {}),
      }}
      contentContainerStyle={{
        gap: spacing.lg,
        paddingBottom: spacing['4xl'],
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Search — opens the global Cmd+K command palette. Sits at the top of
         the right rail like X, so discovery lives with the trends column. */}
      {Platform.OS === 'web' && (
        <Pressable
          onPress={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Search anywhere"
          style={({ pressed, hovered }: any) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm + 2,
            paddingHorizontal: spacing.md,
            borderRadius: radius.full,
            backgroundColor: pressed || hovered ? colors.surfaceHover : colors.surface,
            borderWidth: 0.5,
            borderColor: colors.borderSubtle,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
          })}
        >
          <Ionicons name="search" size={15} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }}>Search anywhere</Text>
          <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.xs, borderWidth: 0.5, borderColor: colors.borderSubtle }}>
            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>⌘K</Text>
          </View>
        </Pressable>
      )}

      {/* Upgrade card — X sells Premium at the top of the rail; more room here
          than the nav item for a real pitch. Tier-aware: upsell the next tier. */}
      {false && nextTier ? (
        <Card style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }}>
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="star" size={18} color={colors.accent} />
              <Text variant="h3" style={{ fontSize: 17 }}>Upgrade to {nextTier}</Text>
            </View>
            <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 20 }}>
              {currentTier === 'plus'
                ? 'Go further with Pro: the biggest reach, full AI, voice mode and API access. You already have Plus — this is the next level.'
                : 'Bigger reach, no ads, more AI, and priority everywhere. Back the free and open internet, and get more out of Minds.'}
            </Text>
            <LinkPressable
              href="/upgrade"
              accessibilityLabel={currentTier === 'free' ? 'See Plus and Pro plans' : `Upgrade to ${nextTier}`}
              style={({ pressed, hovered }) => ({
                marginTop: spacing.xs,
                alignSelf: 'flex-start',
                backgroundColor: (pressed || hovered) ? colors.accentHover : colors.accent,
                paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
                borderRadius: radius.full,
                ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
              })}
            >
              <Text variant="body" color={colors.textInverse} style={{ fontFamily: 'Roboto-Medium', fontSize: 14 }}>
                {currentTier === 'free' ? 'See Plus & Pro' : `Upgrade to ${nextTier}`}
              </Text>
            </LinkPressable>
          </View>
        </Card>
      ) : null}

      {sectionOrder.map((key) => (
        <React.Fragment key={key}>{sections[key]}</React.Fragment>
      ))}
    </ScrollView>
  );
}
