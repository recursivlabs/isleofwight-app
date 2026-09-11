/**
 * One way to find a URL in text, and one way to decide where it ends.
 *
 * There were three, and all three got brackets wrong, differently:
 *
 *   lib/markdown.ts     excluded ( and ) from the URL entirely, so the CLICKABLE
 *                       link for `.../Frost_flower_(sea_ice)` stopped at
 *                       `.../Frost_flower_` — the visible link was broken.
 *   LinkPreview.tsx     allowed them, then stripped a trailing ) always, giving
 *                       `.../Frost_flower_(sea_ice` — a 404 upstream, which is
 *                       why that preview came back blank.
 *   PostCard.tsx        same unconditional strip via a regex replace.
 *
 * A trailing bracket is genuinely ambiguous: it ends the URL in
 * "see (https://example.com/a)" and belongs to it in
 * ".../Frost_flower_(sea_ice)". Counting decides it — the same rule GitHub,
 * Twitter and markdown-it use. Sentence punctuation is never part of a URL and
 * is always trimmed.
 */

/**
 * Characters that may appear in a URL as we scan text.
 *
 * Brackets ARE included; where the URL ends is settled by {@link trimUrlEnd},
 * not by refusing to match them. Excluded are whitespace and the characters
 * that cannot appear unescaped in a URL, plus quotes, which in practice always
 * delimit rather than belong.
 */
export const URL_PATTERN_SOURCE = 'https?:\\/\\/[^\\s<>"\'`{}|\\\\^]+';

/** Sentence punctuation that never ends a URL. */
const ALWAYS_TRIM = new Set(['.', ',', ';', ':', '!', '?']);

/** Closing brackets, kept only when the URL opens them itself. */
const CLOSERS: Record<string, string> = { ')': '(', ']': '[' };

/**
 * A Unicode ellipsis at the end of a visible URL is a display truncation, not
 * a usable destination. Imported legacy posts can contain these shortened
 * strings verbatim; linking them guarantees a broken navigation and also
 * triggers a pointless link-preview request.
 */
export function isLikelyTruncatedUrl(url: string): boolean {
  return url.endsWith('…');
}

/**
 * Trim characters that trail a URL rather than belong to it.
 *
 * A closing bracket is kept when the URL contains an unmatched opener, so
 * `.../Frost_flower_(sea_ice)` survives intact while the `)` in
 * `see (https://example.com/a)` is dropped.
 */
export function trimUrlEnd(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (ALWAYS_TRIM.has(ch)) {
      end -= 1;
      continue;
    }
    const opener = CLOSERS[ch];
    if (opener) {
      const candidate = url.slice(0, end);
      let opens = 0;
      let closes = 0;
      for (const c of candidate) {
        if (c === opener) opens += 1;
        else if (c === ch) closes += 1;
      }
      // More closers than openers: the last one is not ours.
      if (closes > opens) {
        end -= 1;
        continue;
      }
    }
    break;
  }
  return url.slice(0, end);
}

/** Every URL in `text`, in order, with trailing punctuation trimmed. */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const re = new RegExp(URL_PATTERN_SOURCE, 'g');
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const trimmed = trimUrlEnd(m[0]);
    if (trimmed && !isLikelyTruncatedUrl(trimmed)) out.push(trimmed);
  }
  return out;
}

/** The first URL in `text`, or null. */
export function extractFirstUrl(text: string): string | null {
  return extractUrls(text)[0] ?? null;
}
