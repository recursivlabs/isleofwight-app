import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// THE DEFECT THIS PREVENTS:
// `<Link asChild>` from expo-router renders a Radix `Slot`. Slot merges its own
// props into the child's, with one special case for style (react-slot dist,
// mergeProps):
//
//     overrideProps.style = { ...slotPropValue, ...childPropValue }
//
// The idiomatic React Native Pressable style is a FUNCTION of press state:
//
//     style={({ hovered, pressed }) => ({ flexDirection: 'row', ... })}
//
// A function has no enumerable own properties, so spreading it into an object
// literal produces `{}`. The child receives `style={}` and EVERY rule is
// dropped — silently. No error, no warning, and the types still check, because
// a style function is perfectly valid on a Pressable; it is only invalid once
// something spreads it.
//
// React Native's default flexDirection is `column`, so a row written this way
// stacks. On the groups list the avatar, the text block and the chevron each
// took their own line: "groups has a weird arrow now on a 3rd line, instead of
// right justified on the row". Three other surfaces were broken the same way
// and nobody had noticed — billing's "View plans", the landing page's policy
// links, and the sidebar's upgrade button, which lost its entire pill.
//
// Use <LinkPressable> instead: it resolves the style to a plain object before
// the Slot ever sees it.

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const SCAN_DIRS = ['app', 'components'];
const SKIP_DIRS = new Set(['node_modules', '.expo', 'dist', 'build', '.claude']);

function tsxFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/**
 * Strip comments before scanning. Documentation quotes the very pattern this
 * test bans — including in LinkPressable.tsx, which explains the bug it exists
 * to fix — and a scanner that reads its own warning as a violation is useless.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Every `asChild` occurrence paired with the source that follows it, up to the
 * end of the child's opening tag.
 */
function asChildBlocks(src: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf('asChild', from);
    if (at === -1) break;
    // The child's opening tag is well inside this window; a style function on
    // it always appears before the tag closes.
    blocks.push(src.slice(at, at + 900));
    from = at + 'asChild'.length;
  }
  return blocks;
}

describe('Link asChild must not receive a function style', () => {
  const files = SCAN_DIRS.flatMap((d) => tsxFiles(path.join(ROOT, d)));

  it('finds source to scan (guards against a broken glob silently passing)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no <Link asChild> whose child carries style={( ... ) => ...}', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (!src.includes('asChild')) continue;

      for (const block of asChildBlocks(src)) {
        // A style prop opening with `(` is a function of press state. An object
        // literal (`style={{`) or a variable (`style={foo}`) merges correctly.
        if (/style=\{\s*\(/.test(block)) {
          offenders.push(path.relative(ROOT, file));
          break;
        }
      }
    }

    expect(
      offenders,
      `These pass a style FUNCTION to a Slot, which silently drops every rule. ` +
        `Use <LinkPressable> from components/LinkPressable.tsx instead: ` +
        offenders.join(', '),
    ).toEqual([]);
  });
});

describe('LinkPressable resolves the style before the Slot sees it', () => {
  const src = readFileSync(path.join(ROOT, 'components/LinkPressable.tsx'), 'utf8');

  it('calls the style function itself rather than forwarding it', () => {
    expect(src).toContain("typeof style === 'function' ? style({ hovered, pressed }) : style");
    expect(src).toContain('style={resolved}');
  });

  it('tracks the state the resolved style depends on', () => {
    for (const handler of ['onHoverIn', 'onHoverOut', 'onPressIn', 'onPressOut']) {
      expect(src, `${handler} is needed or the resolved style can never change`).toContain(handler);
    }
  });
});

describe('the merge behaviour this all rests on', () => {
  it('spreading a function into an object literal yields nothing', () => {
    const styleFn = ({ pressed }: { pressed: boolean }) => ({
      flexDirection: 'row' as const,
      opacity: pressed ? 0.5 : 1,
    });

    // Exactly what @radix-ui/react-slot does for the style prop. The casts are
    // the point: spreading a function is legal JS and silently yields {}, which
    // is precisely why TypeScript never caught this bug in the app code.
    const slotStyle = undefined as unknown as Record<string, unknown>;
    const merged = { ...slotStyle, ...(styleFn as unknown as Record<string, unknown>) };

    expect(merged).toEqual({});
    expect(merged.flexDirection).toBeUndefined();

    // ...whereas a plain object survives, which is what LinkPressable passes.
    const resolved = styleFn({ pressed: false });
    expect({ ...slotStyle, ...resolved }.flexDirection).toBe('row');
  });
});
