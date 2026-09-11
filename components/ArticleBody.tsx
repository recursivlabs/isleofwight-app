import * as React from 'react';
import { View, Platform, Linking } from 'react-native';
import { Text } from './Text';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import {
  decodeHtmlEntitiesOnce,
  isSafeUrl,
  looksLikeLegacyHtml,
  parseMarkdownBlocks,
  parseMarkdownSegments,
  renderMarkdownToHtml,
  restoreLostParagraphs,
  sanitizeLegacyHtml,
  type MarkdownBlock,
} from '../lib/markdown';

/**
 * The long-form reader.
 *
 * WHAT WAS WRONG
 * Two body paths existed and neither produced a formatted article:
 *  - Legacy HTML (most imported blogs) went through DOMPurify, which strips
 *    `style`. The surviving <h2>/<ul>/<blockquote> then landed in a div that
 *    styled only itself, so every structural element rendered at body weight
 *    and the article read as one undifferentiated slab.
 *  - Markdown got inline styles, but hardcoded dark-theme hex values and no
 *    control of measure, heading rhythm, quotes, images or rules.
 *  - Native got neither: `parseMarkdownSegments` is inline-only, so headings
 *    showed their literal "##" markers.
 *
 * WHAT THIS DOES
 * Web renders into a class-scoped stylesheet that owns every element, and asks
 * the markdown renderer for BARE tags so nothing inline outranks it. Native
 * renders real blocks from `parseMarkdownBlocks`. Both read from the theme, so
 * an article is legible in light mode as well as dark.
 */

/** Injected once per document. Scoped so it cannot leak into the rest of the app. */
function ArticleStyles({ colors }: { colors: ReturnType<typeof useColors> }) {
  if (Platform.OS !== 'web') return null;
  const WebStyle = 'style' as any;
  const css = `
.minds-article { color: ${colors.text}; font-size: 18px; line-height: 1.75; overflow-wrap: break-word; }
.minds-article > *:first-child { margin-top: 0; }
.minds-article > *:last-child { margin-bottom: 0; }

.minds-article h1, .minds-article h2, .minds-article h3,
.minds-article h4, .minds-article h5, .minds-article h6 {
  color: ${colors.text}; font-weight: 700; line-height: 1.25;
  letter-spacing: -0.02em; margin: 1.9em 0 0.55em;
}
.minds-article h1 { font-size: 1.72em; }
.minds-article h2 { font-size: 1.4em; }
.minds-article h3 { font-size: 1.18em; }
.minds-article h4, .minds-article h5, .minds-article h6 { font-size: 1em; letter-spacing: 0; }

.minds-article p { margin: 0 0 1.15em; }
.minds-article strong, .minds-article b { font-weight: 700; color: ${colors.text}; }
.minds-article em, .minds-article i { font-style: italic; }

.minds-article ul, .minds-article ol { margin: 0 0 1.15em; padding-left: 1.5em; }
.minds-article li { margin: 0.35em 0; padding-left: 0.15em; }
.minds-article li::marker { color: ${colors.textMuted}; }

.minds-article blockquote {
  margin: 1.5em 0; padding: 0.1em 0 0.1em 1.1em;
  border-left: 3px solid ${colors.accent};
  color: ${colors.textSecondary}; font-style: italic;
}

.minds-article a { color: ${colors.accent}; text-decoration: underline; text-underline-offset: 2px; }

.minds-article code {
  background: ${colors.surfaceHover}; color: ${colors.text};
  padding: 0.12em 0.38em; border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.86em;
}
.minds-article pre {
  background: ${colors.surfaceHover}; border: 1px solid ${colors.borderSubtle};
  padding: 14px 16px; border-radius: 10px; overflow-x: auto; margin: 1.5em 0;
}
.minds-article pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.6; }

.minds-article img { max-width: 100%; height: auto; border-radius: 12px; margin: 1.6em 0; display: block; }
.minds-article figure { margin: 1.6em 0; }
.minds-article figcaption { color: ${colors.textMuted}; font-size: 0.82em; margin-top: 0.6em; text-align: center; }

.minds-article hr { border: 0; border-top: 1px solid ${colors.border}; margin: 2.4em 0; }

/* A phone reading a long article wants a slightly tighter measure. */
@media (max-width: 640px) { .minds-article { font-size: 17px; } }
`;
  // A <style> element has no children API in React Native Web, so this is how
  // CSS gets in. The content is a constant built from theme tokens — no user
  // content reaches it.
  return (
    <WebStyle
      // biome-ignore lint/security/noDangerouslySetInnerHtml: constant stylesheet built from theme tokens, no user content.
      dangerouslySetInnerHTML={{ __html: css }}
    />
  );
}

