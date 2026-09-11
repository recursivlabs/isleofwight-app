import * as React from 'react';
import { TextInput, type TextInputProps, View, Platform } from 'react-native';
import { Text } from './Text';
import { spacing, radius, typography } from '../constants/theme';
import { useTheme } from '../lib/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, style, ...props }: Props) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = React.useState(false);

  return (
    <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
      {label ? (
        <Text variant="label" color={colors.textSecondary}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        // iOS keyboard chrome matches the app theme (a light keyboard over the
        // dark UI reads as broken); caret/selection in brand accent, like X.
        keyboardAppearance={isDark ? 'dark' : 'light'}
        selectionColor={colors.accent}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: colors.glass,
            borderWidth: 0.5,
            borderColor: error ? colors.error : focused ? colors.borderFocus : colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 11,
            color: colors.text,
            ...typography.input,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none', backdropFilter: 'blur(12px)' } as any : {}),
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text variant="caption" color={colors.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
