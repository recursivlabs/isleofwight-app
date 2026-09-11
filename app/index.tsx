import * as React from 'react';
import { View, Platform, Animated, Dimensions, Pressable, TextInput, Alert, useWindowDimensions, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useAuth } from '../lib/auth';

const LOGO_DARK = require('../assets/lockup-light.svg');
// The same file expo-splash-screen draws, so the boot hold below is the splash.
const SPLASH_MARK = require('../assets/splash.png');
import { BASE_URL, SITE_URL } from '../lib/recursiv';
import { Text, Button } from '../components';
import { LinkPressable } from '../components/LinkPressable';
// darkColors, NOT the reactive `colors` singleton. This screen paints a night
// sky unconditionally, so its text and accents have to come from the dark
// palette unconditionally too — otherwise a phone set to Light renders
// light-theme foreground colours on a dark background, which is unreadable.
import { lightColors as colors, spacing } from '../constants/theme';
const SPLASH_BG = '#ffffff';
import { useTheme, useInputKeyboardProps } from '../lib/theme';
import { rootPostAuthDestination } from '../lib/authRedirect';
import { passwordResetRedirectUrl } from '../lib/passwordResetUrl';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const W = SCREEN_W || 1200;
const H = SCREEN_H || 900;

// ─── DARK MODE ELEMENTS ──────────────────────────────────────

function Star({ delay, duration, size, x, y, color }: {
  delay: number; duration: number; size: number; x: number; y: number; color: string;
}) {
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: 1, duration: duration * 0.4, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(opacity, { toValue: 0.1, duration: duration * 0.6, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y, width: size, height: size,
      borderRadius: size / 2, backgroundColor: color, opacity,
    }} />
  );
}

function Starfield() {
  const stars = React.useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i, x: Math.random() * W, y: Math.random() * H,
    size: Math.random() * 2 + 0.5, delay: Math.random() * 4000,
    duration: 3000 + Math.random() * 5000,
    color: Math.random() > 0.5 ? 'rgba(212,168,68,0.6)' : 'rgba(255,255,255,0.4)',
  })), []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {stars.map((s) => <Star key={s.id} {...s} />)}
    </View>
  );
}

function ShootingStar({ delay, duration, startX, startY, angle }: {
  delay: number; duration: number; startX: number; startY: number; angle: number;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const endX = startX + Math.cos(angle) * 300;
  const endY = startY + Math.sin(angle) * 300;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: Platform.OS !== 'web' }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: duration * 0.2, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.8, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ]),
      Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });
  return (
    <Animated.View style={{
      position: 'absolute', left: 0, top: 0, opacity,
      transform: [{ translateX }, { translateY }, { rotate: `${angle}rad` }],
    }}>
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.9)' }} />
      <View style={{
        position: 'absolute', right: 3, top: 0.5, width: 40, height: 2, borderRadius: 1,
        ...(Platform.OS === 'web' ? { background: 'linear-gradient(to left, rgba(255,255,255,0.3), transparent)' } as any : { backgroundColor: 'rgba(255,255,255,0.15)' }),
      }} />
    </Animated.View>
  );
}

function ShootingStarField() {
  const shooters = React.useMemo(() => [
    { id: 0, delay: 12000, duration: 1800, startX: W * 0.7, startY: H * 0.1, angle: 2.5 },
    { id: 1, delay: 35000, duration: 1400, startX: W * 0.3, startY: H * 0.15, angle: 2.3 },
    { id: 2, delay: 60000, duration: 2000, startX: W * 0.85, startY: H * 0.3, angle: 2.8 },
  ], []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {shooters.map((s) => <ShootingStar key={s.id} {...s} />)}
    </View>
  );
}

