import { describe, it, expect, beforeEach } from 'vitest';
import { isMuted, toggleMute, getMutedUsers, filterMuted } from '../muted';

beforeEach(() => {
  // reset: unmute everyone currently muted
  for (const id of getMutedUsers()) toggleMute(id);
  window.localStorage.clear();
});

describe('muted users', () => {
  it('toggles mute on and off', () => {
    expect(isMuted('u1')).toBe(false);
    expect(toggleMute('u1')).toBe(true);
    expect(isMuted('u1')).toBe(true);
    expect(toggleMute('u1')).toBe(false);
    expect(isMuted('u1')).toBe(false);
  });

  it('filterMuted removes posts from muted authors (across author field shapes)', () => {
    toggleMute('bad');
    const posts = [
      { id: 'a', author: { id: 'good' } },
      { id: 'b', author: { id: 'bad' } },
      { id: 'c', userId: 'bad' },
      { id: 'd', user_id: 'good' },
    ];
    const out = filterMuted(posts).map((p) => p.id);
    expect(out).toEqual(['a', 'd']);
  });

  it('returns the same list quickly when nobody is muted', () => {
    const posts = [{ id: 'a', author: { id: 'x' } }];
    expect(filterMuted(posts)).toBe(posts);
  });
});
