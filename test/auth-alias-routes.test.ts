import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const aliases = [
  ['signin.tsx', './(auth)/sign-in'],
  ['signup.tsx', './(auth)/sign-up'],
  ['register.tsx', './(auth)/sign-up'],
] as const;

describe('conventional authentication route aliases', () => {
  it.each(aliases)('%s exists and reuses %s', (file, target) => {
    const route = join(__dirname, '..', 'app', file);
    expect(existsSync(route)).toBe(true);
    expect(readFileSync(route, 'utf8')).toContain(`export { default } from '${target}';`);
  });
});
