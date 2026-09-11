import * as React from 'react';
import type { UpdateContentPreferencesInput } from '@recursiv/sdk';
// Lazy: expo-updates throws on web / dev client without the module.
let Updates: any = null;
try { Updates = require('expo-updates'); } catch {}
import Constants from 'expo-constants';
import { View, ScrollView, Pressable, Platform, Linking, useWindowDimensions } from 'react-native';
import { showToast } from '../components/Toast';
import { Redirect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button, Input, Card, Avatar, Skeleton } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../lib/auth';
import { BASE_ORIGIN, BASE_URL, SITE_URL } from '../lib/recursiv';
import * as storage from '../lib/storage';
import { getPreference, setPreference } from '../lib/preferences';
import { spacing, radius } from '../constants/theme';
import { useTheme } from '../lib/theme';
import { useColors } from '../lib/theme';
import { openSupportConversation } from '../lib/support';
import { saveAccountExport } from '../lib/accountExport';
import { deletionRequest, deletionRequiresPassword } from '../lib/accountDeletion';
import { chatConversationHref } from '../lib/chatNavigation';
import { passwordResetRedirectUrl } from '../lib/passwordResetUrl';
import { TotpQrCode } from '../components/TotpQrCode';

// A labeled group of settings. The (optional) header is a muted uppercase
// caption sitting just above a Card; the Card uses horizontal-only padding so
// each SettingRow owns its own vertical rhythm and hairlines run edge-to-edge.
function Section({
  title, children, footer,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: string;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.sm }}>
      {title ? (
        <Text
          variant="caption"
          color={colors.textMuted}
          style={{
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            fontFamily: 'Roboto-Medium',
            marginLeft: spacing.md,
          }}
        >
          {title}
        </Text>
      ) : null}
      <Card padding="lg" style={{ paddingVertical: 0 }}>{children}</Card>
      {footer ? (
        <Text variant="caption" color={colors.textMuted} style={{ marginLeft: spacing.md, marginTop: 2, lineHeight: 17 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

// Loose content (forms, pickers, session lists) that doesn't fit the strict
// row grammar still needs the section's edge-to-edge padding model. This wraps
// it in a single padded block with a top hairline so it lines up with rows.
function SectionBlock({ children, first }: { children: React.ReactNode; first?: boolean }) {
  const colors = useColors();
  return (
    <View
      style={{
        paddingVertical: spacing.lg,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.borderSubtle,
      }}
    >
      {children}
    </View>
  );
}

// One consistent row shape for the whole settings surface: an optional leading
// icon in a tinted square, a label (+ optional sublabel), and on the right
// either a control (Toggle), a value string, and/or a chevron when the row
// navigates. Rows stack inside a Card with hairline separators so everything
// scans the same way (iOS / X settings style).
export function SettingRow({
  label, sublabel, icon, iconColor, right, value, onPress, first, destructive, expanded,
}: {
  label: string;
  sublabel?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  right?: React.ReactNode;
  value?: string;
  onPress?: () => void;
  first?: boolean;
  destructive?: boolean;
  expanded?: boolean;
}) {
  const colors = useColors();
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        minHeight: 52,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.borderSubtle,
      }}
    >
      {icon ? (
        // Icon only, no tinted square — matches the nav (neutral ink, error for
        // destructive). The 30px box keeps labels aligned.
        <View style={{ width: 30, alignItems: 'center' }}>
          <Ionicons name={icon} size={21} color={destructive ? colors.error : (iconColor || colors.text)} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={destructive ? colors.error : colors.text}>{label}</Text>
        {sublabel ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, lineHeight: 17 }}>{sublabel}</Text>
        ) : null}
      </View>
      {right ?? (value ? <Text variant="body" color={colors.textMuted}>{value}</Text> : null)}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: -spacing.xs }} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={sublabel}
        accessibilityState={expanded === undefined ? undefined : { expanded }}
        {...(Platform.OS === 'web' && expanded !== undefined ? { 'aria-expanded': expanded } as any : {})}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
        })}
      >
        {body}
      </Pressable>
    );
  }
  return body;
}

// Turn a raw user-agent into a human label ("Chrome on macOS"). The sessions
// list previously read non-existent fields (s.device/s.userAgent) so EVERY row
// fell through to "Unknown device" — the real field is `user_agent`.
function friendlyUA(ua?: string | null): string {
  if (!ua) return 'Unknown device';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    /Expo|okhttp|Dart|axios|node-fetch|node/i.test(ua) ? 'Minds app' : null;
  const os =
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Windows/.test(ua) ? 'Windows' :
    /Linux/.test(ua) ? 'Linux' : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || 'Unknown device';
}

/**
 * The API answers a failed account action with a precise reason -- "Password is
 * incorrect", "You signed in with a social provider", "That email is already in
 * use" -- and the handlers here used to throw it away for a flat "Failed to ...".
 * A 400 then looked like a broken button rather than something the person could
 * act on. The generic line survives only for errors carrying no message.
 */
/**
 * Deactivate is built and its server side is written, but the route ships on a
 * separate branch that is parked until after the OCI deadline work. Showing the
 * row now would offer a button that 404s.
 *
 * Flip this to true in the same change that deploys
 * POST /settings/account/disable. Nothing else needs to move.
 */
const ACCOUNT_DEACTIVATION_AVAILABLE = false;

function reason(e: unknown, fallback: string): string {
  const m = (e as any)?.message;
  return typeof m === 'string' && m.trim() && !/^\s*\[?object/i.test(m) ? m : fallback;
}

// Custom toggle instead of the platform <Switch> — React Native Web's Switch
// doesn't reliably honor trackColor.true and falls back to its default green/
// teal track, which clashes with Minds' gold accent. This Pressable version is
// gold-on / neutral-off everywhere with no platform-default color bleed.
export function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      // accessibilityState does not reach the DOM on web here: the rendered
      // element had role="switch" and no aria-checked at all, so a screen
      // reader announced every one of these as a switch in no state. The only
      // on/off signal was the background colour. Setting it explicitly is also
      // what makes the toggles assertable in a browser test.
      {...(Platform.OS === 'web' ? { 'aria-checked': value } as any : {})}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        backgroundColor: value ? colors.accent : colors.glass,
        borderWidth: 0.5,
        borderColor: value ? colors.accent : colors.borderSubtle,
        padding: 2,
        justifyContent: 'center',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      }}
    >
      <View
        style={{
          width: 21,
          height: 21,
          borderRadius: 11,
          backgroundColor: value ? colors.textOnAccent : colors.text,
          alignSelf: value ? 'flex-end' : 'flex-start',
        }}
      />
    </Pressable>
  );
}

