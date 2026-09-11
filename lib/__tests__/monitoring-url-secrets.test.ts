import { describe, it, expect, beforeEach } from 'vitest';
import { stripUrlSecrets, posthogInitOptions } from '../monitoring';

// #302 — a password-reset token was reaching PostHog inside the URL properties
// attached to every captured event.
//
// Already-issued reset links can be `/reset-password?token=...`; new links use
// a fragment and app/reset-password.tsx removes either form from history. This
// legacy form remains the stronger analytics regression fixture because it is
// sent in an HTTP request and can seed a session URL before React mounts.
// posthog attaches the page URL to event properties independently of
// `capture_pageview`, so the token left the browser inside `$current_url` — and
// inside `$session_entry_url`, which persists for the whole session.

const SENTINEL = 'SENTINEL_TOKEN_XYZ';
const RESET_URL = `/reset-password?token=${SENTINEL}`;

describe('stripUrlSecrets', () => {
  it('drops the query string from URL properties', () => {
    const cr = stripUrlSecrets({
      event: '$exception',
      properties: {
        $current_url: `https://minds.com${RESET_URL}`,
        $session_entry_url: `https://minds.com${RESET_URL}`,
        $referrer: `https://minds.com${RESET_URL}`,
      },
    });
    expect(cr.properties.$current_url).toBe('https://minds.com/reset-password');
    expect(cr.properties.$session_entry_url).toBe('https://minds.com/reset-password');
    expect(cr.properties.$referrer).toBe('https://minds.com/reset-password');
  });

  it('drops the fragment too — a token in a hash is no safer', () => {
    const cr = stripUrlSecrets({
      properties: { $current_url: `https://minds.com/reset#token=${SENTINEL}` },
    });
    expect(cr.properties.$current_url).toBe('https://minds.com/reset');
  });

  it('leaves a stack trace alone', () => {
    // The rule matches on the KEY for exactly this reason. Stack frames are
    // full of URLs, and mangling them would cost us the property that makes an
    // error report worth having.
    const stack = 'Error: boom\n  at f (https://minds.com/static/js/app.js?v=3:1:2)';
    const cr = stripUrlSecrets({ properties: { $exception_stack_trace_raw: stack } });
    expect(cr.properties.$exception_stack_trace_raw).toBe(stack);
  });

  it('leaves URL properties that carry no query or fragment untouched', () => {
    const cr = stripUrlSecrets({
      properties: { $current_url: 'https://minds.com/feed', $referrer: '$direct' },
    });
    expect(cr.properties.$current_url).toBe('https://minds.com/feed');
    expect(cr.properties.$referrer).toBe('$direct');
  });

  it('survives events with no properties', () => {
    expect(() => stripUrlSecrets(null)).not.toThrow();
    expect(() => stripUrlSecrets({ event: 'x' })).not.toThrow();
  });
});

// Drives the REAL posthog-js against the REAL exported config. Nothing here
// restates what monitoring.ts sets — if the sanitiser is dropped from
// posthogInitOptions(), `before_send` below is empty and the token comes back.
async function captureUnder(name: string, options: Record<string, any>) {
  const mod: any = await import('posthog-js');
  const posthog = mod.default ?? mod;
  let seen: any = null;
  const record = (cr: any) => { if (cr?.event === '$exception') seen = cr; return null; };
  // Named instance. The default one is a singleton: a second init() against it
  // is ignored, so the second test in this file would silently run under the
  // FIRST test's config and capture nothing.
  const instance = posthog.init('phc_test', {
    ...options,
    api_host: 'https://posthog.invalid',
    before_send: [...[options.before_send].flat().filter(Boolean), record],
  }, name);
  instance.capture('$exception', { $exception_message: 'boom' });
  return seen;
}

const leakedProps = (cr: any) =>
  Object.entries(cr?.properties ?? {})
    .filter(([, v]) => typeof v === 'string' && v.includes(SENTINEL))
    .map(([k]) => k)
    .sort();

describe('posthog integration — the token does not leave the browser', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', RESET_URL);
  });

  it('the leak is real without the sanitiser', async () => {
    // The control, run every time rather than by hand. It is what makes the
    // test below evidence instead of an assertion that nothing happens to be
    // there. If this ever fails, posthog changed what it attaches — read the
    // new behaviour before assuming the risk is gone.
    const { before_send, ...withoutSanitiser } = posthogInitOptions();
    const cr = await captureUnder('control_no_sanitiser', withoutSanitiser);
    expect(leakedProps(cr)).toEqual(['$current_url', '$session_entry_url']);
  });

  it('no property carries the token under the shipped config', async () => {
    const cr = await captureUnder('shipped_config', posthogInitOptions());
    expect(cr).toBeTruthy();
    expect(leakedProps(cr)).toEqual([]);
    expect(cr.properties.$current_url).toBe('http://localhost:3000/reset-password');
  });
});

// ── The sweep #302 named as missing: "No sweep for other secrets in query
// strings. Only the reset token was traced. The fix is generic so an unknown
// second case is covered by luck, not by audit."
//
// The audit, run 2026-08-06 over app/ components/ lib/ — every distinct query
// parameter appearing in an in-app URL:
//
//   ?sort= ?ref= ?q= ?v= ?token= ?since= ?mode= ?limit= ?tag_ids= ?id= ?url= ?until=
//
// Exactly one is credential-bearing: `?token=` (the reset link). No `?code=`,
// `?otp=`, `?secret=`, `?key=`, `?invite=` or `?session=` exists in the tree.
// So the coverage is no longer luck — it is one audited case plus a rule that
// drops the WHOLE query string rather than a named-parameter denylist.
//
// These cases pin that property, because a future refactor to "strip only the
// params we know about" would pass every test above and silently re-open #302
// for the next secret someone adds.
describe('the strip is categorical, not a denylist (#302 sweep)', () => {
  it('drops query strings the audit never saw — unknown params included', () => {
    for (const q of ['?otp=123456', '?invite=ABC', '?session=sk_live_x', '?whatever=1']) {
      const cr = stripUrlSecrets({ properties: { $current_url: `https://minds.com/x${q}` } });
      expect(cr.properties.$current_url).toBe('https://minds.com/x');
    }
  });

  it('drops a secret that arrives as the SECOND parameter', () => {
    const cr = stripUrlSecrets({
      properties: { $current_url: 'https://minds.com/x?ref=email&token=SENTINEL_TOKEN_XYZ' },
    });
    expect(cr.properties.$current_url).not.toContain('SENTINEL_TOKEN_XYZ');
    expect(cr.properties.$current_url).toBe('https://minds.com/x');
  });
});
