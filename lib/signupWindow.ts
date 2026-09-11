/**
 * Is this account a fresh signup still completing onboarding — or an
 * established account that must never be routed to a screen that can rename it?
 *
 * #189: the "has this person chosen a username" flag is DEVICE-LOCAL, so an
 * existing user signing in on a new phone had no flag, was forced through the
 * username picker, and accepting its email-derived guess silently renamed their
 * account. One sign-in minted `bill-1` on an account created in 2012.
 *
 * THE FAILURE DIRECTION IS THE WHOLE DESIGN. A missing, empty or unparseable
 * `created_at` returns FALSE — established — because the two errors are not
 * symmetric:
 *   · wrongly treating a NEW user as established → they keep an auto-assigned
 *     handle they can change in Settings whenever they like.
 *   · wrongly treating an OLD user as new → their identity is destroyed and
 *     every link and @mention to them breaks.
 * When uncertain, do not rename anybody.
 */
export const NEW_ACCOUNT_WINDOW_MS = 30 * 60 * 1000;

export function isFreshSignup(
  createdAt: string | null | undefined,
  now: number = Date.now(),
  windowMs: number = NEW_ACCOUNT_WINDOW_MS,
): boolean {
  if (!createdAt) return false;
  const ms = Date.parse(createdAt);
  if (!Number.isFinite(ms)) return false;
  // A future timestamp (clock skew) is not a signup that just happened.
  if (ms > now) return false;
  return now - ms < windowMs;
}
