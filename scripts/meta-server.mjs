#!/usr/bin/env node
/**
 * Production web server: static dist/ + per-URL Open Graph injection.
 *
 * Replaces the bare `serve dist -s` we shipped before. That rewrote every path
 * to one identical index.html, so every shared minds.com link — a post, a
 * profile, a community — unfurled on X/Slack/iMessage/Signal as a bare
 * "Minds" with no description and no image (web.output "single" discards
 * app/+html.tsx entirely; see scripts/inject-boot-shell.mjs).
 *
 * This server keeps the SPA behavior (all non-file paths serve index.html)
 * but rewrites the <!--minds-meta-->…<!--/minds-meta--> head block per URL:
 *
 *   /post/:id        → post title/excerpt + cover image (article OG)
 *   /:username       → profile name/bio + avatar (profile OG)
 *   /user/:username  → same as above (permanent alias)
 *   /community/:id   → community name/description + image
 *   /?ref=CODE       → the invite card (og-invite.png)
 *   everything else  → the site-default card (og-default.png)
 *
 * The injected HTML is served to ALL clients, not just crawler user-agents —
 * UA sniffing is fragile and the tags are harmless to browsers.
 *
 * Post/profile/community lookups use the platform's anonymous public tRPC
 * projections. Public link previews must not depend on a copied API key: a
 * missing deploy secret previously reduced every entity URL to the generic
 * card even though the content itself was public.
 */
