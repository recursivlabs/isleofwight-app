export interface AdminDashboardStats {
  hasLaunchActivity: boolean;
  totalUsers: number;
  activeToday: number | null;
  activeWeek: number | null;
  newToday: number;
  newWeek: number;
  postsToday: number | null;
  postsWeek: number;
  messagesToday: number | null;
  messagesWeek: number;
  communities: number;
  banned: number;
  apiRequests: number | null;
  apiErrors: number | null;
}

/**
 * Normalize the additive launch fields while an older API may still be live.
 * The dashboard remains useful during a rolling deploy instead of showing
 * authoritative-looking zeroes for metrics the old server never returned.
 */
export function normalizeAdminStats(input: Record<string, unknown>): AdminDashboardStats {
  const hasLaunchActivity = typeof input.weekly_active_users === 'number';
  const numberOr = (value: unknown, fallback = 0) => typeof value === 'number' ? value : fallback;

  return {
    hasLaunchActivity,
    totalUsers: numberOr(input.total_users, numberOr(input.active_users)),
    activeToday: hasLaunchActivity ? numberOr(input.daily_active_users) : null,
    activeWeek: hasLaunchActivity ? numberOr(input.weekly_active_users) : null,
    newToday: numberOr(input.today_signups),
    newWeek: numberOr(input.recent_signups_7d),
    postsToday: hasLaunchActivity ? numberOr(input.posts_24h) : null,
    postsWeek: hasLaunchActivity ? numberOr(input.posts_7d) : numberOr(input.total_posts),
    messagesToday: hasLaunchActivity ? numberOr(input.messages_24h) : null,
    messagesWeek: hasLaunchActivity ? numberOr(input.messages_7d) : numberOr(input.total_messages),
    communities: numberOr(input.total_communities),
    banned: numberOr(input.banned_users),
    apiRequests: hasLaunchActivity ? numberOr(input.api_requests_24h) : null,
    apiErrors: hasLaunchActivity ? numberOr(input.api_errors_24h) : null,
  };
}

export function formatApiSuccess(stats: AdminDashboardStats): string {
  if (!stats.apiRequests || stats.apiErrors == null) return '—';
  const success = Math.max(0, Math.min(1, 1 - stats.apiErrors / stats.apiRequests));
  return `${(success * 100).toFixed(1)}%`;
}
