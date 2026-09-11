import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useProfiles, useProfileLeaderboard, useCommunities, useFollowingIds } from '../lib/hooks';
import { filterJunkCreators } from '../lib/quality';
import { communityDescription, isSelfProfile, profileFollowerCount } from '../lib/models';
import { formatCount } from '../lib/discover';
import { afterFollowChange } from '../lib/follows';
import { spacing, radius, CTA } from '../constants/theme';
import { useColors } from '../lib/theme';

// ──────────────────────────────────────────────────────────────────────────
// Inline feed inserts — woven into the For You scroll (not a sidebar), so the
// connection nudges land where attention actually is. Same ranked data the
// Discover tabs + sidebar use, junk-filtered. Two kinds:
//   'people' → "People you might like" (follower-ranked, real bios/context)
//   'groups' → "Groups to join" (active communities)
// Each row is an action (Follow / Join). Never a dead end.
// ──────────────────────────────────────────────────────────────────────────

// A single gold pill CTA, matching the network's one canonical button.
function ActionPill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={(e: any) => { e?.stopPropagation?.(); onPress(); }}
      hitSlop={6}
      style={({ pressed }: any) => ({
        paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.full,
        backgroundColor: active ? 'transparent' : CTA.solid,
        borderWidth: active ? 1 : 0, borderColor: colors.border,
        opacity: pressed ? 0.8 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Text variant="caption" style={{ fontFamily: 'Roboto-Bold', fontSize: 13, color: active ? colors.textSecondary : CTA.ink }}>
        {active ? `${label}ing` : label}
      </Text>
    </Pressable>
  );
}

function InsertShell({ title, seeAllLabel, onSeeAll, children }: {
  title: string; seeAllLabel: string; onSeeAll: () => void; children: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.glass, paddingVertical: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <Text variant="label" style={{ fontSize: 15, fontFamily: 'Roboto-Bold' }}>{title}</Text>
        <Pressable onPress={onSeeAll} hitSlop={8} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
          <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13 }}>{seeAllLabel}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function SuggestRow({ avatar, name, handle, context, active, actionLabel, onPress, onAction }: {
  avatar?: string | null; name: string; handle?: string; context?: string;
  active?: boolean; actionLabel: string; onPress: () => void; onAction: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
        backgroundColor: hovered ? colors.glass : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Avatar uri={avatar} name={name} size="md" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" numberOfLines={1} style={{ fontSize: 15, fontFamily: 'Roboto-Medium' }}>{name}</Text>
        {!!handle && <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 13 }}>{handle}</Text>}
        {!!context && <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ fontSize: 13, marginTop: 1 }}>{context}</Text>}
      </View>
      <ActionPill label={actionLabel} active={active} onPress={onAction} />
    </Pressable>
  );
}

