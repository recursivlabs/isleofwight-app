import * as React from 'react';
import { View, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { showToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { captureException } from '../lib/monitoring';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

// ──────────────────────────────────────────────────────────────────────────
// Boost — legacy-simple flow: pick your post → set a budget → confirm. The
// engine underneath is ADX-style (CPM campaigns, prepaid balance, exact
// refunds, review gate) but the UX stays as simple as the legacy Boost that
// does ~1,478 paid boosts/month. With ?post=<id> this is the composer for
// that post; without, it's your Boost dashboard (balance + campaigns).
// Endpoints (server: feat/boost-v1): POST /boosts, GET /boosts/mine,
// GET /boosts/balance, POST /boosts/:id/pause|cancel.
// ──────────────────────────────────────────────────────────────────────────

const fmtUsd = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

// Budget presets (micro-USD). Reach estimate derives from the CPM floor the
// server enforces — shown as an estimate, never a promise.
const BUDGETS = [1_000_000, 5_000_000, 10_000_000, 25_000_000];
const DEFAULT_CPM_MICROS = 1_000_000; // $1.00 CPM default bid; server enforces the floor

function StatusPill({ status, review }: { status: string; review: string }) {
  const colors = useColors();
  const label = review === 'pending' ? 'In review'
    : review === 'rejected' ? 'Not approved'
    : status === 'active' ? 'Running'
    : status === 'paused' ? 'Paused'
    : status === 'completed' ? 'Completed'
    : status === 'refunded' ? 'Refunded'
    : status;
  const tone = review === 'rejected' ? colors.error
    : review === 'pending' ? colors.textMuted
    : status === 'active' ? colors.success
    : colors.textSecondary;
  return (
    <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: tone }}>
      <Text variant="caption" style={{ fontSize: 11, color: tone }}>{label}</Text>
    </View>
  );
}