function Ufo({ delay, duration, startX, startY, endX, endY }: {
  delay: number; duration: number; startX: number; startY: number; endX: number; endY: number;
}) {
  const progress = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    // Once. Not a loop: a person who stays five minutes sees one fly-by and
    // that is the whole joke.
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.7, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(progress, { toValue: 1, duration, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [startY, endY] });
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, opacity, transform: [{ translateX }, { translateY }] }}>
      {/* Beam of light underneath */}
      <View style={{
        position: 'absolute', top: 8, left: 6, width: 0, height: 0,
        borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 14,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
        borderTopColor: 'rgba(212,168,68,0.08)',
      }} />
      {/* Saucer body — wide flat oval */}
      <View style={{
        width: 28, height: 6, borderRadius: 14, backgroundColor: 'rgba(180,180,190,0.5)',
        ...(Platform.OS === 'web' ? { boxShadow: '0 0 12px rgba(212,168,68,0.25)' } as any : {}),
      }} />
      {/* Dome on top — half circle */}
      <View style={{
        position: 'absolute', top: -5, left: 8, width: 12, height: 7,
        borderTopLeftRadius: 8, borderTopRightRadius: 8,
        backgroundColor: 'rgba(212,168,68,0.4)',
      }} />
      {/* Tiny lights on the saucer rim */}
      <View style={{ position: 'absolute', top: 2, left: 4, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(212,168,68,0.7)' }} />
      <View style={{ position: 'absolute', top: 2, left: 13, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.6)' }} />
      <View style={{ position: 'absolute', top: 2, left: 22, width: 2, height: 2, borderRadius: 1, backgroundColor: 'rgba(212,168,68,0.7)' }} />
    </Animated.View>
  );
}

function UfoField() {
  // A single UFO, once, after five minutes on the page. An easter egg, not a
  // recurring distraction.
  const ufos = React.useMemo(() => [
    { id: 0, delay: 300000, duration: 14000, startX: -20, startY: H * 0.3, endX: W + 20, endY: H * 0.25 },
  ], []);
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {ufos.map((u) => <Ufo key={u.id} {...u} />)}
    </View>
  );
}

