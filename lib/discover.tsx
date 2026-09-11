import * as React from 'react';
import { View, Platform, Pressable, ScrollView, Image, Modal, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Avatar, Skeleton, AgentBadge } from '../components';
import { logSignal } from './signals';
import { spacing, radius, shadows } from '../constants/theme';
import { useColors } from './theme';
import { communityDescription, profileFollowerCount, profilePostCount, postScore, postReplyCount, timestampOf } from './models';
import { useAuth } from './auth';

// Re-export so the Discover tabs can import dedup from one place (the shared kit)
// alongside the ranking helpers, without reaching into lib/models directly.
export { dedupePosts, postDedupKey } from './models';

// ──────────────────────────────────────────────────────────────────────────
// Discover shared kit.
//
// Every helper + card the Discover tabs render lives here so the master
// "For You" page and the four entity tabs share one implementation (no
// duplication, no drift). All ranking is a CLIENT-SIDE SORT over data the
// existing hooks already load (usePosts('score'), useProfiles,
// useCommunities, useAgents); every value comes from the shared model
// accessors so field-name drift can't silently break a sort.
// ──────────────────────────────────────────────────────────────────────────

// ── Layout profile, resolved from the MEASURED content width (Discover renders
// beside the sidebar on web, so sizing off the window overshoots). One rich
// column on phones, wider carousels and a 2-up hero on tablet/desktop.
export type Layout = {
  width: number;
  isWide: boolean;
  isUltra: boolean;
  gutter: number;
};

export function computeLayout(width: number): Layout {
  const w = width || 360;
  const isWide = w >= 700;
  const isUltra = w >= 1040;
  const gutter = isWide ? spacing['2xl'] : spacing.lg;
  return { width: w, isWide, isUltra, gutter };
}

// Cross-platform cover image (RN <Image> covers web + native; the old raw <img>
// hero painted nothing on native).
export function CoverImage({ uri, height, radius: r = 0 }: { uri: string; height: number; radius?: number }) {
  const colors = useColors();
  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={{ width: '100%', height, borderRadius: r, backgroundColor: colors.surfaceRaised }}
    />
  );
}

// Canonical number formatter: comma thousands separators (1,234,567).
// Used everywhere counts/amounts are shown so the app is consistent.
export function formatCount(n: number): string {
  if (!n || n < 0) return '0';
  return Math.round(n).toLocaleString('en-US');
}
// Alias — same comma formatting; clearer name at call sites for non-"count" values.
export const formatNumber = formatCount;

