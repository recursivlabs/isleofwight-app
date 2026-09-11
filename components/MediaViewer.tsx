import * as React from 'react';
import { View, Image as RNImage, Pressable, Modal, Platform, Dimensions, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS, interpolate } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { VideoPlayer } from './VideoPlayer';
import { InlineAudioPlayer } from './audio/InlineAudioPlayer';
import { isAudioUrl, type AudioTrack } from '../lib/audio/types';
import { audioTrackIdFromUrl } from '../lib/audio/trackId';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { SITE_URL } from '../lib/recursiv';
import { extractVideoGuid, getVideoStatus, type VideoStatus } from '../lib/video';

/**
 * Video media that gates playback on encode status: while Bunny is still
 * transcoding it shows the thumbnail + a "Processing…" overlay (polling until
 * ready) instead of a dead 0:00 player, then swaps in the real player.
 */
function VideoMedia({ url, height }: { url: string; height: number }) {
  const guid = React.useMemo(() => extractVideoGuid(url), [url]);
  // Non-Bunny URL (no guid) → play directly, no status gating.
  const [status, setStatus] = React.useState<VideoStatus | null>(
    guid ? null : { status: 'ready', progress: 100, thumbnailUrl: null, hlsUrl: url },
  );

  React.useEffect(() => {
    if (!guid) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const startedAt = Date.now();
    const poll = async () => {
      const s = await getVideoStatus(guid);
      if (!alive) return;
      // If the status lookup fails outright, optimistically try to play.
      setStatus(s ?? { status: 'ready', progress: 100, thumbnailUrl: null, hlsUrl: url });
      if (s && (s.status === 'processing' || s.status === null)) {
        // Backoff with a hard stop. A fixed 4s poll with no cap meant a video
        // whose encode webhook was lost kept EVERY viewer polling forever —
        // a popular stuck video becomes a self-inflicted DDoS on the status
        // route.
        if (Date.now() - startedAt > 10 * 60_000) return;
        attempt += 1;
        timer = setTimeout(poll, Math.min(4000 * 2 ** Math.min(attempt - 1, 4), 60_000));
      }
    };
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [guid, url]);

  if (status?.status === 'ready') {
    return <VideoPlayer uri={status.hlsUrl || url} poster={status.thumbnailUrl || undefined} height={height} />;
  }
  if (status?.status === 'failed') {
    return <VideoStatusBox thumbnail={status.thumbnailUrl} label="Video couldn't be processed" icon="alert-circle-outline" height={height} />;
  }
  // Unknown (first fetch in flight) or processing.
  return (
    <VideoStatusBox
      thumbnail={status?.thumbnailUrl ?? null}
      label={status ? `Processing… ${status.progress || 0}%` : 'Loading…'}
      height={height}
      spinner
    />
  );
}

function VideoStatusBox({
  thumbnail,
  label,
  icon,
  height,
  spinner,
}: {
  thumbnail: string | null;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  height: number;
  spinner?: boolean;
}) {
  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        maxHeight: height,
        borderRadius: radius.md,
        overflow: 'hidden',
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail, headers: { Referer: SITE_URL } }}
          style={[StyleSheet.absoluteFillObject, { opacity: 0.45 }]}
          contentFit="cover" transition={0}
        />
      ) : null}
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        {spinner ? <ActivityIndicator color="#fff" /> : icon ? <Ionicons name={icon} size={30} color="#fff" /> : null}
        <Text variant="caption" style={{ color: '#fff' }}>{label}</Text>
      </View>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.avi', '.m3u8'];
const isVideoUrl = (url: string): boolean =>
  VIDEO_EXTENSIONS.some(ext => url.toLowerCase().includes(ext)) ||
  url.includes('cloudflarestream') ||
  url.includes('/video/');

// Classify a media URL when the item carries no explicit `type`. Video wins
// over audio (some containers overlap, e.g. .webm), audio next, else image.
const detectMediaType = (url: string): 'video' | 'audio' | 'image' =>
  isVideoUrl(url) ? 'video' : isAudioUrl(url) ? 'audio' : 'image';

interface MediaItem {
  url: string;
  type?: string;
  id?: string;
  width?: number;
  height?: number;
}

const MAX_IMAGE_HEIGHT = 500;
const MIN_IMAGE_HEIGHT = 200;

