import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrUrl, run, selectReleased, verifyPr } from './verify-released-tasks.mjs';

const MERGE = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const LIVE = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

/** A fetch that answers by URL prefix and records every call. */
function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    for (const [prefix, answer] of routes) {
      if (String(url).startsWith(prefix)) return typeof answer === 'function' ? answer(String(url), init) : answer;
    }
    return jsonResponse({ error: `unrouted ${url}` }, 404);
  };
  return { impl, calls };
}

const released = (id, prUrls, extra = {}) => ({
  id,
  status: 'in_progress',
  claim_status: 'released',
  release_reason: 'completed',
  pr_urls: prUrls,
  ...extra,
});

test('parsePrUrl accepts GitHub PR URLs and nothing else', () => {
  assert.deepEqual(parsePrUrl('https://github.com/recursivlabs/minds/pull/598'), {
    owner: 'recursivlabs',
    repo: 'minds',
    number: 598,
  });
  assert.equal(parsePrUrl('https://github.com/recursivlabs/minds/issues/598'), null);
  assert.equal(parsePrUrl('https://gitlab.com/minds/engine/-/merge_requests/1'), null);
  assert.equal(parsePrUrl(''), null);
});

test('selectReleased keeps only released-as-completed rows with PR evidence', () => {
  const rows = [
    released('ok', ['https://github.com/recursivlabs/minds/pull/1']),
    released('no-prs', []),
    released('blocked', ['https://github.com/recursivlabs/minds/pull/2'], { release_reason: 'blocked' }),
    released('live-claim', ['https://github.com/recursivlabs/minds/pull/3'], { claim_status: 'active' }),
    released('done', ['https://github.com/recursivlabs/minds/pull/4'], { status: 'done' }),
    released('bad-url', ['https://example.com/pull/5']),
  ];
  assert.deepEqual(selectReleased(rows).map((row) => row.id), ['ok']);
});

test('verifyPr proves merged, on main, and contained in the live commit', async () => {
  const { impl } = fakeFetch([
    ['https://api.github.com/repos/recursivlabs/minds/pulls/598', jsonResponse({ merged: true, merge_commit_sha: MERGE })],
    [`https://api.github.com/repos/recursivlabs/minds/compare/main...${MERGE}`, jsonResponse({ status: 'behind' })],
    [`https://api.github.com/repos/recursivlabs/minds/compare/${LIVE}...${MERGE}`, jsonResponse({ status: 'behind' })],
    ['https://minds.on.minds.io/healthz', jsonResponse({ status: 'ok', commit: LIVE })],
  ]);
  const result = await verifyPr('https://github.com/recursivlabs/minds/pull/598', {
    fetchImpl: impl,
    token: '',
    liveFor: () => 'https://minds.on.minds.io/healthz',
  });
  assert.equal(result.ok, true);
  assert.match(result.evidence, /merged as aaaaaaaa, on main, live/);
});

test('verifyPr refuses an unmerged PR and a merged-but-undeployed PR', async () => {
  const { impl } = fakeFetch([
    ['https://api.github.com/repos/recursivlabs/minds/pulls/1', jsonResponse({ merged: false })],
    ['https://api.github.com/repos/recursivlabs/minds/pulls/2', jsonResponse({ merged: true, merge_commit_sha: MERGE })],
    [`https://api.github.com/repos/recursivlabs/minds/compare/main...${MERGE}`, jsonResponse({ status: 'behind' })],
    [`https://api.github.com/repos/recursivlabs/minds/compare/${LIVE}...${MERGE}`, jsonResponse({ status: 'ahead' })],
    ['https://minds.on.minds.io/healthz', jsonResponse({ status: 'ok', commit: LIVE })],
  ]);
  const ctx = { fetchImpl: impl, token: '', liveFor: () => 'https://minds.on.minds.io/healthz' };
  const unmerged = await verifyPr('https://github.com/recursivlabs/minds/pull/1', ctx);
  assert.equal(unmerged.ok, false);
  assert.match(unmerged.reason, /not merged/);
  const undeployed = await verifyPr('https://github.com/recursivlabs/minds/pull/2', ctx);
  assert.equal(undeployed.ok, false);
  assert.match(undeployed.reason, /awaiting deploy/);
});

