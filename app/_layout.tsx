import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { View, Platform, Animated } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Roboto_300Light,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import * as SplashScreen from 'expo-splash-screen';
import { ProjectProvider } from '../lib/project';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useTheme, useColors } from '../lib/theme';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastProvider } from '../components/Toast';
import { NetworkBanner } from '../components/NetworkBanner';
import { CutoverWelcome } from '../components/CutoverWelcome';
import { SideNav, useSidebarState } from '../components/SideNav';
import { WebScrollbar } from '../components/WebScrollbar';
import { CommandPalette } from '../components/CommandPalette';
import { ActiveConvoProvider } from '../lib/activeConvo';
import { AudioPlayerProvider } from '../lib/audioPlayer';
import { AudioMiniPlayer } from '../components/audio/AudioMiniPlayer';
import { SPLASH_BG } from '../constants/theme';
import { initMonitoring, captureException } from '../lib/monitoring';
import { injectWebStyles } from '../lib/webStyles';
import { initKeyboardShortcuts } from '../lib/keyboard';
import { registerPushToken, registerTokenWithServer, setupNotificationListeners } from '../lib/notifications';
import { AuthRouteGate } from '../lib/guards';

initMonitoring();
injectWebStyles();
initKeyboardShortcuts();

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden / no splash on this platform — nothing to prevent.
});



/**
 * Hard ceiling on how long native will sit behind the splash waiting for
 * fonts. Fonts are a cosmetic upgrade; the app must never be held hostage
 * by them (see the boot gate in RootLayout).
 */
const FONT_TIMEOUT_MS = 5000;

/**
 * Subscribes to theme so the entire tree re-renders on toggle.
 * Owns StatusBar style + the rendered background color so platform
 * chrome stays consistent with the active palette.
 */
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { isDark, colors } = useTheme();

  // The launch image is dark, and it stays dark.
  //
  // The alternative was a light splash variant, which fixes the light-mode
  // SIGNED-IN launch and breaks the signed-out one — signed out is dark-only
  // now, so a light launch would hand off to a night sky, trading a flash for
  // the same flash somewhere less forgivable. The brand is gold on dark, the
  // sign-in screen is a night sky, and the first run is the impression that
  // matters most; the launch belongs to that.
  //
  // So a light-mode user's theme arrives with their content, and the only
  // question is whether it SNAPS or resolves. This dissolves it. Dark users
  // pay nothing — the fade is skipped entirely, since there is nothing to
  // cross from #0f0f0f to #0f0f0f.
  const fade = React.useRef(new Animated.Value(isDark ? 1 : 0)).current;
  React.useEffect(() => {
    if (isDark) { fade.setValue(1); return; }
    Animated.timing(fade, {
      toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [isDark, fade]);

  return (
    <Animated.View style={{ flex: 1, backgroundColor: colors.bg, opacity: fade }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </Animated.View>
  );
}

/**
 * The root stack, inside the theme so it can colour its own container.
 *
 * contentStyle is the fix for a flash nobody could place: React Navigation
 * renders every screen on top of a container whose background comes from its
 * theme, and nothing here ever set that theme — so it was DefaultTheme, whose
 * background is white. Any moment a screen didn't fully cover it (a push, a
 * replace, the beat before a screen's own background paints) showed white,
 * under a dark app, on the way into the feed.
 *
 * Splitting this into its own component is what lets it read useColors(); the
 * layout that renders the provider tree is itself outside the provider.
 */
function RootStack() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* slide_from_right is right for DETAIL screens — that's the push you
          asked for by tapping a post or a profile. Boot is not a push. A
          signed-in launch redirects index → (tabs), and with the default in
          force the navigator couldn't tell the difference: every cold start
          ended with the feed sliding in from the edge, as if you had just
          navigated somewhere. These two open in place. */}
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
    </Stack>
  );
}

/**
 * Desktop/web chrome for the ROOT stack. The nav-architecture refactor moved
 * detail screens (post, profile, notifications targets, …) out of the (tabs)
 * group into the root stack — which silently removed them from the SideNav
 * shell that only the tabs layout rendered. The sidebar must be visible on
 * EVERY web screen (it still auto-collapses to the icon rail on the wide
 * 2-pane chat via useSidebarState), so the shell now lives here, above the
 * whole Stack. Native and auth/logged-out web render children untouched.
 */
