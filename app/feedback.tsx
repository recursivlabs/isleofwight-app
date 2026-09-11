// Feedback intake: the community's direct line for BUG REPORTS and FEATURE
// IDEAS. Deliberately not a ranked board — two focused forms that capture the
// richest possible signal (structured sections + auto-attached device
// diagnostics) and publish them as clearly labeled Minds posts. The posts
// primitive stays the transport, so no new data model is required and the
// team can consume the stream as-is.
import * as React from 'react';
import { View, ScrollView, Pressable, Platform } from 'react-native';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Input, Button, Container } from '../components';
import { ScreenHeader } from '../components/ScreenHeader';
import { showToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { captureException } from '../lib/monitoring';
import { haptics } from '../lib/haptics';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

type Mode = null | 'bug' | 'idea';

/** App/device diagnostics attached to every bug report — the difference
 * between "it broke" and a report we can act on without a follow-up. */
function buildDiagnostics(): string {
  let updateId = 'embedded';
  try {
    const Updates = require('expo-updates');
    if (Updates?.updateId) updateId = String(Updates.updateId).slice(0, 8);
  } catch {}
  const version = Constants.expoConfig?.version || '?';
  const os = Platform.OS === 'web' ? 'web' : `${Platform.OS} ${Platform.Version ?? ''}`.trim();
  return `v${version} · update ${updateId} · ${os}`;
}

export default function FeedbackScreen() {
  const { sdk } = useAuth();
  const colors = useColors();
  const [mode, setMode] = React.useState<Mode>(null);

  // Bug fields
  const [what, setWhat] = React.useState('');
  const [expected, setExpected] = React.useState('');
  const [where, setWhere] = React.useState('');
  // Idea fields
  const [idea, setIdea] = React.useState('');
  const [problem, setProblem] = React.useState('');

  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const reset = () => {
    setMode(null); setDone(false);
    setWhat(''); setExpected(''); setWhere(''); setIdea(''); setProblem('');
  };

  const submit = async () => {
    if (!sdk || submitting) return;
    const isBug = mode === 'bug';
    const primary = isBug ? what.trim() : idea.trim();
    if (!primary) return;
    setSubmitting(true);
    try {
      // Structured body: scannable for humans, parseable for the triage agent.
      const lines = isBug
        ? [
            '🐞 [bug]',
            '',
            `**What happened:** ${what.trim()}`,
            expected.trim() ? `**Expected:** ${expected.trim()}` : '',
            where.trim() ? `**Where:** ${where.trim()}` : '',
            '',
            `_${buildDiagnostics()}_`,
          ]
        : [
            '💡 [idea]',
            '',
            `**The idea:** ${idea.trim()}`,
            problem.trim() ? `**Problem it solves:** ${problem.trim()}` : '',
          ];
      await sdk.posts.create({
        content: lines.filter(Boolean).join('\n'),
        organization_id: ORG_ID || undefined,
      } as any);
      haptics.success();
      setDone(true);
    } catch (e) {
      captureException(e, { screen: 'feedback', step: 'submit', mode });
      showToast('Could not send your feedback. Try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const choiceCard = (icon: string, title: string, sub: string, m: Mode) => (
    <Pressable
      key={String(m)}
      onPress={() => { haptics.select(); setMode(m); }}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
        padding: spacing.xl, borderRadius: radius.lg,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5, borderColor: colors.borderSubtle,
      })}
    >
      <Ionicons name={icon as any} size={26} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="caption" color={colors.textSecondary}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Feedback" />
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, maxWidth: 640, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        {done ? (
          <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing['3xl'] }}>
            <Ionicons name="checkmark-circle" size={44} color={colors.accent} />
            <Text variant="h3">Got it — thank you</Text>
            <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 22 }}>
              Your feedback is now public on Minds. Thanks for helping us make the app better.
            </Text>
            <Button variant="secondary" onPress={reset}>Send another</Button>
          </View>
        ) : mode === null ? (
          <>
            <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
              Help shape Minds. Found something broken, or have an idea that would make this better? Share it with the community and the people building it.
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <Ionicons name="globe-outline" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
              <Text variant="caption" color={colors.textMuted} style={{ flex: 1, lineHeight: 18 }}>
                Feedback is posted publicly to Minds and may be visible to everyone. Do not include private information.
              </Text>
            </View>
            {choiceCard('bug-outline', 'Report a bug', 'Something broke or behaved wrong', 'bug')}
            {choiceCard('bulb-outline', 'Propose a feature', 'An idea that would make Minds better', 'idea')}
          </>
        ) : mode === 'bug' ? (
          <>
            <Pressable
              onPress={() => setMode(null)}
              accessibilityRole="button"
              accessibilityLabel="Back to feedback choices"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>Back</Text>
            </Pressable>
            <Text variant="h3">Report a bug</Text>
            <Input
              label="What happened?"
              placeholder="Describe exactly what went wrong…"
              value={what}
              onChangeText={setWhat}
              multiline
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
            <Input
              label="What did you expect instead?"
              placeholder="Optional, but helps a lot"
              value={expected}
              onChangeText={setExpected}
              multiline
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
            <Input
              label="Where in the app?"
              placeholder="e.g. Following feed, chat with agent, profile"
              value={where}
              onChangeText={setWhere}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="hardware-chip-outline" size={14} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>
                Attached automatically: {buildDiagnostics()}
              </Text>
            </View>
            <Button onPress={submit} disabled={submitting || !what.trim()} loading={submitting}>Send bug report</Button>
          </>
        ) : (
          <>
            <Pressable
              onPress={() => setMode(null)}
              accessibilityRole="button"
              accessibilityLabel="Back to feedback choices"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>Back</Text>
            </Pressable>
            <Text variant="h3">Propose a feature</Text>
            <Input
              label="What's the idea?"
              placeholder="Describe the feature…"
              value={idea}
              onChangeText={setIdea}
              multiline
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
            <Input
              label="What problem does it solve for you?"
              placeholder="The 'why' is the most valuable part"
              value={problem}
              onChangeText={setProblem}
              multiline
              style={{ minHeight: 60, textAlignVertical: 'top' }}
            />
            <Button onPress={submit} disabled={submitting || !idea.trim()} loading={submitting}>Send idea</Button>
          </>
        )}
      </ScrollView>
    </Container>
  );
}
