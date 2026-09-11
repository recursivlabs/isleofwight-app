/**
 * Minds 2.0 Design Tokens
 *
 * Linear-inspired palette. Two modes:
 * - dark: deep neutrals, gold accent
 * - light: off-white, tight contrast, gold shifts darker for AA
 *
 * Tokens are SEMANTIC, not raw. Components reference what they MEAN
 * (text.primary, surface.raised) so palette changes don't ripple.
 *
 * Never import this file directly for runtime colors. Use:
 *   const colors = useColors();          // reactive
 *   const { colors, mode } = useTheme(); // reactive + mode
 *
 * The exported `colors` and `lightColors` exist only as the source
 * of truth for the provider; component code should not import them.
 */

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ColorTokens {
  // Backgrounds
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceHover: string;

  // Glass / elevated surfaces over media
  glass: string;
  glassBorder: string;

  // Borders
  border: string;
  borderSubtle: string;
  borderFocus: string;

  // Text — 4 levels
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textOnAccent: string;

  // Accent — Minds gold
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentSubtle: string;

  // Semantic
  success: string;
  successMuted: string;
  error: string;
  errorMuted: string;
  warning: string;
  warningMuted: string;
  info: string;
  infoMuted: string;

  // Overlays / scrims (modals, lightbox, image overlays)
  overlay: string;
  scrim: string;
  scrimStrong: string;
  mediaOverlay: string;

  // Specials
  boost: string;
  boostMuted: string;
  token: string;
  tokenMuted: string;
  verified: string;
  verifiedMuted: string;

  // Shadow base color (always darkens, not lightens)
  shadow: string;
}

/**
 * The launch colour.
 *
 * MUST match `backgroundColor` in the expo-splash-screen plugin config in
 * app.json. Everything that can paint before the theme is known — the root
 * view, the session-restore frame, the signed-out sky — uses this, so that the
 * first seconds of a launch never show a colour the splash didn't already show.
 *
 * It is EQUAL to darkColors.bg on purpose. It used to be #08080a while the app
 * painted #0f0f0f, which put a visible step right at the moment the feed
 * appeared — near-black to slightly-lighter-black, read as a flash. Three
 * different darks in one launch (splash, hold, app) is three chances to see a
 * seam. Keep these two values identical; if the dark palette moves, move this
 * and the app.json splash backgroundColor with it.
 */
export const SPLASH_BG = '#010100';

export const darkColors: ColorTokens = {
  bg: '#010100',
  surface: '#181818',
  surfaceRaised: '#1e1e1e',
  surfaceHover: 'rgba(255,255,255,0.06)',

  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',

  border: 'rgba(255,255,255,0.12)',
  borderSubtle: 'rgba(255,255,255,0.08)',
  borderFocus: '#ffd048',

  // Match legacy Minds: solid #f2f2f2 (grey-50), NOT dimmed white. The old
  // rgba(...,0.95) read grey over the near-black bg -- the exact "text is greyer
  // than minds.com" complaint. Secondary/muted follow legacy grey-300/500.
  text: '#f2f2f2',
  textSecondary: '#b9bbc0',
  textMuted: '#8a8e96',
  textInverse: '#010100',
  textOnAccent: '#010100',

  // Legacy Minds gold (yellow-500 #ffd048), brighter than the old #d4a844.
  accent: '#ffd048',
  accentHover: '#ffda6b',
  accentMuted: 'rgba(255,208,72,0.12)',
  accentSubtle: 'rgba(255,208,72,0.06)',

  success: '#34d399',
  successMuted: 'rgba(52,211,153,0.10)',
  error: '#f87171',
  errorMuted: 'rgba(248,113,113,0.10)',
  warning: '#fbbf24',
  warningMuted: 'rgba(251,191,36,0.10)',
  info: '#60a5fa',
  infoMuted: 'rgba(96,165,250,0.10)',

  overlay: 'rgba(0,0,0,0.7)',
  scrim: 'rgba(0,0,0,0.5)',
  scrimStrong: 'rgba(0,0,0,0.85)',
  mediaOverlay: 'rgba(0,0,0,0.65)',

  boost: '#e6bc54',
  boostMuted: 'rgba(230,188,84,0.12)',
  token: '#f0d060',
  tokenMuted: 'rgba(240,208,96,0.10)',
  verified: '#4da6ff',
  verifiedMuted: 'rgba(77,166,255,0.12)',

  shadow: '#000000',
};

