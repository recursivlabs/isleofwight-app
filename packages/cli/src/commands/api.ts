import { createClient } from '../lib/client.js';
import { log, printJson, exitWithError } from '../lib/output.js';

interface ListOpts {
  limit?: string;
  offset?: string;
  json?: boolean;
}

function parseLimit(v: string | undefined, fallback = 20): number {
  const n = v ? Number.parseInt(v, 10) : fallback;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function postsListCommand(opts: ListOpts & { communityId?: string; authorId?: string }): Promise<void> {
  const minds = createClient();
  const result = await minds.posts.list({
    limit: parseLimit(opts.limit),
    offset: parseLimit(opts.offset, 0),
    community_id: opts.communityId,
    author_id: opts.authorId,
  });
  if (opts.json) return printJson(result);
  const posts = (result as { data?: Array<{ id: string; content?: string; createdAt?: string }> }).data ?? [];
  for (const p of posts) {
    log.info(`${p.id}  ${(p.content ?? '').slice(0, 80)}`);
  }
  log.dim(`${posts.length} posts`);
}

export async function postsCreateCommand(opts: { content: string; communityId?: string; replyToId?: string; json?: boolean }): Promise<void> {
  if (!opts.content) exitWithError('--content is required');
  const minds = createClient();
  const result = await minds.posts.create({
    content: opts.content,
    community_id: opts.communityId,
    reply_to_id: opts.replyToId,
  });
  if (opts.json) return printJson(result);
  const post = (result as { data?: { id: string } }).data;
  log.success(`Created post ${post?.id ?? '?'}`);
}

export async function communitiesListCommand(opts: ListOpts): Promise<void> {
  const minds = createClient();
  const result = await minds.communities.list({
    limit: parseLimit(opts.limit),
    offset: parseLimit(opts.offset, 0),
  });
  if (opts.json) return printJson(result);
  const items = (result as { data?: Array<{ id: string; name?: string; slug?: string; member_count?: number }> }).data ?? [];
  for (const c of items) {
    log.info(`${c.id}  ${c.name ?? '?'}  (@${c.slug ?? '?'}, ${c.member_count ?? 0} members)`);
  }
  log.dim(`${items.length} communities`);
}

export async function agentsListCommand(opts: ListOpts): Promise<void> {
  const minds = createClient();
  const result = await minds.agents.list({
    limit: parseLimit(opts.limit),
    offset: parseLimit(opts.offset, 0),
  });
  if (opts.json) return printJson(result);
  const items = (result as { data?: Array<{ id: string; name: string; username: string; agent_type?: string }> }).data ?? [];
  for (const a of items) {
    log.info(`${a.id}  ${a.name}  (@${a.username}${a.agent_type ? `, ${a.agent_type}` : ''})`);
  }
  log.dim(`${items.length} agents`);
}

export async function notificationsListCommand(opts: ListOpts): Promise<void> {
  const minds = createClient();
  const result = await minds.notifications.list({
    limit: parseLimit(opts.limit),
    offset: parseLimit(opts.offset, 0),
  });
  if (opts.json) return printJson(result);
  const items = (result as { data?: Array<{ id: string; type?: string; title?: string }> }).data ?? [];
  for (const n of items) {
    log.info(`${n.id}  ${n.type ?? '?'}  ${n.title ?? ''}`);
  }
  log.dim(`${items.length} notifications`);
}
