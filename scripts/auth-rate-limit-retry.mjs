// The engine's sign-in limiter uses fixed windows of 10 minutes per IP and
// 15 minutes per account (AUTH_SIGNIN_IP_WINDOW_SECONDS /
// AUTH_SIGNIN_ACCOUNT_WINDOW_SECONDS defaults in apps/api/authRoutes.ts), so
// a real Retry-After can reach 900s. Run 33030784215 went red on a declared
// 242s cooldown because this bound sat below the server's own contract.
export const MAX_AUTH_COOLDOWN_SECONDS = 900;

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry one staging authentication operation after an explicit server
 * cooldown. Every other error, a missing/unsafe cooldown, and a second failure
 * still reject so a monitor can never turn "could not authenticate" green.
 */
export async function retryRateLimitedAuth(
  operation,
  {
    sleep = defaultSleep,
    log = console.warn,
    maxCooldownSeconds = MAX_AUTH_COOLDOWN_SECONDS,
  } = {},
) {
  try {
    return await operation();
  } catch (error) {
    const retryAfter = Number(error?.retryAfter);
    const canRetry =
      error?.status === 429 &&
      Number.isSafeInteger(retryAfter) &&
      retryAfter >= 1 &&
      retryAfter <= maxCooldownSeconds;

    if (!canRetry) throw error;

    // One second beyond the declared boundary avoids racing a fixed-window
    // reset on runners whose clocks differ slightly from the API host.
    const waitMs = (retryAfter + 1) * 1_000;
    log(`Staging authentication rate-limited; retrying once after ${retryAfter}s server cooldown.`);
    await sleep(waitMs);
    return operation();
  }
}