function DarkGlow() {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0.03)).current;
  React.useEffect(() => {
    const anim = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(scale, { toValue: 1, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
      ]),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.06, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(opacity, { toValue: 0.03, duration: 4000, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', width: 500, height: 500, borderRadius: 250,
      backgroundColor: colors.accent, opacity, transform: [{ scale }],
      ...(Platform.OS === 'web' ? { filter: 'blur(120px)' } as any : {}),
    }} />
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────

type ScreenMode = 'home' | 'earlyAccess' | 'login' | 'signUp' | 'submitted' | 'otp' | 'otpVerify';
type InvalidAuthField = 'loginId' | 'loginPassword' | 'otpEmail' | 'otpCode';

const OTP_EMAIL_ERROR_ID = 'otp-email-error';
const OTP_CODE_ERROR_ID = 'otp-code-error';
const PASSWORD_LOGIN_ERROR_ID = 'password-login-error';

const AUTH_POLICY_LINKS = [
  { label: 'Terms', accessibilityLabel: 'Terms of Service', href: 'https://minds.com/p/terms' },
  { label: 'Privacy', accessibilityLabel: 'Privacy Policy', href: 'https://minds.com/p/privacy' },
] as const;

/** One sentence, two plain links, the same pages legacy minds.com uses. */
function AuthPolicyLinks() {
  const link = (item: (typeof AUTH_POLICY_LINKS)[number]) => (
    <LinkPressable
      key={item.label}
      href={item.href as any}
      accessibilityLabel={item.accessibilityLabel}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
    >
      <Text variant="caption" color={colors.textSecondary}>{item.label}</Text>
    </LinkPressable>
  );
  return (
    <View
      accessibilityLabel="Wight.social policies"
      style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: spacing.xl, maxWidth: 360 }}
    >
      <Text variant="caption" color={colors.textMuted}>By signing in you agree to the</Text>
      {link(AUTH_POLICY_LINKS[0])}
      <Text variant="caption" color={colors.textMuted}>and</Text>
      {link(AUTH_POLICY_LINKS[1])}
      <Text variant="caption" color={colors.textMuted}>.</Text>
    </View>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const { auth, returnTo, tab, posted } = useLocalSearchParams<{
    auth?: string;
    returnTo?: string | string[];
    tab?: string | string[];
    posted?: string | string[];
  }>();
  const postAuthDestination = rootPostAuthDestination({ returnTo, tab, posted });
  const { isAuthenticated, isLoading, legacySignInEmail, signIn, signUp, sendOtp, verifyOtp } = useAuth();
  const kbProps = useInputKeyboardProps();
  const { width: viewportW, height: viewportH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Hero scales down to fit narrow viewports (mobile). Desktop tops out at 96.
  const heroFontSize = Math.max(40, Math.min(96, Math.round(viewportW * 0.14)));
  const heroLetterSpacing = Math.max(2, Math.min(12, Math.round(viewportW * 0.018)));
  const isMobile = viewportW < 600;
  // SIGNED OUT IS ALWAYS DARK.
  //
  // This screen used to follow the global theme and crossfade between a night
  // sky and a blue daytime sky. Two problems, both landing on the very first
  // impression anyone gets of the app. The splash is dark, so a light-mode
  // phone went dark splash → blue sky, which reads as a flash rather than a
  // theme. And when the stored theme resolved a beat after first paint, the
  // 400ms crossfade ran on top of that — a second flash, chasing the first.
  //
  // One look, decided here, with nothing to resolve and nothing to animate
  // between. The theme the user actually chose applies once they're signed in,
  // where there's a splash-to-content handoff that can carry it.

  // The sign-in content arrives as one piece, once the wordmark has decoded.
  // Short, and never blocking: onError reveals too, and a timer guarantees the
  // screen is never held hostage by an image that refuses to load.
  const heroOpacity = React.useRef(new Animated.Value(0)).current;
  const revealHero = React.useCallback(() => {
    Animated.timing(heroOpacity, {
      toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [heroOpacity]);
  React.useEffect(() => {
    const t = setTimeout(revealHero, 900);
    return () => clearTimeout(t);
  }, [revealHero]);

  const [screen, setScreenState] = React.useState<ScreenMode>(
    auth === 'otp' ? 'otp' : auth === 'login' ? 'login' : 'home',
  );
  const [email, setEmail] = React.useState('');
  const [loginId, setLoginId] = React.useState('');
  const [loginPw, setLoginPw] = React.useState('');
  const [signUpName, setSignUpName] = React.useState('');
  const [signUpEmail, setSignUpEmail] = React.useState('');
  const [signUpPw, setSignUpPw] = React.useState('');
  const [otpEmail, setOtpEmailState] = React.useState('');
  const [otpRequestedEmail, setOtpRequestedEmail] = React.useState<string | null>(null);
  const [otpCode, setOtpCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [otpNotice, setOtpNotice] = React.useState('');
  const [invalidAuthFields, setInvalidAuthFields] = React.useState<InvalidAuthField[]>([]);
  const [nonOtpLoading, setLoading] = React.useState(false);
  const [otpLoading, setOtpLoading] = React.useState(false);
  const loading = nonOtpLoading || otpLoading;
  const [resetSent, setResetSent] = React.useState(false);
  const passwordLoginPendingRef = React.useRef(false);
  const otpRequestRef = React.useRef<symbol | null>(null);
  const authFormMountedRef = React.useRef(true);
  const screenRef = React.useRef(screen);
  screenRef.current = screen;
  const otpEmailRef = React.useRef(otpEmail);
  otpEmailRef.current = otpEmail;
  const appliedLegacyEmailRef = React.useRef(false);

  // Input edits and navigation begin a new form visit. An old request may
  // finish, but cannot reopen it, replace its error, or unlock a newer request.
  const invalidateOtpRequest = React.useCallback(() => {
    if (otpRequestRef.current === null) return;
    otpRequestRef.current = null;
    setOtpLoading(false);
  }, []);
  const setScreen = React.useCallback((update: React.SetStateAction<ScreenMode>) => {
    const next = typeof update === 'function' ? update(screenRef.current) : update;
    if (next !== screenRef.current) invalidateOtpRequest();
    screenRef.current = next;
    setScreenState(next);
  }, [invalidateOtpRequest]);
  const setOtpEmail = React.useCallback((next: string) => {
    if (next !== otpEmailRef.current) {
      invalidateOtpRequest();
      setOtpRequestedEmail(null);
    }
    otpEmailRef.current = next;
    setOtpEmailState(next);
  }, [invalidateOtpRequest]);
  React.useEffect(() => {
    authFormMountedRef.current = true;
    return () => {
      authFormMountedRef.current = false;
      otpRequestRef.current = null;
    };
  }, []);

  // A failed automatic legacy-session exchange must not dump a returning
  // member on a blank form. This value came from the profile already stored on
  // their device and is only a convenience hint: the normal OTP/password flow
  // still authenticates it. Apply once so later renders never overwrite edits.
  React.useEffect(() => {
    if (isLoading || isAuthenticated || !legacySignInEmail || appliedLegacyEmailRef.current) return;
    appliedLegacyEmailRef.current = true;
    if (auth === 'login') {
      setLoginId(current => current || legacySignInEmail);
    } else if (!otpEmailRef.current) {
      setOtpEmail(legacySignInEmail);
    }
  }, [auth, isAuthenticated, isLoading, legacySignInEmail, setOtpEmail]);

  // Auth compatibility routes can hydrate their params after the first native
  // render, so do not rely only on the useState initializer. Both modes reuse
  // this canonical state machine instead of maintaining reduced login forms.
  React.useEffect(() => {
    if (auth === 'otp' && screenRef.current === 'home') {
      // The homepage and compatibility route share the same email form.
      // Parameter hydration is not an abandoned visit: keep its pending send.
      screenRef.current = 'otp';
      setScreenState('otp');
    }
    if (auth === 'login') setScreen(current => current === 'home' ? 'login' : current);
  }, [auth, setScreen]);

  // Redirect authenticated users into the app. Must be in an effect —
  // calling router.replace() during render triggers a "setState while
  // rendering a different component" warning.
  React.useEffect(() => {
    if (isAuthenticated) {
      router.replace(postAuthDestination as any);
    }
  }, [isAuthenticated, postAuthDestination, router]);

  // Held while the session is restored from disk. This is the frame between the
  // native splash and the app, so it copies the splash exactly — same mark, same
  // 200pt width, same background as the expo-splash-screen config in app.json.
  // It used to be the WORDMARK on #06060a, a different mark on a different black,
  // which made a launch read as two unrelated screens before the app even opened.
  // Nothing animates here; the splash simply stays up until there's an app.
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#08080a', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={SPLASH_MARK} style={{ width: 200, height: 200 }} contentFit="contain" accessibilityLabel="Wight.social" />
      </View>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const handleEarlyAccess = () => {
    if (!email.trim() || !email.includes('@')) return;
    // TODO(dispatcher:50rxflwv): the address is validated and then dropped —
    // nothing stores it, so the submitted screen overpromises until that lands.
    setScreen('submitted');
  };

  const handleSignUp = async () => {
    if (!signUpName.trim() || !signUpEmail.trim() || !signUpPw.trim()) {
      setError('All fields are required');
      return;
    }
    if (signUpPw.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUp(signUpName.trim(), signUpEmail.trim().toLowerCase(), signUpPw);
      router.replace(postAuthDestination as any);
    } catch (err: any) {
      setError(err?.message || 'Sign up failed. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (passwordLoginPendingRef.current || loading) return;
    const missingFields: InvalidAuthField[] = [];
    if (!loginId.trim()) missingFields.push('loginId');
    if (!loginPw.trim()) missingFields.push('loginPassword');
    if (missingFields.length > 0) {
      setInvalidAuthFields(missingFields);
      setError('All fields are required');
      return;
    }
    passwordLoginPendingRef.current = true;
    setInvalidAuthFields([]);
    setError('');
    setLoading(true);
    try {
      const loginEmail = loginId.includes('@') ? loginId.trim().toLowerCase() : `${loginId.trim().toLowerCase()}@minds.com`;
      await signIn(loginEmail, loginPw);
      router.replace(postAuthDestination as any);
    } catch (err: any) {
      setInvalidAuthFields([]);
      setError(err?.message || 'Sign in failed. Check your credentials.');
    } finally {
      passwordLoginPendingRef.current = false;
      setLoading(false);
    }
  };

  const beginOtpRequest = (): symbol | null => {
    if (!authFormMountedRef.current || otpRequestRef.current || nonOtpLoading) return null;
    const request = Symbol('otp-request');
    otpRequestRef.current = request;
    setOtpLoading(true);
    return request;
  };
  const ownsOtpRequest = (request: symbol) => (
    authFormMountedRef.current && otpRequestRef.current === request
  );
  const finishOtpRequest = (request: symbol) => {
    if (!ownsOtpRequest(request)) return;
    otpRequestRef.current = null;
    setOtpLoading(false);
  };

  const handleSendOtp = async () => {
    if (otpRequestRef.current || (screenRef.current !== 'otp' && screenRef.current !== 'home')) return;
    const submittedEmail = otpEmailRef.current.trim().toLowerCase();
    setOtpNotice('');
    if (!submittedEmail || !submittedEmail.includes('@')) {
      setInvalidAuthFields(['otpEmail']);
      setError('Enter a valid email');
      return;
    }
    const request = beginOtpRequest();
    if (!request) return;
    setInvalidAuthFields([]);
    setError('');
    try {
      await sendOtp(submittedEmail);
      if (!ownsOtpRequest(request)) return;
      setOtpRequestedEmail(submittedEmail);
      setOtpCode('');
      setScreen('otpVerify');
    } catch (err: any) {
      if (!ownsOtpRequest(request)) return;
      setInvalidAuthFields([]);
      setError(err?.message || 'Could not send code. Try again.');
    } finally {
      finishOtpRequest(request);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpRequestRef.current || screenRef.current !== 'otpVerify' || !otpRequestedEmail) return;
    setOtpNotice('');
    if (!otpCode.trim() || otpCode.length < 6) {
      setInvalidAuthFields(['otpCode']);
      setError('Enter the 6-digit code');
      return;
    }
    const request = beginOtpRequest();
    if (!request) return;
    setInvalidAuthFields([]);
    setError('');
    try {
      await verifyOtp(otpRequestedEmail, otpCode.trim());
      if (!ownsOtpRequest(request)) return;
      router.replace(postAuthDestination as any);
    } catch (err: any) {
      if (!ownsOtpRequest(request)) return;
      setInvalidAuthFields(['otpCode']);
      setError(err?.message || 'Invalid or expired code. Try again.');
    } finally {
      finishOtpRequest(request);
    }
  };

  const handleResendOtp = async () => {
    if (screenRef.current !== 'otpVerify' || !otpRequestedEmail) return;
    const request = beginOtpRequest();
    if (!request) return;
    setInvalidAuthFields([]);
    setError('');
    setOtpNotice('');
    try {
      await sendOtp(otpRequestedEmail);
      if (!ownsOtpRequest(request)) return;
      setOtpNotice('New code sent.');
    } catch (err: any) {
      if (!ownsOtpRequest(request)) return;
      setError(err?.message || 'Could not resend code. Try again.');
    } finally {
      finishOtpRequest(request);
    }
  };

  const resetAuthError = () => {
    setError('');
    setOtpNotice('');
    setInvalidAuthFields([]);
  };

  const clearAuthFieldError = (field: InvalidAuthField) => {
    if (!invalidAuthFields.includes(field)) {
      if (invalidAuthFields.length === 0) setError('');
      return;
    }
    const remaining = invalidAuthFields.filter((invalidField) => invalidField !== field);
    setInvalidAuthFields(remaining);
    if (remaining.length === 0) setError('');
  };

  // One palette. The light half of this used to exist to stay legible against
  // the sky-blue background, which no longer exists.
  const c = {
    wordmark: colors.accent,
    tagline: colors.text,
    taglineOpacity: 0.5,
    buttonBg: colors.accent,
    buttonText: colors.textInverse,
    ghostText: colors.text,
    inputBg: '#f4f4f5',
    inputBorder: '#e4e4e7',
    inputBorderFocus: colors.accent,
    inputText: '#111111',
    inputPlaceholder: '#9ca3af',
    successText: colors.text,
    subtleText: '#6b7280',
  };

  const inputStyle = {
    backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
    color: c.inputText, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  };

  const primaryButtonStyle = (pressed: boolean) => ({
    paddingVertical: 14, borderRadius: 10,
    backgroundColor: c.buttonBg,
    alignItems: 'center' as const,
    opacity: loading ? 0.5 : pressed ? 0.85 : 1,
    ...(Platform.OS === 'web' ? { cursor: loading ? 'default' : 'pointer' } as any : {}),
  });

  const renderForm = () => {
    if (screen === 'otpVerify') {
      return (
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Text variant="h3" color={c.wordmark} align="center" accessibilityRole="header">Enter code</Text>
          <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.7, marginBottom: spacing.xs }}>
            We sent a 6-digit code to {otpRequestedEmail}
          </Text>
          {/* Stable-height error slot — empty string instead of null keeps
             children indices fixed across error toggles, preventing the
             sibling TextInput from looking like it moved (which triggers a
             remount on RN Web and steals focus mid-type). */}
          <Text
            nativeID={OTP_CODE_ERROR_ID}
            variant="caption"
            color={error ? colors.error : colors.success}
            align="center"
            accessibilityLiveRegion="polite"
          >
            {error || otpNotice || ' '}
          </Text>
          <TextInput
            placeholder="000000"
            placeholderTextColor={c.subtleText}
            accessibilityLabel="One-time code"
            accessibilityHint={Platform.OS !== 'web' && invalidAuthFields.includes('otpCode') ? error : undefined}
            value={otpCode}
            onChangeText={(t) => {
              setOtpCode(t.replace(/\D/g, '').slice(0, 6));
              if (error) clearAuthFieldError('otpCode');
            }}
            keyboardType="number-pad"
            {...kbProps}
            inputMode="numeric"
            // textContentType is iOS-only in intent — but React Native
            // Web maps textContentType="oneTimeCode" to the HTML
            // autocomplete="one-time-code" attribute, which RE-activates
            // Chrome's WebOTP API even when we set autoComplete='off'
            // (RN Web applies textContentType after autoComplete in some
            // versions). WebOTP then steals focus every time the browser
            // thinks an SMS just arrived, which is what Jack was hitting.
            // Set textContentType ONLY on iOS so web never gets the
            // hijacking autocomplete value.
            {...(Platform.OS === 'ios' ? { textContentType: 'oneTimeCode' as const } : {})}
            {...(Platform.OS === 'android' ? { autoComplete: 'sms-otp' as const } : {})}
            maxLength={6}
            autoFocus
            onSubmitEditing={handleVerifyOtp}
            // Block Bitwarden / 1Password / LastPass from grabbing focus
            // and re-filling on every keystroke. Set autoComplete="off"
            // on web so the browser doesn't apply any special handling.
            {...(Platform.OS === 'web' ? {
              autoComplete: 'off',
              'aria-describedby': invalidAuthFields.includes('otpCode') ? OTP_CODE_ERROR_ID : undefined,
              'aria-invalid': invalidAuthFields.includes('otpCode') || undefined,
              'data-bwignore': 'true',
              'data-lpignore': 'true',
              'data-form-type': 'other',
              name: 'otp-code',
            } as any : {})}
            style={{
              ...inputStyle,
              fontSize: 24, letterSpacing: 8, textAlign: 'center' as const,
              fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
            }}
          />
          <Pressable
            onPress={handleVerifyOtp}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => primaryButtonStyle(pressed)}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Verifying...' : 'Continue'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleResendOtp}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Resend code"
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Resend code
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setScreen('otp'); setOtpCode(''); resetAuthError(); }}
            accessibilityRole="button"
            accessibilityLabel="Back to email"
          >
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>Back</Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'otp') {
      return (
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Text variant="h3" color={c.wordmark} align="center" accessibilityRole="header">Continue with email</Text>
          <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.7, marginBottom: spacing.xs }}>
            We'll send you a sign-in code
          </Text>
          <Text
            nativeID={OTP_EMAIL_ERROR_ID}
            variant="caption"
            color={colors.error}
            align="center"
            accessibilityLiveRegion="polite"
          >
            {error || ' '}
          </Text>
          <TextInput
            placeholder="Email"
            placeholderTextColor={c.subtleText}
            accessibilityLabel="Email"
            accessibilityHint={Platform.OS !== 'web' && invalidAuthFields.includes('otpEmail') ? error : undefined}
            value={otpEmail}
            onChangeText={(t) => { setOtpEmail(t); if (error) clearAuthFieldError('otpEmail'); }}
            keyboardType="email-address"
            {...kbProps}
            inputMode="email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
            onSubmitEditing={handleSendOtp}
            {...(Platform.OS === 'web' ? {
              'aria-describedby': invalidAuthFields.includes('otpEmail') ? OTP_EMAIL_ERROR_ID : undefined,
              'aria-invalid': invalidAuthFields.includes('otpEmail') || undefined,
              'data-bwignore': 'true',
              'data-lpignore': 'true',
              'data-form-type': 'other',
              name: 'otp-email',
            } as any : {})}
            style={inputStyle}
          />
          <Pressable
            onPress={handleSendOtp}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Send sign-in code"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => primaryButtonStyle(pressed)}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Sending code...' : 'Send code'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setScreen('login'); resetAuthError(); }}
            accessibilityRole="button"
            accessibilityLabel="Log in with password instead"
          >
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Log in with password instead
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setScreen('home'); resetAuthError(); setOtpEmail(''); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>Back</Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'submitted') {
      return (
        <View style={{ width: '100%', maxWidth: 320, alignItems: 'center', gap: spacing.lg }}>
          <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          <Text variant="h3" color={c.successText} align="center" accessibilityRole="header">
            You're on the list
          </Text>
          <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.7 }}>
            We'll notify you at {email} when your access is ready.
          </Text>
          <Pressable
            onPress={() => { setScreen('home'); setEmail(''); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={{ marginTop: spacing.md }}
          >
            <Text variant="body" color={c.subtleText} style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'earlyAccess') {
      return (
        <View style={{ width: '100%', maxWidth: 320, gap: spacing.lg }}>
          <Text variant="h3" color={c.tagline} align="center" accessibilityRole="header">
            Request early access
          </Text>
          <View style={{
            flexDirection: 'row', gap: spacing.sm,
            width: '100%',
          }}>
            <View style={{ flex: 1 }}>
              <TextInput
                placeholder="Your email"
                placeholderTextColor={c.inputPlaceholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            {...kbProps}
                onSubmitEditing={handleEarlyAccess}
                style={{
                  backgroundColor: c.inputBg,
                  borderWidth: 1,
                  borderColor: c.inputBorder,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  color: c.inputText,
                  fontSize: 15,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
              />
            </View>
            <Pressable
              onPress={handleEarlyAccess}
              accessibilityRole="button"
              accessibilityLabel="Submit early access request"
              style={({ pressed }) => ({
                paddingHorizontal: 20,
                paddingVertical: 13,
                borderRadius: 10,
                backgroundColor: c.buttonBg,
                justifyContent: 'center' as const,
                opacity: pressed ? 0.85 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="arrow-forward" size={18} color={c.buttonText} />
            </Pressable>
          </View>
          <Pressable
            onPress={() => { setScreen('home'); setError(''); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'signUp') {
      return (
        <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
          <Text variant="h3" color={c.wordmark} align="center" accessibilityRole="header">Create Account</Text>
          {error ? <Text variant="caption" color={colors.error} align="center" accessibilityLiveRegion="polite">{error}</Text> : null}
          <TextInput
            placeholder="Name"
            placeholderTextColor={c.subtleText}
            value={signUpName}
            onChangeText={setSignUpName}
            autoCapitalize="words"
            style={{
              backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
              borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
              color: c.inputText, fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <TextInput
            placeholder="Email"
            placeholderTextColor={c.subtleText}
            value={signUpEmail}
            onChangeText={setSignUpEmail}
            keyboardType="email-address"
            {...kbProps}
            autoCapitalize="none"
            style={{
              backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
              borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
              color: c.inputText, fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <TextInput
            placeholder="Password (8+ characters)"
            placeholderTextColor={c.subtleText}
            value={signUpPw}
            onChangeText={setSignUpPw}
            secureTextEntry
            {...kbProps}
            style={{
              backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.inputBorder,
              borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13,
              color: c.inputText, fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <Pressable
            onPress={handleSignUp}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => ({
              paddingVertical: 14, borderRadius: 10,
              backgroundColor: c.buttonBg,
              alignItems: 'center' as const,
              opacity: loading ? 0.5 : pressed ? 0.85 : 1,
              ...(Platform.OS === 'web' ? { cursor: loading ? 'default' : 'pointer' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setScreen('login'); resetAuthError(); }}
            accessibilityRole="button"
            accessibilityLabel="Already have an account? Log in"
          >
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Already have an account? Log in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setScreen('home'); resetAuthError(); setSignUpName(''); setSignUpEmail(''); setSignUpPw(''); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    if (screen === 'login') {
      return (
        <View style={{ width: '100%', maxWidth: 320, gap: spacing.md }}>
          <Text variant="h3" color={c.tagline} align="center" accessibilityRole="header" style={{ marginBottom: spacing.sm }}>
            Log in
          </Text>
          <TextInput
            placeholder="Email or username"
            placeholderTextColor={c.inputPlaceholder}
            accessibilityLabel="Email or username"
            accessibilityHint={Platform.OS !== 'web' && invalidAuthFields.includes('loginId') ? error : undefined}
            nativeID="username"
            value={loginId}
            onChangeText={(t) => { setLoginId(t); if (error) clearAuthFieldError('loginId'); }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            importantForAutofill="yes"
            {...(Platform.OS === 'web' ? {
              'aria-describedby': invalidAuthFields.includes('loginId') ? PASSWORD_LOGIN_ERROR_ID : undefined,
              'aria-invalid': invalidAuthFields.includes('loginId') || undefined,
            } as any : {})}
            style={{
              backgroundColor: c.inputBg,
              borderWidth: 1,
              borderColor: error ? colors.error : c.inputBorder,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 13,
              color: c.inputText,
              fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor={c.inputPlaceholder}
            accessibilityLabel="Password"
            accessibilityHint={Platform.OS !== 'web' && invalidAuthFields.includes('loginPassword') ? error : undefined}
            nativeID="password"
            value={loginPw}
            onChangeText={(t) => { setLoginPw(t); if (error) clearAuthFieldError('loginPassword'); }}
            secureTextEntry
            {...kbProps}
            autoComplete="current-password"
            importantForAutofill="yes"
            {...(Platform.OS === 'web' ? {
              'aria-describedby': invalidAuthFields.includes('loginPassword') ? PASSWORD_LOGIN_ERROR_ID : undefined,
              'aria-invalid': invalidAuthFields.includes('loginPassword') || undefined,
            } as any : {})}
            onSubmitEditing={handleLogin}
            style={{
              backgroundColor: c.inputBg,
              borderWidth: 1,
              borderColor: error ? colors.error : c.inputBorder,
              borderRadius: 10,
              paddingHorizontal: 16,
              paddingVertical: 13,
              color: c.inputText,
              fontSize: 15,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          {error ? (
            <Text
              nativeID={PASSWORD_LOGIN_ERROR_ID}
              variant="caption"
              color={colors.error}
              align="center"
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Log in"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 10,
              backgroundColor: c.buttonBg,
              alignItems: 'center' as const,
              opacity: loading ? 0.5 : pressed ? 0.85 : 1,
              ...(Platform.OS === 'web' ? { cursor: loading ? 'default' : 'pointer' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
              {loading ? 'Signing in...' : 'Log in'}
            </Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              if (!loginId.trim()) {
                setInvalidAuthFields(['loginId']);
                setError('Enter your email first');
                return;
              }
              try {
                await fetch(`${BASE_URL.replace('/api/v1', '')}/api/auth/forget-password`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  // SITE_URL, not BASE_ORIGIN — the reset email must link back
                  // to the app, not the API host.
                  body: JSON.stringify({
                    email: loginId.trim(),
                    redirectTo: passwordResetRedirectUrl(SITE_URL),
                  }),
                });
                setError('');
                setResetSent(true);
              } catch {
                // Still show success to not leak whether the email exists
                setError('');
                setResetSent(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={resetSent ? 'Resend password reset link' : 'Forgot password?'}
          >
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              {resetSent ? 'Resend link' : 'Forgot password?'}
            </Text>
          </Pressable>
          {resetSent && (
            <Text variant="caption" color={c.wordmark} align="center" accessibilityLiveRegion="polite">
              Check your email for a reset link.
            </Text>
          )}
          <Pressable
            onPress={() => { setScreen('otp'); resetAuthError(); }}
            accessibilityRole="button"
            accessibilityLabel="Use email code instead"
          >
            <Text variant="caption" color={c.subtleText} align="center" style={{ opacity: 0.6 }}>
              Use email code instead
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setScreen('home'); resetAuthError(); setLoginId(''); setLoginPw(''); }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text variant="body" color={c.subtleText} align="center" style={{ opacity: 0.5 }}>
              Back
            </Text>
          </Pressable>
        </View>
      );
    }

    // Home — the email field itself, one button, and two quiet links.
    return (
      <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
        <Text
          nativeID={OTP_EMAIL_ERROR_ID}
          variant="caption"
          color={colors.error}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {error || ' '}
        </Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor={c.subtleText}
          accessibilityLabel="Email"
          accessibilityHint={Platform.OS !== 'web' && invalidAuthFields.includes('otpEmail') ? error : undefined}
          value={otpEmail}
          onChangeText={(t) => { setOtpEmail(t); if (error) clearAuthFieldError('otpEmail'); }}
          keyboardType="email-address"
          {...kbProps}
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          onSubmitEditing={handleSendOtp}
          {...(Platform.OS === 'web' ? {
            'aria-describedby': invalidAuthFields.includes('otpEmail') ? OTP_EMAIL_ERROR_ID : undefined,
            'aria-invalid': invalidAuthFields.includes('otpEmail') || undefined,
            'data-bwignore': 'true',
            'data-lpignore': 'true',
            'data-form-type': 'other',
            name: 'otp-email',
          } as any : {})}
          style={inputStyle}
        />
        <Pressable
          onPress={handleSendOtp}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Send sign-in code"
          accessibilityState={{ disabled: loading, busy: loading }}
          style={({ pressed }) => primaryButtonStyle(pressed)}
        >
          <Text variant="bodyMedium" color={c.buttonText} style={{ fontSize: 15 }}>
            {loading ? 'Sending code...' : 'Send code'}
          </Text>
        </Pressable>

      </View>
    );
  };

  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      {/* Night sky — the only sky. No crossfade layer above it, and the base
          colour is the splash colour, so the handoff from the launch image is
          a continuation rather than a cut. */}
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: SPLASH_BG,
      }}>
      </View>

      {/* Content — KeyboardAvoidingView shifts the form above the
          on-screen keyboard so submit buttons stay tappable while
          typing. TouchableWithoutFeedback dismisses the keyboard
          when the user taps outside an input — NATIVE ONLY. On web
          there's no soft keyboard to dismiss, and Keyboard.dismiss()
          translates to blur() on the currently focused TextInput, so
          clicks inside the form bubble up to the wrapper and blur
          the OTP input mid-type/paste. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
      {(() => {
        const body = (
      <Animated.View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: spacing['2xl'],
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.lg,
        opacity: heroOpacity,
      }}>
        {/* No theme toggle. Signed out has one look; the control had nothing
            left to switch between, and a sun icon in the corner of a sign-in
            screen was never the thing anyone came here to do. */}

        {/* Hero */}
        <View style={{ alignItems: 'center', marginBottom: isMobile ? spacing['3xl'] : spacing['6xl'] }}>
          {/* Full Minds wordmark logo (theme-matched), matching the logged-in
             logos. Bulb + lowercase wordmark, source ratio 3.24:1.

             onLoad gates the whole hero, because this is an SVG and decoding it
             takes a few hundred ms on native — long enough that the tagline and
             the buttons painted first and the wordmark dropped in afterwards,
             so the screen assembled in pieces in front of the user. Its box is
             laid out either way, so nothing moves; only the fade waits. */}
          <Image
            source={LOGO_DARK}
            style={{
              width: isMobile ? 280 : 360,
              height: isMobile ? 86 : 110,
              marginBottom: isMobile ? spacing.lg : spacing['3xl'],
            }}
            contentFit="contain"
            accessibilityLabel="Wight.social"
            onLoad={revealHero}
            onError={revealHero}
          />


        </View>

        {renderForm()}
        {screen === 'otp' ? <AuthPolicyLinks /> : null}
      </Animated.View>
        );
        return Platform.OS === 'web' ? body : (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {body}
          </TouchableWithoutFeedback>
        );
      })()}
      </KeyboardAvoidingView>
    </View>
  );
}
