/**
 * minds — the official command-line interface for the Minds platform.
 *
 * Wraps @minds/sdk, which wraps @recursiv/sdk. Anything you can do
 * through @recursiv/cli is reachable here too — start with `minds --help`.
 */
import { Command } from 'commander';
import packageJson from '../../package.json';
import { loginCommand, logoutCommand, whoamiCommand } from '../commands/auth.js';
import {
  postsListCommand,
  postsCreateCommand,
  communitiesListCommand,
  agentsListCommand,
  notificationsListCommand,
} from '../commands/api.js';
import { infoCommand } from '../commands/info.js';
import {
  chatDmCommand,
  chatListCommand,
  chatMessagesCommand,
  chatSendCommand,
} from '../commands/chat.js';
import {
  moderationAppealCommand,
  moderationLogCommand,
  moderationMineCommand,
} from '../commands/moderation.js';
import {
  initCommand,
  deployCommand,
  tenantCommand,
} from '../commands/placeholders.js';
import { log } from '../lib/output.js';

const program = new Command();

program
  .name('minds')
  .description('CLI for the Minds platform')
  .version(packageJson.version);

// ─── Auth ────────────────────────────────────────────────────────────
const auth = program.command('auth').description('Manage your Minds API authentication');
auth
  .command('login')
  .description('Sign in with a code sent to your email')
  .option('--api-key', 'Paste an existing API key instead')
  .action(wrap(loginCommand));
auth
  .command('logout')
  .description('Revoke the saved API key and remove it')
  .action(wrap(logoutCommand));
auth
  .command('whoami')
  .description('Show the currently signed-in user')
  .option('--json', 'Output JSON')
  .action(wrap(whoamiCommand));

// ─── Info ────────────────────────────────────────────────────────────
program
  .command('info')
  .description('Show CLI configuration and auth status')
  .action(wrap(infoCommand));

// ─── Posts ───────────────────────────────────────────────────────────
const posts = program.command('posts').description('Read and write posts');
posts
  .command('list')
  .description('List posts')
  .option('--limit <n>', 'Max results (default 20)')
  .option('--offset <n>', 'Pagination offset (default 0)')
  .option('--community-id <id>', 'Filter by community')
  .option('--author-id <id>', 'Filter by author')
  .option('--json', 'Output JSON')
  .action(wrap(postsListCommand));
posts
  .command('create')
  .description('Create a post')
  .requiredOption('--content <text>', 'Post body')
  .option('--community-id <id>', 'Post into a community')
  .option('--reply-to-id <id>', 'Reply to a parent post')
  .option('--json', 'Output JSON')
  .action(wrap(postsCreateCommand));

// ─── Communities ─────────────────────────────────────────────────────
const communities = program.command('communities').description('Browse and manage communities');
communities
  .command('list')
  .description('List communities')
  .option('--limit <n>', 'Max results (default 20)')
  .option('--offset <n>', 'Pagination offset (default 0)')
  .option('--json', 'Output JSON')
  .action(wrap(communitiesListCommand));

// ─── Agents ──────────────────────────────────────────────────────────
const agents = program.command('agents').description('Browse your AI agents');
agents
  .command('list')
  .description('List your agents')
  .option('--limit <n>', 'Max results (default 20)')
  .option('--offset <n>', 'Pagination offset (default 0)')
  .option('--json', 'Output JSON')
  .action(wrap(agentsListCommand));

// ─── Notifications ───────────────────────────────────────────────────
const notifications = program.command('notifications').description('Read your notifications');
notifications
  .command('list')
  .description('List recent notifications')
  .option('--limit <n>', 'Max results (default 20)')
  .option('--offset <n>', 'Pagination offset (default 0)')
  .option('--json', 'Output JSON')
  .action(wrap(notificationsListCommand));

// ─── Moderation transparency & appeals ──────────────────────────────
const moderation = program.command('moderation').description('Read moderation decisions and submit appeals');
moderation
  .command('log')
  .description('Read the privacy-safe public moderation log')
  .option('--network-id <id>', 'Network UUID (defaults to the main Minds network)')
  .option('--limit <n>', 'Max results (default 50)')
  .option('--offset <n>', 'Pagination offset (default 0)')
  .option('--json', 'Output JSON')
  .action(wrap(moderationLogCommand));
moderation
  .command('mine')
  .description('List decisions affecting you or content you own')
  .option('--json', 'Output JSON')
  .action(wrap(moderationMineCommand));
moderation
  .command('appeal <action-id>')
  .description('Appeal one of your moderation decisions')
  .requiredOption('--statement <text>', 'Why the decision should be reconsidered (10–2000 characters)')
  .option('--json', 'Output JSON')
  .action(wrap(moderationAppealCommand));

// ─── Cloud / tenant management (coming soon) ─────────────────────────
program
  .command('init [name]')
  .description('Scaffold a new Minds Cloud network (coming soon)')
  .action(wrap(initCommand));
program
  .command('deploy')
  .description('Deploy a Minds Cloud tenant (coming soon)')
  .action(wrap(deployCommand));
program
  .command('tenant')
  .description('Manage Minds Cloud tenants (coming soon)')
  .action(wrap(tenantCommand));
// ─── Chat ────────────────────────────────────────────────────────────
const chat = program.command('chat').description('Read and send Minds messages');
chat.action(() => chat.outputHelp());
chat
  .command('list')
  .description('List your conversations')
  .option('--limit <n>', 'Max results (default 20)')
  .option('--offset <n>', 'Pagination offset (default 0)')
  .option('--json', 'Output JSON')
  .action(wrap(chatListCommand));
chat
  .command('messages <conversation-id>')
  .description('Read messages in a conversation')
  .option('--limit <n>', 'Max results (default 50)')
  .option('--cursor <cursor>', 'Continue from a pagination cursor')
  .option('--json', 'Output JSON')
  .action(wrap(chatMessagesCommand));
chat
  .command('send <conversation-id>')
  .description('Send a message to a conversation')
  .requiredOption('--message <text>', 'Message body')
  .option('--reply-to-id <id>', 'Reply to a message')
  .option('--json', 'Output JSON')
  .action(wrap(chatSendCommand));
chat
  .command('dm <user-id>')
  .description('Open a direct message, optionally sending the first message')
  .option('--message <text>', 'Message body')
  .option('--json', 'Output JSON')
  .action(wrap(chatDmCommand));

program.parseAsync(process.argv).catch((err) => {
  log.error(err?.message ?? String(err));
  process.exit(1);
});

function wrap<T extends unknown[]>(fn: (...args: T) => Promise<void> | void) {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err) {
      log.error((err as Error)?.message ?? String(err));
      process.exit(1);
    }
  };
}
