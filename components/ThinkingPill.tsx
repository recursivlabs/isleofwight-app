/**
 * Agent thinking indicator. Subscribes to the server's `agent_thinking`
 * events (status: 'thinking' | 'generating' | 'done', plus chunk and
 * elapsedMs metadata) and renders a contextual label that changes as
 * the agent moves through phases.
 *
 * Replaces the earlier static 3-dot TypingIndicator. When `streaming`
 * already started filling the bubble, the pill fades out — the caret
 * inside the bubble is the new "live" signal.
 */
import * as React from 'react';
import { View, Animated, Platform } from 'react-native';
import { Text } from './Text';
import { useColors } from '../lib/theme';
import { spacing } from '../constants/theme';

type ThinkingStatus = 'thinking' | 'generating' | 'done' | null;

interface Props {
  visible: boolean;
  status: ThinkingStatus;
  agentName?: string;
}

export function ThinkingPill({ visible, status, agentName = 'Agent' }: Props) {
  const colors = useColors();
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [visible, opacity]);

  if (!visible) return null;

  const label =
    status === 'generating' ? `${agentName} is writing…`
    : status === 'done' ? ''
    : `${agentName} is thinking…`;

  return (
    <Animated.View
      style={{
        opacity,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
      }}
    >
      <PulsingOrb color={colors.accent} active={status !== 'done'} />
      <Text variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

// Smooth single-orb pulse — gentler than 3 staccato dots. Slows when
// the agent is in 'thinking' state, speeds up when 'generating'.
function PulsingOrb({ color, active }: { color: string; active: boolean }) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    if (!active) {
      scale.setValue(1);
      opacity.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.4, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacity, { toValue: 0.5, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale, opacity]);

  if (Platform.OS === 'web') {
    return (
      <>
        <style>{"@keyframes mindsThinkingPulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.4); opacity: 1; } }"}</style>
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            animationName: active ? 'mindsThinkingPulse' : '',
            animationDuration: '1200ms',
            animationIterationCount: 'infinite',
          } as any}
        />
      </>
    );
  }

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}
