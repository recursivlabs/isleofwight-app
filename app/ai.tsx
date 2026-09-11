import * as React from 'react';
import { View, TextInput, Pressable, Platform, Linking, ScrollView, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Text } from '../components/Text';
import { Container } from '../components/Container';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import { askAgent } from '../lib/askAgent';
import { resolvePersonalAgent, invalidatePersonalAgent } from '../lib/resolvePersonalAgent';
import { spacing, radius, CTA } from '../constants/theme';

const BUILD_URL = 'https://build.minds.com';

// Models the user can run their private AI on (matches app/agent.tsx + the
// server allowlist). "Talk to any popular LLM."
const MODELS = [
  { key: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { key: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { key: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6' },
  { key: 'openai/gpt-5.5', label: 'GPT-5.5' },
];
const labelFor = (key: string) => MODELS.find((m) => m.key === key)?.label || 'Gemini 3.1 Pro';

/**
 * Minds AI — your private AI harness. A quiet single-prompt surface: the model
 * and full customization live INSIDE the composer (a model pill + a settings
 * icon), so nothing else competes with the prompt. Submitting sends to the
 * user's personal agent and opens the chat.
 */
export default function MindsAIScreen() {
  const router = useRouter();
  const colors = useColors();
  const toast = useToast();
  const { sdk, user } = useAuth();
  const web = Platform.OS === 'web';
  const isPro = !!(user?.pro || (user as any)?.is_pro);

  const [prompt, setPrompt] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [focused, setFocused] = React.useState(false);

  const [model, setModel] = React.useState<string>(MODELS[0].key);
  const [savingModel, setSavingModel] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (!sdk) return;
    let alive = true;
    (async () => {
      const agent = await resolvePersonalAgent(sdk).catch(() => null);
      if (!alive || !agent) return;
      const m = (agent as any).ai_model || (agent as any).model;
      if (m) setModel(m);
    })();
    return () => { alive = false; };
  }, [sdk]);

  const pickModel = async (key: string) => {
    setPickerOpen(false);
    if (key === model || !sdk) return;
    const prev = model;
    setModel(key);
    setSavingModel(true);
    try {
      await (sdk as any).agents.ensurePersonal({ overrides: { model: key } });
      invalidatePersonalAgent();
    } catch {
      setModel(prev);
    } finally {
      setSavingModel(false);
    }
  };

  const submit = async () => {
    const q = prompt.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const result = await askAgent(sdk, router, q);
      if (result === 'failed') {
        toast.show('Could not start Minds AI. Try again.', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const openBuild = () => {
    if (isPro) {
      if (web && typeof window !== 'undefined') window.open(BUILD_URL, '_blank', 'noopener');
      else Linking.openURL(BUILD_URL);
    } else {
      router.push('/upgrade' as any);
    }
  };

  return (
    <Container>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing['4xl'] }}>
        <View style={{ width: '100%', maxWidth: 620, alignItems: 'center', gap: spacing.xl }}>

          {/* Mark: a "mind + idea" bulb variation, with the name and one-line pitch. */}
          <View style={{ alignItems: 'center', gap: spacing.sm }}>
            <MaterialCommunityIcons name="head-lightbulb" size={60} color={colors.accent} />
            <Text variant="h2" style={{ fontSize: 24, letterSpacing: -0.2 }}>Minds AI</Text>
            <Text variant="body" color={colors.textSecondary} align="center" style={{ fontSize: 15 }}>
              Your private harness. Talk to any model without the tracking
            </Text>
          </View>

          {/* Composer — the whole surface. Model + settings live in the bottom bar. */}
          <View
            style={{
              width: '100%',
              borderWidth: 1.5,
              borderColor: focused ? colors.accent : colors.border,
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.sm,
              ...(web && focused ? ({ boxShadow: '0 0 0 4px rgba(184,134,11,0.16)' } as any) : {}),
              ...(web ? ({ transition: 'box-shadow .15s ease, border-color .15s ease' } as any) : {}),
            }}
          >
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              accessibilityLabel="Ask Minds AI"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Ask Minds AI anything…"
              placeholderTextColor={colors.textMuted}
              multiline
              onSubmitEditing={submit}
              blurOnSubmit
              style={{ color: colors.text, fontSize: 16, lineHeight: 22, paddingVertical: spacing.sm, minHeight: 28, maxHeight: 200, fontFamily: 'Roboto-Regular', ...(web ? ({ outlineStyle: 'none' } as any) : {}) }}
            />

            {/* Bottom bar: settings gear · model pill ......... send */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
              <Pressable
                onPress={() => router.push('/agent' as any)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Customize your AI"
                style={({ hovered }: any) => ({ padding: 6, borderRadius: radius.full, backgroundColor: hovered ? colors.surfaceHover : 'transparent', ...(web ? ({ cursor: 'pointer' } as any) : {}) })}
              >
                <Ionicons name="settings-outline" size={19} color={colors.textMuted} />
              </Pressable>

              <Pressable
                onPress={() => setPickerOpen(true)}
                disabled={savingModel}
                accessibilityRole="button"
                accessibilityLabel={`Choose AI model, ${labelFor(model)}`}
                accessibilityState={{ disabled: savingModel, expanded: pickerOpen }}
                {...(web ? { 'aria-expanded': pickerOpen } as any : {})}
                style={({ hovered }: any) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
                  paddingVertical: 5, paddingHorizontal: spacing.sm,
                  backgroundColor: hovered ? colors.surfaceHover : 'transparent',
                  opacity: savingModel ? 0.6 : 1,
                  ...(web ? ({ cursor: 'pointer' } as any) : {}),
                })}
              >
                <Text variant="caption" color={colors.textSecondary} style={{ fontSize: 13, fontFamily: 'Roboto-Medium' }}>{labelFor(model)}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
              </Pressable>

              <View style={{ flex: 1 }} />

              <Pressable
                onPress={submit}
                disabled={!prompt.trim() || busy}
                accessibilityRole="button"
                accessibilityLabel="Send prompt to Minds AI"
                accessibilityState={{ disabled: !prompt.trim() || busy }}
                style={{
                  width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: prompt.trim() ? CTA.solid : colors.surfaceHover, opacity: busy ? 0.6 : 1,
                  ...(web && prompt.trim() ? ({ backgroundImage: CTA.gradient, cursor: 'pointer' } as any) : {}),
                  ...(web && !prompt.trim() ? ({ cursor: 'default' } as any) : {}),
                }}
              >
                <Ionicons name="arrow-up" size={19} color={prompt.trim() ? CTA.ink : colors.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Build with Minds AI — one quiet Pro-gated CTA. */}
          <Pressable
            onPress={openBuild}
            accessibilityRole="button"
            accessibilityLabel="Build with Minds AI"
            style={({ hovered }: any) => ({
              width: '100%', flexDirection: 'row', alignItems: 'center', gap: spacing.md,
              borderWidth: 1, borderColor: hovered ? colors.accent : colors.border,
              backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
              ...(web ? ({ cursor: 'pointer', transition: 'border-color .15s ease' } as any) : {}),
            })}
          >
            <Ionicons name="cube-outline" size={22} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="h3" style={{ fontSize: 15 }}>Build with Minds AI</Text>
                <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full }}>
                  <Text variant="caption" color={colors.accent} style={{ fontSize: 11, fontFamily: 'Roboto-Medium' }}>PRO</Text>
                </View>
              </View>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 13, marginTop: 1 }}>Build your own apps and AI agents</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Model picker. */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable onPress={() => setPickerOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            accessibilityLabel="Choose an AI model"
            accessibilityViewIsModal
            {...(web ? { role: 'dialog', 'aria-label': 'Choose an AI model' } as any : {})}
            style={{ width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
          >
            <Text accessibilityRole="header" variant="caption" color={colors.textMuted} style={{ fontSize: 12, fontFamily: 'Roboto-Medium', textTransform: 'uppercase', letterSpacing: 0.3, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>Choose a model</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="AI models">
              {MODELS.map((m) => {
                const active = m.key === model;
                return (
                  <Pressable
                    key={m.key}
                    onPress={() => pickModel(m.key)}
                    accessibilityRole="radio"
                    accessibilityLabel={m.label}
                    accessibilityState={{ checked: active }}
                    {...(web ? { 'aria-checked': active } as any : {})}
                    style={({ hovered }: any) => ({
                      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                      backgroundColor: hovered ? colors.surfaceHover : 'transparent',
                      ...(web ? ({ cursor: 'pointer' } as any) : {}),
                    })}
                  >
                    <Text variant="body" color={active ? colors.accent : colors.text} style={{ flex: 1, fontFamily: active ? 'Roboto-Medium' : 'Roboto-Regular' }}>{m.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}
