import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { ListRowSkeletons } from './ListRowSkeleton';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { useTags, useTodayEdition, useForYouTop, useProfiles, useProfileLeaderboard, useCommunities, useFollowingIds } from '../lib/hooks';
import { filterJunkCreators } from '../lib/quality';
import { communityDescription, isSelfProfile, profileFollowerCount, postScore } from '../lib/models';
import { formatCount, engagementScore, postThumb } from '../lib/discover';
import { afterFollowChange } from '../lib/follows';
import { spacing, radius, CTA } from '../constants/theme';
import { useColors } from '../lib/theme';

// ──────────────────────────────────────────────────────────────────────────
// Discover explore surface. Two states, no entity tabs:
//   • no query  → the landing: trending topics, top on Minds today, people +
//                 groups to follow. The search empty-state.
//   • query     → ONE blended, ranked result list. People / groups / posts
//                 mixed by relevance; type is a small label, every row an
//                 action (Follow / Join / open). Never a dead end.
// (Live + AI-curated "stories" plug in here once the curator engine ships.)
// ──────────────────────────────────────────────────────────────────────────

const GoldPill = React.memo(function GoldPill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={(e: any) => { e?.stopPropagation?.(); onPress(); }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      {...(Platform.OS === 'web' ? { 'aria-pressed': !!active } as any : {})}
      style={({ pressed }: any) => ({
        paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full,
        backgroundColor: active ? 'transparent' : CTA.solid,
        borderWidth: active ? 1 : 0, borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Text variant="caption" style={{ fontFamily: 'Roboto-Bold', fontSize: 13, color: active ? colors.textSecondary : CTA.ink }}>{label}</Text>
    </Pressable>
  );
});

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.sm }}>
      <Text variant="label" style={{ fontSize: 17, fontFamily: 'Roboto-Bold' }}>{title}</Text>
      {onSeeAll && (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          accessibilityRole="link"
          accessibilityLabel={`See all ${title}`}
          style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}
        >
          <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13 }}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

// Web hover is CSS-driven (see lib/webStyles.ts `[data-hover-row]`), so hovering
// a row triggers NO React re-render. Native keeps the function-style Pressable.
const IS_WEB = Platform.OS === 'web';
const ROW_HOVER_WEB_PROPS = IS_WEB ? { dataSet: { hoverRow: '' } } : {};

// One blended result / suggestion row. `kind` sets the label + action.
//
// React.memo + the `item`+handler shape keep this row from re-rendering when a
// SIBLING row hovers or the parent re-renders (its data hooks resolve a few
// times on mount): the display props are value-stable strings, `item` is stable
// across renders (from a memoized list), and `onOpen`/`onAction` are stable
// callbacks. So scrolling/hovering one row no longer re-renders the whole list.
const Row = React.memo(function Row({ kind, item, avatar, name, handle, context, thumb, active, onOpen, onAction }: {
  kind: 'person' | 'group' | 'post'; item: any; avatar?: string | null; name: string; handle?: string; context?: string;
  thumb?: string | null; active?: boolean; onOpen: (item: any) => void; onAction?: (item: any) => void;
}) {
  const colors = useColors();
  const label = kind === 'person' ? 'Person' : kind === 'group' ? 'Group' : 'Post';
  const destinationLabel = kind === 'person'
    ? `View profile for ${name}`
    : kind === 'group'
      ? `View group ${name}`
      : `Open post by ${name}${context ? `: ${context}` : ''}`;
  const baseStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
  };
  return (
    <View
      {...ROW_HOVER_WEB_PROPS}
      style={IS_WEB
        ? { ...baseStyle, backgroundColor: 'transparent', cursor: 'pointer' } as any
        : { ...baseStyle, backgroundColor: 'transparent' }}
    >
      <Pressable
        onPress={() => onOpen(item)}
        accessibilityRole="link"
        accessibilityLabel={destinationLabel}
        style={({ pressed }: any) => ({
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          opacity: pressed ? 0.7 : 1,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
        })}
      >
        {kind === 'post'
          ? (thumb
              ? <Image source={{ uri: thumb }} style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface }} contentFit="cover" transition={150} />
              // No media: show WHO posted it, not a filing-cabinet glyph. Avatar
              // falls back to the author's initials, so a text post still reads
              // as something a person wrote.
              : <Avatar uri={avatar} name={name} size="md" />)
          : <Avatar uri={avatar} name={name} size="md" />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="caption" color={colors.textMuted} style={{ fontSize: 12 }}>{label}</Text>
          <Text variant="body" numberOfLines={1} style={{ fontSize: 15, fontFamily: 'Roboto-Medium' }}>{name}</Text>
          {!!context && <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ fontSize: 13, marginTop: 1 }}>{handle ? `${handle} · ${context}` : context}</Text>}
        </View>
        {kind === 'post' && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
      </Pressable>
      {kind === 'person' && onAction && <GoldPill label={active ? 'Following' : 'Follow'} active={active} onPress={() => onAction(item)} />}
      {kind === 'group' && onAction && <GoldPill label={active ? 'Joined' : 'Join'} active={active} onPress={() => onAction(item)} />}
    </View>
  );
});

