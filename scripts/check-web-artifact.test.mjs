import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertWebArtifact, inspectWebArtifact } from './check-web-artifact.mjs';

function fixture({ includeLazyChunk = true } = {}) {
  const dist = mkdtempSync(join(tmpdir(), 'minds-web-artifact-'));
  const webJs = join(dist, '_expo/static/js/web');
  mkdirSync(webJs, { recursive: true });
  writeFileSync(
    join(dist, 'index.html'),
    '<script src="/_expo/static/js/web/index-abcd1234.js"></script>',
  );
  writeFileSync(
    join(webJs, 'index-abcd1234.js'),
    'globalThis.loadRoute("/_expo/static/js/web/live-ef567890.js")',
  );
  if (includeLazyChunk) writeFileSync(join(webJs, 'live-ef567890.js'), 'globalThis.live = true');
  writeFileSync(join(dist, 'build-info.json'), JSON.stringify({
    commit: '2b074f3187d5c120bcf18b5a98867fa5f6bcbe04',
  }));
  return dist;
}

test('accepts a complete exported web artifact', () => {
  const dist = fixture();
  try {
    assert.deepEqual(assertWebArtifact(dist), {
      commit: '2b074f3187d5c120bcf18b5a98867fa5f6bcbe04',
      files: 2,
      references: 2,
      missing: [],
    });
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('rejects an artifact with malformed embedded provenance', () => {
  const dist = fixture();
  try {
    writeFileSync(join(dist, 'build-info.json'), JSON.stringify({ commit: '2b074f3' }));
    assert.throws(
      () => assertWebArtifact(dist),
      /web artifact has an invalid commit/,
    );
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('accepts a complete artifact when provenance is supplied only at runtime', () => {
  const dist = fixture();
  try {
    rmSync(join(dist, 'build-info.json'));
    assert.deepEqual(assertWebArtifact(dist), {
      commit: null,
      files: 2,
      references: 2,
      missing: [],
    });
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});

test('rejects a final artifact whose boot bundle references an omitted route chunk', () => {
  const dist = fixture({ includeLazyChunk: false });
  try {
    const report = inspectWebArtifact(dist);
    assert.deepEqual(report.missing, ['live-ef567890.js']);
    assert.throws(
      () => assertWebArtifact(dist),
      /refusing to start: web artifact references 1 missing JavaScript chunk.*live-ef567890\.js/,
    );
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
});
