import * as React from 'react';
import { Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../constants/theme';
import { useAuth } from '../lib/auth';
import {
  cutoverWelcomeKeys,
  isCutoverWelcomeActive,
  nextCutoverWelcomeBoundary,
} from '../lib/cutoverWelcome';
import { getItem, setItem } from '../lib/storage';
import { useColors } from '../lib/theme';
import { Text } from './Text';

/**
 * One calm welcome for returning Minds members, followed by a dismissible
 * transition banner for at most 30 days. All state is scoped to the account,
 * so switching accounts on a shared device cannot suppress somebody else's
 * notice.
 */
interface CutoverWelcomeProps {
  /** Injectable for deterministic tests; production uses the build-time gate. */
  launchAt?: string;
  now?: number;
}

const MAX_TIMER_DELAY_MS = 2_147_483_647;

export function CutoverWelcome({
  launchAt = process.env.EXPO_PUBLIC_MINDS_2_LAUNCH_AT,
  now: nowOverride,
}: CutoverWelcomeProps = {}) {
  const { user, accountRestriction } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [now, setNow] = React.useState(() => nowOverride ?? Date.now());
  const [ready, setReady] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [bannerVisible, setBannerVisible] = React.useState(false);

  React.useEffect(() => {
    if (nowOverride !== undefined) {
      setNow(nowOverride);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const refreshAndSchedule = () => {
      if (cancelled) return;
      const current = Date.now();
      setNow(current);
      const boundary = nextCutoverWelcomeBoundary(launchAt, current);
      if (boundary !== null) {
        const delay = Math.min(MAX_TIMER_DELAY_MS, Math.max(1, boundary - current + 1));
        timer = setTimeout(refreshAndSchedule, delay);
      }
    };
    refreshAndSchedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [launchAt, nowOverride]);

  React.useEffect(() => {
    let cancelled = false;
    setReady(false);
    setModalVisible(false);
    setBannerVisible(false);

    if (!user?.id || !isCutoverWelcomeActive(user.created_at, launchAt, now)) {
      return () => { cancelled = true; };
    }

    const keys = cutoverWelcomeKeys(user.id);
    (async () => {
      const [modalDismissed, bannerDismissed] = await Promise.all([
        getItem(keys.modalDismissed),
        getItem(keys.bannerDismissed),
      ]);
      if (cancelled) return;
      setModalVisible(modalDismissed !== '1');
      setBannerVisible(bannerDismissed !== '1');
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [launchAt, now, user?.created_at, user?.id]);

  const hideForRoute = !pathname
    || pathname.startsWith('/auth')
    || pathname === '/moderation'
    || pathname === '/reset-password';
  if (!ready || !user?.id || accountRestriction || hideForRoute) return null;

  const keys = cutoverWelcomeKeys(user.id);
  const dismissModal = () => {
    setModalVisible(false);
    void setItem(keys.modalDismissed, '1');
  };
  const dismissBanner = () => {
    setBannerVisible(false);
    void setItem(keys.bannerDismissed, '1');
  };
  const openFeedback = () => {
    dismissModal();
    router.push('/feedback' as any);
  };

  return (
    <>
      {bannerVisible && !modalVisible ? (
        <View
          accessibilityRole="summary"
          style={{
            minHeight: 44,
            paddingLeft: spacing.lg + insets.left,
            paddingRight: spacing.lg + insets.right,
            paddingTop: Platform.OS === 'web' ? spacing.sm : Math.max(spacing.sm, insets.top),
            paddingBottom: spacing.sm,
            backgroundColor: colors.accentMuted,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.md,
          }}
        >
          <Ionicons name="sparkles" size={18} color={colors.accent} />
          <View style={{ flex: 1, maxWidth: 760 }}>
            <Text variant="caption" color={colors.text}>
              <Text variant="bodyMedium" color={colors.text}>Welcome. </Text>
              The move is still in progress. If anything looks missing, tell us.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tell us what is missing"
            onPress={() => router.push('/feedback' as any)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="caption" color={colors.accent}>Send feedback</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss welcome banner"
            hitSlop={12}
            onPress={dismissBanner}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={dismissModal}
        statusBarTranslucent
      >
        <View
          style={{
            flex: 1,
            paddingTop: spacing.xl + insets.top,
            paddingRight: spacing.xl + insets.right,
            paddingBottom: spacing.xl + insets.bottom,
            paddingLeft: spacing.xl + insets.left,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.overlay,
          }}
        >
          <ScrollView
            accessibilityRole="alert"
            accessibilityViewIsModal
            accessibilityLabel="Welcome back"
            bounces={false}
            showsVerticalScrollIndicator={false}
            style={{
              width: '100%',
              maxWidth: Math.min(480, Math.max(1, width - insets.left - insets.right - spacing.xl * 2)),
              maxHeight: Math.max(1, height - insets.top - insets.bottom - spacing.xl * 2),
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceRaised,
              ...(Platform.OS === 'web'
                ? { boxShadow: `0 24px 80px ${colors.shadow}` } as any
                : { elevation: 16 }),
            }}
            contentContainerStyle={{ padding: spacing['2xl'], gap: spacing.lg }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentMuted }}>
                <Ionicons name="sparkles" size={23} color={colors.accent} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close welcome message"
                hitSlop={12}
                onPress={dismissModal}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="h2" color={colors.text}>Welcome back</Text>
              <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                Minds has been rebuilt for privacy and the open web. Your profile and available
                content are coming with you as we finish the move.
              </Text>
              <Text variant="caption" color={colors.textMuted} style={{ lineHeight: 19 }}>
                Some history or settings may take longer to appear. If anything looks missing or unfamiliar,
                tell us and we&apos;ll investigate.
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue"
                onPress={dismissModal}
                style={({ pressed }) => ({
                  minHeight: 44,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="bodyMedium" color={colors.textOnAccent}>Continue</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tell us what is missing"
                onPress={openFeedback}
                style={({ pressed }) => ({ minHeight: 40, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
              >
                <Text variant="bodyMedium" color={colors.accent}>Tell us what&apos;s missing</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
