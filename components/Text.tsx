import { Platform, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { typography } from '../constants/theme';
import { useColors } from '../lib/theme';

type Variant = keyof typeof typography;

const headingLevels: Partial<Record<Variant, 1 | 2 | 3>> = {
  h1: 1,
  h2: 2,
  h3: 3,
};

interface Props extends TextProps {
  variant?: Variant;
  color?: string;
  align?: TextStyle['textAlign'];
  'aria-level'?: number;
}

export function Text({
  variant = 'body',
  color,
  align,
  style,
  accessibilityRole,
  'aria-level': ariaLevel,
  ...props
}: Props) {
  const colors = useColors();
  const headingLevel = headingLevels[variant];
  const webHeadingProps = Platform.OS === 'web' && (ariaLevel || headingLevel)
    ? { 'aria-level': ariaLevel ?? headingLevel }
    : undefined;

  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (headingLevel ? 'header' : undefined)}
      {...(webHeadingProps as any)}
      style={[
        typography[variant],
        { color: color || (variant === 'caption' || variant === 'label' ? colors.textSecondary : colors.text) },
        align ? { textAlign: align } : undefined,
        style,
      ]}
      {...props}
    />
  );
}