function WebShell({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return <WebShellFrame>{children}</WebShellFrame>;
}

function WebShellFrame({ children }: { children: React.ReactNode }) {
  const sidebar = useSidebarState();
  const { user, isLoading, accountRestriction } = useAuth();
  const pathname = usePathname();
  const { colors } = useTheme();

  /* Did THIS browser already have a session? Read straight off localStorage,
     synchronously, on first render.
     Why: useAuth starts with isLoading=true and user=null while it reads the
     stored key back. Treating that as logged-out dropped the entire shell, so a
     refresh painted the page full-width with no SideNav, then re-mounted the
     frame around it a moment later — the content jumped sideways and the
     sidebar flashed in. Worst on a profile refresh, which is a root-stack
     screen with nothing else holding the layout while auth resolves.
     A stored api key means the frame is going to be needed, so reserve it now
     and let SideNav fill into space that never moved. A visitor with no stored
     key still gets the bare page immediately and never sees a sidebar flash
     away, which is what keying purely off isLoading would have caused. */
  const hadSession = React.useMemo(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
    try {
      return !!window.localStorage.getItem('minds:api_key');
    } catch {
      return false;
    }
  }, []);

  const resolvingKnownUser = isLoading && hadSession;
  // The landing and the auth screens stand alone. Every other page a visitor
  // can reach signed out (discover, a post, a profile, a group) gets the same
  // shell a member sees, with the nav in its signed-out form.
  const standalone = !pathname || pathname === '/' || pathname.startsWith('/auth');
  const bare = ((!user && !resolvingKnownUser) && standalone) || !!pathname?.startsWith('/auth') || !!accountRestriction;
  if (bare) return <>{children}</>;
  return (
    <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: colors.bg }}>
      {/* Center nav + content like X (equal gutters), capped on wide screens. */}
      <View style={{ flex: 1, flexDirection: 'row', maxWidth: 1280 }}>
        <SideNav collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
      {/* Sits outside the 1280 cap on purpose: the bar belongs at the window
          edge like X's, not at the edge of the content column. Web-only; it
          renders nothing on native. */}
      <WebScrollbar />
    </View>
  );
}

/**
 * A restricted account keeps its valid credential only for the dedicated
 * decision/appeal surface. Keep navigation there so the rest of the app does
 * not become a wall of expected 403 errors.
 */
function AccountRestrictionWiring() {
  const router = useRouter();
  const pathname = usePathname();
  const { accountRestriction } = useAuth();

  useEffect(() => {
    if (accountRestriction && pathname !== '/moderation') {
      router.replace('/moderation' as any);
    }
  }, [accountRestriction, pathname, router]);

  return null;
}

/** Wire push notification listeners — must be inside AuthProvider + Router. */
function NotificationWiring() {
  const router = useRouter();
  const { sdk, user, accountRestriction } = useAuth();
  const userId = user?.id;

  // Register this device for push once the user is signed in. The module has
  // always had the full flow (permission → Expo token → server registration)
  // but nothing ever CALLED it — the push_notification_token table was empty
  // network-wide, so every server-side push silently no-opped.
  useEffect(() => {
    if (!sdk || !userId || accountRestriction) return;
    let cancelled = false;
    (async () => {
      const token = await registerPushToken();
      if (token && !cancelled) await registerTokenWithServer(sdk, token);
    })();
    return () => { cancelled = true; };
  }, [sdk, userId, accountRestriction]);
  useEffect(() => {
    return setupNotificationListeners(
      // Foreground notification — no-op, system shows it via setNotificationHandler
      undefined,
      // User tapped notification — navigate to target
      (response: any) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.targetType === 'post' && data?.targetId) {
          router.push(`/post/${data.targetId}` as any);
        } else if (data?.targetType === 'message' && data?.targetId) {
          router.push(`/chat/${data.targetId}` as any);
        } else if (data?.targetType === 'user' && data?.targetId) {
          router.push(`/${data.targetId}` as any);
        } else if (data?.actionUrl) {
          router.push(data.actionUrl as any);
        } else {
          router.push('/(tabs)/notifications' as any);
        }
      },
    );
  }, [router]);
  return null;
}

