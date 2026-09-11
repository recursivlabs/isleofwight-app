import { log } from '../lib/output.js';

/**
 * Commands we've reserved as the Minds Cloud surface but haven't
 * implemented yet. They print a clear "coming soon" so the brand
 * surface is real but expectations are honest.
 */

export async function initCommand(): Promise<void> {
  log.info("'minds init' will scaffold a new Minds Cloud network.");
  log.dim('  Coming soon. Until then, see https://minds.com/cloud for early access.');
}

export async function deployCommand(): Promise<void> {
  log.info("'minds deploy' will deploy a Minds Cloud tenant.");
  log.dim('  Coming soon. For platform-level deploys today, see @recursiv/cli (recursiv deploy).');
}

export async function tenantCommand(): Promise<void> {
  log.info("'minds tenant' will manage Minds Cloud tenants (create, list, settings).");
  log.dim('  Coming soon.');
}
