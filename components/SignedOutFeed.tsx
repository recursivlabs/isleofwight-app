import * as React from 'react';
import { View, FlatList, ActivityIndicator, Pressable, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Text } from './Text';
import { PostCard } from './PostCard';
import { Button } from './Button';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import { useSignedOutFeed } from '../lib/hooks';
import { otpSignInPath } from '../lib/authRedirect';

/**
 * The app, signed out: the real feed, read-only. A visitor scrolls the
 * newest public posts on the same cards a member sees; every vote, reply,
 * remind, follow or post on a card already asks them to sign in. The one
 * addition is a quiet card at the top that says so.
 */
export function SignedOutFeed({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useColors();
  const { posts, loading, hasMore, error, loadMore, refresh } = useSignedOutFeed(20);
  const back = returnTo || pathname || '/discover';

  const header = (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm }}>
      <View style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.borderSubtle, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
        <Text variant="h3" color={colors.text}>You are looking at Isle of Wight Social</Text>
        <Text variant="body" color={colors.textSecondary}>
          The newest public posts, live. Sign in to vote, reply, remind, follow people and join groups.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
          <Button size="sm" onPress={() => router.push(otpSignInPath(back) as any)}>Sign in</Button>
          <Button size="sm" variant="secondary" onPress={() => router.push(otpSignInPath(back) as any)}>Create account</Button>
        </View>
      </View>
    </View>
  );

  return (
    <FlatList
      data={posts}
      keyExtractor={(item: any) => item.id}
      renderItem={({ item }) => <PostCard post={item} compact />}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <View style={{ padding: spacing['3xl'], alignItems: 'center' }}><ActivityIndicator color={colors.accent} /></View>
        ) : (
          <View style={{ padding: spacing['3xl'], alignItems: 'center', gap: spacing.md }}>
            <Text variant="body" color={colors.textMuted}>{error || 'Nothing to show yet'}</Text>
            {error ? <Button size="sm" variant="secondary" onPress={refresh}>Try again</Button> : null}
          </View>
        )
      }
      ListFooterComponent={
        hasMore && posts.length > 0 ? (
          <Pressable onPress={() => loadMore()} style={{ padding: spacing.xl, alignItems: 'center', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) }}>
            <Text variant="bodyMedium" color={colors.accent}>Show more</Text>
          </Pressable>
        ) : null
      }
      onEndReached={() => { loadMore(); }}
      onEndReachedThreshold={0.6}
      showsVerticalScrollIndicator={false}
    />
  );
}
