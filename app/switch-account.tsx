import * as React from 'react';
import { View, FlatList, Pressable, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Avatar, Input, Skeleton } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import {
  getSiblingAccounts,
  getArchivedIds,
  archiveAccount,
  unarchiveAccount,
  type SiblingAccount,
} from '../lib/accounts';

// One tappable account row: avatar + @username/name, a "Current" badge, and a
// trailing archive/unarchive button. Matches the SettingRow grammar (tinted
// hairline-separated rows) used across the settings surface.
function AccountRow({
  account,
  isCurrent,
  archived,
  switching,
  onSwitch,
  onArchiveToggle,
}: {
  account: SiblingAccount;
  isCurrent: boolean;
  archived: boolean;
  switching: boolean;
  onSwitch: () => void;
  onArchiveToggle: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        minHeight: 60,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        opacity: archived ? 0.6 : 1,
      }}
    >
      <Pressable
        onPress={onSwitch}
        disabled={isCurrent || switching}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          opacity: pressed && !isCurrent ? 0.6 : 1,
          ...(Platform.OS === 'web' && !isCurrent ? { cursor: 'pointer' } as any : {}),
        })}
      >
        <Avatar uri={account.image} name={account.name || account.username} size="md" />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="bodyMedium" color={colors.text} numberOfLines={1} style={{ flexShrink: 1 }}>
              {account.name || account.username || 'Account'}
            </Text>
            {isCurrent ? (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>Current</Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 1 }}>
            @{account.username}
          </Text>
        </View>
        {switching ? <ActivityIndicator size="small" color={colors.accent} /> : null}
      </Pressable>

      {/* Archive / unarchive the account client-side (hides it from the list). */}
      {!isCurrent ? (
        <Pressable
          onPress={onArchiveToggle}
          hitSlop={8}
          style={({ pressed }) => ({
            opacity: pressed ? 0.5 : 1,
            padding: spacing.xs,
            ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
          })}
          accessibilityLabel={archived ? 'Unarchive account' : 'Archive account'}
        >
          <Ionicons
            name={archived ? 'arrow-undo-outline' : 'archive-outline'}
            size={18}
            color={colors.textMuted}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

// A muted, tappable divider that expands/collapses a group (test accounts,
// archived accounts). Mirrors the "Show all sessions" affordance in Settings.
function GroupToggle({
  label,
  count,
  open,
  onPress,
}: {
  label: string;
  count: number;
  open: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.6 : 1,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.textMuted} />
      <Text
        variant="caption"
        color={colors.textMuted}
        style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontFamily: 'Roboto-Medium' }}
      >
        {label} · {count}
      </Text>
    </Pressable>
  );
}

// Row shapes the FlatList renders. Real accounts render inline; test/archived
// groups get a header row that toggles their visibility.
type ListRow =
  | { kind: 'account'; account: SiblingAccount; archived: boolean }
  | { kind: 'header'; group: 'test' | 'archived'; count: number };

