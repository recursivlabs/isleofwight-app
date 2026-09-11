/**
 * ONE definition of "is this a Minds notification".
 *
 * WHY THIS EXISTS
 * This account is both a person on a social network and the operator of a
 * workspace full of agents. Both kinds of notification land in the same stream
 * for the same recipient, and the API returns the newest N rows of every kind.
 *
 * The bug this fixes: the notifications SCREEN filtered operator rows out after
 * the page arrived, while the sidebar badge counted the same page WITHOUT
 * filtering. The badge said 48 unread and the list rendered none, and no tap
 * could reconcile them, because the two surfaces disagreed about what a
 * notification is. Both now import this.
 *
 * A DENY-list on purpose: this is the client's belt. The server owns the real
 * split (the `category` query parameter, which every list call below sends);
 * an older API ignores the parameter, and then this filter still applies, so
 * anything not clearly agent, build or task activity is treated as social and
 * a genuinely new SOCIAL type shows up rather than silently disappearing.
 */
export type NotifCategory = 'social' | 'system';
const OPERATOR_TARGET_PREFIX =
  /^(task|agent|dispatcher|deployment|deploy|swarm|build|ci|job|orchestrat|pr_|credit|payment|billing|activation|first_deploy|first_task|big_day|reengage)/;

export function isSocialNotif(n: any): boolean {
  const t = String(n?.target_type ?? n?.targetType ?? '').toLowerCase();
  if (OPERATOR_TARGET_PREFIX.test(t)) return false;
  // The dispatcher writes "Working on: …" titles for agent activity.
  if (/^working on:/i.test(String(n?.title ?? ''))) return false;
  return true;
}

/**
 * Mark every notification in ONE category read — and never the other one.
 *
 * The server's POST /notifications/read-all honours ?category= precisely so a
 * social surface cannot clear the operator's unread Builds rows (and vice
 * versa). The pinned @recursiv/sdk 0.7.14 build predates that: its
 * markAllAsRead() takes no arguments and IGNORES any it is given, so calling
 * it would silently clear the whole stream — the bug, type-checked. Until a
 * published SDK carries the parameter (the engine's SDK source already does),
 * go through the resource's public HttpClient with the query the server
 * honours; the endpoint, not the method signature, is the contract. If the
 * client field ever goes away it will be because the SDK was upgraded, and
 * every SDK after 0.7.14 forwards the category argument.
 */
export async function markCategoryRead(
  notifications: { markAllAsRead: (category?: NotifCategory) => Promise<unknown> },
  category: NotifCategory,
): Promise<void> {
  const client = (notifications as any)?.client;
  if (typeof client?.post === 'function') {
    await client.post(`/notifications/read-all?category=${encodeURIComponent(category)}`);
    return;
  }
  await notifications.markAllAsRead(category);
}

/**
 * Page until we have `want` social rows, or the stream runs out.
 *
 * The API hands back a MIXED page, so filtering one page client-side is not
 * enough: an account that runs agents can have thirty consecutive operator rows
 * and end up with an empty social list while its real notifications sit on page
 * two. Keep asking until we have enough to fill a screen.
 *
 * `maxPages` bounds it so a stream that is entirely operational costs a few
 * requests, not an unbounded walk backwards through history.
 */
export async function loadSocialPage(
  list: (args: { limit: number; cursor?: string; category: NotifCategory }) => Promise<any>,
  opts: { want?: number; pageSize?: number; maxPages?: number; cursor?: string; category?: NotifCategory } = {},
): Promise<{ items: any[]; cursor: string | undefined; hasMore: boolean }> {
  const want = opts.want ?? 20;
  const pageSize = opts.pageSize ?? 30;
  const maxPages = opts.maxPages ?? 5;
  const category = opts.category ?? 'social';
  const keep = (n: any) => (category === 'social' ? isSocialNotif(n) : !isSocialNotif(n));

  const items: any[] = [];
  const seen = new Set<string>();
  let cursor = opts.cursor;
  let hasMore = true;

  for (let page = 0; page < maxPages && hasMore && items.length < want; page++) {
    const res = await list({ limit: pageSize, cursor, category });
    const rows: any[] = res?.data || [];
    for (const n of rows) {
      if (!n?.id || seen.has(n.id)) continue;
      seen.add(n.id);
      if (keep(n)) items.push(n);
    }
    // Advance from the LAST RAW ROW, not the last social one: the cursor walks
    // the real stream, and skipping operator rows would re-request them forever.
    cursor = rows.length ? rows[rows.length - 1]?.id : cursor;
    hasMore = res?.meta?.has_more ?? rows.length >= pageSize;
  }

  return { items, cursor, hasMore };
}
