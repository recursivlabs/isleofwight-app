import { afterEach, describe, expect, it, vi } from 'vitest';
import { Minds } from './client.js';
import { Recursiv } from '@recursiv/sdk';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Minds account migration surface', () => {
  it('exposes the Recursiv accounts resource without an escape-hatch hop', () => {
    const minds = new Minds({
      apiKey: 'sk_live_test',
      baseUrl: 'https://api.minds.test/api/v1',
    });

    expect(minds.accounts).toBe(minds.recursiv.accounts);
    expect(minds.accounts.listSiblings).toBeTypeOf('function');
    expect(minds.accounts.switchAccount).toBeTypeOf('function');
  });
});

describe('Minds moderation transparency surface', () => {
  it('exposes the Recursiv moderation resource without an escape-hatch hop', () => {
    const minds = new Minds({
      apiKey: 'sk_live_test',
      baseUrl: 'https://api.minds.test/api/v1',
    });

    expect(minds.moderation).toBe(minds.recursiv.moderation);
    expect(minds.moderation.publicLog).toBeTypeOf('function');
    expect(minds.moderation.mine).toBeTypeOf('function');
    expect(minds.moderation.appeal).toBeTypeOf('function');
  });
});

describe('Minds consumer subscription surface', () => {
  it('exposes the project-scoped Recursiv app-subscription resource directly', () => {
    const minds = new Minds({
      apiKey: 'sk_live_test',
      baseUrl: 'https://api.minds.test/api/v1',
    });

    expect(minds.appSubscriptions).toBe(minds.recursiv.appSubscriptions);
    expect(minds.appSubscriptions.checkout).toBeTypeOf('function');
    expect(minds.appSubscriptions.status).toBeTypeOf('function');
    expect(minds.appSubscriptions.createPortalSession).toBeTypeOf('function');
  });
});

describe('Minds launch metrics surface', () => {
  it('exposes the launch dashboard fast path through the runtime wrapper', () => {
    const minds = new Minds({
      apiKey: 'sk_live_test',
      baseUrl: 'https://api.minds.test/api/v1',
    });

    expect(minds.admin).toBe(minds.recursiv.admin);
    expect(minds.admin.getLaunchStats).toBeTypeOf('function');
  });
});

