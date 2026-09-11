/**
 * Eligibility and local, user-scoped state for the Minds 2.0 welcome-back
 * campaign.
 *
 * The campaign is deliberately tied to one configured launch instant. A
 * per-device or per-user clock would eventually call every post-launch signup
 * a returning member. Missing or malformed timestamps fail closed.
 */

export const WELCOME_BANNER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export function cutoverWelcomeKeys(userId: string) {
  const prefix = `minds:cutoverWelcome:v1:${userId}`;
  return {
    modalDismissed: `${prefix}:modalDismissed`,
    bannerDismissed: `${prefix}:bannerDismissed`,
  } as const;
}

const ISO_TIMESTAMP_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/;

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const match = ISO_TIMESTAMP_WITH_OFFSET.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Next instant when a mounted campaign must recalculate its visibility. */
export function nextCutoverWelcomeBoundary(launchAt: unknown, now = Date.now()): number | null {
  const launch = parseTimestamp(launchAt);
  if (launch === null || !Number.isFinite(now)) return null;
  if (now < launch) return launch;
  const expires = launch + WELCOME_BANNER_WINDOW_MS;
  return now < expires ? expires : null;
}

/**
 * Only accounts that predate launch are eligible, and only during the global
 * 30-day launch window. Exact boundaries are intentional: launch is active at
 * its configured instant and inactive exactly 30 days later.
 */
export function isCutoverWelcomeActive(
  createdAt: unknown,
  launchAt: unknown,
  now = Date.now(),
): boolean {
  const launch = parseTimestamp(launchAt);
  if (launch === null || !Number.isFinite(now)) return false;
  const created = parseTimestamp(createdAt);
  if (created === null) return false;
  return created < launch && now >= launch && now < launch + WELCOME_BANNER_WINDOW_MS;
}
