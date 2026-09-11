/**
 * Labels for the billing screen. Pure, so the legacy-membership wording is
 * unit tested. A status of 'legacy' means the entitlement came over from
 * minds.com at import and there is no subscription to manage on this stack.
 */
export type BillingStatusLike = {
  status?: string | null;
  active?: boolean;
  tier?: string | null;
  currentPeriodEnd?: string | null;
  source?: string | null;
} | null;

export function isLegacyMembership(status: BillingStatusLike): boolean {
  return status?.status === 'legacy' || status?.source === 'legacy';
}

export function statusLabel(status: BillingStatusLike, tier: string): string {
  if (status?.status === 'past_due') return 'Payment needs attention';
  if (status?.status === 'canceled') return 'Canceled';
  if (tier === 'free') return 'Free plan';
  return 'Active';
}

export function periodLabel(status: BillingStatusLike): string | null {
  if (!status?.currentPeriodEnd) return null;
  const date = new Date(status.currentPeriodEnd);
  if (Number.isNaN(date.getTime())) return null;
  if (isLegacyMembership(status) && date.getFullYear() >= 2100) return 'Lifetime';
  const formatted = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  if (isLegacyMembership(status)) return `Active through ${formatted}`;
  return status.status === 'canceled' ? `Access through ${formatted}` : `Current period ends ${formatted}`;
}

/** The message shown when the server answers 409 legacy_membership: a plain state, no history. */
export function portalErrorMessage(err: unknown): string {
  const e = err as { code?: string; status?: number; statusCode?: number; message?: string } | null;
  if (e && (e.code === 'legacy_membership' || e.status === 409 || e.statusCode === 409)) {
    return 'Nothing to change here yet.';
  }
  return 'Could not open subscription management. Please try again.';
}