describe('Minds public post surface', () => {
  const projectId = '019d5190-f0c0-717e-a1bd-ef9c335292b9';

  it('reads the visibility-filtered public tRPC projection without an API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: { id: 'post-1', title: 'Public article' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    const result = await minds.publicPosts.get('post-1');

    expect(result.data).toEqual({ id: 'post-1', title: 'Public article' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.minds.test/api/trpc/posts.get?');
    expect(new URL(String(url)).searchParams.get('input')).toBe(
      `{"id":"post-1","projectId":"${projectId}"}`,
    );
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('hydrates a public bare repost through the same visibility-filtered projection', async () => {
    const repost = { id: 'repost-1', content: '', repostedFromId: 'original-1' };
    const original = { id: 'original-1', content: 'The original words' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: repost } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: original } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    const result = await minds.publicPosts.get('repost-1');

    expect(result.data).toEqual({ ...repost, repostedFrom: original });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const originalUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(originalUrl.pathname).toBe('/api/trpc/posts.get');
    expect(originalUrl.searchParams.get('input')).toBe(
      `{"id":"original-1","projectId":"${projectId}"}`,
    );
  });

  it('lists an author\'s public posts with camelCase tRPC input and no API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: [{ id: 'post-1', content: 'Public post' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    const result = await minds.publicPosts.list({ authorId: 'user-1', limit: 20, offset: 40 });

    expect(result).toEqual({
      data: [{ id: 'post-1', content: 'Public post' }],
      meta: { has_more: false },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.minds.test/api/trpc/posts.list?');
    expect(new URL(String(url)).searchParams.get('input')).toBe(
      `{"authorId":"user-1","projectId":"${projectId}","limit":20,"offset":40}`,
    );
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('hydrates a bare repost from a visible original already in the public page', async () => {
    const original = { id: 'post-original', content: 'The original public post' };
    const wrapper = { id: 'post-repost', content: '', repostedFromId: original.id };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: [wrapper, original] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    const result = await minds.publicPosts.list({ authorId: 'user-1' });

    expect(result.data[0]).toMatchObject({
      id: wrapper.id,
      repostedFrom: original,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hydrates an off-page bare repost through the visibility-filtered public get', async () => {
    const original = { id: 'post-original', content: 'The original public post' };
    const wrapper = { id: 'post-repost', content: '', repostedFromId: original.id };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: [wrapper] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: original } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    const result = await minds.publicPosts.list({ authorId: 'user-1' });

    expect(result.data[0]).toMatchObject({
      id: wrapper.id,
      repostedFrom: original,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      'https://api.minds.test/api/trpc/posts.get?',
    );
  });

  it('keeps the public list usable when a repost source is unavailable', async () => {
    const wrapper = { id: 'post-repost', content: '', repostedFromId: 'post-private' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: [wrapper] } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { json: { message: 'Post not found' } } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });

    await expect(minds.publicPosts.list({ authorId: 'user-1' })).resolves.toEqual({
      data: [wrapper],
      meta: { has_more: false },
    });
  });

  it('respects an explicit null repost source from the visibility projection', async () => {
    const wrapper = {
      id: 'post-repost',
      content: '',
      repostedFromId: 'post-hidden',
      repostedFrom: null,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: [wrapper] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });

    await expect(minds.publicPosts.list({ authorId: 'user-1' })).resolves.toEqual({
      data: [wrapper],
      meta: { has_more: false },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lists a public community\'s posts with camelCase tRPC input and no API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: [{ id: 'post-1', content: 'Community post' }] } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    await minds.publicPosts.list({ communityId: 'community-1', limit: 20 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.minds.test/api/trpc/posts.list?');
    expect(new URL(String(url)).searchParams.get('input')).toBe(
      `{"communityId":"community-1","projectId":"${projectId}","limit":20,"offset":0}`,
    );
    expect(init.headers).not.toHaveProperty('Authorization');
  });
});

describe('Minds public community surface', () => {
  it('preserves the HTTP status when a public community request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { json: { message: 'Community not found' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
    });

    await expect(minds.publicCommunities.get('missing-community')).rejects.toMatchObject({
      name: 'PublicTrpcError',
      message: 'Community not found',
      status: 404,
    });
  });

  it('binds public community lists and reads to the configured app project', async () => {
    const projectId = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
    const communityId = '019d5190-f0c0-717e-a1bd-ef9c335292c0';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: [] } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: { id: communityId, name: 'Wildlife' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: { id: communityId, slug: 'wildlife' } } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
      projectId,
    });
    await minds.publicCommunities.list({ limit: 12 });
    await minds.publicCommunities.get(communityId);
    await minds.publicCommunities.get('wildlife');

    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('input')).toBe(
      `{"privacy":"public","limit":12,"offset":0,"projectId":"${projectId}"}`,
    );
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('input')).toBe(
      `{"id":"${communityId}","projectId":"${projectId}"}`,
    );
    expect(new URL(String(fetchMock.mock.calls[2][0])).searchParams.get('input')).toBe(
      `{"slug":"wildlife","projectId":"${projectId}"}`,
    );
  });

  it('lists privacy-filtered communities without an API key', async () => {
    const communities = [
      { id: 'community-1', slug: 'big-ideas', name: 'Big Ideas', privacy: 'public' },
      { id: 'community-2', slug: 'technology', name: 'Technology', privacy: 'public' },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: communities } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
    });
    await expect(minds.publicCommunities.list({ limit: 2 })).resolves.toEqual({
      data: communities,
      meta: { has_more: true },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.minds.test/api/trpc/communities.list?');
    expect(new URL(String(url)).searchParams.get('input')).toBe(
      '{"privacy":"public","limit":2,"offset":0}',
    );
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('reads a privacy-filtered community without an API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: { id: '019d5190-f0c0-717e-a1bd-ef9c335292b9', name: 'Technology', privacy: 'public' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
    });
    await expect(minds.publicCommunities.get('019d5190-f0c0-717e-a1bd-ef9c335292b9')).resolves.toEqual({
      data: { id: '019d5190-f0c0-717e-a1bd-ef9c335292b9', name: 'Technology', privacy: 'public' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.minds.test/api/trpc/communities.get?');
    expect(new URL(String(url)).searchParams.get('input')).toBe('{"id":"019d5190-f0c0-717e-a1bd-ef9c335292b9"}');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('resolves a friendly community slug through the public slug procedure', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: { data: { id: 'community-1', slug: 'technology-20034560', name: 'Technology' } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
    });
    await expect(minds.publicCommunities.get('technology-20034560')).resolves.toEqual({
      data: { id: 'community-1', slug: 'technology-20034560', name: 'Technology' },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://api.minds.test/api/trpc/communities.getBySlug?');
    expect(new URL(String(url)).searchParams.get('input')).toBe('{"slug":"technology-20034560"}');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.headers).not.toHaveProperty('Authorization');
  });
});

describe('Minds public profile surface', () => {
  it('reads a profile and relationships through privacy-filtered public procedures', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: { id: 'user-1', username: 'bill' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { data: [{ id: 'user-2', username: 'jack' }] } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const minds = new Minds({
      baseUrl: 'https://api.minds.test/api/v1',
      allowNoKey: true,
    });
    await expect(minds.publicProfiles.getByUsername('bill')).resolves.toEqual({
      data: { id: 'user-1', username: 'bill' },
    });
    // Profile screens historically asked for 100, while the public procedure
    // accepts at most 50. The SDK must keep that otherwise-valid read from
    // turning into a 400 and an empty Followers/Following tab.
    await expect(minds.publicProfiles.following('user-1', { limit: 100 })).resolves.toEqual({
      data: [{ id: 'user-2', username: 'jack' }],
      meta: { has_more: false },
    });

    const [profileUrl, profileInit] = fetchMock.mock.calls[0];
    expect(String(profileUrl)).toContain('https://api.minds.test/api/trpc/users.getByUsername?');
    expect(new URL(String(profileUrl)).searchParams.get('input')).toBe('{"username":"bill"}');
    expect(profileInit.headers).not.toHaveProperty('Authorization');

    const [followingUrl, followingInit] = fetchMock.mock.calls[1];
    expect(String(followingUrl)).toContain('https://api.minds.test/api/trpc/users.following?');
    expect(new URL(String(followingUrl)).searchParams.get('input')).toBe('{"userId":"user-1","limit":50,"offset":0}');
    expect(followingInit.headers).not.toHaveProperty('Authorization');
  });
});

describe('parity with the platform client', () => {
  // The reason this file exists. The Minds client used to name every Recursiv
  // resource three times — as a type import, as a field, as an assignment — and
  // the list had silently fallen seven behind: brief, envVars, evidence, goals,
  // humanAsks, humanInput and video were reachable through `minds.recursiv` and
  // not through `minds`, while the class docstring promised full parity.
  //
  // Parity is now structural rather than transcribed. This test is what keeps
  // it honest: it fails the moment the two surfaces diverge, whichever
  // direction they diverge in, so nobody has to remember.
  it('exposes every resource the platform client exposes', () => {
    const minds = new Minds({ apiKey: 'test-key' });
    const recursiv = new Recursiv({ apiKey: 'test-key', baseUrl: 'https://example.com' });

    const missing = Object.keys(recursiv).filter((name) => !(name in minds));

    expect(missing, `reachable on Recursiv but not on Minds: ${missing.join(', ')}`).toEqual([]);
  });

  it('carries the platform client methods, bound to the instance that owns them', () => {
    const minds = new Minds({ apiKey: 'test-key' });

    for (const name of Object.getOwnPropertyNames(Recursiv.prototype)) {
      if (name === 'constructor') continue;
      expect(typeof (minds as unknown as Record<string, unknown>)[name]).toBe('function');
    }
  });

  it('keeps the Minds-only surface that the platform client does not have', () => {
    const minds = new Minds({ apiKey: 'test-key' });
    const recursiv = new Recursiv({ apiKey: 'test-key', baseUrl: 'https://example.com' });

    for (const own of ['publicPosts', 'publicProfiles', 'publicCommunities']) {
      expect(minds).toHaveProperty(own);
      expect(recursiv).not.toHaveProperty(own);
    }
    // The escape hatch stays reachable, and is not itself copied from Recursiv.
    expect(minds.recursiv).toBeInstanceOf(Recursiv);
  });
});
