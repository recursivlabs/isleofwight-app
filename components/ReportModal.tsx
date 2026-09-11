import * as React from 'react';
import { View, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { showToast } from './Toast';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Button } from './Button';
import { Input } from './Input';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => Promise<void>;
}

const REASONS = [
  'Spam',
  'Harassment',
  'NSFW (untagged)',
  'Hate Speech',
  'Illegal',
  'Impersonation',
  'Other',
];

export function ReportModal({ visible, onClose, onSubmit }: Props) {
  const colors = useColors();
  const [selectedReason, setSelectedReason] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await onSubmit(selectedReason, details);
      setSubmitted(true);
      setTimeout(() => {
        setSelectedReason('');
        setDetails('');
        setSubmitted(false);
        onClose();
      }, 1500);
    } catch {
      showToast('Failed to submit report. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.scrimStrong,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius.xl,
            padding: spacing['2xl'],
            width: '100%',
            maxWidth: 400,
            maxHeight: '80%',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          {submitted ? (
            <View style={{ alignItems: 'center', padding: spacing['2xl'], gap: spacing.md }}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text variant="h3" color={colors.success}>Report Submitted</Text>
              <Text variant="body" color={colors.textMuted} align="center">Thank you for helping keep the island safe.</Text>
            </View>
          ) : (<>
          <Text variant="h3" style={{ marginBottom: spacing.xl }}>
            Report Content
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              Why are you reporting this?
            </Text>

            {REASONS.map((reason) => (
              <Pressable
                key={reason}
                onPress={() => setSelectedReason(reason)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: selectedReason === reason ? colors.surfaceHover : 'transparent',
                  marginBottom: spacing.xs,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radius.full,
                    borderWidth: 2,
                    borderColor: selectedReason === reason ? colors.accent : colors.textMuted,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedReason === reason && (
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: radius.full,
                        backgroundColor: colors.accent,
                      }}
                    />
                  )}
                </View>
                <Text variant="body">{reason}</Text>
              </Pressable>
            ))}

            <View style={{ height: spacing.lg }} />

            <Input
              label="Additional details (optional)"
              placeholder="Provide more context..."
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={3}
              style={{ height: 80, textAlignVertical: 'top' }}
            />
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Button onPress={onClose} variant="secondary" fullWidth>
                Cancel
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={handleSubmit}
                loading={submitting}
                disabled={!selectedReason}
                fullWidth
              >
                Submit
              </Button>
            </View>
          </View>
          </>)}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
