import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';

const MINDS_DIR = join(homedir(), '.minds');
const CREDENTIALS_FILE = join(MINDS_DIR, 'credentials');

interface Credentials {
  apiKey?: string;
  baseUrl?: string;
}

/**
 * Resolve the API key from env first, then from ~/.minds/credentials.
 * Falls back to the Recursiv key for users who already auth'd via the
 * Recursiv CLI on the same machine — same Recursiv API key works.
 */
export function loadApiKey(): string | undefined {
  const fromEnv = process.env.MINDS_API_KEY ?? process.env.RECURSIV_API_KEY;
  if (fromEnv) return fromEnv;

  if (existsSync(CREDENTIALS_FILE)) {
    try {
      const data: Credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'));
      if (data.apiKey) return data.apiKey;
    } catch {}
  }

  // Fall back to Recursiv's credentials file if Minds-specific one is absent.
  const recursivCreds = join(homedir(), '.recursiv', 'credentials');
  if (existsSync(recursivCreds)) {
    try {
      const data = JSON.parse(readFileSync(recursivCreds, 'utf8'));
      if (data.apiKey) return data.apiKey;
    } catch {}
  }

  return undefined;
}

/**
 * Read the API key from ~/.minds/credentials ONLY — no env vars, no Recursiv
 * fallback. Logout revokes this key server-side, and must never revoke a
 * credential it did not store (an env key, or the shared ~/.recursiv one).
 */
export function loadStoredApiKey(): string | undefined {
  if (!existsSync(CREDENTIALS_FILE)) return undefined;
  try {
    const data: Credentials = JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8'));
    return data.apiKey || undefined;
  } catch {
    return undefined;
  }
}

export function saveApiKey(apiKey: string): void {
  if (!existsSync(MINDS_DIR)) {
    mkdirSync(MINDS_DIR, { mode: 0o700 });
  }
  const data: Credentials = { apiKey };
  // Write to a same-directory temp file born 0600, then rename it over the
  // real one. Truncating the file in place meant a write that died partway
  // (ENOSPC, EIO) destroyed the only local record of the key being replaced
  // — the residue #694 documented — and the old write-then-chmod left the
  // key world-readable between the two calls.
  const tmpFile = `${CREDENTIALS_FILE}.${process.pid}.tmp`;
  try {
    writeFileSync(tmpFile, JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(tmpFile, CREDENTIALS_FILE);
  } catch (err) {
    try {
      unlinkSync(tmpFile);
    } catch {}
    throw err;
  }
}

export function clearApiKey(): void {
  if (existsSync(CREDENTIALS_FILE)) {
    unlinkSync(CREDENTIALS_FILE);
  }
}

export function loadBaseUrl(): string | undefined {
  return process.env.MINDS_API_URL ?? process.env.RECURSIV_API_URL;
}