import { createServer } from 'node:http';
import { statSync, readFileSync, existsSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { resolveServedCommit } from './write-build-info.mjs';

const PORT = Number(process.env.PORT || 3000);
const DIST = process.env.EXPO_WEB_DIST || 'dist';
// minds.com serves LEGACY Minds until the cutover — default to the domain the
// new app answers on. At cutover set EXPO_PUBLIC_SITE_URL=https://www.minds.com.
const SITE_ORIGIN = (process.env.EXPO_PUBLIC_SITE_URL || 'https://isleofwight.on.minds.io').replace(/\/+$/, '');
const API_BASE = (
  process.env.EXPO_PUBLIC_RECURSIV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'https://api.minds.com/api/v1'
).replace(/\/+$/, '');
const API_ORIGIN = API_BASE.replace(/\/api\/v1$/, '');
const PROJECT_ID = process.env.EXPO_PUBLIC_RECURSIV_PROJECT_ID || '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const APPLE_APP_ID = process.env.MINDS_APPLE_APP_ID || '35U3998VRZ.com.minds.app';
const ANDROID_PACKAGE = process.env.MINDS_ANDROID_PACKAGE || 'com.minds.app';
// Verified from the current com.minds.app EAS internal APK. Google Play App
// Signing can use a different certificate; add its fingerprint through the
// comma-separated env value when the Play record exists.
const DEFAULT_ANDROID_CERT_FINGERPRINT =
  'D8:78:DA:63:E4:01:FA:D7:0E:20:39:3F:48:C1:39:5E:63:E8:3E:1B:AB:C2:3A:CC:12:18:FB:73:34:11:9C:1C';
const CERT_FINGERPRINT_RE = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const configuredAndroidFingerprints = String(
  process.env.MINDS_ANDROID_SHA256_FINGERPRINTS || DEFAULT_ANDROID_CERT_FINGERPRINT,
)
  .split(',')
  .map((value) => value.trim().toUpperCase())
  .filter((value) => CERT_FINGERPRINT_RE.test(value));
const ANDROID_CERT_FINGERPRINTS = configuredAndroidFingerprints.length
  ? [...new Set(configuredAndroidFingerprints)]
  : [DEFAULT_ANDROID_CERT_FINGERPRINT];

const SITE_NAME = 'Minds';
const DEFAULT_TITLE = 'Isle of Wight';
// Em dashes are allowed in the TITLE only, never in descriptions (brand rule).
const DEFAULT_DESCRIPTION = 'Local news, events, groups and chat for the Isle of Wight.';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/og-default.png`;
const INVITE_IMAGE = `${SITE_ORIGIN}/og-invite.png`;
const IOS_STORE_URL = 'https://apps.apple.com/app/id961771928';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.minds.app';
const LEGACY_API_PATH_RE = /^\/api\/v[1-9]\d*(?:\/|$)/;
const STATIC_PUBLIC_META = {
  live: {
    title: 'Minds Live — Watch live battles',
    description: 'Watch live two-minute webcam battles without leaving Minds.',
  },
  privacy: {
    title: 'Minds 2.0 Privacy — What we collect and why',
    description: 'Learn what Minds collects, why, and what you can do about it.',
  },
};

/**
 * Old web and native clients call versioned APIs on www.minds.com itself.
 * After cutover those requests reach this app server, while Minds 2.0 talks
 * directly to api.minds.com. Never answer an old API call with the SPA shell:
 * legacy clients parse `status` and `message`, and other callers can use the
 * stable code and destinations to move to a supported surface.
 */
export function legacyApiUpgradeResponseForPath(pathname) {
  if (!LEGACY_API_PATH_RE.test(pathname)) return null;
  return {
    status: 426,
    body: JSON.stringify({
      status: 'error',
      code: 'client_upgrade_required',
      errorId: 'client_upgrade_required',
      message: 'This version of Minds is no longer supported. Update Minds to continue.',
      links: {
        web: `${SITE_ORIGIN}/`,
        ios: IOS_STORE_URL,
        android: ANDROID_STORE_URL,
      },
    }),
  };
}

// Top-level paths that are app routes, never usernames. Must cover every
// non-dynamic file/dir in app/ — expo-router gives explicit routes priority
// over [username], and this list mirrors that priority on the server.
const RESERVED = new Set([
  'admin', 'agent', 'ai', 'apps', 'auth', 'billing', 'blocked', 'bookmarks',
  'boost', 'chat', 'communities', 'community', 'create', 'discover', 'email',
  'explore', 'feedback', 'groups', 'index', 'invites', 'jobs', 'live', 'login',
  'moderation', 'muted', 'notifications', 'org-settings', 'post', 'privacy',
  'profile', 'protocols', 'register', 'reset-password', 'settings', 'sign-in',
  'sign-up', 'signin', 'signup', 'switch-account', 'upgrade', 'user', 'wallet',
  'webhooks', 'api', 'assets', '_expo',
]);

// ── API fetch with timeout + tiny TTL cache ─────────────────────────────────

const cache = new Map(); // path → { value, exp }
const legacyResolveCache = new Map(); // guid → { value, exp }
const CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 1000;
const CACHE_MAX = 2000;

export async function publicApiGet(procedure, input, fetchImpl = fetch) {
  const key = `${procedure}:${JSON.stringify(input)}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  let value = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const url = new URL(`${API_ORIGIN}/api/trpc/${procedure}`);
    url.searchParams.set('input', JSON.stringify(input));
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.json();
      value = body?.result?.data ?? null;
    }
  } catch {
    // Timeout / network error → serve defaults; never block the page on meta.
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, exp: Date.now() + (value ? CACHE_TTL_MS : NEGATIVE_TTL_MS) });
  return value;
}

const LEGACY_GUID_RE = /^\d{6,32}$/;
const LEGACY_ACTIVITYPUB_ACTOR_PATH_RE = /^\/api\/activitypub\/users\/(\d{6,32})\/?$/;
const ACTIVITYPUB_RESPONSE_MAX_BYTES = 256 * 1024;
const ACTIVITYPUB_TIMEOUT_MS = 5000;
const POST_PATH_RE = /^\/post\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\?projectId=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?$/i;
const COMMUNITY_PATH_RE = /^\/community\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

/**
 * Extract the post GUID from historical Minds permalink shapes whose mapping
 * is known. Group-profile URLs are intentionally excluded: their first GUID
 * identifies a community, not a post.
 */
