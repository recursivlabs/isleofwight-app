import * as React from 'react';
import { View, ScrollView, Pressable, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProtocolAdapterMetadata, ProtocolSettings } from '@recursiv/sdk';
import type { Minds } from '@minds/sdk';
import { Text, Button, Input, Card, Skeleton } from '../components';
import { Container } from '../components/Container';
import { ProtocolCandidates } from '../components/ProtocolCandidates';
import { showToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

import { withAdminGuard } from '../lib/guards';

// GET /protocols/search rows, as the engine serializes them. The SDK types
// this on the method's return value but does not export the interface.
type ProtocolSearchResult = Awaited<ReturnType<Minds['protocols']['search']>>['data'][number];

function ProtocolsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = React.useState(true);
  const [protocols, setProtocols] = React.useState<ProtocolAdapterMetadata[]>([]);
  const [protocolsError, setProtocolsError] = React.useState(false);
  const [settings, setSettings] = React.useState<ProtocolSettings | null>(null);
  const [settingsError, setSettingsError] = React.useState(false);
  const [searchTermsInput, setSearchTermsInput] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<ProtocolSearchResult[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState(false);
  const [tab, setTab] = React.useState<'protocols' | 'candidates' | 'search' | 'settings'>('protocols');
  const [saving, setSaving] = React.useState(false);

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const showSuccess = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 2000); };
  const showError = (m: string) => { showToast(m, 'error'); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    setProtocolsError(false);
    setSettingsError(false);
    const [protocolResult, settingsResult] = await Promise.allSettled([
      sdk.protocols.list(),
      sdk.protocols.getSettings(),
    ]);
    if (protocolResult.status === 'fulfilled') {
      setProtocols(protocolResult.value.data);
    } else {
      setProtocols([]);
      setProtocolsError(true);
    }
    if (settingsResult.status === 'fulfilled') {
      setSettings(settingsResult.value.data);
      setSearchTermsInput(settingsResult.value.data.search_terms.join(', '));
    } else {
      setSettings(null);
      setSettingsError(true);
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const search = async () => {
    if (!sdk || !searchQuery.trim()) return;
    setSearching(true);
    setSearchError(false);
    try {
      const res = await sdk.protocols.search({ query: searchQuery });
      setSearchResults(res.data);
    } catch {
      setSearchResults([]);
      setSearchError(true);
    }
    setSearching(false);
  };

  const saveSettings = async () => {
    if (!sdk || !settings) return;
    if (settings.collection_enabled && settings.enabled_protocols.length === 0) {
      showError('Choose at least one protocol before enabling collection.');
      return;
    }
    setSaving(true);
    try {
      const searchTerms = searchTermsInput.split(',').map(term => term.trim()).filter(Boolean);
      await sdk.protocols.updateSettings({
        collection_enabled: settings.collection_enabled,
        enabled_protocols: settings.enabled_protocols,
        search_terms: searchTerms,
      });
      setSettings(current => current ? ({ ...current, search_terms: searchTerms }) : current);
      showSuccess('Settings saved.');
    } catch { showError('Failed to save settings.'); }
    setSaving(false);
  };

  const tabs = ['protocols', 'candidates', 'search', 'settings'] as const;

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
        <Text variant="h3" style={{ flex: 1 }}>Federation</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md }}>
        {tabs.map(t => (
          <Pressable key={t} accessibilityRole="button" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: tab === t ? colors.accentMuted : 'transparent' }}>
            <Text variant="caption" color={tab === t ? colors.accent : colors.textMuted} style={{ textTransform: 'capitalize' }}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {tab === 'protocols' && (
          protocolsError ? (
            <Card>
              <Text variant="bodyMedium">Couldn&apos;t load federation protocols</Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                Check your connection and try again.
              </Text>
              <View style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}>
                <Button onPress={load} size="sm" variant="secondary">Retry</Button>
              </View>
            </Card>
          ) : protocols.length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
                <Ionicons name="globe-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>No protocols configured</Text>
              </View>
            ) : protocols.map(p => (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{p.name}</Text>
                    <Text variant="caption" color={colors.textMuted}>{p.maturity}</Text>
                  </View>
                  <View style={{ backgroundColor: settings?.enabled_protocols.includes(p.id) ? colors.successMuted : colors.glass, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
                    <Text variant="caption" color={settings?.enabled_protocols.includes(p.id) ? colors.success : colors.textMuted} style={{ fontSize: 11 }}>
                      {settings?.enabled_protocols.includes(p.id) ? 'Enabled' : 'Available'}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
        )}

        {tab === 'candidates' && <ProtocolCandidates resource={sdk?.protocols} />}

        {tab === 'search' && (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Input value={searchQuery} onChangeText={setSearchQuery} placeholder="Search federated content..." />
              </View>
              <Button onPress={search} loading={searching} size="sm">Search</Button>
            </View>
            {searchError ? (
              <Text variant="caption" color={colors.textMuted} align="center">
                Couldn&apos;t search federated content. Check your connection and try again.
              </Text>
            ) : searchResults.length === 0 ? (
              <Text variant="caption" color={colors.textMuted} align="center">
                {searching ? 'Searching...' : 'Search ActivityPub, RSS, and Nostr content'}
              </Text>
            ) : searchResults.map(r => (
              <Card key={r.id}>
                <Text variant="bodyMedium" numberOfLines={2}>{r.title || r.content?.slice(0, 100) || 'Untitled'}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  {r.author?.name || r.author?.remote_handle || 'Unknown source'}
                </Text>
                {r.protocol ? <Text variant="caption" color={colors.accent} style={{ marginTop: spacing.xs }}>{r.protocol}</Text> : null}
              </Card>
            ))}
          </>
        )}

        {tab === 'settings' && settingsError && (
          <Card>
            <Text variant="bodyMedium">Couldn&apos;t load federation settings</Text>
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              Your existing settings were not changed. Check your connection and try again.
            </Text>
            <View style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}>
              <Button onPress={load} size="sm" variant="secondary">Retry</Button>
            </View>
          </Card>
        )}

        {tab === 'settings' && settings && !settingsError && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Protocol Settings</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
              <Text variant="body" style={{ flex: 1 }}>Collect external candidates</Text>
              <Switch
                value={settings.collection_enabled}
                onValueChange={collection_enabled => setSettings(current => current ? ({ ...current, collection_enabled }) : current)}
                trackColor={{ true: colors.accent, false: colors.glass }}
                thumbColor={colors.text}
              />
            </View>
            <Text variant="label" color={colors.textMuted} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>Sources</Text>
            {(protocols.length > 0 ? protocols : settings.available_protocols).map(protocol => {
              const canDiscover = protocol.capabilities.discover === 'supported';
              const enabled = settings.enabled_protocols.includes(protocol.id);
              return (
                <View key={protocol.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text variant="body">{protocol.name}</Text>
                    <Text variant="caption" color={colors.textMuted}>
                      {canDiscover ? `${protocol.maturity} · candidate discovery` : 'Discovery not available'}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    disabled={!canDiscover}
                    onValueChange={nextEnabled => setSettings(current => {
                      if (!current) return current;
                      const enabledProtocols = nextEnabled
                        ? [...new Set([...current.enabled_protocols, protocol.id])]
                        : current.enabled_protocols.filter(id => id !== protocol.id);
                      return { ...current, enabled_protocols: enabledProtocols };
                    })}
                    trackColor={{ true: colors.accent, false: colors.glass }}
                    thumbColor={colors.text}
                  />
                </View>
              );
            })}
            <View style={{ marginTop: spacing.lg }}>
              <Input
                value={searchTermsInput}
                onChangeText={setSearchTermsInput}
                placeholder="Search terms, separated by commas"
              />
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                Used only when a source needs keywords to discover candidates.
              </Text>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <Button onPress={saveSettings} loading={saving} size="sm">Save Settings</Button>
            </View>
          </Card>
        )}
      </ScrollView>
    </Container>
  );
}

export default withAdminGuard(ProtocolsScreen);
