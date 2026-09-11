import * as React from 'react';
import { View, FlatList, TextInput, Pressable, Platform } from 'react-native';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import { showToast } from '../../components/Toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, PostCard, Avatar, Skeleton, RightRailLayout, Button } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { usePost, useSimilarPosts } from '../../lib/hooks';
import { usePageTitle } from '../../lib/usePageTitle';
import { isArticlePost, postReplyCount, postScore, postTitle, postUserVote } from '../../lib/models';
import { ORG_ID } from '../../lib/recursiv';
import { getCached, getCacheGeneration, setCache, invalidate, patchPostInCaches } from '../../lib/cache';
import { captureException } from '../../lib/monitoring';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors, useInputKeyboardProps } from '../../lib/theme';
import { useKeyboardVisible } from '../../lib/useKeyboardVisible';
import { otpSignInPath } from '../../lib/authRedirect';

function withAcceptedReply(post: any, postId: string, reply: any) {
  if (post?.id !== postId) return post;
  const existing = Array.isArray(post.replies) ? post.replies : [];
  const alreadyPresent = existing.some((item: any) => item.id === reply.id);
  const replies = alreadyPresent ? existing : [...existing, reply];
  const count = Math.max(postReplyCount(post) + (alreadyPresent ? 0 : 1), replies.length);
  return { ...post, replies, repliesCount: count, replyCount: count, reply_count: count };
}

