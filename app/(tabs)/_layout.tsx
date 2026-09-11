import * as React from 'react';
import { Slot, Tabs, useRouter, usePathname } from 'expo-router';
import { View, Platform, AppState, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../lib/theme';
import { isSocialNotif } from '../../lib/socialNotifications';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { isUsernamePicked, markUsernamePicked } from '../../lib/onboarding';
import { isFreshSignup } from '../../lib/signupWindow';
import { subscribeToInvalidations } from '../../lib/cache';
import { MobileDrawerProvider } from '../../components/MobileDrawer';
import { NavPill } from '../../components/NavPill';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web';
  const { colors } = useTheme();
  const { sdk, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Username gate. Forced redirect for users without a clean URL-safe
  // username (signup may have written email-prefix garbage; legacy
  // accounts may have no username). Once picked, the flag prevents loops.
  //
  // No swipe-deck onboarding gate. New signups land straight in the For
  // You feed with our best default content. A top-of-feed CTA invites
  // them to set up a personal AI agent when they're ready — but that's
  // optional. Dismissing the CTA leaves the default feed working fine.
  React.useEffect(() => {
    if (!sdk || !user?.id) return;
    let cancelled = false;
    (async () => {
      // Force the username picker until the user has EXPLICITLY chosen one.
      // New signups get an auto-assigned email-prefix username (valid), so the
      // old "only if invalid" check skipped the picker and they never got to
      // choose/validate. Now everyone confirms their handle once.
      const picked = await isUsernamePicked();
      if (cancelled) return;
      if (picked) return;

      // #189: `isUsernamePicked` reads a DEVICE-LOCAL flag, but "this person
      // chose their username" is a property of the ACCOUNT. So an existing user
      // signing in on a new phone had no flag, got forced through the picker,
      // and accepting its email-derived guess SILENTLY RENAMED their account —
      // breaking every link and @mention to them. It really happened: one
      // sign-in minted `bill-1` on an account from 2012.
      //
      // Only route to the picker when this is genuinely a fresh signup. An
      // established account signing in on a new device is never sent to a
      // screen that can rename it; they change their handle in Settings.
      //
      // ABSENT OR UNPARSEABLE created_at IS TREATED AS ESTABLISHED, and that
      // direction is deliberate: the cost of not asking a new user to confirm
      // a handle is that they keep an auto-assigned one they can change any
      // time. The cost of asking an old user is destroying their identity.
      if (isFreshSignup(user?.created_at)) {
        router.replace('/auth/pick-username' as any);
      } else {
        // Established account: record the choice locally so this check stops
        // running on every launch of every device they ever sign in on.
        await markUsernamePicked();
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, user?.id, user?.username, router]);

  // Poll unread notification count
  const [unreadCount, setUnreadCount] = React.useState(0);
  React.useEffect(() => {
    if (!sdk) return;
    let active = true;
    const check = async () => {
      // Don't poll a backgrounded app / hidden tab — battery and QPS waste,
      // and at cutover scale a fleet of idle tabs is real load.
      if (Platform.OS === 'web') {
        if (typeof document !== 'undefined' && document.hidden) return;
      } else if (AppState.currentState !== 'active') return;
      try {
        const res = await sdk.notifications.list({ limit: 20, status: 'unread', category: 'social', organization_id: ORG_ID || undefined } as any);
        if (active) {
          // Read state lives in `status` — the old `read`/`is_read` fields
          // don't exist on the SDK type, so every notification passed this
          // filter and the badge showed the full fetch count forever, even
          // after Mark all read.
          // Count only what the notifications screen renders. Counting every
          // unread row put agent and deploy activity in this badge, so the
          // number never matched the list and no tap could clear it.
          const unread = (res.data || []).filter((n: any) => n.status === 'unread' && isSocialNotif(n)).length;
          setUnreadCount(unread);
        }
      } catch {}
    };
    check();
    const interval = setInterval(check, 60_000); // check every 60s
    // Re-check the moment the app/tab comes back, and when another screen
    // marks notifications read (signalled via cache invalidation).
    let removeWake: (() => void) | undefined;
    if (Platform.OS === 'web') {
      if (typeof document !== 'undefined') {
        const onVis = () => { if (!document.hidden) check(); };
        document.addEventListener('visibilitychange', onVis);
        removeWake = () => document.removeEventListener('visibilitychange', onVis);
      }
    } else {
      const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
      removeWake = () => sub.remove();
    }
    const unsubInval = subscribeToInvalidations((key) => {
      if (key.startsWith('notifications')) check();
    });
    // LIVE badge (X parity): the server pushes a 'notification' socket event on
    // every insert — bump the tab badge within ~1-2s instead of the 60s poll.
    // Debounced with jitter so fan-out events don't stampede the API.
    let sockCleanup: (() => void) | undefined;
    let notifTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        await (sdk as any).realtime?.connect?.();
        const sock = (sdk as any).realtime?.socket;
        if (!sock?.on) return;
        const onNotif = () => {
          // Tick UP immediately, one per event — watching the badge climb
          // 1→2→3 as engagement lands is the aha moment. The debounced
          // check() reconciles to server truth right behind it.
          setUnreadCount((c) => Math.min(c + 1, 99));
          if (notifTimer) return;
          notifTimer = setTimeout(() => { notifTimer = null; check(); }, 1500 + Math.random() * 1500);
        };
        sock.on('notification', onNotif);
        sockCleanup = () => { sock.off?.('notification', onNotif); if (notifTimer) clearTimeout(notifTimer); };
      } catch {}
    })();
    return () => { active = false; clearInterval(interval); removeWake?.(); unsubInval(); sockCleanup?.(); };
  }, [sdk]);

  if (isDesktop) {
    // Desktop navigation belongs to the root WebShell's SideNav, so render
    // only the active child route. A hidden Tabs navigator kept every visited
    // screen mounted behind the current one on web: after Home -> Discover the
    // full feed remained focusable and exposed to screen readers underneath
    // Discover. Native still uses Tabs below for its real bottom navigation.
    return <Slot />;
  }

  // Floating pill bottom nav (KEMPT-style, Minds colors): five
  // self-explanatory icons, no labels, gold glow behind the active tab.
  // Profile lives in the header avatar + drawer.
  return (
    <MobileDrawerProvider>
    <Tabs
      tabBar={(props) => <NavPill {...props} badges={{ notifications: unreadCount }} />}
      screenOptions={{
        headerShown: false,
        // See the desktop branch above — stops the navigator's default white
        // container showing under the feed on the way in.
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={27} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={27} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={29} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={27} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="discover" options={{ href: null }} />
    </Tabs>
    </MobileDrawerProvider>
  );
}
