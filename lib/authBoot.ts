/**
 * A missing Minds 2.0 auth version is normal on the first launch after the
 * legacy app updates to v6. Only discard for a version mismatch when there is
 * actually Minds 2.0 auth state to invalidate; otherwise boot must continue to
 * the legacy-session handoff.
 */
export function shouldDiscardStoredAuth(
  storedVersion: string | null,
  currentVersion: string,
  storedAuthValues: Array<string | null>,
): boolean {
  return storedAuthValues.some(Boolean) && storedVersion !== currentVersion;
}
