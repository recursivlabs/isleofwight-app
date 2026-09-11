import { Minds } from '@minds/sdk';
import { loadApiKey, loadBaseUrl } from './credentials.js';
import { exitWithError } from './output.js';

export function createClient(opts: { allowNoKey?: boolean; apiKey?: string } = {}): Minds {
  const apiKey = opts.apiKey ?? loadApiKey();
  if (!apiKey && !opts.allowNoKey) {
    exitWithError(
      "Not signed in. Run 'minds auth login' first, or set MINDS_API_KEY in your environment.",
    );
  }
  const baseUrl = loadBaseUrl();
  return new Minds({ apiKey: apiKey ?? '', baseUrl, allowNoKey: opts.allowNoKey });
}
