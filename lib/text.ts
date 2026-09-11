// Strip common Markdown so a one-line PREVIEW (inbox row, notification, etc.)
// reads as plain text instead of leaking raw syntax like **bold** or [x](url).
// Not a full parser — just the marks that show up in chat/message content.
export function stripMarkdown(input?: string | null): string {
  if (!input) return '';
  return String(input)
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code blocks
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links -> label
    .replace(/(\*\*|__)(.*?)\1/g, '$2')        // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')           // italic
    .replace(/~~(.*?)~~/g, '$2')               // strikethrough
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')        // headings
    .replace(/^\s{0,3}>\s?/gm, '')             // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, '')         // list bullets
    .replace(/^\s{0,3}\d+\.\s+/gm, '')         // numbered lists
    .replace(/\r?\n+/g, ' ')                   // newlines -> space
    .replace(/\s+/g, ' ')                      // collapse whitespace
    .trim();
}
