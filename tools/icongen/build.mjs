// Drives icongen to produce every icon size both apps need, each drawn
// natively at its own pixel dimensions. Nothing here is ever resampled.
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Where the compiled `icongen` lives, and a scratch dir for the spec files it
// reads. Both used to be hardcoded to one machine's scratchpad, which meant the
// tool only ran for whoever built it that afternoon. Override with ICONGEN_BIN
// when the binary sits elsewhere; see README for the swiftc line.
const BIN = process.env.ICONGEN_BIN || `${tmpdir()}/icongen/icongen`;
const HERE = `${tmpdir()}/icongen-specs`;
mkdirSync(HERE, { recursive: true });

// ---------------------------------------------------------------- Minds mark
// round glass, two-bar cap, solid glass with a line cap. 48-unit grid.
const M = {
  GLASS: "M24 4C16.54 4 10.5 10.04 10.5 17.5c0 4.8 2.5 9.02 6.29 11.45 1.06.68 1.71 1.85 1.71 3.11V32.5h11v-.44c0-1.26.65-2.43 1.71-3.11C34.99 26.52 37.5 22.3 37.5 17.5 37.5 10.04 31.46 4 24 4z",
  BAR:   "M19.9 35.5h8.2c.77 0 1.4.63 1.4 1.4v1.2c0 .77-.63 1.4-1.4 1.4h-8.2c-.77 0-1.4-.63-1.4-1.4v-1.2c0-.77.63-1.4 1.4-1.4z",
  TIP:   "M19.5 41.5h9v.9c0 1.7-1.4 3.1-3.1 3.1h-2.8c-1.7 0-3.1-1.4-3.1-3.1z",
  LN1:   "M19 37.5h10",
  LN2:   "M21 43h6",
};

// ------------------------------------------------------------- Recursiv mark
// Measured off the Euclid file (node 149:121) with sub-pixel alpha coverage.
// A binary tree: 1 -> 2 -> 4, each level a third of the width above it, equal
// gaps, overall 3:2. Normalised to a 1000-wide design space.
const R = (() => {
  const k = 1000 / 148.87;                       // measured width -> 1000
  const px = v => +(v * k).toFixed(2);
  return {
    W: 1000,
    H: px(99.28),
    L1: { x: 0, y: px(0.07), w: px(148.87), h: px(32.17) },
    L2: { y: px(44.18), w: px(49.52), h: px(24.64), xs: [px(0.07), px(99.42)] },
    L3: { y: px(80.77), w: px(16.40), h: px(18.58),
          xs: [px(0.07), px(33.18), px(99.42), px(132.53)] },
  };
})();

// The mark's share of the tile. 0.85 gave 21% ink — three times the visual mass
// of a reference icon that reads crisp, which is what made ours feel heavy and
// soft rather than any rasterisation problem. Walked down from there: 0.62 read
// Walked up and down this one. 0.85 was three times the mass of a reference
// icon that reads crisp. Then back the other way: 0.56 vanished on the home
// screen, and 0.59, 0.62 and 0.66 each still read small against the icons
// either side of it. 0.70 — ~14% ink, the mark at 59% of the tile — is where it
// stopped looking like it was avoiding its own edges. An app icon lives at 60pt
// next to neighbours that fill their tiles; margin that looks generous at 1024
// looks timid at 60.
function mindsSpec({ ground, ink, f = 0.70 }) {
  const canvas = 48 / f, off = (canvas - 48) / 2;
  return {
    canvas, background: ground, tx: off, ty: off,
    elements: [
      { type: 'path', d: M.GLASS, fill: ink },
      { type: 'path', d: M.LN1, stroke: ink, strokeWidth: 3, cap: 'round' },
      { type: 'path', d: M.LN2, stroke: ink, strokeWidth: 3, cap: 'round' },
    ],
  };
}

// 0.54 => ~11% ink, matching Minds.
function recursivSpec({ ground, ink, f = 0.54 }) {
  // fit the 3:2 mark inside a square canvas at `f` of the width
  const canvas = R.W / f;
  const tx = (canvas - R.W) / 2;
  const ty = (canvas - R.H) / 2;
  const el = [];
  el.push({ type: 'rrect', x: R.L1.x, y: R.L1.y, w: R.L1.w, h: R.L1.h, r: R.L1.h / 2, fill: ink });
  for (const x of R.L2.xs) el.push({ type: 'rrect', x, y: R.L2.y, w: R.L2.w, h: R.L2.h, r: R.L2.h / 2, fill: ink });
  for (const x of R.L3.xs) el.push({ type: 'rrect', x, y: R.L3.y, w: R.L3.w, h: R.L3.h, r: R.L3.w / 2, fill: ink });
  return { canvas, background: ground, tx, ty, elements: el };
}

// ------------------------------------------------------- Apple's required set
// iPhone + iPad + marketing. Every distinct pixel dimension iOS can ask for.
const IOS_SIZES = [20, 29, 40, 58, 60, 80, 87, 120, 152, 167, 180, 1024];

// AppIcon.appiconset manifest — one entry per idiom/size/scale Apple defines
const APPICONSET = [
  ['iphone', '20x20', '2x', 40], ['iphone', '20x20', '3x', 60],
  ['iphone', '29x29', '2x', 58], ['iphone', '29x29', '3x', 87],
  ['iphone', '40x40', '2x', 80], ['iphone', '40x40', '3x', 120],
  ['iphone', '60x60', '2x', 120], ['iphone', '60x60', '3x', 180],
  ['ipad', '20x20', '1x', 20], ['ipad', '20x20', '2x', 40],
  ['ipad', '29x29', '1x', 29], ['ipad', '29x29', '2x', 58],
  ['ipad', '40x40', '1x', 40], ['ipad', '40x40', '2x', 80],
  ['ipad', '76x76', '2x', 152], ['ipad', '83.5x83.5', '2x', 167],
  ['ios-marketing', '1024x1024', '1x', 1024],
];

