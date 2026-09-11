import * as React from 'react';
import { View, ScrollView, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button } from '../components';
import { Container } from '../components/Container';
import { spacing, radius, CTA } from '../constants/theme';
import { useColors } from '../lib/theme';
import { useAuth } from '../lib/auth';
import { otpSignInPath } from '../lib/authRedirect';
import { openCheckout, type PaidTier } from '../lib/subscription';

type Plan = {
  tier: PaidTier;
  name: string;
  price: string;
  perks: string[];
  highlight?: boolean;
  badge?: string;
};

const TIER_LEVEL = {
  free: 0,
  plus: 1,
  pro: 2,
} as const;

const PLANS: Plan[] = [
  {
    tier: 'plus',
    name: 'Plus',
    price: '$9.99',
    perks: [
      '25 hours of video',
      'Unlimited feed refreshes',
      'More daily AI messages',
      'A verified badge',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$69.99',
    highlight: true,
    badge: 'Best value',
    perks: [
      'Everything in Plus',
      'Build apps and agents with Minds AI',
      'Any model: GPT, Claude, Gemini',
      '190 hours of video, in 1080p',
    ],
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { sdk, user } = useAuth();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ sub?: string; tier?: string }>();
  const isWide = width > 720;

  const currentTier: 'free' | 'plus' | 'pro' =
    (user?.pro || (user as any)?.is_pro) ? 'pro' : (user?.plus || (user as any)?.is_plus) ? 'plus' : 'free';
  const currentLabel = currentTier === 'pro' ? 'Pro' : currentTier === 'plus' ? 'Plus' : 'Free';

  // Is anything on this page still buyable for this viewer? A Pro member has
  // every plan either current or included, so the page becomes a receipt.
  const hasPurchasablePlan = PLANS.some((p) => TIER_LEVEL[p.tier] > TIER_LEVEL[currentTier]);

  const [loadingTier, setLoadingTier] = React.useState<PaidTier | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const justSubscribed = params.sub === 'success';

  const onUpgrade = async (tier: PaidTier) => {
    if (!user || !sdk) {
      router.push(otpSignInPath(`/upgrade?tier=${tier}`) as any);
      return;
    }

    setError(null);
    setLoadingTier(tier);
    try {
      await openCheckout(sdk, tier);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoadingTier(null);
    }
  };

  const renderPlan = (plan: Plan) => {
    const isCurrent = plan.tier === currentTier;
    const isIncluded = TIER_LEVEL[plan.tier] < TIER_LEVEL[currentTier];
    const buttonLabel = isCurrent
      ? 'View billing'
      : isIncluded
        ? `Included with ${currentLabel}`
        : `Get ${plan.name}`;
    return (
      <View
        key={plan.tier}
        style={{
          flex: isWide ? 1 : undefined,
          width: isWide ? undefined : '100%',
          borderWidth: plan.highlight ? 1.5 : 1,
          borderColor: plan.highlight ? colors.accent : colors.border,
          borderRadius: radius.lg,
          padding: isWide ? spacing.xl : spacing.lg,
          backgroundColor: colors.surface,
          gap: spacing.sm,
          ...(plan.highlight && Platform.OS === 'web' ? ({ boxShadow: `0 6px 24px ${colors.accentSubtle}` } as any) : {}),
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="h2">{plan.name}</Text>
          {plan.badge && !isCurrent && (
            <View style={{ backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full }}>
              <Text variant="caption" color={CTA.ink} style={{ fontFamily: 'Roboto-Medium', fontSize: 11 }}>{plan.badge}</Text>
            </View>
          )}
          {isCurrent && (
            <View style={{ marginLeft: 'auto', backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full }}>
              <Text variant="caption" color={colors.accent} style={{ fontFamily: 'Roboto-Medium' }}>Current</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant="hero" style={{ fontSize: 34, lineHeight: 38 }}>{plan.price}</Text>
          <Text variant="body" color={colors.textMuted}>/ month</Text>
        </View>
        <View style={{ gap: spacing.sm, marginTop: spacing.xs, marginBottom: spacing.sm }}>
          {plan.perks.map((perk) => (
            <View key={perk} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accent} style={{ marginTop: 1 }} />
              <Text variant="body" style={{ flex: 1, lineHeight: 22 }}>{perk}</Text>
            </View>
          ))}
        </View>

        <Button
          onPress={() => isCurrent ? router.push('/billing' as any) : onUpgrade(plan.tier)}
          loading={loadingTier === plan.tier}
          disabled={loadingTier !== null || isIncluded}
          variant={isCurrent ? 'secondary' : plan.highlight ? 'primary' : 'secondary'}
          fullWidth
        >
          {buttonLabel}
        </Button>
      </View>
    );
  };

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Minds Premium</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: isWide ? spacing.xl : spacing.lg,
          paddingBottom: spacing['4xl'],
          gap: isWide ? spacing.xl : spacing.lg,
          maxWidth: 860,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {/* Hero — the pitch. */}
        <View style={{ gap: spacing.xs, marginTop: spacing.sm, alignItems: isWide ? 'center' : 'flex-start' }}>
          <Text variant="hero" align={isWide ? 'center' : 'left'} style={{ fontSize: isWide ? 34 : 28, lineHeight: isWide ? 40 : 34 }}>
            Own your feed.
          </Text>
          <Text variant="body" color={colors.textSecondary} align={isWide ? 'center' : 'left'} style={{ fontSize: 16, lineHeight: 24, maxWidth: 460 }}>
            Minds runs on subscriptions, not ads. Upgrade to unlock everything.
          </Text>
          {currentTier !== 'free' && (
            <Text variant="caption" color={colors.textMuted}>You're on {currentLabel}.</Text>
          )}
        </View>

        {justSubscribed && (
          <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text variant="body" color={colors.success} style={{ flex: 1 }}>You're all set. Welcome to {params.tier === 'pro' ? 'Pro' : 'Plus'}.</Text>
          </View>
        )}
        {error && (
          <Pressable onPress={() => setError(null)} style={{ backgroundColor: colors.errorMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text variant="body" color={colors.error} style={{ flex: 1 }}>{error}</Text>
          </Pressable>
        )}

        {/* Plans, side by side on wide screens. */}
        {/* On a phone the recommended plan leads, so the strongest offer is on
            screen without scrolling. Side by side, price order reads better. */}
        <View style={{ flexDirection: isWide ? 'row' : 'column', gap: spacing.md, alignItems: 'stretch' }}>
          {(isWide ? PLANS : [...PLANS].sort((a, b) => Number(!!b.highlight) - Number(!!a.highlight))).map(renderPlan)}
        </View>

        {/* One line of reassurance, then get out of the way. The essay that used
            to sit here said what the hero already says.

            Only shown when there is something to buy: telling someone already on
            the top tier that they can cancel any time is answering a question
            they did not ask, on a page that has nothing left to sell them. */}
        {hasPurchasablePlan && (
          <Text variant="caption" color={colors.textMuted} align="center" style={{ lineHeight: 20 }}>
            Cancel anytime. Payments handled by Stripe.
          </Text>
        )}
      </ScrollView>
    </Container>
  );
}
