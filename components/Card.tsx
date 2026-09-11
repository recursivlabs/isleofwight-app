import { View, type ViewProps, Platform } from 'react-native';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props extends ViewProps {
  variant?: 'default' | 'raised' | 'ghost';
  padding?: keyof typeof spacing;
}

export function Card({ variant = 'default', padding = 'lg', style, ...props }: Props) {
  const colors = useColors();
  const bg =
    variant === 'raised'
      ? colors.surfaceRaised
      : variant === 'ghost'
        ? 'transparent'
        : colors.glass;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          padding: spacing[padding],
          ...(variant !== 'ghost'
            ? { borderWidth: 0.5, borderColor: colors.borderSubtle }
            : {}),
          ...(Platform.OS === 'web' && variant !== 'ghost'
            ? { backdropFilter: 'blur(20px)' } as any
            : {}),
        },
        style,
      ]}
      {...props}
    />
  );
}
