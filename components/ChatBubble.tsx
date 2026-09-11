import * as React from 'react';
import { View, Platform, Pressable, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { MediaViewer } from './MediaViewer';
import { SharedPostCard } from './SharedPostCard';
import { LinkPreview } from './LinkPreview';
import { isSafeUrl, parseMarkdownSegments, renderMarkdownToHtml } from '../lib/markdown';
import { MarkdownScopedStyles, MARKDOWN_CLASS, OWN_CLASS } from './MarkdownStyles';
import { spacing, radius } from '../constants/theme';
import { useTheme } from '../lib/theme';

interface Props {
  message: any;
  isOwn: boolean;
  // When true and this is the agent's message, render Claude-style: full-width
  // plain text, no bubble. User messages stay in a bubble. For human DMs leave
  // this false and both sides render as iMessage bubbles.
  agentChat?: boolean;
  // Tap-to-retry for a failed optimistic send. Wired by the chat screen; when
  // absent the failed row still shows its "Not delivered" state, just without
  // the retry affordance.
  onRetry?: (message: any) => void;
  // Tap-and-hold → open the message action menu (react / reply / copy). The
  // second arg carries the press coordinates so the menu can anchor near the bubble.
  onLongPress?: (message: any, pos?: { x: number; y: number }) => void;
  // Tap an existing reaction pill to toggle your own reaction.
  onReactPill?: (message: any, emoji: string) => void;
  // The message this one is replying to (resolved by the chat screen), shown as
  // a quoted snippet above the content.
  quoted?: { name: string; text: string } | null;
  // Current user id, to show which reaction pill YOU applied.
  myUserId?: string;
}

// A message can carry media two ways: a structured `media` array (server) or a
// bare uploaded URL in the content (client attachment path). Detect either.
const MEDIA_RE = /(https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|mp4|webm|mov|m4v|m4a|mp3|wav|ogg)(?:\?\S*)?|https?:\/\/pub-[a-z0-9]+\.r2\.dev\/\S+|https?:\/\/[a-z0-9.-]*minds-uploads[^\s]*)/i;

