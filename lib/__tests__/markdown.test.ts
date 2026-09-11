import { describe, it, expect } from 'vitest';
import { renderMarkdownToHtml, parseMarkdownSegments, isSafeUrl } from '../markdown';

describe('renderMarkdownToHtml', () => {
  it('renders "-" bullet lists as <ul><li> (regression: raw markers used to leak)', () => {
    const html = renderMarkdownToHtml('- one\n- two');
    expect(html).toContain('<ul');
    expect(html.match(/<li/g)?.length).toBe(2);
    expect(html).not.toContain('- one');
  });

  it('renders "*" bullets and numbered lists', () => {
    expect(renderMarkdownToHtml('* a\n* b')).toContain('<ul');
    const ol = renderMarkdownToHtml('1. first\n2. second');
    expect(ol).toContain('<ol');
    expect(ol.match(/<li/g)?.length).toBe(2);
  });

  it('renders bold, italic, headings, and links', () => {
    expect(renderMarkdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(renderMarkdownToHtml('*it*')).toContain('<em>it</em>');
    expect(renderMarkdownToHtml('# Title')).toContain('<h1');
    expect(renderMarkdownToHtml('### Small')).toContain('<h3');
    const link = renderMarkdownToHtml('[text](https://x.com)');
    expect(link).toContain('href="https://x.com"');
    expect(link).toContain('>text</a>');
  });

  it('escapes HTML to prevent injection', () => {
    const html = renderMarkdownToHtml('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(renderMarkdownToHtml('')).toBe('');
  });

  it('refuses javascript: link URLs (XSS regression)', () => {
    const html = renderMarkdownToHtml("[click](javascript:alert(document.cookie))");
    // rejected URL must render as plain text — no anchor, no href
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('href=');
  });

  it('refuses data: and other non-http(s)/mailto schemes', () => {
    expect(renderMarkdownToHtml('[x](data:text/html,<script>1</script>)')).not.toContain('<a ');
    expect(renderMarkdownToHtml('[x](vbscript:msgbox)')).not.toContain('<a ');
    expect(renderMarkdownToHtml('[x]( javascript:alert(1))')).not.toContain('<a ');
  });

  it('escapes quotes in link URLs so the href cannot be broken out of (XSS regression)', () => {
    const html = renderMarkdownToHtml('[x](https://e.com/" onfocus="alert(1)" x=")');
    expect(html).not.toContain('" onfocus="');
    expect(html).toContain('&quot;');
  });

  it('still renders mailto links', () => {
    expect(renderMarkdownToHtml('[mail](mailto:a@b.com)')).toContain('href="mailto:a@b.com"');
  });

  it('renders hashtags as canonical Discover links', () => {
    const html = renderMarkdownToHtml('Follow #AI');
    expect(html).toContain('href="/discover/posts?q=%23AI"');
    expect(html).not.toContain('/(tabs)/');
  });
});

describe('isSafeUrl', () => {
  it('allows http, https, and mailto', () => {
    expect(isSafeUrl('https://x.com')).toBe(true);
    expect(isSafeUrl('http://x.com')).toBe(true);
    expect(isSafeUrl('HTTPS://X.COM')).toBe(true);
    expect(isSafeUrl('mailto:a@b.com')).toBe(true);
  });

  it('rejects script-capable and unknown schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('vbscript:x')).toBe(false);
    expect(isSafeUrl('intent://x')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('//evil.com')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
});

describe('parseMarkdownSegments', () => {
  it('parses bold segments', () => {
    const segs = parseMarkdownSegments('hi **there**');
    expect(segs.some((s) => s.type === 'bold' && (s as any).text === 'there')).toBe(true);
  });

  it('converts line-start bullets to a bullet glyph for native', () => {
    const segs = parseMarkdownSegments('- item');
    const text = segs.map((s) => (s as any).text || '').join('');
    expect(text).toContain('•'); // •
    expect(text).not.toMatch(/^-\s/);
  });

  it('never emits link segments for unsafe schemes (native openURL regression)', () => {
    const segs = parseMarkdownSegments('[x](javascript:alert(1)) and [ok](https://x.com)');
    const links = segs.filter((s) => s.type === 'link') as Array<{ url: string }>;
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe('https://x.com');
    // the unsafe link stays visible as plain text, not silently dropped
    expect(segs.some((s) => s.type === 'text' && (s as any).text.includes('[x](javascript:'))).toBe(true);
  });
});
