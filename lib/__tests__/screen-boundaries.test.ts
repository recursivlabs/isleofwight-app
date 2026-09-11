import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// #187: the app had ONE error boundary, at the root. A single broken screen
// therefore replaced everything — tab bar, navigation, every working screen —
// with one "Something went wrong", and the user's only move was to force-quit.
//
// expo-router renders a route's `ErrorBoundary` export instead of the crashed
// route, which contains the failure to that screen. This asserts every tab
// route exports one, so a new tab added without it fails here rather than
// taking the whole app down the first time it throws.

const TABS = join(__dirname, '..', '..', 'app', '(tabs)');

function tabRoutes(): string[] {
  return readdirSync(TABS).filter(f => f.endsWith('.tsx') && f !== '_layout.tsx');
}

describe('#187 — a crashed screen must not take the app down', () => {
  it('finds the tab routes by scanning, not from a list', () => {
    // Positive control: an empty scan makes the assertion below vacuous.
    expect(tabRoutes().length).toBeGreaterThanOrEqual(4);
  });

  it('every tab route exports an ErrorBoundary', () => {
    const missing = tabRoutes().filter(f => {
      const src = readFileSync(join(TABS, f), 'utf8');
      return !/export\s*\{[^}]*\bas ErrorBoundary\b|export (function|const) ErrorBoundary/.test(src);
    });
    expect(missing).toEqual([]);
  });

  it('the shared boundary reports the error rather than only rendering', () => {
    // A boundary that silently swallows is how a crash becomes invisible —
    // which is the whole subject of #187.
    const src = readFileSync(
      join(__dirname, '..', '..', 'components', 'ScreenErrorBoundary.tsx'),
      'utf8',
    );
    // Assert the CALL, not the identifier: the first version of this test used
    // toContain('captureException'), which matches the IMPORT line and passed
    // happily against a boundary whose call had been deleted. Caught by its own
    // negative control — a test that cannot fail is not evidence.
    expect(src).toMatch(/captureException\s*\(\s*error/);
  });
});
