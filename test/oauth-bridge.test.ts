import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The /auth OAuth bridge must exist, use the shared reliable OTP sender,
 * authenticate session-producing calls with credentials, and hand control
 * back to the authorize endpoint untouched.
 *
 * Better Auth's `mcp` plugin redirects unauthenticated authorize requests to
 * `<app>/auth?<original OAuth query>`. Before this screen existed, /auth fell
 * through to the [username] route — a user literally named "auth" was looked
 * up, "User not found" rendered, and the MCP connector flow died at the final
 * hop after discovery, DCR and PKCE had all succeeded (recursiv#2420).
 *
 * WHY SOURCE-READING: app/** is unreachable by vitest (react-native stubbed,
 * screens not mounted), and the two properties that matter are exact strings
 * in one file. Each assertion below was mutation-checked: break the property,
 * watch the test fail, restore.
 */

const SCREEN = join(__dirname, '..', 'app', 'auth', 'index.tsx');

describe('the /auth OAuth bridge', () => {
  it('exists — without it /auth falls through to [username] and renders "User not found"', () => {
    expect(existsSync(SCREEN)).toBe(true);
  });

  const src = () => readFileSync(SCREEN, 'utf8');

  it('uses the shared OTP sender while session-producing calls keep credentials', () => {
    // Sending a code does not create a session, so it belongs on the SDK's
    // bounded-retry path shared with ordinary Minds sign-in. Verification and
    // password sign-in do create the OAuth session cookie and must stay on
    // credentialed fetches. If either loses `credentials: 'include'`, sign-in
    // appears successful and authorize bounces back here in an infinite loop.
    const code = src().replace(/\/\/[^\n]*/g, '');
    const fetches = code.match(/fetch\(`\$\{BASE_ORIGIN\}[^`]*`,\s*\{[^}]*}/g) ?? [];
    expect(fetches).toHaveLength(2);
    for (const f of fetches) expect(f).toMatch(/credentials:\s*'include'/);
    expect(code).toMatch(/sendSignInOtp\(email\(\)\)/);
    expect(code).not.toMatch(/\/api\/auth\/email-otp\/send-verification-otp/);
    expect(code).toMatch(/\/api\/auth\/sign-in\/email-otp/);
    expect(code).toMatch(/\/api\/auth\/sign-in\/email`/);
  });

  it('OTP is the primary flow — a passwordless account can authorize', () => {
    // The first cut of this screen was password-only, which authorised nobody
    // who actually needed it: most accounts, including the founder's, are
    // OTP-only. The email step must lead with the code flow.
    const code = src().replace(/\/\/[^\n]*/g, '');
    expect(code).toMatch(/sendSignInOtp/);
    expect(code).toMatch(/Email me a sign-in code/);
  });

  it('returns control to the authorize endpoint with the original query', () => {
    const code = src().replace(/\/\/[^\n]*/g, '');
    expect(code).toMatch(/\/api\/auth\/mcp\/authorize\?/);
    // The stashed query must be interpolated, not rebuilt field-by-field —
    // state, PKCE and resource all ride in it, and dropping any one breaks
    // the client's verification silently.
    expect(code).toMatch(/mcp\/authorize\?\$\{oauthQuery\}/);
  });

  it('only engages when real OAuth params are present', () => {
    // A bare /auth (typed by hand, or native) must not show a dead form.
    const code = src();
    expect(code).toMatch(/response_type.*===.*'code'/);
    expect(code).toMatch(/Redirect/);
  });
});
