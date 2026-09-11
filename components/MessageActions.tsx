import * as React from 'react';
import { View, Pressable, Modal, Platform, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';

// The quick-reaction row (WhatsApp/Signal set). `+` opens nothing extra for now —
// these six cover the vast majority of reactions; kept tight so it's one tap.
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface Props {
  visible: boolean;
  isOwn: boolean;
  /** the reaction the current user has already applied, to show it selected */
  myReaction?: string | null;
  /** press coordinates (pageX/pageY) so the menu can anchor near the tapped bubble on web */
  anchor?: { x: number; y: number } | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy: () => void;
  onDelete?: () => void;
}

// The floating menu is ~260 tall (reaction pill + action list) and ~230 wide.
const MENU_W = 230;
const MENU_H = 260;

/**
 * Tap-and-hold message action overlay (Signal / WhatsApp / Telegram class).
 * A dimmed backdrop lifts focus to a floating quick-reaction bar + a compact
 * action list. One tap to react, reply, or copy — frictionless on web + native.
 */
export function MessageActions({ visible, isOwn, myReaction, anchor, onClose, onReact, onReply, onCopy, onDelete }: Props) {
  const colors = useColors();
  const anim = React.useRef(new Animated.Value(0)).current;

  // On web, anchor the menu next to the tapped bubble (clamped to the viewport)
  // instead of dead-centering it — Signal/iMessage behaviour. Native falls back
  // to the centered overlay (touch targets are already large there).
  const anchoredStyle = React.useMemo(() => {
    if (Platform.OS !== 'web' || !anchor || typeof window === 'undefined') return null;
    const vw = window.innerWidth || 1200;
    const vh = window.innerHeight || 800;
    const left = Math.max(12, Math.min(anchor.x - (isOwn ? MENU_W - 40 : 40), vw - MENU_W - 12));
    const top = Math.max(12, Math.min(anchor.y - 20, vh - MENU_H - 12));
    return { position: 'absolute' as const, left, top };
  }, [anchor, isOwn]);

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: Platform.OS !== 'web',
      speed: 20,
      bounciness: 6,
    }).start();
  }, [visible, anim]);

  if (!visible) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  const Action = ({ icon, label, onPress, destructive }: { icon: string; label: string; onPress: () => void; destructive?: boolean }) => (
    <Pressable
      onPress={() => { onPress(); onClose(); }}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: pressed || hovered ? colors.surfaceHover : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name={icon as any} size={20} color={destructive ? (colors.error || '#ef4444') : colors.text} />
      <Text variant="body" color={destructive ? (colors.error || '#ef4444') : colors.text}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: anchoredStyle ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
        <Animated.View style={{ transform: [{ scale }], opacity: anim, alignItems: isOwn ? 'flex-end' : 'flex-start', maxWidth: 420, width: anchoredStyle ? undefined : '100%', ...(anchoredStyle || {}) }}>
          {/* Quick reactions pill */}
          <Pressable onPress={() => {}} style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
            backgroundColor: colors.surfaceRaised, borderRadius: radius.full,
            paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
            marginBottom: spacing.sm,
            borderWidth: 0.5, borderColor: colors.borderSubtle,
            ...(Platform.OS === 'web' ? { boxShadow: '0 6px 24px rgba(0,0,0,0.25)' } as any : { elevation: 6 }),
          }}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => { onReact(emoji); onClose(); }}
                style={({ pressed, hovered }: any) => ({
                  width: 40, height: 40, borderRadius: 20,
                  alignItems: 'center', justifyContent: 'center',
                  backgroundColor: myReaction === emoji ? colors.accentMuted : (pressed || hovered ? colors.surfaceHover : 'transparent'),
                  transform: [{ scale: hovered ? 1.15 : 1 }],
                  ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'transform 0.12s ease' } as any : {}),
                })}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </Pressable>
            ))}
          </Pressable>

          {/* Action list */}
          <View style={{
            backgroundColor: colors.surfaceRaised, borderRadius: radius.lg, overflow: 'hidden',
            minWidth: 200, borderWidth: 0.5, borderColor: colors.borderSubtle,
            ...(Platform.OS === 'web' ? { boxShadow: '0 6px 24px rgba(0,0,0,0.25)' } as any : { elevation: 6 }),
          }}>
            <Action icon="arrow-undo-outline" label="Reply" onPress={onReply} />
            <View style={{ height: 0.5, backgroundColor: colors.borderSubtle }} />
            <Action icon="copy-outline" label="Copy" onPress={onCopy} />
            {isOwn && onDelete ? (
              <>
                <View style={{ height: 0.5, backgroundColor: colors.borderSubtle }} />
                <Action icon="trash-outline" label="Delete" onPress={onDelete} destructive />
              </>
            ) : null}
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
