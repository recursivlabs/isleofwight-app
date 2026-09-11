import { describe, expect, it } from 'vitest';
import { discoverReturnTo } from './discoverReturnTo';

describe('Discover authentication return path', () => {
  it('preserves the active subroute and search query', () => {
    expect(discoverReturnTo('/discover/posts', { q: 'privacy' })).toBe(
      '/discover/posts?q=privacy',
    );
  });

  it('uses the first value for repeated router parameters', () => {
    expect(discoverReturnTo('/discover/people', { q: ['alice', 'bob'] })).toBe(
      '/discover/people?q=alice',
    );
  });
});
