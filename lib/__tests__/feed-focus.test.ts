import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// #192 — returning to the feed from a post discarded every loaded page and the
// scroll position, because focus triggered `refresh()` = `fetchPosts(true, true)`:
// offset reset to 0, unconditional `setPosts(data)` and `setCache`. On For You
// the list also came back re-ranked, so the post just read could be unfindable.
//
// app/(tabs)/index.tsx is outside the vitest globs, so this reads the source.
// That is weaker than driving the screen and is stated plainly in the PR — but
// the regression it guards is a single call reappearing in a single callback,
// which is exactly the shape source-reading can catch.

const SRC = readFileSync(join(__dirname, '../../app/(tabs)/index.tsx'), 'utf8');

/** The useFocusEffect callback body, with comments removed. */
function focusEffectCode(): string {
  const start = SRC.indexOf('useFocusEffect(');
  if (start === -1) return '';
  // Bounded by the closing `);` of the useFocusEffect call.
  const end = SRC.indexOf('\n  );', start);
  const block = end === -1 ? SRC.slice(start, start + 800) : SRC.slice(start, end);
  // Comments must go FIRST. The comment above this call explains the bug and
  // names `refresh()` in prose — asserting against un-stripped source would
  // check that the explanation exists, not that the call is gone. Two guards
  // earlier today passed against an identifier sitting in a comment or an
  // import line, so this is now the default.
  return block.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('feed focus does not discard loaded pages', () => {
  it('finds the focus effect at all', () => {
    // Positive control: if the block is not located, every assertion below
    // passes vacuously against an empty string and this file is decoration.
    const code = focusEffectCode();
    expect(code).toContain('useFocusEffect');
    expect(code.length).toBeGreaterThan(60);
  });

  it('does not refetch the feed on focus', () => {
    // The defect itself. `refresh()` here replaces posts AND the cache.
    expect(focusEffectCode()).not.toMatch(/\brefresh\s*\(/);
  });

  // The "Show new posts" / feed-stale pill was removed (it didn't work reliably
  // on For You / Following). Its three assertions were dropped with it.
});
