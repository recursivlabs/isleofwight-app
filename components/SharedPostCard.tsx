import * as React from 'react';
import { View, Pressable, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import { getCached, setCache } from '../lib/cache';
import { postThumb } from '../lib/discover';
import { captureException } from '../lib/monitoring';

/**
 * A Minds post shared into a chat, rendered as a rich embed (author + snippet +
 * thumbnail) that taps back to the post — X/IG parity for shared links.
 */
export function SharedPostCard({ postId }: { postId: string }) {
  const colors = useColors();
  const router = useRouter();
  const { sdk } = useAuth();
  const [post, setPost] = React.useState<any>(() => getCached(`post:${postId}`) || null);
  const [loadError, setLoadError] = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryCount intentionally restarts a failed request.
  React.useEffect(() => {
    if (post || !sdk || !postId) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (typeof (sdk as any).posts?.get !== 'function') {
          throw new Error('Post preview is unavailable');
        }
        // Call through the resource so the SDK method keeps its client binding.
        const response = await (sdk as any).posts.get(postId);
        if (!response?.data) throw new Error('Post preview returned no post');
        if (!cancelled) {
          setPost(response.data);
          setCache(`post:${postId}`, response.data);
        }
      } catch (error) {
        if (!cancelled) {
          captureException(error, { component: 'SharedPostCard', postId });
          setLoadError(true);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sdk, postId, post, retryCount]);

  const author = post?.author || post?.user || {};
  const name = author.name || author.username || 'Post';
  const text = String(post?.content || post?.body || post?.title || '').trim();
  const thumb = post ? postThumb(post).url : null;

  return (
    <View style={{
      borderWidth: 0.5,
      borderColor: colors.borderSubtle,
      borderRadius: radius.md,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      minWidth: 220,
      maxWidth: 300,
    }}>
      <Pressable
        onPress={() => router.push(`/post/${postId}` as any)}
        accessibilityRole="link"
        accessibilityLabel="Open shared post"
        style={({ pressed, hovered }: any) => ({
          backgroundColor: pressed || hovered ? colors.surfaceHover : colors.surface,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
        })}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={{ width: '100%', height: 120, backgroundColor: colors.surfaceHover }} resizeMode="cover" />
        ) : null}
        <View style={{ padding: spacing.md, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Avatar uri={author.image || author.avatar} name={name} size="xs" />
            <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1, fontWeight: '600' }}>{name}</Text>
          </View>
          {text ? (
            <Text variant="caption" color={colors.text} numberOfLines={3} style={{ lineHeight: 17 }}>{text}</Text>
          ) : (
            <Text variant="caption" color={colors.textMuted}>
              {post ? 'View post' : loadError ? 'Post preview unavailable' : 'Loading post…'}
            </Text>
          )}
          <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>Open post ›</Text>
        </View>
      </Pressable>
      {loadError ? (
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <Button
            onPress={() => {
              setLoadError(false);
              setRetryCount(count => count + 1);
            }}
            variant="secondary"
            size="sm"
            fullWidth
          >
            Retry post preview
          </Button>
        </View>
      ) : null}
    </View>
  );
}