export default function PostDetailScreen() {
  const { id, reaction, reply, repost } = useLocalSearchParams<{
    id: string;
    reaction?: string;
    reply?: string;
    repost?: string;
  }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();
  const keyboardVisible = useKeyboardVisible();
  const { post, setPost, loading, error, viewerStateResolved, refresh } = usePost(id);
  // Long-form gets the reader treatment: no rail, a wider measure, and a header
  // that says what it is.
  const isArticle = isArticlePost(post);
  const postAuthor =
    post?.author?.name || post?.author?.username || post?.user?.name || post?.user?.username;
  usePageTitle(
    post ? (postTitle(post) || (postAuthor ? `${postAuthor} on Wight.social` : 'Post — Wight.social')) : null,
  );
  // "More like this" — semantically related posts so the page never dead-ends.
  const { posts: similar, loading: similarLoading } = useSimilarPosts(id, 10);
  const [replies, setReplies] = React.useState<any[]>([]);
  const [repliesLoading, setRepliesLoading] = React.useState(true);
  const [replyText, setReplyText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  // Drafts and pending sends belong to a post within this authenticated session,
  // not whichever route happens to be visible when a request settles.
  const replyUserId = user?.id;
  const replySession = React.useMemo(() => ({
    sdk,
    userId: replyUserId,
    drafts: new Map<string, { text: string }>(),
    attempts: new Map<string, { detail: any }>(),
  }), [sdk, replyUserId]);
  const replyOwner = React.useMemo(() => ({ id, session: replySession }), [id, replySession]);
  const activeReplyOwner = React.useRef<typeof replyOwner | null>(null);
  React.useLayoutEffect(() => {
    activeReplyOwner.current = replyOwner;
    setReplyText(replyOwner.session.drafts.get(replyOwner.id)?.text ?? '');
    setSubmitting(replyOwner.session.attempts.has(replyOwner.id));
    return () => { activeReplyOwner.current = null; };
  }, [replyOwner]);
  React.useLayoutEffect(() => {
    const attempt = replySession.attempts.get(id);
    if (attempt && post?.id === id && Array.isArray(post.replies)) {
      // Feed fetches can replace post:<id> with a summary. Retain the latest
      // loaded thread on its pending send, even after navigating elsewhere.
      attempt.detail = post;
    }
  }, [id, post, replySession]);
  const changeReplyText = (text: string) => {
    replySession.drafts.set(id, { text });
    setReplyText(text);
  };
  const replyInputRef = React.useRef<TextInput>(null);
  const reactionIntentStartedRef = React.useRef<string | null>(null);
  const replyIntentStartedRef = React.useRef<string | null>(null);
  const clearRepostIntent = React.useCallback(() => {
    if (!id) return;
    router.replace(`/post/${id}` as any);
  }, [id, router]);
  const signInToInteract = React.useCallback(() => {
    if (!id) return;
    router.push(otpSignInPath(`/post/${id}?reply=1`) as any);
  }, [id, router]);
  const handleReplyPress = React.useCallback((replyToId: string) => {
    if (!sdk) {
      router.push(otpSignInPath(`/post/${replyToId}?reply=1`) as any);
      return;
    }
    // A bare repost displays the original post's engagement. Preserve that
    // targeting instead of composing a reply against the wrapper row.
    if (replyToId !== id) {
      router.push(`/post/${replyToId}` as any);
      return;
    }
    replyInputRef.current?.focus();
  }, [id, router, sdk]);

  React.useEffect(() => {
    if (reply !== '1') {
      replyIntentStartedRef.current = null;
      return;
    }
    if (
      !sdk ||
      !user ||
      !id ||
      !post ||
      post.id !== id ||
      replyIntentStartedRef.current === id
    ) return;
    replyIntentStartedRef.current = id;
    router.replace(`/post/${id}` as any);
    replyInputRef.current?.focus();
  }, [reply, sdk, user, id, post, router]);

  React.useEffect(() => {
    const desiredReaction = reaction === 'upvote' || reaction === 'downvote' ? reaction : null;
    const intentKey = desiredReaction && id ? `${id}:${desiredReaction}` : null;
    if (
      !desiredReaction ||
      !sdk ||
      !user ||
      !id ||
      !post ||
      post.id !== id ||
      !viewerStateResolved ||
      reactionIntentStartedRef.current === intentKey
    ) return;

    reactionIntentStartedRef.current = intentKey;
    router.replace(`/post/${id}` as any);

    const previousReaction = postUserVote(post);
    if (previousReaction === desiredReaction) return;

    const previousScore = postScore(post);
    const nextScore = previousScore + (desiredReaction === 'upvote' ? 1 : -1) +
      (previousReaction === 'downvote' ? 1 : previousReaction === 'upvote' ? -1 : 0);
    const patch = {
      score: nextScore,
      userReaction: desiredReaction,
      user_reaction: desiredReaction,
    };

    setPost((current: any) => current?.id === id ? { ...current, ...patch } : current);
    setCache(`post:${id}`, { ...post, ...patch });
    patchPostInCaches(id, patch);

    void (async () => {
      try {
        if (previousReaction) await sdk.posts.unreact(id);
        await sdk.posts.react(id, desiredReaction);
      } catch (err) {
        const rollback = {
          score: previousScore,
          userReaction: previousReaction,
          user_reaction: previousReaction,
        };
        setPost((current: any) => current?.id === id ? { ...current, ...rollback } : current);
        setCache(`post:${id}`, { ...post, ...rollback });
        patchPostInCaches(id, rollback);
        showToast('Vote failed — try again', 'error');
        captureException(err, { action: 'resumeVoteAfterSignIn', postId: id });
      }
    })();
  }, [reaction, sdk, user, id, post, viewerStateResolved, router, setPost]);

  // Keep replies in sync with the post detail response WHENEVER it changes —
  // not just on first land. Previously this was keyed on post?.id and ran once
  // per post, so replies fetched by the background revalidate (yours or other
  // people's) never appeared until a full refresh. We merge by id and preserve
  // any local optimistic replies the server hasn't returned yet, so a freshly
  // posted reply is never clobbered by a lagging server list.
  // Navigating between posts reuses this screen instance, so reset replies when
  // the post id changes. Without this, the optimistic-merge below preserves the
  // PREVIOUS post's replies and they show on every subsequent post.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the route id owns this reset.
  React.useEffect(() => {
    setReplies([]);
    setRepliesLoading(true);
  }, [id]);

  React.useEffect(() => {
    // Ignore a stale post object from the previous route until the fetch for
    // THIS id lands — otherwise its replies would merge into the new post.
    if (!post || post.id !== id) return;
    // A feed-cached post has no `replies` key — only the detail response does.
    // Syncing from the cached object cleared the loading state with zero
    // replies, flashing "No replies yet" before the real list arrived. Keep
    // the skeleton up until a response that actually carries replies lands.
    if (!Array.isArray(post.replies)) return;
    const serverReplies = post.replies || [];
    setReplies(prev => {
      const byId = new Map<string, any>();
      for (const r of serverReplies) if (r?.id) byId.set(r.id, r);
      // Preserve only optimistic replies that belong to THIS post.
      for (const r of prev) {
        const rt = r?.reply_to_id ?? r?.replyToId ?? id;
        if (r?.id && !byId.has(r.id) && rt === id) byId.set(r.id, r);
      }
      return Array.from(byId.values()).sort((a, b) =>
        new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime()
      );
    });
    setRepliesLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, id]);

  const handleReply = async () => {
    if (!replyText.trim() || !sdk || !id || replySession.attempts.has(id)) return;
    const attempt = { detail: post };
    replySession.attempts.set(id, attempt);
    setSubmitting(true);
    const submittedDraft = replyText;
    const submittedEntry = replySession.drafts.get(id);
    const text = submittedDraft.trim();
    const cacheGeneration = getCacheGeneration();
    const ownsSession = () => activeReplyOwner.current?.session === replySession &&
      getCacheGeneration() === cacheGeneration;
    const ownsPost = () => ownsSession() && activeReplyOwner.current?.id === id;

    try {
      const res = await sdk.posts.create({
        content: text,
        reply_to_id: id,
        organization_id: ORG_ID || undefined,
      });
      if (res.data) {
        // Never write into a new account's cache, or settle an unmounted editor.
        if (!ownsSession()) return;
        const draftUnchanged = replySession.drafts.get(id) === submittedEntry;
        if (draftUnchanged) replySession.drafts.delete(id);
        const newReply = {
          tags: [],
          reactions_count: 0,
          reply_count: 0,
          ...res.data,
          reply_to_id: id,
          author: { id: user?.id, name: user?.name, username: user?.username, image: user?.image },
        };
        // Persist only the original post. Keep cache writes outside React state
        // updaters, which may run more than once, and dedupe a reply already
        // received by background revalidation before create() resolved.
        const cachedPost = getCached(`post:${id}`);
        const detail = cachedPost?.id === id && Array.isArray(cachedPost.replies)
          ? cachedPost
          : attempt.detail;
        const updated = withAcceptedReply(detail, id, newReply);
        if (updated?.id === id) setCache(`post:${id}`, updated);
        if (ownsPost()) {
          if (draftUnchanged) setReplyText(current => ownsPost() && current === submittedDraft ? '' : current);
          setReplies(prev => {
            if (!ownsPost()) return prev;
            return prev.some(item => item.id === newReply.id) ? prev : [...prev, newReply];
          });
          setPost((current: any) => {
            if (!ownsPost()) return current;
            return withAcceptedReply(current, id, newReply);
          });
        }
        // Drop any stale feed cache so reply_count in the feed matches reality
        // after the user navigates back.
        invalidate('posts:latest:20');
        invalidate('posts:latest:50');
      }
    } catch (err) {
      // The editor still holds the user's draft, including any newer edits.
      if (ownsPost()) {
        showToast('Reply failed — your draft was kept', 'error');
      }
      captureException(err, { action: 'reply', postId: id });
    }
    finally {
      if (replySession.attempts.get(id) === attempt) {
        replySession.attempts.delete(id);
        if (ownsPost()) {
          setSubmitting(current => ownsPost() ? false : current);
        }
      }
    }
  };

  if (loading && !post) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Post" />
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton width={140} height={14} />
          <Skeleton height={60} />
        </View>
      </Container>
    );
  }

  if (error && !post) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Post" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl }}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
          <Text variant="h2" color={colors.text}>Couldn't load post</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320 }}>
            Check your connection and try again.
          </Text>
          <Button onPress={refresh} size="sm">Retry</Button>
        </View>
      </Container>
    );
  }

  if (!post) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Post" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>Post not found</Text>
        </View>
      </Container>
    );
  }

  // The detail endpoint pages the reply bodies, so `replies.length` is only
  // what this screen has loaded (currently capped at 50). Keep the thread
  // heading aligned with the canonical total shown on the post action while
  // still falling back to the loaded list for older response shapes.
  const replyTotal = Math.max(postReplyCount(post), replies.length);

  return (
    <KeyboardAvoid style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScreenHeader title={isArticle ? 'Article' : 'Post'} />

      {/* An article is a reading surface. The rail is a browsing surface, and
          putting discovery cards alongside a long read competes with the thing
          the reader came for — so an article gets the column to itself, at a
          measure meant for prose rather than for a feed. */}
      <RightRailLayout context="feed" rail={isArticle ? false : undefined} maxWidth={isArticle ? 720 : 600}>
      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* X-style conversation context: the chain of posts the focal post
                is replying to (thread root -> direct parent), rendered above it
                as compact, tappable cards so you never land in a reply blind. */}
            {Array.isArray((post as any).ancestors) &&
              (post as any).ancestors.map((a: any) => (
                // X-style thread rail: a vertical connector runs from each
                // ancestor's avatar down into the next card, so the chain
                // reads as one conversation.
                <View key={a.id} style={{ position: 'relative' }}>
                  <PostCard post={a} compact />
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      left: 35,
                      top: 52,
                      bottom: -2,
                      width: 2,
                      backgroundColor: colors.borderSubtle,
                    }}
                  />
                </View>
              ))}
            <PostCard
              key={post.id}
              post={post}
              onReply={handleReplyPress}
              resumeRepostIntent={
                repost === '1' && !!sdk && !!user && viewerStateResolved
              }
              onRepostIntentResumed={clearRepostIntent}
            />
            {error ? (
              <View style={{ padding: spacing.xl, gap: spacing.sm }}>
                <Text variant="body">Couldn't refresh this post</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  Showing saved content. Replies may be incomplete.
                </Text>
                <Button onPress={refresh} size="sm">Retry</Button>
              </View>
            ) : loading ? (
              <View style={{ padding: spacing.xl }}>
                <Text variant="caption" color={colors.textSecondary}>Refreshing post…</Text>
              </View>
            ) : null}
            {replyTotal > 0 && (
              <View
                style={{
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.borderSubtle,
                }}
              >
                <Text variant="caption" color={colors.textSecondary}>
                  {replyTotal} {replyTotal === 1 ? 'reply' : 'replies'}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} compact />}
        ListFooterComponent={
          // "More like this" — a clearly-differentiated section below the
          // replies so the post page cascades into related content instead of
          // dead-ending. Hidden until we have results (graceful empty state).
          // Only surface RECENT related posts — semantic similarity was
          // dredging up years-old content, which read as a broken feed. Past
          // year only; the whole section disappears rather than pad with
          // ancient posts.
          (() => {
            const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
            const recent = similar.filter((p: any) => {
              const t = new Date(p.createdAt || p.created_at || 0).getTime();
              return t >= oneYearAgo;
            });
            if (similarLoading || recent.length === 0) return null;
            return (
              <View style={{ marginTop: spacing['2xl'] }}>
                {/* Hard visual break from the reply thread: thick divider +
                    header block so this clearly reads as a new section, not
                    more replies. */}
                <View style={{ height: 8, backgroundColor: colors.surface }} />
                <View
                  style={{
                    paddingHorizontal: spacing.xl,
                    paddingTop: spacing.lg,
                    paddingBottom: spacing.md,
                    borderTopWidth: 0.5,
                    borderBottomWidth: 0.5,
                    borderColor: colors.borderSubtle,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text variant="h3">More posts like this</Text>
                  <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                    Related from the past year
                  </Text>
                </View>
                {recent.map((p: any) => (
                  <PostCard key={p.id} post={p} compact />
                ))}
              </View>
            );
          })()
        }
        ListEmptyComponent={
          error ? null : !repliesLoading ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.xs }}>
              {/* The count above can exceed the replies we hold (the count is
                  an external figure). Say nothing about why: a plain state,
                  never a note about where replies come from. */}
              {replyTotal > 0 ? null : (
                <Text variant="body" color={colors.textMuted}>No replies yet</Text>
              )}
            </View>
          ) : (
            <View style={{ padding: spacing.xl, gap: spacing.md }}>
              {[1, 2].map(i => <Skeleton key={i} height={60} />)}
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Reply input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          // Collapse the home-indicator inset while the keyboard covers it.
          paddingBottom: keyboardVisible ? spacing.sm : (insets.bottom || spacing.md),
        }}
      >
        {sdk ? (
          <>
            <TextInput
              ref={replyInputRef}
              {...kbProps}
              placeholder="Write a reply..."
              placeholderTextColor={colors.textMuted}
              value={replyText}
              onChangeText={changeReplyText}
              multiline
              onKeyPress={(e: any) => {
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  handleReply();
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.glassBorder,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                color: colors.text,
                maxHeight: 100,
                ...typography.input,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            <Pressable
              onPress={handleReply}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
              accessibilityState={{ disabled: !replyText.trim() || submitting, busy: submitting }}
              aria-busy={submitting}
              disabled={!replyText.trim() || submitting}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: replyText.trim() ? (pressed ? colors.accentHover : colors.accent) : colors.surfaceHover,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Ionicons name="send" size={16} color={replyText.trim() ? '#fff' : colors.textMuted} />
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={signInToInteract}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              borderRadius: radius.lg,
              backgroundColor: pressed ? colors.accentHover : colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text variant="bodyMedium" color="#fff">Sign in to reply</Text>
          </Pressable>
        )}
      </View>
      </RightRailLayout>
    </KeyboardAvoid>
  );
}
