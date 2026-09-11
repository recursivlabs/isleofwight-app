import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  healthResponseForDist,
  handleRequest,
  injectPage,
  legacyActivityPubActorGuidForPath,
  legacyActivityPubActorResponseForPath,
  legacyApiUpgradeResponseForPath,
  legacyCommunityGuidForPath,
  legacyPostGuidForPath,
  legacyResponseForPath,
  metaForPath,
  publicApiGet,
  renderAndroidAssetLinks,
  renderAppleAssociation,
  renderRobots,
  renderSecurityTxt,
  renderSitemap,
  resolveLegacyCommunity,
  resolveLegacyPost,
  sitemapForPublicApi,
} from './meta-server.mjs';

const postId = '2ae7dbe4-b050-42e1-8a4d-f964c8e8e85d';
const commit = '2b074f3187d5c120bcf18b5a98867fa5f6bcbe04';

test('preview runner copies every local module imported by the metadata server', () => {
  const server = readFileSync(new URL('./meta-server.mjs', import.meta.url), 'utf8');
  const dockerfile = readFileSync(new URL('../apps/mobile/Dockerfile.preview', import.meta.url), 'utf8');
  const localModules = [...server.matchAll(/from ['"]\.\/([^'"]+\.mjs)['"]/g)]
    .map((match) => match[1]);
  assert.ok(localModules.length > 0, 'positive control: metadata server has a local module import');
  for (const module of localModules) {
    assert.ok(
      dockerfile.includes(`COPY --from=builder /app/scripts/${module} ./scripts/${module}`),
      `preview runner is missing scripts/${module}`,
    );
  }
});

