import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button, Input, Card, Skeleton, Divider } from '../components';
import { Container } from '../components/Container';
import { showToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { captureException } from '../lib/monitoring';
import { ORG_ID } from '../lib/recursiv';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';

import { withAdminGuard } from '../lib/guards';

function OrgSettingsScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();

  const [loading, setLoading] = React.useState(true);
  const [settingsError, setSettingsError] = React.useState(false);
  const [securityError, setSecurityError] = React.useState(false);
  const [orgSettings, setOrgSettings] = React.useState<any>(null);
  const [security, setSecurity] = React.useState<any>(null);
  const [githubOwner, setGithubOwner] = React.useState('');
  const [templateUrl, setTemplateUrl] = React.useState('');
  const [saving, setSaving] = React.useState('');

  const [statusMsg, setStatusMsg] = React.useState<string | null>(null);
  const showSuccess = (m: string) => { setStatusMsg(m); setTimeout(() => setStatusMsg(null), 2000); };
  const showError = (m: string) => { showToast(m, 'error'); };

  const load = React.useCallback(async () => {
    if (!sdk) return;
    setLoading(true);
    const [osResult, secResult] = await Promise.allSettled([
      sdk.organizationSettings.get(ORG_ID),
      sdk.organizationSecurity.get(ORG_ID),
    ]);
    // Each half settles on its own: a failed fetch is an outage the admin can
    // see and retry, never silently rendered as "nothing configured".
    // Both endpoints answer in the SingleResponse envelope { data: ... };
    // everything below works on the unwrapped payload (null for a fresh org).
    if (osResult.status === 'fulfilled') {
      const os = (osResult.value as any)?.data ?? null;
      setOrgSettings(os);
      setSettingsError(false);
      if (os?.github_owner) setGithubOwner(os.github_owner);
      if (os?.default_template_url) setTemplateUrl(os.default_template_url);
    } else {
      setSettingsError(true);
      captureException(osResult.reason, { screen: 'org-settings', step: 'load-settings' });
    }
    if (secResult.status === 'fulfilled') {
      setSecurity((secResult.value as any)?.data ?? null);
      setSecurityError(false);
    } else {
      setSecurityError(true);
      captureException(secResult.reason, { screen: 'org-settings', step: 'load-security' });
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const connectGitHub = async () => {
    if (!sdk || !githubOwner.trim()) return;
    setSaving('github');
    try {
      await sdk.organizationSettings.connectGitHub(ORG_ID, { github_owner: githubOwner } as any);
      showSuccess('GitHub connected.');
      await load();
    } catch { showError('Failed to connect GitHub.'); }
    setSaving('');
  };

  const disconnectGitHub = async () => {
    if (!sdk) return;
    setSaving('github-dc');
    try {
      await sdk.organizationSettings.disconnectGitHub(ORG_ID);
      setGithubOwner('');
      showSuccess('GitHub disconnected.');
      await load();
    } catch { showError('Failed to disconnect GitHub.'); }
    setSaving('');
  };

  const setTemplate = async () => {
    if (!sdk || !templateUrl.trim()) return;
    setSaving('template');
    try {
      await sdk.organizationSettings.setDefaultTemplate(ORG_ID, { template_url: templateUrl });
      showSuccess('Default template updated.');
    } catch { showError('Failed to set template.'); }
    setSaving('');
  };

  const updateSecurity = async (updates: Record<string, any>) => {
    if (!sdk) return;
    // The PUT takes a partial UpdateSecurityPolicyInput — send only the fields
    // being changed, never the whole local state (which is a GET payload).
    setSecurity({ ...security, ...updates });
    setSaving('security');
    try {
      await sdk.organizationSecurity.update(ORG_ID, updates);
    } catch { showError('Failed to update security.'); await load(); }
    setSaving('');
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} />
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
        <Text variant="h3" style={{ flex: 1 }}>Organization Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {(settingsError || securityError) ? (
          <Pressable
            onPress={() => { void load(); }}
            accessibilityRole="button"
            accessibilityLabel="Retry organization settings and security policies"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
              paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
              backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="cloud-offline-outline" size={13} color={colors.error} />
            <Text variant="caption" color={colors.error}>
              {settingsError && securityError
                ? "Couldn't load organization settings or security policies · Tap to retry"
                : settingsError
                  ? "Couldn't load organization settings · Tap to retry"
                  : "Couldn't load security policies · Tap to retry"}
            </Text>
          </Pressable>
        ) : null}
        {statusMsg && (
          <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
            <Text variant="body" color={colors.success}>{statusMsg}</Text>
          </View>
        )}
        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>GitHub Integration</Text>
          <Input label="GitHub owner/org" value={githubOwner} onChangeText={setGithubOwner} placeholder="my-org" autoCapitalize="none" />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button onPress={connectGitHub} loading={saving === 'github'} size="sm" disabled={!githubOwner.trim()}>Connect</Button>
            {orgSettings?.github_owner ? (
              <Button onPress={disconnectGitHub} loading={saving === 'github-dc'} variant="secondary" size="sm" accentColor={colors.error}>Disconnect</Button>
            ) : null}
          </View>
        </Card>

        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Default Template</Text>
          <Input label="Template URL" value={templateUrl} onChangeText={setTemplateUrl} placeholder="https://github.com/org/template" autoCapitalize="none" />
          <Button onPress={setTemplate} loading={saving === 'template'} size="sm" disabled={!templateUrl.trim()}>Set Template</Button>
        </Card>

        {security && (
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Security Policies</Text>
            {/* Keys come from the engine's SecurityPolicy contract. The other
                policy fields (grace period, timeouts, IP allowlist) need real
                input UI and a product decision — tracked in #766. */}
            {[
              { key: 'require_two_factor', label: 'Require 2FA' },
            ].map(({ key, label }) => (
              security[key] !== undefined ? (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                  <Text variant="body">{label}</Text>
                  <Switch
                    value={!!security[key]}
                    onValueChange={v => updateSecurity({ [key]: v })}
                    trackColor={{ true: colors.accent, false: colors.glass }}
                    thumbColor={colors.text}
                  />
                </View>
              ) : null
            ))}
          </Card>
        )}
      </ScrollView>
    </Container>
  );
}

export default withAdminGuard(OrgSettingsScreen);
