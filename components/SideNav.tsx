import * as React from 'react';
import { View, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { Badge, getBadges } from './Badge';
import { useAuth } from '../lib/auth';
import { isSocialNotif } from '../lib/socialNotifications';
import { ORG_ID } from '../lib/recursiv';
import { useTheme } from '../lib/theme';
import { subscribeToInvalidations } from '../lib/cache';
import { spacing, radius, CTA } from '../constants/theme';
import { otpSignInPath } from '../lib/authRedirect';

// The Minds bulb — collapsed-rail mark (matches the browser favicon). 48x48
// source, one file per theme because the yellow shifts against the ground.
// Expanded rail shows the full wordmark logo (also theme-specific).
const BULB = require('../assets/bulb.svg');
const BULB_DARK = require('../assets/bulb-dark.svg');
const LOGO_DARK = require('../assets/logo-dark-mode.svg');
const LOGO_LIGHT = require('../assets/logo-light-mode.svg');

const COLLAPSED_WIDTH = 68;
const EXPANDED_WIDTH = 264;
const AUTO_COLLAPSE_WIDTH = 1024;


type NavItem = { name: string; label: string; icon: string; activeIcon: string };

// Primary destinations (rendered above the Create button).
const NAV_ITEMS: NavItem[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { name: 'discover', label: 'Discover', icon: 'search-outline', activeIcon: 'search' },
  // Minds AI — the user's AI on Minds. Clean single-prompt page (/ai); links out
  // to the paywalled build surface. ("Minds AI" is a placeholder brand for now.)
  // Sits third, above Chat: it is a headline surface, not a utility.
  { name: 'chat', label: 'Chat', icon: 'chatbubble-outline', activeIcon: 'chatbubble' },
  { name: 'notifications', label: 'Notifications', icon: 'notifications-outline', activeIcon: 'notifications' },
  { name: 'groups', label: 'Groups', icon: 'people-outline', activeIcon: 'people' },
  { name: 'bookmarks', label: 'Bookmarks', icon: 'bookmark-outline', activeIcon: 'bookmark' },
];

// Settings is the last nav row (after Upgrade). The row spacing keeps the list
// on a 13-inch laptop at 100% zoom with nothing to scroll.
// Profile was removed — the pinned avatar is the profile entry (no duplicate).
const BOTTOM_ITEMS: NavItem[] = [
  { name: 'settings', label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

export function useSidebarState() {
  const { width: windowWidth } = useWindowDimensions();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ focused?: string }>();
  // Collapse to icons below the breakpoint, OR when the wide 2-PANE chat is open
  // (the list+thread deserve full width). But NOT when a thread is opened
  // full-bleed from the sidebar inbox (focused=1) — there the nav should stay
  // put. So collapse only on /chat WITHOUT the focused flag.
  const onWide2PaneChat = windowWidth >= 1000 && !!pathname?.includes('chat') && !params?.focused;
  const collapsed = windowWidth < AUTO_COLLAPSE_WIDTH || onWide2PaneChat;
  const toggle = React.useCallback(() => {}, []);
  return { collapsed, toggle, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH };
}

interface SideNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SideNav({ collapsed, onToggle }: SideNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, sdk } = useAuth();
  const { colors, isDark } = useTheme();
  const [unreadNotifs, setUnreadNotifs] = React.useState(0);

  // Fetch unread notification count + subscribe to live updates.
  const refreshNotifs = React.useCallback(async () => {
    if (!sdk) return;
    try {
      // Fetch unread-only so the badge is a real COUNT, not "unread among the
      // last 10" (which silently capped the number during busy periods —
      // exactly when the count matters most). 100 covers the badge's 99+ cap.
      const res = await (sdk.notifications.list as any)({ status: 'unread', limit: 100, category: 'social', organization_id: ORG_ID || undefined });
      const notifs = res.data || [];
      // Count ONLY what the notifications screen will render. This badge used to
      // count every unread row, agent and deploy activity included, so it read
      // 48 while the list showed none and no tap could clear the difference.
      setUnreadNotifs(notifs.filter((n: any) => n.status === 'unread' && isSocialNotif(n)).length);
    } catch {}
  }, [sdk]);

  // When ANY screen marks notifications read (markAsRead/markAllAsRead fire
  // invalidate('notifications')), reconcile the dot immediately instead of
  // waiting for the next throttled nav-refetch — otherwise the gold dot lingers
  // after you've cleared the notifications list.
  React.useEffect(() => subscribeToInvalidations((key) => {
    if (key === 'notifications') refreshNotifs();
  }), [refreshNotifs]);

  // Navigation-triggered refetches are throttled. The socket is the primary
  // freshness path; pathname refetch is a safety net that does not need to fire
  // more than once per 15 seconds.
  const lastNavRefetchRef = React.useRef(0);
  const navRefreshKey = sdk ? pathname : null;
  React.useEffect(() => {
    if (navRefreshKey === null) return;
    const now = Date.now();
    if (now - lastNavRefetchRef.current < 15_000) return;
    lastNavRefetchRef.current = now;
    refreshNotifs();
  }, [navRefreshKey, refreshNotifs]);

  // The sidebar inbox was retired in favor of the top-level Chat destination.
  // Keep only the visible notification badge's realtime source here. The old
  // hidden inbox still fetched 50 conversations, fetched communities, polled,
  // subscribed to chat events, and rendered every row behind display:none on
  // every page. Chat owns its own data and realtime lifecycle now.
  React.useEffect(() => {
    if (!sdk) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock) return;
        // Debounce + jitter: a fan-out notification (popular post, org
        // announcement) hits every online client at the same instant; an
        // immediate refetch per event is a synchronized request spike
        // proportional to audience size.
        let notifTimer: ReturnType<typeof setTimeout> | null = null;
        const onNotif = () => {
          if (notifTimer) return;
          notifTimer = setTimeout(() => {
            notifTimer = null;
            refreshNotifs();
          }, 1000 + Math.random() * 2000);
        };
        sock.on('notification', onNotif);
        cleanup = () => {
          sock.off?.('notification', onNotif);
          if (notifTimer) clearTimeout(notifTimer);
        };
      } catch {}
    })();
    return () => cleanup?.();
  }, [sdk, refreshNotifs]);

  const isActive = (name: string) => {
    if (name === 'index') return pathname === '/' || pathname === '';
    return pathname.includes(name);
  };

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  // Signed out, the nav is a way around, not a way in: the public places, and
  // one way to sign in. Everything that needs an account is not listed.
  const signedOut = !user;
  const visibleItems = signedOut
    ? NAV_ITEMS.filter((i) => ['discover', 'groups', 'live'].includes(i.name))
    : NAV_ITEMS;
  const signInHere = () => router.push(otpSignInPath(pathname && pathname !== '/' ? pathname : '/discover') as any);

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.name);
    return (
      <Pressable
        key={item.name}
        accessibilityRole="link"
        accessibilityLabel={item.label}
        onPress={() => {
          // Profile routes straight to the canonical /user/<username>.
          if (item.name === 'profile') {
            const slug = user?.username || user?.id;
            router.push((slug ? `/${slug}` : '/profile') as any);
            return;
          }
          // communities/wallet/bookmarks moved to the ROOT stack in the nav
          // refactor — a /(tabs)/ prefix for them 404s ("unmatched route").
          const inTabs = ['discover', 'create', 'chat', 'notifications', 'explore'].includes(item.name);
          router.push(item.name === 'index' ? '/(tabs)' : inTabs ? `/(tabs)/${item.name}` : `/${item.name}` as any);
        }}
        style={({ pressed, hovered }: any) => ({
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: collapsed ? 0 : spacing.md,
          marginHorizontal: collapsed ? 0 : spacing.md,
          marginRight: collapsed ? 0 : spacing.lg,
          borderRadius: radius.md,
          backgroundColor: active ? colors.accentSubtle : hovered ? colors.glass : 'transparent',
          opacity: pressed ? 0.7 : 1,
          justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
          ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
        })}
      >
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={(active ? item.activeIcon : item.icon) as any}
            size={22}
            // High contrast: near-white on dark, near-black on light (Jack: the
            // muted grey was too subdued to read at a glance).
            color={active ? colors.accent : (isDark ? '#f2f2f2' : '#111111')}
          />
          {/* Count badge for unread notifications — a number, not a dot. A dot
              is ignorable and reads the same at 1 unread as at 40; the count is
              what makes a busy moment FEEL busy. Capped at 99+. */}
          {unreadNotifs > 0 && item.name === 'notifications' && (
            <View
              style={{
                position: 'absolute',
                top: -6,
                right: -10,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                paddingHorizontal: 4,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  lineHeight: 12,
                  fontFamily: 'Roboto-Medium',
                  color: colors.bg,
                }}
              >
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </Text>
            </View>
          )}
        </View>
        {!collapsed && (
          <Text
            variant="body"
            // High contrast white-on-black / black-on-white for the nav labels.
            color={active ? colors.accent : (isDark ? '#f2f2f2' : '#111111')}
            style={{ fontSize: 15, fontFamily: active ? 'Roboto-Medium' : 'Roboto-Regular' }}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width,
        backgroundColor: colors.bg,
        borderRightWidth: 1,
        borderRightColor: colors.borderSubtle,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        // NO width transition. `width` is a layout property: animating it made
        // the browser re-lay-out this whole subtree on every frame of the 200ms
        // change, and the frames it dropped were exactly the ones the user saw
        // when opening or leaving /chat. The collapse is now instant, which is
        // both cheaper and what it should feel like -- a nav that snaps reads as
        // fast, a nav that eases into place over 200ms reads as slow even when
        // it is not dropping frames.
        //
        // If this ever wants motion again, animate `transform` on a fixed-width
        // child (composited, no layout) rather than `width` on the container.
        ...(Platform.OS === 'web' ? { contain: 'layout' } as any : {}),
      }}
    >
        {/* Top section — fixed (logo + nav + separator) */}
        <View style={{ flexShrink: 0 }}>
          {/* Logo (auto-collapses with the nav — no manual toggle, no theme
              switch; theme lives in Settings now) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-start',
              paddingHorizontal: collapsed ? 0 : spacing.lg,
              marginBottom: spacing.xl,
            }}
          >
            <Pressable
              onPress={() => router.push('/(tabs)')}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="Isle of Wight home"
            >
              {collapsed ? (
                // Bulb mark only (matches the favicon). The source is a square
                // 48x48 box holding 27x41 of artwork, so a 40x40 frame renders
                // the bulb ~34px tall — the old mark's optical height.
                <Image
                  source={isDark ? BULB_DARK : BULB}
                  style={{ width: 40, height: 40 }}
                  contentFit="contain"
                  accessibilityLabel="Isle of Wight"
                />
              ) : (
                // Expanded: full Minds wordmark logo, matched to the theme.
                // Bulb + lowercase wordmark, 3.24:1 — keep the ratio.
                <Image
                  source={isDark ? LOGO_DARK : LOGO_LIGHT}
                  style={{ width: 91, height: 35 }}
                  contentFit="contain"
                  accessibilityLabel="Isle of Wight"
                />
              )}
            </Pressable>
          </View>

          {/* Search lives at the top of the right rail (FeedSidebar) now,
             matching X — keeps the left nav clean and pins discovery to
             the trends column. */}
        </View>

        {/* Nav — flex:1 so the pinned Create + avatar below never get cut off.
            It only scrolls on a viewport shorter than a 13-inch laptop; the row
            spacing is sized so a normal screen at 100% zoom shows every row. */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.xs, paddingBottom: spacing.sm }}
          showsVerticalScrollIndicator={false}
        >
          {visibleItems.map(renderNavItem)}
          {/* UPGRADE — holistic Plus/Pro entry (the page shows both plans + your
              current one). Behaves like any nav row: neutral when inactive,
              primary-highlighted when active. The mark is the SAME verified seal
              shown next to usernames. */}
          {false && (() => {
            const upgradeActive = !!pathname?.includes('/upgrade');
            const upgradeColor = upgradeActive ? colors.accent : (isDark ? '#f2f2f2' : '#111111');
            return (
              <Pressable
                onPress={() => router.push('/upgrade' as any)}
                accessibilityRole="link"
                accessibilityLabel="Upgrade — see Plus and Pro"
                style={({ pressed, hovered }: any) => ({
                  flexDirection: 'row' as const,
                  alignItems: 'center' as const,
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: collapsed ? 0 : spacing.md,
                  marginHorizontal: collapsed ? 0 : spacing.md,
                  marginRight: collapsed ? 0 : spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: upgradeActive ? colors.accentSubtle : hovered ? colors.glass : 'transparent',
                  opacity: pressed ? 0.7 : 1,
                  justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
                })}
              >
                <MaterialCommunityIcons name="check-decagram-outline" size={23} color={upgradeColor} />
                {!collapsed && <Text variant="body" color={upgradeColor} style={{ fontSize: 15, fontFamily: upgradeActive ? 'Roboto-Medium' : 'Roboto-Regular' }} numberOfLines={1}>Upgrade</Text>}
              </Pressable>
            );
          })()}
          {!signedOut && BOTTOM_ITEMS.map(renderNavItem)}
        </ScrollView>

        {/* Bottom section — PINNED (flexShrink:0). Create + avatar always stay
            visible; the nav above scrolls when the viewport is short. */}
        <View style={{ flexShrink: 0, gap: spacing.xs, marginTop: spacing.md }}>
          {signedOut && (
            <View style={{ gap: spacing.sm, marginHorizontal: collapsed ? 0 : spacing.lg, alignItems: collapsed ? 'center' : 'stretch' }}>
              <Pressable
                onPress={signInHere}
                accessibilityRole="button"
                accessibilityLabel="Log in"
                style={({ pressed, hovered }: any) => ({
                  backgroundColor: CTA.solid, borderWidth: 1, borderColor: CTA.border, borderRadius: radius.full,
                  alignItems: 'center', justifyContent: 'center',
                  ...(collapsed ? { width: 44, height: 44 } : { paddingVertical: spacing.md, paddingHorizontal: spacing.lg }),
                  ...(Platform.OS === 'web' ? { backgroundImage: (pressed || hovered) ? CTA.gradientHover : CTA.gradient, boxShadow: CTA.shadowWeb, cursor: 'pointer' } as any : {}),
                })}
              >
                {collapsed ? <Ionicons name="log-in-outline" size={22} color={CTA.ink} /> : <Text variant="body" style={{ fontWeight: '600' }} color={CTA.ink}>Log in</Text>}
              </Pressable>
              {!collapsed && (
                <Pressable onPress={signInHere} accessibilityRole="link" accessibilityLabel="Create account" style={{ alignItems: 'center', paddingVertical: spacing.xs }}>
                  <Text variant="caption" color={colors.textSecondary}>New here? Create account</Text>
                </Pressable>
              )}
            </View>
          )}
          {!signedOut && (<>
          {/* CREATE — the very bottom (X puts Post here). Filled accent =
              the primary action; a round button when the rail is collapsed. */}
          <Pressable
            onPress={() => router.push('/(tabs)/create' as any)}
            accessibilityRole="button"
            accessibilityLabel="Create a post"
            style={({ pressed, hovered }: any) => ({
              backgroundColor: CTA.solid,
              borderWidth: 1,
              borderColor: CTA.border,
              borderRadius: radius.full,
              marginBottom: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              ...(collapsed
                ? { width: 44, height: 44, alignSelf: 'center' as const }
                : { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginHorizontal: spacing.lg }),
              // The one canonical gold CTA (identical to the Button component).
              ...(Platform.OS === 'web'
                ? { backgroundImage: (pressed || hovered) ? CTA.gradientHover : CTA.gradient, boxShadow: CTA.shadowWeb, transition: 'filter 0.15s ease' } as any
                : {}),
            })}
          >
            {collapsed && <Ionicons name="add" size={24} color={CTA.ink} />}
            {!collapsed && <Text variant="body" style={{ fontWeight: '600' }} color={CTA.ink}>Create</Text>}
          </Pressable>

          {/* User profile — route directly to the canonical /<username> URL so
              we never bounce through the /profile redirect page. */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: collapsed ? 0 : spacing.md,
            marginRight: collapsed ? 0 : spacing.lg,
            marginTop: spacing.xs,
          }}>
            <Pressable
              onPress={() => {
                const slug = user?.username || user?.id;
                if (slug) router.push(`/${slug}` as any);
                else router.push('/profile');
              }}
              accessibilityRole="link"
              accessibilityLabel={`View profile for ${user?.name || user?.username || 'your account'}`}
              style={({ pressed, hovered }: any) => ({
                flex: 1,
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                gap: spacing.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: collapsed ? 0 : spacing.md,
                borderRadius: radius.md,
                backgroundColor: (isActive('profile') || (user?.username && (pathname === `/${user.username}` || pathname?.startsWith(`/user/${user.username}`))))
                  ? colors.accentSubtle
                  : hovered ? colors.glass : 'transparent',
                opacity: pressed ? 0.7 : 1,
                justifyContent: collapsed ? 'center' as const : 'flex-start' as const,
                ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color 0.15s ease' } as any : {}),
              })}
            >
              <Avatar uri={user?.image} name={user?.name} size="sm" />
              {!collapsed && (
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text variant="caption" numberOfLines={1} style={{ fontWeight: '400', flexShrink: 1 }}>
                      {user?.name || user?.username || 'Profile'}
                    </Text>
                    {getBadges(user).map((b) => <Badge key={b} type={b} size="sm" />)}
                  </View>
                  {user?.username && (
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 11 }}>
                      @{user.username}
                    </Text>
                  )}
                </View>
              )}
            </Pressable>
            {/* Admin moved out of the sidebar (command-center rethink); Refer
                link removed. */}
          </View>
          </>)}
        </View>
    </View>
  );
}
