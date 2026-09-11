const fs = require('fs');
const path = require('path');
const { withDangerousMod, withInfoPlist } = require('expo/config-plugins');

/**
 * Installs a complete AppIcon.appiconset after prebuild.
 *
 * Expo's `ios.icon` writes a single-size asset catalogue holding only the 1024
 * master, which leaves iOS to scale at display time. On an @3x device the home
 * screen wants 180px; with nothing at that size it resamples, and the result is
 * visibly soft — a 2px edge transition with ringing instead of 1px.
 *
 * The set in assets/AppIcon.appiconset is rendered by tools/icongen, one native
 * draw per size via Core Graphics, so nothing is ever resampled.
 */
const withAppIconSet = (config, { source = 'assets/AppIcon.appiconset' } = {}) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, source);
      if (!fs.existsSync(src)) {
        throw new Error(`withAppIconSet: ${source} not found — run tools/icongen first`);
      }

      const dest = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName,
        'Images.xcassets',
        'AppIcon.appiconset'
      );

      fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(dest, { recursive: true });
      for (const file of fs.readdirSync(src)) {
        fs.copyFileSync(path.join(src, file), path.join(dest, file));
      }

      const n = fs.readdirSync(dest).filter((f) => f.endsWith('.png')).length;
      console.log(`withAppIconSet: installed ${n} natively-rendered icons`);
      return cfg;
    },
  ]);

module.exports = withAppIconSet;