// Follow/join state shared by landing + results.
function useConnectState() {
  const { sdk, user } = useAuth();
  const { followingIds } = useFollowingIds();
  const [fOverride, setFOverride] = React.useState<Map<string, boolean>>(new Map());
  const [jOverride, setJOverride] = React.useState<Map<string, boolean>>(new Map());
  const isFollowing = (u: any) => fOverride.has(u.id) ? !!fOverride.get(u.id) : !!(u?.is_following ?? u?.isFollowing ?? followingIds?.has(u.id));
  const canFollow = React.useCallback((u: any) => !!u?.id && !isSelfProfile(u, user), [user?.id]);
  const isJoined = (c: any) => jOverride.has(c.id) ? !!jOverride.get(c.id) : !!(c?.is_member ?? c?.isMember);
  // Read the freshest state through refs so the toggle callbacks below can stay
  // referentially STABLE (deps only [sdk]). Stable callbacks let the memoized
  // Row skip re-rendering when the parent re-renders for unrelated reasons.
  const isFollowingRef = React.useRef(isFollowing);
  isFollowingRef.current = isFollowing;
  const isJoinedRef = React.useRef(isJoined);
  isJoinedRef.current = isJoined;
  const toggleFollow = React.useCallback((u: any) => {
    if (!sdk || !canFollow(u)) return; const cur = isFollowingRef.current(u); setFOverride((p) => new Map(p).set(u.id, !cur));
    Promise.resolve(!cur ? sdk.profiles.follow(u.id) : sdk.profiles.unfollow(u.id)).then(() => afterFollowChange()).catch(() => setFOverride((p) => new Map(p).set(u.id, cur)));
  }, [sdk, canFollow]);
  const toggleJoin = React.useCallback((c: any) => {
    if (!sdk) return; const cur = isJoinedRef.current(c); setJOverride((p) => new Map(p).set(c.id, !cur));
    Promise.resolve(!cur ? (sdk as any).communities.join(c.id) : (sdk as any).communities.leave(c.id)).catch(() => setJOverride((p) => new Map(p).set(c.id, cur)));
  }, [sdk]);
  return { isFollowing, isJoined, canFollow, toggleFollow, toggleJoin };
}

function personContext(u: any) {
  const bio = String(u?.bio || u?.description || u?.briefdescription || '').trim();
  if (bio) return bio;
  const f = profileFollowerCount(u);
  return f > 0 ? `${formatCount(f)} followers` : 'New to Minds';
}
function groupContext(c: any) {
  const bio = communityDescription(c);
  const m = (c.member_count || c.memberCount || 0);
  const ms = m > 0 ? `${formatCount(m)} members` : '';
  return bio ? (ms ? `${ms} · ${bio}` : bio) : (ms || 'New group');
}