/** The list endpoint omits claim_status and pr_urls; only the per-task read has them. */
function listView(task) {
  const { claim_status: _claimStatus, pr_urls: _prUrls, ...rest } = task;
  return rest;
}

function dispatcherRoutes(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  return [
    ['https://api.minds.com/api/v1/dispatcher/tasks?status=in_progress', jsonResponse({ data: tasks.map(listView) })],
    [
      'https://api.minds.com/api/v1/dispatcher/tasks/',
      (url, init) => {
        const parts = new URL(url).pathname.split('/');
        if ((init.method || 'GET') === 'POST') return jsonResponse({ data: { id: parts.at(-2) } }, 201);
        const task = byId.get(parts.at(-1));
        return task ? jsonResponse({ data: task }) : jsonResponse({ error: 'Task not found' }, 404);
      },
    ],
    ['https://api.minds.com/api/v1/dispatcher/done/', jsonResponse({ data: { status: 'done' } })],
    ['https://api.github.com/repos/recursivlabs/minds/pulls/10', jsonResponse({ merged: true, merge_commit_sha: MERGE })],
    ['https://api.github.com/repos/recursivlabs/minds/pulls/11', jsonResponse({ merged: false })],
    [`https://api.github.com/repos/recursivlabs/minds/compare/main...${MERGE}`, jsonResponse({ status: 'behind' })],
    [`https://api.github.com/repos/recursivlabs/minds/compare/${LIVE}...${MERGE}`, jsonResponse({ status: 'identical' })],
    ['https://minds.on.minds.io/healthz', jsonResponse({ status: 'ok', commit: LIVE })],
  ];
}

test('run claims and completes only rows whose evidence holds, as the verifier agent', async () => {
  const tasks = [
    released('proj-good', ['https://github.com/recursivlabs/minds/pull/10']),
    released('proj-unmerged', ['https://github.com/recursivlabs/minds/pull/11']),
    { id: 'proj-active', status: 'in_progress', claim_status: 'active', pr_urls: [] },
  ];
  const { impl, calls } = fakeFetch(dispatcherRoutes(tasks));
  const lines = [];
  const result = await run({
    env: { MINDS_NETWORK_API_KEY: 'k', GH_TOKEN: 't' },
    fetchImpl: impl,
    log: (line) => lines.push(line),
    now: () => new Date('2026-08-27T00:00:00Z'),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.verified.map((row) => row.id), ['proj-good']);
  assert.deepEqual(result.skipped.map((row) => row.id), ['proj-unmerged']);

  const claim = calls.find((call) => call.url.endsWith('/tasks/proj-good/claim'));
  assert.equal(claim.method, 'POST');
  assert.equal(claim.body.agent, 'verifier-ci');
  const done = calls.find((call) => call.url.endsWith('/done/proj-good'));
  assert.equal(done.body.agent, 'verifier-ci');
  assert.match(done.body.notes, /VERIFIED by verifier-ci \(second party, 2026-08-27\)/);
  assert.match(done.body.notes, /pull\/10 merged as aaaaaaaa, on main, live/);
  assert.equal(calls.some((call) => call.url.includes('proj-unmerged/claim')), false);
  assert.match(lines.join('\n'), /SKIP proj-unmerged: .*not merged/);
});

test('run writes nothing in dry-run mode and without a key', async () => {
  const tasks = [released('proj-good', ['https://github.com/recursivlabs/minds/pull/10'])];
  const { impl, calls } = fakeFetch(dispatcherRoutes(tasks));
  const dry = await run({ env: { MINDS_NETWORK_API_KEY: 'k', VERIFY_DRY_RUN: '1' }, fetchImpl: impl, log: () => {} });
  assert.deepEqual(dry.verified.map((row) => row.id), ['proj-good']);
  assert.equal(calls.some((call) => call.method === 'POST'), false);

  const noKey = await run({ env: {}, fetchImpl: impl, log: () => {} });
  assert.equal(noKey.ok, false);
});