export const ChatBubble = React.memo(function ChatBubble({ message, isOwn, onRetry, onLongPress, onReactPill, quoted, myUserId }: Props) {
  const { colors, isDark } = useTheme();
  // Aggregate reactions by emoji: { [emoji]: { count, mine } }.
  const reactionGroups = React.useMemo(() => {
    const raw: any[] = message.reactions || [];
    const m = new Map<string, { count: number; mine: boolean }>();
    for (const r of raw) {
      const t = r.type || r.emoji; if (!t) continue;
      const prev = m.get(t) || { count: 0, mine: false };
      prev.count += 1;
      if ((r.user_id ?? r.userId) === myUserId) prev.mine = true;
      m.set(t, prev);
    }
    return [...m.entries()];
  }, [message.reactions, myUserId]);
  const content = message.content || message.text || message.body || '';
  // Attachment: prefer a structured media array (server), else a bare uploaded
  // URL in the content (client attachment path). bodyText hides the raw URL.
  const mediaArr = Array.isArray(message.media) ? message.media : null;
  const mediaUrl: string | null = mediaArr?.length
    ? (typeof mediaArr[0] === 'string' ? mediaArr[0] : mediaArr[0]?.url) || null
    : (content.match(MEDIA_RE)?.[0] || null);
  // A shared Minds post → render a rich embed, tappable back to the post.
  const sharedPostId: string | null = content.match(/\/post\/([0-9a-fA-F-]{8,})/)?.[1] || null;
  let bodyText = mediaUrl && !mediaArr ? content.replace(mediaUrl, '').trim() : content;
  if (sharedPostId) bodyText = bodyText.replace(/\S*\/post\/[0-9a-fA-F-]{8,}\S*/, '').trim();
  // Never render an empty bubble. A streaming placeholder legitimately starts
  // empty (caret only), but a non-streaming empty message with no media is a
  // tool-only agent turn or a glitch and must not show as a blank box.
  if (!content.trim() && !mediaUrl && message.streaming !== true) return null;
  const timestamp = message.createdAt || message.created_at || '';
  // Render markdown LIVE, even while streaming — bold/lists/code form as the
  // text types out, the way Claude does it (not raw markdown that snaps to
  // formatted only when finished). The reveal is rAF-paced so the per-frame
  // re-parse stays cheap for normal message lengths.
  const hasMarkdown = /[*`#\[\]]/.test(bodyText);
  // Streaming bubbles show a caret + skip the trailing timestamp so the
  // bubble doesn't bounce-resize as new chunks land. Once `streaming`
  // goes false the timestamp + final layout render normally.
  const isStreaming = message.streaming === true;
  // Delivery state for the user's own optimistic rows (iMessage semantics):
  //   pending  → in flight (dim + a tiny clock), reconciles to a real id
  //   failed   → server never confirmed; show "Not delivered" + tap to retry
  const isPending = isOwn && message.pending === true && message.failed !== true;
  const isFailed = isOwn && message.failed === true;
  // A pasted external link gets the same rich card as the feed (iMessage/X
  // parity). Media attachments and shared-post embeds already render their own
  // block, and streaming text may hold a half-typed URL — skip those.
  const showLinkPreview =
    !mediaUrl && !sharedPostId && !isStreaming && /https?:\/\//.test(bodyText);

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const textColor = isOwn ? colors.textOnAccent : colors.text;
  const linkColor = isOwn ? colors.textOnAccent : colors.accent;

  const renderContent = () => {
    if (!hasMarkdown) {
      return <Text variant="body" color={textColor}>{bodyText}</Text>;
    }

    // Web: render as HTML for full markdown support
    if (Platform.OS === 'web') {
      // Bare tags, themed by the shared stylesheet. This used to rewrite the
      // renderer's hardcoded hexes out of the generated HTML by string replace,
      // which only worked while nobody changed that palette and did nothing
      // about the code/pre backgrounds.
      const html = renderMarkdownToHtml(bodyText, { bare: true });
      return (
        <>
        <MarkdownScopedStyles />
        <div
          className={isOwn ? `${MARKDOWN_CLASS} ${OWN_CLASS}` : MARKDOWN_CLASS}
          style={{ color: textColor, fontSize: 15, lineHeight: '22px', fontFamily: 'Roboto-Regular', wordBreak: 'break-word' as any }}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML comes from renderMarkdownToHtml, which escapes all user input before formatting.
          dangerouslySetInnerHTML={{ __html: html }}
        />
        </>
      );
    }

    // Native: use segment parser
    const segments = parseMarkdownSegments(bodyText);
    return (
      <Text variant="body" color={textColor}>
        {segments.map((seg, i) => {
          if (seg.type === 'bold') return <Text key={i} variant="bodyMedium" color={textColor}>{seg.text}</Text>;
          if (seg.type === 'italic') return <Text key={i} variant="body" color={textColor} style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
          if (seg.type === 'code') return <Text key={i} variant="mono" color={colors.textSecondary} style={{ backgroundColor: colors.surfaceRaised, paddingHorizontal: 4, borderRadius: radius.sm }}>{seg.text}</Text>;
          if (seg.type === 'break') return <Text key={i}>{'\n'}</Text>;
          // Native had no link case at all, so a link in a chat message rendered
          // as ordinary text and could not be opened. linkColor was declared for
          // this and never used.
          if (seg.type === 'link') {
            return (
              <Text
                key={i}
                color={linkColor}
                style={{ textDecorationLine: 'underline' }}
                onPress={() => { if (isSafeUrl(seg.url)) Linking.openURL(seg.url).catch(() => {}); }}
              >
                {seg.text}
              </Text>
            );
          }
          return <Text key={i}>{seg.text}</Text>;
        })}
      </Text>
    );
  };

  return (
    <View
      style={{
        alignSelf: isOwn ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginBottom: spacing.sm,
      }}
    >
      <Pressable
        onLongPress={(e: any) => onLongPress?.(message, { x: e?.nativeEvent?.pageX ?? 0, y: e?.nativeEvent?.pageY ?? 0 })}
        delayLongPress={320}
        style={{
          // Incoming (human OR AI) needs a visible fill: in light mode
          // surfaceRaised is white (= the page), so bubbles vanished. Use a soft
          // grey in light, the raised surface in dark.
          backgroundColor: isOwn
            ? (isFailed ? colors.error : colors.accent)
            : (isDark ? colors.surfaceRaised : '#edeff2'),
          // Own bubble: a subtle diagonal light-sheen over the accent (web) gives
          // it a lighter, more dimensional, "futuristic" feel than the flat gold —
          // theme-safe (works on any accent, light or dark) with no gradient dep.
          ...(Platform.OS === 'web' && isOwn && !isFailed
            ? { backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 45%, rgba(0,0,0,0.06) 100%)' } as any
            : {}),
          opacity: isPending ? 0.6 : 1,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: 20,
          borderBottomRightRadius: isOwn ? radius.sm : 20,
          borderBottomLeftRadius: isOwn ? 20 : radius.sm,
        }}
      >
        {/* Reply quote — the message this one is answering, iMessage/WhatsApp style. */}
        {quoted ? (
          <View style={{ borderLeftWidth: 2, borderLeftColor: isOwn ? colors.textOnAccent : colors.accent, paddingLeft: spacing.sm, marginBottom: spacing.xs, opacity: 0.9 }}>
            <Text variant="caption" color={textColor} numberOfLines={1} style={{ fontWeight: '700' }}>{quoted.name}</Text>
            <Text variant="caption" color={textColor} numberOfLines={1} style={{ opacity: 0.8 }}>{quoted.text}</Text>
          </View>
        ) : null}
        {/* Attachment media (image / video / audio), rendered like the feed. */}
        {mediaUrl ? (
          <View style={{ marginBottom: bodyText ? spacing.xs : 0, marginHorizontal: -spacing.xs, borderRadius: radius.md, overflow: 'hidden', minWidth: 180 }}>
            <MediaViewer media={mediaUrl} />
          </View>
        ) : null}
        {/* Shared Minds post embed. */}
        {sharedPostId ? (
          <View style={{ marginBottom: bodyText ? spacing.xs : 0 }}>
            <SharedPostCard postId={sharedPostId} />
          </View>
        ) : null}
        {(bodyText || isStreaming) ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flexShrink: 1 }}>{renderContent()}</View>
            {isStreaming ? <StreamingCaret color={textColor} /> : null}
          </View>
        ) : null}
        {showLinkPreview ? (
          <View style={{ minWidth: 230, maxWidth: '100%' }}>
            <LinkPreview content={bodyText} />
          </View>
        ) : null}
      </Pressable>
      {/* Reaction pills — tap one to toggle your own reaction. */}
      {reactionGroups.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3, alignSelf: isOwn ? 'flex-end' : 'flex-start' }}>
          {reactionGroups.map(([emoji, g]) => (
            <Pressable
              key={emoji}
              onPress={() => onReactPill?.(message, emoji)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 3,
                backgroundColor: g.mine ? colors.accentMuted : colors.surfaceRaised,
                borderWidth: 0.5, borderColor: g.mine ? colors.accent : colors.borderSubtle,
                borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              }}
            >
              <Text style={{ fontSize: 12 }}>{emoji}</Text>
              {g.count > 1 ? <Text variant="caption" color={colors.textSecondary} style={{ fontSize: 11 }}>{g.count}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      {/* Failed send: clear "Not delivered" + tap-to-retry, iMessage-style. */}
      {isFailed ? (
        <Pressable
          onPress={() => onRetry?.(message)}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: spacing.xs,
            alignSelf: 'flex-end',
            opacity: pressed ? 0.6 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Ionicons name="alert-circle" size={13} color={colors.error} />
          <Text variant="caption" color={colors.error} style={{ fontSize: 11 }}>
            Not delivered{onRetry ? ' · Tap to retry' : ''}
          </Text>
        </Pressable>
      ) : isPending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing.xs, alignSelf: 'flex-end' }}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>Sending…</Text>
        </View>
      ) : !isStreaming && formattedTime ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{
            marginTop: spacing.xs,
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
            fontSize: 11,
          }}
        >
          {formattedTime}
        </Text>
      ) : null}
    </View>
  );
});

// Blinking block caret rendered at the end of a streaming bubble.
// Plain CSS @keyframes on web; alpha fade via Animated on native.
function StreamingCaret({ color }: { color: string }) {
  if (Platform.OS === 'web') {
    return (
      <>
        <style>{"@keyframes mindsCaretBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }"}</style>
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 16,
            marginLeft: 4,
            marginBottom: 2,
            backgroundColor: color,
            animationName: 'mindsCaretBlink',
            animationDuration: '900ms',
            animationIterationCount: 'infinite',
            verticalAlign: 'middle',
          } as any}
        />
      </>
    );
  }
  return <NativeBlinkCaret color={color} />;
}

function NativeBlinkCaret({ color }: { color: string }) {
  const { Animated } = require('react-native');
  const opacity = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 450, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={{
        width: 7,
        height: 16,
        marginLeft: 4,
        marginBottom: 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}
