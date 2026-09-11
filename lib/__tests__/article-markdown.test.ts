import { describe, expect, it } from 'vitest';
import { parseMarkdownBlocks, renderMarkdownToHtml } from '../markdown';

// WHY THIS EXISTS
// An imported blog rendered as one undifferentiated slab. Two separate reasons:
//   - native had no block parser at all, so "## Heading" showed its markers
//   - web emitted inline styles that no stylesheet could override, and the
//     legacy-HTML path emitted none, so headings rendered at body weight
// These cover the parsing half; the styling half lives in ArticleBody.

describe('parseMarkdownBlocks', () => {
  it('reads headings by level and strips the markers', () => {
    const blocks = parseMarkdownBlocks('# One\n\n## Two\n\n### Three');
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'One' },
      { type: 'heading', level: 2, text: 'Two' },
      { type: 'heading', level: 3, text: 'Three' },
    ]);
  });

  it('groups consecutive bullets into one list', () => {
    const blocks = parseMarkdownBlocks('- a\n- b\n- c');
    expect(blocks).toEqual([{ type: 'list', ordered: false, items: ['a', 'b', 'c'] }]);
  });

  it('separates an ordered list from an unordered one', () => {
    const blocks = parseMarkdownBlocks('- a\n1. b');
    expect(blocks).toEqual([
      { type: 'list', ordered: false, items: ['a'] },
      { type: 'list', ordered: true, items: ['b'] },
    ]);
  });

  it('joins wrapped lines into one paragraph but keeps blank-line breaks', () => {
    const blocks = parseMarkdownBlocks('one\ntwo\n\nthree');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'one two' },
      { type: 'paragraph', text: 'three' },
    ]);
  });

  it('keeps a fenced block verbatim and parses nothing inside it', () => {
    const blocks = parseMarkdownBlocks('```\n# not a heading\n- not a list\n```');
    expect(blocks).toEqual([{ type: 'code', text: '# not a heading\n- not a list' }]);
  });

  it('reads quotes and rules', () => {
    expect(parseMarkdownBlocks('> quoted')).toEqual([{ type: 'quote', text: 'quoted' }]);
    expect(parseMarkdownBlocks('---')).toEqual([{ type: 'rule' }]);
  });

  it('closes an unterminated fence rather than dropping the text', () => {
    const blocks = parseMarkdownBlocks('```\nstill here');
    expect(blocks).toEqual([{ type: 'code', text: 'still here' }]);
  });

  it('returns nothing for empty input', () => {
    expect(parseMarkdownBlocks('')).toEqual([]);
    expect(parseMarkdownBlocks('   \n\n  ')).toEqual([]);
  });
});

describe('renderMarkdownToHtml bare mode', () => {
  const md = '# Title\n\n- one\n- two\n\n`code`';

  it('emits the same tags with and without styles', () => {
    const styled = renderMarkdownToHtml(md);
    const bare = renderMarkdownToHtml(md, { bare: true });
    for (const tag of ['<h1', '<ul', '<li', '<code']) {
      expect(styled, `styled should contain ${tag}`).toContain(tag);
      expect(bare, `bare should contain ${tag}`).toContain(tag);
    }
  });

  it('drops every inline style so a stylesheet can win', () => {
    // Inline styles beat any stylesheet, which is why the reader asks for bare.
    expect(renderMarkdownToHtml(md, { bare: true })).not.toContain('style="');
  });

  it('leaves the default styled, so feed cards and chat are unchanged', () => {
    expect(renderMarkdownToHtml(md)).toContain('style="');
  });

  it('still escapes markup in bare mode', () => {
    const out = renderMarkdownToHtml('<script>alert(1)</script>', { bare: true });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('still refuses an unsafe link scheme in bare mode', () => {
    const out = renderMarkdownToHtml('[x](javascript:alert(1))', { bare: true });
    expect(out).not.toContain('href="javascript:');
  });
});

describe('restoreLostParagraphs', () => {
  it('puts a paragraph break at every seam the legacy import flattened', async () => {
    const { restoreLostParagraphs } = await import('../markdown');
    const flat = 'Minds+ friends,First off, thank you for reading this. Your support makes all the difference.One of our goals is alignment. So it only makes sense to build a system where success is shared, not taken.We are doing our best.';
    expect(restoreLostParagraphs(flat)).toBe(
      'Minds+ friends,\n\nFirst off, thank you for reading this. Your support makes all the difference.\n\nOne of our goals is alignment. So it only makes sense to build a system where success is shared, not taken.\n\nWe are doing our best.',
    );
  });

  it('leaves a body that kept its line breaks, domains and numbers alone', async () => {
    const { restoreLostParagraphs } = await import('../markdown');
    const kept = 'First paragraph.\nSecond paragraph.Third sentence glued.';
    expect(restoreLostParagraphs(kept)).toBe(kept);
    const safe = 'Read minds.com/jack and pay 1,000 tokens. Then stop.';
    expect(restoreLostParagraphs(safe)).toBe(safe);
  });
});
