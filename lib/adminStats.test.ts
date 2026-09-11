import { describe, expect, it } from 'vitest';
import { formatApiSuccess, normalizeAdminStats } from './adminStats';

describe('launch activity dashboard metrics', () => {
  it('uses real activity windows instead of lifetime vanity counts', () => {
    const stats = normalizeAdminStats({
      total_users: 2_900_000,
      active_users: 2_800_000,
      daily_active_users: 12,
      weekly_active_users: 42,
      today_signups: 3,
      recent_signups_7d: 17,
      total_posts: 1_000_000,
      posts_24h: 8,
      posts_7d: 55,
      total_messages: 200_000,
      messages_24h: 20,
      messages_7d: 91,
      total_communities: 700,
      banned_users: 5,
      api_requests_24h: 1_000,
      api_errors_24h: 7,
    });

    expect(stats).toMatchObject({
      hasLaunchActivity: true,
      totalUsers: 2_900_000,
      activeToday: 12,
      activeWeek: 42,
      postsToday: 8,
      postsWeek: 55,
      messagesToday: 20,
      messagesWeek: 91,
    });
    expect(formatApiSuccess(stats)).toBe('99.3%');
  });

  it('keeps the dashboard honest during a rolling API deploy', () => {
    const stats = normalizeAdminStats({
      total_users: 25,
      active_users: 24,
      total_posts: 80,
      total_messages: 30,
    });

    expect(stats).toMatchObject({
      hasLaunchActivity: false,
      totalUsers: 25,
      activeToday: null,
      activeWeek: null,
      postsWeek: 80,
      messagesWeek: 30,
      apiRequests: null,
      apiErrors: null,
    });
    expect(formatApiSuccess(stats)).toBe('—');
  });

  it('never presents an invalid error ratio as a success percentage', () => {
    const stats = normalizeAdminStats({
      weekly_active_users: 1,
      api_requests_24h: 2,
      api_errors_24h: 3,
    });

    expect(formatApiSuccess(stats)).toBe('0.0%');
  });
});