test('health reports only the exact build commit and fails closed without it', () => {
  const dist = mkdtempSync(join(tmpdir(), 'minds-health-'));
  try {
    assert.deepEqual(healthResponseForDist(dist, {}), {
      status: 503,
      body: JSON.stringify({ status: 'degraded', commit: null }),
    });
    writeFileSync(join(dist, 'build-info.json'), JSON.stringify({
      commit,
    }));
    assert.deepEqual(healthResponseForDist(dist, {}), {
      status: 200,
      body: JSON.stringify({
        status: 'ok',
        commit,
      }),
    });
    rmSync(join(dist, 'build-info.json'));
    assert.deepEqual(healthResponseForDist(dist, { SOURCE_COMMIT: commit }), {
      status: 200,
      body: JSON.stringify({
        status: 'ok',
        commit,
      }),
    });
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('health fails closed when runtime and embedded commit provenance disagree', () => {
  const dist = mkdtempSync(join(tmpdir(), 'minds-health-'));
  try {
    writeFileSync(join(dist, 'build-info.json'), JSON.stringify({ commit: 'a'.repeat(40) }));
    assert.deepEqual(healthResponseForDist(dist, { SOURCE_COMMIT: 'b'.repeat(40) }), {
      status: 503,
      body: JSON.stringify({ status: 'degraded', commit: null }),
    });
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('public metadata reads use anonymous tRPC, not a deploy secret', async () => {
  let requested;
  const value = await publicApiGet('posts.get', { id: postId }, async (url, init) => {
    requested = { url: String(url), init };
    return new Response(JSON.stringify({ result: { data: { id: postId, content: 'hello' } } }));
  });

  assert.equal(value.content, 'hello');
  assert.match(requested.url, /\/api\/trpc\/posts\.get\?/);
  assert.deepEqual(JSON.parse(new URL(requested.url).searchParams.get('input')), { id: postId });
  assert.equal(requested.init.headers.Authorization, undefined);
});

test('legacy versioned API paths get an actionable upgrade response, never SPA HTML', () => {
  for (const path of [
    '/api/v1/channel/me',
    '/api/v2/settings/delete',
    '/api/v3/oauth/token',
    '/api/v10/future-client',
  ]) {
    const response = legacyApiUpgradeResponseForPath(path);
    assert.equal(response.status, 426);
    assert.deepEqual(JSON.parse(response.body), {
      status: 'error',
      code: 'client_upgrade_required',
      errorId: 'client_upgrade_required',
      message: 'This version of Minds is no longer supported. Update Minds to continue.',
      links: {
        web: 'https://minds.on.minds.io/',
        ios: 'https://apps.apple.com/app/id961771928',
        android: 'https://play.google.com/store/apps/details?id=com.minds.app',
      },
    });
  }
});

test('legacy API matching does not intercept app, health, or federation routes', () => {
  for (const path of [
    '/',
    '/api/v1ish/channel',
    '/api/activitypub/users/100000000000000099',
    '/healthz',
  ]) {
    assert.equal(legacyApiUpgradeResponseForPath(path), null);
  }
});

test('legacy API upgrade response works for reads and writes before the static method gate', async () => {
  function mockResponse() {
    return {
      status: null,
      headers: null,
      body: null,
      headersSent: false,
      writeHead(status, headers) {
        this.status = status;
        this.headers = headers;
        this.headersSent = true;
      },
      end(body) { this.body = body; },
    };
  }

  for (const method of ['GET', 'POST']) {
    let drained = false;
    const req = {
      method,
      url: '/api/v3/oauth/token',
      headers: {},
      resume() { drained = true; },
    };
    const res = mockResponse();
    await handleRequest(req, res);

    assert.equal(drained, true);
    assert.equal(res.status, 426);
    assert.equal(res.headers['Content-Type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.headers.Upgrade, 'Minds/2.0');
    assert.equal(JSON.parse(res.body.toString()).code, 'client_upgrade_required');
  }

  const unrelatedWrite = mockResponse();
  await handleRequest({ method: 'POST', url: '/settings', headers: {} }, unrelatedWrite);
  assert.equal(unrelatedWrite.status, 405);
});

test('legacy ActivityPub matching intercepts actor roots but not write or collection paths', () => {
  const guid = '100000000000000099';
  assert.equal(legacyActivityPubActorGuidForPath(`/api/activitypub/users/${guid}`), guid);
  assert.equal(legacyActivityPubActorGuidForPath(`/api/activitypub/users/${guid}/`), guid);
  assert.equal(legacyActivityPubActorGuidForPath(`/api/activitypub/users/${guid}/inbox`), null);
  assert.equal(legacyActivityPubActorGuidForPath('/api/activitypub/users/not-a-guid'), null);
});

test('legacy ActivityPub handoff preserves the public actor media type without credentials', async () => {
  const guid = '100000000000000099';
  const actor = { id: `https://www.minds.com/api/activitypub/users/${guid}`, type: 'Person' };
  let requested;
  const response = await legacyActivityPubActorResponseForPath(
    `/api/activitypub/users/${guid}`,
    async (url, init) => {
      requested = { url: String(url), init };
      return new Response(JSON.stringify(actor), {
        headers: {
          'Content-Type': 'application/activity+json; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    },
  );

  assert.equal(requested.url, `https://api.minds.com/api/activitypub/users/${guid}`);
  assert.equal(requested.init.headers.Accept, 'application/activity+json');
  assert.equal(requested.init.headers.Authorization, undefined);
  assert.equal(response.status, 200);
  assert.equal(response.contentType, 'application/activity+json; charset=utf-8');
  assert.deepEqual(JSON.parse(response.body.toString()), actor);
});

test('legacy ActivityPub handoff propagates a missing actor as JSON instead of SPA HTML', async () => {
  const guid = '100000000000000099';
  const response = await legacyActivityPubActorResponseForPath(
    `/api/activitypub/users/${guid}`,
    async () => new Response(JSON.stringify({ error: 'Actor not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

  assert.equal(response.status, 404);
  assert.equal(response.contentType, 'application/json; charset=utf-8');
  assert.match(response.body.toString(), /Actor not found/);
});

test('legacy ActivityPub handoff rejects HTML success and bounds upstream failure', async () => {
  const path = '/api/activitypub/users/100000000000000099';
  const html = await legacyActivityPubActorResponseForPath(
    path,
    async () => new Response('<html>wrong upstream</html>', {
      headers: { 'Content-Type': 'text/html' },
    }),
  );
  assert.equal(html.status, 502);
  assert.deepEqual(JSON.parse(html.body.toString()), { error: 'Invalid actor response' });

  const unavailable = await legacyActivityPubActorResponseForPath(
    path,
    async () => { throw new Error('network down'); },
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.retryAfter, '60');
});

test('robots identifies the sitemap and keeps private app routes out of search', () => {
  const robots = renderRobots();
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/chat\$$/m);
  assert.match(robots, /^Disallow: \/chat\/$/m);
  assert.match(robots, /^Disallow: \/settings\$$/m);
  assert.doesNotMatch(robots, /^Disallow: \/chat$/m);
  assert.match(robots, /^Sitemap: https:\/\/minds\.on\.minds\.io\/sitemap\.xml$/m);
});

test('security.txt publishes the official reporting contact and a future expiry', () => {
  const securityTxt = renderSecurityTxt(new Date('2026-08-26T00:00:00.000Z'));

  assert.match(securityTxt, /^Contact: mailto:security@minds\.com$/m);
  assert.match(securityTxt, /^Expires: 2027-08-26T00:00:00\.000Z$/m);
  assert.match(securityTxt, /^Preferred-Languages: en$/m);
  assert.match(
    securityTxt,
    /^Canonical: https:\/\/minds\.on\.minds\.io\/\.well-known\/security\.txt$/m,
  );
});

test('sitemap lists public launch pages and visible communities only once', () => {
  const sitemap = renderSitemap({
    data: [
      { slug: 'technology', privacy: 'public' },
      { slug: 'technology', privacy: 'public' },
      { slug: 'private-club', privacy: 'private' },
      { slug: 'hidden-import', privacy: 'public', importHidden: true },
      { slug: 'bad/slug', privacy: 'public' },
      { id: '60886ff1-0ae5-42b3-8fe5-440ca4b3f3f6', privacy: 'public' },
    ],
  });

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap, /<loc>https:\/\/minds\.on\.minds\.io<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/minds\.on\.minds\.io\/privacy<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/minds\.on\.minds\.io\/community\/technology<\/loc>/);
  assert.match(sitemap, /community\/60886ff1-0ae5-42b3-8fe5-440ca4b3f3f6/);
  assert.doesNotMatch(sitemap, /private-club|hidden-import|bad\/slug/);
  assert.equal(sitemap.match(/community\/technology/g)?.length, 1);
});

test('sitemap stays within the live public communities API limit', async () => {
  const sitemap = await sitemapForPublicApi(async (procedure, input) => {
    assert.equal(procedure, 'communities.list');
    assert.deepEqual(input, { limit: 50 });
    return { data: [{ slug: 'big-ideas', privacy: 'public' }] };
  });

  assert.match(sitemap, /community\/big-ideas/);
});

test('native association files use the verified Minds app identities', () => {
  const apple = JSON.parse(renderAppleAssociation());
  assert.deepEqual(apple.applinks.details, [{
    appID: '35U3998VRZ.com.minds.app',
    paths: ['*'],
  }]);

  const android = JSON.parse(renderAndroidAssetLinks());
  assert.equal(android[0].target.package_name, 'com.minds.app');
  assert.deepEqual(android[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.deepEqual(android[0].target.sha256_cert_fingerprints, [
    'D8:78:DA:63:E4:01:FA:D7:0E:20:39:3F:48:C1:39:5E:63:E8:3E:1B:AB:C2:3A:CC:12:18:FB:73:34:11:9C:1C',
  ]);
});

test('post pages produce entity metadata from the public projection', async () => {
  const meta = await metaForPath(`/post/${postId}`, new URLSearchParams(), async (procedure, input) => {
    assert.equal(procedure, 'posts.get');
    assert.equal(input.id, postId);
    assert.match(input.projectId, /^[0-9a-f-]{36}$/);
    return {
      content: 'A real public post',
      isNsfw: false,
      author: { name: 'Alice', image: 'https://cdn.example/avatar.jpg' },
      media: [{ type: 'image', url: 'https://cdn.example/post.jpg' }],
    };
  });

  assert.equal(meta.title, 'Alice on Minds');
  assert.equal(meta.description, 'A real public post');
  assert.equal(meta.image, 'https://cdn.example/post.jpg');
  assert.equal(meta.url, `https://minds.on.minds.io/post/${postId}`);
});

test('NSFW text is not exposed and no-JS crawlers receive semantic HTML', async () => {
  const meta = await metaForPath(`/post/${postId}`, new URLSearchParams(), async () => ({
    content: 'private preview text',
    isNsfw: true,
  }));
  const html = injectPage(
    '<html><head><!--minds-meta--><!--/minds-meta--></head><body><noscript>You need JavaScript</noscript><div id="root"></div></body></html>',
    meta,
  );

  assert.doesNotMatch(html, /private preview text/);
  assert.match(html, /<noscript><main><h1>Post on Minds<\/h1>/);
  assert.match(html, /<meta property="og:title" content="Post on Minds"/);
});

test('legacy HTML entities are decoded once before safe meta escaping', async () => {
  const meta = await metaForPath(
    '/community/60886ff1-0ae5-42b3-8fe5-440ca4b3f3f6',
    new URLSearchParams(),
    async () => ({
      name: 'Science',
      privacy: 'public',
      description: 'Share 3 &quot;Science and technology&quot; posts.',
    }),
  );
  const html = injectPage(
    '<html><head><!--minds-meta--><!--/minds-meta--></head><body><noscript>old</noscript></body></html>',
    meta,
  );

  assert.equal(meta.description, 'Share 3 "Science and technology" posts.');
  assert.match(html, /Share 3 &quot;Science and technology&quot; posts\./);
  assert.doesNotMatch(html, /&amp;quot;/);
});

test('friendly community paths produce metadata through the public slug lookup', async () => {
  const meta = await metaForPath(
    '/community/technology-20034560',
    new URLSearchParams(),
    async (procedure, input) => {
      assert.equal(procedure, 'communities.getBySlug');
      assert.deepEqual(input, { slug: 'technology-20034560' });
      return {
        name: 'Technology',
        privacy: 'public',
        description: 'Discuss technology on Minds.',
      };
    },
  );

  assert.equal(meta.title, 'Technology — Minds');
  assert.equal(meta.description, 'Discuss technology on Minds.');
  assert.equal(meta.url, 'https://minds.on.minds.io/community/technology-20034560');
});

test('static public pages describe their own content without API lookups', async () => {
  const expected = {
    live: {
      title: 'Minds Live — Watch live battles',
      description: 'Watch live two-minute webcam battles without leaving Minds.',
    },
    privacy: {
      title: 'Minds 2.0 Privacy — What we collect and why',
      description: 'Learn what Minds collects, why, and what you can do about it.',
    },
  };
  let lookups = 0;

  for (const [route, values] of Object.entries(expected)) {
    const meta = await metaForPath(`/${route}`, new URLSearchParams(), async () => {
      lookups += 1;
      return null;
    });

    assert.deepEqual(meta, {
      ...values,
      url: `https://minds.on.minds.io/${route}`,
      type: 'website',
    });
  }

  assert.equal(lookups, 0);
});

test('top-level app routes never masquerade as root-level usernames', async () => {
  const routes = [
    'ai', 'bookmarks', 'groups', 'live', 'moderation', 'privacy', 'sign-in', 'sign-up',
  ];
  let profileLookups = 0;

  for (const route of routes) {
    const meta = await metaForPath(`/${route}`, new URLSearchParams(), async () => {
      profileLookups += 1;
      return { username: route, name: 'Unrelated profile' };
    });
    assert.equal(meta.url, `https://minds.on.minds.io/${route}`);
    assert.doesNotMatch(meta.title || '', /Unrelated profile/);
  }

  assert.equal(profileLookups, 0);
});

test('legacy articles recover their deterministic banner for link previews', async () => {
  const meta = await metaForPath(`/post/${postId}`, new URLSearchParams(), async () => ({
    title: 'A legacy article',
    content: 'It is here.&nbsp;Read it now.',
    contentFormat: 'markdown',
    legacyGuid: '546153141079388160',
    media: [],
    author: { name: 'Alice', image: 'https://cdn.example/avatar.jpg' },
  }));

  assert.equal(meta.description, 'It is here. Read it now.');
  assert.equal(meta.image, 'https://cdn.minds.com/fs/v1/banners/546153141079388160');
});

test('known historical post permalinks extract the canonical post guid', () => {
  const guid = '546153141079388160';
  assert.equal(legacyPostGuidForPath(`/newsfeed/${guid}`), guid);
  assert.equal(legacyPostGuidForPath(`/newsfeed/${guid}/a-title`), guid);
  assert.equal(legacyPostGuidForPath(`/post/${guid}`), guid);
  assert.equal(legacyPostGuidForPath(`/p/${guid}`), guid);
  assert.equal(legacyPostGuidForPath(`/blog/view/${guid}/a-title`), guid);
  assert.equal(legacyPostGuidForPath(`/media/alice/${guid}`), guid);
  assert.equal(legacyPostGuidForPath(`/groups/profile/${guid}`), null);
  assert.equal(legacyCommunityGuidForPath(`/groups/profile/${guid}`), guid);
  assert.equal(legacyCommunityGuidForPath(`/groups/profile/${guid}/feed`), guid);
  assert.equal(legacyCommunityGuidForPath(`/newsfeed/${guid}`), null);
  assert.equal(legacyPostGuidForPath('/minds/blog/something-123'), null);
});

test('legacy lookup is anonymous, project-bound, and validates its destination', async () => {
  let requested;
  const result = await resolveLegacyPost('546153141079388161', async (url, init) => {
    requested = { url: String(url), init };
    const projectId = JSON.parse(new URL(url).searchParams.get('input')).projectId;
    return new Response(JSON.stringify({
      result: { data: { path: `/post/${postId}?projectId=${projectId}` } },
    }));
  });

  assert.match(result.path, new RegExp(`^/post/${postId}\\?projectId=[0-9a-f-]{36}$`));
  assert.equal(result.kind, 'found');
  assert.match(requested.url, /\/api\/trpc\/posts\.resolveLegacy\?/);
  const input = JSON.parse(new URL(requested.url).searchParams.get('input'));
  assert.equal(input.guid, '546153141079388161');
  assert.match(input.projectId, /^[0-9a-f-]{36}$/);
  assert.equal(requested.init.headers.Authorization, undefined);

  const invalid = await resolveLegacyPost('546153141079388162', async () =>
    new Response(JSON.stringify({ result: { data: { path: 'https://evil.example/' } } }))
  );
  assert.deepEqual(invalid, { kind: 'unavailable' });
});

test('legacy community lookup is anonymous, project-bound, and isolated from post caching', async () => {
  const guid = '546153141079388170';
  await resolveLegacyPost(guid, async () =>
    new Response(JSON.stringify({ result: { data: { path: `/post/${postId}` } } })),
  );

  let requested;
  const result = await resolveLegacyCommunity(guid, async (url, init) => {
    requested = { url: String(url), init };
    return new Response(JSON.stringify({
      result: { data: { path: '/community/technology-20034560' } },
    }));
  });

  assert.deepEqual(result, { kind: 'found', path: '/community/technology-20034560' });
  assert.match(requested.url, /\/api\/trpc\/communities\.resolveLegacy\?/);
  const input = JSON.parse(new URL(requested.url).searchParams.get('input'));
  assert.equal(input.guid, guid);
  assert.match(input.projectId, /^[0-9a-f-]{36}$/);
  assert.equal(requested.init.headers.Authorization, undefined);

  const invalid = await resolveLegacyCommunity('546153141079388171', async () =>
    new Response(JSON.stringify({ result: { data: { path: '/community/../../admin' } } })),
  );
  assert.deepEqual(invalid, { kind: 'unavailable' });
});

test('historical paths become 308, definitive misses become 410, and outages become 503', async () => {
  const guid = '546153141079388163';
  await assert.doesNotReject(async () => {
    assert.deepEqual(
      await legacyResponseForPath(`/newsfeed/${guid}`, async (value) => {
        assert.equal(value, guid);
        return { kind: 'found', path: `/post/${postId}` };
      }),
      { status: 308, location: `/post/${postId}` },
    );
  });
  assert.deepEqual(
    await legacyResponseForPath(`/p/${guid}`, async () => ({ kind: 'gone' })),
    { status: 410 },
  );
  assert.deepEqual(
    await legacyResponseForPath(`/blog/view/${guid}`, async () => ({ kind: 'unavailable' })),
    { status: 503 },
  );
  assert.deepEqual(
    await legacyResponseForPath(
      `/groups/profile/${guid}`,
      async () => { throw new Error('post lookup must not run'); },
      async (value) => {
        assert.equal(value, guid);
        return { kind: 'found', path: '/community/technology-20034560' };
      },
    ),
    { status: 308, location: '/community/technology-20034560' },
  );
  assert.equal(await legacyResponseForPath('/invented/dead-page', async () => ({ kind: 'gone' })), null);
});

test('only a successful null result is treated as gone', async () => {
  const missing = await resolveLegacyPost('546153141079388164', async () =>
    new Response(JSON.stringify({ result: { data: null } }))
  );
  const failed = await resolveLegacyPost('546153141079388165', async () => new Response('{}', { status: 500 }));
  const undeployed = await resolveLegacyPost('546153141079388167', async () => new Response('{}', { status: 404 }));
  const networkError = await resolveLegacyPost('546153141079388166', async () => {
    throw new Error('offline');
  });

  assert.deepEqual(missing, { kind: 'gone' });
  assert.deepEqual(failed, { kind: 'unavailable' });
  assert.deepEqual(undeployed, { kind: 'unavailable' });
  assert.deepEqual(networkError, { kind: 'unavailable' });
});