export function legacyPostGuidForPath(pathname) {
  const segs = pathname.split('/').filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  let guid = null;
  if ((segs[0] === 'newsfeed' || segs[0] === 'p' || segs[0] === 'post') && segs[1]) {
    guid = segs[1];
  } else if (segs[0] === 'blog' && segs[1] === 'view' && segs[2]) {
    guid = segs[2];
  } else if (segs[0] === 'media' && segs[1] && segs[2]) {
    // Legacy media pages declare /newsfeed/<last-guid> as their canonical.
    guid = segs[2];
  }
  return guid && LEGACY_GUID_RE.test(guid) ? guid : null;
}

/** Extract the community GUID from historical Minds group-profile URLs. */
export function legacyCommunityGuidForPath(pathname) {
  const segs = pathname.split('/').filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  const guid = segs[0] === 'groups' && segs[1] === 'profile' ? segs[2] : null;
  return guid && LEGACY_GUID_RE.test(guid) ? guid : null;
}

/**
 * A redirect lookup must distinguish a definitive miss from an API outage.
 * Returning 410 for a timeout would tell crawlers to de-index a valid post.
 */
async function resolveLegacyEntity(procedure, guid, pathPattern, fetchImpl) {
  const cacheKey = `${procedure}:${PROJECT_ID}:${guid}`;
  const hit = legacyResolveCache.get(cacheKey);
  if (hit && hit.exp > Date.now()) return hit.value;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const url = new URL(`${API_ORIGIN}/api/trpc/${procedure}`);
    url.searchParams.set('input', JSON.stringify({ guid, projectId: PROJECT_ID }));
    const res = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      signal: ctrl.signal,
    });

    let value;
    let ttl;
    if (res.ok) {
      const body = await res.json();
      const data = body?.result?.data;
      const path = data?.path;
      if (data === null) {
        value = { kind: 'gone' };
        ttl = NEGATIVE_TTL_MS;
      } else {
        value = pathPattern.test(String(path || ''))
          ? { kind: 'found', path }
          : { kind: 'unavailable' };
        ttl = CACHE_TTL_MS;
      }
    } else {
      return { kind: 'unavailable' };
    }

    if (value.kind !== 'unavailable') {
      if (legacyResolveCache.size >= CACHE_MAX) {
        legacyResolveCache.delete(legacyResolveCache.keys().next().value);
      }
      legacyResolveCache.set(cacheKey, { value, exp: Date.now() + ttl });
    }
    return value;
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveLegacyPost(guid, fetchImpl = fetch) {
  return resolveLegacyEntity('posts.resolveLegacy', guid, POST_PATH_RE, fetchImpl);
}

export async function resolveLegacyCommunity(guid, fetchImpl = fetch) {
  return resolveLegacyEntity('communities.resolveLegacy', guid, COMMUNITY_PATH_RE, fetchImpl);
}

export async function legacyResponseForPath(
  pathname,
  postLookup = resolveLegacyPost,
  communityLookup = resolveLegacyCommunity,
) {
  const postGuid = legacyPostGuidForPath(pathname);
  const communityGuid = legacyCommunityGuidForPath(pathname);
  const guid = postGuid || communityGuid;
  if (!guid) return null;
  const result = await (postGuid ? postLookup(guid) : communityLookup(guid));
  if (result.kind === 'found') return { status: 308, location: result.path };
  if (result.kind === 'gone') return { status: 410 };
  return { status: 503 };
}

/** Match only the historical public actor document, never inbox writes. */
export function legacyActivityPubActorGuidForPath(pathname) {
  return pathname.match(LEGACY_ACTIVITYPUB_ACTOR_PATH_RE)?.[1] || null;
}

function activityPubGatewayError(status, message) {
  return {
    status,
    body: Buffer.from(JSON.stringify({ error: message })),
    contentType: 'application/json; charset=utf-8',
    cacheControl: 'no-store',
    retryAfter: status === 503 ? '60' : null,
  };
}

/**
 * Fetch an old GUID-stable actor from the public platform route.
 *
 * This is an origin handoff, not app data access: federation clients require
 * the original URL and ActivityPub media type, which the SDK does not model.
 * No browser credentials, cookies, or API key are forwarded.
 */
