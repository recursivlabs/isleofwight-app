import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';
import { haptics } from '../lib/haptics';

type FeedTab = 'foryou' | 'following';

interface Props {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
  /** Optional unread counts per tab; renders a small accent dot beside the label. */
  unread?: Partial<Record<FeedTab, number>>;
}

// Two jobs, no overlap. Latest was dropped — it duplicated Following
// without the follow filter and read as dead weight. Discover lives as
// its own primary tab on the bottom bar.
const TABS: { key: FeedTab; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'following', label: 'Following' },
];

export function FeedTabs({ active, onChange, unread }: Props) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Feed views"
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        const count = unread?.[key] || 0;
        return (
          <Pressable
            key={key}
            onPress={() => { haptics.select(); onChange(key); }}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            {...(Platform.OS === 'web' ? { 'aria-selected': isActive } as any : {})}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.sm,
              borderBottomWidth: 2,
              borderBottomColor: isActive ? colors.accent : 'transparent',
              opacity: pressed ? 0.8 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'border-color 0.15s ease' } as any : {}),
            })}
          >
            <Text
              variant={isActive ? 'bodyMedium' : 'body'}
              color={isActive ? colors.accent : colors.textMuted}
              style={{ fontSize: 16, letterSpacing: 0.2 }}
            >
              {label}
            </Text>
            {count > 0 && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accent,
                  marginTop: -12,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
