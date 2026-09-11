import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  readBuildInfo,
  resolveBuildCommit,
  writeBuildInfo,
} from './write-build-info.mjs';

const COMMIT = '2b074f3187d5c120bcf18b5a98867fa5f6bcbe04';

test('writes and reads a complete git commit', () => {
  const dist = mkdtempSync(join(tmpdir(), 'minds-build-info-'));
  try {
    assert.deepEqual(writeBuildInfo({ dist, commit: COMMIT }), {
      file: join(dist, 'build-info.json'),
      commit: COMMIT,
    });
    assert.deepEqual(readBuildInfo(dist), { commit: COMMIT });
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('prefers the checked-out git commit over provider metadata', () => {
  assert.equal(resolveBuildCommit({
    env: { SOURCE_COMMIT: 'a'.repeat(40) },
    runGit: () => `${COMMIT}\n`,
  }), COMMIT);
});

test('uses a complete provider commit only when git is unavailable', () => {
  assert.equal(resolveBuildCommit({
    env: { SOURCE_COMMIT: COMMIT },
    runGit: () => { throw new Error('no .git directory'); },
  }), COMMIT);
});

test('rejects missing, abbreviated, or malformed commit evidence', () => {
  assert.throws(
    () => resolveBuildCommit({
      env: { SOURCE_COMMIT: '2b074f3', GITHUB_SHA: 'not-a-sha' },
      runGit: () => 'also-not-a-sha',
    }),
    /cannot resolve a complete build commit/,
  );
});

test('optional build provenance removes a stale file when the builder exposes no commit', () => {
  const dist = mkdtempSync(join(tmpdir(), 'minds-build-info-'));
  try {
    writeBuildInfo({ dist, commit: COMMIT });
    assert.equal(writeBuildInfo({
      dist,
      optional: true,
      env: {},
      runGit: () => { throw new Error('no .git directory'); },
    }), null);
    assert.throws(() => readBuildInfo(dist), /web artifact is missing/);
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
