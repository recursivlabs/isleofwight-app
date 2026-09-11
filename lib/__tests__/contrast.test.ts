import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { colors as darkColors, lightColors } from '../../constants/theme';

// #202 — the primary gold CTAs hardcoded #ffffff, which is 2.21:1 against the
// dark-mode gold. The accessibility floor for body text is 4.5:1, and these are
// the buttons a new user meets first.
//
// This computes the ratio from the theme tokens rather than restating a number
// from the issue. A test that asserts "#0f0f0f is the right colour" only checks
// that nobody edited a string; this checks that whatever the palette says today
// is actually readable.

const ROOT = path.resolve(__dirname, '../..');

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1:1 … 21:1. */
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

describe('contrast()', () => {
  // The measuring instrument gets checked before anything is measured with it.
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  it('is symmetric', () => {
    expect(contrast('#d4a844', '#0f0f0f')).toBeCloseTo(contrast('#0f0f0f', '#d4a844'), 10);
  });
});

describe('gold CTA text is readable', () => {
  it('dark mode clears the 4.5:1 floor for body text', () => {
    expect(contrast(darkColors.textOnAccent, darkColors.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it('the hardcoded white it replaced did NOT clear it', () => {
    // The control, and the reason this file exists. If this ever passes, the
    // gold has changed enough that the whole finding needs re-deriving.
    expect(contrast('#ffffff', darkColors.accent)).toBeLessThan(4.5);
  });

  it('light mode is left alone deliberately', () => {
    // lightColors.textOnAccent IS #ffffff — 3.82:1 — and #202 is explicit that
    // this is a palette decision, not the bug. Asserted so that a well-meaning
    // "fix all contrast" sweep has to argue with a test and a design call
    // instead of quietly changing the brand.
    expect(lightColors.textOnAccent).toBe('#ffffff');
    expect(contrast(lightColors.textOnAccent, lightColors.accent)).toBeLessThan(4.5);
  });
});

describe('the gold CTAs use the token, not a literal', () => {
  // Fixing the three call sites does not stop a fourth being written. Fixing
  // the palette does not help a screen that bypasses it.
  const SITES = ['app/auth/pick-username.tsx', 'app/reset-password.tsx', 'app/(tabs)/index.tsx'];

  for (const site of SITES) {
    it(`${site} sets no literal white text colour`, () => {
      const src = fs.readFileSync(path.join(ROOT, site), 'utf8');
      const literals = src.match(/color=(?:"#[fF]{6}"|\{['"]#[fF]{6}['"]\})/g) ?? [];
      expect(literals).toEqual([]);
    });
  }
});
