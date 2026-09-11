import * as React from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Skeleton, Text } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { showToast } from '../components/Toast';
import { spacing, radius } from '../constants/theme';
import { useAuth } from '../lib/auth';
import { createPublicSdk, NETWORK_ID } from '../lib/recursiv';
import { useColors } from '../lib/theme';
import { usePageTitle } from '../lib/usePageTitle';

type Principle = { id: string; title: string; summary: string };
type AppealState = {
  id: string;
  status: 'pending' | 'upheld' | 'overturned';
  statement?: string | null;
  outcome?: string | null;
  resolved_at?: string | null;
};
type OwnAction = {
  id: string;
  target_type: string;
  target_id: string;
  action: string;
  label?: string | null;
  reason?: string | null;
  created_at: string;
  expires_at?: string | null;
  reversed_at?: string | null;
  appeal?: AppealState | null;
  can_appeal: boolean;
};
type PublicAction = {
  id: string;
  target_type: string;
  action: string;
  policy?: string | null;
  actor_type: string;
  created_at: string;
  reversed_at?: string | null;
  appeal_status: 'none' | 'pending' | 'upheld' | 'overturned';
};

const ACTION_LABELS: Record<string, string> = {
  down_rank: 'Distribution limited',
  label: 'Content labeled',
  remove: 'Content removed',
  suspend: 'Account suspended',
  ban: 'Account banned',
};

const TARGET_LABELS: Record<string, string> = {
  post: 'post',
  user: 'account',
  message: 'message',
  community: 'community',
  agent: 'agent',
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ');
}

function shortDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function StatusPill({ status }: { status: string }) {
  const colors = useColors();
  const normalized = status === 'none' ? 'No appeal' : status.replace(/_/g, ' ');
  const color = status === 'overturned'
    ? colors.success
    : status === 'pending'
      ? colors.accent
      : colors.textMuted;
  return (
    <View style={{
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
      backgroundColor: `${color}1A`,
    }}>
      <Text variant="caption" color={color} style={{ textTransform: 'capitalize' }}>{normalized}</Text>
    </View>
  );
}