export default function SwitchAccountScreen() {
  const router = useRouter();
  const colors = useColors();
  const toast = useToast();
  const { user, sdk, switchAccount } = useAuth();

  const [accounts, setAccounts] = React.useState<SiblingAccount[]>([]);
  const [archivedIds, setArchivedIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [switchingId, setSwitchingId] = React.useState<string | null>(null);
  const [showTest, setShowTest] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, archived] = await Promise.all([getSiblingAccounts(sdk), getArchivedIds()]);
      setAccounts(list);
      setArchivedIds(archived);
    } catch (e: any) {
      setError(e?.message || 'Could not load your accounts');
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const isCurrent = React.useCallback(
    (a: SiblingAccount) => a.is_current || a.id === user?.id,
    [user?.id],
  );

  const onSwitch = React.useCallback(async (id: string) => {
    if (switchingId) return;
    setSwitchingId(id);
    try {
      await switchAccount(id);
      router.replace('/(tabs)');
    } catch (e: any) {
      toast.show(e?.message || 'Could not switch accounts', 'error');
      setSwitchingId(null);
    }
  }, [switchingId, switchAccount, router, toast]);

  // The list only moves if the write actually landed. Updating state first and
  // ignoring the result showed the account as archived until a reload brought it
  // back — indistinguishable from success at the moment it mattered.
  const onArchive = React.useCallback(async (id: string) => {
    if (!(await archiveAccount(id))) {
      toast.show('Could not archive that account', 'error');
      return;
    }
    setArchivedIds(ids => (ids.includes(id) ? ids : [...ids, id]));
  }, [toast]);

  const onUnarchive = React.useCallback(async (id: string) => {
    if (!(await unarchiveAccount(id))) {
      toast.show('Could not unarchive that account', 'error');
      return;
    }
    setArchivedIds(ids => ids.filter(x => x !== id));
  }, [toast]);

  // Partition into real / test / archived, filtered by the search query.
  // Archived wins over test — an archived test account shows only under Archived.
  const rows = React.useMemo<ListRow[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (a: SiblingAccount) =>
      !q ||
      a.username?.toLowerCase().includes(q) ||
      a.name?.toLowerCase().includes(q);

    const archivedSet = new Set(archivedIds);
    const real: SiblingAccount[] = [];
    const test: SiblingAccount[] = [];
    const archived: SiblingAccount[] = [];

    for (const a of accounts) {
      if (!match(a)) continue;
      if (archivedSet.has(a.id) && !isCurrent(a)) archived.push(a);
      else if (a.looks_like_test && !isCurrent(a)) test.push(a);
      else real.push(a);
    }

    const out: ListRow[] = real.map(a => ({ kind: 'account', account: a, archived: false }));

    if (test.length > 0) {
      out.push({ kind: 'header', group: 'test', count: test.length });
      if (showTest) out.push(...test.map(a => ({ kind: 'account' as const, account: a, archived: false })));
    }
    if (archived.length > 0) {
      out.push({ kind: 'header', group: 'archived', count: archived.length });
      if (showArchived) out.push(...archived.map(a => ({ kind: 'account' as const, account: a, archived: true })));
    }
    return out;
  }, [accounts, archivedIds, query, showTest, showArchived, isCurrent]);

  const renderItem = React.useCallback(({ item }: { item: ListRow }) => {
    if (item.kind === 'header') {
      return item.group === 'test' ? (
        <GroupToggle label="Test / demo accounts" count={item.count} open={showTest} onPress={() => setShowTest(v => !v)} />
      ) : (
        <GroupToggle label="Archived" count={item.count} open={showArchived} onPress={() => setShowArchived(v => !v)} />
      );
    }
    const a = item.account;
    const current = isCurrent(a);
    return (
      <AccountRow
        account={a}
        isCurrent={current}
        archived={item.archived}
        switching={switchingId === a.id}
        onSwitch={() => onSwitch(a.id)}
        onArchiveToggle={() => (item.archived ? onUnarchive(a.id) : onArchive(a.id))}
      />
    );
  }, [showTest, showArchived, switchingId, isCurrent, onSwitch, onArchive, onUnarchive]);

  const keyExtractor = React.useCallback(
    (item: ListRow) => (item.kind === 'header' ? `header:${item.group}` : `account:${item.account.id}`),
    [],
  );

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Switch account" />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search your accounts"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={60} />)}
        </View>
      ) : error ? (
        <View style={{ padding: spacing['3xl'], alignItems: 'center', gap: spacing.md }}>
          <Text variant="body" color={colors.textMuted} align="center">{error}</Text>
          <Pressable onPress={load} style={{ paddingVertical: spacing.sm }}>
            <Text variant="bodyMedium" color={colors.accent}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: spacing['5xl'],
          }}
          style={{ width: '100%', maxWidth: Platform.OS === 'web' ? 600 : undefined, alignSelf: 'center' }}
          ListEmptyComponent={
            <View style={{ padding: spacing['3xl'], alignItems: 'center' }}>
              <Text variant="body" color={colors.textMuted} align="center">
                {query ? 'No accounts match your search.' : 'No other accounts on this email.'}
              </Text>
            </View>
          }
        />
      )}
    </Container>
  );
}
