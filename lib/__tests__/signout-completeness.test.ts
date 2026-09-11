import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// WHY A SOURCE-READING TEST:
//
// Several modules cache user state that must be dropped on sign-out. Each has
// its own test proving its clear() works. NOTHING asserted that sign-out
// actually CALLS them — and that seam is where a real bug hid for a full day:
// #304 shipped a drafts clear that removed the key `'drafts'` while the module
// writes `'minds:drafts:v2'`. Every individual test passed the whole time.
//
// AuthProvider itself is out of reach — vitest covers lib/** with react-native
// stubbed, and clearStorage is not exported — so this checks the WIRING: every
// module that persists user state has one of its clear functions called by
// lib/auth.tsx. Weaker than "sign-out clears everything", and it is the claim
// that would have caught the bug that got through.
//
// The first version of this test was too naive and produced two FALSE
// POSITIVES, both recorded here because they define the boundaries:
//   · `clearAll` is imported as `clearCacheAll` — aliases must be resolved.
//   · `clearDraft` (singular) discards the current draft after POSTING; it is
//     not a sign-out concern. Not every clear* is one.

const LIB = join(__dirname, '..');
const AUTH = readFileSync(join(LIB, 'auth.tsx'), 'utf8');

// Screens and components persist keys too — `minds:profileNudge:dismissed` and
// `minds:feed:lastVisitAt` are written from app/(tabs)/index.tsx, not from any
// lib module. The key-accounting test used to scan lib/ alone, so a key
// persisted from app/ or components/ bypassed the exact guard built after #304.
// The wiring test below stays scoped to lib/ deliberately: state modules live
// there by convention, and a screen with a local `let` is not a cache module.
const KEY_SCAN_ROOTS = [LIB, join(LIB, '..', 'app'), join(LIB, '..', 'components')];

/** Every name auth.tsx can call, with `import { x as y }` resolved to x. */
function importedOriginalNames(): Set<string> {
  const names = new Set<string>();
  for (const imp of AUTH.matchAll(/import\s*\{([^}]+)\}\s*from\s*'\.\/[^']+'/g)) {
    for (const part of imp[1].split(',')) {
      const [orig, alias] = part.split(/\s+as\s+/).map(x => x.trim());
      if (!orig) continue;
      // Called under its alias if aliased, otherwise under its own name.
      if (AUTH.includes(`${(alias || orig)}()`)) names.add(orig);
    }
  }
  return names;
}

function sourceFiles(dir = LIB): { file: string; src: string }[] {
  const out: { file: string; src: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push({ file: relative(LIB, path), src: readFileSync(path, 'utf8') });
    }
  }
  return out;
}

/**
 * Modules that PERSIST user state: a storage key plus a module-level mutable
 * cache. Those are the ones whose in-memory copy outlives a sign-out.
 */
