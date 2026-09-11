import * as React from 'react';
import { View, ScrollView, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Tab {
  key: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
  scrollable?: boolean;
  accessibilityLabel?: string;
}

/**
 * Consistent tab bar used across Feed, Discover, Create, and any
 * screen that needs horizontal tabs. Underline style, same spacing
 * and typography everywhere.
 */
export const TabBar = React.memo(function TabBar({ tabs, active, onChange, scrollable = false, accessibilityLabel }: Props) {
  const colors = useColors();
  const content = (
    <>
      {tabs.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            aria-selected={isActive}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderBottomWidth: 2,
              borderBottomColor: isActive ? colors.accent : 'transparent',
              opacity: pressed ? 0.8 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'border-color 0.15s ease' } as any : {}),
            })}
          >
            <Text
              variant={isActive ? 'bodyMedium' : 'body'}
              color={isActive ? colors.accent : colors.textMuted}
              style={{ fontSize: 15 }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </>
  );

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          gap: spacing.xs,
        }}
        style={{
          flexGrow: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        gap: spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {content}
    </View>
  );
});
