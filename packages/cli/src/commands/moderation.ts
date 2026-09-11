import { createClient } from '../lib/client.js';
import { log, printJson } from '../lib/output.js';

const MINDS_NETWORK_ID =
  process.env.MINDS_NETWORK_ID ?? '0f1fcb0f-11c0-41f2-9406-943a88f48b59';

function integer(value: string | undefined, fallback: number): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function moderationLogCommand(opts: {
  networkId?: string;
  limit?: string;
  offset?: string;
  json?: boolean;
}): Promise<void> {
  const minds = createClient({ allowNoKey: true });
  const result = await minds.moderation.publicLog(
    opts.networkId ?? MINDS_NETWORK_ID,
    {
      limit: Math.max(1, integer(opts.limit, 50)),
      offset: integer(opts.offset, 0),
    },
  );
  if (opts.json) return printJson(result);

  const data = result.data;
  for (const principle of data.principles) {
    log.info(`${principle.title}: ${principle.summary}`);
  }
  console.log();
  for (const action of data.actions) {
    const date = new Date(action.created_at).toISOString().slice(0, 10);
    const policy = action.policy ? ` (${action.policy})` : '';
    const appeal = action.appeal_status === 'none' ? '' : ` · appeal ${action.appeal_status}`;
    log.info(`${date}  ${action.action} ${action.target_type}${policy}${appeal}`);
  }
  log.dim(`${data.actions.length} public actions`);
}

export async function moderationMineCommand(opts: { json?: boolean }): Promise<void> {
  const minds = createClient();
  const result = await minds.moderation.mine();
  if (opts.json) return printJson(result);

  for (const action of result.data.actions) {
    const appeal = action.appeal?.status ?? (action.can_appeal ? 'appealable' : 'not appealable');
    log.info(`${action.id}  ${action.action} ${action.target_type} · ${appeal}`);
    if (action.reason) log.dim(`  ${action.reason}`);
  }
  log.dim(`${result.data.actions.length} decisions affecting you`);
}

export async function moderationAppealCommand(
  actionId: string,
  opts: { statement: string; json?: boolean },
): Promise<void> {
  const minds = createClient();
  const result = await minds.moderation.appeal(actionId, opts.statement);
  if (opts.json) return printJson(result);
  log.success(`Appeal ${result.data.id} submitted for moderation action ${result.data.action_id}`);
}