export async function legacyActivityPubActorResponseForPath(pathname, fetchImpl = fetch) {
  const guid = legacyActivityPubActorGuidForPath(pathname);
  if (!guid) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ACTIVITYPUB_TIMEOUT_MS);
  try {
    const upstreamUrl = new URL(`/api/activitypub/users/${guid}`, `${API_ORIGIN}/`);
    const upstream = await fetchImpl(upstreamUrl, {
      headers: { Accept: 'application/activity+json' },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.length > ACTIVITYPUB_RESPONSE_MAX_BYTES) {
      return activityPubGatewayError(502, 'Invalid actor response');
    }

    const upstreamType = upstream.headers.get('content-type') || '';
    const isActivityPub = /^(application\/activity\+json|application\/ld\+json)(?:;|$)/i
      .test(upstreamType.trim());
    if (upstream.status === 200 && !isActivityPub) {
      return activityPubGatewayError(502, 'Invalid actor response');
    }

    return {
      status: upstream.status,
      body,
      contentType: isActivityPub
        ? upstreamType
        : 'application/json; charset=utf-8',
      cacheControl: upstream.status === 200
        ? (upstream.headers.get('cache-control') || 'public, max-age=300')
        : 'no-store',
      retryAfter: upstream.headers.get('retry-after'),
    };
  } catch {
    return activityPubGatewayError(503, 'Actor service unavailable');
  } finally {
    clearTimeout(timer);
  }
}

// ── Meta building ───────────────────────────────────────────────────────────

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const clamp = (s, max) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

function decodeHtmlEntities(text) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return String(text || '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    try { return String.fromCodePoint(codePoint); } catch { return match; }
  });
}

/** Markdown/HTML → plain-text excerpt (mirrors lib/models.ts articleExcerpt). */
function excerpt(text, max = 200) {
  return clamp(
    decodeHtmlEntities(text)
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[#>*_`~]/g, ''),
    max,
  );
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif)(\?|$)/i;

/** First image-looking media URL on a post (media may be array/object/string). */
export function postImage(p) {
  const raw = p?.media;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const m of arr) {
    const url = typeof m === 'string' ? m : m?.url;
    const type = typeof m === 'object' ? String(m?.type || '') : '';
    if (!url) continue;
    if (type.startsWith('image') || IMAGE_EXT_RE.test(url)) return String(url);
    // Video media: prefer its poster/thumbnail over skipping entirely.
    const thumb = typeof m === 'object' ? m?.thumbnail || m?.thumbnailUrl || m?.poster : null;
    if (thumb) return String(thumb);
  }
  const explicit = p?.image || p?.thumbnail || p?.cover || p?.coverUrl || p?.cover_url || p?.banner || p?.bannerUrl || p?.banner_url;
  if (explicit) return String(explicit);
  const format = String(p?.contentFormat ?? p?.content_format ?? '');
  const legacyGuid = p?.legacyGuid ?? p?.legacy_guid;
  if (p?.title && format === 'markdown' && /^\d{6,}$/.test(String(legacyGuid || ''))) {
    return `https://cdn.minds.com/fs/v1/banners/${legacyGuid}`;
  }
  return null;
}

/**
 * meta = { title, description, url, image, imageLarge, type }
 * imageLarge picks the Twitter card: true → summary_large_image (real
 * cover/media, 1.91:1-ish), false → summary (avatar-sized square).
 */
