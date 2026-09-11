import { describe, expect, it } from 'vitest';
import { getInitials } from '../avatar';

describe('getInitials', () => {
  it('keeps ordinary initials unchanged', () => {
    expect(getInitials('Bill Ottman')).toBe('BO');
    expect(getInitials('minds')).toBe('M');
  });

  it('returns a question mark for an absent or blank name', () => {
    expect(getInitials()).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });

  it('does not split supplementary Unicode characters', () => {
    expect(getInitials('Adrint 🇨🇦')).toBe('A🇨🇦');
    expect(getInitials('👩‍💻 Builder')).toBe('👩‍💻B');
    expect(getInitials('Adrint 🇨🇦')).not.toContain('�');
  });

  it('normalizes combining marks into one visible initial', () => {
    expect(getInitials('e\u0301 clair')).toBe('ÉC');
  });
});
