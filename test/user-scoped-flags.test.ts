import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A device-global storage flag must not gate a PER-USER operation.
 *
 * `app/(tabs)/index.tsx` ran a one-time personal-agent persona heal behind
 * `minds:agentPersonaHealed` — a key with no user in it. Once anyone on a device
 * was healed the flag read `'1'` for everyone after them, so the second account
 * to sign in kept the wrong SDR persona permanently, and nothing retried it. The
 * key is also absent from sign-out's clear list, so the stale `'1'` outlived the
 * account that set it.
 *
 * WHY A SOURCE-READING TEST: vitest covers `lib/**` and `test/**` with
 * react-native stubbed. Screens under `app/**` are not reachable, and this class
 * of bug is invisible to `signout-completeness.test.ts`, which scans `lib/` for
 * modules holding module-level state. Two of the three flags in this file were
 * already user-scoped; the third was not, and nothing compared them.
 */

const SCREEN = join(__dirname, '..', 'app', '(tabs)', 'index.tsx');
const SRC = readFileSync(SCREEN, 'utf8');

/**
 * The KEY EXPRESSION passed to each getItem/setItem call — not every string
 * literal in the file.
 *
 * My first version of this scanned literals and reported two false positives:
 * `PROFILE_NUDGE_DISMISSED_KEY` and `FEED_LAST_VISIT_KEY` are declared bare and
 * scoped at the call site (`` `${KEY}:${user.id}` ``). The declaration is not
 * the thing that decides whether a read is user-scoped; the call is.
 */
function storageCallKeys(): string[] {
  const calls: string[] = [];
  for (const m of SRC.matchAll(/\b(?:get|set)Item\(\s*([`'][^`']*[`'])/g)) calls.push(m[1]);
  return calls;
}

describe('per-user flags in the feed screen are scoped to the user', () => {
  it('finds the storage calls by scanning — a zero scan would make this file decoration', () => {
    // Positive control. Without it every assertion below passes vacuously the
    // moment the file moves or the regex stops matching.
    expect(storageCallKeys().length).toBeGreaterThanOrEqual(3);
  });

  it('the persona-heal flag carries the user id', () => {
    // The specific regression: a bare 'minds:agentPersonaHealed' is device-global
    // and gates a per-user operation, so the second account on a device is
    // skipped forever.
    const bare = storageCallKeys().filter(
      (k) => k.includes('agentPersonaHealed') && !k.includes('${user.id}'),
    );
    expect(bare, 'persona-heal flag is device-global — it gates a per-user operation').toEqual([]);
  });

  it('every storage call in this screen is user-scoped', () => {
    // The general rule, so the next flag added here inherits it. A genuinely
    // device-wide key must be added to the allowlist deliberately — which is the
    // point: it forces the question to be asked once, out loud.
    const DEVICE_WIDE_BY_DESIGN: string[] = [];
    const unscoped = storageCallKeys()
      .filter((k) => !k.includes('${user.id}'))
      .filter((k) => !DEVICE_WIDE_BY_DESIGN.some((allowed) => k.includes(allowed)));
    expect(unscoped, 'these storage calls are device-global; confirm that is intended').toEqual([]);
  });
});