export function renderMeta(meta) {
  const title = clamp(meta.title || DEFAULT_TITLE, 90);
  const description = clamp(meta.description || DEFAULT_DESCRIPTION, 220);
  const image = meta.image || DEFAULT_IMAGE;
  const url = meta.url || SITE_ORIGIN;
  const large = meta.imageLarge !== false;
  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:type" content="${esc(meta.type || 'website')}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:alt" content="${esc(title)}" />`,
    `<meta name="twitter:card" content="${large ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    `<meta name="theme-color" content="#08080a" />`,
  ];
  // Only claim OG dimensions for our own static cards, whose size we know.
  if (image === DEFAULT_IMAGE || image === INVITE_IMAGE) {
    lines.splice(9, 0,
      `<meta property="og:image:width" content="1200" />`,
      `<meta property="og:image:height" content="630" />`);
  }
  return lines.join('\n    ');
}

const ID_RE = /^[0-9a-fA-F-]{8,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,64}$/;
const COMMUNITY_SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

// ── Search discovery + native app association ──────────────────────────────

const STATIC_SITEMAP_PATHS = ['/', '/live', '/privacy', '/upgrade'];
const PRIVATE_ROBOT_PATHS = [
  '/admin', '/auth', '/billing', '/blocked', '/bookmarks', '/chat', '/create',
  '/email', '/invites', '/moderation', '/muted', '/notifications',
  '/org-settings', '/reset-password', '/settings', '/wallet', '/webhooks',
];

export function renderRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    // Anchor route names so a profile such as /chatty is still crawlable.
    ...PRIVATE_ROBOT_PATHS.flatMap((path) => [
      `Disallow: ${path}$`,
      `Disallow: ${path}/`,
    ]),
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');
}

export function renderSecurityTxt(now = new Date()) {
  const expires = new Date(now);
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  return [
    'Contact: mailto:security@minds.com',
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en',
    `Canonical: ${SITE_ORIGIN}/.well-known/security.txt`,
    '',
  ].join('\n');
}

export function renderSitemap(communities = []) {
  const rows = Array.isArray(communities)
    ? communities
    : Array.isArray(communities?.data)
      ? communities.data
      : [];
  const locations = new Set(
    STATIC_SITEMAP_PATHS.map((path) => path === '/' ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`),
  );

  for (const community of rows) {
    if (!community || community.privacy !== 'public') continue;
    if (community.importHidden === true || community.import_hidden === true) continue;
    const slug = typeof community.slug === 'string' && COMMUNITY_SLUG_RE.test(community.slug)
      ? community.slug
      : null;
    const id = typeof community.id === 'string' && UUID_RE.test(community.id)
      ? community.id
      : null;
    const segment = slug || id;
    if (segment) locations.add(`${SITE_ORIGIN}/community/${segment}`);
  }

  const urls = [...locations]
    .map((location) => `  <url><loc>${esc(location)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function sitemapForPublicApi(getPublic = publicApiGet) {
  // The public contract currently caps this projection at 50. A rejected
  // limit silently reduces the sitemap to static pages, so keep this call
  // observable in a focused test.
  const communities = await getPublic('communities.list', { limit: 50 });
  return renderSitemap(communities);
}

export function renderAppleAssociation(appId = APPLE_APP_ID) {
  return `${JSON.stringify({
    applinks: {
      apps: [],
      details: [{ appID: appId, paths: ['*'] }],
    },
  }, null, 2)}\n`;
}

export function renderAndroidAssetLinks(
  fingerprints = ANDROID_CERT_FINGERPRINTS,
  packageName = ANDROID_PACKAGE,
) {
  return `${JSON.stringify([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: packageName,
      sha256_cert_fingerprints: fingerprints,
    },
  }], null, 2)}\n`;
}

export async function metaForPath(pathname, searchParams, getPublic = publicApiGet) {
  const segs = pathname.split('/').filter(Boolean).map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  });
  const pageUrl = `${SITE_ORIGIN}${pathname}`;

  // Invite links: / or /signup with ?ref=CODE.
  if (segs.length === 0 || segs[0] === 'signup' || segs[0] === 'signin') {
    if (searchParams.get('ref')) {
      return {
        title: 'Join me on Isle of Wight',
        description: DEFAULT_DESCRIPTION,
        url: pageUrl,
        image: INVITE_IMAGE,
        imageLarge: true,
      };
    }
    return {};
  }

  const staticPublicMeta = segs.length === 1
    ? STATIC_PUBLIC_META[segs[0].toLowerCase()]
    : null;
  if (staticPublicMeta) {
    return { ...staticPublicMeta, url: pageUrl, type: 'website' };
  }

  if (segs[0] === 'post' && segs[1] && ID_RE.test(segs[1])) {
    const post = await getPublic('posts.get', { id: segs[1], projectId: PROJECT_ID });
    if (!post) return { url: pageUrl };
    // Never leak NSFW content into unfurl cards — the app gates it behind a
    // click-through, so the preview must too.
    if (post.is_nsfw || post.isNsfw) {
      return { title: 'Post on Minds', description: DEFAULT_DESCRIPTION, url: pageUrl, type: 'article' };
    }
    const author = post.author || post.user || {};
    const authorName = author.name || author.username || 'Someone';
    const title = (typeof post.title === 'string' && post.title.trim())
      ? post.title.trim()
      : `${authorName} on Minds`;
    const image = postImage(post);
    const avatar = author.image || author.avatar || null;
    return {
      title,
      description: excerpt(post.content) || `A post by ${authorName} on Minds.`,
      url: pageUrl,
      image: image || avatar || undefined,
      imageLarge: Boolean(image),
      type: 'article',
    };
  }

  if (
    segs[0] === 'community' && segs[1] &&
    (UUID_RE.test(segs[1]) || COMMUNITY_SLUG_RE.test(segs[1]))
  ) {
    const byId = UUID_RE.test(segs[1]);
    const c = await getPublic(
      byId ? 'communities.get' : 'communities.getBySlug',
      byId ? { id: segs[1] } : { slug: segs[1] },
    );
    if (!c) return { url: pageUrl };
    // Non-public communities keep the generic card.
    if (c.privacy && c.privacy !== 'public') return { url: pageUrl };
    return {
      title: c.name ? `${c.name} — Minds` : undefined,
      description: excerpt(c.description) || (c.name ? `Join the ${c.name} community on Minds.` : undefined),
      url: pageUrl,
      image: c.banner || c.banner_url || c.image || c.avatar || undefined,
      imageLarge: Boolean(c.banner || c.banner_url),
      type: 'website',
    };
  }

  // /user/:username, and the root /:username mirror of legacy minds.com/<user>.
  const username =
    segs[0] === 'user' && segs[1] ? segs[1]
    : segs.length === 1 && !RESERVED.has(segs[0].toLowerCase()) ? segs[0]
    : null;
  if (username && USERNAME_RE.test(username)) {
    const u = await getPublic('users.getByUsername', { username });
    if (!u) return { url: pageUrl };
    const name = u.name || u.username || username;
    return {
      title: `${name} (@${u.username || username}) — Minds`,
      description: excerpt(u.bio) || `${name} is on Minds. Follow them to see their posts.`,
      url: pageUrl,
      image: u.banner || u.banner_url || u.image || u.avatar || undefined,
      // A banner unfurls well as a large card; a bare avatar reads better small.
      imageLarge: Boolean(u.banner || u.banner_url),
      type: 'profile',
    };
  }

  return { url: pageUrl };
}

// ── index.html templating ───────────────────────────────────────────────────

const META_BLOCK_RE = /<!--minds-meta-->[\s\S]*?<!--\/minds-meta-->/;
let indexCache = { mtime: 0, html: '' };

function loadIndexHtml() {
  const file = join(DIST, 'index.html');
  const mtime = statSync(file).mtimeMs;
  if (mtime !== indexCache.mtime) {
    indexCache = { mtime, html: readFileSync(file, 'utf8') };
  }
  return indexCache.html;
}

export function injectPage(html, meta) {
  const block = `<!--minds-meta-->\n    ${renderMeta(meta)}\n    <!--/minds-meta-->`;
  const title = clamp(meta.title || DEFAULT_TITLE, 90);
  const description = clamp(meta.description || DEFAULT_DESCRIPTION, 220);
  const url = meta.url || SITE_ORIGIN;
  const noScript = `<noscript><main><h1>${esc(title)}</h1><p>${esc(description)}</p><p><a href="${esc(url)}">Open on Minds</a></p></main></noscript>`;
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, noScript);
  if (META_BLOCK_RE.test(html)) return html.replace(META_BLOCK_RE, block);
  // Older dist without the marker block (built before inject-boot-shell wrote
  // it): drop the stock <title> and inject before </head>.
  html = html.replace(/<title>[\s\S]*?<\/title>/, '');
  return html.replace('</head>', `${block}\n</head>`);
}

function renderPage(meta) {
  return injectPage(loadIndexHtml(), meta);
}

// ── Static file serving ─────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.map', '.svg', '.txt', '.xml', '.webmanifest']);

// Content-hashed bundle assets are immutable; gzip them once and keep the
// result (the main JS bundle is ~1MB → ~300KB and requested by every new
// visitor, so per-request gzip would burn CPU for nothing).
const gzipCache = new Map(); // filePath → { mtime, gz }
const GZIP_CACHE_MAX = 64;


// Security response headers, applied to every response (backlog item 10).
//
// The production surface shipped with NONE of these — verified against
// https://minds.on.recursiv.io/ on 2026-08-01, whose entire header set was
// alt-svc / cache-control / content-type / date / content-length.
//
// REFERRER-POLICY IS THE LOAD-BEARING ONE HERE, and it is why this is not
// merely hygiene: already-issued password-reset links can carry their token in
// the query (`/reset-password?token=...`, see #302). Without a referrer policy
// that URL is sent in the `Referer` header to every third-party origin the page
// pulls from. `strict-origin-when-cross-origin` sends only the origin off-site,
// so the token stops leaving with it. New reset links use a fragment and remove
// it from browser history, but this remains defense in depth for old links.
//
// X-Content-Type-Options stops MIME sniffing turning a user upload into script.
// X-Frame-Options stops the app being framed for clickjacking.
// HSTS is set without `preload` deliberately — preload is a one-way door for
// the whole domain and is a human's call, not a server default's.
//
// NO Content-Security-Policy is set here. A wrong CSP breaks the app silently
// and an Expo web bundle needs its sources enumerated first; shipping a
// permissive one would be worse than none because it reads as protection.
// That is its own task with its own testing, and it is named in the PR.
const SECURITY_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

function serveFile(req, res, filePath, urlPath) {
  const ext = extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const cacheControl = urlPath.startsWith('/_expo/static/')
    ? 'public, max-age=31536000, immutable'
    : ext === '.html'
      ? 'no-cache'
      : 'public, max-age=3600';
  const headers = { 'Content-Type': type, 'Cache-Control': cacheControl, ...SECURITY_HEADERS };

  const stat = statSync(filePath);
  const wantsGzip = COMPRESSIBLE.has(ext) && stat.size > 1024 &&
    /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  let body = null;
  if (wantsGzip) {
    const hit = gzipCache.get(filePath);
    if (hit && hit.mtime === stat.mtimeMs) {
      body = hit.gz;
    } else {
      body = gzipSync(readFileSync(filePath));
      if (gzipCache.size >= GZIP_CACHE_MAX) gzipCache.delete(gzipCache.keys().next().value);
      gzipCache.set(filePath, { mtime: stat.mtimeMs, gz: body });
    }
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  } else {
    body = readFileSync(filePath);
  }
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendHtml(req, res, html, status = 200, extraHeaders = {}) {
  const wantsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = wantsGzip ? gzipSync(Buffer.from(html)) : Buffer.from(html);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Content-Length': body.length,
    ...(wantsGzip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
    ...extraHeaders,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendBody(req, res, content, contentType, cacheControl = 'public, max-age=3600') {
  const body = Buffer.from(content);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
    'Content-Length': body.length,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendLegacyApiUpgrade(req, res, response) {
  const body = Buffer.from(response.body);
  res.writeHead(response.status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': body.length,
    Upgrade: 'Minds/2.0',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function sendActivityPubResponse(req, res, response) {
  res.writeHead(response.status, {
    ...SECURITY_HEADERS,
    'Content-Type': response.contentType,
    'Cache-Control': response.cacheControl,
    'Content-Length': response.body.length,
    Vary: 'Accept',
    ...(response.retryAfter ? { 'Retry-After': response.retryAfter } : {}),
  });
  res.end(req.method === 'HEAD' ? undefined : response.body);
}

function legacyStatusPage(status) {
  const unavailable = status === 503;
  const title = unavailable ? 'Post temporarily unavailable' : 'This post is no longer available';
  const description = unavailable
    ? 'Minds could not resolve this historical link right now. Please try again shortly.'
    : 'This historical Minds post could not be carried to the new network.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta name="robots" content="noindex" /><title>${esc(title)} — Minds</title></head>` +
    `<body><main><h1>${esc(title)}</h1><p>${esc(description)}</p>` +
    `<p><a href="${esc(`${SITE_ORIGIN}/discover`)}">Discover Minds</a></p></main></body></html>`;
}

