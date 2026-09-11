import { Platform } from 'react-native';
import {
  captureNativeException,
  captureNativeMessage,
  initNativeMonitoring,
  setNativeUser,
} from './nativeMonitoring';

// Client error monitoring via PostHog — the SAME project the platform server
// already reports to (postHogService on the API). Server errors + web client
// errors + future Minds Cloud apps all land in one PostHog dashboard,
// correlated by user. Set EXPO_PUBLIC_POSTHOG_KEY (the phc_... project key,
// safe on the client) + optional EXPO_PUBLIC_POSTHOG_HOST in the deploy env.
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let ph: any = null;
let loading = false;

// Property keys whose value is a URL we must not send with its query string
// attached. Matched on the KEY, never on the value: a value-based rule would
// also rewrite `$exception_stack_trace_raw`, which is full of bundle URLs and
// is the property we most need intact.
const URL_PROPERTY = /(?:url|referrer)$/i;

/**
 * Remove the query string and fragment from every URL-valued property before an
 * event leaves the browser. Installed as posthog's `before_send`.
 *
 * WHY THIS EXISTS — this is not defensive, the leak was reproduced (#302).
 * Password-reset capabilities have appeared in URL state (legacy
 * `/reset-password?token=...` links and new fragment-delivered reset links).
 * With
 * posthog running our exact production options, a single `capture('$exception')`
 * on that page attached the token to TWO properties:
 *
 *     $current_url        http://.../reset-password?token=SENTINEL_TOKEN_XYZ
 *     $session_entry_url  http://.../reset-password?token=SENTINEL_TOKEN_XYZ
 *
 * `capture_pageview: false` does not prevent this. It disables the automatic
 * `$pageview` EVENT; the URL is attached to every event's properties either way.
 *
 * `$session_entry_url` is the one that makes this worse than it looks: it is
 * the URL the SESSION started on, so it rides along on every event for the rest
 * of the session. A user who lands on the reset link and hits an error four
 * screens later still ships the token.
 *
 * Chosen over `mask_personal_data_properties`, which masks a fixed list of
 * advertising params (gclid, fbclid, …) plus names you enumerate. Enumerating
 * secret names means the next one that is not on the list leaks. Dropping the
 * whole query string needs no list.
 */
export function stripUrlSecrets(cr: any) {
  const props = cr?.properties;
  if (!props) return cr;
  for (const key of Object.keys(props)) {
    if (!URL_PROPERTY.test(key)) continue;
    const value = props[key];
    if (typeof value !== 'string') continue;
    const cut = value.search(/[?#]/);
    if (cut !== -1) props[key] = value.slice(0, cut);
  }
  return cr;
}

/**
 * The options we initialise posthog with. Exported so the regression test can
 * exercise THE SHIPPED CONFIG rather than a copy of it — a copied config drifts,
 * and a test that passes against a config nobody runs is not a guard.
 */
export function posthogInitOptions() {
  return {
    api_host: HOST,
    capture_pageview: false,
    autocapture: false,
    person_profiles: 'identified_only' as const,
    before_send: stripUrlSecrets,
  };
}

// Work queued while posthog-js is still downloading. WITHOUT THIS THE SPLIT
// WOULD COST US THE FIRST ERROR — which is usually the one that matters, since
// a boot-path failure fires before any dynamic import can resolve. Bounded so a
// never-resolving import cannot grow it without limit.
type Pending = { fn: 'capture' | 'identify' | 'reset'; args: any[] };
const pending: Pending[] = [];
const MAX_PENDING = 50;

function enqueue(fn: Pending['fn'], ...args: any[]) {
  if (pending.length < MAX_PENDING) pending.push({ fn, args });
}

function drain() {
  if (!ph) { pending.length = 0; return; }
  for (const { fn, args } of pending.splice(0, pending.length)) {
    try { (ph as any)[fn](...args); } catch {}
  }
}

/**
 * Load posthog-js as its OWN CHUNK rather than inside the main bundle.
 *
 * It is 75.5 KB gzipped (measured against the published package) of a 1141 KB
 * bundle — 6.6% of what every first visit downloads before anything renders,
 * for a library that only reports errors. #193.
 *
 * `require()` did NOT achieve this: Metro resolves it statically and includes
 * the module regardless of whether the branch runs, so the old guard deferred
 * INITIALISATION and not one byte of download. `await import()` is what
 * actually splits.
 */
function load() {
  if (loading) return;
  loading = true;
  // PostHog remains web-only; native events go through Sentry in the platform-
  // selected nativeMonitoring implementation.
  if (Platform.OS !== 'web' || !KEY) { pending.length = 0; return; }
  import('posthog-js')
    .then(mod => {
      const posthog = (mod as any).default ?? mod;
      posthog.init(KEY, posthogInitOptions());
      ph = posthog;
      drain();
    })
    .catch(() => {
      ph = null;
      pending.length = 0;   // never retried; do not hold events forever
    });
}

/** Initialize at app boot. Starts the chunk download; does not block on it. */
export function initMonitoring() {
  if (Platform.OS !== 'web') {
    initNativeMonitoring();
    return;
  }
  load();
}

const exceptionProps = (err: Error, source: string, extra?: Record<string, any>) => ({
  $exception_type: err.name || 'Error',
  $exception_message: err.message,
  $exception_stack_trace_raw: err.stack || '',
  $exception_source: source,
  $lib: 'minds-web',
  ...extra,
});

/** Report an error (and always log it). Accepts unknown for catch blocks. */
export function captureException(error: unknown, context?: Record<string, any>) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  console.error('[Error]', err.message, context || '');
  if (Platform.OS !== 'web') {
    captureNativeException(err, context);
    return;
  }
  load();
  const props = exceptionProps(err, 'web', context);
  if (ph) ph.capture('$exception', props); else enqueue('capture', '$exception', props);
}

/** Report a non-fatal condition on a critical path. */
export function captureMessage(message: string, context?: Record<string, any>) {
  console.warn('[Warn]', message, context || '');
  if (Platform.OS !== 'web') {
    captureNativeMessage(message, context);
    return;
  }
  load();
  const props = exceptionProps(new Error(message), 'web', { level: 'warning', ...context });
  if (ph) ph.capture('$exception', props); else enqueue('capture', '$exception', props);
}

export function setUser(user: { id: string; username?: string; email?: string } | null) {
  if (Platform.OS !== 'web') {
    setNativeUser(user ? { id: user.id, username: user.username } : null);
    return;
  }
  load();
  if (user) {
    const args = [user.id, { username: user.username, email: user.email }];
    if (ph) ph.identify(...(args as [string, any])); else enqueue('identify', ...args);
  } else {
    if (ph) ph.reset(); else enqueue('reset');
  }
}
