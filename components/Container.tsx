import { View, type ViewProps, Platform } from 'react-native';
import { KeyboardAvoid } from './KeyboardAvoid';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { spacing } from '../constants/theme';

interface Props extends ViewProps {
  safeTop?: boolean;
  safeBottom?: boolean;
  padded?: boolean;
  centered?: boolean;
  maxWidth?: number;
  /** Disable the on-screen keyboard avoidance wrapper. Default: enabled. */
  noAvoidKeyboard?: boolean;
}

export function Container({
  safeTop = false,
  safeBottom = false,
  padded = true,
  centered = false,
  maxWidth,
  noAvoidKeyboard = false,
  style,
  children,
  ...props
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const inner = (
    <View
      style={[
        {
          flex: 1,
          width: '100%',
          maxWidth: Platform.OS === 'web' ? maxWidth : undefined,
          alignSelf: 'center',
          ...(padded ? { paddingHorizontal: spacing.xl } : {}),
          ...(centered ? { alignItems: 'center', justifyContent: 'center' } : {}),
        },
      ]}
    >
      {children}
    </View>
  );

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.bg,
          paddingTop: safeTop ? insets.top : 0,
          paddingBottom: safeBottom ? insets.bottom : 0,
        },
        style,
      ]}
      {...props}
    >
      {noAvoidKeyboard || Platform.OS === 'web' ? (
        inner
      ) : (
        <KeyboardAvoid
          style={{ flex: 1 }}
          // Offset must be 0: this view's BOTTOM sits at the window bottom, so
          // the avoider's padding already lands content flush on the keyboard.
          // Passing insets.top here inflated the padding by the status-bar
          // height — the white band between the composer toolbar and keyboard.
          keyboardVerticalOffset={0}
        >
          {inner}
        </KeyboardAvoid>
      )}
    </View>
  );
}
