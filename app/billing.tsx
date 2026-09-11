import * as React from 'react';
import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import type { AppSubscriptionStatusResult } from '@recursiv/sdk';
import { Button, Card, Skeleton, Text } from '../components';
import { LinkPressable } from '../components/LinkPressable';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { showToast } from '../components/Toast';
import { spacing } from '../constants/theme';
import { useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import { isLegacyMembership, periodLabel, portalErrorMessage, statusLabel } from '../lib/billingLabels';

type AccountTier = 'free' | 'plus' | 'pro';

function paidTier(value: string | undefined): value is Exclude<AccountTier, 'free'> {
  return value === 'plus' || value === 'pro';
}

export function displayedSubscriptionTier(
  status: AppSubscriptionStatusResult | null,
  user: { plus?: boolean; pro?: boolean; is_plus?: boolean; is_pro?: boolean } | null,
): AccountTier {
  if (status?.active && paidTier(status.tier)) return status.tier;
  if (user?.pro || user?.is_pro) return 'pro';
  if (user?.plus || user?.is_plus) return 'plus';
  return 'free';
}

function planLabel(tier: AccountTier): string {
  if (tier === 'pro') return 'Pro';
  if (tier === 'plus') return 'Plus';
  return 'Free';
}


export default function BillingScreen() {
  const { sdk, user } = useAuth();
  const colors = useColors();
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<AppSubscriptionStatusResult | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [portalLoading, setPortalLoading] = React.useState(false);
  const [portalError, setPortalError] = React.useState<string | null>(null);

  const loadStatus = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await sdk.appSubscriptions.status();
      setStatus(result.data);
    } catch {
      setStatus(null);
      setLoadError('We could not verify your subscription. Your account and plan are unchanged.');
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const openPortal = async () => {
    if (!sdk || portalLoading) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const returnUrl = Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.href
        : 'minds://billing';
      const result = await sdk.appSubscriptions.createPortalSession({ return_url: returnUrl });
      const url = result?.data?.url;
      if (!url) throw new Error('missing portal url');
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = url;
      else await Linking.openURL(url);
    } catch (err) {
      const message = portalErrorMessage(err);
      setPortalError(message);
      showToast(message, 'error');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={100} />
          <Skeleton height={80} />
        </View>
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Billing" />
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
          <Text variant="h3" align="center">Couldn’t load your subscription</Text>
          <Text variant="body" color={colors.textMuted} align="center" style={{ maxWidth: 340 }}>
            {loadError}
          </Text>
          <View style={{ width: '100%', maxWidth: 280, gap: spacing.sm }}>
            <Button onPress={loadStatus} fullWidth>Retry</Button>
            <LinkPressable
              href="/upgrade"
              accessibilityLabel="View Plus and Pro plans"
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 999,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
              })}
            >
              <Text variant="bodyMedium" align="center">View plans</Text>
            </LinkPressable>
          </View>
        </View>
      </Container>
    );
  }

  const currentTier = displayedSubscriptionTier(status, user);
  const currentPlan = planLabel(currentTier);
  const nextPlan = currentTier === 'free' ? 'Plus or Pro' : currentTier === 'plus' ? 'Pro' : null;
  // A membership carried over from minds.com has no subscription to manage
  // here; the status line says so instead of a button that can only fail.
  const canManage = Boolean(
    status && !isLegacyMembership(status) && (
      status.status === 'past_due' ||
      status.status === 'canceled' ||
      (status.active && paidTier(status.tier))
    ),
  );
  const period = periodLabel(status);

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Billing" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
      >
        {nextPlan ? (
          <Link href="/upgrade" asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Upgrade to ${nextPlan}`}
              style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
            >
              <Card style={{ borderColor: colors.accent, borderWidth: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Ionicons name="sparkles" size={22} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">Upgrade to {nextPlan}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      Video uploads, more AI, premium connections, and more.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          </Link>
        ) : null}

        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            Current plan
          </Text>
          <Text variant="h2" color={colors.accent}>{currentPlan}</Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            {statusLabel(status, currentTier)}
          </Text>
          {period ? (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              {period}
            </Text>
          ) : null}

          {canManage ? (
            <View style={{ marginTop: spacing.lg }}>
              <Button
                onPress={openPortal}
                loading={portalLoading}
                variant="secondary"
                size="sm"
              >
                Manage subscription
              </Button>
              {portalError ? (
                <Text variant="caption" color={colors.error} style={{ marginTop: spacing.sm }}>
                  {portalError}
                </Text>
              ) : null}
            </View>
          ) : currentTier !== 'free' ? (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.lg }}>
              Your {currentPlan} access is attached to this Minds account.
            </Text>
          ) : null}
        </Card>
      </ScrollView>
    </Container>
  );
}