export default function RootLayout() {
  // Roboto (matches legacy Minds + reads cleanly on web). Custom keys keep the
  // theme's typography references stable. Roboto has no SemiBold in our scale —
  // headings/labels use Medium (the X/Bluesky-correct UI weight).
  const [fontsLoaded, fontError] = useFonts({
    'Roboto-Light': Roboto_300Light,
    'Roboto-Regular': Roboto_400Regular,
    'Roboto-Medium': Roboto_500Medium,
    'Roboto-Bold': Roboto_700Bold,
  });

  // Deadline on the font wait. Without it, a useFonts failure left native
  // returning null forever — and since hideAsync() only ran from the layout
  // of a View that never mounted, the #08080a splash stayed up permanently.
  // That is indistinguishable from a black screen, with no recovery path.
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const t = setTimeout(() => setFontsTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  // Boot on ANY terminal outcome — loaded, failed, or took too long. Roboto
  // just falls back to the system stack in the latter two cases.
  const bootReady = fontsLoaded || !!fontError || fontsTimedOut;

  useEffect(() => {
    if (!fontError) return;
    // console.warn so this survives to `adb logcat -s ReactNativeJS` on a
    // release build; captureException currently no-ops off web.
    console.warn('[minds] font load failed, booting with system fonts', fontError);
    captureException(fontError, { where: 'RootLayout.useFonts' });
  }, [fontError]);

  const onLayoutRootView = useCallback(async () => {
    // Web: the app just painted its first frame — fade out the static boot
    // shell (app/+html.tsx) so the real UI is revealed with no blank flash.
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const shell = document.getElementById('minds-boot');
      if (shell) {
        shell.style.opacity = '0';
        setTimeout(() => shell.parentNode?.removeChild(shell), 350);
      }
    }
    if (bootReady) {
      // Throws if the splash is already gone — never let that break boot.
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [bootReady]);

  // Gate on fonts only where a splash screen covers the wait. Web has no
  // splash — returning null left users staring at a blank white page while
  // ~640KB of TTFs downloaded (serially, after the JS bundle). Render with
  // the system font stack and let Roboto swap in.
  if (!bootReady && Platform.OS !== 'web') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: SPLASH_BG }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        {/* backgroundColor is load-bearing, not decoration. hideAsync() fires
            from this View's onLayout, but ThemeProvider below renders NOTHING
            until it has read the saved theme off disk — so the splash lifted
            onto a bare root view, and a bare root view on iOS is WHITE. Every
            cold start flashed white for a frame or two, on every device,
            whatever theme the user had chosen. Painting the splash colour all
            the way down means the frame you get before the app is ready is the
            splash you were already looking at. */}
        <View style={{ flex: 1, backgroundColor: SPLASH_BG }} onLayout={onLayoutRootView}>
          <ErrorBoundary>
            <ThemeProvider>
              <ThemedRoot>
                <ProjectProvider>
                  <AuthProvider>
                    <AudioPlayerProvider>
                      <ActiveConvoProvider>
                        <ToastProvider>
                          <AccountRestrictionWiring />
                          <NotificationWiring />
                          <CutoverWelcome />
                          <NetworkBanner />
                          {/* Root NATIVE STACK — the X-parity navigation
                              keystone. (tabs) is one stack screen; detail
                              screens (post, profile, community, settings, …)
                              are stack screens pushed ON TOP of it: native
                              push/pop transitions, iOS edge-swipe-back, and
                              back always pops to the exact screen + scroll
                              position you came from. Web keeps URL routing
                              through the same tree. */}
                          <AuthRouteGate>
                            <WebShell>
                              <RootStack />
                            </WebShell>
                          </AuthRouteGate>
                          {/* Floating audio mini-player — rides above the tab
                             bar on every screen while a track is loaded. */}
                          <AudioMiniPlayer />
                          {/* Cmd+K palette stays mounted at root so it
                             can open from any screen. Web-only for now;
                             the component returns null on native. */}
                          <CommandPalette />
                        </ToastProvider>
                      </ActiveConvoProvider>
                    </AudioPlayerProvider>
                  </AuthProvider>
                </ProjectProvider>
              </ThemedRoot>
            </ThemeProvider>
          </ErrorBoundary>
        </View>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