// ── Blended results (query present) ────────────────────────────────────────
export function DiscoverResults({ q }: { q: string }) {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();
  const conn = useConnectState();
  // Cached directory for INSTANT local matches while the server search resolves.
  const { profiles: directory } = useProfiles(200);
  const [people, setPeople] = React.useState<any[]>([]);
  const [groups, setGroups] = React.useState<any[]>([]);
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!sdk || !q) { setPeople([]); setGroups([]); setPosts([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const lane = (p: Promise<any>, ms = 6000) => Promise.race([p.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);
    const ql = q.toLowerCase();
    // INSTANT: seed people from the cached directory so results paint immediately;
    // the server search below refines/replaces them.
    const localPeople = filterJunkCreators((directory || []).filter((p: any) =>
      (p.username || '').toLowerCase().includes(ql) || (p.name || '').toLowerCase().includes(ql)))
      .filter((u: any) => (u?.username || '').toLowerCase() !== 'minds');
    if (localPeople.length) { setPeople(localPeople); setLoading(false); }
    const run = (attempt: number) => {
      Promise.all([
        lane(sdk.profiles.search({ q, limit: 20, organization_id: ORG_ID || undefined } as any)),
        lane((sdk as any).communities.list({ limit: 50, organization_id: ORG_ID || undefined })),
        lane(sdk.posts.search({ q, limit: 12, organization_id: ORG_ID || undefined } as any)),
      ]).then(([pr, cr, po]: any[]) => {
        if (cancelled) return;
        const ppl = filterJunkCreators((pr?.data || [])).filter((u: any) => (u?.username || '').toLowerCase() !== 'minds');
        const grp = ((cr?.data || []) as any[]).filter((c: any) => (c?.name || '').toLowerCase().includes(ql)).slice(0, 10);
        const pst = ((po?.data || []) as any[]).filter((p: any) => (p?.content || '').trim().length > 0);
        // Hydration race: on a direct load / refresh the session token can attach
        // AFTER the first fire, so every lane comes back empty. Retry once before
        // giving up, keeping the spinner (not "No results") in the meantime.
        if (attempt === 0 && ppl.length === 0 && grp.length === 0 && pst.length === 0) {
          setTimeout(() => { if (!cancelled) run(1); }, 1200);
          return;
        }
        setPeople(ppl); setGroups(grp); setPosts(pst); setLoading(false);
      });
    };
    run(0);
    return () => { cancelled = true; };
  }, [sdk, q]);

  // Blend: exact/prefix name matches lead, then by engagement/relevance, mixed types.
  // "All" results, sectioned by type (People / Groups / Posts) each with See all —
  // the master results page. Within each section, relevance (exact→prefix→
  // contains) then popularity/engagement.
  const ql = q.toLowerCase();
  const rank = (name?: string) => { const n = (name || '').toLowerCase(); return n === ql ? 0 : n.startsWith(ql) ? 1 : n.includes(ql) ? 2 : 3; };
  const sortedPeople = React.useMemo(() => [...people].sort((a, b) => rank(a.name || a.username) - rank(b.name || b.username) || profileFollowerCount(b) - profileFollowerCount(a)), [people, q]);
  const sortedGroups = React.useMemo(() => [...groups].sort((a, b) => rank(a.name) - rank(b.name) || (b.member_count || b.memberCount || 0) - (a.member_count || a.memberCount || 0)), [groups, q]);
  const sortedPosts = React.useMemo(() => [...posts].sort((a, b) => engagementScore(b) - engagementScore(a)), [posts]);
  const total = sortedPeople.length + sortedGroups.length + sortedPosts.length;

  // Stable openers so the memoized Row skips re-render on parent updates.
  const openUser = React.useCallback((u: any) => router.push(`/${u.username || u.id}` as any), [router]);
  const openGroup = React.useCallback((c: any) => router.push(`/community/${c.id}` as any), [router]);
  const openPost = React.useCallback((p: any) => router.push(`/post/${p.id}` as any), [router]);

  // Paint the rows this list is about to show rather than a spinner in the
  // middle of an empty page: the arrival becomes a fill, not a jump.
  if (loading && total === 0) return <ListRowSkeletons count={6} avatarSize={44} />;
  if (total === 0) return (
    <View style={{ padding: spacing['3xl'], alignItems: 'center', gap: spacing.md }}>
      <Ionicons name="search" size={32} color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary}>No results for “{q}”.</Text>
    </View>
  );

  const seeAll = (seg: string) => router.push(`/(tabs)/discover/${seg}?q=${encodeURIComponent(q)}` as any);
  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
      {sortedPeople.length > 0 && (
        <>
          <SectionHeader title="People" onSeeAll={() => seeAll('people')} />
          {sortedPeople.slice(0, 4).map((o: any) => <Row key={`p-${o.id}`} kind="person" item={o} avatar={o.image || o.avatar} name={o.name || o.username || 'Someone'} handle={o.username ? `@${o.username}` : undefined} context={personContext(o)} active={conn.isFollowing(o)} onOpen={openUser} onAction={conn.canFollow(o) ? conn.toggleFollow : undefined} />)}
        </>
      )}
      {sortedGroups.length > 0 && (
        <>
          <SectionHeader title="Groups" onSeeAll={() => seeAll('communities')} />
          {sortedGroups.slice(0, 4).map((o: any) => <Row key={`g-${o.id}`} kind="group" item={o} avatar={o.image || o.avatar} name={o.name || 'Group'} context={groupContext(o)} active={conn.isJoined(o)} onOpen={openGroup} onAction={conn.toggleJoin} />)}
        </>
      )}
      {sortedPosts.length > 0 && (
        <>
          <SectionHeader title="Posts" onSeeAll={() => seeAll('posts')} />
          {sortedPosts.slice(0, 5).map((o: any) => <Row key={`o-${o.id}`} kind="post" item={o} thumb={postThumb(o).url} avatar={o.author?.image || o.author?.avatar} name={o.author?.name || o.author?.username || 'Post'} handle={o.author?.username ? `@${o.author.username}` : undefined} context={(o.content || '').replace(/\n/g, ' ').slice(0, 80)} onOpen={openPost} />)}
        </>
      )}
    </ScrollView>
  );
}

