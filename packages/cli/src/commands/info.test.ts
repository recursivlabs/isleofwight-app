import { beforeEach, describe, expect, it, vi } from 'vitest';

import { infoCommand } from './info';
import { log } from '../lib/output.js';

vi.mock('../lib/credentials.js', () => ({
  loadApiKey: () => undefined,
  loadBaseUrl: () => undefined,
}));

vi.mock('../lib/output.js', () => ({
  log: {
    info: vi.fn(),
    dim: vi.fn(),
  },
}));

describe('minds info', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reports the Minds API when no override is configured', async () => {
    await infoCommand();

    expect(log.dim).toHaveBeenCalledWith('  api url:  https://api.minds.com/api/v1');
  });
});
