import { describe, expect, it } from 'vitest';
import { shouldDiscardStoredAuth } from './authBoot';

describe('auth boot version gate', () => {
  it('lets a first v6 launch reach the legacy-session handoff', () => {
    expect(shouldDiscardStoredAuth(null, '9', [null, null, null])).toBe(false);
  });

  it('still invalidates an actual Minds 2.0 session from an older auth model', () => {
    expect(shouldDiscardStoredAuth('8', '9', ['stored-key', '{"id":"u1"}', 'project-1'])).toBe(true);
  });

  it('keeps current Minds 2.0 sessions', () => {
    expect(shouldDiscardStoredAuth('9', '9', ['stored-key', '{"id":"u1"}', 'project-1'])).toBe(false);
  });
});
