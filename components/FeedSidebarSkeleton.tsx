import * as React from 'react';
import { View } from 'react-native';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

/**
 * The shape of the sidebar, before its contents arrive.
 *
 * WHY NOT A SPINNER
 * A centred spinner over the words "Loading recommendations…" tells the reader
 * nothing except that something is missing, and it makes the rail lurch when the
 * real cards replace it. This paints the SAME frames the real sidebar uses —
 * two cards, a header, three rows of avatar plus two lines — so the arrival is a
 * fill rather than a jump, and a slow network reads as "nearly there" instead of
 * "broken".
 *
 * It must keep matching FeedSidebar's SidebarSection/SidebarItem metrics: a
 * skeleton that lies about the layout is worse than none, because the swap moves
 * everything anyway.
 */
function SkeletonRow() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <Skeleton width={32} height={32} borderRadius={16} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="40%" height={11} />
      </View>
    </View>
  );
}

function SkeletonSection({ rows = 3 }: { rows?: number }) {
  const colors = useColors();
  return (
    <Card style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }}>
      {/* Header: icon + label on the left, "See all" on the right. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Skeleton width={15} height={15} borderRadius={radius.sm} />
          <Skeleton width={104} height={13} />
        </View>
        <Skeleton width={38} height={11} />
      </View>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </Card>
  );
}

export function FeedSidebarSkeleton() {
  return (
    <View style={{ gap: spacing.lg }} accessibilityLabel="Loading recommendations">
      <SkeletonSection rows={3} />
      <SkeletonSection rows={3} />
    </View>
  );
}