// "People you might like" — follower-ranked, junk-filtered, hydrated with bio.
export function FeedPeopleInsert() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { profiles } = useProfiles(120);
  const { entries: board } = useProfileLeaderboard(100, 'engagement');
  const { followingIds } = useFollowingIds();
  const [override, setOverride] = React.useState<Map<string, boolean>>(new Map());

  const profileById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const p of profiles || []) if (p?.id) m.set(p.id, p);
    return m;
  }, [profiles]);

  const people = React.useMemo(() => {
    const notMinds = (u: any) => (u?.username || '').toLowerCase() !== 'minds';
    const hydrated = ((board || []).length
      ? (board || []).map((row: any) => { const p = profileById.get(row?.id); return p ? { ...p, ...row } : row; })
      : [...(profiles || [])]);
    let clean = filterJunkCreators(hydrated).filter((u: any) => notMinds(u) && !isSelfProfile(u, user));
    // The follower leaderboard's top rows can be empty shells the junk filter
    // strips, which blanked the card entirely. Top up from the directory so real
    // accounts always fill it before we give up.
    if (clean.length < 5) {
      const seen = new Set(clean.map((u: any) => u.id));
      const extra = filterJunkCreators([...(profiles || [])]).filter((u: any) => notMinds(u) && !isSelfProfile(u, user) && !seen.has(u.id));
      clean = [...clean, ...extra];
    }
    return clean.slice(0, 5);
  }, [board, profiles, profileById, user?.id]);

  if (people.length < 2) return null;

  const isFollowing = (u: any) => override.has(u.id) ? !!override.get(u.id) : !!(u?.is_following ?? u?.isFollowing ?? followingIds?.has(u.id));
  const toggle = (u: any) => {
    if (!sdk || isSelfProfile(u, user)) return;
    const cur = isFollowing(u);
    setOverride((p) => new Map(p).set(u.id, !cur));
    Promise.resolve(!cur ? sdk.profiles.follow(u.id) : sdk.profiles.unfollow(u.id))
      .then(() => afterFollowChange())
      .catch(() => setOverride((p) => new Map(p).set(u.id, cur)));
  };
  // Context beyond the name: a real bio if the profile has one, otherwise the
  // follower count — so a nameless "Rolf Oldejans" always carries a reason.
  const contextFor = (u: any) => {
    const bio = String(u?.bio || u?.description || u?.briefdescription || '').trim();
    if (bio) return bio;
    const f = profileFollowerCount(u);
    return f > 0 ? `${formatCount(f)} followers` : 'New here';
  };

  return (
    <InsertShell title="People you might like" seeAllLabel="See all" onSeeAll={() => router.push('/(tabs)/discover/people' as any)}>
      {people.map((u: any) => (
        <SuggestRow
          key={u.id}
          avatar={u.image || u.avatar}
          name={u.name || u.username || 'Someone'}
          handle={u.username ? `@${u.username}` : undefined}
          context={contextFor(u)}
          active={isFollowing(u)}
          actionLabel="Follow"
          onPress={() => router.push(`/${u.username || u.id}` as any)}
          onAction={() => toggle(u)}
        />
      ))}
    </InsertShell>
  );
}

// "Groups to join" — communities, junk not applicable; shows member count.
/**
 * `slot` selects WHICH five eligible groups this occurrence shows. The feed
 * places one of these every so often as you scroll; without a slot every one of
 * them rendered the same top five, so scrolling produced the same card over and
 * over. We already fetch 40 candidates, which is eight distinct slots.
 */
export function FeedGroupsInsert({ slot = 0 }: { slot?: number }) {
  const router = useRouter();
  const { sdk } = useAuth();
  const { communities } = useCommunities(40);
  const [override, setOverride] = React.useState<Map<string, boolean>>(new Map());

  const groups = React.useMemo(() => {
    const eligible = (communities || [])
      .filter((c: any) => !(c.is_member ?? c.isMember))
      .filter((c: any) => (c.member_count || c.memberCount || 0) > 0);
    const start = slot * 5;
    // Past the end, wrap rather than render nothing — a long scroll should keep
    // showing suggestions, just not the same five every time.
    if (start >= eligible.length && eligible.length > 0) {
      const wrapped = start % eligible.length;
      return [...eligible.slice(wrapped), ...eligible.slice(0, wrapped)].slice(0, 5);
    }
    return eligible.slice(start, start + 5);
  }, [communities, slot]);

  if (groups.length < 2) return null;

  const isJoined = (c: any) => override.has(c.id) ? !!override.get(c.id) : !!(c.is_member ?? c.isMember);
  const toggle = (c: any) => {
    if (!sdk) return;
    const cur = isJoined(c);
    setOverride((p) => new Map(p).set(c.id, !cur));
    Promise.resolve(!cur ? (sdk as any).communities.join(c.id) : (sdk as any).communities.leave(c.id))
      .catch(() => setOverride((p) => new Map(p).set(c.id, cur)));
  };
  const contextFor = (c: any) => {
    const bio = communityDescription(c);
    const members = c.member_count || c.memberCount || 0;
    const m = members > 0 ? `${formatCount(members)} members` : '';
    if (bio) return m ? `${m} · ${bio}` : bio;
    return m || 'New group';
  };

  return (
    <InsertShell title="Groups to join" seeAllLabel="See all" onSeeAll={() => router.push('/(tabs)/discover/communities' as any)}>
      {groups.map((c: any) => (
        <SuggestRow
          key={c.id}
          avatar={c.image || c.avatar}
          name={c.name || 'Group'}
          context={contextFor(c)}
          active={isJoined(c)}
          actionLabel="Join"
          onPress={() => router.push(`/community/${c.id}` as any)}
          onAction={() => toggle(c)}
        />
      ))}
    </InsertShell>
  );
}
