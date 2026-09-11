import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { View, Text } from 'react-native';

// THE DEFECT THIS PREVENTS:
// `{someString && <Text>{someString}</Text>}` looks like a presence guard, but
// when the string is '' the expression evaluates to '' — a bare text node
// handed straight to the parent <View>. On react-native-web that logs
// "Unexpected text node: . A text node cannot be a child of a <View>." in
// development; on NATIVE the same shape is the red-screen "Text strings must
// be rendered within a <Text> component" error, so a single record with an
// empty description/subdomain/reason field can take down the screen on the
// store builds (ladder rows P3/P3b). A number guard is worse still: `0 && x`
// renders a visible literal 0. #798 fixed one instance in app/admin.tsx; this
// suite demonstrates the class and pins every guard whose value comes off API
// data that can legitimately be the empty string. Booleans and object guards
// (`banned && …`, `stats && …`) are fine — only string/number guards leak.
// The fix is always the same one keystroke: `{x ? <…> : null}`.

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');

describe('the leak this all rests on (rendered through react-native-web)', () => {
  it("an empty-string guard leaks a text node into the View — the native crash shape", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const description = '' as string; // an API record with an empty field
    render(<View>{description && <Text>{description}</Text>}</View>);
    expect(
      spy.mock.calls.map((c) => String(c[0])).join('\n'),
    ).toContain('A text node cannot be a child of a <View>');
    spy.mockRestore();
  });

  it('the ternary form renders nothing and stays silent', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const description = '' as string;
    const { container } = render(<View>{description ? <Text>{description}</Text> : null}</View>);
    expect(container.textContent).toBe('');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// Every guard below reads a field an API record can hold as '' (an empty
// description, an unset subdomain, a blank moderation reason). Each assertion
// reads the REAL source file, so reverting any one of them to `&&` fails here.
const PINNED: Record<string, string[]> = {
  'app/(tabs)/create.tsx': ['communityDescription(c) ? <Text'],
  'app/protocols.tsx': ['r.protocol ? <Text'],
  'app/apps.tsx': ['detail.subdomain ? <Text', 'detail.description ? <Text', 'p.subdomain ? <Text'],
  'app/email.tsx': ['detail.from_email ? <Text'],
  'app/admin.tsx': ['appealedAction?.reason ? <Text'],
  'components/FeedSidebar.tsx': ['subtitle ? <Text', 'description ? <Text'],
  'app/community/[id].tsx': ['community.banner ? (', 'readableDescription ? ('],
  'app/jobs.tsx': ['j.status ? ('],
  'app/org-settings.tsx': ['orgSettings?.github_owner ? ('],
};

describe('string guards over API data render via ternary, never &&', () => {
  for (const [file, needles] of Object.entries(PINNED)) {
    it(`${file} keeps its ${needles.length} guard(s) in ternary form`, () => {
      const src = readFileSync(path.join(ROOT, file), 'utf8');
      for (const needle of needles) {
        expect(src, `${file} lost the ternary at "${needle}" — a && here leaks '' into a View`).toContain(needle);
        // The same expression must not ALSO appear in && form elsewhere in the
        // file (a copy-paste of the old pattern next to the fixed one).
        const guard = needle.replace(/ \? [<(]$/, '').replace(/ \? \($/, '');
        const bad = `{${guard} && <Text`;
        expect(src, `${file} reintroduced "${bad}"`).not.toContain(bad);
      }
    });
  }
});
