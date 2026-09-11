// Release-readiness gate for the open-source flip.
//
// This repo is headed for public visibility under hostile review. The gate
// scans every git-tracked file for the tells that review will lead with, and
// fails CI when a NEW one lands. Known offenders that cannot be removed yet
// (the live launch-loop machinery, pre-existing handoff docs) are pinned in
// release-readiness-baseline.json; the baseline may only shrink. Deleting a
// listed file without pruning the baseline also fails, so the list cannot rot.
//
// Checks:
//   1. Banned filename fragments (handoff, prompt, goal-prompt, note-to,
//      final-test, world-class) anywhere in a tracked path.
//   2. Agent-authorship strings in tracked text files (Co-Authored-By,
//      "as an AI"). Comments referencing Claude as a PRODUCT (model ids,
//      UI comparisons) are legitimate and not matched.
//   3. Emoji in source files. The count is zero today and stays zero.
//   4. Bare TODO/FIXME in source — allowed only with a ticket marker in
//      e.g. TODO(dispatcher:50rxflwv), TODO(#123), or TODO EXT-P4-07:.
//   5. Tracked .env* files (.env.example is fine).
//   6. Tracked files inside gitignored directories (the tmp/ class: rule
//      added after the files, git keeps tracking them).
//
// Exit 0 = clean, exit 1 = violations. Run: node scripts/check-release-readiness.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// RELEASE_READINESS_ROOT exists for the test harness, which points the gate
// at fixture repos; CI and humans run it against this checkout.
const ROOT = process.env.RELEASE_READINESS_ROOT ?? new URL('..', import.meta.url).pathname;
const baseline = JSON.parse(readFileSync(`${ROOT}/scripts/release-readiness-baseline.json`, 'utf8'));

// The gate exempts itself: its documentation and test fixtures must spell out
// the very strings it hunts, so scanning them can only ever self-flag.
const SELF = /^scripts\/(check-)?release-readiness/;
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .filter((f) => !SELF.test(f));

const violations = [];
const baselined = new Set();
function flag(check, file, detail) {
  const allowed = baseline[check] ?? [];
  if (allowed.includes(file)) {
    baselined.add(`${check}\x00${file}`);
    return;
  }
  violations.push(`[${check}] ${file}${detail ? ` — ${detail}` : ''}`);
}

// 1. Banned filename fragments. "prompt" is only banned in markdown names:
// prompt-shaped DOCS are session residue, while a prompts.ts module is a
// legitimate way to ship an agent's instructions as source.
const BANNED_NAME = /handoff|note-to|final-test|world-class/i;
const BANNED_MD_NAME = /prompt/i;
for (const file of tracked) {
  if (BANNED_NAME.test(file)) flag('banned-filename', file);
  else if (file.endsWith('.md') && BANNED_MD_NAME.test(file)) flag('banned-filename', file);
}

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|md|mdx|json|yml|yaml|sh|py|txt)$/;
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
// Emoji and pictographs; excludes the arrows/box-drawing that legit CLIs print.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const AGENT_STRINGS = /Co-Authored-By:|\bas an AI\b/i;
const BARE_TODO = /(?:\/\/|#|\*)\s*(?:TODO|FIXME)(?!\(|:?\s+[A-Z][A-Z0-9]+-[A-Z0-9-]*\d)/;

for (const file of tracked) {
  if (!TEXT_EXT.test(file)) continue;
  let content;
  try {
    content = readFileSync(`${ROOT}/${file}`, 'utf8');
  } catch {
    continue; // deleted in working tree; git still lists it until commit
  }

  // 2. Agent-authorship strings.
  if (AGENT_STRINGS.test(content)) {
    const line = content.split('\n').findIndex((l) => AGENT_STRINGS.test(l)) + 1;
    flag('agent-string', file, `line ${line}`);
  }

  if (SOURCE_EXT.test(file)) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 3. Emoji in COMMENTS. Emoji in string literals is product surface
      // (reactions, UI copy) and stays legal; emoji decorating a comment is
      // the tell this gate exists for.
      const slash = line.indexOf('//');
      const commentPart =
        slash >= 0 ? line.slice(slash) : /^\s*\*/.test(line) ? line : '';
      if (commentPart && EMOJI.test(commentPart)) {
        flag('emoji-in-comment', file, `line ${i + 1}: ${line.trim()}`);
      }
      // 4. Unticketed TODO/FIXME.
      if (BARE_TODO.test(line)) flag('bare-todo', file, `line ${i + 1}: ${line.trim()}`);
    }
  }
}

// 5. Tracked .env* files.
for (const file of tracked) {
  const base = file.split('/').pop();
  if (base.startsWith('.env') && base !== '.env.example') flag('tracked-env', file);
}

// 6. Tracked files that the current ignore rules would exclude.
if (tracked.length > 0) {
  const input = tracked.join('\0');
  let ignoredOut = '';
  try {
    ignoredOut = execFileSync('git', ['check-ignore', '--no-index', '-z', '--stdin'], {
      cwd: ROOT,
      input,
      maxBuffer: 64 * 1024 * 1024,
    }).toString('utf8');
  } catch (err) {
    // check-ignore exits 1 when NOTHING matches; that is the good case.
    if (err.status !== 1) throw err;
  }
  for (const file of ignoredOut.split('\0').filter(Boolean)) {
    flag('tracked-but-ignored', file);
  }
}

// The baseline may only shrink: an entry for a file that no longer trips its
// check is stale and must be pruned in the same commit.
for (const [check, files] of Object.entries(baseline)) {
  for (const file of files) {
    if (!baselined.has(`${check}\x00${file}`)) {
      violations.push(`[stale-baseline] ${check}: ${file} no longer trips this check — remove it from release-readiness-baseline.json`);
    }
  }
}

if (violations.length > 0) {
  console.error('release-readiness: the tree is not flip-ready.\n');
  for (const v of violations.sort()) console.error(`  ${v}`);
  console.error(`\n${violations.length} violation(s). Fix them or, for a pre-existing offender that cannot move yet, add it to scripts/release-readiness-baseline.json with a review.`);
  process.exit(1);
}
console.log(`release-readiness: clean (${tracked.length} tracked files, ${baselined.size} baselined offender(s) remaining).`);
