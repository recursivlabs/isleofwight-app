const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Sentry owns the serializer/debug-id layer used to symbolicate native release
// crashes. Web keeps PostHog for errors, so omit Sentry's web replay payload.
const config = getSentryExpoConfig(__dirname, { includeWebReplay: false });

// pnpm materialises patched packages through short-lived scratch directories —
// `node_modules/.pnpm_patches/<pkg>_tmp_<pid>/` and, inside the store,
// `<pkg>@<version>_patch_hash=…/node_modules/<pkg>_tmp_<pid>/`. Metro's file
// map enumerates them and then calls fs.watch() on paths pnpm has already
// deleted; the ENOENT is thrown uncaught and takes the whole dev server down
// with exit code 7. This repo patches react-native-track-player, so any install
// (including the deps check `pnpm run` does before the script) can trigger it.
// Excluding the scratch paths keeps them out of the crawl and the watch set.
const pnpmPatchScratch = [
  /node_modules[\\/]\.pnpm_patches[\\/].*/,
  /node_modules[\\/].*_tmp_\d+[\\/].*/,
];

const existing = config.resolver.blockList;
config.resolver.blockList = Array.isArray(existing)
  ? [...existing, ...pnpmPatchScratch]
  : existing
    ? [existing, ...pnpmPatchScratch]
    : pnpmPatchScratch;

module.exports = config;
