import { Platform } from 'react-native';
import { isLikelyTruncatedUrl, trimUrlEnd } from './urls';

/**
 * Markdown link/bare-URL destinations are attacker-controlled post content that
 * ends up in `href` (web) and `Linking.openURL` (native). Only allow schemes
 * that can't execute script or smuggle credentials — everything else
 * (javascript:, data:, vbscript:, intent:, file:, ...) renders as plain text.
 */
const SAFE_URL_SCHEME = /^(https?:|mailto:)/i;

export function isSafeUrl(url: string): boolean {
  return SAFE_URL_SCHEME.test(url.trim());
}

// The global entity-escape pass below covers & < > but not quotes, so any
// value placed inside an HTML attribute must escape them too or the URL can
// break out of the href and inject handlers.
const escapeAttr = (value: string): string =>
  value.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Simple markdown-to-HTML converter for web.
 * Handles: **bold**, *italic*, `code`, [links](url), and line breaks.
 * No external dependencies.
 */
export function renderMarkdownToHtml(
  text: string,
  opts?: { bare?: boolean },
): string {
  if (!text) return '';
  // `bare` drops the inline styles. Inline styles beat any stylesheet, so the
  // article reader — which wants to control its own typography, and to be
  // theme-aware rather than hardcoded dark — asks for semantic tags only.
  // Feed cards and chat bubbles keep the inline styles they already rely on.
  const bare = !!opts?.bare;
  const sty = (css: string) => (bare ? '' : ` style="${css}"`);

  // Placeholder tokens protect already-linked content from later linkification.
  // Without this, bare-URL detection would re-match URLs that are already
  // inside a markdown `[text](url)` link or an HTML anchor we just emitted.
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const idx = placeholders.length;
    placeholders.push(html);
    return `\u0000${idx}\u0000`;
  };

  // 1. Escape entities, then stash multi-line code blocks as single tokens so
  //    the line-by-line block pass below never splits them.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, (_m, code) => stash(`<pre${sty('background:#1a1a1e;padding:8px 12px;border-radius:6px;overflow-x:auto;font-family:monospace;font-size:13px;color:#a0a0a8;margin:8px 0')}><code>${code}</code></pre>`));

  // 2. Inline formatting applied to a single line's content.
  const inline = (line: string): string => line
    .replace(/`([^`]+)`/g, (_m, code) => stash(`<code${sty('background:#1a1a1e;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;color:#a0a0a8')}>${code}</code>`))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) => (
      isSafeUrl(url)
        ? stash(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:#0ea5e9;text-decoration:underline">${label}</a>`)
        : m
    ))
    .replace(/\bhttps?:\/\/[^\s<>"'`{}|\\^]+/g, (m) => {
      // trimUrlEnd keeps a bracket the URL opened itself. Excluding brackets
      // from the pattern, as this did, truncated .../Frost_flower_(sea_ice) to
      // .../Frost_flower_ and produced a broken link.
      const url = trimUrlEnd(m);
      if (isLikelyTruncatedUrl(url)) return m;
      const trailing = m.slice(url.length);
      return `${stash(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" style="color:#0ea5e9;text-decoration:underline">${url}</a>`)}${trailing}`;
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/(^|\s)#([a-zA-Z0-9_]+)/g, (_m, lead, tag) => `${lead}${stash(`<a href="/discover/posts?q=%23${tag}" style="color:#0ea5e9;text-decoration:none">#${tag}</a>`)}`)
    .replace(/(^|\s)@([a-zA-Z0-9_]+)/g, (_m, lead, name) => `${lead}${stash(`<a href="/${name}" style="color:#0ea5e9;text-decoration:none">@${name}</a>`)}`);

  // 3. Block pass: walk lines so bullet/numbered lists and headings render as
  //    real <ul>/<ol>/<h*> instead of leaking raw "-", "*", "#" markers.
  const lines = escaped.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };
  const openList = (t: 'ul' | 'ol') => {
    if (listType !== t) {
      closeList();
      out.push(t === 'ul' ? `<ul${sty('margin:6px 0;padding-left:22px')}>` : `<ol${sty('margin:6px 0;padding-left:22px')}>`);
      listType = t;
    }
  };

  for (const line of lines) {
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    if (ul) {
      openList('ul');
      out.push(`<li${sty('margin:2px 0')}>${inline(ul[1])}</li>`);
    } else if (ol) {
      openList('ol');
      out.push(`<li${sty('margin:2px 0')}>${inline(ol[1])}</li>`);
    } else if (h3) {
      closeList(); out.push(`<h3${sty('font-size:18px;font-weight:600;margin:12px 0 4px')}>${inline(h3[1])}</h3>`);
    } else if (h2) {
      closeList(); out.push(`<h2${sty('font-size:22px;font-weight:600;margin:12px 0 4px')}>${inline(h2[1])}</h2>`);
    } else if (h1) {
      closeList(); out.push(`<h1${sty('font-size:28px;font-weight:700;margin:12px 0 4px')}>${inline(h1[1])}</h1>`);
    } else if (line.trim() === '') {
      closeList(); out.push('<br />');
    } else {
      closeList(); out.push(`${inline(line)}<br />`);
    }
  }
  closeList();

  let html = out.join('');

  // Restore stashed tokens
  html = html.replace(/\u0000(\d+)\u0000/g, (_m, idx) => placeholders[Number(idx)] || '');

  return html;
}

/**
 * ── Legacy Minds HTML content ────────────────────────────────────────────────
 * Migrated blog/article bodies (and some link-share posts) are stored as raw
 * HTML. The markdown pipeline above entity-escapes everything (correct XSS
 * stance for user text), which made legacy articles render as visible tag
 * soup. These helpers give legacy HTML a dedicated, sanitized path:
 *   web    → DOMPurify with a tight allowlist (+ forced safe link/img attrs)
 *   native → tags stripped to readable plain text (RN can't render HTML)
 */
const LEGACY_HTML_TAG =
  /<\/?(p|div|a|img|br|h[1-6]|ul|ol|li|blockquote|strong|em|b|i|u|s|span|figure|figcaption|pre|code|hr)\b[^>]*>/i;

export function looksLikeLegacyHtml(text: string): boolean {
  return !!text && LEGACY_HTML_TAG.test(text);
}

/**
 * Decode one layer of the HTML entities left behind by the legacy blog export.
 *
 * Some imported articles contain real HTML tags, while others are plain text
 * with entities such as `&nbsp;` and `&quot;`. The latter must not go through
 * the HTML sanitizer, but rendering them as ordinary markdown leaks the entity
 * spelling into the article. Decode exactly once so `&amp;lt;` cannot become a
 * live `<` in the same pass; the markdown renderer still escapes the result.
 */
export function decodeHtmlEntitiesOnce(text: string): string {
  if (!text) return '';
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return text.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
    try {
      const decoded = String.fromCodePoint(codePoint);
      return decoded === '\u00a0' ? ' ' : decoded;
    } catch {
      return match;
    }
  });
}

/**
 * Put paragraph breaks back into a legacy article that lost them.
 *
 * The legacy blog import stripped HTML tags without turning `</p>` into a
 * newline, so a five-paragraph article arrived as one line: "…the
 * difference.One of our main goals…". The seam is unmistakable in prose: a
 * sentence-ending mark (or a comma after a salutation) followed by a capital
 * letter with no space between. Real prose always has a space there, so each
 * seam gets a paragraph break. Domains and numbers are safe: they continue in
 * lowercase or digits, which the pattern ignores.
 *
 * Only a body with NO line breaks at all is touched. An article that kept
 * its structure is left exactly as written.
 */
export function restoreLostParagraphs(text: string): string {
  if (!text || text.includes('\n')) return text;
  const seam = /([.!?,;:]["\u201d\u2019')\]]?)(?=[A-Z\u201c"(])/g;
  if (!seam.test(text)) return text;
  return text.replace(seam, '$1\n\n');
}

/** Strip HTML to readable plain text (native rendering + compact previews). */
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  let out = html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/blockquote)[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ');
  // Tag strip must run to a FIXED POINT: a single pass lets crafted nesting
  // like "<scr<script>ipt>" re-form a tag from the residue (CodeQL:
  // incomplete multi-character sanitization). Loop until stable, then drop
  // any unterminated trailing "<tag..." fragment.
  let prev;
  do { prev = out; out = out.replace(/<[^>]*>/g, ''); } while (out !== prev);
  out = out.replace(/<[a-z/][^<]*$/gi, '');
  // Decode one layer only: `&amp;lt;` remains `&lt;`, never a manufactured tag.
  return decodeHtmlEntitiesOnce(out)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Lazily initialized so the native bundle never touches DOMPurify (web-only).
let purifier: any = null;
function getPurifier(): any {
  if (purifier || Platform.OS !== 'web' || typeof window === 'undefined') return purifier;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const DOMPurify = require('dompurify');
  const instance = DOMPurify.default ?? DOMPurify;
  // Hard URI policy: href/src must be http(s)/mailto — enforced with an
  // explicit hook rather than relying on ALLOWED_URI_REGEXP semantics alone
  // (regression test caught data: image URIs surviving the config route).
  instance.addHook('uponSanitizeAttribute', (_node: Element, data: any) => {
    if ((data.attrName === 'src' || data.attrName === 'href')
        && !/^(?:https?:|mailto:)/i.test(String(data.attrValue || '').trim())) {
      data.keepAttr = false;
    }
  });
  // Every sanitized link opens in a new tab without opener access; every image
  // is bounded to the card. Styles are OURS (attacker style attrs are stripped
  // by the allowlist), applied post-sanitize so they can't be smuggled in.
  instance.addHook('afterSanitizeAttributes', (node: Element) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('style', 'color:#0ea5e9;text-decoration:underline');
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
      node.setAttribute('style', 'max-width:100%;height:auto;border-radius:8px;margin:8px 0');
    }
    if (node.tagName === 'P') node.setAttribute('style', 'margin:8px 0');
    if (node.tagName === 'BLOCKQUOTE') {
      node.setAttribute('style', 'border-left:3px solid #0ea5e9;margin:8px 0;padding-left:12px;opacity:.9');
    }
  });
  purifier = instance;
  return purifier;
}

/**
 * Sanitize legacy HTML for web rendering. Allowlist only — script/style/
 * iframe/event handlers/javascript: URLs are all removed by construction.
 * Returns '' on native (callers must use stripHtmlToText there).
 */
export function sanitizeLegacyHtml(html: string): string {
  const p = getPurifier();
  if (!p) return '';
  return p.sanitize(html, {
    ALLOWED_TAGS: ['p','div','a','img','br','h1','h2','h3','h4','h5','h6','ul','ol','li',
                   'blockquote','strong','em','b','i','u','s','span','figure','figcaption','pre','code','hr'],
    ALLOWED_ATTR: ['href','src','alt','title'],
    // data-*/aria-* are separate gates in DOMPurify — allowed by default even
    // when ALLOWED_ATTR is set. Close them explicitly.
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
  });
}

/**
 * Parse markdown into simple segments for native rendering.
 * Returns an array of { type, text, url? } segments.
 */
export type MarkdownSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'hashtag'; text: string; tag: string }
  | { type: 'mention'; text: string; username: string }
  | { type: 'break' };

export function parseMarkdownSegments(text: string): MarkdownSegment[] {
  if (!text) return [];
  // Render line-start bullet markers as real bullets on native (the inline
  // tokenizer below has no block/list concept). "- item" / "* item" → "• item".
  text = text.replace(/^[ \t]*[-*]\s+/gm, '• ');
  const segments: MarkdownSegment[] = [];
  // Order matters: markdown link `[text](url)` is matched before the bare URL
  // pattern so that URLs inside markdown brackets aren't double-linkified.
  const pattern = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))|(?:^|\s)(#([a-zA-Z0-9_]+))|(\n)|(\bhttps?:\/\/[^\s<>"'`{}|\\^]+)|((?:^|\s))(@([a-zA-Z0-9_]+))/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      segments.push({ type: 'bold', text: match[2] });
    } else if (match[3]) {
      segments.push({ type: 'italic', text: match[4] });
    } else if (match[5]) {
      segments.push({ type: 'code', text: match[6] });
    } else if (match[7]) {
      // Markdown link [text](url) — unsafe schemes stay plain text so they
      // never reach Linking.openURL on native or an href on web.
      if (isSafeUrl(match[9])) {
        segments.push({ type: 'link', text: match[8], url: match[9] });
      } else {
        segments.push({ type: 'text', text: match[7] });
      }
    } else if (match[10]) {
      segments.push({ type: 'hashtag', text: `#${match[11]}`, tag: match[11] });
    } else if (match[12]) {
      segments.push({ type: 'break' });
    } else if (match[13]) {
      // Bare URL. See trimUrlEnd: which trailing bracket belongs to the URL is
      // decided by counting, not by refusing to match brackets at all.
      const raw = match[13];
      const url = trimUrlEnd(raw);
      const trailing = raw.slice(url.length);
      if (isLikelyTruncatedUrl(url)) {
        segments.push({ type: 'text', text: url });
      } else {
        segments.push({ type: 'link', text: url, url });
      }
      if (trailing) segments.push({ type: 'text', text: trailing });
    } else if (match[15]) {
      // @mention — re-emit the captured leading whitespace (so it doesn't glue
      // to the prior word) then the linkified handle.
      if (match[14]) segments.push({ type: 'text', text: match[14] });
      segments.push({ type: 'mention', text: `@${match[16]}`, username: match[16] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Block-level markdown, for surfaces that cannot use HTML (native).
 *
 * `parseMarkdownSegments` is INLINE only — it has no concept of a heading or a
 * list, and fakes bullets by rewriting "- " to "• ". That is fine for a feed
 * card, but an article rendered that way shows its "##" markers as literal text
 * and loses every structural cue. This returns real blocks; the caller styles
 * them and runs `parseMarkdownSegments` over each block's text for inline
 * formatting.
 */
export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'rule' };

export function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  if (!text) return [];
  const blocks: MarkdownBlock[] = [];
  const lines = text.split('\n');

  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let fence: string[] | null = null;

  const flushPara = () => {
    if (para.length) {
      const joined = para.join(' ').trim();
      if (joined) blocks.push({ type: 'paragraph', text: joined });
      para = [];
    }
  };
  const flushList = () => {
    if (list?.items.length) blocks.push({ type: 'list', ...list });
    list = null;
  };
  const flushAll = () => { flushPara(); flushList(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    // Fenced code runs verbatim until it closes, so nothing inside it is parsed.
    if (/^\s*```/.test(line)) {
      if (fence) { blocks.push({ type: 'code', text: fence.join('\n') }); fence = null; }
      else { flushAll(); fence = []; }
      continue;
    }
    if (fence) { fence.push(raw); continue; }

    if (!line.trim()) { flushAll(); continue; }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) { flushAll(); blocks.push({ type: 'rule' }); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushAll();
      blocks.push({ type: 'heading', level: h[1].length as 1 | 2 | 3, text: h[2].trim() });
      continue;
    }

    const q = line.match(/^\s*>\s?(.*)$/);
    if (q) { flushAll(); blocks.push({ type: 'quote', text: q[1].trim() }); continue; }

    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const ordered = !!ol;
      flushPara();
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] }; }
      list.items.push(((ul ? ul[1] : ol?.[1]) || '').trim());
      continue;
    }

    flushList();
    para.push(line.trim());
  }

  if (fence) blocks.push({ type: 'code', text: fence.join('\n') });
  flushAll();
  return blocks;
}
