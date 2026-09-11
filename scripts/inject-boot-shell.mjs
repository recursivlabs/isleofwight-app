#!/usr/bin/env node
/**
 * Inject an instant boot shell into the exported web index.html.
 *
 * Why a post-export step: the app is exported with `web.output: "single"`, and
 * in single-page mode Expo Router does NOT use app/+html.tsx — it emits a stock
 * template. So the shell can't be added in React; we inject it into the built
 * dist/index.html here.
 *
 * The shell paints from the served HTML at TTFB (~70ms) so users see a branded
 * Minds screen immediately instead of a blank page while the ~1MB JS bundle
 * downloads + parses (measured FCP ~9s). The root layout removes it on first
 * paint (app/_layout.tsx → #minds-boot); a 20s failsafe below guarantees it can
 * never strand the app.
 *
 * Idempotent: re-running is a no-op if the shell is already present.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.env.EXPO_WEB_DIST || 'dist';
const file = join(dist, 'index.html');

if (!existsSync(file)) {
  console.error(`[boot-shell] ${file} not found — did 'expo export --platform web' run?`);
  process.exit(1);
}

// Ship the Minds bulb as an SVG favicon so the browser tab matches the in-app
// collapsed logo (both the bulb), like legacy Minds. Copied to a stable path at
// the web root (Expo's asset pipeline content-hashes assets, so we can't link
// those from static HTML). The <link> is injected below.
const bulbSrc = join('assets', 'bulb.svg');
if (existsSync(bulbSrc)) {
  copyFileSync(bulbSrc, join(dist, 'bulb.svg'));
  console.log(`[boot-shell] copied ${bulbSrc} -> ${join(dist, 'bulb.svg')}`);
} else {
  console.warn(`[boot-shell] ${bulbSrc} not found — favicon link will 404`);
}

// Cache headers (immutable hashed assets, no-cache index.html) are set by
// scripts/meta-server.mjs, which replaced `serve dist` (and its serve.json).

let html = readFileSync(file, 'utf8');

// Default share/SEO meta, wrapped in markers. scripts/meta-server.mjs swaps
// this block per URL at request time (post/profile/community cards); these
// defaults are what any URL without richer data — and any static hosting of
// dist/ without the meta server — unfurls with. Keep the values in sync with
// the DEFAULT_* constants in meta-server.mjs.
// minds.com serves LEGACY Minds until the cutover — default to the domain the
// new app answers on. At cutover set EXPO_PUBLIC_SITE_URL=https://www.minds.com.
const SITE_ORIGIN = (process.env.EXPO_PUBLIC_SITE_URL || 'https://isleofwight.on.minds.io').replace(/\/+$/, '');
const META_TITLE = 'Isle of Wight';
// Em dashes are allowed in the TITLE only, never in descriptions (brand rule).
const META_DESCRIPTION = 'Local news, events, groups and chat for the Isle of Wight.';
const META_BLOCK = `<!--minds-meta-->
    <title>${META_TITLE}</title>
    <meta name="description" content="${META_DESCRIPTION}" />
    <link rel="canonical" href="${SITE_ORIGIN}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Isle of Wight" />
    <meta property="og:title" content="${META_TITLE}" />
    <meta property="og:description" content="${META_DESCRIPTION}" />
    <meta property="og:url" content="${SITE_ORIGIN}" />
    <meta property="og:image" content="${SITE_ORIGIN}/og-default.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${META_TITLE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${META_TITLE}" />
    <meta name="twitter:description" content="${META_DESCRIPTION}" />
    <meta name="twitter:image" content="${SITE_ORIGIN}/og-default.png" />
    <meta name="theme-color" content="#010100" />
    <!--/minds-meta-->`;
if (!html.includes('<!--minds-meta-->')) {
  // The stock template's bare <title>Minds</title> is replaced by the block.
  html = html.replace(/<title>[\s\S]*?<\/title>/, '');
  html = html.replace('</head>', `${META_BLOCK}\n</head>`);
  writeFileSync(file, html);
  console.log('[boot-shell] injected default share meta block');
} else {
  console.log('[boot-shell] share meta block already present — skipping');
}

if (html.includes('id="minds-boot"')) {
  console.log('[boot-shell] already injected — skipping shell');
  process.exit(0);
}

const STYLE = `<style id="minds-boot-style">
/* Reserve the scrollbar gutter always, so the layout does not shift ~15px wide
   when the scrollbar appears/disappears as content loads — the "scrollbar tweaks
   and changes sizes" glitch. */
html{scrollbar-gutter:stable}
#minds-boot{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#010100;transition:opacity .35s ease;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
#minds-boot .mb-wm{color:#f2f2f4;font-size:30px;font-weight:600;letter-spacing:-.5px;margin-bottom:20px;opacity:.96;animation:mb-breathe 2.6s ease-in-out infinite}
/* A slim indeterminate bar, not a spinner. A spinning ring reads as "stuck";
   a travelling highlight reads as "arriving", and it sits still enough to feel
   calm on a fast connection where it only shows for a few frames. */
#minds-boot .mb-sp{position:relative;width:132px;height:2px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}
#minds-boot .mb-sp::after{content:'';position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:2px;background:#f2c94c;animation:mb-slide 1.5s cubic-bezier(.4,0,.2,1) infinite}
@keyframes mb-slide{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
@keyframes mb-breathe{0%,100%{opacity:.96}50%{opacity:.72}}
@media (prefers-color-scheme:light){#minds-boot{background:#fff}#minds-boot .mb-wm{color:#08080a}#minds-boot .mb-sp{background:rgba(0,0,0,.09)}#minds-boot .mb-sp::after{background:#c9962a}}
/* Motion-sensitive readers get a steady partial bar instead of movement. */
@media (prefers-reduced-motion:reduce){#minds-boot .mb-wm{animation:none}#minds-boot .mb-sp::after{animation:none;width:45%}}
</style>`;

const SHELL = `<div id="minds-boot" aria-hidden="true"><div class="mb-wm">Minds</div><div class="mb-sp"></div></div>`;

const FAILSAFE = `<script>setTimeout(function(){var b=document.getElementById('minds-boot');if(b){b.style.opacity='0';setTimeout(function(){b.parentNode&&b.parentNode.removeChild(b)},400)}},20000)</script>`;

// SVG favicon (the bulb) so the browser tab matches the in-app logo. We must
// STRIP Expo's generated `<link rel="icon" href="/favicon.ico">` first — with
// it present, browsers (esp. Safari) keep using the cached .ico and never pick
// up the SVG. Removing the competitor forces the bulb.
const FAVICON = `<link rel="icon" type="image/svg+xml" href="/bulb.svg"><link rel="shortcut icon" type="image/svg+xml" href="/bulb.svg"><link rel="apple-touch-icon" href="/bulb.svg">`;

// Inject: style before </head>, shell right after <body>, failsafe before </body>.
if (!html.includes('</head>') || !html.includes('<body>') || !html.includes('</body>')) {
  console.error('[boot-shell] unexpected index.html shape (missing head/body markers)');
  process.exit(1);
}
// Drop any Expo-emitted favicon/apple-touch links so only the bulb remains.
const beforeIcons = html;
html = html.replace(/<link[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>/gi, '');
console.log(`[boot-shell] stripped ${(beforeIcons.match(/<link[^>]*rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>/gi) || []).length} stock icon link(s)`);
html = html.replace('</head>', `${FAVICON}${STYLE}</head>`);
html = html.replace('<body>', `<body>${SHELL}`);
html = html.replace('</body>', `${FAILSAFE}</body>`);

writeFileSync(file, html);
console.log(`[boot-shell] injected into ${file}`);
