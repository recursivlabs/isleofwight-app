import * as React from 'react';
import { View, Pressable, Modal, Platform, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { AgentBadge } from './AgentBadge';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import { useAuth } from '../lib/auth';
import { isConversationMuted, toggleConversationMuteConfirmed } from '../lib/preferences';
import { showToast } from './Toast';

interface Partner {
  id?: string;
  name?: string;
  username?: string;
  image?: string;
  isAgent?: boolean;
}

/**
 * Per-chat settings (Signal/WhatsApp-style): a bottom sheet off the thread
 * header. View profile, mute (device-local for now), and delete the
 * conversation. Kept to controls that are genuinely functional today; server
 * mute + block are follow-ups.
 */
export function ChatSettingsSheet({
  visible,
  onClose,
  partner,
  conversationId,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  partner: Partner;
  conversationId: string;
  onDeleted: () => void;
}) {
  const colors = useColors();
  const router = useRouter();
  const { sdk } = useAuth();
  const [muted, setMuted] = React.useState(false);
  const [muteSaving, setMuteSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (visible) setMuted(isConversationMuted(conversationId));
  }, [visible, conversationId]);

  const name = partner.name || partner.username || 'Conversation';

  const goProfile = () => {
    onClose();
    if (partner.username || partner.id) router.push(`/${partner.username || partner.id}` as any);
  };

  const onToggleMute = async () => {
    if (muteSaving) return;
    setMuteSaving(true);
    const result = await toggleConversationMuteConfirmed(conversationId);
    if (result.persisted) setMuted(result.muted);
    else showToast('Conversation mute was not saved. Try again.', 'error');
    setMuteSaving(false);
  };

  const doDelete = async () => {
    if (!sdk || deleting) return;
    setDeleting(true);
    try {
      await (sdk as any).chat.deleteConversation(conversationId);
      showToast('Conversation deleted', 'success');
      onClose();
      onDeleted();
    } catch {
      showToast('Could not delete conversation', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && window.confirm('Delete this conversation? This cannot be undone.')) doDelete();
    } else {
      Alert.alert('Delete conversation', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const Row = ({ icon, label, onPress, danger, right }: { icon: string; label: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }: any) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: pressed || hovered ? colors.surfaceHover : 'transparent',
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name={icon as any} size={20} color={danger ? (colors.error || '#ef4444') : colors.text} />
      <Text variant="body" color={danger ? (colors.error || '#ef4444') : colors.text} style={{ flex: 1 }}>{label}</Text>
      {right}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
            paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing['3xl'],
            gap: spacing.xs,
            ...(Platform.OS === 'web' ? { maxWidth: 460, width: '100%', alignSelf: 'center' } as any : {}),
          }}
        >
          {/* Grab handle */}
          <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle, marginBottom: spacing.md }} />

          {/* Member header */}
          <Pressable onPress={goProfile} style={({ hovered }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: hovered ? colors.surfaceHover : 'transparent', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}>
            <Avatar uri={partner.image} name={name} size="lg" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text variant="h3" numberOfLines={1}>{name}</Text>
                {partner.isAgent && <AgentBadge size={14} />}
              </View>
              {partner.username ? <Text variant="caption" color={colors.textMuted}>@{partner.username}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={{ height: 0.5, backgroundColor: colors.borderSubtle, marginVertical: spacing.xs }} />

          <Row icon="person-circle-outline" label="View profile" onPress={goProfile} />
          <Row
            icon={muted ? 'notifications-off-outline' : 'notifications-outline'}
            label="Mute notifications"
            onPress={onToggleMute}
            right={<Switch value={muted} onValueChange={onToggleMute} disabled={muteSaving} trackColor={{ true: colors.accent }} />}
          />

          <View style={{ height: 0.5, backgroundColor: colors.borderSubtle, marginVertical: spacing.xs }} />

          <Row icon="trash-outline" label={deleting ? 'Deleting…' : 'Delete conversation'} onPress={confirmDelete} danger />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
