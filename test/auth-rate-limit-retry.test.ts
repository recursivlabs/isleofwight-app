import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { authCooldownMs, E2E_HONORABLE_COOLDOWN_SECONDS } from '../e2e/authCooldown';
import { retryRateLimitedAuth } from '../scripts/auth-rate-limit-retry.mjs';

describe('staging authentication cooldowns', () => {
  it('waits beyond one bounded SDK cooldown and retries exactly once', async () => {
    const throttled = Object.assign(new Error('Too many sign-in attempts'), {
      status: 429,
      retryAfter: 116,
    });
    const operation = vi.fn()
      .mockRejectedValueOnce(throttled)
      .mockResolvedValueOnce('authenticated');
    const sleep = vi.fn(async () => {});
    const log = vi.fn();

    await expect(retryRateLimitedAuth(operation, { sleep, log })).resolves.toBe('authenticated');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(117_000);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('116s server cooldown'));
  });

  it.each([
    [{ status: 500, retryAfter: 10 }, 'non-rate-limit error'],
    [{ status: 429 }, 'missing cooldown'],
    [{ status: 429, retryAfter: 0 }, 'zero cooldown'],
    [{ status: 429, retryAfter: 901 }, 'oversized cooldown'],
  ])('keeps the check red for %s', async (fields, _label) => {
    const error = Object.assign(new Error('authentication failed'), fields);
    const operation = vi.fn().mockRejectedValue(error);
    const sleep = vi.fn(async () => {});

    await expect(retryRateLimitedAuth(operation, { sleep, log: vi.fn() })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it('propagates a second failure after the one permitted retry', async () => {
    const first = Object.assign(new Error('first limit'), { status: 429, retryAfter: 2 });
    const second = Object.assign(new Error('second limit'), { status: 429, retryAfter: 2 });
    const operation = vi.fn().mockRejectedValueOnce(first).mockRejectedValueOnce(second);

    await expect(
      retryRateLimitedAuth(operation, { sleep: vi.fn(async () => {}), log: vi.fn() }),
    ).rejects.toBe(second);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it.each([
    [429, '116', 117_000],
    // 242s was declared live by the engine's per-account window
    // (smoke-staging run 33030784215); it must be honored, not refused.
    [429, '242', 243_000],
    [429, '900', 901_000],
    [200, '116', null],
    [429, null, null],
    [429, 'not-a-number', null],
    [429, '0', null],
    [429, '901', null],
  ])('maps HTTP %s Retry-After %s to %s', (status, retryAfter, expected) => {
    expect(authCooldownMs(status, retryAfter)).toBe(expected);
  });

  // The browser e2e job is killed at 10 minutes with ~3 of them spent on
  // setup, so it passes its own tighter bound. 480s was declared live by the
  // engine (CI run 33033676911) and died as an opaque test timeout; under the
  // bound it must be refused up front instead.
  it.each([
    [429, '242', 243_000], // largest cooldown seen live — honored (positive control)
    [429, '250', 251_000], // the boundary itself is honorable
    [429, '251', null], // one past the boundary is refused
    [429, '480', null], // the live case that killed CI run 1421
  ])('e2e bound maps HTTP %s Retry-After %s to %s', (status, retryAfter, expected) => {
    expect(authCooldownMs(status, retryAfter, E2E_HONORABLE_COOLDOWN_SECONDS)).toBe(expected);
  });

  it('smoke spec extends its test timeout by the honored wait, before waiting', () => {
    // A 480s honored cooldown under the spec's fixed 4-minute timeout dies
    // inside page.waitForTimeout (CI run 33033676911). Pin the real file: the
    // extension must exist and precede the wait it protects.
    const spec = readFileSync(join(process.cwd(), 'e2e/smoke.spec.ts'), 'utf8');
    const extendIdx = spec.indexOf('test.setTimeout(test.info().timeout + waitMs)');
    const waitIdx = spec.indexOf('await page.waitForTimeout(waitMs)');
    expect(extendIdx).toBeGreaterThan(-1);
    expect(waitIdx).toBeGreaterThan(extendIdx);
    // And the spec must apply its own budget bound, not the engine-wide one.
    expect(spec).toContain('E2E_HONORABLE_COOLDOWN_SECONDS)');
  });

  it('honors the 242s cooldown the engine declared in the live failure', async () => {
    const throttled = Object.assign(new Error('Too many sign-in attempts'), {
      status: 429,
      retryAfter: 242,
    });
    const operation = vi.fn()
      .mockRejectedValueOnce(throttled)
      .mockResolvedValueOnce('authenticated');
    const sleep = vi.fn(async () => {});

    await expect(
      retryRateLimitedAuth(operation, { sleep, log: vi.fn() }),
    ).resolves.toBe('authenticated');
    expect(sleep).toHaveBeenCalledWith(243_000);
  });
});
