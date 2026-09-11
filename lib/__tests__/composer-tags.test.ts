import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const composer = readFileSync(join(__dirname, '../../app/(tabs)/create.tsx'), 'utf8');

describe('post composer publish contract', () => {
  it('sends selected tag names and clears them after a successful post', () => {
    expect(composer).toContain('tag_names: tags.length > 0 ? tags : undefined');
    expect(composer).toContain('const MAX_TAGS = 10');
    expect(composer).toContain('setTags([])');
  });

  it('does not offer scheduling until the platform can actually publish later', () => {
    expect(composer).not.toContain('ScheduleModal');
    expect(composer).not.toContain('Schedule post');
  });
});