export default function ModerationScreen() {
  const colors = useColors();
  usePageTitle('Moderation & appeals — Isle of Wight');
  const { sdk, user, accountRestriction, signOut } = useAuth();
  const publicSdk = React.useMemo(() => createPublicSdk(), []);
  const [principles, setPrinciples] = React.useState<Principle[]>([]);
  const [publicActions, setPublicActions] = React.useState<PublicAction[]>([]);
  const [ownActions, setOwnActions] = React.useState<OwnAction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [expandedId, setExpandedId] = React.useState('');
  const [statements, setStatements] = React.useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const publicCall = publicSdk.moderation.publicLog(NETWORK_ID, { limit: 50 });
    const mineCall = sdk
      ? sdk.moderation.mine()
      : Promise.resolve(null);
    const [publicResult, mineResult] = await Promise.allSettled([publicCall, mineCall]);

    if (publicResult.status === 'fulfilled') {
      const data = publicResult.value?.data || publicResult.value;
      setPrinciples(data?.principles || []);
      setPublicActions(data?.actions || []);
    } else {
      setLoadError('The public moderation log is unavailable right now.');
    }

    if (mineResult.status === 'fulfilled' && mineResult.value) {
      const data = (mineResult.value as any)?.data || mineResult.value;
      setOwnActions(data?.actions || []);
      if (data?.principles) {
        setPrinciples((current) => current.length > 0 ? current : data.principles);
      }
    }
    setLoading(false);
  }, [publicSdk, sdk]);

  React.useEffect(() => { void load(); }, [load]);

  const submitAppeal = async (action: OwnAction) => {
    const statement = (statements[action.id] || '').trim();
    if (statement.length < 10) {
      showToast('Add a little more context before submitting.', 'error');
      return;
    }
    if (!sdk) {
      showToast('Sign in to appeal a decision.', 'error');
      return;
    }
    setSubmittingId(action.id);
    try {
      const response = await sdk.moderation.appeal(action.id, statement);
      const appealId = response.data.id;
      setOwnActions((current) => current.map((item) => item.id === action.id ? {
        ...item,
        can_appeal: false,
        appeal: { id: appealId, status: 'pending', statement },
      } : item));
      setExpandedId('');
      showToast('Appeal submitted for review.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Could not submit the appeal.', 'error');
    } finally {
      setSubmittingId('');
    }
  };

  return (
    <Container safeTop padded={false} noAvoidKeyboard>
      <ScreenHeader title="Moderation & appeals" showBack={!accountRestriction} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
          padding: spacing.xl,
          paddingBottom: spacing['4xl'],
          gap: spacing.xl,
        }}
      >
        {accountRestriction && (
          <Card>
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="alert-circle-outline" size={22} color={colors.error} />
                <Text variant="h3">Your account is {accountRestriction}</Text>
              </View>
              <Text variant="body" color={colors.textSecondary}>
                The rest of Minds is unavailable, but you can still review the decision and submit an appeal here.
              </Text>
              <View style={{ alignItems: 'flex-start' }}>
                <Button variant="ghost" size="sm" onPress={signOut}>Sign out</Button>
              </View>
            </View>
          </Card>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text variant="h2">How moderation works</Text>
          <Text variant="body" color={colors.textSecondary}>
            Minds publishes a privacy-safe record of enforcement decisions. We show what happened and whether it was appealed without exposing the person, moderator, reporter, or private case details.
          </Text>
        </View>

        {loading && principles.length === 0 ? <Skeleton height={180} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {principles.map((principle) => (
              <View
                key={principle.id}
                style={{
                  flexGrow: 1,
                  flexBasis: 300,
                  minWidth: 0,
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  gap: spacing.xs,
                }}
              >
                <Text variant="bodyMedium">{principle.title}</Text>
                <Text variant="caption" color={colors.textSecondary}>{principle.summary}</Text>
              </View>
            ))}
          </View>
        )}

        {user && (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: spacing.xs }}>
              <Text variant="h2">Your decisions</Text>
              <Text variant="body" color={colors.textSecondary}>
                Actions affecting your account or content appear here with the reason and appeal status.
              </Text>
            </View>

            {loading ? <Skeleton height={150} /> : ownActions.length === 0 ? (
              <Card>
                <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
                  <Ionicons name="shield-checkmark-outline" size={30} color={colors.accent} />
                  <Text variant="bodyMedium">No moderation decisions affect you.</Text>
                </View>
              </Card>
            ) : ownActions.map((action) => (
              <Card key={action.id}>
                <View style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text variant="bodyMedium">{actionLabel(action.action)}</Text>
                      <Text variant="caption" color={colors.textMuted}>
                        Your {TARGET_LABELS[action.target_type] || action.target_type} · {shortDate(action.created_at)}
                      </Text>
                    </View>
                    <StatusPill status={action.appeal?.status || (action.reversed_at ? 'overturned' : 'none')} />
                  </View>

                  <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, gap: 4 }}>
                    <Text variant="label" color={colors.textMuted}>WHY</Text>
                    <Text variant="body" color={colors.textSecondary}>
                      {action.reason || action.label || 'A violation of the community guidelines was identified.'}
                    </Text>
                  </View>

                  {action.appeal && (
                    <View style={{ gap: 4 }}>
                      <Text variant="label" color={colors.textMuted}>YOUR APPEAL</Text>
                      <Text variant="body" color={colors.textSecondary}>{action.appeal.statement}</Text>
                      {action.appeal.status === 'pending' && (
                        <Text variant="caption" color={colors.accent}>Waiting for moderator review</Text>
                      )}
                    </View>
                  )}

                  {action.can_appeal && expandedId !== action.id && (
                    <View style={{ alignItems: 'flex-start' }}>
                      <Button variant="secondary" size="sm" onPress={() => setExpandedId(action.id)}>
                        Appeal this decision
                      </Button>
                    </View>
                  )}

                  {action.can_appeal && expandedId === action.id && (
                    <View style={{ gap: spacing.sm }}>
                      <Text variant="label" color={colors.textMuted}>WHAT SHOULD WE RECONSIDER?</Text>
                      <TextInput
                        value={statements[action.id] || ''}
                        onChangeText={(value) => setStatements((current) => ({ ...current, [action.id]: value }))}
                        placeholder="Share missing context or explain why the decision should change."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={2000}
                        style={{
                          minHeight: 110,
                          textAlignVertical: 'top',
                          color: colors.text,
                          backgroundColor: colors.surfaceRaised,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: radius.md,
                          padding: spacing.md,
                        }}
                      />
                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm }}>
                        <Button variant="ghost" size="sm" onPress={() => setExpandedId('')}>Cancel</Button>
                        <Button
                          size="sm"
                          loading={submittingId === action.id}
                          disabled={(statements[action.id] || '').trim().length < 10}
                          onPress={() => submitAppeal(action)}
                        >
                          Submit appeal
                        </Button>
                      </View>
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.md }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="h2">Public action log</Text>
              <Text variant="body" color={colors.textSecondary}>Recent decisions across the network, newest first.</Text>
            </View>
            <Button variant="ghost" size="sm" onPress={load} loading={loading}>Refresh</Button>
          </View>

          {loadError ? (
            <Card>
              <Text variant="body" color={colors.error}>{loadError}</Text>
            </Card>
          ) : loading && publicActions.length === 0 ? <Skeleton height={220} /> : publicActions.length === 0 ? (
            <Card>
              <Text variant="body" color={colors.textSecondary}>No moderation actions have been recorded yet.</Text>
            </Card>
          ) : publicActions.map((action) => (
            <View
              key={action.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
              }}
            >
              <View style={{
                width: 38,
                height: 38,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.full,
                backgroundColor: colors.surfaceRaised,
              }}>
                <Ionicons name={action.reversed_at ? 'return-up-back-outline' : 'shield-outline'} size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium">{actionLabel(action.action)}</Text>
                <Text variant="caption" color={colors.textMuted}>
                  {TARGET_LABELS[action.target_type] || action.target_type}
                  {action.policy ? ` · ${action.policy}` : ''}
                  {` · ${shortDate(action.created_at)}`}
                </Text>
              </View>
              <StatusPill status={action.appeal_status === 'none' && action.reversed_at ? 'overturned' : action.appeal_status} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Container>
  );
}