export const lightColors: ColorTokens = {
  // Pure white canvas to match X and legacy minds.com; separation comes from
  // borders (sidebar widgets are outline-only, not filled).
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceRaised: '#ffffff',
  surfaceHover: 'rgba(0,0,0,0.055)',

  glass: 'rgba(0,0,0,0.035)',
  glassBorder: 'rgba(0,0,0,0.12)',

  // Legacy border greys (m-borderColor primary/tertiary).
  border: '#d3dbe3',
  borderSubtle: '#ececec',
  borderFocus: '#b8860b',

  // Legacy Minds light text: softer than near-black (m-textColor
  // primary/secondary/tertiary), which reads easier than #0a0a0a.
  text: '#43434d',
  textSecondary: '#72727c',
  textMuted: '#9b9b9b',
  textInverse: '#ffffff',
  textOnAccent: '#ffffff',

  // Minds DARK GOLD in light mode — the brand gold deepened so it reads gold,
  // not orange (the amber-600 before this leaned orange). Dark mode keeps the
  // brighter gold #ffd048. Primary actions layer a gold gradient on web.
  accent: '#b8860b',
  accentHover: '#9a7009',
  accentMuted: 'rgba(184,134,11,0.14)',
  accentSubtle: 'rgba(184,134,11,0.07)',

  success: '#047857',
  successMuted: 'rgba(4,120,87,0.10)',
  error: '#b91c1c',
  errorMuted: 'rgba(185,28,28,0.10)',
  warning: '#b45309',
  warningMuted: 'rgba(180,83,9,0.10)',
  info: '#1d4ed8',
  infoMuted: 'rgba(29,78,216,0.10)',

  overlay: 'rgba(0,0,0,0.4)',
  scrim: 'rgba(0,0,0,0.25)',
  scrimStrong: 'rgba(0,0,0,0.55)',
  // Media overlays must stay dark even in light mode (text-on-image)
  mediaOverlay: 'rgba(0,0,0,0.55)',

  boost: '#a07e24',
  boostMuted: 'rgba(160,126,36,0.12)',
  token: '#a07e24',
  tokenMuted: 'rgba(160,126,36,0.10)',
  verified: '#1d8fe6',
  verifiedMuted: 'rgba(29,143,230,0.12)',

  shadow: '#000000',
};

/**
 * Legacy aliases — kept so files that haven't migrated to useColors()
 * still compile. The provider mutates these to the resolved theme.
 * NEW CODE SHOULD USE useColors().
 */
export const colors: ColorTokens = { ...darkColors };

/**
 * The one canonical gold CTA (Create + every primary Button use this, identically).
 * A top-lit gold gradient with a soft dark-gold edge + a warm glow so it POPS on
 * white and holds up on dark — never flat. Dark ink text reads on gold in both
 * themes. Web gets the gradient + shadow; native falls back to the solid.
 */
export const CTA = {
  gradient: 'linear-gradient(180deg, #ffd84f 0%, #f0a81c 100%)',
  gradientHover: 'linear-gradient(180deg, #ffe173 0%, #f7b52e 100%)',
  solid: '#f4b41c',
  ink: '#1a1206',
  border: 'rgba(120,84,6,0.55)',
  shadowWeb: '0 2px 10px rgba(224,150,20,0.38)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Standard border widths. hairline = default border/divider; thin = emphasized
// boxes (edit box, community card); thick = active tab underline.
export const borders = {
  hairline: 0.5,
  thin: 1,
  thick: 2,
} as const;

// Roboto type scale, tuned for X/Bluesky-grade feed readability. Roboto reads
// slightly larger than Geist, so display sizes are shaved 1-2px; body keeps 15px
// (X parity) with a tighter 22 line-height and neutral letter-spacing (Roboto is
// already optimally spaced — positive tracking hurt scan speed). Roboto has no
// SemiBold(600) in our set, so all emphasis/headings use Medium(500).
export const typography = {
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: 'Roboto-Medium',
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 27,
    lineHeight: 32,
    fontFamily: 'Roboto-Medium',
    letterSpacing: -0.4,
  },
  h2: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: 'Roboto-Medium',
    letterSpacing: -0.2,
  },
  h3: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: 'Roboto-Medium',
    letterSpacing: -0.1,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Roboto-Regular',
    letterSpacing: 0,
  },
  // TextInput variant of body: NO lineHeight. A lineHeight on an input makes
  // iOS bottom-align the text/placeholder inside the line box, so every field
  // (search, chat composer, forms) rendered its text a couple px low.
  input: {
    fontSize: 15,
    fontFamily: 'Roboto-Regular',
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Roboto-Medium',
    letterSpacing: 0,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Roboto-Regular',
    letterSpacing: 0,
  },
  label: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: 'Roboto-Medium',
    letterSpacing: 0,
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Roboto-Regular',
    letterSpacing: 0,
  },
} as const;

/**
 * Shadow tokens are theme-agnostic structurally; only the shadow color
 * is themed (always darken, never lighten). Components apply via:
 *   ...shadows.md(colors.shadow)
 */
export const shadows = {
  sm: (shadow: string) => ({
    shadowColor: shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
    elevation: 2,
  }),
  md: (shadow: string) => ({
    shadowColor: shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  }),
  lg: (shadow: string) => ({
    shadowColor: shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  }),
} as const;