function TwoFactorSetup() {
  const { sdk } = useAuth();
  const colors = useColors();
  // Server truth, not a guess. This was useState(false) with no read anywhere,
  // so an account WITH 2FA on saw "Not enabled" on every visit — a false
  // negative on the one row that exists to reassure. null means "not answered
  // yet"; /profiles/me is the signed-in payload that carries
  // two_factor_enabled (the auth user from /users/me does not).
  const [enabled, setEnabled] = React.useState<boolean | null>(null);
  const [statusUnavailable, setStatusUnavailable] = React.useState(false);
  const [setupUri, setSetupUri] = React.useState<string | null>(null);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [pw2fa, setPw2fa] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [step, setStep] = React.useState<'idle' | 'password' | 'setup' | 'verify'>('idle');

  // These read the SDK's private internals through `as any`: baseUrl is a
  // PRIVATE field on the client and apiKey is not exposed at all, so both came
  // back undefined. BASE became '' and every 2FA call went to a RELATIVE url --
  // it hit the app's own origin, got the HTML index page back with a 200, and
  // died parsing it as JSON. The button did nothing and said nothing. Use the
  // API origin the app already exports, and the stored key, like switchAccount.
  const BASE = BASE_ORIGIN;
  // Better Auth's endpoints take Better Auth's session token, NOT the Recursiv
  // API key. Sending the API key here returned a 500; the key means nothing to
  // Better Auth. The app now keeps this token from sign-in (see lib/auth.tsx).
  const [authToken, setAuthToken] = React.useState<string | null>(null);
  React.useEffect(() => {
    storage.getItem('minds:session_token').then(setAuthToken).catch(() => setAuthToken(null));
  }, []);

  const loadStatus = React.useCallback(async () => {
    if (!sdk) return;
    setStatusUnavailable(false);
    try {
      const res = await (sdk as any).profiles.me();
      const value = res?.data?.two_factor_enabled;
      if (typeof value === 'boolean') {
        setEnabled(value);
      } else {
        // A payload without the field is a server that cannot answer, not an
        // account without 2FA.
        setStatusUnavailable(true);
      }
    } catch {
      setStatusUnavailable(true);
    }
  }, [sdk]);
  React.useEffect(() => { loadStatus(); }, [loadStatus]);

  const enable2FA = async () => {
    if (!pw2fa) { setStep('password'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/two-factor/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        // Turning on 2FA re-checks the password: it is the step that stops
        // someone with a borrowed session from locking out the real owner.
        body: JSON.stringify({ password: pw2fa }),
      });
      const data = await res.json().catch(() => null);
      const uri = data?.totpURI || data?.totp_uri;
      if (uri) {
        setSetupUri(uri);
        setPw2fa('');
        setStep('setup');
      } else {
        // Previously this branch was empty, so a rejected request looked
        // exactly like a working button that had nothing to say.
        showToast(data?.message || `Could not enable 2FA (${res.status})`, 'error');
      }
    } catch (e: any) { showToast(e?.message || 'Could not enable 2FA', 'error'); }
    setLoading(false);
  };

  const verify2FA = async () => {
    if (verifyCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/two-factor/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (res.ok) {
        setEnabled(true);
        setStatusUnavailable(false);
        setStep('idle');
        setSetupUri(null);
        showToast('2FA is now enabled', 'success');
      } else {
        showToast('Invalid code. Try again.', 'error');
      }
    } catch { showToast('Verification failed', 'error'); }
    setLoading(false);
  };

  if (step === 'password') {
    return (
      <View style={{ gap: spacing.md, paddingVertical: spacing.lg }}>
        <Text variant="label" color={colors.textMuted}>Confirm your password</Text>
        <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
          Enter your password to turn on two-factor authentication.
        </Text>
        <Input
          value={pw2fa}
          onChangeText={setPw2fa}
          placeholder="Current password"
          secureTextEntry
          textContentType="password"
          autoComplete="current-password"
          onSubmitEditing={enable2FA}
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button onPress={() => { setStep('idle'); setPw2fa(''); }} variant="ghost" size="sm">Cancel</Button>
          <Button onPress={enable2FA} loading={loading} size="sm" disabled={!pw2fa}>Continue</Button>
        </View>
      </View>
    );
  }

  if (step === 'setup' && setupUri) {
    return (
      <View style={{ gap: spacing.md, paddingVertical: spacing.lg }}>
        <Text variant="label" color={colors.textMuted}>Set up authenticator app</Text>
        <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
          Scan this code with your authenticator app (Google Authenticator, Authy, etc.):
        </Text>
        <TotpQrCode uri={setupUri} />
        <Text variant="caption" color={colors.textMuted}>Enter the 6-digit code from your app to verify:</Text>
        <Input
          value={verifyCode}
          onChangeText={t => setVerifyCode(t.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          keyboardType="number-pad"
          inputMode="numeric"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          selectTextOnFocus
        />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button onPress={() => { setStep('idle'); setSetupUri(null); setPw2fa(''); }} variant="ghost" size="sm">Cancel</Button>
          <Button onPress={verify2FA} loading={loading} size="sm" disabled={verifyCode.length !== 6}>Verify</Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 52 }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: radius.sm,
          backgroundColor: colors.accentMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="shield-checkmark-outline" size={17} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="body">Two-factor authentication</Text>
        <Text
          variant="caption"
          color={
            statusUnavailable && enabled === null ? colors.error
            : enabled ? colors.success
            : colors.textMuted
          }
          style={{ marginTop: 2 }}
        >
          {statusUnavailable && enabled === null ? 'Could not check status'
            : enabled === null ? 'Checking…'
            : enabled ? 'Enabled' : 'Not enabled'}
        </Text>
      </View>
      {statusUnavailable && enabled === null ? (
        <Button onPress={loadStatus} variant="secondary" size="sm">
          Retry
        </Button>
      ) : (
        // Disabled until the server answers: with the action live during the
        // check, an account that already has 2FA could start re-enrollment
        // before the row knows better — the exact path the status fix closes.
        <Button onPress={enable2FA} loading={loading} variant="secondary" size="sm" disabled={enabled === null}>
          {enabled ? 'Reconfigure' : 'Enable'}
        </Button>
      )}
    </View>
  );
}

// Settings are organized into categories shown as a left rail on desktop and a
// drill-down list on mobile — so the surface uses horizontal space instead of
// one endless 720px column, and every category renders in the same panel grammar.
type CatKey = 'account' | 'security' | 'privacy' | 'notifications' | 'appearance' | 'feed' | 'ai' | 'data' | 'help' | 'about';
const CATS: { key: CatKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'account', label: 'Account', icon: 'person-outline' },
  { key: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { key: 'privacy', label: 'Privacy', icon: 'lock-closed-outline' },
  { key: 'notifications', label: 'Notifications', icon: 'notifications-outline' },
  { key: 'appearance', label: 'Appearance', icon: 'color-palette-outline' },
  { key: 'feed', label: 'Feed & content', icon: 'newspaper-outline' },
  { key: 'ai', label: 'AI agent', icon: 'sparkles-outline' },
  { key: 'data', label: 'Your data', icon: 'download-outline' },
  { key: 'help', label: 'Help & feedback', icon: 'help-buoy-outline' },
  { key: 'about', label: 'About', icon: 'information-circle-outline' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { sdk, user, signOut, signOutEverywhere, isLoading: authLoading } = useAuth();
  const { mode: themeMode, setMode: setThemeMode, hasDevicePreference, colors } = useTheme();
  // `load` is rebuilt only when auth or the sdk changes, so it would otherwise
  // read whatever the theme was when it was created. Refs keep the comparison
  // and the value it pushes honest.
  const themeModeRef = React.useRef(themeMode);
  themeModeRef.current = themeMode;
  const hasDevicePreferenceRef = React.useRef(hasDevicePreference);
  hasDevicePreferenceRef.current = hasDevicePreference;

  const [loading, setLoading] = React.useState(true);
  const [settingsUnavailable, setSettingsUnavailable] = React.useState(false);
  const [sessions, setSessions] = React.useState<any[]>([]);
  const [loginHistory, setLoginHistory] = React.useState<any[]>([]);
  const [sessionsUnavailable, setSessionsUnavailable] = React.useState(false);
  const [loginHistoryUnavailable, setLoginHistoryUnavailable] = React.useState(false);
  const [securityRefreshing, setSecurityRefreshing] = React.useState(false);
  const [privacy, setPrivacy] = React.useState({ profilePublic: true, showEmail: false });
  // Notification toggles. Local UI state for now (was hardcoded-on with no
  // handler); wire to a server notification-preferences API when it lands.
  const [notifPrefs, setNotifPrefs] = React.useState({ inApp: true, push: true, email: false });
  // These used to be four per-event toggles that only set local state -- nothing
  // was ever sent, so every switch reset on reload. The API controls delivery by
  // channel across all event types, so the screen now offers exactly that and
  // saves it.
  const toggleNotif = async (key: 'inApp' | 'push' | 'email', v: boolean) => {
    if (!sdk) return;
    const prev = notifPrefs;
    const updated = { ...notifPrefs, [key]: v };
    setNotifPrefs(updated);
    try {
      await sdk.settings.updateNotifications({
        in_app: updated.inApp,
        push: updated.push,
        email: updated.email,
      } as any);
    } catch (e) {
      setNotifPrefs(prev);
      showMsg(reason(e, 'Failed to update notifications.'), true);
    }
  };
  const [pw, setPw] = React.useState({ current: '', next: '' });
  const [passwordResetSent, setPasswordResetSent] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState('');
  const [emailPw, setEmailPw] = React.useState('');
  const [saving, setSaving] = React.useState('');
  // Collapse the credential-change forms by default so Account isn't a wall of
  // inputs; they expand only when the user taps the row.
  const [showPwForm, setShowPwForm] = React.useState(false);
  const [showEmailForm, setShowEmailForm] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [disableConfirm, setDisableConfirm] = React.useState(false);
  const [disablePw, setDisablePw] = React.useState('');
  const [deleteChallenge, setDeleteChallenge] = React.useState<'confirm_text' | 'password'>('confirm_text');
  const [deleteValue, setDeleteValue] = React.useState('');
  const [deletionStatus, setDeletionStatus] = React.useState<{ requested: boolean; scheduled_at: string | null }>({
    requested: false,
    scheduled_at: null,
  });
  // Forces re-read of getPreference() values when the user toggles a
  // local pref (Switch / pill button). lib/preferences caches in-memory
  // so without this nudge the active-pill style won't update until the
  // next mount.
  const [, setSettingsTick] = React.useState(0);

  // Two-pane navigation. On desktop the left rail + content pane are both
  // always visible; on mobile we drill from the category list into a detail
  // pane (standard iOS settings). `active` is the selected category.
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 880;
  const [active, setActive] = React.useState<CatKey>('account');
  const [showDetail, setShowDetail] = React.useState(false);

  // Theme was device-local even though the server has had a theme column and an
  // updateAppearance endpoint all along -- the app simply never called it. On X
  // your theme follows you; here it did not.
  const applyTheme = React.useCallback(async (mode: 'system' | 'light' | 'dark') => {
    setThemeMode(mode);
    if (!sdk) return;
    try {
      await sdk.settings.updateAppearance({ theme: mode } as any);
    } catch {
      // The local theme still applies; only the cross-device copy failed, so
      // say so rather than yanking the colours back.
      showMsg('Theme saved on this device only.', true);
    }
  }, [sdk, setThemeMode]);

  // Content preferences are written to BOTH places on purpose. The local store
  // stays because the feed, the player and the agent read these synchronously
  // on every render and must not wait on a network call. The server copy is
  // what makes them follow the account: all four used to be device-only, so
  // signing in on a phone silently reset them -- someone who had turned
  // sensitive content off saw it again.
  //
  // Local first so the UI responds immediately, then the server. If the server
  // refuses, the local value rolls back so the screen never shows a setting the
  // account does not actually have.
  const setContentPref = React.useCallback(async (
    key: 'showNsfw' | 'autoplayVideo' | 'aiEnabled' | 'defaultFeed',
    value: boolean | string,
    wireKey: 'show_nsfw' | 'autoplay_video' | 'ai_enabled' | 'default_feed',
  ) => {
    const previous = getPreference(key as any);
    setPreference(key as any, value as any);
    setSettingsTick(t => t + 1);
    if (!sdk) return;
    try {
      await sdk.settings.updateContent({ [wireKey]: value } as UpdateContentPreferencesInput);
    } catch {
      setPreference(key as any, previous as any);
      setSettingsTick(t => t + 1);
      showMsg('Could not save that setting.', true);
    }
  }, [sdk]);

  const loadSecurityActivity = React.useCallback(async () => {
    if (!sdk) return;
    setSecurityRefreshing(true);
    try {
      const [sessionsResult, historyResult] = await Promise.allSettled([
        sdk.settings.listSessions(),
        sdk.settings.getLoginHistory({ limit: 10 }),
      ]);
      if (sessionsResult.status === 'fulfilled') {
        const value = sessionsResult.value as any;
        setSessions(value?.data ?? value ?? []);
        setSessionsUnavailable(false);
      } else {
        setSessionsUnavailable(true);
      }
      if (historyResult.status === 'fulfilled') {
        const value = historyResult.value as any;
        setLoginHistory(value?.data ?? value ?? []);
        setLoginHistoryUnavailable(false);
      } else {
        setLoginHistoryUnavailable(true);
      }
    } finally {
      setSecurityRefreshing(false);
    }
  }, [sdk]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the theme setter is stable; settings reload only when auth or the SDK changes.
  const load = React.useCallback(async () => {
    if (authLoading) return;
    if (!sdk) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setSettingsUnavailable(false);
    try {
      const securityActivity = loadSecurityActivity();
      const [prefsResult, deletionResult] = await Promise.allSettled([
        sdk.settings.getPreferences(),
        sdk.settings.getDeletionStatus(),
      ]);
      const prefs = prefsResult.status === 'fulfilled' ? prefsResult.value : null;
      const deletion = deletionResult.status === 'fulfilled' ? deletionResult.value : null;
      setSettingsUnavailable(
        prefsResult.status === 'rejected' || deletionResult.status === 'rejected',
      );
      const privacyData = (prefs as any)?.data?.privacy ?? (prefs as any)?.privacy;
      if (privacyData) {
        // The API speaks snake_case here, and profile visibility is an enum rather
        // than a boolean. Reading profilePublic/showEmail returned undefined every
        // time, so a saved toggle always read back as its default -- the setting
        // did persist, the screen just never showed it.
        setPrivacy({
          profilePublic: (privacyData.profile_visibility ?? 'public') === 'public',
          showEmail: privacyData.show_email ?? false,
        });
      }
      const appearanceData = (prefs as any)?.data?.appearance ?? (prefs as any)?.appearance;
      // The account theme is for a device that has never been told what to do.
      // It must NOT overrule a device the reader has already set: this used to
      // apply the stored theme on every visit, so anyone reading in dark under
      // mode 'system' was converted to explicit light the moment they opened
      // Settings — the server said 'light', 'light' !== 'system', and the screen
      // "corrected" them. The device the reader is holding wins; if the account
      // disagrees, teach the account rather than the device.
      const serverTheme = appearanceData?.theme;
      if (serverTheme === 'system' || serverTheme === 'light' || serverTheme === 'dark') {
        const localMode = themeModeRef.current;
        if (!hasDevicePreferenceRef.current) {
          setThemeMode(serverTheme);
        } else if (serverTheme !== localMode) {
          sdk.settings.updateAppearance({ theme: localMode } as any).catch(() => {});
        }
      }
      // A fresh device must inherit the account's content settings rather than
      // fall back to defaults, which is exactly what made these feel reset.
      const contentData = (prefs as any)?.data?.content ?? (prefs as any)?.content;
      if (contentData) {
        if (typeof contentData.show_nsfw === 'boolean') setPreference('showNsfw', contentData.show_nsfw);
        if (typeof contentData.autoplay_video === 'boolean') setPreference('autoplayVideo', contentData.autoplay_video);
        if (typeof contentData.ai_enabled === 'boolean') setPreference('aiEnabled', contentData.ai_enabled);
        if (contentData.default_feed) setPreference('defaultFeed', contentData.default_feed);
        setSettingsTick(t => t + 1);
      }
      const notifData = (prefs as any)?.data?.notifications ?? (prefs as any)?.notifications;
      if (notifData) {
        setNotifPrefs({
          inApp: notifData.in_app ?? true,
          push: notifData.push ?? true,
          email: notifData.email ?? false,
        });
      }
      const deletionData = (deletion as any)?.data;
      if (deletionData) {
        setDeletionStatus({
          requested: deletionData.requested === true,
          scheduled_at: deletionData.scheduled_at ?? null,
        });
      }
      await securityActivity;
    } catch {
      setSettingsUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [authLoading, sdk, loadSecurityActivity]);

  React.useEffect(() => { load(); }, [load]);

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);

  const showMsg = (msg: string, isError = false) => {
    if (isError) {
      showToast(msg, 'error');
    } else {
      setStatusMsg(msg);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const changePassword = async () => {
    if (!sdk || !pw.current || !pw.next) return;
    setSaving('pw');
    try {
      await sdk.settings.changePassword({ current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '' });
      showMsg('Password changed.');
    } catch (e) { showMsg(reason(e, 'Failed to change password.'), true); }
    setSaving('');
  };

  const requestPasswordSetup = async () => {
    if (!sdk || !user?.email) return;
    setSaving('pw-reset');
    try {
      await sdk.auth.forgetPassword({
        email: user.email,
        redirectTo: passwordResetRedirectUrl(SITE_URL),
      });
      setPasswordResetSent(true);
    } catch (e) {
      showMsg(reason(e, 'Failed to send a password setup link.'), true);
    }
    setSaving('');
  };

  const changeEmail = async () => {
    if (!sdk || !newEmail || !emailPw) return;
    setSaving('email');
    try {
      await sdk.settings.requestEmailChange({ new_email: newEmail, password: emailPw });
      setNewEmail(''); setEmailPw('');
      showMsg('Check your email to confirm the change.');
    } catch (e) { showMsg(reason(e, 'Failed to request email change.'), true); }
    setSaving('');
  };

  const togglePrivacy = async (key: 'profilePublic' | 'showEmail', value: boolean) => {
    if (!sdk) return;
    const updated = { ...privacy, [key]: value };
    setPrivacy(updated);
    try {
      // profile_public is not a field. The route takes profile_visibility, and an
      // unknown key is dropped by the validator rather than rejected, so this
      // returned 200 and wrote nothing.
      await sdk.settings.updatePrivacy({
        profile_visibility: updated.profilePublic ? 'public' : 'private',
        show_email: updated.showEmail,
      } as any);
    } catch (e) { setPrivacy(privacy); showMsg(reason(e, 'Failed to update privacy.'), true); }
  };

  const revokeSession = async (id: string) => {
    if (!sdk) return;
    try {
      await sdk.settings.revokeSession(id);
      setSessions(s => s.filter(x => x.id !== id));
    } catch { showMsg('Failed to revoke session.', true); }
  };

  const [showAllSessions, setShowAllSessions] = React.useState(false);

  const handleSignOutEverywhere = async () => {
    setSaving('sessions');
    try {
      await signOutEverywhere();
    } catch { showMsg('Could not sign out every device. Your current session is still active.', true); }
    setSaving('');
  };

  // Deactivation, not deletion. The account is hidden, nothing is destroyed,
  // and signing back in restores it. Offered above Delete so the reversible
  // option is the one people meet first -- previously the only way to step away
  // was to delete everything.
  const deactivateAccount = async () => {
    if (!sdk || !disablePw) return;
    setSaving('disable');
    const key = await storage.getItem('minds:api_key');
    try {
      const res = await fetch(`${BASE_URL}/settings/account/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ password: disablePw }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || `Could not deactivate (${res.status})`);
      // Deactivating drops every session server-side, so this device must not
      // keep pretending to be signed in.
      setDisableConfirm(false); setDisablePw('');
      signOut();
    } catch (e) {
      showMsg(reason(e, 'Could not deactivate your account.'), true);
    }
    setSaving('');
  };

  const deleteAccount = async () => {
    if (!sdk || !deleteValue) return;
    setSaving('delete');
    try {
      const response = await sdk.settings.requestDeletion(deletionRequest(deleteChallenge, deleteValue));
      const scheduledAt = (response as any)?.data?.scheduled_at ?? null;
      setDeletionStatus({ requested: true, scheduled_at: scheduledAt });
      showMsg('Account deletion scheduled. You can cancel it during the grace period.');
      setDeleteConfirm(false);
      setDeleteChallenge('confirm_text');
      setDeleteValue('');
    } catch (e) {
      if (deletionRequiresPassword(e) && deleteChallenge !== 'password') {
        setDeleteChallenge('password');
        setDeleteValue('');
        showMsg('This account has a password. Enter it to confirm deletion.', true);
      } else {
        showMsg(reason(e, 'Failed to request deletion.'), true);
      }
    }
    setSaving('');
  };

  const cancelDeletion = async () => {
    if (!sdk) return;
    setSaving('cancel-delete');
    try {
      await sdk.settings.cancelDeletion();
      setDeletionStatus({ requested: false, scheduled_at: null });
      showMsg('Account deletion cancelled.');
    } catch (e) {
      showMsg(reason(e, 'Failed to cancel deletion.'), true);
    }
    setSaving('');
  };

  const exportData = async () => {
    if (!sdk || saving === 'export') return;
    setSaving('export');
    try {
      const response = await sdk.settings.downloadAccountExport();
      const filename = await saveAccountExport(response);
      showMsg(Platform.OS === 'web'
        ? `Downloaded ${filename}`
        : 'Your account export is ready to save or share.');
    } catch (e) {
      showMsg(reason(e, 'Could not export your account.'), true);
    }
    setSaving('');
  };

  if (authLoading || loading) {
    return (
      <Container safeTop maxWidth={1040}>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl }}>
          <Skeleton height={88} />
          {[1, 2, 3].map(i => <Skeleton key={i} height={80} />)}
        </View>
      </Container>
    );
  }

  if (!user) return <Redirect href="/" />;

  const statusBanner = statusMsg ? (
    <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', borderWidth: 0.5, borderColor: colors.borderSubtle }}>
      <Text variant="body" color={colors.success}>{statusMsg}</Text>
    </View>
  ) : null;

  const settingsErrorBanner = settingsUnavailable ? (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors.errorMuted,
        padding: spacing.md,
        borderRadius: radius.md,
        borderWidth: 0.5,
        borderColor: colors.error,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
      <Text variant="body" color={colors.error} style={{ flex: 1 }}>
        Some account settings could not be loaded.
      </Text>
      <Button onPress={load} variant="secondary" size="sm">
        Retry settings
      </Button>
    </View>
  ) : null;

  // The profile header — avatar + name + handle, tappable straight to the
  // profile. Sits atop the left rail on desktop and the list on mobile.
  const profileCard = (
    <Pressable
      onPress={() => router.push({ pathname: '/[username]', params: { username: user?.username || user?.id || '' } } as any)}
      accessibilityRole="link"
      accessibilityLabel={`View profile for ${user?.name || user?.username || 'your account'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
    >
      <Card variant="raised" padding="lg" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={user?.image} name={user?.name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{user?.name || user?.username || 'Your profile'}</Text>
          {user?.username ? <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>@{user.username}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Card>
    </Pressable>
  );

  // The category rail (desktop) / drill-down list (mobile).
  const navList = (
    <View
      accessibilityRole={isWide ? 'tablist' : undefined}
      accessibilityLabel="Settings categories"
      style={{ gap: spacing.xs }}
    >
      {CATS.map(c => {
        const isOn = active === c.key;
        const highlight = isWide && isOn;
        return (
          <Pressable
            key={c.key}
            onPress={() => { setActive(c.key); setShowDetail(true); }}
            accessibilityRole={isWide ? 'tab' : 'button'}
            accessibilityLabel={c.label}
            accessibilityState={isWide ? { selected: isOn } : undefined}
            aria-selected={isWide ? isOn : undefined}
            style={({ pressed, hovered }: any) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm + 1,
              paddingHorizontal: spacing.md,
              borderRadius: radius.md,
              backgroundColor: highlight ? colors.accentSubtle : hovered ? colors.glass : 'transparent',
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <View style={{ width: 30, alignItems: 'center' }}>
              <Ionicons name={c.icon} size={22} color={highlight ? colors.accent : colors.text} />
            </View>
            <Text variant="bodyMedium" color={highlight ? colors.accent : colors.text} style={{ flex: 1 }}>{c.label}</Text>
            {!isWide && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          </Pressable>
        );
      })}
    </View>
  );

  const versionFooter = (
    <View style={{ alignItems: 'center', gap: 2, paddingTop: spacing.xl }}>
      <Text variant="bodyMedium" color={colors.textSecondary}>Isle of Wight</Text>
      <Text variant="caption" color={colors.textMuted}>Built on Recursiv · Powered by open source</Text>
      {/* Real native version + the OTA update actually RUNNING on this
          device. The short update id is the ground truth for "did my phone
          get the latest bundle" — recurring debugging pain without it. */}
      <Text variant="caption" color={colors.textMuted}>
        {`Version ${Constants.expoConfig?.version || '2.0.1'}${
          Updates?.updateId ? ` · update ${String(Updates.updateId).slice(0, 8)}` : ' · embedded bundle'
        }`}
      </Text>
    </View>
  );

  const renderPanel = () => {
    switch (active) {
      case 'account':
        return (
          <>
            <Section title="Login & email">
              <SettingRow first icon="mail-outline" label="Email" value={user?.email || 'Not set'} />
              <SettingRow icon="key-outline" label="Change password" expanded={showPwForm} onPress={() => setShowPwForm(s => !s)} />
              {showPwForm && (
                <SectionBlock>
                  <View style={{ gap: spacing.sm }}>
                    <Input secureTextEntry value={pw.current} onChangeText={t => setPw(p => ({ ...p, current: t }))} placeholder="Current password" />
                    <Input secureTextEntry value={pw.next} onChangeText={t => setPw(p => ({ ...p, next: t }))} placeholder="New password" />
                    <Button onPress={changePassword} loading={saving === 'pw'} size="sm" disabled={!pw.current || !pw.next}>Change Password</Button>
                    <Text variant="caption" color={colors.textMuted}>
                      Signed up with an email code, or forgot your current password?
                    </Text>
                    <Button
                      onPress={requestPasswordSetup}
                      loading={saving === 'pw-reset'}
                      size="sm"
                      variant="secondary"
                      disabled={!user?.email}
                    >
                      Email me a password setup link
                    </Button>
                    {passwordResetSent ? (
                      <Text variant="caption" color={colors.accent} accessibilityLiveRegion="polite">
                        Check {user?.email} for a secure link to set your password.
                      </Text>
                    ) : null}
                  </View>
                </SectionBlock>
              )}
              <SettingRow icon="at-outline" label="Change email" expanded={showEmailForm} onPress={() => setShowEmailForm(s => !s)} />
              {showEmailForm && (
                <SectionBlock>
                  <View style={{ gap: spacing.sm }}>
                    <Input value={newEmail} onChangeText={setNewEmail} placeholder="new@email.com" keyboardType="email-address" autoCapitalize="none" />
                    <Input secureTextEntry value={emailPw} onChangeText={setEmailPw} placeholder="Confirm with your password" />
                    <Button onPress={changeEmail} loading={saving === 'email'} size="sm" disabled={!newEmail || !emailPw}>Change Email</Button>
                  </View>
                </SectionBlock>
              )}
            </Section>
            <Section title="Account actions">
              <SettingRow first icon="swap-horizontal-outline" label="Switch account" onPress={() => router.push('/switch-account' as any)} />
              <SettingRow icon="log-out-outline" label="Log out" onPress={() => { signOut(); }} />
              {ACCOUNT_DEACTIVATION_AVAILABLE ? (
                <SettingRow
                  icon="moon-outline"
                  label="Deactivate account"
                  sublabel="Hide your account. Signing back in restores it."
                  onPress={() => setDisableConfirm(true)}
                />
              ) : null}
              {ACCOUNT_DEACTIVATION_AVAILABLE && disableConfirm && (
                <SectionBlock>
                  <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22, marginBottom: spacing.md }}>
                    Your profile and posts stop being visible to other people. Nothing is
                    deleted, and signing back in brings everything back.
                  </Text>
                  <Input
                    value={disablePw}
                    onChangeText={setDisablePw}
                    placeholder="Current password"
                    secureTextEntry
                    textContentType="password"
                    autoComplete="current-password"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                    <Button onPress={() => { setDisableConfirm(false); setDisablePw(''); }} variant="ghost" size="sm">Cancel</Button>
                    <Button onPress={deactivateAccount} loading={saving === 'disable'} size="sm" disabled={!disablePw}>Deactivate</Button>
                  </View>
                </SectionBlock>
              )}
              {deletionStatus.requested ? (
                <SectionBlock>
                  <View style={{ gap: spacing.md }}>
                    <Text variant="bodyMedium">Account deletion is scheduled</Text>
                    <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                      {deletionStatus.scheduled_at
                        ? `Your account is scheduled for deletion on ${new Date(deletionStatus.scheduled_at).toLocaleDateString()}.`
                        : 'Your account is in its deletion grace period.'}{' '}
                      Cancel below if you want to keep it.
                    </Text>
                    <Button
                      onPress={cancelDeletion}
                      loading={saving === 'cancel-delete'}
                      variant="secondary"
                      size="sm"
                    >
                      Cancel deletion
                    </Button>
                  </View>
                </SectionBlock>
              ) : (
                <>
                  <SettingRow icon="trash-outline" label="Delete account" destructive onPress={() => setDeleteConfirm(true)} />
                  {deleteConfirm && (
                    <SectionBlock>
                      <View style={{ gap: spacing.md }}>
                        <Text variant="body" color={colors.error}>
                          {deleteChallenge === 'password'
                            ? 'This account has a password. Enter it to schedule deletion.'
                            : 'Deletion starts a 30-day grace period. Type DELETE to confirm.'}
                        </Text>
                        <Input
                          secureTextEntry={deleteChallenge === 'password'}
                          value={deleteValue}
                          onChangeText={setDeleteValue}
                          placeholder={deleteChallenge === 'password' ? 'Your password' : 'DELETE'}
                          autoCapitalize={deleteChallenge === 'password' ? 'none' : 'characters'}
                        />
                        <View style={{ flexDirection: 'row', gap: spacing.md }}>
                          <Button
                            onPress={() => {
                              setDeleteConfirm(false);
                              setDeleteChallenge('confirm_text');
                              setDeleteValue('');
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            Cancel
                          </Button>
                          <Button
                            onPress={deleteAccount}
                            loading={saving === 'delete'}
                            size="sm"
                            accentColor={colors.error}
                            disabled={deleteChallenge === 'confirm_text' ? deleteValue !== 'DELETE' : !deleteValue}
                          >
                            Schedule deletion
                          </Button>
                        </View>
                      </View>
                    </SectionBlock>
                  )}
                </>
              )}
            </Section>
          </>
        );

      case 'security':
        return (
          <Section>
            <TwoFactorSetup />
            {(sessionsUnavailable || loginHistoryUnavailable) && (
              <SectionBlock>
                <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
                  <Text variant="body" color={colors.error} style={{ flex: 1 }}>
                    Some security activity could not be loaded.
                  </Text>
                  <Button
                    onPress={loadSecurityActivity}
                    loading={securityRefreshing}
                    variant="secondary"
                    size="sm"
                  >
                    Retry security activity
                  </Button>
                </View>
              </SectionBlock>
            )}
            <SectionBlock>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text variant="caption" color={colors.textMuted} style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Roboto-Medium' }}>
                  Sessions & app access{sessions.length > 0 ? ` · ${sessions.length}` : ''}
                </Text>
                <Button onPress={handleSignOutEverywhere} loading={saving === 'sessions'} variant="ghost" size="sm" accentColor={colors.error}>
                  Sign out everywhere
                </Button>
              </View>
              {sessionsUnavailable ? (
                <Text variant="caption" color={colors.error}>Sessions are unavailable.</Text>
              ) : null}
              {sessions.length === 0 && !sessionsUnavailable ? (
                <Text variant="caption" color={colors.textMuted}>No browser sessions. App access may still be active on other devices.</Text>
              ) : sessions.length > 0 ? (() => {
                // Current device first, then the rest; collapse the long tail.
                const ordered = [...sessions].sort((a: any, b: any) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0));
                const visible = showAllSessions ? ordered : ordered.slice(0, 4);
                return (
                  <>
                    {visible.map((s: any) => (
                      <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                            <Text variant="bodyMedium">{friendlyUA(s.user_agent)}</Text>
                            {s.is_current && <Text variant="caption" color={colors.accent}>This device</Text>}
                          </View>
                          <Text variant="caption" color={colors.textMuted}>
                            {[s.ip_address, s.created_at ? `since ${new Date(s.created_at).toLocaleDateString()}` : ''].filter(Boolean).join('  ·  ')}
                          </Text>
                        </View>
                        {!s.is_current && <Button onPress={() => revokeSession(s.id)} variant="ghost" size="sm">Revoke</Button>}
                      </View>
                    ))}
                    {ordered.length > 4 && (
                      <Pressable
                        onPress={() => setShowAllSessions(v => !v)}
                        accessibilityRole="button"
                        accessibilityLabel={showAllSessions ? 'Show fewer sessions' : `Show all ${ordered.length} sessions`}
                        accessibilityState={{ expanded: showAllSessions }}
                        {...(Platform.OS === 'web' ? { 'aria-expanded': showAllSessions } as any : {})}
                        style={{ paddingVertical: spacing.sm }}
                      >
                        <Text variant="caption" color={colors.accent}>
                          {showAllSessions ? 'Show fewer' : `Show all ${ordered.length} sessions`}
                        </Text>
                      </Pressable>
                    )}
                  </>
                );
              })() : null}
            </SectionBlock>
            <SectionBlock>
              <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Roboto-Medium' }}>
                Login history
              </Text>
              {loginHistoryUnavailable ? (
                <Text variant="caption" color={colors.error}>Login history is unavailable.</Text>
              ) : null}
              {loginHistory.length === 0 && !loginHistoryUnavailable ? (
                <Text variant="caption" color={colors.textMuted}>No login history</Text>
              ) : loginHistory.length > 0 ? loginHistory.map((e: any, i: number) => (
                <View key={e.id || i} style={{ paddingVertical: spacing.xs }}>
                  <Text variant="body">
                    {friendlyUA(e.user_agent)}{e.success === false ? '  ·  failed' : ''}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {[e.ip_address, e.created_at ? new Date(e.created_at).toLocaleString() : ''].filter(Boolean).join('  ·  ')}
                  </Text>
                </View>
              )) : null}
            </SectionBlock>
          </Section>
        );

      case 'privacy':
        return (
          <Section>
            <SettingRow first icon="globe-outline" label="Public profile" right={<Toggle label="Public profile" value={privacy.profilePublic} onValueChange={v => togglePrivacy('profilePublic', v)} />} />
            <SettingRow icon="mail-unread-outline" label="Show email on profile" right={<Toggle label="Show email on profile" value={privacy.showEmail} onValueChange={v => togglePrivacy('showEmail', v)} />} />
            <SettingRow icon="ban-outline" label="Blocked accounts" sublabel="Manage who you've blocked" onPress={() => router.push('/blocked' as any)} />
            <SettingRow icon="volume-mute-outline" label="Muted accounts" sublabel="Manage who you've muted" onPress={() => router.push('/muted' as any)} />
          </Section>
        );

      case 'notifications':
        return (
          <Section>
            <SettingRow first icon="notifications-outline" label="In-app notifications" sublabel="Show notifications inside the app" right={<Toggle label="In-app notifications" value={notifPrefs.inApp} onValueChange={v => toggleNotif('inApp', v)} />} />
            <SettingRow icon="phone-portrait-outline" label="Push notifications" sublabel="Send alerts to your devices" right={<Toggle label="Push notifications" value={notifPrefs.push} onValueChange={v => toggleNotif('push', v)} />} />
            <SettingRow icon="mail-outline" label="Email notifications" sublabel="Send notifications to your email" right={<Toggle label="Email notifications" value={notifPrefs.email} onValueChange={v => toggleNotif('email', v)} />} />
          </Section>
        );

      case 'appearance':
        return (
          <Section>
            <SectionBlock first>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
                <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="contrast-outline" size={17} color={colors.accent} />
                </View>
                <Text variant="body" style={{ flex: 1 }}>Theme</Text>
              </View>
              <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={{ flexDirection: 'row', backgroundColor: colors.glass, borderRadius: radius.md, padding: 2, borderWidth: 0.5, borderColor: colors.borderSubtle }}>
                {(['system', 'light', 'dark'] as const).map(opt => {
                  const isOn = themeMode === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => applyTheme(opt)}
                      accessibilityRole="radio"
                      accessibilityLabel={`${opt[0].toUpperCase()}${opt.slice(1)} theme`}
                      accessibilityState={{ checked: isOn }}
                      {...(Platform.OS === 'web' ? { 'aria-checked': isOn } as any : {})}
                      style={({ pressed }) => ({
                        flex: 1,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.sm,
                        backgroundColor: isOn ? colors.surfaceRaised : 'transparent',
                        alignItems: 'center',
                        opacity: pressed ? 0.8 : 1,
                        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                      })}
                    >
                      <Text variant="bodyMedium" color={isOn ? colors.text : colors.textMuted} style={{ textTransform: 'capitalize' }}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SectionBlock>
            <SettingRow icon="language-outline" label="Language" value="English" />
          </Section>
        );

      case 'feed':
        return (
          <>
            <Section title="Default feed" footer="Which feed opens when you launch the app. You can always switch tabs once you're in.">
              <SectionBlock first>
                <View accessibilityRole="radiogroup" accessibilityLabel="Default feed" style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {[
                    { key: 'foryou' as const, label: 'For You' },
                    { key: 'following' as const, label: 'Following' },
                  ].map(opt => {
                    const isOn = (getPreference('defaultFeed') as string) === opt.key;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => { setContentPref('defaultFeed', opt.key, 'default_feed'); }}
                        accessibilityRole="radio"
                        accessibilityLabel={opt.label}
                        accessibilityState={{ checked: isOn }}
                        {...(Platform.OS === 'web' ? { 'aria-checked': isOn } as any : {})}
                        style={({ pressed }) => ({
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.lg,
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: isOn ? colors.accent : colors.borderSubtle,
                          backgroundColor: isOn ? colors.accentMuted : 'transparent',
                          opacity: pressed ? 0.7 : 1,
                          ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                        })}
                      >
                        <Text variant="bodyMedium" color={isOn ? colors.accent : colors.text}>{opt.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </SectionBlock>
            </Section>
            <Section title="Content">
              <SettingRow
                first
                icon="eye-off-outline"
                label="Show NSFW content"
                right={<Toggle label="Show NSFW content" value={getPreference('showNsfw')} onValueChange={v => { setContentPref('showNsfw', v, 'show_nsfw'); }} />}
              />
              <SettingRow
                icon="play-circle-outline"
                label="Autoplay videos"
                right={<Toggle label="Autoplay videos" value={getPreference('autoplayVideo')} onValueChange={v => { setContentPref('autoplayVideo', v, 'autoplay_video'); }} />}
              />
            </Section>
          </>
        );

      case 'ai':
        return (
          <Section>
            <SettingRow
              first
              icon="sparkles-outline"
              label="Set up your personal AI agent"
              sublabel="Name, model, system prompt, secure context, and curation preferences. Change anything anytime."
              onPress={() => router.push('/agent' as any)}
            />
            <SettingRow
              icon="hardware-chip-outline"
              label="Personal AI agent"
              sublabel="Shows your personal agent as a DM in your inbox. Off: no agent in your inbox. For You and the rest of the app work the same either way."
              right={<Toggle label="Personal AI agent" value={getPreference('aiEnabled')} onValueChange={v => { setContentPref('aiEnabled', v, 'ai_enabled'); }} />}
            />
          </Section>
        );

      case 'data':
        return (
          <Section>
            <SettingRow
              first
              icon="archive-outline"
              label="Download your account data"
              sublabel="A portable ZIP with your profile, posts, messages, social graph, preferences, activity, and available media."
              right={(
                <Button
                  onPress={exportData}
                  variant="secondary"
                  size="sm"
                  loading={saving === 'export'}
                  disabled={!sdk}
                >
                  Export ZIP
                </Button>
              )}
            />
            <SettingRow
              icon="refresh-outline"
              label="Clear local cache"
              sublabel="Remove locally cached web data. Your account and posts are not affected."
              right={(
                <Button
                  onPress={() => {
                    if (Platform.OS === 'web' && typeof window !== 'undefined') {
                      window.localStorage.removeItem('minds:cache');
                      showMsg('Cache cleared. Reload to see effect.');
                    }
                  }}
                  variant="secondary"
                  size="sm"
                  disabled={Platform.OS !== 'web'}
                >
                  Clear cache
                </Button>
              )}
            />
          </Section>
        );

      case 'help':
        return (
          <Section>
            <SettingRow
              first
              icon="help-buoy-outline"
              label="Message support"
              sublabel="Get help from our support assistant, any time"
              onPress={async () => {
                if (!sdk) return;
                showMsg('Opening support…');
                const id = await openSupportConversation(sdk);
                if (id) router.push(chatConversationHref(id) as any);
                else showMsg('Support is unavailable right now', true);
              }}
            />
            <SettingRow icon="bulb-outline" label="Feedback & feature requests" sublabel="Suggest ideas, report problems, and upvote what matters" onPress={() => router.push('/feedback' as any)} />
          </Section>
        );

      case 'about':
        return (
          <>
            <Section>
              <SettingRow first icon="document-text-outline" label="Terms of Service" onPress={() => Linking.openURL('https://minds.com/p/terms')} />
              {/* Two privacy entries, deliberately, until a human retires one.
                  The legacy link is the OPERATIVE policy and stays: it is what
                  users have been served and swapping it for an unreviewed
                  document is not a change to make silently.
                  The second is this app's own policy (app/privacy.tsx),
                  written from the code — it is the only one that mentions the
                  analytics THIS app runs, and P12(4) requires a policy that
                  covers them. The legacy page returns 200 while serving the
                  legacy network and never naming PostHog, so it satisfies a
                  status-code check and not the requirement. */}
              <SettingRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => Linking.openURL('https://minds.com/p/privacy')} />
              <SettingRow icon="shield-checkmark-outline" label="How this app uses your data" sublabel="What this app collects, and what leaves it" onPress={() => router.push('/privacy' as any)} />
              <SettingRow icon="people-circle-outline" label="Community Guidelines" onPress={() => Linking.openURL('https://minds.com/p/community-guidelines')} />
              <SettingRow
                icon="shield-outline"
                label="Moderation decisions & appeals"
                sublabel="See our principles, public action log, and decisions affecting you"
                onPress={() => router.push('/moderation' as any)}
              />
            </Section>
            {versionFooter}
          </>
        );

      default:
        return null;
    }
  };

  const activeCat = CATS.find(c => c.key === active) || CATS[0];

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Settings" />

      {isWide ? (
        // Desktop: persistent category rail + content pane, centered.
        <View style={{ flex: 1, width: '100%', maxWidth: 1040, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing['3xl'] }}>
          <View style={{ width: 248, paddingTop: spacing.xl }}>
            {profileCard}
            <View style={{ height: spacing.lg }} />
            {navList}
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.xl, paddingBottom: spacing['5xl'] }}>
            <View style={{ width: '100%', maxWidth: 600, gap: spacing.xl }}>
              <Text variant="h2">{activeCat.label}</Text>
              {statusBanner}
              {settingsErrorBanner}
              {renderPanel()}
            </View>
          </ScrollView>
        </View>
      ) : (
        // Mobile: category list → drill into a detail pane.
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['5xl'], gap: spacing.lg }}>
          {statusBanner}
          {settingsErrorBanner}
          {!showDetail ? (
            <>
              {profileCard}
              {navList}
              {versionFooter}
            </>
          ) : (
            <View style={{ gap: spacing.lg }}>
              <Pressable
                onPress={() => setShowDetail(false)}
                accessibilityRole="button"
                accessibilityLabel="Back to settings categories"
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? 0.6 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}
              >
                <Ionicons name="chevron-back" size={20} color={colors.accent} />
                <Text variant="body" color={colors.accent}>Settings</Text>
              </Pressable>
              <Text variant="h2">{activeCat.label}</Text>
              {renderPanel()}
            </View>
          )}
        </ScrollView>
      )}
    </Container>
  );
}
