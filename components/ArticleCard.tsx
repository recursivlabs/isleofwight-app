/**
 * Article rendering — X-style long-form. Two modes from one component:
 *  - feed (default): a compact card — cover + title + excerpt + "N min read".
 *    Distinct from a text post so migrated blogs read as articles, not walls of text.
 *  - full: the reader — cover hero, large title, byline meta, rendered markdown body.
 *
 * An "article" is just a post with a title + markdown body (see isArticlePost);
 * the ~2.4M legacy blogs import as exactly that, so they light up here for free.
 */
import * as React from 'react';
import { View, Image, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { useColors } from '../lib/theme';
import { spacing, radius, typography } from '../constants/theme';
import {
  looksLikeLegacyHtml,
  decodeHtmlEntitiesOnce,
  parseMarkdownSegments,
  renderMarkdownToHtml,
  sanitizeLegacyHtml,
  stripHtmlToText,
} from '../lib/markdown';
import { postTitle, articleExcerpt, coverImageUrl, readingTimeMinutes } from '../lib/models';
import { ArticleBody } from './ArticleBody';


export function ArticleCard({ post, full = false, onPress }: { post: any; full?: boolean; onPress?: () => void }) {
  const colors = useColors();
  const title = postTitle(post);
  const cover = coverImageUrl(post);
  const [failedCover, setFailedCover] = React.useState<string | null>(null);
  const visibleCover = cover && failedCover !== cover ? cover : null;
  const readMin = readingTimeMinutes(post);

  if (full) {
    return (
      <View style={{ marginTop: spacing.md }}>
        {visibleCover ? (
          <Image
            source={{ uri: visibleCover }}
            onError={() => setFailedCover(visibleCover)}
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, marginBottom: spacing.lg }}
            resizeMode="cover"
          />
        ) : null}
        <Text style={{ ...typography.h1, color: colors.text }}>{title}</Text>
        <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
          {readMin} min read
        </Text>
        <ArticleBody content={(post?.content ?? '').toString()} />
      </View>
    );
  }

  // Compact feed card.
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          marginTop: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        },
        Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null,
      ]}
    >
      {visibleCover ? (
        <Image source={{ uri: visibleCover }} onError={() => setFailedCover(visibleCover)} style={{ width: '100%', aspectRatio: 16 / 9 }} resizeMode="cover" />
      ) : null}
      <View style={{ padding: spacing.md, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="label" color={colors.accent}>
            ARTICLE
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            · {readMin} min read
          </Text>
        </View>
        <Text variant="h3" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="body" color={colors.textSecondary} numberOfLines={2}>
          {articleExcerpt(post)}
        </Text>
      </View>
    </Pressable>
  );
}
