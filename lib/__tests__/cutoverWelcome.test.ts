import { describe, expect, it } from 'vitest';
import {
  WELCOME_BANNER_WINDOW_MS,
  cutoverWelcomeKeys,
  isCutoverWelcomeActive,
  nextCutoverWelcomeBoundary,
} from '../cutoverWelcome';

const LAUNCH_AT = '2026-08-31T04:00:00.000Z';
const LAUNCH = Date.parse(LAUNCH_AT);

describe('Minds 2.0 welcome eligibility', () => {
  it('starts at the configured instant and expires globally after 30 days', () => {
    const returningUser = '2012-01-01T00:00:00.000Z';
    expect(isCutoverWelcomeActive(returningUser, LAUNCH_AT, LAUNCH - 1)).toBe(false);
    expect(isCutoverWelcomeActive(returningUser, LAUNCH_AT, LAUNCH)).toBe(true);
    expect(isCutoverWelcomeActive(returningUser, LAUNCH_AT, LAUNCH + WELCOME_BANNER_WINDOW_MS - 1)).toBe(true);
    expect(isCutoverWelcomeActive(returningUser, LAUNCH_AT, LAUNCH + WELCOME_BANNER_WINDOW_MS)).toBe(false);
  });

  it('only greets accounts created before launch', () => {
    expect(isCutoverWelcomeActive(new Date(LAUNCH - 1).toISOString(), LAUNCH_AT, LAUNCH)).toBe(true);
    expect(isCutoverWelcomeActive(LAUNCH_AT, LAUNCH_AT, LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive(new Date(LAUNCH + 1).toISOString(), LAUNCH_AT, LAUNCH + 1)).toBe(false);
  });

  it('fails closed when launch or account provenance is uncertain', () => {
    expect(isCutoverWelcomeActive(undefined, LAUNCH_AT, LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive('not-a-date', LAUNCH_AT, LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive('2012-01-01T00:00:00.000Z', undefined, LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive('2012-01-01T00:00:00.000Z', 'not-a-date', LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive('2012-01-01T00:00:00', LAUNCH_AT, LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive('2012-01-01T00:00:00.000Z', '2026-08-31T04:00:00', LAUNCH)).toBe(false);
    expect(isCutoverWelcomeActive('2012-01-01T00:00:00.000Z', '2026-02-31T04:00:00.000Z', LAUNCH)).toBe(false);
  });

  it('reports the next global visibility boundary', () => {
    expect(nextCutoverWelcomeBoundary(LAUNCH_AT, LAUNCH - 1)).toBe(LAUNCH);
    expect(nextCutoverWelcomeBoundary(LAUNCH_AT, LAUNCH)).toBe(LAUNCH + WELCOME_BANNER_WINDOW_MS);
    expect(nextCutoverWelcomeBoundary(LAUNCH_AT, LAUNCH + WELCOME_BANNER_WINDOW_MS)).toBeNull();
    expect(nextCutoverWelcomeBoundary('2026-08-31T04:00:00', LAUNCH)).toBeNull();
  });

  it('scopes every persisted flag to the signed-in account', () => {
    const keys = cutoverWelcomeKeys('user-123');
    expect(Object.values(keys)).toHaveLength(2);
    for (const key of Object.values(keys)) {
      expect(key).toContain(':user-123:');
      expect(key).toContain('cutoverWelcome:v1');
    }
  });
});
