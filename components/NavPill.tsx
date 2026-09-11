import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '../lib/theme';
import { useKeyboardVisible } from '../lib/useKeyboardVisible';
import { haptics } from '../lib/haptics';

// Bottom tab bar — X design, Minds palette. Flat full-width bar with a
// hairline top border; icons only, monochrome: ACTIVE = filled glyph in the
// foreground text color, INACTIVE = outline in the same color. No pill, no
// glow, no accent tinting — the fill state is the entire signal, exactly like
// X. (An earlier floating-pill/glow variant read as gimmicky next to it.)

const BAR_HEIGHT = 52;

type IconSpec = { active: string; inactive: string; size: number };

const ICONS: Record<string, IconSpec> = {
  index: { active: 'home', inactive: 'home-outline', size: 26 },
  explore: { active: 'search', inactive: 'search-outline', size: 26 },
  create: { active: 'add-circle', inactive: 'add-circle-outline', size: 28 },
  chat: { active: 'chatbubble', inactive: 'chatbubble-outline', size: 25 },
  notifications: { active: 'notifications', inactive: 'notifications-outline', size: 26 },
};

export function NavPill({
  state,
  descriptors,
  navigation,
  badges = {},
}: BottomTabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const keyboardVisible = useKeyboardVisible();

  // A custom tabBar receives EVERY route — `href: null` no longer hides
  // anything, so filter to the five primary tabs explicitly.
  const routes = state.routes.filter((r) => ICONS[r.name]);
  // Some tabs are fronts for other routes (Search redirects to /discover) —
  // without the alias the bar showed no active state on those screens.
  const ROUTE_ALIAS: Record<string, string> = { discover: 'explore' };
  const activeName = state.routes[state.index]?.name ?? '';
  const effectiveActive = ROUTE_ALIAS[activeName] ?? activeName;

  // X behavior: the bottom bar gets out of the way while typing.
  if (keyboardVisible) return null;

  return (
    <View
      style={{
        height: BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: colors.bg,
        borderTopWidth: 0.5,
        borderTopColor: colors.borderSubtle,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {routes.map((route) => {
        const focused = route.name === effectiveActive;
        const icon = ICONS[route.name];
        const badge = badges[route.name] || 0;
        const label = (descriptors[route.key]?.options as any)?.title ?? route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            haptics.select();
            navigation.navigate(route.name as never);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
            onPress={onPress}
            style={({ pressed }) => ({
              flex: 1,
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View>
              <Ionicons
                name={(focused ? icon.active : icon.inactive) as any}
                size={icon.size}
                color={colors.text}
              />
              {badge > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -3,
                    right: -7,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    paddingHorizontal: 4,
                    backgroundColor: colors.accent,
                    borderWidth: 1.5,
                    borderColor: colors.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    variant="caption"
                    style={{ fontSize: 10, fontWeight: '700', color: colors.textOnAccent, lineHeight: Platform.OS === 'ios' ? 12 : 14 }}
                  >
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
