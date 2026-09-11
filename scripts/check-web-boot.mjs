#!/usr/bin/env node
/**
 * Boot smoke for the exported web bundle. #193.
 *
 * WHY THIS EXISTS: commit 70d19f1 shipped a bundle whose expo runtime never
 * registered — `globalThis.expo.EventEmitter` was undefined — and the site was
 * down. Every check in CI was green, because nothing anywhere EXECUTED the
 * thing we ship. Lint, typecheck and unit tests all run against source; the
 * build step only asserted that `expo export` exited 0.
 *
 * #193 names this specific assertion as the one that would have caught it.
 *
 * This runs the real boot scripts in HTML order in jsdom and asserts the
 * runtime installed itself. A single-bundle export has one script; Expo
 * Router async routes emit a runtime, common chunk, and current-route chunk.
 * jsdom is NOT a browser and the bundle logs plenty of errors inside it
 * (missing visual APIs, React failing to mount) — that is expected and is not
 * what is being checked. What is being checked is that evaluating the boot
 * scripts install the expo runtime, which is exactly the invariant that broke.
 *
 * Deliberately NOT a grep for an identifier in minified output: names minify
 * away, and a grep that silently matches nothing reports success forever.
 *
 * Exit 0 = the invariant holds. Exit 1 = it does not, or there is no build.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync, existsSync } from 'node:fs';

const DIR = 'dist/_expo/static/js/web';

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exit(1);
}

if (!existsSync(DIR)) {
  fail(`no exported bundle at ${DIR} — run \`expo export --platform web\` first`);
}

// Metro can emit lazy chunks whose package entrypoint is also named index.js.
// Picking an index-* file from an unordered directory listing can execute an
// arbitrary route chunk without the Metro runtime and common chunk that precede
// it. Read every shipped boot script from HTML and preserve document order.
const htmlPath = 'dist/index.html';
if (!existsSync(htmlPath)) fail(`no exported HTML at ${htmlPath}`);
const html = readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(
  /<script[^>]+src=["']\/?_expo\/static\/js\/web\/([^/"']+\.js)["']/gi,
)].map((match) => match[1]);
if (scripts.length === 0) fail(`no web boot scripts referenced by ${htmlPath}`);

const chunks = scripts.map((script) => ({
  script,
  code: readFileSync(`${DIR}/${script}`, 'utf8'),
}));
const rawBytes = chunks.reduce((total, chunk) => total + chunk.code.length, 0);
console.log(
  `boot scripts: ${scripts.length} (${(rawBytes / 1024 / 1024).toFixed(2)} MB raw)\n` +
    scripts.map((script) => `  - ${script}`).join('\n'),
);

// Swallow the bundle's own console noise. A real browser is not being
// simulated here and its complaints are not the signal.
const virtualConsole = new VirtualConsole();
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  runScripts: 'outside-only',
  url: 'https://build.minds.com/',
  pretendToBeVisual: true,
  virtualConsole,
});

try {
  for (const chunk of chunks) {
    dom.window.eval(chunk.code);
  }
} catch (err) {
  // A top-level throw means the bundle did not finish evaluating, which is a
  // strictly worse version of the failure this guards against.
  fail(`a boot script threw while evaluating: ${String(err).slice(0, 400)}`);
}

const expo = dom.window.expo;
if (typeof expo !== 'object' || expo === null) {
  fail(
    'globalThis.expo is not an object after evaluating the boot scripts — ' +
      'the expo runtime did not register. This is the 70d19f1 outage.',
  );
}
if (typeof expo.EventEmitter !== 'function') {
  fail(
    'globalThis.expo.EventEmitter is not a function — the expo runtime ' +
      'registered incompletely. This is the 70d19f1 outage.',
  );
}

console.log('PASS  globalThis.expo.EventEmitter is defined — the expo runtime registered');