function PostImage({ uri, onPress, accessibilityLabel, badge, initialWidth, initialHeight }: {
  uri: string;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
}) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(
    initialWidth && initialHeight ? { w: initialWidth, h: initialHeight } : null
  );

  React.useEffect(() => {
    if (size) return;
    let cancelled = false;
    RNImage.getSize(
      uri,
      (w, h) => { if (!cancelled) setSize({ w, h }); },
      () => { if (!cancelled) setSize({ w: 16, h: 9 }); },
    );
    return () => { cancelled = true; };
  }, [uri, size]);

  const aspectRatio = size ? size.w / size.h : 16 / 9;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={{
        width: '100%',
        aspectRatio,
        maxHeight: MAX_IMAGE_HEIGHT,
        minHeight: MIN_IMAGE_HEIGHT,
        borderRadius: radius.md,
        // Transparent surround + left-justified image: any contain() letterbox
        // (from the min/max-height clamp) shows the card background instead of a
        // grey bar, and the image hugs the leading edge rather than centering.
        backgroundColor: 'transparent',
        overflow: 'hidden',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}>
        {/* Size the image box to height x natural-ratio and let the container's
            flex-start alignment hug it to the leading edge. This left-justifies
            reliably on web + native WITHOUT relying on objectPosition (which
            RN-Web strips, leaving contain() to center the letterboxed image). */}
        <Image
          source={{ uri }}
          style={{ height: '100%', aspectRatio, alignSelf: 'flex-start' }}
          contentFit="cover" transition={0}
        />
        {badge}
      </View>
    </Pressable>
  );
}

interface Props {
  media: MediaItem[] | string | null;
  thumbnail?: string | null;
  /**
   * Context for audio posts so the player + OS now-playing show real metadata.
   * `id` should be the post guid (used for resume + the mini-player → post link).
   */
  audioMeta?: { id?: string; title?: string; artist?: string; artwork?: string };
  /**
   * The post this media belongs to, shown beside the image in the lightbox.
   *
   * Opening an image used to drop you into a black screen with no idea whose
   * post it was or what it said — the caption is often the whole point of the
   * image. Optional, so a MediaViewer used outside a post (composer preview,
   * avatars) renders exactly as before.
   */
  postContext?: {
    id?: string;
    authorName?: string;
    authorUsername?: string;
    authorAvatar?: string | null;
    text?: string;
    imageDescription?: string;
    replyCount?: number;
  };
}

/**
 * Renders post media — images with lightbox, videos with player, audio with an
 * inline player wired to the global queue. Handles single items, arrays, and
 * string URLs.
 */