function persistentCacheModules(): { file: string; clears: string[] }[] {
  const out: { file: string; clears: string[] }[] = [];
  for (const { file, src } of sourceFiles()) {
    const mutableCache = /^let [a-zA-Z]+/m.test(src)
      || /^const [a-zA-Z]+\s*=\s*new (?:Map|Set)\b/m.test(src);
    const persists = /setItem\(/.test(src) && mutableCache;
    if (!persists) continue;
    const clears = [...src.matchAll(/^export (?:async )?function (clear[A-Za-z]*)\s*\(/gm)]
      .map(m => m[1]);
    if (clears.length) out.push({ file, clears });
  }
  return out;
}

/**
 * Every setItem call site in the scan roots, with each first argument either
 * RESOLVED to the key it writes or reported as UNRESOLVED.
 *
 * The predecessor of this function ran a set of resolvers and recorded only
 * what they understood — so a call written in any shape the resolvers did not
 * know simply did not exist, and the accounting test passed around it. That is
 * a scanner answering "I cannot tell what this writes" with "then nothing was
 * written". Three real call sites were already invisible that way: the inline
 * template key `minds:agentPersonaHealed:${user.id}` and the two
 * factory-built cutoverWelcome dismissal keys. Now a call site no resolver
 * understands lands in `unresolved`, and the test below requires every such
 * site to be individually argued into a justification list — the same
 * fail-closed contract the survivors list already applies to resolved keys.
 */
function persistedKeyAccounting(): {
  resolved: Map<string, string[]>;
  unresolved: string[];
} {
  const resolved = new Map<string, string[]>();
  const unresolved: string[] = [];
  const record = (key: string, file: string) =>
    resolved.set(key, [...(resolved.get(key) ?? []), file]);
  for (const root of KEY_SCAN_ROOTS) {
    for (const { file, src } of sourceFiles(root)) {
      if (root === LIB && (file === 'auth.tsx' || file === 'storage.ts')) continue;
      const constants = new Map<string, string>();
      for (const match of src.matchAll(/^\s*const\s+([A-Z][A-Z0-9_]*)\s*=\s*'([^']+)'/gm)) {
        constants.set(match[1], match[2]);
      }
      for (const object of src.matchAll(/^const\s+([A-Z][A-Z0-9_]*)\s*=\s*\{([\s\S]*?)^\};/gm)) {
        for (const field of object[2].matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*):\s*'([^']+)'/gm)) {
          constants.set(`${object[1]}.${field[1]}`, field[2]);
        }
      }
      // Aliased imports: `import { setItem as persist } from './storage'`
      // renames the write without changing what it does, and a scan matching
      // only the original names would see nothing — neither resolved nor
      // unresolved. The wiring test above already resolves this exact form
      // (clearAll imported as clearCacheAll was one of its recorded false
      // positives), so the write scan resolves it too.
      const writeNames = new Set(['setItem', 'setItemAsync']);
      for (const imp of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g)) {
        for (const part of imp[1].split(',')) {
          const [orig, alias] = part.split(/\s+as\s+/).map(x => x.trim());
          if (alias && writeNames.has(orig)) writeNames.add(alias);
        }
      }
      const sitePattern = new RegExp(
        `(?:^|[^\\w$])(?:${[...writeNames].join('|')})\\(\\s*([^,)\\n]+)`,
        'g',
      );
      // One broad pass over every call site; resolvers are tried per site so
      // an ununderstood argument cannot fall between two narrower scans.
      for (const call of src.matchAll(sitePattern)) {
        const arg = call[1].trim();

        // 1. A plain string literal: setItem('minds:foo', …).
        const literal = arg.match(/^'([^']+)'$/);
        if (literal) { record(literal[1], file); continue; }

        // 2. A module constant or KEYS-object field defined in this file.
        const named = arg.match(/^([A-Z][A-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)?)$/);
        const namedKey = named && constants.get(named[1]);
        if (namedKey) { record(namedKey, file); continue; }

        // 3. Dynamic per-user keys: setItem(`${CONST}:${user.id}`, …).
        //    The resolved prefix plus ':*' is what must be accounted for.
        const constTemplate = arg.match(/^`\$\{([A-Z][A-Z0-9_]*)\}[^`]*`$/);
        const templateKey = constTemplate && constants.get(constTemplate[1]);
        if (templateKey) { record(`${templateKey}:*`, file); continue; }

        // 4. Inline template keys: setItem(`minds:agentPersonaHealed:${user.id}`, …).
        //    The literal prefix plus '*' is what must be accounted for.
        const inlineTemplate = arg.match(/^`([^`$]+)\$\{[^`]*`$/);
        if (inlineTemplate) { record(`${inlineTemplate[1]}*`, file); continue; }

        unresolved.push(`${file} :: setItem(${arg}`);
      }
    }
  }
  return { resolved, unresolved };
}

describe('sign-out completeness', () => {
  it('discovers the cache modules by scanning, not from a hand-written list', () => {
    // Positive control: with an empty scan every assertion below passes
    // vacuously and this file is decoration.
    expect(persistentCacheModules().length).toBeGreaterThanOrEqual(4);
    expect(persistentCacheModules().map(module => module.file))
      .toContain('audio/downloads.native.ts');
  });

  it('accounts for every resolved persisted key as cleared or deliberately device-local', () => {
    const intentionalSurvivors = new Map([
      ['minds:theme-mode', 'device display preference'],
      ['minds:pendingRef', 'pre-auth referral attribution until redemption'],
      ['minds:archived_accounts', 'device account-switcher preference over global ids'],
      // The `:*` entries are per-account keys (`key:<userId>`). They survive
      // sign-out the way archived_accounts does: keyed by a globally unique
      // account id, so a returning account keeps its own flag and no other
      // account ever reads it. None holds content — booleans and a timestamp.
      // A key like these that DOES hold content must be cleared by auth.tsx
      // instead of being added here.
      ['minds:profileNudge:dismissed:*', 'per-account cosmetic flag over global ids'],
      ['minds:feed:lastVisitAt:*', 'per-account fresh-content timestamp over global ids'],
      ['minds:agentPersonaHealed:*', 'per-account persona-heal marker over global ids'],
      // The push device key is the installation's possession proof, documented
      // in lib/pushDeviceKey.ts as deliberately shared across accounts: the
      // server pairs it with a user binding, and unregisterTokenWithServer
      // (asserted below) is what severs that binding on sign-out. Random bytes,
      // no user content.
      ['minds_push_device_key', 'device-installation possession proof, account-agnostic by design'],
    ]);
    const { resolved: persisted } = persistedKeyAccounting();
    expect(persisted.has('minds:onboarding:usernamePicked')).toBe(true);
    expect(persisted.has('minds.audio.downloads.v1')).toBe(true);
    // Positive controls, one per resolver shape the scan claims to understand.
    // If any disappears from the scan, the scan is broken, not the app.
    expect(persisted.has('minds:feed:lastVisitAt:*')).toBe(true);       // `${CONST}:${user.id}`
    expect(persisted.has('minds:profileNudge:dismissed:*')).toBe(true); // `${CONST}:${user.id}`
    expect(persisted.has('minds:agentPersonaHealed:*')).toBe(true);     // inline `literal${expr}`
    expect(persisted.has('minds_push_device_key')).toBe(true);          // SecureStore setItemAsync

    const unaccounted = [...persisted.entries()]
      .filter(([key]) => !AUTH.includes(`removeItem('${key}')`) && !intentionalSurvivors.has(key))
      .map(([key, files]) => `${key} (${files.join(', ')})`);
    expect(unaccounted).toEqual([]);
  });

  it('every setItem call site the scan cannot resolve is individually justified', () => {
    // The fail-closed half of the accounting. When the scanner cannot tell
    // what key a call writes, the answer is not "then no key was written" —
    // it is this list, where each opaque call site must be argued in review,
    // exactly as the survivors list requires for resolved keys. Adding a
    // persistence call in a shape the resolvers do not understand fails here
    // until it is either rewritten in a resolvable shape or justified.
    const { unresolved } = persistedKeyAccounting();
    expect(unresolved.sort()).toEqual([
      // The two cutoverWelcome dismissal flags, built by cutoverWelcomeKeys()
      // in lib/cutoverWelcome.ts as `minds:cutoverWelcome:v1:<userId>:…`.
      // Per-account booleans over global ids — the profileNudge precedent.
      '../components/CutoverWelcome.tsx :: setItem(keys.bannerDismissed',
      '../components/CutoverWelcome.tsx :: setItem(keys.modalDismissed',
      // The cache module's per-namespace payload under `minds:cache:v4:<ns>`.
      // Its sign-out story is the module-wiring test above: clearAll is
      // exported and called by auth.tsx.
      'cache.ts :: setItem(key',
      'cache.ts :: setItem(key',
    ]);
  });

  it('every module that persists user state is cleared by auth.tsx', () => {
    const imported = importedOriginalNames();
    const unwired = persistentCacheModules()
      .filter(({ clears }) => !clears.some(fn => imported.has(fn)))
      .map(m => `${m.file} (exports ${m.clears.join(', ')})`);
    expect(unwired).toEqual([]);
  });

  it('every path that leaves an account releases the push binding', () => {
    // #203. The server binds a push token to exactly ONE user, so an account
    // the device no longer holds keeps receiving DM previews on its lock screen
    // until something rebinds the token.
    //
    // Both exits need this, and they need it for different reasons. signOut has
    // no successor to rebind at all. switchAccount does — persistSession
    // re-registers under the new user — but that registration is fire-and-forget
    // and swallows failures, so on the failure path the binding silently stays
    // with the account the user just left.
    for (const fn of ['signOut', 'switchAccount']) {
      const start = AUTH.indexOf(`const ${fn} = React.useCallback`);
      expect(start, `${fn} not found — this guard is checking nothing`).toBeGreaterThan(-1);
      // Bounded by the next top-level callback so a call in a LATER function
      // cannot satisfy an earlier one's assertion.
      const rest = AUTH.slice(start + 1);
      const next = rest.search(/^ {2}const [a-zA-Z]+ = React\.useCallback/m);
      const body = next === -1 ? rest : rest.slice(0, next);
      // Strip comments before asserting, and match the CALL. The first version
      // of this checked `body.toContain('unregisterTokenWithServer')`, which
      // signOut's own comment satisfies — deleting the actual call left the
      // test green. Its negative control caught it. A test that cannot fail is
      // not evidence, and it is the second time today the identifier matched
      // prose instead of code.
      const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, `${fn} does not unregister this device's push token`)
        .toMatch(/unregisterTokenWithServer\s*\(/);
    }
  });

  it('every path that leaves an account revokes both stored credential classes', () => {
    // Sign-in creates two independent server credentials: the project-scoped
    // API key used by the app and the Better Auth session used by 2FA/passkeys.
    // Clearing storage alone kills neither. Account switching used to orphan
    // both, while sign-out revoked only the key.
    for (const fn of ['signOut', 'switchAccount']) {
      const start = AUTH.indexOf(`const ${fn} = React.useCallback`);
      expect(start, `${fn} not found — this guard is checking nothing`).toBeGreaterThan(-1);
      const rest = AUTH.slice(start + 1);
      const next = rest.search(/^ {2}const [a-zA-Z]+ = React\.useCallback/m);
      const body = next === -1 ? rest : rest.slice(0, next);
      const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      expect(code, `${fn} never reads the Better Auth session it must revoke`)
        .toMatch(/storage\.getItem\(KEYS\.sessionToken\)/);
      expect(code, `${fn} does not invoke the two-credential revocation boundary`)
        .toMatch(/revokeStoredCredentials\s*\(\s*\{/);
      expect(code, `${fn} does not wire Better Auth session revocation`)
        .toMatch(/revokeSession:\s*token\s*=>\s*anonSdk\.auth\.signOut\(token\)/);
    }
  });

  it('sign-out checks whether the clears worked instead of discarding the result', () => {
    // clearStorage used to end `Promise.all([...]).catch(() => {})`, throwing the
    // outcome away — and on web `removeItem` swallowed its own failure and
    // resolved anyway, so that catch could not have observed a thing. A remove
    // that quietly fails is exactly how the previous user's bookmarks, mutes, DM
    // mute/archive metadata and unsent drafts reach the next account on a device.
    //
    // persistSession already reports its one un-observable failure. This asserts
    // sign-out does too, since it is the same class with a worse consequence.
    const start = AUTH.indexOf('async function clearStorage');
    expect(start, 'clearStorage not found — this guard is checking nothing')
      .toBeGreaterThan(-1);
    const rest = AUTH.slice(start + 1);
    const next = rest.search(/^ {2}async function [a-zA-Z]+/m);
    const body = next === -1 ? rest : rest.slice(0, next);
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // The specific regression: swallowing the whole batch.
    expect(code, 'clearStorage discards the outcome of its removals')
      .not.toMatch(/\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)/);

    // `toMatch(/captureMessage\(/)` is NOT enough, and this is the second time
    // this file has learned it: a mutation that changed the guard to `if (false)`
    // left the call present in the source and the test green. The identifier
    // matching proves the text exists, not that anything runs.
    //
    // So pin the SHAPE: the report must sit inside a block conditioned on a
    // failure count, and that count must be derived from the removal results
    // rather than initialised empty.
    expect(code, 'the failure list is not derived from the removal results')
      .toMatch(/const\s+failed\s*=\s*removalNames\.filter\s*\(/);
    expect(code, 'the report is not guarded by an actual failure count')
      .toMatch(/if\s*\(\s*failed\.length\s*>\s*0\s*\)\s*\{[\s\S]{0,300}?captureMessage\s*\(/);
  });

  it('the drafts key auth.tsx removes is the key drafts.ts writes', () => {
    // #304's actual defect, as an assertion. A mismatched key clears nothing
    // and fails completely silently.
    const draftsKey = readFileSync(join(LIB, 'drafts.ts'), 'utf8')
      .match(/const DRAFTS_KEY = '([^']+)'/)?.[1];
    expect(draftsKey).toBeTruthy();
    expect(AUTH).toContain(`removeItem('${draftsKey}')`);
  });
});
