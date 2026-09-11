import { beforeEach, describe, expect, it, vi } from 'vitest';
import { groupAdmin } from '../groupAdmin';

describe('groupAdmin SDK compatibility', () => {
  const httpGet = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the public SDK ban-list method when the installed SDK provides it', async () => {
    const bans = vi.fn().mockResolvedValue({ data: [{ id: 'user-1' }] });
    const sdk = { communities: { bans }, posts: { client: { get: httpGet } } };

    await expect(groupAdmin(sdk).bans('community-1', { limit: 25 })).resolves.toEqual({
      data: [{ id: 'user-1' }],
    });
    expect(bans).toHaveBeenCalledWith('community-1', { limit: 25 });
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('uses the authenticated SDK transport until the published SDK has the method', async () => {
    httpGet.mockResolvedValue({ data: [{ id: 'user-1' }] });
    const sdk = { communities: {}, posts: { client: { get: httpGet } } };

    await groupAdmin(sdk).bans('community-1', { offset: 10 });

    expect(httpGet).toHaveBeenCalledWith('/communities/community-1/bans', { offset: 10 });
  });
});
