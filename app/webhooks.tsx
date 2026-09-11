import * as React from 'react';
import { View, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button, Input, Card, Skeleton } from '../components';
import { Container } from '../components/Container';
import { showToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { captureException } from '../lib/monitoring';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

// The engine's webhooks are INBOUND: registering one mints a receiving
// endpoint on the platform (`/api/v1/webhooks/inbound/{id}`) that external
// services POST into. There is no delivery URL to collect — the endpoint in
// the response is the whole point of the registration.
type Webhook = {
  id: string;
  provider: string;
  endpoint: string;
  events?: string[];
  status: string;
  last_received_at: string | null;
  created_at: string;
};

import { withAdminGuard } from '../lib/guards';

function WebhooksScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [webhooks, setWebhooks] = React.useState<Webhook[]>([]);
  const [showCreate, setShowCreate] = React.useState(false);
  const [events, setEvents] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const showError = (m: string) => { showToast(m, 'error'); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await sdk.webhooks.list();
      const rows = Array.isArray((res as any)?.data) ? (res as any).data : null;
      if (rows) {
        setWebhooks(rows);
      } else {
        // A 200 whose body carries no list is an outage, not "no webhooks".
        setLoadError(true);
        captureException(new Error('Webhooks response was not a list'), { screen: 'webhooks', step: 'load-webhooks' });
      }
    } catch (e) {
      setLoadError(true);
      captureException(e, { screen: 'webhooks', step: 'load-webhooks' });
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!sdk) return;
    setSaving(true);
    try {
      const eventList = events.split(',').map(e => e.trim()).filter(Boolean);
      // RegisterWebhookInput takes a provider and an optional events filter;
      // the consumer app registers a generic "custom" receiver. The engine
      // answers with the endpoint external services POST into.
      await sdk.webhooks.register({ provider: 'custom', events: eventList.length ? eventList : undefined });
      setShowCreate(false);
      setEvents('');
      await load();
    } catch { showError('Failed to register webhook.'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!sdk) return;
    setDeleting(id);
    try {
      await sdk.webhooks.delete(id);
      setWebhooks(w => w.filter(x => x.id !== id));
    } catch { showError('Failed to delete webhook.'); }
    setDeleting(null);
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={60} /><Skeleton height={60} /><Skeleton height={60} />
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Webhooks</Text>
        <Button onPress={() => setShowCreate(!showCreate)} variant="secondary" size="sm">{showCreate ? 'Cancel' : 'New'}</Button>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {loadError ? (
          <Pressable
            onPress={() => { void load(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading webhooks"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
              paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
              backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="cloud-offline-outline" size={13} color={colors.error} />
            <Text variant="caption" color={colors.error}>Couldn't load your webhooks · Tap to retry</Text>
          </Pressable>
        ) : null}
        {showCreate && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Register Webhook</Text>
            <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
              Registering creates a receiving endpoint on the platform. Point the external service at the endpoint shown on the new webhook.
            </Text>
            <Input label="Event types (comma separated, optional)" value={events} onChangeText={setEvents} placeholder="post.created, user.signup" autoCapitalize="none" />
            <Button onPress={create} loading={saving} size="sm">Register</Button>
          </Card>
        )}

        {webhooks.length === 0 ? (
          // A failed load must not present itself as the "no webhooks" state.
          loadError ? null : (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Ionicons name="link-outline" size={40} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No webhooks registered</Text>
            </View>
          )
        ) : webhooks.map(w => (
          <Card key={w.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium" numberOfLines={1}>{w.endpoint}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  {(w.events || []).join(', ') || 'All events'}
                </Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  {w.provider} · {w.status}
                </Text>
              </View>
              <Pressable onPress={() => remove(w.id)} disabled={deleting === w.id} hitSlop={8} style={{ opacity: deleting === w.id ? 0.5 : 1, padding: spacing.sm }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>
    </Container>
  );
}

export default withAdminGuard(WebhooksScreen);
