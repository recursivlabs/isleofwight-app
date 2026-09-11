import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LOGIN_ROUTE = join(__dirname, '..', 'app', 'login.tsx');

describe('the conventional /login route', () => {
  it('exists so the dynamic username route cannot render the @login profile', () => {
    expect(existsSync(LOGIN_ROUTE)).toBe(true);
  });

  it('reuses the canonical landing and authentication experience', () => {
    const source = readFileSync(LOGIN_ROUTE, 'utf8');
    expect(source).toMatch(/export\s*\{\s*default\s*\}\s*from\s*['"]\.\/index['"]/);
  });
});
