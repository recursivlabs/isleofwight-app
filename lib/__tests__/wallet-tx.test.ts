import { describe, it, expect } from 'vitest';
import { extractTxHash, explorerTxUrl, shortHash } from '../wallet';

const HASH = `0x${'ab'.repeat(32)}`;

describe('extractTxHash', () => {
  it('reads the hash from the shape the send route returns', () => {
    // Route: `c.json({ data: result })`, result: `{ hash }` from sendEth.
    expect(extractTxHash({ data: { hash: HASH } })).toBe(HASH);
  });

  it('accepts the documented alternates', () => {
    expect(extractTxHash({ hash: HASH })).toBe(HASH);
    expect(extractTxHash({ data: { transaction_hash: HASH } })).toBe(HASH);
    expect(extractTxHash({ data: { transactionHash: HASH } })).toBe(HASH);
  });

  it('returns null rather than a malformed hash', () => {
    // A half-valid hash builds an explorer link that 404s, which tells the user
    // their transaction does not exist. That is a worse answer than no link.
    expect(extractTxHash({ data: { hash: '0xnope' } })).toBeNull();
    expect(extractTxHash({ data: { hash: HASH.slice(0, -2) } })).toBeNull();
    expect(extractTxHash({ data: { hash: `${HASH}ab` } })).toBeNull();
    expect(extractTxHash({ data: { hash: 'ab'.repeat(32) } })).toBeNull(); // no 0x
    expect(extractTxHash({ data: { hash: 123 } })).toBeNull();
  });

  it('survives the responses that carry no hash at all', () => {
    expect(extractTxHash(null)).toBeNull();
    expect(extractTxHash(undefined)).toBeNull();
    expect(extractTxHash({})).toBeNull();
    expect(extractTxHash({ data: null })).toBeNull();
    expect(extractTxHash({ data: {} })).toBeNull();
  });
});

describe('explorerTxUrl', () => {
  it('builds a Base explorer link', () => {
    expect(explorerTxUrl(HASH)).toBe(`https://basescan.org/tx/${HASH}`);
  });

  it('refuses anything that is not a transaction hash', () => {
    expect(explorerTxUrl(null)).toBeNull();
    expect(explorerTxUrl(undefined)).toBeNull();
    expect(explorerTxUrl('')).toBeNull();
    expect(explorerTxUrl('0xnope')).toBeNull();
    // Not a path-traversal vector so much as a reminder that this value is
    // interpolated into a URL we ask the OS to open.
    expect(explorerTxUrl('../../evil')).toBeNull();
    expect(explorerTxUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('shortHash', () => {
  it('middle-truncates a real hash', () => {
    const s = shortHash(HASH);
    expect(s).toContain('…');
    expect(s.startsWith('0xabababab')).toBe(true);
    expect(s.endsWith(HASH.slice(-8))).toBe(true);
    expect(s.length).toBeLessThan(HASH.length);
  });

  it('leaves something already short alone', () => {
    expect(shortHash('0xabc')).toBe('0xabc');
  });
});