function run(spec, outDir, name, opaque, sizes) {
  const f = `${HERE}/_spec.json`;
  writeFileSync(f, JSON.stringify(spec));
  mkdirSync(outDir, { recursive: true });
  execFileSync(BIN, [f, outDir, name, opaque ? '1' : '0', ...sizes.map(String)], { stdio: 'pipe' });
}

function appiconset(spec, dir, variants) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  run(spec, dir, 'Icon', true, IOS_SIZES);
  // Several entries share one pixel file — 120 serves both iPhone 40@3x and
  // 60@2x — so the manifest points multiple entries at the same filename.
  const images = APPICONSET.map(([idiom, size, scale, px]) =>
    ({ size, idiom, filename: `Icon-${px}.png`, scale }));

  // The light 1024 restated in the modern form, so the three appearances are
  // siblings in one group rather than a legacy entry plus two orphans.
  if (variants) {
    images.push({
      size: '1024x1024', idiom: 'universal', platform: 'ios',
      filename: 'Icon-1024.png',
    });
  }

  // iOS 18 dark + tinted appearances.
  //
  // Without these, iOS does NOT leave the icon alone for anyone who has Home
  // Screen icons set to Dark (or Automatic on a dark phone) — it DIMS the
  // light artwork, which turned Minds gold into a muddy olive. Supplying the
  // variants replaces a guess with a drawing.
  //
  // Apple wants these WITHOUT a background: the system composites its own
  // backdrop and, for tinted, applies the user's colour to a greyscale mark.
  // So both are the mark alone on transparency — hence opaque=false, and only
  // at 1024, which is the single size iOS 18 asks for per appearance.
  if (variants) {
    for (const [name, vspec] of Object.entries(variants)) {
      run(vspec, dir, `Icon-${name}`, false, [1024]);
      // `platform: 'ios'` is not decorative. Without it the entry does not
      // match on device: iOS ignored the variant and fell back to the light
      // artwork. Apple's iOS 18 single-size form is universal + platform, and
      // NO scale key — a scale is what marks an entry as the legacy shape.
      images.push({
        size: '1024x1024',
        idiom: 'universal',
        platform: 'ios',
        filename: `Icon-${name}-1024.png`,
        appearances: [{ appearance: 'luminosity', value: name }],
      });
    }
  }

  writeFileSync(`${dir}/Contents.json`, JSON.stringify(
    { images, info: { version: 1, author: 'xcode' } }, null, 2));
  return images.length;
}

// ------------------------------------------------------------------- outputs
const MINDS_GROUND = '#F5B800', MINDS_INK = '#000000';
const REC_GROUND = '#F4F2EC', REC_INK = '#0D1210';

const OUT = process.env.ICON_OUT || '/Users/jackottman/Desktop/minds-recursiv-icons';
rmSync(OUT, { recursive: true, force: true });

// --- Minds
const mSpec = mindsSpec({ ground: MINDS_GROUND, ink: MINDS_INK });
// dark: the gold mark on the system's dark backdrop — the brand colour survives
// instead of being dimmed out of it. tinted: iOS tints a GREYSCALE mark, so this
// one is drawn white and the system decides the hue.
const mVariants = {
  dark:   mindsSpec({ ground: null, ink: MINDS_GROUND }),
  tinted: mindsSpec({ ground: null, ink: '#ffffff' }),
};
console.log('minds appiconset  ', appiconset(mSpec, `${OUT}/minds/AppIcon.appiconset`, mVariants), 'entries');
run(mSpec, `${OUT}/minds/web`, 'favicon', true, [16, 32, 48, 64, 180, 192, 512]);
// Android's foreground sits inside a mask that crops to a circle, so it tracks
// a little under the iOS figure and stays well within the guaranteed 72dp.
run({ ...mindsSpec({ ground: null, ink: MINDS_INK, f: 0.63 }) },
    `${OUT}/minds/android`, 'foreground', false, [108, 162, 216, 324, 432]);
// The splash mark is a DIFFERENT problem from the app icon: it sits alone on a
// full screen at 200pt, not in a 60pt tile competing with whatever the user
// keeps next to it. It doesn't need to grow just because the icon did.
run(mindsSpec({ ground: null, ink: '#FFC629', f: 0.62 }),
    `${OUT}/minds/splash`, 'splash', false, [512, 1024]);

// --- Recursiv
const rSpec = recursivSpec({ ground: REC_GROUND, ink: REC_INK });
console.log('recursiv appiconset', appiconset(rSpec, `${OUT}/recursiv/AppIcon.appiconset`), 'entries');
run(rSpec, `${OUT}/recursiv/web`, 'favicon', true, [16, 32, 48, 64, 180, 192, 512]);
run(recursivSpec({ ground: null, ink: REC_INK, f: 0.47 }),
    `${OUT}/recursiv/android`, 'foreground', false, [108, 162, 216, 324, 432]);
// inverse, for comparison
run(recursivSpec({ ground: REC_INK, ink: REC_GROUND }),
    `${OUT}/recursiv/inverse`, 'icon', true, [1024, 180, 120, 60]);

console.log(`\nrecursiv mark ${R.W} x ${R.H}  (aspect ${(R.W / R.H).toFixed(4)})`);
console.log(`wrote ${OUT}`);
