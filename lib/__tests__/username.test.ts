import { describe, expect, it } from 'vitest';
import { isValidUsername, sanitizeUsername, USERNAME_MAX } from '../username';

// #201: the sign-up picker and Edit Profile sanitised with different regexes,
// so a hyphenated username chosen at sign-up could not be typed into Edit
// Profile. The regression that matters is the HYPHEN — everything else here
// exists so a future "tidy up" of the rule cannot quietly reintroduce it.

describe('sanitizeUsername', () => {
  it('KEEPS hyphens — the #201 regression', () => {
    expect(sanitizeUsername('bill-ottman')).toBe('bill-ottman');
  });

  it('keeps underscores', () => {
    expect(sanitizeUsername('bill_ottman')).toBe('bill_ottman');
  });

  it('lowercases', () => {
    expect(sanitizeUsername('Bill-Ottman')).toBe('bill-ottman');
  });

  it('drops characters outside the rule', () => {
    expect(sanitizeUsername('bill ottman!@#')).toBe('billottman');
    expect(sanitizeUsername('bill.ottman')).toBe('billottman');
  });

  it('caps length', () => {
    expect(sanitizeUsername('a'.repeat(50))).toHaveLength(USERNAME_MAX);
  });

  it('does not fight the cursor mid-typing: a trailing separator survives', () => {
    // sanitize runs on every keystroke. If it enforced the end-with-alphanumeric
    // rule it would delete the hyphen the moment someone typed it, making
    // "bill-ottman" impossible to reach one character at a time.
    expect(sanitizeUsername('bill-')).toBe('bill-');
  });

  it('is null-safe', () => {
    expect(sanitizeUsername('')).toBe('');
    expect(sanitizeUsername(undefined as any)).toBe('');
  });
});

describe('isValidUsername', () => {
  it('accepts a hyphenated username end to end', () => {
    expect(isValidUsername('bill-ottman')).toBe(true);
  });

  it('accepts underscores and digits', () => {
    expect(isValidUsername('bill_ottman2')).toBe(true);
  });

  it('rejects leading and trailing separators', () => {
    // Impersonation and parsing-ambiguity vector: `-bob` next to `bob`.
    expect(isValidUsername('-bob')).toBe(false);
    expect(isValidUsername('bob-')).toBe(false);
    expect(isValidUsername('_bob')).toBe(false);
    expect(isValidUsername('bob_')).toBe(false);
  });

  it('rejects too short and too long', () => {
    expect(isValidUsername('a')).toBe(false);
    expect(isValidUsername('a'.repeat(USERNAME_MAX + 1))).toBe(false);
  });

  it('rejects characters sanitize would have removed', () => {
    expect(isValidUsername('bill ottman')).toBe(false);
    expect(isValidUsername('bill.ottman')).toBe(false);
  });

  it('accepts exactly the boundary lengths', () => {
    expect(isValidUsername('ab')).toBe(true);
    expect(isValidUsername('a'.repeat(USERNAME_MAX))).toBe(true);
  });
});
