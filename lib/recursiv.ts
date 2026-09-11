import { Minds } from '@minds/sdk';

export const BASE_URL =
  process.env.EXPO_PUBLIC_RECURSIV_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  // Dedicated Minds instance API: api.minds.com → (strip api.) minds.com → matches
  // the Minds network's verified customDomain → the Minds network, served by
  // recursiv-minds-api off the dedicated Minds Neon. Cut over from the shared
  // api.minds.recursiv.io (which ran on the central multi-tenant DB).
  'https://api.minds.com/api/v1';

export const BASE_ORIGIN = BASE_URL.replace(/\/api\/v1$/, '');

// The site's own origin, used as the Referer for Bunny video requests (Bunny's
// "Block Direct URL Access" gates on referer). On web the browser sends this
// automatically; on native we attach it explicitly to the video/thumbnail
// requests. Falls back to the prod domain when there's no window (native).
export const SITE_URL =
  (typeof window !== 'undefined' && window.location?.origin) ||
  process.env.EXPO_PUBLIC_SITE_URL ||
  // This is what every share sheet on NATIVE puts on the clipboard (web uses
  // window.origin). minds.com still serves LEGACY Minds until the cutover, so
  // the default must stay the domain where the new app actually answers. At
  // cutover: set EXPO_PUBLIC_SITE_URL=https://www.minds.com (or flip this).
  'https://isleofwight.on.minds.io';

// Hardcoded fallbacks point at the Minds 2.0 project on prod. Expo's bundler
// inlines EXPO_PUBLIC_* at build time, so when Coolify env is empty (which is
// the current state for recursiv-minds), these fallbacks bake into the bundle.
// Override via env in dev / staging if needed.
export const ORG_ID =
  process.env.EXPO_PUBLIC_RECURSIV_ORG_ID || '01a0913a-f4ae-70fd-878b-f0f952d67107';
export const PROJECT_ID =
  process.env.EXPO_PUBLIC_RECURSIV_PROJECT_ID || '01a0913d-9461-721d-85c2-0ef0f3f81fb7';
export const NETWORK_ID =
  process.env.EXPO_PUBLIC_RECURSIV_NETWORK_ID || '0f1fcb0f-11c0-41f2-9406-943a88f48b59';

/** A keyless client reserved for endpoints explicitly designed as public. */
export function createPublicSdk(): Minds {
  return new Minds({
    baseUrl: BASE_URL,
    projectId: PROJECT_ID,
    anonymous: true,
    timeout: 30_000,
    maxRetries: 1,
  });
}

/**
 * Create an authenticated SDK instance with a per-user API key.
 */
export function createAuthedSdk(apiKey: string): Minds {
  return new Minds({
    apiKey,
    baseUrl: BASE_URL,
    // 300s: curator/persona agents with big tool inventories can generate for
    // 2-3 minutes; a 120s cap made the client abandon (and previously RETRY —
    // duplicating the whole turn) while the server was still working.
    timeout: 300_000,
    // BOUNDED retry budget. The SDK's fetchWithRetry already backs off
    // exponentially (1s → 2s → … capped at 10s) and HONORS the server's
    // Retry-After header before retrying a 429/5xx — so a single request never
    // hammers. The remaining storm risk was AMPLIFICATION: many components each
    // firing the same heavy lookup (e.g. /agents?limit=100) in parallel, each
    // with its own retry budget. That's fixed at the app layer (resolvePersonalAgent
    // + ensureIntroDM are now cached + in-flight-deduped to ONE request). We keep
    // the retry count tight (2) so even a cache-miss burst can't fan a 429 into a
    // long retry chain. Do NOT raise this — a higher budget re-opens the storm.
    maxRetries: 2,
  });
}

/**
 * Read-only client for public share surfaces before a visitor signs in.
 * `publicPosts` uses the platform's anonymous visibility-filtered tRPC route;
 * authenticated resources on this instance remain intentionally unused.
 */
export const publicMinds = new Minds({
  baseUrl: BASE_URL,
  projectId: PROJECT_ID,
  allowNoKey: true,
  timeout: 30_000,
  maxRetries: 0,
});

// NOTE: there is intentionally NO shared/default SDK here. A baked app key in
// a public bundle is extractable by anyone, and any fetch made with it acts as
// the KEY OWNER, not the signed-in user (the phantom-communities identity bug).
// Public pre-auth flows use the anon SDK in lib/auth.tsx; everything else must
// use the signed-in user's SDK from useAuth().
