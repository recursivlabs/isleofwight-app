import { Platform } from 'react-native';
import { colors } from '../constants/theme';

/**
 * Web hover + press styles for interactive elements.
 * Use with Pressable's style callback: style={({ pressed }) => interactiveStyle(pressed)}
 */
export function interactiveStyle(pressed: boolean, activeColor?: string) {
  return {
    opacity: pressed ? 0.85 : 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease, opacity 0.1s ease',
    } as any : {}),
  };
}

/**
 * Web-only hover background for list items and nav items.
 */
export function listItemStyle(pressed: boolean, active?: boolean) {
  return {
    backgroundColor: pressed ? colors.surfaceHover : active ? colors.accentSubtle : 'transparent',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'background-color 0.15s ease',
    } as any : {}),
  };
}
