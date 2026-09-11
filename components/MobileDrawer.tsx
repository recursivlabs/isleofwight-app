import * as React from 'react';
import { View, Pressable, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { Badge, getBadges } from './Badge';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { spacing, radius } from '../constants/theme';

// X-style slide-in navigation drawer for mobile native. Opened from the
// header avatar (or a left-edge swipe); holds the full sidebar menu that
// the desktop SideNav provides, so mobile gets both navs — bottom tabs for
// the core loop, drawer for profile/wallet/settings/etc.

const OPEN_DURATION = 240;
const CLOSE_DURATION = 200;
const EDGE_HITBOX = 24;

interface DrawerContextValue {
  open: () => void;
  close: () => void;
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

/** Null outside the provider (e.g. desktop web) — callers should fall back. */
export function useMobileDrawer(): DrawerContextValue | null {
  return React.useContext(DrawerContext);
}

type DrawerItem = { icon: string; label: string; route: string; adminOnly?: boolean };

const MAIN_ITEMS: DrawerItem[] = [
  { icon: 'person-outline', label: 'Profile', route: 'profile' },
  { icon: 'people-outline', label: 'Communities', route: '/groups' },
  { icon: 'gift-outline', label: 'Invites', route: '/invites' },
  { icon: 'shield-outline', label: 'Admin', route: '/admin', adminOnly: true },
];

const FOOTER_ITEMS: DrawerItem[] = [
  { icon: 'settings-outline', label: 'Settings', route: '/settings' },
  { icon: 'chatbox-ellipses-outline', label: 'Feedback', route: '/feedback' },
];

export function MobileDrawerProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.8, 320);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  // `mounted` keeps the overlay out of the tree entirely when closed so it
  // never intercepts touches; `progress` drives the slide (0 closed → 1 open).
  const [mounted, setMounted] = React.useState(false);
  const progress = useSharedValue(0);

  const open = React.useCallback(() => {
    setMounted(true);
    progress.value = withTiming(1, { duration: OPEN_DURATION });
  }, [progress]);

  const close = React.useCallback(() => {
    progress.value = withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
      if (finished) runOnJS(setMounted)(false);
    });
  }, [progress]);

  const ctx = React.useMemo(() => ({ open, close }), [open, close]);

  const navigate = (item: DrawerItem) => {
    close();
    if (item.route === 'profile') {
      const slug = user?.username || user?.id;
      router.push(slug ? (`/${slug}` as any) : ('/profile' as any));
      return;
    }
    router.push(item.route as any);
  };

  // Drag the open drawer left to dismiss.
  const dragClose = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .onChange((e) => {
      progress.value = Math.min(1, Math.max(0, 1 + e.translationX / drawerWidth));
    })
    .onEnd((e) => {
      const shouldClose = e.velocityX < -500 || progress.value < 0.5;
      if (shouldClose) {
        progress.value = withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        });
      } else {
        progress.value = withTiming(1, { duration: OPEN_DURATION });
      }
    });

  // Left-edge swipe opens the drawer (X parity). hitSlop restricts where the
  // pan can BEGIN without an overlay view, so taps in the edge zone still
  // reach the content underneath, and vertical feed scrolls win via
  // failOffsetY.
  const edgeOpen = Gesture.Pan()
    .enabled(!mounted)
    .hitSlop({ left: 0, width: EDGE_HITBOX })
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .onStart(() => {
      runOnJS(setMounted)(true);
    })
    .onChange((e) => {
      progress.value = Math.min(1, Math.max(0, e.translationX / drawerWidth));
    })
    .onEnd((e) => {
      const shouldOpen = e.velocityX > 500 || progress.value > 0.4;
      if (shouldOpen) {
        progress.value = withTiming(1, { duration: OPEN_DURATION });
      } else {
        progress.value = withTiming(0, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        });
      }
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-drawerWidth, 0]) }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.5]),
  }));

  const renderItem = (item: DrawerItem) => {
    if (item.adminOnly && (user as any)?.role !== 'admin') return null;
    return (
      <Pressable
        key={item.label}
        onPress={() => navigate(item)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          paddingVertical: spacing.md + 2,
          paddingHorizontal: spacing.xl,
          backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        })}
      >
        <Ionicons name={item.icon as any} size={23} color={colors.text} />
        <Text variant="body" style={{ fontSize: 18, fontWeight: '500' }}>
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <DrawerContext.Provider value={ctx}>
      <View style={{ flex: 1 }}>
        <GestureDetector gesture={edgeOpen}>
          <View style={{ flex: 1 }}>{children}</View>
        </GestureDetector>

        {mounted && (
          <View style={StyleSheet.absoluteFill}>
            {/* Scrim — tap to dismiss */}
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, scrimStyle]}>
              <Pressable style={{ flex: 1 }} onPress={close} />
            </Animated.View>

            <GestureDetector gesture={dragClose}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: drawerWidth,
                    backgroundColor: colors.bg,
                    paddingTop: insets.top + spacing.lg,
                    paddingBottom: insets.bottom + spacing.lg,
                    borderRightWidth: 0.5,
                    borderRightColor: colors.borderSubtle,
                  },
                  drawerStyle,
                ]}
              >
                {/* Account header — avatar routes to profile, swap icon to the
                    account switcher (X keeps both in the drawer header). */}
                <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Pressable onPress={() => navigate(MAIN_ITEMS[0])} hitSlop={8}>
                      <Avatar uri={user?.image} name={user?.name} size="lg" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        close();
                        router.push('/switch-account' as any);
                      }}
                      hitSlop={8}
                      style={({ pressed }) => ({
                        padding: spacing.sm,
                        borderRadius: radius.full,
                        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                      })}
                    >
                      <Ionicons name="swap-horizontal-outline" size={20} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => navigate(MAIN_ITEMS[0])} style={{ marginTop: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 17, flexShrink: 1 }}>
                        {user?.name || user?.username || 'Profile'}
                      </Text>
                      {getBadges(user).map((b) => (
                        <Badge key={b} type={b} size="sm" />
                      ))}
                    </View>
                    {user?.username ? (
                      <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                        @{user.username}
                      </Text>
                    ) : null}
                  </Pressable>
                </View>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {MAIN_ITEMS.map(renderItem)}
                  <View
                    style={{
                      height: 0.5,
                      backgroundColor: colors.borderSubtle,
                      marginHorizontal: spacing.xl,
                      marginVertical: spacing.md,
                    }}
                  />
                  {FOOTER_ITEMS.map(renderItem)}
                </ScrollView>
              </Animated.View>
            </GestureDetector>
          </View>
        )}
      </View>
    </DrawerContext.Provider>
  );
}
