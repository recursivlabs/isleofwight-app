import * as React from 'react';
import { View, Pressable, Platform, Linking, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { BASE_URL } from '../lib/recursiv';
import { extractFirstUrl } from '../lib/urls';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';



function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getDisplayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return `${host}${path}${parsed.search}`;
  } catch {
    return url;
  }
}

// --- YouTube detection ---------------------------------------------------
// YouTube's OG metadata isn't readable by the server scraper, so these posts
// render blank without special-casing. The thumbnail + embed URL are both
// derived from the video id (no server scrape needed), which is the whole fix.
export function youTubeId(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (!['youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'youtu.be'].includes(host)) return null;
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0] || null;
  else if (u.pathname === '/watch') id = u.searchParams.get('v');
  else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/); if (m) id = m[1]; }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
function youTubeThumb(id: string): string { return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`; }
function youTubeStart(url: string): number | undefined {
  try {
    const t = new URL(url).searchParams.get('t') || new URL(url).searchParams.get('start');
    if (!t) return undefined;
    if (/^\d+s?$/.test(t)) return Number.parseInt(t, 10);
    const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!m) return undefined;
    const s = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
    return s || undefined;
  } catch { return undefined; }
}
function youTubeEmbedUrl(id: string, start?: number, autoplay = false): string {
  const p = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: autoplay ? '1' : '0',
    playsinline: '1', rel: '0', modestbranding: '1',
  });
  if (start) p.set('start', String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
}

// oEmbed gives us a title/author without a scrape (public, CORS-enabled). Best
// effort — the card renders fine on the thumbnail alone if this fails.
const ytMetaCache = new Map<string, { title: string; author: string } | null>();
async function fetchYouTubeMeta(url: string): Promise<{ title: string; author: string } | null> {
  if (ytMetaCache.has(url)) return ytMetaCache.get(url) ?? null;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
    if (!res.ok) { ytMetaCache.set(url, null); return null; }
    const j = await res.json();
    const meta = { title: String(j.title ?? ''), author: String(j.author_name ?? '') };
    ytMetaCache.set(url, meta);
    return meta;
  } catch { ytMetaCache.set(url, null); return null; }
}

interface Preview {
  url: string;
  domain: string;
  title: string | null;
  description: string | null;
  image: string | null;
  favicon: string | null;
  siteName: string | null;
}

// Preview image/favicon URLs come from the LINKED page's own OG tags, i.e.
// they are attacker-controllable: any post's link can point them at an
// arbitrary origin, turning every viewer's render into a tracking pixel
// (IP + UA + the minds.com Referer). On web we render a plain <img> with
// referrerPolicy="no-referrer" so nothing leaks; native image fetches don't
// send a Referer in the first place, so RN Image stays.
function PreviewImage({
  uri,
  style,
  resizeMode,
}: { uri: string; style: Record<string, unknown>; resizeMode?: 'cover' | 'contain' }) {
  if (Platform.OS === 'web') {
    return React.createElement('img', {
      src: uri,
      alt: '',
      loading: 'lazy',
      referrerPolicy: 'no-referrer',
      style: { display: 'block', objectFit: resizeMode ?? 'cover', ...style },
    });
  }
  return <Image source={{ uri }} style={style as any} resizeMode={resizeMode ?? 'cover'} />;
}

// In-memory preview cache to avoid refetching the same URL across renders.
const previewCache = new Map<string, Preview | null>();
const inflight = new Map<string, Promise<Preview | null>>();

async function fetchPreview(url: string): Promise<Preview | null> {
  if (previewCache.has(url)) return previewCache.get(url) ?? null;
  const existing = inflight.get(url);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/link-preview?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        previewCache.set(url, null);
        return null;
      }
      const body = await res.json();
      const data = (body?.data ?? null) as Preview | null;
      previewCache.set(url, data);
      return data;
    } catch {
      previewCache.set(url, null);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

interface Props {
  /** Either raw post content (we'll extract the first URL) or a specific URL. */
  content?: string;
  url?: string;
  /**
   * The post already shows this picture as native media (a legacy link post
   * whose preview image was also attached as an image). Render the compact
   * card so the picture appears once.
   */
  hideImage?: boolean;
}

/**
 * X-style rich link preview.
 *
 * With an OG image: renders a hero card — big image at top (1.91:1 aspect,
 * matching the OG standard), a small domain pill overlaid on the bottom-left
 * of the image, then a clean title/description block below.
 *
 * Without an image: renders a compact horizontal card — a tiny favicon tile
 * on the left, domain + title on the right. No fixed heights, no borders
 * competing with the post itself.
 *
 * Renders nothing on null / 404 previews so a post with a bare URL doesn't
 * get a useless pill at the bottom.
 */
export const LinkPreview = React.memo(function LinkPreview({ content, url: urlProp, hideImage = false }: Props) {
  const colors = useColors();
  const url = urlProp ?? (content ? extractFirstUrl(content) : null);
  const ytId = url ? youTubeId(url) : null;
  const [preview, setPreview] = React.useState<Preview | null>(
    url ? (previewCache.get(url) ?? null) : null,
  );
  const [loaded, setLoaded] = React.useState<boolean>(
    url ? previewCache.has(url) : false,
  );
  const [ytMeta, setYtMeta] = React.useState<{ title: string; author: string } | null>(
    url && ytId ? (ytMetaCache.get(url) ?? null) : null,
  );

  React.useEffect(() => {
    if (!url || ytId) return; // YouTube is handled without an OG scrape
    let cancelled = false;
    if (previewCache.has(url)) {
      setPreview(previewCache.get(url) ?? null);
      setLoaded(true);
      return;
    }
    fetchPreview(url).then((data) => {
      if (!cancelled) {
        setPreview(data);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [url, ytId]);

  // Best-effort title/author for the native YouTube card. Skipped on web (the
  // iframe shows its own title, and the oEmbed host is CSP-blocked there anyway).
  React.useEffect(() => {
    if (!url || !ytId || Platform.OS === 'web') return;
    let cancelled = false;
    fetchYouTubeMeta(url).then((m) => { if (!cancelled) setYtMeta(m); });
    return () => { cancelled = true; };
  }, [url, ytId]);

  if (!url) return null;

  const handlePress = (e?: any) => {
    e?.stopPropagation?.();
    if (Platform.OS === 'web') {
      (typeof window !== 'undefined' ? window : globalThis as any).open?.(url, '_blank', 'noopener');
    } else {
      Linking.openURL(url);
    }
  };

  // --- YouTube: rich video card (no OG scrape needed). ---
  // Web: render the player iframe directly. YouTube serves its own poster + play
  // button inside the frame (allowed by minds.com's `frame-src *`), so we avoid
  // the thumbnail image and the oEmbed fetch — both blocked by the site CSP
  // (`img-src` / `connect-src` don't allowlist YouTube hosts).
  // Native: thumbnail + play badge → opens the video (no CSP on native; a true
  // inline WebView player is Phase 2, pending react-native-webview + a rebuild).
  if (ytId) {
    const start = youTubeStart(url);
    if (Platform.OS === 'web') {
      return (
        <View style={{ marginTop: spacing.md, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderSubtle, backgroundColor: '#000' }}>
          <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
            {React.createElement('iframe', {
              src: youTubeEmbedUrl(ytId, start, false),
              title: ytMeta?.title || 'YouTube video',
              allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
              allowFullScreen: true,
              frameBorder: '0',
              loading: 'lazy',
              style: { width: '100%', height: '100%', border: 0, display: 'block' },
            })}
          </View>
        </View>
      );
    }
    return (
      <Pressable
        onPress={(e?: any) => { e?.stopPropagation?.(); Linking.openURL(url); }}
        accessibilityRole="button"
        accessibilityLabel={ytMeta?.title ? `Play video: ${ytMeta.title}` : 'Play video'}
        style={{ marginTop: spacing.md, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 0.5, borderColor: colors.borderSubtle, backgroundColor: colors.surface }}
      >
        <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
          <Image source={{ uri: youTubeThumb(ytId) }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
            </View>
          </View>
          <View style={{ position: 'absolute', left: spacing.md, bottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radius.sm }}>
            <Ionicons name="logo-youtube" size={12} color="#FF0000" />
            <Text variant="caption" color="#fff" numberOfLines={1} style={{ fontSize: 11 }}>YouTube</Text>
          </View>
        </View>
        {ytMeta?.title ? (
          <View style={{ padding: spacing.lg, gap: 2 }}>
            <Text variant="bodyMedium" color={colors.text} numberOfLines={2} style={{ lineHeight: 21 }}>{ytMeta.title}</Text>
            {ytMeta.author ? (
              <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>{ytMeta.author}</Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    );
  }

  const domain = preview?.domain ?? getDomain(url);
  const title = preview?.title;
  const description = preview?.description;
  const image = hideImage ? undefined : preview?.image;
  const favicon = preview?.favicon;

  // While the preview metadata is in flight, reserve space with a
  // skeleton card the same shape as the loaded preview. Without this
  // reservation the post body renders, the preview fetches 100-500ms
  // later, and then a hero card pops in below it — pushing everything
  // down. Net effect: content "jumps." With the skeleton the layout
  // stays put and the image just fills in.
  if (!loaded) {
    // Compact skeleton (favicon + text rows) so the layout reservation
    // matches the most common case — a no-OG-image preview. If the
    // eventual card is the hero variant it'll grow downward, which
    // reads as a smooth reveal; if it ends up compact (or null) the
    // layout barely moves.
    return (
      <View
        style={{
          marginTop: spacing.md,
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          overflow: 'hidden',
          minHeight: 64,
        }}
      >
        <View style={{ width: 64, backgroundColor: colors.surfaceRaised }} />
        <View style={{ flex: 1, padding: spacing.md, gap: 6, justifyContent: 'center' }}>
          <View style={{ height: 10, width: '40%', backgroundColor: colors.surfaceRaised, borderRadius: 4 }} />
          <View style={{ height: 14, width: '80%', backgroundColor: colors.surfaceRaised, borderRadius: 4 }} />
        </View>
      </View>
    );
  }

  // Hero card: big image, domain pill overlaid on bottom-left, text beneath.
  if (image) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="link"
        accessibilityLabel={title ? `Open ${title}` : `Open link to ${domain}`}
        style={({ pressed, hovered }: any) => ({
          marginTop: spacing.md,
          backgroundColor: pressed ? colors.surfaceHover : colors.surface,
          borderRadius: radius.xl,
          borderWidth: 0.5,
          borderColor: colors.borderSubtle,
          overflow: 'hidden',
          ...(Platform.OS === 'web'
            ? {
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
                borderColor: hovered ? colors.border : colors.borderSubtle,
                cursor: 'pointer',
              } as any
            : {}),
        })}
      >
        <View style={{ position: 'relative', width: '100%' }}>
          <PreviewImage
            uri={image}
            style={{
              width: '100%',
              aspectRatio: 1.91,
              backgroundColor: colors.surfaceRaised,
            }}
            resizeMode="cover"
          />
          {/* Domain pill overlaid on the image */}
          <View
            style={{
              position: 'absolute',
              left: spacing.md,
              bottom: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.sm,
              paddingVertical: 3,
              backgroundColor: 'rgba(0,0,0,0.65)',
              borderRadius: radius.sm,
              ...(Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } as any : {}),
            }}
          >
            {favicon ? (
              <PreviewImage uri={favicon} style={{ width: 12, height: 12, borderRadius: 2 }} />
            ) : (
              <Ionicons name="link" size={11} color="#fff" />
            )}
            <Text variant="caption" color="#fff" numberOfLines={1} style={{ fontSize: 11 }}>
              {preview?.siteName || domain}
            </Text>
          </View>
        </View>
        <View style={{ padding: spacing.lg, gap: 2 }}>
          {title ? (
            <Text variant="bodyMedium" color={colors.text} numberOfLines={2} style={{ lineHeight: 21 }}>
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text variant="caption" color={colors.textMuted} numberOfLines={2} style={{ marginTop: 4 }}>
              {description}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  // No image — compact horizontal card. This also serves as the durable
  // fallback when the preview service cannot read any OG metadata. PostCard
  // intentionally removes a bare URL from the body once it hands that URL to
  // this component, so returning null here would make the entire post blank.
  // Keep the actual destination visible and clickable instead.
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={title ? `Open ${title}` : `Open link to ${domain}`}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        ...(Platform.OS === 'web'
          ? {
              transition: 'border-color 0.15s ease',
              borderColor: hovered ? colors.border : colors.borderSubtle,
              cursor: 'pointer',
            } as any
          : {}),
      })}
    >
      <View
        style={{
          width: 72,
          alignSelf: 'stretch',
          backgroundColor: colors.surfaceRaised,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {favicon ? (
          <PreviewImage uri={favicon} style={{ width: 24, height: 24, borderRadius: 4 }} />
        ) : (
          <Ionicons name="link" size={20} color={colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1, paddingVertical: spacing.md, paddingRight: spacing.md, gap: 2 }}>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
          {preview?.siteName || domain}
        </Text>
        <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>
          {title || getDisplayUrl(url)}
        </Text>
        {description ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});