function NativeBlocks({ blocks }: { blocks: MarkdownBlock[] }) {
  const colors = useColors();

  const inline = (text: string, keyBase: string) =>
    parseMarkdownSegments(text).map((seg, i) => {
      const k = `${keyBase}s${i}`;
      if (seg.type === 'bold') return <Text key={k} style={{ fontFamily: 'Roboto-Medium' }}>{seg.text}</Text>;
      if (seg.type === 'italic') return <Text key={k} style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
      if (seg.type === 'code') return <Text key={k} variant="mono" color={colors.textSecondary}>{seg.text}</Text>;
      if (seg.type === 'link') {
        return (
          <Text
            key={k}
            color={colors.accent}
            onPress={() => { if (isSafeUrl(seg.url)) Linking.openURL(seg.url).catch(() => {}); }}
          >
            {seg.text}
          </Text>
        );
      }
      if (seg.type === 'hashtag' || seg.type === 'mention') return <Text key={k} color={colors.accent}>{seg.text}</Text>;
      if (seg.type === 'break') return <Text key={k}>{'\n'}</Text>;
      return <Text key={k}>{seg.text}</Text>;
    });

  const HEADING = { 1: 26, 2: 21, 3: 18 } as const;

  return (
    <View>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        if (b.type === 'heading') {
          return (
            <Text
              key={k}
              style={{
                fontSize: HEADING[b.level],
                lineHeight: HEADING[b.level] * 1.28,
                fontFamily: 'Roboto-Bold',
                letterSpacing: -0.3,
                marginTop: i === 0 ? 0 : spacing['2xl'],
                marginBottom: spacing.sm,
              }}
            >
              {inline(b.text, k)}
            </Text>
          );
        }
        if (b.type === 'rule') {
          return <View key={k} style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing['2xl'] }} />;
        }
        if (b.type === 'quote') {
          return (
            <View
              key={k}
              style={{
                borderLeftWidth: 3, borderLeftColor: colors.accent,
                paddingLeft: spacing.lg, marginVertical: spacing.lg,
              }}
            >
              <Text style={{ fontSize: 17, lineHeight: 29, fontStyle: 'italic' }} color={colors.textSecondary}>
                {inline(b.text, k)}
              </Text>
            </View>
          );
        }
        if (b.type === 'code') {
          return (
            <View
              key={k}
              style={{
                backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.borderSubtle,
                borderRadius: radius.md, padding: spacing.lg, marginVertical: spacing.lg,
              }}
            >
              <Text variant="mono" style={{ fontSize: 13, lineHeight: 21 }} color={colors.textSecondary}>{b.text}</Text>
            </View>
          );
        }
        if (b.type === 'list') {
          return (
            <View key={k} style={{ marginBottom: spacing.lg, gap: 6 }}>
              {b.items.map((item, ii) => (
                <View key={`${k}i${ii}`} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Text style={{ fontSize: 17, lineHeight: 29 }} color={colors.textMuted}>
                    {b.ordered ? `${ii + 1}.` : '•'}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 17, lineHeight: 29 }}>{inline(item, `${k}i${ii}`)}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={k} style={{ fontSize: 17, lineHeight: 29, marginBottom: spacing.lg }}>
            {inline(b.text, k)}
          </Text>
        );
      })}
    </View>
  );
}

export function ArticleBody({ content }: { content: string }) {
  const colors = useColors();
  const isLegacyHtml = looksLikeLegacyHtml(content);

  if (Platform.OS === 'web') {
    const WebDiv = 'div' as any;
    const html = isLegacyHtml
      ? sanitizeLegacyHtml(content)
      // `bare` so the stylesheet above owns the typography. With inline styles
      // the renderer's hardcoded dark hexes would win and light mode would be
      // unreadable.
      : renderMarkdownToHtml(restoreLostParagraphs(decodeHtmlEntitiesOnce(content)), { bare: true });
    return (
      <>
        <ArticleStyles colors={colors} />
        <WebDiv
          className="minds-article"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is escaped by renderMarkdownToHtml and legacy HTML is allowlist-sanitized by DOMPurify.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </>
    );
  }

  // Native has no HTML: legacy markup is reduced to text, markdown becomes blocks.
  const source = isLegacyHtml ? htmlToMarkdownish(content) : restoreLostParagraphs(decodeHtmlEntitiesOnce(content));
  return <NativeBlocks blocks={parseMarkdownBlocks(source)} />;
}

/**
 * Legacy HTML → something the block parser understands, so a native reader gets
 * headings and bullets instead of one flat wall. Deliberately small: the blocks
 * that carry an article's structure, and nothing else.
 */
function htmlToMarkdownish(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|blockquote)\s*>/gi, '\n\n')
    .replace(/<\s*h1[^>]*>/gi, '\n# ')
    .replace(/<\s*h2[^>]*>/gi, '\n## ')
    .replace(/<\s*h[3-6][^>]*>/gi, '\n### ')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*blockquote[^>]*>/gi, '\n> ')
    .replace(/<\s*hr\s*\/?\s*>/gi, '\n---\n')
    .replace(/<\s*(strong|b)\s*>/gi, '**').replace(/<\s*\/\s*(strong|b)\s*>/gi, '**')
    .replace(/<\s*(em|i)\s*>/gi, '*').replace(/<\s*\/\s*(em|i)\s*>/gi, '*')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