export const MediaViewer = React.memo(function MediaViewer({ media, thumbnail, audioMeta, postContext }: Props) {
  const colors = useColors();
  const router = useRouter();
  const [lightboxVisible, setLightboxVisible] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // Normalize media to array of { url, type }, then DEDUPE by URL. The server has
  // been returning the same attachment twice (the "double media" bug — one image
  // rendered twice, and every image in a multi-image post doubled). Rendering
  // `media` faithfully then showed each one twice. Collapse by a normalized key
  // (drop query string + trailing slash, lowercase host) so cache-busting variants
  // of one image also collapse. A post never intentionally repeats the same image.
  const items: MediaItem[] = React.useMemo(() => {
    let raw: MediaItem[];
    if (!media) raw = [];
    else if (typeof media === 'string') raw = [{ url: media, type: detectMediaType(media) }];
    else if (Array.isArray(media)) raw = media.map(m => typeof m === 'string'
      ? { url: m, type: detectMediaType(m) }
      : { ...m, type: m.type || detectMediaType(m.url) });
    else raw = [];
    const seen = new Set<string>();
    const out: MediaItem[] = [];
    for (const it of raw) {
      if (!it.url) continue;
      let key: string;
      try { const u = new URL(it.url); key = `${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`; }
      catch { key = String(it.url).split('?')[0].replace(/\/+$/, '').toLowerCase(); }
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    return out;
  }, [media]);

  const displayItems = items.length > 0 ? items : (thumbnail ? [{ url: thumbnail, type: 'image' }] : []);
  // The lightbox is an image viewer, not an attachment player. Give tiles,
  // labels and every navigation path the same image-only index space, while
  // audio/video retain their original attachment indices below.
  const lightboxItems = displayItems.filter((item) => item.type !== 'video' && item.type !== 'audio');

  const rawImageDescription = (
    postContext?.imageDescription
    || postContext?.text
    || (postContext?.authorName ? `Image posted by ${postContext.authorName}` : 'Post image')
  );
  const imageDescription = rawImageDescription.replace(/\s+/g, ' ').trim()
    || (postContext?.authorName ? `Image posted by ${postContext.authorName}` : 'Post image');
  const imageActionLabel = (index: number) => {
    const position = lightboxItems.length > 1 ? ` ${index + 1} of ${lightboxItems.length}` : '';
    return `Open image${position}: ${imageDescription}`;
  };
  const lightboxImageLabel = (index: number) => {
    const separator = /[.!?]$/.test(imageDescription) ? '' : '.';
    const position = lightboxItems.length > 1 ? `${separator} Image ${index + 1} of ${lightboxItems.length}` : '';
    return `${imageDescription}${position}`;
  };

  // Lightbox drag state (X viewer feel): the image tracks the finger; a
  // decisive vertical release dismisses, a horizontal flick pages between
  // images, anything else springs back. Backdrop fades with displacement.
  const lbX = useSharedValue(0);
  const lbY = useSharedValue(0);
  const lightboxIndexRef = React.useRef(0);
  lightboxIndexRef.current = lightboxIndex;
  const itemCountRef = React.useRef(0);
  itemCountRef.current = lightboxItems.length;

  const openLightbox = (index: number) => {
    lbX.value = 0;
    lbY.value = 0;
    setLightboxIndex(index);
    setLightboxVisible(true);
  };
  const closeLightbox = React.useCallback(() => setLightboxVisible(false), []);
  const stepLightbox = React.useCallback((dir: number) => {
    setLightboxIndex((i) => Math.max(0, Math.min(itemCountRef.current - 1, i + dir)));
    lbX.value = 0;
    lbY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Arrow keys move between images and Escape closes, on web. The lightbox already had
  // stepLightbox for the on-screen controls; it was simply never reachable from the
  // keyboard, so the instinctive first action on a gallery did nothing.
  React.useEffect(() => {
    if (Platform.OS !== 'web' || !lightboxVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
      else if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxVisible, stepLightbox, closeLightbox]);

  const lightboxPan = React.useMemo(() => Gesture.Pan()
    .onChange((e) => {
      lbX.value = e.translationX;
      lbY.value = e.translationY;
    })
    .onEnd((e) => {
      const dismiss = Math.abs(lbY.value) > 120 || Math.abs(e.velocityY) > 800;
      if (dismiss) {
        lbY.value = withTiming(lbY.value >= 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT, { duration: 160 }, (f) => {
          if (f) runOnJS(closeLightbox)();
        });
        return;
      }
      const page = (lbX.value < -60 || e.velocityX < -500) ? 1 : (lbX.value > 60 || e.velocityX > 500) ? -1 : 0;
      if (page !== 0) {
        runOnJS(stepLightbox)(page);
      } else {
        lbX.value = withSpring(0, { damping: 20, stiffness: 250 });
        lbY.value = withSpring(0, { damping: 20, stiffness: 250 });
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [closeLightbox, stepLightbox]);
  const lightboxImgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lbX.value }, { translateY: lbY.value }],
  }));
  const lightboxBackdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(lbY.value), [0, SCREEN_HEIGHT * 0.5], [1, 0.3]),
  }));

  React.useEffect(() => {
    if (lightboxItems.length === 0) setLightboxVisible(false);
    setLightboxIndex((index) => Math.max(0, Math.min(index, lightboxItems.length - 1)));
  }, [lightboxItems.length]);

  // A post can gain or lose attachments without remounting its card. Always
  // run the same hooks, even while there is no media to display.
  if (displayItems.length === 0) return null;

  // Split audio (inline players) + videos (full-width players) from images (an
  // X-style multi-image grid, so 2+ images tile into columns).
  const audioItems = displayItems.map((it, idx) => ({ it, idx })).filter(x => x.it.type === 'audio');
  const videoItems = displayItems.map((it, idx) => ({ it, idx })).filter(x => x.it.type === 'video');
  const imageItems = lightboxItems.map((it, idx) => ({ it, idx }));

  // The id is not decoration: the provider decides "is this the current track?"
  // by comparing it, and the native downloads index keys the cached FILE on it.
  // With no audioMeta — every DM attachment, since ChatBubble has no post to
  // describe — the fallback was `audio-${idx}`, unique only WITHIN this viewer.
  // Every voice note in the app therefore carried the id `audio-0`: playing one
  // marked them all active, and on native the first one downloaded played in
  // place of every other. Derive from the URL instead, which is what actually
  // identifies the audio.
  const audioTrack = (it: MediaItem, idx: number): AudioTrack => ({
    id: audioItems.length === 1 && audioMeta?.id
      ? audioMeta.id
      : (it.id || (audioMeta?.id ? `${audioMeta.id}-${idx}` : audioTrackIdFromUrl(it.url))),
    url: it.url,
    title: audioMeta?.title || 'Audio',
    artist: audioMeta?.artist,
    artwork: audioMeta?.artwork || thumbnail || undefined,
  });
  const GAP = 2;
  const GRID_H = Platform.OS === 'web' ? 360 : 240;
  const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

  const Tile = ({ entry, style, plus }: { entry: { it: MediaItem; idx: number }; style?: any; plus?: number }) => (
    <Pressable
      onPress={() => openLightbox(entry.idx)}
      accessibilityRole="button"
      accessibilityLabel={imageActionLabel(entry.idx)}
      style={[{ overflow: 'hidden', backgroundColor: colors.surface }, style, Platform.OS === 'web' ? { cursor: 'pointer' } as any : null]}
    >
      <Image source={{ uri: entry.it.url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={0} />
      {plus ? (
        <View style={[FILL, { backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 24, fontFamily: 'Roboto-Medium' }}>+{plus}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  const imageGrid = () => {
    const n = imageItems.length;
    if (n === 0) return null;
    // Single image keeps its natural aspect ratio (no crop).
    if (n === 1) {
      const e = imageItems[0];
      return (
        <PostImage
          key={`${e.it.url}:${e.it.width ?? ''}:${e.it.height ?? ''}`}
          uri={e.it.url}
          onPress={() => openLightbox(e.idx)}
          accessibilityLabel={imageActionLabel(e.idx)}
          initialWidth={e.it.width}
          initialHeight={e.it.height}
        />
      );
    }
    const frame = { borderRadius: radius.lg, overflow: 'hidden' as const, height: GRID_H };
    if (n === 2) {
      return (
        <View style={[frame, { flexDirection: 'row', gap: GAP }]}>
          <Tile entry={imageItems[0]} style={{ flex: 1, height: '100%' }} />
          <Tile entry={imageItems[1]} style={{ flex: 1, height: '100%' }} />
        </View>
      );
    }
    if (n === 3) {
      return (
        <View style={[frame, { flexDirection: 'row', gap: GAP }]}>
          <Tile entry={imageItems[0]} style={{ flex: 1, height: '100%' }} />
          <View style={{ flex: 1, gap: GAP }}>
            <Tile entry={imageItems[1]} style={{ flex: 1, width: '100%' }} />
            <Tile entry={imageItems[2]} style={{ flex: 1, width: '100%' }} />
          </View>
        </View>
      );
    }
    // 4+ → 2×2, with a "+N" overlay on the last tile when there are extras.
    return (
      <View style={[frame, { gap: GAP }]}>
        <View style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
          <Tile entry={imageItems[0]} style={{ flex: 1, height: '100%' }} />
          <Tile entry={imageItems[1]} style={{ flex: 1, height: '100%' }} />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
          <Tile entry={imageItems[2]} style={{ flex: 1, height: '100%' }} />
          <Tile entry={imageItems[3]} style={{ flex: 1, height: '100%' }} plus={n > 4 ? n - 4 : undefined} />
        </View>
      </View>
    );
  };

  return (
    <>
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {audioItems.map(({ it, idx }) => (
          <InlineAudioPlayer key={`a${idx}`} track={audioTrack(it, idx)} />
        ))}
        {videoItems.map(({ it }) => (
          <View key={it.url} style={{ position: 'relative' }}>
            <VideoMedia url={it.url} height={Platform.OS === 'web' ? 560 : 240} />
          </View>
        ))}
        {imageGrid()}
      </View>

      {/* Lightbox modal */}
      {lightboxItems.length > 0 ? (
      <Modal visible={lightboxVisible} transparent animationType="fade" onRequestClose={() => setLightboxVisible(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.95)' }, lightboxBackdropStyle]} />
        <Pressable
          onPress={() => setLightboxVisible(false)}
          accessible={false}
          focusable={false}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pressable
            onPress={() => setLightboxVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close image viewer"
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: spacing.md }}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>

          {lightboxItems[lightboxIndex] && (
            <GestureDetector gesture={lightboxPan}>
              <Animated.View style={lightboxImgStyle}>
                <Image
                  source={{ uri: lightboxItems[lightboxIndex].url }}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={lightboxImageLabel(lightboxIndex)}
                  style={{
                    width: SCREEN_WIDTH * 0.95,
                    height: SCREEN_HEIGHT * 0.8,
                  }}
                  contentFit="contain"
                />
              </Animated.View>
            </GestureDetector>
          )}

          {/* Who posted it and what they said, beside the image.
              Opening an image used to drop you into a black screen with no
              author and no caption, and the caption is frequently the point.
              Tapping it goes to the thread; the panel swallows the tap so it
              does not close the lightbox instead. */}
          {postContext && (postContext.text || postContext.authorName) ? (
            <Pressable
              onPress={(e: any) => {
                e?.stopPropagation?.();
                if (!postContext.id) return;
                setLightboxVisible(false);
                router.push(`/post/${postContext.id}` as any);
              }}
              accessibilityRole="link"
              accessibilityLabel={`Open post${postContext.authorName ? ` by ${postContext.authorName}` : ''}`}
              style={{
                position: 'absolute',
                bottom: 0,
                // Constrained and centred rather than pinned across the full
                // width: on a wide window a full-bleed bar strands the caption
                // in a far corner, reading as unrelated to the image it
                // describes. This keeps it under the picture.
                alignSelf: 'center',
                width: '100%',
                maxWidth: 720,
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.lg,
                paddingBottom: spacing['2xl'],
                backgroundColor: 'rgba(0,0,0,0.72)',
                gap: spacing.sm,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              }}
            >
              {postContext.authorName ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  {postContext.authorAvatar ? (
                    <Image
                      source={{ uri: postContext.authorAvatar }}
                      style={{ width: 28, height: 28, borderRadius: 14 }}
                      contentFit="cover"
                    />
                  ) : null}
                  <Text variant="bodyMedium" color="#fff" numberOfLines={1}>
                    {postContext.authorName}
                  </Text>
                  {postContext.authorUsername ? (
                    <Text variant="caption" color="rgba(255,255,255,0.6)" numberOfLines={1}>
                      @{postContext.authorUsername}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {postContext.text ? (
                <Text variant="body" color="rgba(255,255,255,0.92)" numberOfLines={3} style={{ lineHeight: 21 }}>
                  {postContext.text}
                </Text>
              ) : null}
              {postContext.id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
                  <Ionicons name="chatbubble-outline" size={13} color="rgba(255,255,255,0.6)" />
                  <Text variant="caption" color="rgba(255,255,255,0.6)">
                    {postContext.replyCount
                      ? `${postContext.replyCount} ${postContext.replyCount === 1 ? 'reply' : 'replies'} — tap to open`
                      : 'Tap to open the post'}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          {lightboxItems.length > 1 && (
            <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.xl }}>
              <Pressable
                onPress={() => stepLightbox(-1)}
                disabled={lightboxIndex === 0}
                accessibilityRole="button"
                accessibilityLabel="Previous image"
                accessibilityState={{ disabled: lightboxIndex === 0 }}
                style={{ padding: spacing.md }}
              >
                <Ionicons name="chevron-back" size={28} color={lightboxIndex > 0 ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </Pressable>
              <Text variant="body" color="#fff">{lightboxIndex + 1} / {lightboxItems.length}</Text>
              <Pressable
                onPress={() => stepLightbox(1)}
                disabled={lightboxIndex === lightboxItems.length - 1}
                accessibilityRole="button"
                accessibilityLabel="Next image"
                accessibilityState={{ disabled: lightboxIndex === lightboxItems.length - 1 }}
                style={{ padding: spacing.md }}
              >
                <Ionicons name="chevron-forward" size={28} color={lightboxIndex < lightboxItems.length - 1 ? '#fff' : 'rgba(255,255,255,0.3)'} />
              </Pressable>
            </View>
          )}
        </Pressable>
        </GestureHandlerRootView>
      </Modal>
      ) : null}
    </>
  );
});
