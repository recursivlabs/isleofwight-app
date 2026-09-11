// node --test suite for scripts/parity-failure-context.mjs — pins the SOURCE
// module (imported, not re-implemented), so mutating the real file fails here.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fetchDeployedCommit,
  formatParityError,
  healthUrl,
  healthUrls,
} from './parity-failure-context.mjs';

test('healthUrl appends /health to the versioned base', () => {
  assert.equal(
    healthUrl('https://api.minds.com/api/v1'),
    'https://api.minds.com/api/v1/health',
  );
  // trailing slash must not produce a double slash
  assert.equal(
    healthUrl('https://api.minds.com/api/v1/'),
    'https://api.minds.com/api/v1/health',
  );
});

test('healthUrls tries the versioned route first, then the origin root', () => {
  assert.deepEqual(healthUrls('https://api.minds.com/api/v1'), [
    'https://api.minds.com/api/v1/health',
    'https://api.minds.com/health',
  ]);
  // a base with no /api/vN suffix yields just its own /health
  assert.deepEqual(healthUrls('https://api.minds.com'), [
    'https://api.minds.com/health',
  ]);
});

test('fetchDeployedCommit reads the commit from a healthy host (positive control)', async () => {
  const fetchImpl = async (url) => {
    assert.equal(url, 'https://api.minds.com/api/v1/health');
    return { status: 200, json: async () => ({ commit: 'eff1327abc' }) };
  };
  const health = await fetchDeployedCommit('https://api.minds.com/api/v1', fetchImpl);
  assert.deepEqual(health, { status: 200, commit: 'eff1327abc' });
});

test('fetchDeployedCommit falls back to the root route when the versioned body has no commit', async () => {
  // The dedicated Minds host answers 200 on /api/v1/health with no commit
  // field (run 32971196667); the root /health is where commit lives.
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url === 'https://api.minds.com/api/v1/health') {
      return { status: 200, json: async () => ({ ok: true }) };
    }
    return { status: 200, json: async () => ({ commit: 'root123' }) };
  };
  const health = await fetchDeployedCommit('https://api.minds.com/api/v1', fetchImpl);
  assert.deepEqual(calls, [
    'https://api.minds.com/api/v1/health',
    'https://api.minds.com/health',
  ]);
  assert.deepEqual(health, { status: 200, commit: 'root123' });
});

test('fetchDeployedCommit reports the first answer when no route names a commit', async () => {
  const health = await fetchDeployedCommit('https://api.minds.com/api/v1', async () => ({
    status: 200,
    json: async () => ({ ok: true }),
  }));
  assert.deepEqual(health, { status: 200, commit: null });
});

test('fetchDeployedCommit never throws: non-JSON body and network failure both report', async () => {
  const nonJson = await fetchDeployedCommit('https://x/api/v1', async () => ({
    status: 502,
    json: async () => {
      throw new Error('not json');
    },
  }));
  assert.deepEqual(nonJson, { status: 502, commit: null });

  const down = await fetchDeployedCommit('https://x/api/v1', async () => {
    throw new Error('ECONNREFUSED');
  });
  assert.equal(down.status, null);
  assert.equal(down.commit, null);
  assert.match(down.error, /ECONNREFUSED/);
});

test('formatParityError names phase, status, body and deployed commit', () => {
  const line = formatParityError({
    phase: 'reply B→A post',
    err: { message: 'HTTP 500: Internal Server Error', status: 500, body: { error: 'x' } },
    health: { status: 200, commit: 'eff1327abc' },
  });
  assert.equal(
    line,
    'PARITY ERROR at phase [reply B→A post]: HTTP 500: Internal Server Error 500 {"error":"x"} deployed-commit=eff1327abc',
  );
});

test('formatParityError keeps the PARITY ERROR prefix log greps match', () => {
  const line = formatParityError({ phase: 'init', err: new Error('boom') });
  assert.ok(line.startsWith('PARITY ERROR'));
  assert.match(line, /deployed-commit=unknown/);
});

test('formatParityError reports an unreachable health endpoint distinctly', () => {
  const line = formatParityError({
    phase: 'sign-in A',
    err: { message: 'HTTP 500', status: 500 },
    health: { status: null, commit: null, error: 'timeout' },
  });
  assert.match(line, /health-unreachable \(timeout\)/);
});

test('formatParityError calls a commit-less 200 unreported, not unreachable', () => {
  const line = formatParityError({
    phase: 'reply B→A post',
    err: { message: 'HTTP 500', status: 500 },
    health: { status: 200, commit: null },
  });
  assert.match(line, /deployed-commit=unreported \(health status=200\)/);
  assert.doesNotMatch(line, /health-unreachable/);
});
