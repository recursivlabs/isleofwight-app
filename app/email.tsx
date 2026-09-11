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

type Campaign = { id: string; name: string; subject: string; status: string; from_email?: string };

function StatusBadge({ status }: { status: string }) {
  const colors = useColors();
  const map: Record<string, { bg: string; text: string }> = {
    draft: { bg: colors.glass, text: colors.textMuted },
    sending: { bg: colors.warningMuted, text: colors.warning },
    sent: { bg: colors.successMuted, text: colors.success },
    paused: { bg: colors.errorMuted, text: colors.error },
    active: { bg: colors.successMuted, text: colors.success },
  };
  const s = map[status] || map.draft;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
      <Text variant="caption" color={s.text} style={{ fontSize: 11 }}>{status}</Text>
    </View>
  );
}

import { withAdminGuard } from '../lib/guards';

function EmailScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [detail, setDetail] = React.useState<any>(null);
  const [stats, setStats] = React.useState<any>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [form, setForm] = React.useState({ name: '', subject: '', from_email: '', html_content: '' });
  const [saving, setSaving] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState('');

  const showError = (m: string) => { showToast(m, 'error'); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    setLoadError(false);
    try {
      const res = await sdk.email.listCampaigns();
      const rows = Array.isArray((res as any)?.data) ? (res as any).data : null;
      if (rows) {
        setCampaigns(rows);
      } else {
        // A 200 whose body carries no list is an outage, not "no campaigns".
        setLoadError(true);
        captureException(new Error('Email campaigns response was not a list'), { screen: 'email', step: 'load-campaigns' });
      }
    } catch (e) {
      setLoadError(true);
      captureException(e, { screen: 'email', step: 'load-campaigns' });
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!sdk || !form.name || !form.subject) return;
    setSaving(true);
    try {
      await sdk.email.createCampaign(form);
      setShowCreate(false);
      setForm({ name: '', subject: '', from_email: '', html_content: '' });
      await load();
    } catch { showError('Failed to create campaign.'); }
    setSaving(false);
  };

  const openDetail = async (id: string) => {
    if (!sdk) return;
    const [d, s] = await Promise.all([
      sdk.email.getCampaign(id).catch(() => null),
      sdk.email.getCampaignStats(id).catch(() => null),
    ]);
    // getCampaign and getCampaignStats return the SingleResponse envelope
    // { data: ... }; the campaign fields live one level down. Reading them off
    // the envelope rendered a blank subject, a status stuck on "draft", zero
    // for every stat, and no action button could ever appear. A failed fetch
    // must say so, not leave the tap doing nothing.
    const campaign = (d as any)?.data ?? null;
    if (!campaign) {
      showError('Failed to load campaign.');
      return;
    }
    setDetail(campaign);
    setStats((s as any)?.data ?? null);
  };

  const campaignAction = async (id: string, action: 'start' | 'pause' | 'resume') => {
    if (!sdk) return;
    setActionLoading(action);
    try {
      await sdk.email[`${action}Campaign`](id);
      await openDetail(id);
      await load();
    } catch { showError(`Failed to ${action} campaign.`); }
    setActionLoading('');
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

  if (detail) {
    return (
      <Container safeTop padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
          <Pressable onPress={() => { setDetail(null); setStats(null); }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>{detail.name || 'Campaign'}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="label" color={colors.textMuted}>Status</Text>
              <StatusBadge status={detail.status || 'draft'} />
            </View>
            <Text variant="body" color={colors.textSecondary}>Subject: {detail.subject}</Text>
            {detail.from_email ? <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>From: {detail.from_email}</Text> : null}
          </Card>
          {stats && (
            <Card>
              <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Stats</Text>
              {/* The stats payload speaks in *_count fields (GET
                  /email/campaigns/:id/stats); the bare names read undefined and
                  showed 0 for every row of every campaign. */}
              {([
                ['Sent', 'sent_count'],
                ['Delivered', 'delivered_count'],
                ['Opened', 'open_count'],
                ['Clicked', 'click_count'],
                ['Bounced', 'bounce_count'],
              ] as const).map(([label, k]) => (
                <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
                  <Text variant="body">{label}</Text>
                  <Text variant="bodyMedium" color={colors.accent}>{stats[k] ?? 0}</Text>
                </View>
              ))}
            </Card>
          )}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            {(detail.status === 'draft' || detail.status === 'paused') && (
              <Button onPress={() => campaignAction(detail.id, detail.status === 'draft' ? 'start' : 'resume')} loading={actionLoading === 'start' || actionLoading === 'resume'} size="sm">
                {detail.status === 'draft' ? 'Start' : 'Resume'}
              </Button>
            )}
            {(detail.status === 'sending' || detail.status === 'active') && (
              <Button onPress={() => campaignAction(detail.id, 'pause')} loading={actionLoading === 'pause'} variant="secondary" size="sm">Pause</Button>
            )}
          </View>
        </ScrollView>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Email Campaigns</Text>
        <Button onPress={() => setShowCreate(!showCreate)} variant="secondary" size="sm">{showCreate ? 'Cancel' : 'New'}</Button>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {loadError ? (
          <Pressable
            onPress={() => { void load(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading email campaigns"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
              paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
              backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="cloud-offline-outline" size={13} color={colors.error} />
            <Text variant="caption" color={colors.error}>Couldn't load your campaigns · Tap to retry</Text>
          </Pressable>
        ) : null}
        {showCreate && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Create Campaign</Text>
            <Input label="Name" value={form.name} onChangeText={t => setForm(f => ({ ...f, name: t }))} placeholder="Campaign name" />
            <Input label="Subject" value={form.subject} onChangeText={t => setForm(f => ({ ...f, subject: t }))} placeholder="Email subject" />
            <Input label="From email" value={form.from_email} onChangeText={t => setForm(f => ({ ...f, from_email: t }))} placeholder="from@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label="HTML content" value={form.html_content} onChangeText={t => setForm(f => ({ ...f, html_content: t }))} placeholder="<h1>Hello</h1>" multiline numberOfLines={3} />
            <Button onPress={create} loading={saving} size="sm" disabled={!form.name || !form.subject}>Create</Button>
          </Card>
        )}
        {campaigns.length === 0 ? (
          // A failed load must not present itself as the "no campaigns" state.
          loadError ? null : (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Ionicons name="mail-outline" size={40} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No campaigns yet</Text>
            </View>
          )
        ) : campaigns.map(c => (
          <Pressable key={c.id} onPress={() => openDetail(c.id)} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, borderWidth: 0.5, borderColor: colors.glassBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{c.name}</Text>
              <StatusBadge status={c.status || 'draft'} />
            </View>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: spacing.xs }}>{c.subject}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Container>
  );
}

export default withAdminGuard(EmailScreen);
