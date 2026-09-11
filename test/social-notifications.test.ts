import { describe, expect, it, vi } from 'vitest';
import { isSocialNotif, loadSocialPage, markCategoryRead } from '../lib/socialNotifications';

// THE BUG THIS COVERS
// The sidebar badge counted every unread row; the notifications screen filtered
// operator rows out after the page arrived. The badge read 48 while the list
// rendered none, and no tap could reconcile them. Both surfaces now share
// isSocialNotif, and the screen pages until it actually has social rows —
// filtering one mixed page is not enough when an account runs agents.

const social = (id: string, target_type = 'post_reply') => ({ id, target_type, status: 'unread' });
const operator = (id: string, target_type = 'task_claimed') => ({ id, target_type, status: 'unread' });

describe('isSocialNotif', () => {
  it('keeps what a person did to you', () => {
    for (const t of ['post_reply', 'post_reaction', 'post_repost', 'post_mention', 'follow', 'chat_message', 'community_invite', 'community_join']) {
      expect(isSocialNotif({ target_type: t }), t).toBe(true);
    }
  });

  it('drops agent, build, task and billing activity', () => {
    for (const t of ['task_claimed', 'task_done', 'agent_error', 'agent_needs_input', 'deploy_failed', 'deploy_succeeded', 'first_deploy', 'first_task_done', 'big_day', 'reengage_waiting', 'credit_low', 'payment_failed', 'pr_created']) {
      expect(isSocialNotif({ target_type: t }), t).toBe(false);
    }
  });

  it('drops dispatcher "Working on:" rows whatever their target type', () => {
    expect(isSocialNotif({ target_type: 'post_reply', title: 'Working on: the feed' })).toBe(false);
  });

  it('reads either camelCase or snake_case, and survives a missing field', () => {
    expect(isSocialNotif({ targetType: 'task_done' })).toBe(false);
    expect(isSocialNotif({})).toBe(true);
    expect(isSocialNotif(null)).toBe(true);
  });
});

describe('loadSocialPage', () => {
  it('keeps paging when a whole page is operator noise', async () => {
    // 30 operator rows, then the social ones. One page would render nothing.
    const page1 = Array.from({ length: 30 }, (_, i) => operator(`op${i}`));
    const page2 = [social('s1'), social('s2'), operator('op30')];
    const list = vi.fn()
      .mockResolvedValueOnce({ data: page1, meta: { has_more: true } })
      .mockResolvedValueOnce({ data: page2, meta: { has_more: false } });

    const { items, hasMore } = await loadSocialPage(list as any, { want: 2 });

    expect(list).toHaveBeenCalledTimes(2);
    expect(items.map((n) => n.id)).toEqual(['s1', 's2']);
    expect(hasMore).toBe(false);
  });

  it('advances the cursor past operator rows, not just social ones', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: [social('s1'), operator('op1')], meta: { has_more: true } })
      .mockResolvedValueOnce({ data: [social('s2')], meta: { has_more: false } });

    await loadSocialPage(list as any, { want: 2 });

    // Second call must resume AFTER the last raw row (op1). Resuming from the
    // last social row would re-request op1 forever.
    expect(list.mock.calls[1][0].cursor).toBe('op1');
  });

  it('stops at maxPages so an all-operator stream cannot walk history', async () => {
    const list = vi.fn().mockResolvedValue({
      data: Array.from({ length: 30 }, (_, i) => operator(`op${i}`)),
      meta: { has_more: true },
    });

    const { items, hasMore } = await loadSocialPage(list as any, { want: 20, maxPages: 3 });

    expect(list).toHaveBeenCalledTimes(3);
    expect(items).toEqual([]);
    expect(hasMore).toBe(true); // more exists; we simply stopped asking
  });

  it('does not return the same row twice', async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ data: [social('s1'), social('s1')], meta: { has_more: false } });

    const { items } = await loadSocialPage(list as any, { want: 5 });
    expect(items.map((n) => n.id)).toEqual(['s1']);
  });

  it('resumes from a caller-supplied cursor', async () => {
    const list = vi.fn().mockResolvedValue({ data: [social('s9')], meta: { has_more: false } });
    await loadSocialPage(list as any, { want: 1, cursor: 'abc' });
    expect(list.mock.calls[0][0].cursor).toBe('abc');
  });
});

describe('markCategoryRead', () => {
  // Shaped like the PINNED @recursiv/sdk 0.7.14 NotificationsResource: a
  // public `client` HttpClient field, and a markAllAsRead() that takes no
  // arguments and ignores any it is given (dist/resources/notifications.js).
  const sdk0714 = () => {
    const posts: string[] = [];
    return {
      posts,
      resource: {
        client: { post: vi.fn(async (path: string) => { posts.push(path); return { data: { success: true } }; }) },
        markAllAsRead: vi.fn(async () => { posts.push('/notifications/read-all'); return { data: { success: true } }; }),
      },
    };
  };

  it('scopes the clear with the query the server honours — never the bare endpoint', async () => {
    const { posts, resource } = sdk0714();
    await markCategoryRead(resource, 'social');
    await markCategoryRead(resource, 'system');
    expect(posts).toEqual([
      '/notifications/read-all?category=social',
      '/notifications/read-all?category=system',
    ]);
    // The 0.7.14 method would have cleared the WHOLE stream — it must not run.
    expect(resource.markAllAsRead).not.toHaveBeenCalled();
  });

  it('falls back to the typed method WITH the category once an SDK exposes no client', async () => {
    const markAllAsRead = vi.fn(async (_category?: 'social' | 'system') => ({ data: { success: true } }));
    await markCategoryRead({ markAllAsRead }, 'system');
    expect(markAllAsRead).toHaveBeenCalledExactlyOnceWith('system');
  });
});