// ── Landing (no query) ──────────────────────────────────────────────────────
// One "Today on Minds" story: kicker + headline (+ optional dek), then its real
// posts as tappable rows. The edition is AI-as-EDITOR — every post is a real
// human post; the model only selected and grouped them.
function TodayStory({ story, onOpenPost }: { story: any; onOpenPost: (p: any) => void }) {
  const colors = useColors();
  return (
    <View style={{ paddingTop: spacing.lg }}>
      <View style={{ paddingHorizontal: spacing.xl, gap: 2 }}>
        <Text variant="caption" color={colors.accent} style={{ fontSize: 11, fontFamily: 'Roboto-Bold', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {story.kicker}
        </Text>
        <Text variant="h3" style={{ fontSize: 19, lineHeight: 24 }}>{story.headline}</Text>
        {!!story.dek && <Text variant="caption" color={colors.textSecondary} style={{ fontSize: 13.5, lineHeight: 19 }}>{story.dek}</Text>}
      </View>
      {(story.posts || []).slice(0, 4).map((p: any) => (
        <Row key={`ts-${p.id}`} kind="post" item={p} thumb={postThumb(p).url}
          avatar={p.author?.image || p.author?.avatar}
          name={p.author?.name || p.author?.username || 'Post'}
          handle={p.author?.username ? `@${p.author.username}` : undefined}
          context={(p.content || '').replace(/\n/g, ' ').slice(0, 80)}
          onOpen={onOpenPost} />
      ))}
    </View>
  );
}

export function DiscoverLanding() {
  const router = useRouter();
  const colors = useColors();
  const conn = useConnectState();
  const { tags } = useTags(16);
  const { edition } = useTodayEdition();
  const { posts: topFeed } = useForYouTop(12);
  const { profiles } = useProfiles(120);
  const { entries: board } = useProfileLeaderboard(60, 'engagement');
  const { communities } = useCommunities(40);

  const profileById = React.useMemo(() => { const m = new Map<string, any>(); for (const p of profiles || []) if (p?.id) m.set(p.id, p); return m; }, [profiles]);
  const people = React.useMemo(() => filterJunkCreators(((board || []).length ? (board || []).map((r: any) => { const p = profileById.get(r?.id); return p ? { ...p, ...r } : r; }) : [...(profiles || [])])).filter((u: any) => (u?.username || '').toLowerCase() !== 'minds' && conn.canFollow(u)).slice(0, 4), [board, profiles, profileById, conn.canFollow]);
  const groups = React.useMemo(() => (communities || []).filter((c: any) => !(c.is_member ?? c.isMember) && (c.member_count || c.memberCount || 0) > 0).slice(0, 4), [communities]);
  const topPosts = React.useMemo(() => (topFeed || []).slice(0, 4), [topFeed]);

  // Stable openers so the memoized Row skips re-render on parent updates.
  const openUser = React.useCallback((u: any) => router.push(`/${u.username || u.id}` as any), [router]);
  const openGroup = React.useCallback((c: any) => router.push(`/community/${c.id}` as any), [router]);
  const openPost = React.useCallback((p: any) => router.push(`/post/${p.id}` as any), [router]);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
      {!!edition?.stories?.length && (
        <>
          <SectionHeader title="Today on Minds" />
          {edition.stories.slice(0, 5).map((s: any, i: number) => (
            <TodayStory key={s.id || `story-${i}`} story={s} onOpenPost={openPost} />
          ))}
          <View style={{ height: spacing.md }} />
        </>
      )}
      {(tags || []).length > 0 && (
        <>
          <SectionHeader title="Trending" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl }}>
            {(tags || []).slice(0, 12).map((t: any) => (
              <Pressable
                key={t.id || t.name}
                onPress={() => router.push(`/(tabs)/discover/posts?q=${encodeURIComponent(`#${t.slug || t.name}`)}` as any)}
                accessibilityRole="link"
                accessibilityLabel={`View posts tagged #${t.name || t.slug}`}
                style={({ pressed }: any) => ({ paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, opacity: pressed ? 0.8 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
              >
                <Text variant="caption" color={colors.textSecondary} style={{ fontSize: 14 }}>#{t.name || t.slug}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {topPosts.length > 0 && (
        <>
          <SectionHeader title="Top on Minds today" onSeeAll={() => router.push('/(tabs)/discover/posts' as any)} />
          {topPosts.map((p: any) => (
            <Row key={`t-${p.id}`} kind="post" item={p} thumb={postThumb(p).url} avatar={p.author?.image || p.author?.avatar} name={p.author?.name || p.author?.username || 'Post'} handle={p.author?.username ? `@${p.author.username}` : undefined} context={`${(p.content || '').replace(/\n/g, ' ').slice(0, 70) || 'media'} · ${formatCount(postScore(p) || 0)} reactions`} onOpen={openPost} />
          ))}
        </>
      )}

      {people.length >= 2 && (
        <>
          <SectionHeader title="People to follow" onSeeAll={() => router.push('/(tabs)/discover/people' as any)} />
          {people.map((u: any) => (
            <Row key={`pp-${u.id}`} kind="person" item={u} avatar={u.image || u.avatar} name={u.name || u.username || 'Someone'} handle={u.username ? `@${u.username}` : undefined} context={personContext(u)} active={conn.isFollowing(u)} onOpen={openUser} onAction={conn.toggleFollow} />
          ))}
        </>
      )}

      {groups.length >= 2 && (
        <>
          <SectionHeader title="Groups to join" onSeeAll={() => router.push('/(tabs)/discover/communities' as any)} />
          {groups.map((c: any) => (
            <Row key={`gg-${c.id}`} kind="group" item={c} avatar={c.image || c.avatar} name={c.name || 'Group'} context={groupContext(c)} active={conn.isJoined(c)} onOpen={openGroup} onAction={conn.toggleJoin} />
          ))}
        </>
      )}
    </ScrollView>
  );
}
