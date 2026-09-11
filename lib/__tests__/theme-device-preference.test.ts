import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// THE BUG THIS PINS
// Reading in dark and opening Settings flipped you to light.
//
// Settings loads the account's stored preferences and used to apply the theme
// it found:
//
//     if (appearanceData?.theme && appearanceData.theme !== themeMode) {
//       setThemeMode(appearanceData.theme);
//     }
//
// The default mode is 'system'. Someone on a dark device with mode 'system'
// SEES dark, but their mode is not 'dark' — it is 'system'. With the account
// holding 'light' (a default, or a value set once long ago), the comparison
// 'light' !== 'system' was true, so the screen "corrected" them to explicit
// light. Every visit, on the device they were actively reading on.
//
// The rule now: the device the reader is holding wins. The account theme is for
// a device that has never been told what to do. `hasDevicePreference` is what
// makes that expressible, because the mode alone cannot distinguish "the reader
// chose system" from "nothing has ever been chosen here".

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const themeSrc = readFileSync(path.join(root, 'lib/theme.tsx'), 'utf8');
const settingsSrc = readFileSync(path.join(root, 'app/settings.tsx'), 'utf8');

describe('theme store exposes whether this device has a choice', () => {
  it('starts false, because system is a default as well as a choice', () => {
    expect(themeSrc).toContain('const [hasDevicePreference, setHasDevicePreference] = React.useState(false);');
  });

  it('becomes true when a stored mode is hydrated', () => {
    const hydrate = themeSrc.slice(themeSrc.indexOf('Hydrate user-selected mode'));
    const guard = hydrate.indexOf("saved === 'system'");
    const flag = hydrate.indexOf('setHasDevicePreference(true)');
    expect(guard).toBeGreaterThan(-1);
    expect(flag, 'must be set inside the hydration guard').toBeGreaterThan(guard);
  });

  it('becomes true when the reader picks a mode', () => {
    const setMode = themeSrc.slice(themeSrc.indexOf('const setMode = React.useCallback'));
    expect(setMode.slice(0, 220)).toContain('setHasDevicePreference(true)');
  });

  it('is published on the context and its default is false', () => {
    expect(themeSrc).toContain('hasDevicePreference: boolean;');
    expect(themeSrc).toContain('hasDevicePreference: false,');
  });
});

describe('settings never overrules the device it is running on', () => {
  const block = settingsSrc.slice(
    settingsSrc.indexOf('const serverTheme'),
    settingsSrc.indexOf('const serverTheme') + 700,
  );

  it('adopts the account theme ONLY when this device has no preference', () => {
    expect(block).toContain('if (!hasDevicePreferenceRef.current)');
    const adopt = block.indexOf('setThemeMode(serverTheme)');
    const guard = block.indexOf('if (!hasDevicePreferenceRef.current)');
    expect(adopt, 'the adopt must sit inside the no-preference guard').toBeGreaterThan(guard);
  });

  it('never compares the account theme against the mode to decide whether to apply it', () => {
    // The original defect in one line. 'system' is not 'light', so this always
    // fired for a system-dark reader.
    expect(settingsSrc).not.toContain('appearanceData.theme !== themeMode');
  });

  it('teaches the account instead, when the device disagrees', () => {
    expect(block).toContain('updateAppearance({ theme: localMode }');
  });

  it('reads the mode through a ref, since load is not rebuilt when the theme changes', () => {
    expect(settingsSrc).toContain('themeModeRef.current = themeMode;');
    expect(block).toContain('themeModeRef.current');
  });
});
