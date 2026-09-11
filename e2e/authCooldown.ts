// Matches the engine's largest sign-in limiter window (15 min per account);
// see scripts/auth-rate-limit-retry.mjs for the derivation.
export const MAX_AUTH_COOLDOWN_SECONDS = 900;

// ci.yml's e2e job is hard-killed at timeout-minutes: 10, and ~3 minutes of
// that go to checkout/install before the first test runs (run 33033676911:
// job start 02:34:08, first test 02:36:58). A cooldown the job cannot
// outlive must fail fast with the declared value in the log — an opaque
// runner kill also discards the report upload. Workflow edits are human-only
// estate-wide, so the bound lives here next to the code it protects.
//
// The bound reserves time for the work AFTER the sleep, not just the sleep:
// 600s budget − ~170s worst observed setup − 251s honored wait leaves ~180s
// for the sign-in retry and the four remaining serial tests (the whole story
// takes ~60s when staging is healthy). 300 was the first cut and left under
// two minutes in the worst case — a legitimate cooldown plus ordinary
// staging latency could still hit the job kill this bound exists to avoid.
// 250 still honors the largest cooldown observed live (242s, run 33030784215).
export const E2E_HONORABLE_COOLDOWN_SECONDS = 250;

/**
 * Return a bounded wait for a real HTTP 429, or null to keep the check red.
 * Callers whose enclosing budget is tighter than the engine's largest window
 * pass their own bound (the browser e2e passes E2E_HONORABLE_COOLDOWN_SECONDS).
 */
export function authCooldownMs(
  status: number,
  retryAfterHeader: string | null,
  maxSeconds: number = MAX_AUTH_COOLDOWN_SECONDS,
): number | null {
  if (status !== 429 || retryAfterHeader === null) return null;

  const retryAfter = Number(retryAfterHeader);
  if (!Number.isSafeInteger(retryAfter) || retryAfter < 1 || retryAfter > maxSeconds) {
    return null;
  }

  return (retryAfter + 1) * 1_000;
}
