import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';
import { useSmartBack } from '../lib/navigation';

interface Props {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

/**
 * Consistent screen header used across all pages.
 * Same height, same padding, same border treatment.
 */
export const ScreenHeader = React.memo(function ScreenHeader({ title, showBack = true, right }: Props) {
  const goBack = useSmartBack();
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        minHeight: 52,
      }}
    >
      {showBack && (
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      )}
      <Text
        variant="h3"
        accessibilityRole="header"
        aria-level={1}
        style={{ flex: 1 }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {right || null}
    </View>
  );
});
