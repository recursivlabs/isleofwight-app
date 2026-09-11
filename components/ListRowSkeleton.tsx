import * as React from 'react';
import { View } from 'react-native';
import { Skeleton } from './Skeleton';
import { spacing } from '../constants/theme';

/**
 * Placeholder rows for a list that is still loading.
 *
 * A centred spinner tells the reader only that something is missing, and the
 * layout jumps when the real rows arrive. Painting the row's own shape means the
 * swap is a fill rather than a lurch, and a slow network reads as "nearly there"
 * instead of "broken".
 *
 * The metrics mirror the avatar-plus-two-lines row used by the discovery lists
 * and the sidebar. If those change, change these — a skeleton that lies about
 * the layout is worse than none, because the swap moves everything anyway.
 */
export function ListRowSkeletons({
  count = 6,
  avatarSize = 44,
  paddingHorizontal = spacing.xl,
}: {
  count?: number;
  avatarSize?: number;
  paddingHorizontal?: number;
}) {
  return (
    <View accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal,
            paddingVertical: spacing.md,
          }}
        >
          <Skeleton width={avatarSize} height={avatarSize} borderRadius={avatarSize / 2} />
          <View style={{ flex: 1, gap: 7 }}>
            <Skeleton width={`${52 + ((i * 7) % 26)}%`} height={14} />
            <Skeleton width={`${30 + ((i * 5) % 18)}%`} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Placeholder for a form that is still loading its values: a label and a field,
 * repeated. Used where a screen would otherwise render the word "Loading…".
 */
export function FormSkeletons({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: spacing.xl }} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ gap: spacing.sm }}>
          <Skeleton width={`${22 + ((i * 6) % 14)}%`} height={12} />
          <Skeleton width="100%" height={i === count - 1 ? 96 : 42} borderRadius={10} />
        </View>
      ))}
    </View>
  );
}