export function healthResponseForDist(dist = DIST, env = process.env) {
  try {
    const commit = resolveServedCommit({ dist, env });
    return {
      status: 200,
      body: JSON.stringify({ status: 'ok', commit }),
    };
  } catch {
    return {
      status: 503,
      body: JSON.stringify({ status: 'degraded', commit: null }),
    };
  }
}

export async function handleRequest(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const legacyApiUpgrade = legacyApiUpgradeResponseForPath(pathname);
    if (legacyApiUpgrade) {
      // Drain POST/PUT bodies so keep-alive clients can reuse the connection.
      req.resume();
      return sendLegacyApiUpgrade(req, res, legacyApiUpgrade);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }

    if (pathname === '/healthz') {
      const health = healthResponseForDist(DIST);
      const body = Buffer.from(health.body);
      res.writeHead(health.status, {
        ...SECURITY_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': body.length,
      });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }

    if (pathname === '/robots.txt') {
      return sendBody(req, res, renderRobots(), 'text/plain; charset=utf-8');
    }
    if (pathname === '/.well-known/security.txt') {
      return sendBody(req, res, renderSecurityTxt(), 'text/plain; charset=utf-8');
    }
    if (pathname === '/sitemap.xml') {
      return sendBody(
        req,
        res,
        await sitemapForPublicApi(),
        'application/xml; charset=utf-8',
        'public, max-age=300',
      );
    }
    if (
      pathname === '/apple-app-site-association' ||
      pathname === '/.well-known/apple-app-site-association'
    ) {
      return sendBody(
        req,
        res,
        renderAppleAssociation(),
        'application/json; charset=utf-8',
      );
    }
    if (pathname === '/.well-known/assetlinks.json') {
      return sendBody(
        req,
        res,
        renderAndroidAssetLinks(),
        'application/json; charset=utf-8',
      );
    }

    const activityPubResponse = await legacyActivityPubActorResponseForPath(pathname);
    if (activityPubResponse) {
      return sendActivityPubResponse(req, res, activityPubResponse);
    }

    const legacyResponse = await legacyResponseForPath(pathname);
    if (legacyResponse) {
      if (legacyResponse.status === 308) {
        const location = new URL(legacyResponse.location, `${SITE_ORIGIN}/`).toString();
        res.writeHead(308, {
          ...SECURITY_HEADERS,
          Location: location,
          'Cache-Control': 'public, max-age=300',
        });
        return res.end();
      }
      return sendHtml(
        req,
        res,
        legacyStatusPage(legacyResponse.status),
        legacyResponse.status,
        legacyResponse.status === 503 ? { 'Retry-After': '60' } : {},
      );
    }

    // Static file? (normalize + prefix check keeps traversal out of dist)
    if (pathname !== '/' && !pathname.endsWith('/')) {
      let decoded = pathname;
      try { decoded = decodeURIComponent(pathname); } catch {}
      const filePath = normalize(join(DIST, decoded));
      if (filePath.startsWith(normalize(DIST)) && existsSync(filePath) && statSync(filePath).isFile()) {
        return serveFile(req, res, filePath, decoded);
      }
    }

    // SPA fallback with per-URL meta.
    const meta = await metaForPath(pathname, url.searchParams);
    return sendHtml(req, res, renderPage(meta));
  } catch (err) {
    console.error('[meta-server]', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('internal error');
  }
}

const server = createServer(handleRequest);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    console.log(`[meta-server] serving ${DIST} on :${PORT}`);
    console.log(`[meta-server] site=${SITE_ORIGIN} public-api=${API_ORIGIN}/api/trpc`);
  });
}
