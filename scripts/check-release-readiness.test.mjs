import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const SCRIPT = new URL('./check-release-readiness.mjs', import.meta.url).pathname;

// The gate reads `git ls-files`, so each fixture is a real throwaway repo.
function fixture(files, baseline = {}) {
  const root = mkdtempSync(join(tmpdir(), 'release-readiness-'));
  mkdirSync(join(root, 'scripts'), { recursive: true });
  writeFileSync(join(root, 'scripts/release-readiness-baseline.json'), JSON.stringify(baseline));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  const git = (...args) =>
    execFileSync('git', args, {
      cwd: root,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@t',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@t',
      },
    });
  git('init', '-q');
  // -f so a fixture can commit a file its own .gitignore excludes — the
  // tracked-but-ignored scenario is exactly what one test needs to build.
  git('add', '-A', '-f');
  git('commit', '-q', '-m', 'fixture');
  return root;
}

function run(root) {
  try {
    const stdout = execFileSync('node', [SCRIPT], {
      env: { ...process.env, RELEASE_READINESS_ROOT: root },
    }).toString();
    return { code: 0, output: stdout };
  } catch (err) {
    return { code: err.status, output: `${err.stdout}${err.stderr}` };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('a clean tree passes', () => {
  const { code, output } = run(fixture({ 'lib/a.ts': 'export const a = 1;\n' }));
  assert.equal(code, 0);
  assert.match(output, /clean/);
});

test('a handoff doc fails, and baselining it passes', () => {
  const files = { 'HANDOFF-notes.md': '# notes\n' };
  const fail = run(fixture(files));
  assert.equal(fail.code, 1);
  assert.match(fail.output, /\[banned-filename\] HANDOFF-notes\.md/);

  const pass = run(fixture(files, { 'banned-filename': ['HANDOFF-notes.md'] }));
  assert.equal(pass.code, 0);
});

test('a prompt-named markdown fails; a prompts.ts module does not', () => {
  const fail = run(fixture({ 'docs/goal-prompt.md': 'x\n' }));
  assert.match(fail.output, /\[banned-filename\] docs\/goal-prompt\.md/);

  const pass = run(fixture({ 'lib/curator/prompts.ts': 'export const p = 1;\n' }));
  assert.equal(pass.code, 0);
});

test('a stale baseline entry fails so the list can only shrink', () => {
  const { code, output } = run(
    fixture({ 'lib/a.ts': 'export const a = 1;\n' }, { 'banned-filename': ['HANDOFF-gone.md'] }),
  );
  assert.equal(code, 1);
  assert.match(output, /\[stale-baseline\]/);
});

test('a bare TODO fails; a ticketed one passes; emoji only fails in comments', () => {
  const fail = run(
    fixture({ 'lib/a.ts': '// TODO: later\nconst x = 1; // nice ✨\nexport default x;\n' }),
  );
  assert.equal(fail.code, 1);
  assert.match(fail.output, /\[bare-todo\] lib\/a\.ts — line 1/);
  assert.match(fail.output, /\[emoji-in-comment\] lib\/a\.ts — line 2/);

  const pass = run(
    fixture({ 'lib/a.ts': "// TODO(#12): later\nexport const heart = '❤️';\n" }),
  );
  assert.equal(pass.code, 0);
});

test('tracked env files and ignored-but-tracked files fail', () => {
  const { code, output } = run(
    fixture({ '.env.staging': 'A=1\n', '.gitignore': 'generated/\n', 'generated/x.txt': 'x\n' }),
  );
  assert.equal(code, 1);
  assert.match(output, /\[tracked-env\] \.env\.staging/);
  assert.match(output, /\[tracked-but-ignored\] generated\/x\.txt/);
});

test('the gate script itself is plain text — git must never classify it binary', () => {
  // The baseline-key separator must be the ESCAPE SEQUENCE \x00, not a literal
  // NUL byte: one literal control byte makes git treat the whole gate as a
  // binary blob, and a review gate whose own diffs are invisible to review
  // cannot do its job. readFileSync without an encoding returns raw bytes.
  const bytes = readFileSync(SCRIPT);
  assert.ok(bytes.length > 0);
  const control = [...bytes].filter((b) => b < 0x09 || (b > 0x0d && b < 0x20));
  assert.deepEqual(control, [], 'gate script contains raw control bytes');
  // Positive control: the separator is still there, spelled as an escape.
  assert.match(bytes.toString('utf8'), /\$\{check\}\\x00\$\{file\}/);
});
