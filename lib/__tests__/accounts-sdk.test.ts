import type { Minds } from '@minds/sdk';
import { describe, expect, it, vi } from 'vitest';

import { getSiblingAccounts } from '../accounts';

describe('legacy account lookup', () => {
  it('uses the authenticated SDK account resource and returns its typed data', async () => {
    const accounts = [
      {
        id: 'target-user',
        username: 'legacy-user',
        name: 'Legacy User',
        image: null,
        created_at: '2026-08-23T00:00:00.000Z',
        is_placeholder_email: true,
        looks_like_test: false,
        is_current: false,
      },
    ];
    const listSiblings = vi.fn().mockResolvedValue({
      data: accounts,
      meta: { email: 'owner@example.test', count: 1 },
    });
    const sdk = { accounts: { listSiblings } } as unknown as Minds;

    await expect(getSiblingAccounts(sdk)).resolves.toEqual(accounts);
    expect(listSiblings).toHaveBeenCalledOnce();
  });

  it('does not attempt a request before an authenticated SDK exists', async () => {
    await expect(getSiblingAccounts(null)).resolves.toEqual([]);
  });
});
