import * as React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';
import { spacing, borders } from '../constants/theme';
import { useColors } from '../lib/theme';

// Mirrors PostCard's compact layout: a left avatar column and a right content
// column (byline · body · action bar), with the same padding and bottom
// divider. Matching the real card means the shell paints in place and the
// swap to real posts doesn't shift the layout.
export const PostSkeleton = React.memo(function PostSkeleton() {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: borders.thin,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {/* Avatar column */}
      <Skeleton width={32} height={32} borderRadius={16} style={{ marginTop: 2 }} />
      {/* Content column */}
      <View style={{ flex: 1 }}>
        {/* Byline: name · handle · time */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginBottom: spacing.md }}>
          <Skeleton width={110} height={13} />
          <Skeleton width={60} height={11} />
          <Skeleton width={28} height={11} />
        </View>
        {/* Body */}
        <Skeleton width="95%" height={14} style={{ marginBottom: spacing.xs }} />
        <Skeleton width="80%" height={14} style={{ marginBottom: spacing.xs }} />
        <Skeleton width="55%" height={14} style={{ marginBottom: spacing.md }} />
        {/* Action bar */}
        <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.sm }}>
          <Skeleton width={44} height={12} />
          <Skeleton width={36} height={12} />
          <Skeleton width={36} height={12} />
        </View>
      </View>
    </View>
  );
});

export function FeedSkeletons({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} />
      ))}
    </View>
  );
}
