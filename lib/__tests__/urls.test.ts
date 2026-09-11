import { describe, expect, it } from 'vitest';
import { extractFirstUrl, extractUrls, isLikelyTruncatedUrl, trimUrlEnd } from '../urls';

describe('trimUrlEnd', () => {
  it('keeps a closing bracket the URL opened itself', () => {
    // The case found on the live network: this preview came back blank because
    // the bracket was stripped and the truncated URL 404s upstream.
    expect(trimUrlEnd('https://en.wikipedia.org/wiki/Frost_flower_(sea_ice)'))
      .toBe('https://en.wikipedia.org/wiki/Frost_flower_(sea_ice)');
  });

  it('drops a closing bracket the URL never opened', () => {
    expect(trimUrlEnd('https://example.com/a)')).toBe('https://example.com/a');
  });

  it('trims sentence punctuation', () => {
    expect(trimUrlEnd('https://example.com/a.')).toBe('https://example.com/a');
    expect(trimUrlEnd('https://example.com/a,')).toBe('https://example.com/a');
    expect(trimUrlEnd('https://example.com/a?!')).toBe('https://example.com/a');
  });

  it('keeps a query string, whose ? is not trailing', () => {
    expect(trimUrlEnd('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
  });

  it('handles punctuation after a balanced bracket', () => {
    expect(trimUrlEnd('https://en.wikipedia.org/wiki/Foo_(bar).'))
      .toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('handles nested brackets', () => {
    expect(trimUrlEnd('https://example.com/a_(b_(c))')).toBe('https://example.com/a_(b_(c))');
  });
});

describe('extractUrls', () => {
  it('finds a bracketed URL inside a sentence', () => {
    const text = 'read https://en.wikipedia.org/wiki/Frost_flower_(sea_ice) today';
    expect(extractUrls(text)).toEqual(['https://en.wikipedia.org/wiki/Frost_flower_(sea_ice)']);
  });

  it('drops the wrapping bracket when the URL is parenthesised', () => {
    const text = 'see (https://example.com/a) for more';
    expect(extractUrls(text)).toEqual(['https://example.com/a']);
  });

  it('returns URLs in order', () => {
    expect(extractUrls('a https://one.example b https://two.example'))
      .toEqual(['https://one.example', 'https://two.example']);
  });

  it('returns nothing for text without a URL', () => {
    expect(extractUrls('no links here')).toEqual([]);
    expect(extractFirstUrl('')).toBeNull();
  });

  it('does not run past whitespace or quotes', () => {
    expect(extractFirstUrl('"https://example.com/a" said')).toBe('https://example.com/a');
  });

  it('does not treat a visibly truncated URL as a usable destination', () => {
    const truncated = 'https://example.com/long-path…';
    expect(isLikelyTruncatedUrl(truncated)).toBe(true);
    expect(extractFirstUrl(`Read ${truncated}`)).toBeNull();
    expect(extractUrls(`${truncated} then https://example.com/complete`))
      .toEqual(['https://example.com/complete']);
  });
});

describe('bracketed URLs survive rendering', () => {
  const text = 'read https://en.wikipedia.org/wiki/Frost_flower_(sea_ice) today';
  const full = 'https://en.wikipedia.org/wiki/Frost_flower_(sea_ice)';

  it('parseMarkdownSegments links the whole URL', async () => {
    const { parseMarkdownSegments } = await import('../markdown');
    const link = parseMarkdownSegments(text).find((s: any) => s.type === 'link') as any;
    expect(link?.url).toBe(full);
  });

  it('renderMarkdownToHtml hrefs the whole URL', async () => {
    const { renderMarkdownToHtml } = await import('../markdown');
    expect(renderMarkdownToHtml(text)).toContain(`href="${full}"`);
  });

  it('a parenthesised link still drops the wrapping bracket', async () => {
    const { parseMarkdownSegments } = await import('../markdown');
    const link = parseMarkdownSegments('see (https://example.com/a) ok')
      .find((s: any) => s.type === 'link') as any;
    expect(link?.url).toBe('https://example.com/a');
  });
});

describe('visibly truncated URLs stay plain text', () => {
  const text = 'Read https://example.com/long-path…';

  it('does not emit a native link segment', async () => {
    const { parseMarkdownSegments } = await import('../markdown');
    const segments = parseMarkdownSegments(text);
    expect(segments.some((segment) => segment.type === 'link')).toBe(false);
    expect(segments.map((segment) => ('text' in segment ? segment.text : '')).join('')).toBe(text);
  });

  it('does not emit a web anchor', async () => {
    const { renderMarkdownToHtml } = await import('../markdown');
    const html = renderMarkdownToHtml(text);
    expect(html).not.toContain('<a ');
    expect(html).toContain('https://example.com/long-path…');
  });
});