export default function BoostScreen() {
  const router = useRouter();
  const colors = useColors();
  const { sdk } = useAuth();
  const params = useLocalSearchParams<{ post?: string }>();
  const postId = typeof params.post === 'string' ? params.post : '';

  const [balance, setBalance] = React.useState<number | null>(null);
  const [campaigns, setCampaigns] = React.useState<any[]>([]);
  const [balanceError, setBalanceError] = React.useState(false);
  const [campaignsError, setCampaignsError] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [budget, setBudget] = React.useState(BUDGETS[1]);
  const [submitting, setSubmitting] = React.useState(false);

  // The HttpClient lives on every resource as `client` (the same escape hatch
  // useSimilarPosts uses); boost routes are new REST endpoints not yet in the
  // typed SDK. Degrades gracefully if the deployed server predates them.
  const api = React.useCallback(async (path: string, init?: { method?: 'POST'; body?: any }) => {
    const http = (sdk?.posts as any)?.client;
    if (!http?.get) throw new Error('no session');
    return init?.method === 'POST' ? http.post(path, init.body ?? {}) : http.get(path);
  }, [sdk]);

  const load = React.useCallback(async (reset = false) => {
    // No HTTP client is an unavailable statement, not an empty dashboard.
    // While sdk is still null we are only waiting on auth, so stay unsettled.
    const http = (sdk?.posts as any)?.client;
    if (!http?.get) {
      if (sdk) {
        setBalanceError(true);
        setCampaignsError(true);
        setLoading(false);
      }
      return;
    }
    if (reset) {
      setBalanceError(false);
      setCampaignsError(false);
    }
    try {
      const [balResult, mineResult] = await Promise.allSettled([
        api('/boosts/balance'),
        api('/boosts/mine'),
      ]);

      const bal = balResult.status === 'fulfilled' ? balResult.value : null;
      const micros = bal?.data?.balance_micros ?? bal?.balance_micros;
      if (micros != null) {
        setBalance(Number(micros));
        setBalanceError(false);
      } else {
        setBalanceError(true);
        captureException(
          balResult.status === 'rejected' ? balResult.reason : new Error('Boost balance response had no balance_micros'),
          { screen: 'boost', step: 'load-balance' },
        );
      }

      const mine = mineResult.status === 'fulfilled' ? mineResult.value : null;
      const rows = Array.isArray(mine?.data) ? mine.data : Array.isArray(mine) ? mine : null;
      if (rows) {
        setCampaigns(rows);
        setCampaignsError(false);
      } else {
        setCampaignsError(true);
        captureException(
          mineResult.status === 'rejected' ? mineResult.reason : new Error('Boost campaigns response was not a list'),
          { screen: 'boost', step: 'load-campaigns' },
        );
      }
    } finally {
      setLoading(false);
    }
  }, [api, sdk]);
  React.useEffect(() => { load(); }, [load]);

  const loadError = balanceError || campaignsError;
  const loadErrorLabel = balanceError && campaignsError
    ? "Couldn't load your Boost balance or boosts · Tap to retry"
    : balanceError
      ? "Couldn't load your Boost balance · Tap to retry"
      : "Couldn't load your boosts · Tap to retry";

  const submit = React.useCallback(async () => {
    if (!postId || submitting) return;
    setSubmitting(true);
    try {
      await api('/boosts', { method: 'POST', body: { post_id: postId, cpm_micros: DEFAULT_CPM_MICROS, budget_micros: budget } });
      showToast('Boost submitted for review');
      router.replace('/boost' as any);
      load();
    } catch (e: any) {
      const msg = String(e?.message || '');
      showToast(msg.includes('balance') ? 'Not enough Boost balance' : 'Could not create the boost');
    } finally {
      setSubmitting(false);
    }
  }, [api, postId, budget, submitting, router, load]);

  const cancel = React.useCallback(async (id: string) => {
    try {
      await api(`/boosts/${id}/cancel`, { method: 'POST' });
      showToast('Boost cancelled — unspent budget refunded');
      load();
    } catch {
      showToast('Could not cancel');
    }
  }, [api, load]);

  const estReach = Math.round((budget / DEFAULT_CPM_MICROS) * 1000);

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Boost" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: 60 }}>

        {loadError ? (
          <Pressable
            onPress={() => { void load(true); }}
            accessibilityRole="button"
            accessibilityLabel="Retry Boost balance and boosts"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
              paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
              backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="cloud-offline-outline" size={13} color={colors.error} />
            <Text variant="caption" color={colors.error}>{loadErrorLabel}</Text>
          </Pressable>
        ) : null}

        {postId ? (
          <>
            {/* ── Composer: budget + confirm (legacy-simple) ── */}
            <View style={{ gap: spacing.sm }}>
              <Text variant="h3">Boost this post</Text>
              <Text variant="body" color={colors.textSecondary}>
                Your post gets promoted slots in the For You feed, always labeled Boosted. Unspent budget is refunded exactly.
              </Text>
            </View>

            <View style={{ gap: spacing.md }}>
              <Text variant="label" style={{ fontSize: 14 }}>Budget</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {BUDGETS.map((b) => {
                  const active = budget === b;
                  return (
                    <Pressable
                      key={b}
                      onPress={() => setBudget(b)}
                      style={{
                        paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md,
                        backgroundColor: active ? colors.accentMuted : colors.surface,
                        borderWidth: 1, borderColor: active ? colors.accent : colors.border,
                        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                      }}
                    >
                      <Text variant="bodyMedium" color={active ? colors.accent : colors.text}>{fmtUsd(b)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="caption" color={colors.textMuted}>
                Estimated reach: ~{estReach.toLocaleString()} views · balance {balanceError ? 'unavailable' : balance == null ? '—' : fmtUsd(balance)}
              </Text>
            </View>

            <Button onPress={submit} disabled={submitting} loading={submitting} fullWidth>
              {submitting ? 'Submitting…' : `Boost for ${fmtUsd(budget)}`}
            </Button>
            <Text variant="caption" color={colors.textMuted}>
              Boosts run after a quick review. Cancel any time — the unspent budget goes straight back to your balance.
            </Text>
          </>
        ) : (
          <>
            {/* ── Dashboard: balance + campaigns ── */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text variant="caption" color={colors.textMuted}>Boost balance</Text>
                <Text variant="h2">{balance == null ? '—' : fmtUsd(balance)}</Text>
              </View>
              <Ionicons name="rocket" size={30} color={colors.boost} />
            </View>

            {loading ? (
              <ActivityIndicator color={colors.accent} />
            ) : campaigns.length === 0 ? campaignsError ? null : (
              <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing['3xl'] }}>
                <Ionicons name="rocket-outline" size={36} color={colors.textMuted} />
                <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
                  Boost puts your post in front of people beyond your followers. Open one of your posts and choose Boost from its menu.
                </Text>
              </View>
            ) : (
              <View style={{ gap: spacing.md }}>
                <Text variant="label" style={{ fontSize: 14 }}>Your boosts</Text>
                {campaigns.map((c: any) => (
                  <View key={c.id} style={{ gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1, marginRight: spacing.md }}>
                        {(c.post_content || c.post?.content || 'Post').replace(/\n/g, ' ').slice(0, 60) || 'Post'}
                      </Text>
                      <StatusPill status={c.status} review={c.review_status} />
                    </View>
                    <Text variant="caption" color={colors.textMuted}>
                      {(c.impressions_served ?? 0).toLocaleString()} views · spent {fmtUsd(c.spent_micros ?? 0)} of {fmtUsd(c.budget_micros ?? 0)}
                    </Text>
                    {(c.status === 'active' || c.review_status === 'pending') && (
                      <Pressable onPress={() => cancel(c.id)} hitSlop={6} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
                        <Text variant="caption" color={colors.error}>Cancel & refund unspent</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Container>
  );
}
