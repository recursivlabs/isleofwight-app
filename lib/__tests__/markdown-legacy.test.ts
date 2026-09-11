import { describe, it, expect } from 'vitest';
import { looksLikeLegacyHtml, sanitizeLegacyHtml, stripHtmlToText } from '../markdown';

describe('looksLikeLegacyHtml', () => {
  it('detects legacy article HTML', () => {
    expect(looksLikeLegacyHtml('<p>Welcome to Minds</p>')).toBe(true);
    expect(looksLikeLegacyHtml('via <a href="https://x.com">link</a>')).toBe(true);
    expect(looksLikeLegacyHtml('<img src="https://cdn.minds.com/x.jpg">')).toBe(true);
  });

  it('does NOT flag plain text, math, or markdown', () => {
    expect(looksLikeLegacyHtml('hello world')).toBe(false);
    expect(looksLikeLegacyHtml('x < y and y > z')).toBe(false);
    expect(looksLikeLegacyHtml('**bold** and [link](https://a.b)')).toBe(false);
    expect(looksLikeLegacyHtml('')).toBe(false);
  });
});

describe('sanitizeLegacyHtml (XSS surface)', () => {
  it('strips script tags entirely', () => {
    const out = sanitizeLegacyHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).toContain('hi');
    expect(out).not.toContain('script');
    expect(out).not.toContain('alert');
  });

  it('strips event handlers and style attributes from user HTML', () => {
    const out = sanitizeLegacyHtml('<img src="https://a.b/x.jpg" onerror="alert(1)" style="position:fixed">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('position:fixed');
    expect(out).toContain('src="https://a.b/x.jpg"');
  });

  it('removes javascript: and data: URLs', () => {
    expect(sanitizeLegacyHtml('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    expect(sanitizeLegacyHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">')).not.toContain('data:');
  });

  it('strips iframe/object/embed', () => {
    const out = sanitizeLegacyHtml('<iframe src="https://evil.com"></iframe><object></object><embed>');
    expect(out).not.toMatch(/iframe|object|embed/);
  });

  it('keeps allowlisted structure and forces safe link attrs', () => {
    const out = sanitizeLegacyHtml('<p>Read <a href="https://minds.com/blog">this</a></p>');
    expect(out).toContain('<p');
    expect(out).toContain('href="https://minds.com/blog"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('survives truncated/broken tags without leaking raw HTML', () => {
    const out = sanitizeLegacyHtml('<p>hello <a href="https://a.b" onclick="x(');
    expect(out).toContain('hello');
    expect(out).not.toContain('onclick');
  });
});

describe('stripHtmlToText', () => {
  it('converts structure to readable text and decodes entities', () => {
    const txt = stripHtmlToText('<p>Hello &amp; welcome</p><ul><li>one</li><li>two</li></ul>');
    expect(txt).toContain('Hello & welcome');
    expect(txt).toContain('• one');
    expect(txt).toContain('• two');
    expect(txt).not.toContain('<');
  });

  it('never emits tags even for nasty input', () => {
    expect(stripHtmlToText('<script>alert(1)</script><p>ok</p>')).not.toContain('<');
  });

  it('strips re-forming nested tags to a fixed point (CodeQL: incomplete sanitization)', () => {
    expect(stripHtmlToText('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toMatch(/<\s*script/i);
    expect(stripHtmlToText('<<p>b>x')).not.toMatch(/<[a-z]/i);
    // unterminated trailing tag fragment is dropped, preceding text kept
    expect(stripHtmlToText('hello <a href="https://x')).toBe('hello');
  });

  it('does not double-unescape entities (CodeQL: &amp; decoded last)', () => {
    // "&amp;lt;b&amp;gt;" is the TEXT "&lt;b&gt;" — must not become "<b>"
    expect(stripHtmlToText('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;');
    expect(stripHtmlToText('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });
});
