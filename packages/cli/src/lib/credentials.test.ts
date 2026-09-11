import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

// The module computes ~/.minds from homedir() at load time, so the fake home
// must exist before the import below runs.
const HOME = await vi.hoisted(async () => {
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: joinPath } = await import('node:path');
  return mkdtempSync(joinPath(tmpdir(), 'minds-cli-credentials-'));
});

vi.mock('node:os', async (importOriginal) => {
  const os = await importOriginal<typeof import('node:os')>();
  return { ...os, homedir: () => HOME };
});

// These tests exercise the real filesystem behaviour of the credential store
// — auth.test.ts mocks this module wholesale, so nothing else covers it.
import { clearApiKey, loadStoredApiKey, saveApiKey } from './credentials.js';

const MINDS_DIR = join(HOME, '.minds');
const CREDENTIALS_FILE = join(MINDS_DIR, 'credentials');
const TMP_FILE = `${CREDENTIALS_FILE}.${process.pid}.tmp`;

afterEach(() => {
  rmSync(MINDS_DIR, { recursive: true, force: true });
});

describe('saveApiKey', () => {
  it('round-trips a key, owner-only from birth (file 0600, dir 0700)', () => {
    saveApiKey('sk_test_roundtrip_0000000000');
    expect(loadStoredApiKey()).toBe('sk_test_roundtrip_0000000000');
    expect(statSync(CREDENTIALS_FILE).mode & 0o777).toBe(0o600);
    expect(statSync(MINDS_DIR).mode & 0o777).toBe(0o700);
  });

  it('replaces an existing key and leaves no temp file behind', () => {
    saveApiKey('sk_test_first_00000000000000');
    saveApiKey('sk_test_second_0000000000000');
    expect(loadStoredApiKey()).toBe('sk_test_second_0000000000000');
    expect(readdirSync(MINDS_DIR)).toEqual(['credentials']);
  });

  it('a save that cannot complete leaves the existing credentials byte-identical', () => {
    // The residue #694 named: truncate-in-place meant a write that died
    // partway destroyed the only local record of the key being replaced.
    // Injection: occupy the temp path with a directory, so the temp write
    // fails (EISDIR) no matter which user runs the tests. The write must
    // fail without the stored file ever having been opened for writing.
    saveApiKey('sk_test_survivor_00000000000');
    const before = readFileSync(CREDENTIALS_FILE);
    mkdirSync(TMP_FILE);
    expect(() => saveApiKey('sk_test_doomed_0000000000000')).toThrow();
    expect(readFileSync(CREDENTIALS_FILE)).toEqual(before);
    expect(loadStoredApiKey()).toBe('sk_test_survivor_00000000000');
  });

  it('a save that fails at the swap step leaves no temp residue', () => {
    // Injection: the destination itself is a directory, so the final rename
    // fails after the temp file was fully written; the temp file must not
    // be left holding a live key on disk.
    mkdirSync(MINDS_DIR, { mode: 0o700 });
    mkdirSync(CREDENTIALS_FILE);
    expect(() => saveApiKey('sk_test_unswappable_00000000')).toThrow();
    expect(readdirSync(MINDS_DIR)).toEqual(['credentials']);
  });
});

describe('loadStoredApiKey / clearApiKey', () => {
  it('returns undefined when the file is missing or unparseable', () => {
    expect(loadStoredApiKey()).toBeUndefined();
    mkdirSync(MINDS_DIR, { mode: 0o700 });
    writeFileSync(CREDENTIALS_FILE, 'not json');
    expect(loadStoredApiKey()).toBeUndefined();
  });

  it('clearApiKey deletes the stored key and is a no-op when absent', () => {
    expect(() => clearApiKey()).not.toThrow();
    saveApiKey('sk_test_cleared_000000000000');
    clearApiKey();
    expect(loadStoredApiKey()).toBeUndefined();
  });
});
