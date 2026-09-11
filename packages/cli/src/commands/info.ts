import { loadApiKey, loadBaseUrl } from '../lib/credentials.js';
import { log } from '../lib/output.js';

export async function infoCommand(): Promise<void> {
  const apiKey = loadApiKey();
  const baseUrl = loadBaseUrl() ?? 'https://api.minds.com/api/v1';

  log.info('Minds CLI status');
  log.dim(`  api url:  ${baseUrl}`);
  log.dim(`  signed in: ${apiKey ? 'yes' : 'no'}`);
  if (apiKey) {
    const masked = apiKey.length > 12 ? `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}` : '*** redacted';
    log.dim(`  api key:  ${masked}`);
  }
}
