import { Platform } from 'react-native';
import { useColors } from '../lib/theme';

/**
 * Theme-aware styling for inline markdown bodies — feed cards and chat.
 *
 * WHAT THIS REPLACES
 * `renderMarkdownToHtml` bakes literal hex values into every tag it emits:
 * `#1a1a1e` behind code and pre, `#a0a0a8` for their text, `#1f5fa8` for links.
 * Those were chosen for the dark theme and never change, so in light mode a post
 * containing code renders a near-black slab, and every link is the dark-theme
 * gold rather than the accent the rest of the page uses.
 *
 * ChatBubble had already noticed and was string-replacing those hexes out of the
 * generated HTML at render time:
 *
 *     .replace(/color:#1f5fa8/g, `color:${linkColor}`)
 *
 * which only works while nobody changes the renderer's palette, and does nothing
 * about the backgrounds. Feed cards did not even do that.
 *
 * So: ask the renderer for BARE tags and let a stylesheet built from the theme
 * own the appearance. Inline styles beat any stylesheet, which is exactly why
 * the old output could not be corrected from outside.
 *
 * Scope it with MARKDOWN_CLASS. Add OWN_CLASS alongside it for a bubble the
 * viewer sent, where the surface is the accent and the text is inverted.
 */

export const MARKDOWN_CLASS = 'minds-md';
export const OWN_CLASS = 'minds-md-own';

export function MarkdownScopedStyles() {
  const colors = useColors();
  if (Platform.OS !== 'web') return null;
  const WebStyle = 'style' as any;

  const css = `
.${MARKDOWN_CLASS} strong, .${MARKDOWN_CLASS} b { font-weight: 700; }
.${MARKDOWN_CLASS} em, .${MARKDOWN_CLASS} i { font-style: italic; }

.${MARKDOWN_CLASS} a { color: ${colors.accent}; text-decoration: underline; text-underline-offset: 2px; }

.${MARKDOWN_CLASS} code {
  background: ${colors.surfaceHover}; color: ${colors.text};
  padding: 0.1em 0.35em; border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.87em;
}
.${MARKDOWN_CLASS} pre {
  background: ${colors.surfaceHover}; border: 1px solid ${colors.borderSubtle};
  padding: 10px 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0;
}
.${MARKDOWN_CLASS} pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.55; }

.${MARKDOWN_CLASS} ul, .${MARKDOWN_CLASS} ol { margin: 6px 0; padding-left: 1.4em; }
.${MARKDOWN_CLASS} li { margin: 2px 0; }
.${MARKDOWN_CLASS} li::marker { color: ${colors.textMuted}; }

.${MARKDOWN_CLASS} h1, .${MARKDOWN_CLASS} h2, .${MARKDOWN_CLASS} h3 {
  font-weight: 700; line-height: 1.3; margin: 12px 0 4px;
}
.${MARKDOWN_CLASS} h1 { font-size: 1.4em; }
.${MARKDOWN_CLASS} h2 { font-size: 1.2em; }
.${MARKDOWN_CLASS} h3 { font-size: 1.05em; }

/* A bubble the viewer sent sits on the accent, so its own text is inverted and
   the link cannot be the accent against itself. */
.${OWN_CLASS} a { color: ${colors.textInverse}; text-decoration: underline; }
.${OWN_CLASS} code, .${OWN_CLASS} pre {
  background: rgba(0,0,0,0.16); border-color: rgba(0,0,0,0.14); color: ${colors.textInverse};
}
.${OWN_CLASS} li::marker { color: ${colors.textInverse}; }
`;

  return (
    <WebStyle
      // biome-ignore lint/security/noDangerouslySetInnerHtml: constant stylesheet built from theme tokens, no user content.
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}