export function timeAgoShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo`;
  return `${Math.floor(diff / 31536000)}y`;
}

// ── Trending topics, derived live from the loaded posts ──
export type TrendingTopic = { tag: string; count: number };

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /#([\p{L}\p{N}_]{2,30})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].toLowerCase());
  return out;
}

export function computeTrendingTopics(posts: any[], limit = 12): TrendingTopic[] {
  const counts = new Map<string, { display: string; count: number }>();
  for (const p of posts || []) {
    const tags: string[] = [];
    if (Array.isArray(p?.tags)) {
      for (const t of p.tags) {
        const clean = String(t?.name ?? t).replace(/^#/, '').trim();
        if (clean.length >= 2) tags.push(clean);
      }
    }
    tags.push(...extractHashtags(p?.content));
    tags.push(...extractHashtags(p?.title));
    const seen = new Set<string>();
    for (const raw of tags) {
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { display: raw, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => ({ tag: t.display, count: t.count }));
}

export function getDomain(url: string | null | undefined): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
export function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}
function postSource(post: any): string {
  if (post.source_name) return String(post.source_name);
  if (post.sourceName) return String(post.sourceName);
  const url = post.external_url || post.externalUrl || extractUrl(post.content);
  return getDomain(url) || 'Minds';
}
export function postAuthorName(post: any): string {
  return post.author?.name || post.author?.username || postSource(post);
}
export function postTitle(post: any): string {
  const own = (post.title || post.content || '').trim();
  if (own) return own;
  // Repost rows carry no text of their own — show the reposted original's.
  const orig = post.reposted_from || post.repostedFrom;
  if (orig) return ((orig.title || orig.content) || '').trim();
  return '';
}

// Card label: real text if present, else a media-aware placeholder (an image
// post with no caption should read as "Photo", never the ugly "Untitled").
export function cardLabel(post: any, title: string): string {
  if (title) return title;
  const thumb = postThumb(post);
  if (thumb.url) return thumb.hasVideo ? 'Video' : 'Photo';
  return 'Untitled';
}

// Best still for a post thumbnail. Flags video so we can badge it.
export function postThumb(post: any): { url: string | null; hasVideo: boolean } {
  const raw = post.media;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  let imgUrl: string | null = null;
  let hasVideo = false;
  for (const m of arr) {
    const url = typeof m === 'string' ? m : m?.url;
    const type = typeof m === 'string' ? '' : (m?.type || '');
    if (!url) continue;
    if (type.startsWith('video') || /\.m3u8|\/video\//i.test(url)) hasVideo = true;
    else if (!imgUrl) imgUrl = url;
  }
  return { url: imgUrl || post.image || post.previewImage || post.thumbnail || null, hasVideo };
}

// ── Engagement score for ranking. Real vote score is the spine; replies add a
// conversation bonus; media gives a small visual-appeal nudge so the page leads
// with content that actually pulls you in. Pure client sort over loaded posts.
export function engagementScore(post: any): number {
  const votes = postScore(post);
  const replies = postReplyCount(post);
  const hasMedia = postThumb(post).url || postThumb(post).hasVideo ? 1 : 0;
  return votes + replies * 2 + hasMedia * 4;
}

// ── HOT score — engagement decayed by age, so recent high-engagement posts beat
// ancient all-time bangers. `sort=score` from the API returns the all-time top
// (e.g. a 2021 post with 9k votes), which feels stale on a "trending/hot"
// surface. We divide the raw engagement by a super-linear function of age so a
// fresh post with modest engagement can out-rank a years-old one. Posts with no
// usable timestamp fall back to a large age so they sink (they can't be "hot").
export function hotScore(post: any): number {
  const eng = engagementScore(post);
  const ts = timestampOf(post);
  const ageDays = ts ? Math.max(0, (Date.now() - new Date(ts).getTime()) / 86_400_000) : 3650;
  return eng / (ageDays + 2) ** 1.5;
}


// ── A "gem score" for Rediscover: posts that earned real engagement but aren't
// fresh, so great older content resurfaces instead of decaying into the
// archive. We reward score+replies and gate to anything older than ~3 days.
export function isRediscoverable(post: any): boolean {
  const ts = timestampOf(post);
  if (!ts) return false;
  const ageDays = (Date.now() - new Date(ts).getTime()) / 86_400_000;
  return ageDays >= 3 && (postScore(post) + postReplyCount(post)) >= 2;
}

// Activity score for a community: members carry the most signal, post count is
// the liveliness multiplier. Pure client sort over the loaded list.
export function communityMemberCount(c: any): number {
  return c.memberCount || c.member_count || 0;
}
export function communityPostCount(c: any): number {
  return c.postCount || c.post_count || 0;
}
export function communityActivity(c: any): number {
  return communityMemberCount(c) + communityPostCount(c) * 2;
}

// ── Agent popularity. The agent payload carries no engagement signal yet, so
// this best-effort reads any usage/chat-count field if one exists; otherwise 0
// so "Popular" degrades to the server's native featured order. Shared by the
// Discover Agents tab and the Feed sidebar so both rank agents identically.
export function agentPopularity(a: any): number {
  return Number(
    a?.engagement ?? a?.chatCount ?? a?.chat_count ?? a?.conversationCount ?? a?.conversation_count ??
    a?.usageCount ?? a?.usage_count ?? a?.followersCount ?? a?.followers_count ?? 0,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Section scaffolding
// ──────────────────────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, icon, onSeeAll, gutter }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; onSeeAll?: () => void; gutter: number;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: gutter,
        paddingTop: spacing['2xl'],
        paddingBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {/* Gold tick — a small accent bar that gives every module a masthead feel. */}
          <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.accent }} />
          {icon ? <Ionicons name={icon} size={16} color={colors.accent} /> : null}
          <Text variant="h2">{title}</Text>
        </View>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, marginLeft: spacing.sm + 4 }}>{subtitle}</Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          style={Platform.OS === 'web' ? ({ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', gap: 4 } as any) : { flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text variant="caption" color={colors.accent}>See all</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function HorizontalRail({ children, gutter, snap }: { children: React.ReactNode; gutter: number; snap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snap}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.xs, gap: spacing.md }}
    >
      {children}
    </ScrollView>
  );
}

export function RailSkeleton({ gutter, width, height }: { gutter: number; width: number; height: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}
    >
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} width={width} height={height} borderRadius={radius.lg} />
      ))}
    </ScrollView>
  );
}

// ── Live trending-topics rail. Each chip is a real hashtag counted from the
// loaded posts; tapping it routes into the existing search path. ──
export function TrendingTopicsRow({ topics, onPick, gutter }: { topics: TrendingTopic[]; onPick: (tag: string) => void; gutter: number }) {
  const colors = useColors();
  if (!topics.length) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: gutter, paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
        <Ionicons name="flame" size={13} color={colors.accent} />
        <Text variant="caption" color={colors.textMuted} style={{ letterSpacing: 1.2, fontSize: 10 }}>TRENDING NOW</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: spacing.sm, gap: spacing.sm }}>
        {topics.map((t) => (
          <Pressable
            key={t.tag}
            onPress={() => onPick(t.tag)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: pressed ? colors.accentMuted : colors.surface,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>#</Text>
            <Text variant="caption" color={colors.text} style={{ fontSize: 12 }}>{t.tag}</Text>
            {t.count > 1 ? <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t.count}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Hot — featured hero + carousel
// ──────────────────────────────────────────────────────────────────────────

// Big editorial lead card for the #1 hot post. Immersive cover with a scrim
// when there's art; a typographic card with a gold rule when there isn't.
export const FeaturedPost = React.memo(function FeaturedPost({ post, onPress, layout }: { post: any; onPress: () => void; layout: Layout }) {
  const colors = useColors();
  const { url, hasVideo } = postThumb(post);
  const title = postTitle(post);
  const score = postScore(post);
  const replies = postReplyCount(post);
  const author = postAuthorName(post);
  const coverHeight = layout.isUltra ? 360 : layout.isWide ? 300 : 220;
  React.useEffect(() => { if (post?.id) logSignal('view', { postId: post.id, metadata: { surface: 'discover_featured' } }); }, [post?.id]);

  const stat = (icon: keyof typeof Ionicons.glyphMap, value: string, onImage: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={onImage ? '#fff' : colors.accent} />
      <Text variant="caption" color={onImage ? 'rgba(255,255,255,0.9)' : colors.textSecondary}>{value}</Text>
    </View>
  );

  const eyebrow = (onImage: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm }}>
      <Ionicons name="flame" size={11} color={colors.textOnAccent} />
      <Text variant="label" color={colors.textOnAccent} style={{ fontSize: 10, letterSpacing: 1 }}>#1 HOT</Text>
    </View>
  );

  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_featured' } }); onPress(); }}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: url ? 0 : 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.97 : 1,
        ...shadows.md(colors.shadow),
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      {url ? (
        <View style={{ position: 'relative' }}>
          <CoverImage uri={url} height={coverHeight} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '30%', backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {hasVideo ? (
            <View style={{ position: 'absolute', top: spacing.md, right: spacing.md, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={15} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: layout.isWide ? spacing.xl : spacing.lg, gap: spacing.sm }}>
            {eyebrow(true)}
            <Text variant={layout.isWide ? 'h1' : 'h2'} color="#fff" numberOfLines={3} style={{ maxWidth: 720 }}>{cardLabel(post, title)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: 2 }}>
              <Text variant="caption" color="rgba(255,255,255,0.82)" numberOfLines={1} style={{ maxWidth: 200 }}>{author}</Text>
              {score > 0 ? stat('arrow-up', String(score), true) : null}
              {replies > 0 ? stat('chatbubble-outline', String(replies), true) : null}
            </View>
          </View>
        </View>
      ) : (
        <View style={{ padding: layout.isWide ? spacing['2xl'] : spacing.xl, gap: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.accent }}>
          {eyebrow(false)}
          <Text variant={layout.isWide ? 'h1' : 'h2'} color={colors.text} numberOfLines={4}>{cardLabel(post, title)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: 2 }}>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ maxWidth: 200 }}>{author}</Text>
            {score > 0 ? stat('arrow-up', String(score), false) : null}
            {replies > 0 ? stat('chatbubble-outline', String(replies), false) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
});

export const POST_TILE_W = 260;

// Compact content card for the Hot carousel: media thumb, headline, author +
// real engagement (votes + replies).
export const PostTile = React.memo(function PostTile({ post, onPress, width }: { post: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const { url, hasVideo } = postThumb(post);
  const title = postTitle(post);
  const score = postScore(post);
  const replies = postReplyCount(post);
  const author = postAuthorName(post);
  const hasMedia = !!url || hasVideo;
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_hot' } }); onPress(); }}
      style={({ hovered }: any) => ({
        width,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      {url ? (
        <View style={{ height: 130, position: 'relative' }}>
          <CoverImage uri={url} height={130} />
          {hasVideo ? (
            <View style={{ position: 'absolute', bottom: spacing.xs, right: spacing.xs, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={12} color="#fff" style={{ marginLeft: 1 }} />
            </View>
          ) : null}
        </View>
      ) : hasVideo ? (
        <View style={{ height: 130, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={34} color={colors.accent} />
        </View>
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.xs, flex: 1 }}>
        <Text variant="bodyMedium" numberOfLines={hasMedia ? 2 : 4} style={{ lineHeight: 20, minHeight: hasMedia ? 40 : undefined }}>{cardLabel(post, title)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 'auto' as any }}>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>{author}</Text>
          {score > 0 ? <Text variant="caption" color={colors.accent}>↑ {score}</Text> : null}
          {replies > 0 ? <Text variant="caption" color={colors.textMuted}>· {replies}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
});

// ── Rediscover card — wider, "from the archive" framing with the post's age so
// it reads as resurfaced rather than new. ──
export const REDISCOVER_TILE_W = 300;
export const RediscoverTile = React.memo(function RediscoverTile({ post, onPress, width }: { post: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const { url } = postThumb(post);
  const title = postTitle(post);
  const score = postScore(post);
  const replies = postReplyCount(post);
  const author = postAuthorName(post);
  const age = timeAgoShort(timestampOf(post));
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_rediscover' } }); onPress(); }}
      style={({ hovered }: any) => ({
        width,
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      {url ? (
        <View style={{ width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden' }}>
          <CoverImage uri={url} height={72} />
        </View>
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="bookmark" size={22} color={colors.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyMedium" numberOfLines={2} style={{ lineHeight: 19 }}>{cardLabel(post, title)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>{author}</Text>
          {age ? <Text variant="caption" color={colors.textMuted}>{age} ago</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {score > 0 ? <Text variant="caption" color={colors.accent}>↑ {score}</Text> : null}
          {replies > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{replies}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Entity tiles (people / communities / agents)
// ──────────────────────────────────────────────────────────────────────────

export const ENTITY_TILE_W = 220;

function FollowPill({ active, onToggle }: { active?: boolean; onToggle: (next: boolean) => void }) {
  const colors = useColors();
  // Controlled by the parent's known follow state. FOLLOWING = filled gold
  // accent (accent bg + textOnAccent, legible in light + dark); FOLLOW =
  // outline/secondary.
  return (
    <Pressable
      onPress={(e: any) => { e?.stopPropagation?.(); onToggle(!active); }}
      hitSlop={6}
      style={{
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        alignItems: 'center',
        backgroundColor: active ? colors.accent : 'transparent',
        borderWidth: active ? 0 : 1,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      }}
    >
      <Text variant="caption" color={active ? colors.textOnAccent : colors.textSecondary} style={{ fontFamily: 'Roboto-Medium' }}>
        {active ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

export const PersonTile = React.memo(function PersonTile({ person, onPress, onFollow, isFollowed, width }: {
  person: any; onPress: () => void; onFollow: () => void; isFollowed?: boolean; width: number;
}) {
  const colors = useColors();
  const name = person.name || person.username || 'Someone';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followers = profileFollowerCount(person);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        width,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        gap: spacing.sm,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <Text variant="bodyMedium" numberOfLines={1} align="center" style={{ marginTop: spacing.xs }}>{name}</Text>
        {username ? <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{username}</Text> : null}
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} align="center" style={{ lineHeight: 17, minHeight: 34 }}>{bio}</Text>
      ) : <View style={{ minHeight: 34 }} />}
      {followers > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Ionicons name="people-outline" size={12} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>{formatCount(followers)} {followers === 1 ? 'follower' : 'followers'}</Text>
        </View>
      ) : null}
      <FollowPill active={isFollowed} onToggle={() => onFollow()} />
    </Pressable>
  );
});

export const CommunityTile = React.memo(function CommunityTile({ community, onPress, width }: { community: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const name = community.name || 'Group';
  const description = communityDescription(community);
  const avatar = community.image || community.avatar;
  const members = communityMemberCount(community);
  const postCount = communityPostCount(community);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        width,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      {/* Gold-tinted banner so communities read as places, not people. */}
      <View style={{ height: 48, backgroundColor: colors.accentMuted }} />
      <View style={{ padding: spacing.lg, marginTop: -26, gap: spacing.xs }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.xs }}>{name}</Text>
        {description ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 17, minHeight: 34 }}>{description}</Text>
        ) : <View style={{ minHeight: 34 }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people" size={12} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{formatCount(members)} {members === 1 ? 'member' : 'members'}</Text>
          </View>
          {postCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{formatCount(postCount)} {postCount === 1 ? 'post' : 'posts'}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export const AgentTile = React.memo(function AgentTile({ agent, onPress, width }: { agent: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        width,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        gap: spacing.sm,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="sparkles" size={10} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }} numberOfLines={1}>{model || 'AI agent'}</Text>
          </View>
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 17, minHeight: 34 }}>{bio}</Text>
      ) : <View style={{ minHeight: 34 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.accentMuted }}>
        <Ionicons name="chatbubble-ellipses" size={13} color={colors.accent} />
        <Text variant="caption" color={colors.accent}>Chat now</Text>
      </View>
    </Pressable>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// List-view cards (search results / leaderboard rows) — full-width rows so the
// directory views stay scannable.
// ──────────────────────────────────────────────────────────────────────────

function FollowUnfollowButton({ isFollowed, onPress }: { isFollowed?: boolean; onPress: (e?: any) => void }) {
  const colors = useColors();
  // Controlled by the parent's known follow state so the button reflects the
  // viewer's real relationship (and stays correct after an optimistic toggle in
  // the list), rather than holding its own divergent local state.
  // FOLLOWING = filled gold accent (legible in both light + dark: accent bg +
  // textOnAccent), FOLLOW = outline/secondary.
  return (
    <Pressable
      onPress={(e) => onPress(e)}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: isFollowed ? colors.accent : 'transparent',
        borderWidth: isFollowed ? 0 : 1,
        borderColor: colors.borderSubtle,
      }}
    >
      <Text variant="caption" color={isFollowed ? colors.textOnAccent : colors.textSecondary} style={{ fontFamily: 'Roboto-Medium' }}>{isFollowed ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

export function PersonRow({ person, onPress, onFollow, isFollowed, canFollow = true }: { person: any; onPress: () => void; onFollow: () => void; isFollowed?: boolean; canFollow?: boolean }) {
  const colors = useColors();
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followerCount = profileFollowerCount(person);
  const postCount = profilePostCount(person);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">{name}</Text>
            {username && <Text variant="caption" color={colors.textMuted}>@{username}</Text>}
          </View>
          {canFollow && <FollowUnfollowButton isFollowed={isFollowed} onPress={(e: any) => { e?.stopPropagation?.(); onFollow(); }} />}
        </View>
        {bio ? <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{bio}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {followerCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{followerCount.toLocaleString()} {followerCount === 1 ? 'follower' : 'followers'}</Text>
            </View>
          )}
          {postCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{postCount.toLocaleString()} {postCount === 1 ? 'post' : 'posts'}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function CommunityRow({ community, onPress }: { community: any; onPress: () => void }) {
  const colors = useColors();
  const { sdk } = useAuth();
  const name = community.name || 'Unnamed';
  const description = communityDescription(community);
  const avatar = community.image || community.avatar;
  const memberCount = communityMemberCount(community);
  const postCount = communityPostCount(community);
  const privacy = community.privacy;
  // Reflect join state on the CTA: seed from the row's is_member flag, then let
  // an optimistic override win so the pill flips instantly on tap (reverts on error).
  const [joinOverride, setJoinOverride] = React.useState<boolean | null>(null);
  const joined = joinOverride ?? !!(community.is_member ?? community.isMember);
  const toggleJoin = React.useCallback(() => {
    if (!sdk) return;
    const next = !joined;
    setJoinOverride(next);
    Promise.resolve(next ? (sdk as any).communities.join(community.id) : (sdk as any).communities.leave(community.id))
      .catch(() => setJoinOverride(!next));
  }, [sdk, joined, community.id]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
          {privacy === 'private' && <Ionicons name="lock-closed" size={12} color={colors.textMuted} />}
          <Pressable
            onPress={(e: any) => { e?.stopPropagation?.(); toggleJoin(); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
              backgroundColor: joined ? 'transparent' : colors.accent,
              borderWidth: joined ? 1 : 0, borderColor: colors.borderSubtle,
            }}
          >
            <Ionicons name={joined ? 'checkmark' : 'add'} size={13} color={joined ? colors.textSecondary : colors.textOnAccent} />
            <Text variant="caption" color={joined ? colors.textSecondary : colors.textOnAccent} style={{ fontWeight: '600' }}>
              {joined ? 'Joined' : 'Join'}
            </Text>
          </Pressable>
        </View>
        {description ? <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{description}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={11} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{memberCount.toLocaleString()} {memberCount === 1 ? 'member' : 'members'}</Text>
          </View>
          {postCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{postCount.toLocaleString()} {postCount === 1 ? 'post' : 'posts'}</Text>
            </View>
          )}
          {postCount >= 50 && (
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>ACTIVE</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function AgentRow({ agent, onPress }: { agent: any; onPress: () => void }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flexShrink: 1 }} numberOfLines={1}>{name}</Text>
          <AgentBadge size={12} />
        </View>
        {bio ? <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{bio}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {model && <Text variant="caption" color={colors.textMuted}>Powered by {model}</Text>}
          <Text variant="caption" color={colors.accent}>Chat now →</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Filter chips — the sort/leaderboard control on every entity tab.
// ──────────────────────────────────────────────────────────────────────────

export function FilterChips<K extends string>({ chips, active, onChange, gutter }: {
  chips: { key: K; label: string }[];
  active: K;
  onChange: (key: K) => void;
  gutter?: number;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: gutter ?? spacing.xl, paddingVertical: spacing.sm, gap: spacing.sm }}
    >
      {chips.map((c) => {
        const isActive = c.key === active;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: isActive ? colors.accent : colors.borderSubtle,
              backgroundColor: isActive ? colors.accentMuted : (pressed ? colors.surfaceHover : colors.surface),
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
            })}
          >
            <Text variant="caption" color={isActive ? colors.accent : colors.textSecondary} style={{ fontSize: 12 }}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// FilterMenu — a compact, native-feeling dropdown. A small pill showing the
// current selection + a chevron; tapping opens a centered menu (Modal) of
// options. Replaces stacked chip rows: a row of one or two of these reads like
// X/Bluesky's filter controls instead of three rails of chips.
//
// Selection still lives in the URL — the menu just calls onChange with the same
// key the chips set before, so deep-links + back/forward are unchanged.
// ──────────────────────────────────────────────────────────────────────────
export function FilterMenu<K extends string>({ options, value, onChange, icon }: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const [open, setOpen] = React.useState(false);
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
          paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: 6,
          borderRadius: radius.full, borderWidth: 1,
          borderColor: colors.borderSubtle,
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
          ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
        })}
      >
        {icon ? <Ionicons name={icon} size={12} color={colors.textMuted} /> : null}
        <Text variant="caption" color={colors.textSecondary} style={{ fontSize: 12 }}>{current?.label}</Text>
        <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: colors.scrimStrong, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.bg, borderRadius: radius.xl,
              paddingVertical: spacing.sm, width: '100%', maxWidth: 320,
              borderWidth: 1, borderColor: colors.border,
              ...shadows.lg(colors.shadow),
            }}
          >
            {options.map((o) => {
              const isActive = o.key === value;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => { onChange(o.key); setOpen(false); }}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
                    backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                  })}
                >
                  <Text variant="body" color={isActive ? colors.accent : colors.text}>{o.label}</Text>
                  {isActive ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ── One-line row that holds the compact FilterMenu dropdowns (sort + time). ──
export function FilterBar({ children, gutter }: { children: React.ReactNode; gutter?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: gutter ?? spacing.xl, paddingVertical: spacing.sm }}>
      {children}
    </View>
  );
}

// ── Full-width list skeleton, shared by every entity tab's loading state. ──
export function ListSkeleton() {
  return (
    <View style={{ padding: spacing.xl, gap: spacing.xl }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Skeleton width={44} height={44} borderRadius={22} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Skeleton width={160} height={14} />
              <Skeleton width={100} height={12} />
            </View>
          </View>
          <Skeleton width="100%" height={40} />
        </View>
      ))}
    </View>
  );
}

// ── Navigation helpers shared across the tabs ──
// For You lives on the main Feed now — Discover is a pure search/directory
// console that defaults to Posts.
/**
 * Agents are hidden from Discover for now — the directory rolls out later.
 * HIDDEN, NOT DELETED: /discover/agents still resolves and still works, so
 * bringing it back is this one flag rather than rebuilding the tab and its
 * route. Flip to true when the directory is ready to be public.
 */
export const SHOW_AGENTS_TAB = false;

export const DISCOVER_TABS: { key: string; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'people', label: 'Channels' },
  { key: 'communities', label: 'Groups' },
  ...(SHOW_AGENTS_TAB ? [{ key: 'agents', label: 'Agents' }] : []),
];

// ──────────────────────────────────────────────────────────────────────────
// Time-range filter — Today / This week / This month / All time.
//
// `sinceForRange` turns a range key into a `since` ISO string. The console
// passes it to the server as ?since= (not honored yet) AND client-filters
// created_at over the fetched pages as the fallback, so swapping to a pure
// server filter later is a one-line change (drop the client filter).
// ──────────────────────────────────────────────────────────────────────────
export type TimeRange = 'today' | 'week' | 'month' | 'all';

export const TIME_RANGE_CHIPS: { key: TimeRange; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

const RANGE_MS: Record<Exclude<TimeRange, 'all'>, number> = {
  today: 86_400_000,
  week: 7 * 86_400_000,
  month: 30 * 86_400_000,
};

/** ISO timestamp marking the start of the window, or undefined for 'all'. */
export function sinceForRange(range: TimeRange): string | undefined {
  if (range === 'all') return undefined;
  return new Date(Date.now() - RANGE_MS[range]).toISOString();
}

/** Client-side fallback for the time window (until the server honors ?since). */
export function withinRange(post: any, range: TimeRange): boolean {
  if (range === 'all') return true;
  const ts = timestampOf(post);
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() <= RANGE_MS[range];
}

// ──────────────────────────────────────────────────────────────────────────
// Topic tag cloud — a modal "see them all in one screen" topic picker.
//
// Replaces the old horizontal TopicChips bar. A `TopicsPill` (styled like the
// Sort/Time FilterMenu pills) opens a full-screen `TagCloudModal` showing ALL
// topics as a weighted cloud: each chip's font size + weight scales with its
// post_count (from GET /tags), so the big topics pop and the page feels alive.
// Tapping a topic selects it (drives ?tag_ids=<id> in the consuming tab) and
// closes the modal; "All topics" clears the filter.
//
// Reads tags from useTags() (sdk.tags.list). The /tags route returns every
// auto-topic with a real post_count, so the cloud lights up with live volume.
// ──────────────────────────────────────────────────────────────────────────

export type TopicTag = { id: string; name: string; slug?: string; color?: string | null; post_count?: number; postCount?: number };

export function topicPostCount(t: TopicTag): number {
  const n = Number(t?.post_count ?? t?.postCount ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Map a tag's post_count onto a font-size weight within [min,max]. Uses a sqrt
// compression of the count's position between the corpus min/max so a single
// mega-topic doesn't dwarf everything (linear scaling makes the long tail
// unreadably tiny). Tags with no/equal counts land at the midpoint.
function cloudWeight(count: number, minCount: number, maxCount: number): { fontSize: number; weight: '400' | '500' | '600' | '700'; opacity: number } {
  const MIN = 13;
  const MAX = 30;
  let frac = 0.5;
  if (maxCount > minCount) {
    const lo = Math.sqrt(Math.max(0, minCount));
    const hi = Math.sqrt(Math.max(0, maxCount));
    const v = Math.sqrt(Math.max(0, count));
    frac = hi > lo ? (v - lo) / (hi - lo) : 0.5;
  }
  frac = Math.max(0, Math.min(1, frac));
  const fontSize = Math.round(MIN + frac * (MAX - MIN));
  const weight = frac > 0.78 ? '700' : frac > 0.5 ? '600' : frac > 0.25 ? '500' : '400';
  const opacity = 0.62 + frac * 0.38; // smaller topics recede a touch
  return { fontSize, weight, opacity };
}

/** The pill that lives in the FilterBar and opens the tag-cloud modal. Shows the
 *  active topic name when one is selected, else "Topics". */
export function TopicsPill({ tags, activeId, onPick }: {
  tags: TopicTag[];
  activeId?: string | null;
  onPick: (id: string | null) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = React.useState(false);
  if (!tags || tags.length === 0) return null;
  const active = activeId ? tags.find((t) => t.id === activeId) : null;
  const label = active?.name ?? 'Topics';
  const isActive = !!active;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
          paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: 6,
          borderRadius: radius.full, borderWidth: 1,
          borderColor: isActive ? colors.accent : colors.borderSubtle,
          backgroundColor: isActive ? colors.accentMuted : (pressed ? colors.surfaceHover : colors.surface),
          maxWidth: 200,
          ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
        })}
      >
        <Ionicons name="pricetags-outline" size={12} color={isActive ? colors.accent : colors.textMuted} />
        <Text variant="caption" numberOfLines={1} color={isActive ? colors.accent : colors.textSecondary} style={{ fontSize: 12 }}>{label}</Text>
        <Ionicons name="chevron-down" size={12} color={isActive ? colors.accent : colors.textMuted} />
      </Pressable>

      <TagCloudModal
        visible={open}
        tags={tags}
        activeId={activeId}
        onClose={() => setOpen(false)}
        onPick={(id) => { onPick(id); setOpen(false); }}
      />
    </>
  );
}

/** Full-screen weighted tag cloud. Glanceable: all topics on one screen, sized
 *  by post volume, gold accent for the active topic. */
export function TagCloudModal({ visible, tags, activeId, onPick, onClose }: {
  visible: boolean;
  tags: TopicTag[];
  activeId?: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const [query, setQuery] = React.useState('');
  // Rank by volume so the biggest topics read first (top-left), and compute the
  // corpus min/max once for the weighting.
  const { sorted, minCount, maxCount } = React.useMemo(() => {
    const withCounts = (tags || []).map((t) => ({ t, c: topicPostCount(t) }));
    const counts = withCounts.map((x) => x.c);
    const max = counts.length ? Math.max(...counts) : 0;
    const min = counts.length ? Math.min(...counts) : 0;
    const s = [...withCounts].sort((a, b) => b.c - a.c).map((x) => x.t);
    return { sorted: s, minCount: min, maxCount: max };
  }, [tags]);
  // Type-to-filter: at 40+ topics, scanning the cloud for a specific one is slow.
  const q = query.trim().toLowerCase();
  const shown = q ? sorted.filter((t) => (t.name || '').toLowerCase().includes(q)) : sorted;
  // Reset the query each time the sheet is dismissed so it opens fresh.
  React.useEffect(() => { if (!visible) setQuery(''); }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrimStrong, justifyContent: 'flex-end' }}>
        {/* Tap the scrim above the sheet to dismiss. */}
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
            maxHeight: '82%',
            borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
            borderColor: colors.border,
            ...shadows.lg(colors.shadow),
          }}
        >
          {/* Grabber + header */}
          <View style={{ alignItems: 'center', paddingTop: spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.accent }} />
              <Text variant="h2">Topics</Text>
            </View>
            <Pressable
              onPress={() => onPick(null)}
              hitSlop={8}
              disabled={!activeId}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full,
                borderWidth: 1, borderColor: activeId ? colors.accent : colors.borderSubtle,
                backgroundColor: activeId ? (pressed ? colors.accentMuted : 'transparent') : 'transparent',
                opacity: activeId ? 1 : 0.5,
                ...(Platform.OS === 'web' ? { cursor: activeId ? 'pointer' : 'default' } as any : {}),
              })}
            >
              <Ionicons name="close-circle-outline" size={13} color={activeId ? colors.accent : colors.textMuted} />
              <Text variant="caption" color={activeId ? colors.accent : colors.textMuted}>{activeId ? 'Clear' : 'All topics'}</Text>
            </Pressable>
          </View>

          {/* Type-to-filter — fast selection when there are many topics. */}
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
              backgroundColor: colors.surface, borderRadius: radius.full,
              borderWidth: 0.5, borderColor: colors.glassBorder,
              paddingHorizontal: spacing.md, paddingVertical: 9,
            }}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search topics"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: colors.text, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing['3xl'] }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {shown.length === 0 ? (
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', paddingVertical: spacing['2xl'] }}>
                No topics match “{query}”.
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
              {shown.map((t) => {
                const count = topicPostCount(t);
                const { fontSize, weight, opacity } = cloudWeight(count, minCount, maxCount);
                const isActive = activeId === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => onPick(t.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'baseline', gap: 4,
                      paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
                      borderRadius: radius.full, borderWidth: 1,
                      borderColor: isActive ? colors.accent : colors.borderSubtle,
                      backgroundColor: isActive ? colors.accentMuted : (pressed ? colors.surfaceHover : colors.surface),
                      opacity: isActive ? 1 : opacity,
                      ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
                    })}
                  >
                    <Text style={{ fontSize: Math.round(fontSize * 0.72), color: colors.accent, fontFamily: 'Roboto-Medium' }}>#</Text>
                    <Text style={{ fontSize, fontWeight: weight, color: isActive ? colors.accent : colors.text }}>{t.name}</Text>
                    {count > 0 ? (
                      <Text style={{ fontSize: Math.max(10, Math.round(fontSize * 0.5)), color: isActive ? colors.accent : colors.textMuted }}>
                        {formatCount(count)}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
