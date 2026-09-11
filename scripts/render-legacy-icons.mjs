// Render the legacy Minds bulb into every app-icon asset. Run: node scripts/render-legacy-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const A = (p) => join(ROOT, 'assets', p);

const BG = '#010100'; // legacy Minds near-black
// Pull the bulb's inner markup (the translates inside cancel, so it sits at 0..62 / 0..75).
const bulbSvg = readFileSync(A('bulb.svg'), 'utf8');
const inner = bulbSvg.replace(/[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/g, '');
const BULB_W = 62, BULB_H = 75;

// Compose a square canvas: bg + centered bulb scaled to `fill` fraction of the canvas height.
function canvas(size, { bg = BG, fill = 0.58, transparent = false } = {}) {
  const s = (size * fill) / BULB_H;
  const w = BULB_W * s, h = BULB_H * s;
  const x = (size - w) / 2, y = (size - h) / 2;
  const bgRect = transparent ? '' : `<rect width="${size}" height="${size}" fill="${bg}"/>`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${bgRect}<g transform="translate(${x},${y}) scale(${s})">${inner}</g></svg>`;
}

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: 'rgba(0,0,0,0)' }).render().asPng();
}

// 1. Main app icon (1024, opaque dark bg).
writeFileSync(A('icon.png'), png(canvas(1024), 1024));
// 2. Android adaptive foreground — bulb on TRANSPARENT, smaller for the safe area; bg is set in app.json.
writeFileSync(A('icon-adaptive.png'), png(canvas(1024, { transparent: true, fill: 0.44 }), 1024));
// 3. Favicon (crisp bulb on dark).
writeFileSync(A('favicon.png'), png(canvas(256), 256));
console.log('wrote icon.png (1024), icon-adaptive.png, favicon.png');

// 4. iOS AppIcon.appiconset — re-render each declared size from the vector.
const setDir = A('AppIcon.appiconset');
if (existsSync(join(setDir, 'Contents.json'))) {
  const contents = JSON.parse(readFileSync(join(setDir, 'Contents.json'), 'utf8'));
  const done = new Set();
  for (const img of contents.images || []) {
    if (!img.filename || done.has(img.filename)) continue;
    const m = /Icon-(\d+)(?:@|\.)/.exec(img.filename) || /Icon-(\d+)/.exec(img.filename);
    const px = m ? Number(m[1]) : null;
    if (!px) continue;
    writeFileSync(join(setDir, img.filename), png(canvas(px), px));
    done.add(img.filename);
  }
  console.log(`wrote ${done.size} AppIcon.appiconset sizes`);
}
