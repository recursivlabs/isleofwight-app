import * as React from 'react';
import { View, Pressable, Image, Platform, Linking, TextInput, Alert, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { VoteButtons } from './VoteButtons';
import { NSFWOverlay } from './NSFWOverlay';
import { ReportModal } from './ReportModal';
import { useAuth } from '../lib/auth';
import { extractFirstUrl } from '../lib/urls';
import { postScore, postReplyCount, postUserVote, postRepostCount, isArticlePost, postTitle } from '../lib/models';
import { formatCount } from '../lib/discover';
import { SITE_URL, ORG_ID } from '../lib/recursiv';
import { useToast } from './Toast';
import { isBookmarked, toggleBookmarkConfirmed } from '../lib/bookmarks';
import { logSignal } from '../lib/signals';
import { isMuted, toggleMute } from '../lib/muted';
import { blockUser, muteUser, unmuteUser } from '../lib/moderation';
import { getCached, setCache } from '../lib/cache';
import { askAgent, buildPostContextPrompt } from '../lib/askAgent';
import { LinkPreview } from './LinkPreview';
import { MediaViewer } from './MediaViewer';
import { SharePostSheet } from './SharePostSheet';
import { ArticleCard } from './ArticleCard';
import { MarkdownScopedStyles, MARKDOWN_CLASS } from './MarkdownStyles';
import { Badge, getBadges } from './Badge';
import { BoostBadge } from './BoostBadge';
import { reportBoostImpression } from '../lib/boost';
import { spacing, radius, borders, typography } from '../constants/theme';
import { useColors, useInputKeyboardProps } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { formatTimestamp } from '../lib/time';
import { renderMarkdownToHtml, parseMarkdownSegments, isSafeUrl, looksLikeLegacyHtml, stripHtmlToText, sanitizeLegacyHtml } from '../lib/markdown';
import { otpSignInPath } from '../lib/authRedirect';

interface Props {
  post: any;
  canModerate?: boolean;
  /** A moderator's delete of someone else's post goes through the group, not DELETE /posts/:id. */
  moderationDelete?: (postId: string) => Promise<void>;
  /** Pin or unpin this post in its group. Present only for the people who run the group. */
  moderationPin?: (postId: string, pinned: boolean) => Promise<void>;
  onVoteChange?: (postId: string, newScore: number, userVote: 'upvote' | 'downvote' | null) => void;
  onBookmarkChange?: (postId: string, saved: boolean) => void;
  onPostDeleted?: (postId: string) => void;
  onReply?: (postId: string) => void;
  resumeRepostIntent?: boolean;
  onRepostIntentResumed?: () => void;
  compact?: boolean;
}

// Unified app-wide time format: <24h relative (30m/2h/23h), older = date only
// ("Jun 3" this year, "Jun 3, 2021" prior). See lib/time.
const timeAgo = (dateStr: string) => formatTimestamp(dateStr);

const webHref = (href?: string) => (
  Platform.OS === 'web' && href ? { href } as any : {}
);

const normalizePostTextForComparison = (value: string) => (
  value.replace(/\s+/g, ' ').trim().toLowerCase()
);

// ── Embedded quote card (X "quote tweet"). A bordered, tappable card showing
// the quoted post's author + a truncated preview of its content, with a small
// media thumbnail when present. Tapping opens the quoted post.
function QuoteEmbed({
  quoted,
  colors,
  href,
  onPress,
}: {
  quoted: any;
  colors: ReturnType<typeof useColors>;
  href?: string;
  onPress: (e?: any) => void;
}) {
  const qAuthor = quoted.author || quoted.user || {};
  const qName = qAuthor.name || qAuthor.username || 'Anonymous';
  const qUsername = qAuthor.username;
  const qAvatar = qAuthor.image || qAuthor.avatar || null;
  const qText = (quoted.content || quoted.body || quoted.title || '').trim();
  const qCreatedAt = quoted.created_at || quoted.createdAt;
  const rawMedia = quoted.media;
  const qThumb =
    (Array.isArray(rawMedia) ? rawMedia[0]?.url : rawMedia?.url || rawMedia) ||
    quoted.image ||
    quoted.thumbnail ||
    null;
  const preview = qText.length > 200 ? `${qText.slice(0, 200).trimEnd()}…` : qText;

  return (
    <Pressable
      {...webHref(href)}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`Open quoted post by ${qName}`}
      style={({ hovered, pressed }: any) => ({
        marginTop: spacing.md,
        borderWidth: borders.thin,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : hovered ? colors.glass : 'transparent',
        ...(Platform.OS === 'web' ? ({ transition: 'background-color 0.15s ease', cursor: 'pointer' } as any) : {}),
      })}
    >
      {/* Quoted byline: small avatar · name · @handle · time */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 }}>
        <Avatar uri={qAvatar} name={qName} size="xs" />
        <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1, fontSize: 13 }}>{qName}</Text>
        {qUsername ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 0 }}>@{qUsername}</Text>
        ) : null}
        {qCreatedAt ? (
          <Text variant="caption" color={colors.textMuted} style={{ flexShrink: 0 }}>· {timeAgo(qCreatedAt)}</Text>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
        {preview ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ flex: 1, lineHeight: 20 }}>
            {preview}
          </Text>
        ) : (
          <Text variant="body" color={colors.textMuted} style={{ flex: 1, fontStyle: 'italic' }}>
            View post
          </Text>
        )}
        {qThumb ? (
          <Image
            source={{ uri: qThumb }}
            style={{ width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surfaceHover }}
            resizeMode="cover"
          />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * One in-flight request per original, shared by every card pointing at it. A
 * feed of reminds of the same post would otherwise fetch it once per card.
 * Resolved promises are kept: the answer is cached anyway, so a repeat is free.
 */
const originalPostRequests = new Map<string, Promise<any>>();

function fetchOriginalPost(sdk: any, id: string): Promise<any> {
  const existing = originalPostRequests.get(id);
  if (existing) return existing;
  const inFlight: Promise<any> = ((sdk as any).posts?.get?.(id) ?? Promise.resolve(null))
    .then((r: any) => r?.data ?? null)
    .catch(() => null);
  originalPostRequests.set(id, inFlight);
  return inFlight;
}

export const PostCard = React.memo(function PostCard({
  post,
  onVoteChange,
  onBookmarkChange,
  onPostDeleted,
  onReply,
  resumeRepostIntent = false,
  onRepostIntentResumed,
  compact = false,
  canModerate = false,
  moderationDelete,
  moderationPin,
}: Props) {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const toast = useToast();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();
  // A bare repost (a "remind" in Minds terms) is just a pointer to the original —
  // its own row carries no content and ZERO engagement. Source the displayed
  // engagement (score, vote, replies, counts) from the ORIGINAL so a remind shows
  // the same numbers as the post it points to, not 0. A quote post has its own
  // voice + engagement and counts itself.
  const _repostedOriginal = post.reposted_from || post.repostedFrom;
  const _isQuote = !!_repostedOriginal && (post.content || post.body || '').trim().length > 0;
  // The nested `reposted_from` the feed sends carries score but NOT reply/remind
  // counts, so a bare repost rendered 0/0/0. When the feed has already cached the
  // full original (its own feed appearance, or a prior detail view), read counts
  // from that. Falls back to the thin nested object, then this post.
  const _cachedOriginal = _repostedOriginal?.id ? getCached(`post:${_repostedOriginal.id}`) : null;
  // Cache miss is the common case: the original is usually NOT in the feed, so
  // the thin nested object was all we had and the remind rendered 0 replies and
  // 0 reposts. Fetch the original once and read its real counts.
  const [_fetchedOriginal, _setFetchedOriginal] = React.useState<any>(null);
  const _repostSource = (!_isQuote && (_cachedOriginal || _fetchedOriginal || _repostedOriginal)) || post;
  // A served boosted slot reports its impression once (session-deduped client
  // side, per-viewer-per-day deduped server side). This is what spends the
  // campaign budget down.
  React.useEffect(() => {
    const cid = (post as any)?.boost_campaign_id;
    if ((post as any)?.boosted && cid) reportBoostImpression(sdk, cid);
  }, [post, sdk]);
  const [userVote, setUserVote] = React.useState<'upvote' | 'downvote' | null>(postUserVote(_repostSource));
  const [score, setScore] = React.useState(postScore(_repostSource));
  const [showMenu, setShowMenu] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  // Repost action sheet (X-style: "Repost" + "Quote Post"). Opens on tapping
  // the repost icon; `repostMenuPos` anchors it next to the icon.
  const [showRepostMenu, setShowRepostMenu] = React.useState(false);
  const [repostMenuPos, setRepostMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const resumedRepostIntentRef = React.useRef<string | null>(null);
  // Measured menu height — the position clamp needs the REAL height (the old
  // fixed 220px estimate let taller menus, e.g. own-post + admin actions, spill
  // off the bottom of the screen). Reset on each open so it re-measures.
  const [menuH, setMenuH] = React.useState(0);
  const [showReport, setShowReport] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(post.content || post.body || '');
  const [editSaving, setEditSaving] = React.useState(false);
  const [currentContent, setCurrentContent] = React.useState(post.content || post.body || '');
  const [isDeleted, setIsDeleted] = React.useState(false);
  // Long feed posts show a preview + "Show more" that expands inline.
  const [expanded, setExpanded] = React.useState(false);
  // Bookmark state is keyed by the original post id for a BARE repost so a
  // repost and the original share a single saved-state. A quote post has its
  // own voice/engagement, so it bookmarks itself.
  const bookmarkedId = (!_isQuote && _repostedOriginal?.id) || post.id;
  const [saved, setSaved] = React.useState(isBookmarked(bookmarkedId));
  const [bookmarkSaving, setBookmarkSaving] = React.useState(false);

  // Repost-by-me toggle: tracks the id of the viewer's own repost of
  // this original (if any) so they can undo it. In-memory only — after
  // a reload, the server-side `viewer_reposted_id` flag (TBD) will
  // restore this. For now the toggle works within the session.
  // Seed from the server's per-viewer flag so "reposted" + toggle-to-undo
  // survives a feed refresh — otherwise the local state reset and you could
  // repost the same post repeatedly instead of undoing it.
  const [myRepostId, setMyRepostId] = React.useState<string | null>(
    (post as any).reposted_by_viewer_id ?? (post as any).repostedByViewerId ?? null
  );
  // Repost count (X/Bluesky parity). Sourced from _repostSource (the original for
  // a bare remind), defined above with the rest of the engagement.
  const [repostCount, setRepostCount] = React.useState<number>(postRepostCount(_repostSource));

  // Hydrate a bare remind's engagement from the original. `replyCount` is
  // derived from _repostSource so it follows on its own; score and repostCount
  // are state seeded at mount, so they need setting when the answer lands.
  //
  // Only when the nested original is THIN. The API now serializes the
  // original's reply and repost counts and the viewer's vote on the feed row,
  // so a remind carries everything and this fetch never fires; an older API
  // that omits them still gets one fetch per original.
  const _originalIsThin = !!_repostedOriginal
    && _repostedOriginal.reply_count === undefined && _repostedOriginal.replyCount === undefined
    && _repostedOriginal.reposts_count === undefined && _repostedOriginal.repostCount === undefined;
  React.useEffect(() => {
    const originalId = !_isQuote && _originalIsThin ? _repostedOriginal?.id : null;
    if (!originalId || _cachedOriginal || _fetchedOriginal || !sdk) return;
    let cancelled = false;
    fetchOriginalPost(sdk, originalId).then((full: any) => {
      if (cancelled || !full) return;
      setCache(`post:${originalId}`, full);
      _setFetchedOriginal(full);
      setScore(postScore(full));
      setRepostCount(postRepostCount(full));
      setUserVote(postUserVote(full));
    });
    return () => { cancelled = true; };
  }, [sdk, _isQuote, _originalIsThin, _repostedOriginal?.id, _cachedOriginal, _fetchedOriginal]);

  // A detail refresh can update the same post. Refresh the displayed body
  // without replacing a draft currently open in the editor.
  React.useEffect(() => {
    setCurrentContent(post.content || post.body || '');
  }, [post.id, post.content, post.body]);

  // Changing posts resets editing state; refreshing this post does not.
  React.useEffect(() => {
    setEditContent(post.content || post.body || '');
    setIsEditing(false);
    setShowMenu(false);
    setIsDeleted(false);
  }, [post.id]);

  // Sync vote state from server data — runs when post data updates (not just post.id)
  React.useEffect(() => {
    // Engagement comes from the ORIGINAL for a bare remind (its own row is 0s).
    const src = _repostSource;
    const serverVote = src.userReaction || src.user_reaction || src.userVote || src.user_vote || null;
    const serverScore = src.score ?? src.vote_count ?? src.voteCount ?? 0;
    setUserVote(serverVote);
    setScore(serverScore);
  }, [post.id, _repostSource]);

  // X-style repost vs quote post. Both carry `reposted_from` (the original).
  // The distinguisher is the repost row's OWN content:
  //   • empty own content  → BARE REPOST: render the original as the card body
  //     with a small "@<reposter> reposted" header above it.
  //   • non-empty content  → QUOTE POST: render the reposter's own content as
  //     the body (their voice), with the original embedded as a tappable card
  //     beneath it (X "quote tweet"). The reposter is the byline author here.
  const repostedFrom = post.reposted_from || post.repostedFrom || null;
  const ownContent = (post.content || post.body || '').trim();
  const isQuotePost = !!repostedFrom && ownContent.length > 0;
  // Bare repost: original supplies the body. Quote post: the post itself is the
  // body and the original is shown only as the embedded card.
  const reposter = repostedFrom && !isQuotePost ? (post.author || post.user || {}) : null;
  const reposterName = reposter ? (reposter.name || reposter.username || 'Someone') : null;
  const reposterSlug = reposter?.username || reposter?.id;
  const reposterHref = reposterSlug ? `/${reposterSlug}` : undefined;
  const displayPost = (repostedFrom && !isQuotePost) ? repostedFrom : post;

  const author = displayPost.author || displayPost.user || {};
  const authorName = author.name || author.username || 'Anonymous';
  const authorUsername = author.username || author.id || 'anonymous';
  const authorAvatar = author.image || author.avatar || null;

  // Context for audio posts → the inline player + OS now-playing show real
  // title/author/artwork instead of a bare "Audio" label.
  const audioMeta = {
    id: displayPost.id,
    title: displayPost.title || undefined,
    artist: authorName,
    artwork: authorAvatar || undefined,
  };

  // X-style long-form: render as an article (compact card in-feed, full reader on
  // the detail page) instead of the plain text+media body.
  const isArticle = isArticlePost(displayPost);
  const postHref = `/post/${displayPost.id}`;
  const openPost = (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    router.push(postHref as any);
  };

  // For agent-curated posts (author is the user's personal AI agent +
  // there's an external_url), the visual byline should be the SOURCE
  // (Anthropic, NYT, ESPN) rather than the agent — otherwise every
  // single post in the feed reads "M · M · M". The agent's voice still
  // appears in the body content.
  const isAgentCurated = !!(author.isAi || author.is_ai) && !!(displayPost.external_url || displayPost.externalUrl);
  const rawExternalUrl = displayPost.external_url || displayPost.externalUrl || '';
  // external_url is post data and feeds Linking.openURL — same scheme
  // allowlist as markdown links so javascript:/data: URLs can't ride along.
  const externalUrlForByline = isSafeUrl(rawExternalUrl) ? rawExternalUrl : '';
  const sourceFromUrl = (() => {
    if (!externalUrlForByline) return null;
    try {
      const host = new URL(externalUrlForByline).hostname.replace(/^www\./, '');
      // Prettify common patterns: "anthropic.com" → "Anthropic", "news.ycombinator.com" → "Hacker News"
      const parts = host.split('.');
      const root = parts.length >= 2 ? parts[parts.length - 2] : host;
      const known: Record<string, string> = {
        ycombinator: 'Hacker News',
        nytimes: 'NYT',
        wsj: 'WSJ',
        ft: 'FT',
        bloomberg: 'Bloomberg',
        techmeme: 'Techmeme',
        theverge: 'The Verge',
        arstechnica: 'Ars Technica',
        anthropic: 'Anthropic',
        openai: 'OpenAI',
        github: 'GitHub',
        stratechery: 'Stratechery',
        substack: 'Substack',
      };
      return { host, name: known[root] || (root.charAt(0).toUpperCase() + root.slice(1)) };
    } catch {
      return null;
    }
  })();
  const bylineName = isAgentCurated && sourceFromUrl ? sourceFromUrl.name : authorName;
  const bylineLinkLabel = isAgentCurated && sourceFromUrl
    ? `Open source ${bylineName}`
    : `View profile for ${authorName}`;
  const bylineHref = isAgentCurated && externalUrlForByline
    ? externalUrlForByline
    : `/${authorUsername}`;
  const bylineFaviconUrl = isAgentCurated && sourceFromUrl
    ? `https://www.google.com/s2/favicons?domain=${sourceFromUrl.host}&sz=64`
    : null;
  // When the displayed body IS this post (own post or quote post), use the
  // edit-aware `currentContent`; for a bare repost the body is the original's.
  const rawContent = displayPost === post ? (currentContent || '') : (displayPost.content || '');
  const externalUrl: string | undefined = displayPost.external_url || displayPost.externalUrl;
  // The link the LinkPreview card renders: the external_url, or — for migrated /
  // user posts that paste the link inline — the first URL in the body.
  // extractFirstUrl keeps a bracket the URL opened itself. Stripping every
  // trailing ) as this did turned .../Frost_flower_(sea_ice) into a 404 and the
  // preview card came back blank.
  const embedUrl: string | undefined = externalUrl || extractFirstUrl(rawContent) || undefined;
  // A legacy link post carries its preview picture twice: once as the link's
  // og:image and once as an attached image (the import wrote thumbnail_src into
  // post_media, sometimes more than once). The URLs differ, so a URL dedupe
  // cannot see it. When a post with a link (external_url, or a URL pasted in
  // the body) already shows an image natively, the link card renders without
  // its hero: title and domain stay.
  const linkCardHidesImage = !!embedUrl && Array.isArray(displayPost.media)
    && displayPost.media.some((m: any) => (m?.type || 'image') === 'image');
  // Strip the single line that is just that link — the card already shows it, so a
  // bare URL above the card is noise. Only the first matching line is removed; any
  // other links stay as clickable text.
  const content = (() => {
    if (!embedUrl) return rawContent;
    let stripped = false;
    const norm = (s: string) => s.replace(/\/+$/, '');
    return rawContent
      .split('\n')
      .filter((line: string) => {
        const t = line.trim();
        if (!t) return true;
        if (!stripped && (t === embedUrl || norm(t) === norm(embedUrl))) { stripped = true; return false; }
        return true;
      })
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  })();
  const visiblePostTitle = (() => {
    const title = postTitle(displayPost);
    if (!title) return '';

    // Legacy imports sometimes copied one caption into both fields. Compare
    // against the body users actually see after URL-only preview lines are
    // removed, while retaining title-only and genuinely distinct titles.
    const normalizedBody = normalizePostTextForComparison(content);
    return normalizedBody && normalizePostTextForComparison(title) === normalizedBody ? '' : title;
  })();
  const rawMedia = displayPost.media;
  const media = (Array.isArray(rawMedia) ? rawMedia[0]?.url : rawMedia) || displayPost.image || displayPost.thumbnail || null;
  // Prefer the (possibly cache-hydrated) repost source so a bare repost shows the
  // original's real reply count instead of 0, matching score + remind counts.
  const replyCount = postReplyCount(_repostSource) || postReplyCount(displayPost);
  const isNsfw = displayPost.is_nsfw === true || (displayPost.tags || []).some((t: any) =>
    typeof t === 'string' ? t.toLowerCase() === 'nsfw' : t?.name?.toLowerCase() === 'nsfw'
  );
  const createdAt = displayPost.createdAt || displayPost.created_at || new Date().toISOString();
  const postAge = timeAgo(createdAt);
  const isOwnPost = user?.id && (author.id === user.id);
  // The ID used for all actions that target the content — vote, reply, nav.
  // Bare reposts forward these to the original; a quote post targets itself
  // (it's a real post with its own engagement), as do non-repost posts.
  const actionPostId = displayPost === post ? post.id : displayPost.id;
  const signInToInteract = React.useCallback((reaction?: 'upvote' | 'downvote') => {
    const postPath = `/post/${actionPostId}`;
    const returnTo = reaction ? `${postPath}?reaction=${reaction}` : postPath;
    router.push(otpSignInPath(returnTo) as any);
  }, [actionPostId, router]);

  // Reopen the chooser after OTP instead of treating a callback URL as
  // permission to publish. The viewer still gets the exact action they chose,
  // but confirms the write after their authenticated post state has loaded.
  React.useEffect(() => {
    if (!resumeRepostIntent) {
      resumedRepostIntentRef.current = null;
      return;
    }
    if (!sdk || !user || resumedRepostIntentRef.current === actionPostId) return;
    resumedRepostIntentRef.current = actionPostId;
    setRepostMenuPos(null);
    setShowRepostMenu(true);
    onRepostIntentResumed?.();
  }, [actionPostId, onRepostIntentResumed, resumeRepostIntent, sdk, user]);

  // Log a view once per session for any post that mounts inside a
  // feed. Dedup in logSignal keeps this from double-counting when
  // the same card renders in multiple surfaces (e.g. feed + search).
  React.useEffect(() => {
    if (actionPostId) logSignal('view', { postId: actionPostId, metadata: { surface: 'postcard' } });
  }, [actionPostId]);
  const communityId = displayPost.communityId || displayPost.community_id;
  const communityName = React.useMemo(() => {
    if (!communityId) return null;
    const communities = getCached('communities:30') || getCached('communities:50') || getCached('communities:10') || getCached('communities:100') || [];
    const match = communities.find((c: any) => c.id === communityId);
    // Fall back to the community the API hydrates on the post — so posts in
    // groups the viewer hasn't joined still show "in <group>" (the cache only
    // holds the viewer's own communities).
    return match?.name || displayPost.community?.name || displayPost.community_name || null;
  }, [communityId, displayPost.community?.name, displayPost.community_name]);

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!sdk) {
      signInToInteract(type);
      return;
    }
    const wasVoted = userVote === type;
    const prevVote = userVote;
    const prevScore = score;

    let newScore = score;
    let newVote: 'upvote' | 'downvote' | null;

    if (wasVoted) {
      newVote = null;
      newScore = type === 'upvote' ? score - 1 : score + 1;
    } else {
      newVote = type;
      if (prevVote === null) {
        newScore = type === 'upvote' ? score + 1 : score - 1;
      } else {
        newScore = type === 'upvote' ? score + 2 : score - 2;
      }
    }

    setUserVote(newVote);
    setScore(newScore);
    onVoteChange?.(actionPostId, newScore, newVote);
    // Log a signal whenever the user actively chooses a direction
    // (skip the un-vote case so toggling off doesn't pollute the
    // ranking signal).
    if (newVote === 'upvote') logSignal('react_up', { postId: actionPostId });
    else if (newVote === 'downvote') logSignal('react_down', { postId: actionPostId });

    try {
      if (wasVoted) {
        await sdk.posts.unreact(actionPostId);
      } else {
        if (prevVote) await sdk.posts.unreact(actionPostId);
        await sdk.posts.react(actionPostId, type as any);
      }
      // Update cache so other views of this post show correct vote — both the
      // standalone post entry AND every cached list (feed, profile-posts,
      // discover). Without the list patch, the channel reloads its stale cached
      // list after a refresh and the vote looks lost (engagement must stick).
      try {
        const { setCache, getCached, patchPostInCaches } = require('../lib/cache');
        const patch = { score: newScore, userReaction: newVote, user_reaction: newVote };
        const cached = getCached(`post:${actionPostId}`);
        if (cached) setCache(`post:${actionPostId}`, { ...cached, ...patch });
        patchPostInCaches(actionPostId, patch);
      } catch {}
    } catch (err: any) {
      toast.show('Vote failed', 'error');
      setUserVote(prevVote);
      setScore(prevScore);
      onVoteChange?.(actionPostId, prevScore, prevVote);
    }
  };

  const handleReport = async (reason: string, details: string) => {
    if (!sdk) throw new Error('Sign in to report this post');
    const trimmedDetails = details.trim();
    await sdk.reports.create({
      target_type: 'post',
      target_id: actionPostId,
      reason,
      ...(trimmedDetails ? { details: trimmedDetails } : {}),
    });
  };

  const handleDelete = async () => {
    if (!sdk) return;
    const doDelete = async () => {
      try {
        if (!isOwnPost && moderationDelete) await moderationDelete(post.id);
        else await sdk.posts.delete(post.id);
        setIsDeleted(true);
        onPostDeleted?.(post.id);
      } catch {
        toast.show('Failed to delete post', 'error');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Delete this post?')) await doDelete();
    } else {
      Alert.alert('Delete Post', 'Delete this post?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  // Instant reshare (no own content). Toggles undo when the viewer already
  // reposted this in-session. Extracted so the repost action sheet can call it.
  const doRepost = () => {
    haptics.tap();
    if (!sdk) {
      router.push(otpSignInPath(`/post/${actionPostId}?repost=1`) as any);
      return;
    }
    if (myRepostId) {
      const idToDelete = myRepostId;
      setMyRepostId(null);
      setRepostCount((c) => Math.max(0, c - 1));
      sdk.posts.delete(idToDelete)
        .then(() => toast.show('Remind removed', 'success'))
        .catch(() => {
          setMyRepostId(idToDelete);
          setRepostCount((c) => c + 1);
          toast.show('Could not undo remind', 'error');
        });
      return;
    }
    setRepostCount((c) => c + 1);
    sdk.posts.create({
      content: '',
      reposted_from_id: actionPostId,
      organization_id: ORG_ID || undefined,
    } as any)
      .then((res: any) => {
        const newId = res?.data?.id || res?.id;
        if (newId) setMyRepostId(newId);
        toast.show('Reminded', 'success');
      })
      .catch(() => {
        setRepostCount((c) => Math.max(0, c - 1));
        toast.show('Remind failed', 'error');
      });
  };

  // Quote post: open the composer pre-seeded with the quoted post embedded.
  // The composer (app/(tabs)/create) reads `quotePostId` and renders the
  // embedded quoted card; on submit it creates a post with reposted_from_id +
  // the typed content. We pass the quoted post id (the action target) plus a
  // light author/content snippet so the composer can render the embed without a
  // round-trip.
  const openQuoteComposer = () => {
    const quoted = displayPost; // the post being quoted (original for bare repost view, else this post)
    const quoteAuthor = (quoted.author || quoted.user)?.name || (quoted.author || quoted.user)?.username || '';
    const quoteContent = (quoted.content || quoted.body || '').slice(0, 280);
    if (!sdk) {
      const returnTo = `/create?quotePostId=${encodeURIComponent(actionPostId)}` +
        `&quoteAuthor=${encodeURIComponent(quoteAuthor)}` +
        `&quoteContent=${encodeURIComponent(quoteContent)}`;
      router.push(otpSignInPath(returnTo) as any);
      return;
    }
    router.push({
      pathname: '/(tabs)/create',
      params: {
        quotePostId: actionPostId,
        quoteAuthor,
        quoteContent,
      },
    } as any);
  };

  const handleEditSave = async () => {
    if (!sdk || !editContent.trim()) return;
    setEditSaving(true);
    try {
      await sdk.posts.update(post.id, { content: editContent.trim() });
      setCurrentContent(editContent.trim());
      setIsEditing(false);
    } catch {
      toast.show('Failed to update post', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const renderMarkdownContent = () => {
    if (!content) return null;
    // Legacy Minds articles/blogs are stored as raw HTML. They get a dedicated
    // path: stripped plain text for previews + native, sanitized HTML (web,
    // full view) — never the markdown escaper, which showed them as tag soup.
    const isLegacyHtml = looksLikeLegacyHtml(content);
    const plain = isLegacyHtml ? stripHtmlToText(content) : content;
    // Feed cards preview long posts; "Show more" expands the body inline
    // (the detail view already shows it in full) rather than a bare cut-off.
    const truncated = compact && !expanded && plain.length > 300;
    const shown = truncated ? `${plain.slice(0, 300).trimEnd()}…` : plain;
    const seeMore = truncated ? (
      <Pressable
        onPress={(e: any) => { e?.stopPropagation?.(); setExpanded(true); }}
        accessibilityRole="button"
        accessibilityLabel="Show full post"
        accessibilityState={{ expanded: false }}
        aria-expanded={false}
        hitSlop={6}
        style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
      >
        <Text variant="bodyMedium" color={colors.accent} style={{ marginTop: 2, marginBottom: media ? spacing.md : 0 }}>Show more</Text>
      </Pressable>
    ) : null;

    if (Platform.OS === 'web') {
      // Full-view legacy HTML renders sanitized (DOMPurify allowlist); previews
      // and everything else go through the escaping markdown renderer.
      const html = (isLegacyHtml && !truncated)
        ? sanitizeLegacyHtml(content)
        // Bare, so the themed stylesheet owns code, pre and link colour. The
        // renderer's own inline styles are hardcoded dark and would win.
        : renderMarkdownToHtml(shown, { bare: true });
      const WebDiv = 'div' as any;
      return (
        <>
          <MarkdownScopedStyles />
          <WebDiv
            className={MARKDOWN_CLASS}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is either escaped by renderMarkdownToHtml or allowlist-sanitized by sanitizeLegacyHtml (DOMPurify).
            dangerouslySetInnerHTML={{ __html: html }}
            style={{
              color: colors.text,
              // The HTML render path didn't set a family, so the post body fell
              // back to the browser default font — looking different from the
              // rest of the app (which is Roboto). Pin it to match.
              fontFamily: typography.body.fontFamily,
              fontSize: typography.body.fontSize,
              lineHeight: `${typography.body.lineHeight}px`,
              marginBottom: (media && !truncated) ? spacing.md : 0,
              wordBreak: 'break-word',
            }}
          />
          {seeMore}
        </>
      );
    }

    const segments = parseMarkdownSegments(shown);
    return (
      <>
      <Text variant="body" style={{ marginBottom: (media && !truncated) ? spacing.md : 0 }}>
        {segments.map((seg, i) => {
          switch (seg.type) {
            case 'bold':
              return <Text key={i} variant="bodyMedium" style={{ fontWeight: '700' }}>{seg.text}</Text>;
            case 'italic':
              return <Text key={i} variant="body" style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
            case 'code':
              return (
                <Text key={i} variant="mono" color={colors.textSecondary} style={{ backgroundColor: colors.surfaceRaised }}>
                  {seg.text}
                </Text>
              );
            case 'hashtag':
              return (
                <Text
                  key={i}
                  variant="body"
                  color={colors.accent}
                  onPress={(e: any) => {
                    // Prevent click from bubbling up to the outer post Pressable
                    // and navigating away from the hashtag filter.
                    e?.stopPropagation?.();
                    router.push({ pathname: '/discover/posts', params: { q: `#${(seg as any).tag}` } } as any);
                  }}
                >
                  {seg.text}
                </Text>
              );
            case 'mention':
              return (
                <Text
                  key={i}
                  variant="body"
                  color={colors.accent}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    router.push(`/${(seg as any).username}` as any);
                  }}
                >
                  {seg.text}
                </Text>
              );
            case 'link':
              return (
                <Text
                  key={i}
                  variant="body"
                  color={colors.accent}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    Linking.openURL(seg.url);
                  }}
                  style={{ textDecorationLine: 'underline' }}
                >
                  {seg.text}
                </Text>
              );
            case 'break':
              return <Text key={i}>{'\n'}</Text>;
            default:
              return <Text key={i} variant="body">{seg.text}</Text>;
          }
        })}
      </Text>
      {seeMore}
      </>
    );
  };

  if (isDeleted) return null;

  return (
    <Pressable
      // Guard against click-through when the overflow menu is open. On web,
      // clicks on menu items (mute / report / share) bubble up through
      // nested Pressables and would otherwise trigger post navigation.
      onPress={() => !isEditing && !showMenu && router.push(`/post/${actionPostId}` as any)}
      accessible={false}
      focusable={false}
      tabIndex={-1}
      onLongPress={(e: any) => {
        const pageX = e?.nativeEvent?.pageX ?? 0;
        const pageY = e?.nativeEvent?.pageY ?? 0;
        setMenuPos({ x: pageX, y: pageY });
        setShowMenu(true);
      }}
      delayLongPress={300}
      style={({ pressed, hovered }: any) => ({
        backgroundColor: pressed && !isEditing && !showMenu ? colors.surfaceHover : (hovered && !isEditing && !showMenu) ? colors.glass : 'transparent',
        borderBottomWidth: borders.thin,
        borderBottomColor: colors.borderSubtle,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease', cursor: isEditing ? 'default' : 'pointer' } as any : {}),
      })}
    >
      {/* Repost header — small muted "@<reposter> reposted" row above the
          original post body, X-style. Clicking it jumps to the reposter's
          profile. */}
      {repostedFrom && reposter && (
        <Pressable
          {...webHref(reposterHref)}
          onPress={(e: any) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            const slug = reposter.username || reposter.id;
            if (slug) router.push(`/${slug}` as any);
          }}
          accessibilityRole="link"
          accessibilityLabel={`View profile for ${reposterName}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm, marginLeft: 28 }}
          hitSlop={4}
        >
          <Ionicons name="repeat-outline" size={12} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>{reposterName} reminded</Text>
        </Pressable>
      )}
      {/* Paid promotion is ALWAYS labeled (same transparency rule as agent posts).
          The feed recommender marks boosted slots with `boosted: true`; rendering
          one reports the impression (server dedupes + bills the campaign). */}
      {!!(post as any).boosted && (
        <View style={{ marginBottom: spacing.sm, marginLeft: 28 }}>
          <BoostBadge />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {/* Avatar column — favicon for agent-curated posts (source-led),
          else the author avatar. */}
      <Pressable
        {...webHref(bylineHref)}
        onPress={(e: any) => {
          e?.preventDefault?.();
          e?.stopPropagation?.();
          if (isAgentCurated && externalUrlForByline) {
            Linking.openURL(externalUrlForByline);
            return;
          }
          router.push(`/${authorUsername}` as any);
        }}
        accessibilityRole="link"
        accessibilityLabel={bylineLinkLabel}
        style={{ paddingTop: 2 }}
      >
        {isAgentCurated && bylineFaviconUrl ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderWidth: borders.hairline,
              borderColor: colors.borderSubtle,
            }}
          >
            <Image source={{ uri: bylineFaviconUrl }} style={{ width: 20, height: 20 }} />
          </View>
        ) : (
          <Avatar uri={authorAvatar} name={authorName} size="sm" />
        )}
      </Pressable>

      {/* Content column */}
      <View style={{ flex: 1 }}>
      {/* Source/author byline + time + via-agent attribution */}
      {/* X-style one-line byline: bold name · @handle · time · in Community / via Agent.
          Name truncates first under width pressure; identity trio stays legible. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm, minWidth: 0 }}>
        <Pressable
          {...webHref(bylineHref)}
          onPress={(e: any) => {
            e?.preventDefault?.();
            e?.stopPropagation?.();
            if (isAgentCurated && externalUrlForByline) {
              Linking.openURL(externalUrlForByline);
              return;
            }
            router.push(`/${authorUsername}` as any);
          }}
          accessibilityRole="link"
          accessibilityLabel={bylineLinkLabel}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1, minWidth: 0 }}
        >
          <Text variant="bodyMedium" numberOfLines={1}>{bylineName}</Text>
          {!isAgentCurated && getBadges(author).map(b => <Badge key={b} type={b} size="sm" />)}
        </Pressable>
        {!isAgentCurated && authorUsername && (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flexShrink: 0 }}>@{authorUsername}</Text>
        )}
        <Pressable
          {...webHref(postHref)}
          onPress={(e: any) => {
            e?.stopPropagation?.();
            openPost(e);
          }}
          accessibilityRole="link"
          accessibilityLabel={`Open post by ${bylineName}, ${postAge}`}
          style={{ flexShrink: 0 }}
          hitSlop={4}
        >
          <Text variant="caption" color={colors.textMuted}>· {postAge}</Text>
        </Pressable>
        {communityName && (
          <Pressable
            {...webHref(`/community/${communityId}`)}
            onPress={(e: any) => {
              e?.preventDefault?.();
              e?.stopPropagation?.();
              router.push(`/community/${communityId}` as any);
            }}
            accessibilityRole="link"
            accessibilityLabel={`View community ${communityName}`}
            style={{ flexShrink: 1, minWidth: 0 }}
          >
            <Text variant="caption" color={colors.accent} numberOfLines={1}>in {communityName}</Text>
          </Pressable>
        )}
        {isAgentCurated && (
          <Pressable
            {...webHref(`/${authorUsername}`)}
            onPress={(e: any) => {
              e?.preventDefault?.();
              e?.stopPropagation?.();
              router.push(`/${authorUsername}` as any);
            }}
            accessibilityRole="link"
            accessibilityLabel={`View profile for ${authorName}`}
            style={{ flexShrink: 1, minWidth: 0 }}
          >
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>via {authorName}</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {isEditing ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={editContent}
            onChangeText={setEditContent}
            multiline
            autoFocus
            {...kbProps}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.accent,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              color: colors.text,
              minHeight: 80,
              ...typography.input,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => setIsEditing(false)}
              style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceHover }}
            >
              <Text variant="label" color={colors.textSecondary}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleEditSave}
              disabled={editSaving || !editContent.trim()}
              style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.accent, opacity: editSaving ? 0.6 : 1 }}
            >
              <Text variant="label" color={colors.textOnAccent}>{editSaving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : isNsfw ? (
        <NSFWOverlay>
          <View>
            {renderMarkdownContent()}
            <MediaViewer
              media={displayPost.media}
              thumbnail={displayPost.image || displayPost.thumbnail}
              audioMeta={audioMeta}
              postContext={{
                id: displayPost.id,
                authorName: displayPost.author?.name || displayPost.author?.username,
                authorUsername: displayPost.author?.username,
                authorAvatar: displayPost.author?.image || displayPost.author?.avatar || null,
                text: content,
                imageDescription: displayPost.aiCaption || displayPost.ai_caption || content,
                replyCount,
              }}
            />
            {isQuotePost && repostedFrom && (
              <QuoteEmbed
                quoted={repostedFrom}
                colors={colors}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  if (repostedFrom.id) router.push(`/post/${repostedFrom.id}` as any);
                }}
              />
            )}
          </View>
        </NSFWOverlay>
      ) : (
        <View>
          {/* Unified post body: text → media → link preview, regardless of
              author. The byline above already attributes agent-curated
              posts to the source (e.g. "STRATECHERY · stratechery.com");
              the body just lets the author's words read first and the
              link card sit underneath as a reference. Pass the explicit
              `url` so agent-curated posts (where external_url is a
              separate field, not embedded in content) render the right
              link; LinkPreview falls back to URL extraction from content
              for user posts that paste the URL inline. */}
          {isArticle ? (
            // compact={true} on feed cards → compact article card; the detail
            // page (compact false) renders the full reader.
            <ArticleCard post={displayPost} full={!compact} onPress={openPost} />
          ) : (
            <>
              {/* Legacy media posts (image/video) carry their caption in `title`,
                 separate from the body. Non-article titled posts render it as a
                 bold line above the body so the caption isn't lost. */}
              {!!visiblePostTitle && (
                <Text variant="body" color={colors.text} style={{ fontFamily: 'Roboto-Medium', marginBottom: spacing.xs, lineHeight: 22 }}>
                  {visiblePostTitle}
                </Text>
              )}
              {renderMarkdownContent()}
              <MediaViewer
                media={displayPost.media}
                thumbnail={displayPost.image || displayPost.thumbnail}
                audioMeta={audioMeta}
                postContext={{
                  id: displayPost.id,
                  authorName: displayPost.author?.name || displayPost.author?.username,
                  authorUsername: displayPost.author?.username,
                  authorAvatar: displayPost.author?.image || displayPost.author?.avatar || null,
                  text: content,
                  imageDescription: displayPost.aiCaption || displayPost.ai_caption || content,
                  replyCount,
                }}
              />
              <LinkPreview url={embedUrl} content={content} hideImage={linkCardHidesImage} />
            </>
          )}
          {/* Quote post: the embedded original, X-style. Tappable → original. */}
          {isQuotePost && repostedFrom && (
            <QuoteEmbed
              quoted={repostedFrom}
              colors={colors}
              href={repostedFrom.id ? `/post/${repostedFrom.id}` : undefined}
              onPress={(e: any) => {
                e?.preventDefault?.();
                e?.stopPropagation?.();
                if (repostedFrom.id) router.push(`/post/${repostedFrom.id}` as any);
              }}
            />
          )}
        </View>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
          {post.tags.slice(0, 5).map((tag: any) => {
            const tagName = typeof tag === 'string' ? tag : tag.name || tag.slug;
            if (!tagName) return null;
            const tagHref = `/discover/posts?q=${encodeURIComponent(tagName)}`;
            return (
              <Pressable
                key={tagName}
                {...webHref(tagHref)}
                onPress={(e: any) => {
                  e?.preventDefault?.();
                  e?.stopPropagation?.();
                  router.push({ pathname: '/discover/posts', params: { q: tagName } } as any);
                }}
                accessibilityRole="link"
                accessibilityLabel={`View posts tagged #${tagName}`}
                style={{
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.glassBorder,
                }}
              >
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>#{tagName}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Action bar: votes (Minds signature, kept prominent) left, then a tight
          left-grouped cluster of reply/repost/bookmark/more — X-style rhythm. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          // space-between instead of a fixed gap: with live vote/reply/repost
          // counts the fixed-gap row grew past the screen edge and pushed the
          // ellipsis off-view. Distribution guarantees every action stays
          // visible at any count width (X's own approach), capped so the row
          // doesn't sprawl on wide screens.
          justifyContent: 'space-between',
          maxWidth: 425,
          marginTop: spacing.md,
        }}
      >
        <VoteButtons
          score={score}
          userVote={userVote}
          onUpvote={() => handleVote('upvote')}
          onDownvote={() => handleVote('downvote')}
          compact
        />

        <Pressable
          onPress={() => {
            if (onReply) {
              onReply(actionPostId);
              return;
            }
            router.push(`/post/${actionPostId}` as any);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Reply to post, ${replyCount} ${Number(replyCount) === 1 ? 'reply' : 'replies'}`}
          style={({ hovered }: any) => ({
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
            borderRadius: radius.full, paddingHorizontal: spacing.xs, paddingVertical: 3,
            backgroundColor: hovered ? colors.glass : 'transparent',
            ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease' } as any : {}),
          })}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted} style={{ fontSize: 14 }}>{formatCount(replyCount)}</Text>
        </Pressable>

        <Pressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            // X-style: tapping the repost icon opens a small action sheet with
            // "Repost" + "Quote Post" before auth, so signed-out viewers can
            // choose the intent that OTP needs to preserve.
            const pageX = e?.nativeEvent?.pageX ?? 0;
            const pageY = e?.nativeEvent?.pageY ?? 0;
            setRepostMenuPos({ x: pageX, y: pageY });
            setShowRepostMenu(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${myRepostId ? 'Repost options, currently reposted' : 'Repost options'}, ${repostCount} ${repostCount === 1 ? 'repost' : 'reposts'}`}
          accessibilityState={{ selected: !!myRepostId }}
          aria-pressed={!!myRepostId}
          hitSlop={8}
          style={({ hovered }: any) => ({
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
            borderRadius: radius.full, padding: spacing.xs,
            backgroundColor: hovered ? colors.glass : 'transparent',
            ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease' } as any : {}),
          })}
        >
          <Ionicons
            name={myRepostId ? 'repeat' : 'repeat-outline'}
            size={19}
            color={myRepostId ? colors.accent : colors.textMuted}
          />
          <Text variant="caption" color={myRepostId ? colors.accent : colors.textMuted} style={{ fontSize: 14 }}>{formatCount(repostCount)}</Text>
        </Pressable>

        <Pressable
          disabled={bookmarkSaving}
          onPress={async () => {
            if (bookmarkSaving) return;
            setBookmarkSaving(true);
            try {
              const result = await toggleBookmarkConfirmed(actionPostId);
              setSaved(result.saved);
              if (!result.persisted) {
                toast.show('Could not update saved posts. Try again.', 'error');
                return;
              }
              if (result.saved) haptics.tap();
              onBookmarkChange?.(actionPostId, result.saved);
              toast.show(result.saved ? 'Saved' : 'Removed from saved');
              logSignal(result.saved ? 'save' : 'hide', { postId: actionPostId, metadata: { source: 'postcard_bookmark' } });
            } finally {
              setBookmarkSaving(false);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove post from bookmarks' : 'Bookmark post'}
          accessibilityState={{ selected: saved, disabled: bookmarkSaving }}
          aria-pressed={saved}
          hitSlop={8}
          style={({ hovered }: any) => ({
            borderRadius: radius.full, padding: spacing.xs,
            backgroundColor: hovered ? colors.glass : 'transparent',
            ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease' } as any : {}),
          })}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={19} color={saved ? colors.accent : colors.textMuted} />
        </Pressable>

        {/* Ask your agent about this post (Grok-on-X style). Opens the personal
            agent DM seeded with the post's context. Server meters the LLM call
            against the user's Minds+/Pro allowance — a paid, usage-driving surface. */}
        <Pressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            setShowShare(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Share post"
          hitSlop={8}
          style={({ hovered }: any) => ({
            borderRadius: radius.full, padding: spacing.xs,
            backgroundColor: hovered ? colors.glass : 'transparent',
            ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease', cursor: 'pointer' } as any : {}),
          })}
        >
          <Ionicons name="paper-plane-outline" size={19} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            // Capture the page-relative position of the ellipsis so the menu
            // can render right next to it no matter where in the feed the
            // user clicked. React Native Web gives us nativeEvent.pageX/pageY;
            // native gives us pageX/pageY too.
            const pageX = e?.nativeEvent?.pageX ?? 0;
            const pageY = e?.nativeEvent?.pageY ?? 0;
            setMenuPos({ x: pageX, y: pageY });
            setShowMenu(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="More post actions"
          hitSlop={8}
          style={({ hovered }: any) => ({
            borderRadius: radius.full, padding: spacing.xs,
            backgroundColor: hovered ? colors.glass : 'transparent',
            ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease' } as any : {}),
          })}
        >
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.textMuted} />
        </Pressable>
      </View>
      {/* End content column */}
      </View>
      {/* End avatar + content row */}
      </View>

      {/* Context menu — rendered in a React Native Modal so it always sits on
          top of the feed (link previews, media, etc.) and pops up right next
          to the ellipsis regardless of scroll position. */}
      <Modal
        visible={showMenu}
        transparent
        // Native gets the platform-idiomatic BOTTOM SHEET (same slide-up feel
        // as the share sheet); desktop web keeps the pointer-anchored popover.
        animationType={Platform.OS === 'web' ? 'fade' : 'slide'}
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          onPress={() => setShowMenu(false)}
          style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: Platform.OS === 'web' ? undefined : 'flex-end' }}
        >
          {(() => {
            const MENU_WIDTH = 180;
            const screen = Dimensions.get('window');
            const isSheet = Platform.OS !== 'web';
            // Sheet (native): full-width bottom drawer with grab handle — the
            // same idiom as the share sheet. Popover (desktop web): anchored
            // at the pointer with on-screen clamping.
            const menuHeight = menuH || 260;
            const maxMenuH = screen.height - 16;
            const x = Math.min(Math.max(8, (menuPos?.x ?? 16) - MENU_WIDTH + 24), screen.width - MENU_WIDTH - 8);
            const y = Math.min(
              Math.max(8, (menuPos?.y ?? 16) + 8),
              Math.max(8, screen.height - Math.min(menuHeight, maxMenuH) - 8)
            );
            const containerStyle = isSheet
              ? {
                  width: '100%' as const,
                  backgroundColor: colors.surfaceRaised,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
                  paddingTop: spacing.sm,
                  paddingBottom: spacing['3xl'],
                  paddingHorizontal: spacing.md,
                }
              : {
                  position: 'absolute' as const,
                  top: y,
                  left: x,
                  width: MENU_WIDTH,
                  maxHeight: maxMenuH,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.xs,
                  ...( { boxShadow: '0 12px 48px rgba(0,0,0,0.9)', overflowY: 'auto' } as any ),
                };
            return (
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h && Math.abs(h - menuH) > 1) setMenuH(h);
                }}
                style={containerStyle}
              >
                {isSheet && (
                  <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, marginBottom: spacing.sm }} />
                )}
                {!isOwnPost && (
                  <>
                    <Pressable
                      onPress={async () => {
                        setShowMenu(false);
                        if (!sdk) {
                          signInToInteract();
                          return;
                        }
                        const topic = (post.title || '').slice(0, 80);
                        if (!topic) return;
                        toast.show('Looking for more like this');
                        try {
                          await (sdk as any)?.curator?.run?.({
                            sources: [{ type: 'web_search', query: topic, freshness: 'pw' }],
                            prompt: {
                              system: 'You are a personal curator agent. One-line take, max 20 words, no preamble.',
                              user_template: 'Title: {{title}}\nSource: {{source}}\nURL: {{url}}',
                            },
                            target_size: 8,
                          });
                        } catch {}
                      }}
                      style={{ padding: spacing.md }}
                    >
                      <Text variant="body">More like this</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setShowMenu(false);
                        const sourceHost = (() => {
                          try { return new URL(post.external_url || post.url || '').hostname.replace('www.', ''); }
                          catch { return ''; }
                        })();
                        const target = sourceHost || author.id;
                        if (!target) return;
                        toggleMute(target);
                        toast.show(`Less ${sourceHost || authorName} from now on`);
                      }}
                      style={{ padding: spacing.md }}
                    >
                      <Text variant="body">Less like this</Text>
                    </Pressable>
                  </>
                )}
                {isOwnPost && (
                  <Pressable onPress={() => { setShowMenu(false); router.push(`/boost?post=${post.id}` as any); }} style={{ padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="rocket-outline" size={16} color={colors.boost} />
                    <Text variant="body" color={colors.boost}>Boost</Text>
                  </Pressable>
                )}
                {isOwnPost && (
                  <Pressable onPress={() => { setShowMenu(false); setEditContent(content); setIsEditing(true); }} style={{ padding: spacing.md }}>
                    <Text variant="body">Edit</Text>
                  </Pressable>
                )}
                {canModerate && moderationPin && (post.community_id || post.communityId) && (
                  <Pressable
                    onPress={async () => {
                      setShowMenu(false);
                      const pinned = !!(post.pinned_at || post.pinnedAt);
                      try {
                        await moderationPin(post.id, !pinned);
                        toast.show(pinned ? 'Unpinned' : 'Pinned to the group');
                      } catch {
                        toast.show(pinned ? 'Could not unpin' : 'Could not pin', 'error');
                      }
                    }}
                    style={{ padding: spacing.md }}
                  >
                    <Text variant="body">{(post.pinned_at || post.pinnedAt) ? 'Unpin from group' : 'Pin to group'}</Text>
                  </Pressable>
                )}
                {(isOwnPost || canModerate) && (
                  <Pressable onPress={() => { setShowMenu(false); handleDelete(); }} style={{ padding: spacing.md }}>
                    <Text variant="body" color={colors.error}>{!isOwnPost && canModerate ? 'Remove from group' : 'Delete'}</Text>
                  </Pressable>
                )}
                {!isOwnPost && (
                  <Pressable
                    onPress={async () => {
                      setShowMenu(false);
                      if (!sdk) {
                        signInToInteract();
                        return;
                      }
                      const authorId = author.id;
                      if (!authorId) return;
                      // Instant local toggle (client-side feed filter), then
                      // persist to the server so mute follows the account across
                      // devices and drives server-side feed + notification hiding.
                      const muted = toggleMute(authorId);
                      toast.show(muted ? `Muted ${authorName}` : `Unmuted ${authorName}`);
                      try {
                        if (muted) await muteUser(authorId); else await unmuteUser(authorId);
                      } catch {
                        toggleMute(authorId); // revert local to stay consistent with server
                        toast.show('Could not update mute', 'error');
                      }
                    }}
                    style={{ padding: spacing.md }}
                  >
                    <Text variant="body">{isMuted(author.id) ? 'Unmute' : 'Mute'}</Text>
                  </Pressable>
                )}
                {!isOwnPost && (
                  <Pressable
                    onPress={async () => {
                      setShowMenu(false);
                      if (!sdk) {
                        signInToInteract();
                        return;
                      }
                      if (!author.id) return;
                      try {
                        await blockUser(author.id);
                        toast.show(`Blocked ${authorName}`);
                      } catch {
                        toast.show('Could not block', 'error');
                      }
                    }}
                    style={{ padding: spacing.md }}
                  >
                    <Text variant="body" color={colors.error}>Block {authorName}</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => {
                    setShowMenu(false);
                    if (!sdk) {
                      signInToInteract();
                      return;
                    }
                    setShowReport(true);
                  }}
                  style={{ padding: spacing.md }}
                >
                  <Text variant="body" color={colors.error}>Report</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setShowMenu(false);
                    // SITE_URL, not BASE_ORIGIN — BASE_ORIGIN is the API host,
                    // and shared links must point at the app.
                    const url = `${SITE_URL}/post/${actionPostId}`;
                    try {
                      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
                        if (navigator.share) {
                          await navigator.share({ title: post.title || 'Post on Isle of Wight Social', url });
                        } else if (navigator.clipboard) {
                          await navigator.clipboard.writeText(url);
                          toast.show('Link copied');
                        } else {
                          toast.show('Could not share post', 'error');
                        }
                      } else {
                        const { Share } = require('react-native');
                        await Share.share({ message: url });
                      }
                    } catch (error) {
                      if ((error as { name?: string })?.name !== 'AbortError') {
                        toast.show('Could not share post', 'error');
                      }
                    }
                  }}
                  style={{ padding: spacing.md }}
                >
                  <Text variant="body">Share</Text>
                </Pressable>
              </View>
            );
          })()}
        </Pressable>
      </Modal>

      {/* Repost action sheet — X-style two-option menu anchored to the repost
          icon: "Repost" (instant reshare / undo) and "Quote Post" (opens the
          composer pre-seeded with this post embedded). */}
      <Modal
        visible={showRepostMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRepostMenu(false)}
      >
        <Pressable
          onPress={() => setShowRepostMenu(false)}
          style={{ flex: 1, backgroundColor: colors.scrim }}
        >
          {(() => {
            const MENU_WIDTH = 200;
            const screen = Dimensions.get('window');
            const menuHeight = 110;
            const x = Math.min(
              Math.max(8, (repostMenuPos?.x ?? 16) - MENU_WIDTH / 2),
              screen.width - MENU_WIDTH - 8,
            );
            const y = Math.min(
              Math.max(8, (repostMenuPos?.y ?? 16) + 8),
              Math.max(8, screen.height - menuHeight - 8),
            );
            return (
              <View
                style={{
                  position: 'absolute',
                  top: y,
                  left: x,
                  width: MENU_WIDTH,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.xs,
                  ...(Platform.OS === 'web' ? { boxShadow: '0 12px 48px rgba(0,0,0,0.9)' } as any : { elevation: 12 }),
                }}
              >
                <Pressable
                  onPress={(e: any) => { e?.stopPropagation?.(); setShowRepostMenu(false); doRepost(); }}
                  style={({ hovered }: any) => ({
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
                    borderRadius: radius.sm,
                    backgroundColor: hovered ? colors.surfaceHover : 'transparent',
                    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                  })}
                >
                  <Ionicons name={myRepostId ? 'repeat' : 'repeat-outline'} size={18} color={myRepostId ? colors.accent : colors.text} />
                  <Text variant="body" color={myRepostId ? colors.accent : colors.text}>{myRepostId ? 'Undo remind' : 'Remind'}</Text>
                </Pressable>
                <Pressable
                  onPress={(e: any) => { e?.stopPropagation?.(); setShowRepostMenu(false); openQuoteComposer(); }}
                  style={({ hovered }: any) => ({
                    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
                    borderRadius: radius.sm,
                    backgroundColor: hovered ? colors.surfaceHover : 'transparent',
                    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                  })}
                >
                  <Ionicons name="create-outline" size={18} color={colors.text} />
                  <Text variant="body">Quote Post</Text>
                </Pressable>
              </View>
            );
          })()}
        </Pressable>
      </Modal>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={handleReport}
      />
      {showShare ? (
        <SharePostSheet visible post={displayPost} onClose={() => setShowShare(false)} />
      ) : null}
    </Pressable>
  );
});
