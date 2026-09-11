import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Share } from 'react-native';
import { showToast } from '../components/Toast';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button, Card, Skeleton } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../lib/auth';
import { spacing } from '../constants/theme';
import { useColors } from '../lib/theme';
import { buildReferralLink } from '../lib/referral';

export default function InvitesScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = React.useState(true);
  const [codes, setCodes] = React.useState<any[]>([]);
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [codesUnavailable, setCodesUnavailable] = React.useState(false);
  const [leaderboardUnavailable, setLeaderboardUnavailable] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);
  const hasLoaded = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!sdk) return;
    if (hasLoaded.current) setRefreshing(true);
    else setLoading(true);

    const [myCodes, lb] = await Promise.allSettled([
      sdk.inviteCodes.myCodes(),
      sdk.inviteCodes.leaderboard(10),
    ]);

    if (myCodes.status === 'fulfilled') {
      setCodes(((myCodes.value as any)?.data?.codes || (myCodes.value as any)?.data) ?? []);
      setCodesUnavailable(false);
    } else {
      setCodesUnavailable(true);
    }

    if (lb.status === 'fulfilled') {
      setLeaderboard((lb.value as any)?.data || []);
      setLeaderboardUnavailable(false);
    } else {
      setLeaderboardUnavailable(true);
    }

    hasLoaded.current = true;
    setLoading(false);
    setRefreshing(false);
  }, [sdk]);

  React.useEffect(() => {
    hasLoaded.current = false;
    void load();
  }, [load]);

  const generate = async () => {
    if (!sdk) return;
    setGenerating(true);
    try {
      await sdk.inviteCodes.generate(1);
      await load();
    } catch {
      showToast('Failed to generate invite code.', 'error');
    }
    setGenerating(false);
  };

  const shareCode = async (code: string) => {
    const link = buildReferralLink(code);
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(link);
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
      } else {
        await Share.share({
          title: 'Join me on Isle of Wight',
          message: `Join me on Minds: ${link}`,
          url: link,
        });
      }
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        showToast(Platform.OS === 'web' ? 'Failed to copy invite link.' : 'Failed to share invite link.', 'error');
      }
    }
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={100} />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Invites" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {(codesUnavailable || leaderboardUnavailable) && (
          <Card>
            <View accessibilityRole="alert" style={{ gap: spacing.md }}>
              <Text variant="bodyMedium">Some invite data could not be loaded.</Text>
              <Text variant="caption" color={colors.textMuted}>Your available invite information is still shown below.</Text>
              <Button onPress={load} loading={refreshing} variant="secondary" size="sm">Retry invite data</Button>
            </View>
          </Card>
        )}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text variant="label" color={colors.textMuted}>Your Invite Codes</Text>
            <Button onPress={generate} loading={generating} variant="secondary" size="sm">Generate Code</Button>
          </View>
          {codesUnavailable && (
            <Text variant="caption" color={colors.textMuted}>Invite codes are unavailable.</Text>
          )}
          {!codesUnavailable && codes.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>No invite codes yet. Generate one to invite friends.</Text>
          ) : codes.map((c: any, i: number) => {
            const code = c.code || c.id || c;
            // The API speaks status: 'active' | 'used' | 'expired' — there is
            // no `used` boolean, so reading one marked every code sharable.
            const status = typeof c.status === 'string' ? c.status : 'active';
            const used = status !== 'active';
            const statusLabel = status === 'used' ? 'Used' : status === 'expired' ? 'Expired' : status;
            return (
              <View key={typeof code === 'string' ? code : JSON.stringify(code)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: colors.borderSubtle }}>
                <View style={{ flex: 1 }}>
                  <Text variant="mono" color={used ? colors.textMuted : colors.text}>{typeof code === 'string' ? code : JSON.stringify(code)}</Text>
                  {used && <Text variant="caption" color={colors.textMuted}>{statusLabel}</Text>}
                </View>
                {!used && (
                  <Pressable
                    onPress={() => shareCode(typeof code === 'string' ? code : '')}
                    accessibilityRole="button"
                    accessibilityLabel={copied === code
                      ? `Invite link for ${code} copied`
                      : `${Platform.OS === 'web' ? 'Copy' : 'Share'} invite link for ${code}`}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={copied === code ? 'checkmark' : Platform.OS === 'web' ? 'copy-outline' : 'share-outline'}
                      size={18}
                      color={copied === code ? colors.success : colors.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>

        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Invite Leaderboard</Text>
          {leaderboardUnavailable && (
            <Text variant="caption" color={colors.textMuted}>Invite leaderboard is unavailable.</Text>
          )}
          {!leaderboardUnavailable && leaderboard.length === 0 ? (
            <Text variant="caption" color={colors.textMuted}>No leaderboard data yet.</Text>
          ) : leaderboard.map((entry: any, i: number) => (
            // Entries speak user_id / user_name / total_invited — the old
            // reads (name, count, invites) matched nothing, so every row
            // showed a bare username with 0 invites.
            <View key={entry.user_id || entry.username || `${entry.user_name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: i > 0 ? 0.5 : 0, borderTopColor: colors.borderSubtle }}>
              <Text variant="bodyMedium" color={i < 3 ? colors.accent : colors.textMuted} style={{ width: 28 }}>#{i + 1}</Text>
              <Text variant="body" style={{ flex: 1 }}>{entry.user_name || entry.username || 'User'}</Text>
              <Text variant="bodyMedium" color={colors.accent}>{entry.total_invited ?? 0}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </Container>
  );
}
