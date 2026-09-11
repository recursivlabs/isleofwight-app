// Test hygiene gate.
//
// Scans the test suites for two rot patterns:
//   1. `.only(` — a focused test silently disables the rest of the file's
//      suite in CI. Always a mistake to commit. Always fails.
//   2. `.skip(` — allowed ONLY with an expiry note on the same or the
//      preceding line: `quarantine-until: YYYY-MM-DD`. A skip without a date
//      fails; a skip whose date has passed fails. Skips must not be forever.
//
// Wired as a step in the CI `check` job. Exit 0 = clean, exit 1 = violations.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

/** Recursively collect files under dir whose name passes the filter. */
function collect(dir, filter, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === 'node_modules') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, filter, out);
    else if (filter(name)) out.push(full);
  }
  return out;
}

const files = [
  ...collect(join(ROOT, 'e2e'), (n) => n.endsWith('.spec.ts')),
  ...collect(join(ROOT, 'lib'), (n) => n.endsWith('.test.ts') || n.endsWith('.test.tsx')),
  ...collect(join(ROOT, 'test'), (n) => n.endsWith('.test.ts') || n.endsWith('.test.tsx')),
];

const ONLY = /\.only\s*\(/;
const SKIP = /\.skip\s*\((.*)/;
const QUARANTINE = /quarantine-until:\s*(\d{4}-\d{2}-\d{2})/;

// A STATIC skip hides a test forever: first argument is a test name string
// (or a literal `true`). A CONDITIONAL skip is a runtime guard —
// `test.skip(!hasContent, 'reason')` — and is legitimate Playwright
// practice, so it needs no quarantine date.
const isStaticSkip = (args) => {
  const first = args.trimStart();
  return /^['"`]/.test(first) || /^true\s*[,)]/.test(first) || first === '' || first === ')';
};

const today = new Date().toISOString().slice(0, 10);
const violations = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  const rel = file.slice(ROOT.length);
  lines.forEach((line, i) => {
    if (ONLY.test(line)) {
      violations.push(`${rel}:${i + 1} — .only( committed; it disables the rest of the suite`);
    }
    const skip = line.match(SKIP);
    if (skip && isStaticSkip(skip[1])) {
      const note = line.match(QUARANTINE) || (i > 0 && lines[i - 1].match(QUARANTINE));
      if (!note) {
        violations.push(
          `${rel}:${i + 1} — .skip( without a "quarantine-until: YYYY-MM-DD" comment on the same or preceding line`,
        );
      } else if (note[1] < today) {
        violations.push(
          `${rel}:${i + 1} — quarantine expired on ${note[1]}; fix the test or renew the date deliberately`,
        );
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`Test hygiene check FAILED (${violations.length} violation${violations.length === 1 ? '' : 's'}):`);
  for (const v of violations) console.error(`  ✗ ${v}`);
  process.exit(1);
}
console.log(`Test hygiene check passed (${files.length} files scanned).`);
