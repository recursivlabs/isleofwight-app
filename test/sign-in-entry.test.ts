import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(join(__dirname, '../app/(auth)/sign-in.tsx'), 'utf8');
const landing = readFileSync(join(__dirname, '../app/index.tsx'), 'utf8');
const alias = readFileSync(join(__dirname, '../app/signin.tsx'), 'utf8');

describe('sign-in compatibility entries', () => {
  it('canonicalizes /sign-in through the complete login state', () => {
    expect(route).toContain("auth: 'login'");
    expect(route).toContain("pathname: '/'");
    expect(route).toContain('returnTo: destination');
  });

  it('supports login mode both initially and after route params hydrate', () => {
    expect(landing).toContain("auth === 'login' ? 'login' : 'home'");
    expect(landing).toContain("if (auth === 'login')");
  });

  it('keeps /signin on the same compatibility route', () => {
    expect(alias).toContain("export { default } from './(auth)/sign-in';");
  });
});
