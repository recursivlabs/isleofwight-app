/**
 * The one username rule. Both the sign-up picker and Edit Profile import from
 * here, so they cannot disagree about what a username is.
 *
 * They DID disagree (#201): the picker sanitised with /[^a-z0-9_-]/g and Edit
 * Profile with /[^a-z0-9_]/g, so a user who chose `bill-ottman` at sign-up
 * could not type their own username into Edit Profile — the hyphen vanished as
 * they typed, with no error and nothing to indicate why. The issue is explicit
 * that fixing one regex is not the fix: "leaves the same bug waiting to come
 * back." Two call sites, one rule, imported.
 *
 * The rule, and why each part:
 *   - lowercase a-z, 0-9, underscore, hyphen
 *   - must START and END alphanumeric, so `-bob` / `bob_` / `_` are rejected;
 *     leading and trailing separators are the classic impersonation and
 *     parsing-ambiguity vector
 *   - 2..30 characters
 */

export const USERNAME_MAX = 30;

/** Characters a username may contain. Anything else is dropped by `sanitize`. */
const ALLOWED = /[^a-z0-9_-]/g;

/**
 * Full-string validity. Note this is deliberately STRICTER than `sanitize`:
 * sanitize is what you apply while someone types (it must never fight the
 * cursor), validate is what you check before submitting.
 */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_-]{0,28}[a-z0-9])?$/;

/**
 * Normalise keystrokes into an acceptable username fragment. Lowercases, drops
 * disallowed characters, caps the length. Intentionally does NOT enforce the
 * start/end rule — doing that mid-typing would delete the character someone is
 * in the middle of writing.
 */
export function sanitizeUsername(input: string): string {
  return (input || '').toLowerCase().replace(ALLOWED, '').slice(0, USERNAME_MAX);
}

/** Is this a complete, submittable username? */
export function isValidUsername(input: string): boolean {
  const v = input || '';
  return v.length >= 2 && v.length <= USERNAME_MAX && USERNAME_RE.test(v);
}
