import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Alert, TextInput, Share, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Container, Text, Avatar, Button, RightRailLayout } from '../../../components';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth';
import { useColors } from '../../../lib/theme';
import { spacing, radius } from '../../../constants/theme';
import { groupAdmin, roleRank, roleLabel, canRunGroup } from '../../../lib/groupAdmin';
import { uploadMediaBlob } from '../../../lib/mediaUpload';
import { buildReferralLink } from '../../../lib/referral';
import { invalidatePrefix } from '../../../lib/cache';

const getImagePicker = () => (Platform.OS !== 'web' ? require('expo-image-picker') : null);

/**
 * Running a group. One screen for the people who own or moderate it:
 * the group's name, description, privacy, banner and avatar; join requests;
 * members and their roles; bans; and an invite link.
 *
 * Who sees what follows the server's ladder: owner > admin > moderator.
 * A moderator sees requests and can remove or ban members below them; an
 * admin approves requests, changes roles and lifts bans; the owner makes
 * admins and can delete the group.
 */
export default function ManageCommunityScreen() {
  const { id, pictureUploadFailed } = useLocalSearchParams<{ id: string; pictureUploadFailed?: string }>();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();

  const [community, setCommunity] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [members, setMembers] = React.useState<any[]>([]);
  const [requests, setRequests] = React.useState<any[]>([]);
  const [bannedMembers, setBannedMembers] = React.useState<any[]>([]);
  const [membersUnavailable, setMembersUnavailable] = React.useState(false);
  const [requestsUnavailable, setRequestsUnavailable] = React.useState(false);
  const [bansUnavailable, setBansUnavailable] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const viewerRole: string | null = community?.viewer_role ?? (community?.created_by?.id === user?.id ? 'owner' : null);
  const myRank = roleRank(viewerRole);
  const isOwner = viewerRole === 'owner';
  const isAdmin = myRank >= 2;

  const admin = React.useMemo(() => {
    try { return sdk ? groupAdmin(sdk) : null; } catch { return null; }
  }, [sdk]);

  const load = React.useCallback(async () => {
    if (!sdk || !id) return;
    setLoading(true);
    setLoadError(false);
    setMembersUnavailable(false);
    setRequestsUnavailable(false);
    setBansUnavailable(false);
    try {
      const res = await sdk.communities.get(id);
      const c: any = res.data;
      setCommunity(c);
      setName(c?.name || '');
      setDescription(c?.description || '');
      const role = c?.viewer_role ?? (c?.created_by?.id === user?.id ? 'owner' : null);
      if (canRunGroup(role) && admin) {
        const [m, r, b] = await Promise.all([
          admin.members(id, { limit: 100 }),
          admin.requests(id, { limit: 100 }),
          roleRank(role) >= 2
            ? admin.bans(id, { limit: 100 })
            : Promise.resolve({ data: [] }),
        ].map((request) => request.then(
          (value: any) => ({ ok: true as const, value }),
          () => ({ ok: false as const }),
        )));
        if (m.ok) setMembers(m.value?.data || []);
        else {
          setMembers([]);
          setMembersUnavailable(true);
        }
        if (r.ok) setRequests(r.value?.data || []);
        else {
          setRequests([]);
          setRequestsUnavailable(true);
        }
        if (b.ok) setBannedMembers(b.value?.data || []);
        else {
          setBannedMembers([]);
          setBansUnavailable(true);
        }
      }
    } catch {
      // Do not turn a transport/server failure into a permissions verdict.
      // Keep any previously loaded management data visible and let the owner
      // retry; a successful response with no management role still reaches the
      // real access-denied state below.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sdk, id, user?.id, admin]);

  React.useEffect(() => { load(); }, [load]);

  const confirm = (title: string, message: string, onYes: () => void, destructive = false) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) onYes();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: title, style: destructive ? 'destructive' : 'default', onPress: onYes },
    ]);
  };

  type Admin = ReturnType<typeof groupAdmin>;
  const act = async (key: string, fn: (a: Admin) => Promise<any>, done: string) => {
    if (!admin || !community?.id) return;
    setBusy(key);
    try {
      await fn(admin);
      showToast(done);
      invalidatePrefix(`community:${community.id}`);
      invalidatePrefix(`community-posts:${community.id}`);
      await load();
      return true;
    } catch (e: any) {
      showToast(e?.message || 'That did not work', 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = () => act('save', async (a) => {
    await a.update(community.id, { name: name.trim(), description: description.trim() });
  }, 'Saved');

  const setPrivacy = (privacy: 'public' | 'private') => act('privacy', async (a) => {
    await a.update(community.id, { privacy });
  }, privacy === 'public' ? 'The group is public' : 'The group is private');

  // One picker for both pictures: the full image, uploaded as is. The banner
  // renders at 3:1 and the avatar in a circle, so a square works for both.
  const pickAndUpload = async (field: 'banner' | 'image') => {
    if (!sdk || !admin || !community?.id) return;
    const toBlob = async (): Promise<{ blob: Blob; type: string } | null> => {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({ mediaTypes: picker.MediaTypeOptions.Images, quality: 0.9 });
        if (result.canceled || !result.assets?.[0]) return null;
        const res = await fetch(result.assets[0].uri);
        const blob = await res.blob();
        return { blob, type: blob.type || 'image/jpeg' };
      }
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          resolve(file ? { blob: file, type: file.type || 'image/jpeg' } : null);
        };
        input.click();
      });
    };
    try {
      const picked = await toBlob();
      if (!picked) return;
      setBusy(field);
      const url = await uploadMediaBlob({ sdk: sdk as any, blob: picked.blob, contentType: picked.type, onError: (message) => showToast(message, 'error') });
      if (!url) throw new Error('The picture could not be uploaded');
      await admin.update(community.id, { [field]: url });
      showToast(field === 'banner' ? 'Banner updated' : 'Group picture updated');
      if (field === 'image' && pictureUploadFailed === '1') {
        router.setParams({ pictureUploadFailed: undefined });
      }
      invalidatePrefix(`community:${community.id}`);
      await load();
    } catch (e: any) {
      showToast(e?.message || 'The picture could not be uploaded', 'error');
    } finally {
      setBusy(null);
    }
  };

  const makeInvite = async () => {
    if (!admin || !community?.id) return;
    setBusy('invite');
    try {
      const res = await admin.createInvite(community.id, { role: 'member' });
      const link = buildReferralLink(res?.data?.code);
      setInviteLink(link);
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(link);
        showToast('Invite link copied');
      } else {
        await Share.share({ title: `Join ${community.name} on Isle of Wight`, message: `Join ${community.name} on Isle of Wight: ${link}`, url: link });
      }
    } catch (e: any) {
      showToast(e?.message || 'Could not make an invite link', 'error');
    } finally {
      setBusy(null);
    }
  };

  const deleteGroup = () => confirm('Delete group', 'This removes the group and everything in it. There is no undo.', async () => {
    const deleted = await act('delete', async (a) => { await a.remove(community.id); }, 'Group deleted');
    if (deleted) router.replace('/groups' as any);
  }, true);

  const memberActions = (m: any) => {
    const targetRank = roleRank(m.role);
    const items: { label: string; onPress: () => void; danger?: boolean }[] = [];
    if (m.id === user?.id || m.role === 'owner') return items;
    if (isAdmin && targetRank < myRank) {
      if (m.role !== 'moderator') items.push({ label: 'Make moderator', onPress: () => act(`role:${m.id}`, (a) => a.setRole(community.id, m.id, 'moderator'), `${m.name || m.username} is a moderator`) });
      if (isOwner && m.role !== 'admin') items.push({ label: 'Make admin', onPress: () => act(`role:${m.id}`, (a) => a.setRole(community.id, m.id, 'admin'), `${m.name || m.username} is an admin`) });
      if (m.role !== 'member') items.push({ label: 'Remove role', onPress: () => act(`role:${m.id}`, (a) => a.setRole(community.id, m.id, 'member'), `${m.name || m.username} is a member`) });
    }
    if (targetRank < myRank) {
      items.push({ label: 'Remove from group', danger: true, onPress: () => confirm('Remove from group', `${m.name || m.username} can join again later.`, () => act(`remove:${m.id}`, (a) => a.removeMember(community.id, m.id), 'Removed'), true) });
      items.push({ label: 'Ban', danger: true, onPress: () => confirm('Ban', `${m.name || m.username} cannot join again until an admin lifts the ban.`, () => act(`ban:${m.id}`, (a) => a.ban(community.id, m.id), 'Banned'), true) });
    }
    return items;
  };

  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  if (loading) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Manage group" />
        <View style={{ padding: spacing['3xl'], alignItems: 'center' }}><ActivityIndicator color={colors.accent} /></View>
      </Container>
    );
  }
  if (loadError && !community) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Manage group" />
        <View style={{ padding: spacing['3xl'], gap: spacing.md, alignItems: 'center' }}>
          <Text variant="h2">Couldn't load group management</Text>
          <Text variant="body" color={colors.textMuted} align="center">
            Minds could not reach this group's management data. Check your connection and try again.
          </Text>
          <Button onPress={load} variant="secondary" size="sm">Retry</Button>
        </View>
      </Container>
    );
  }
  if (!community || !canRunGroup(viewerRole)) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Manage group" />
        <View style={{ padding: spacing['3xl'], gap: spacing.md, alignItems: 'center' }}>
          <Text variant="h2">Only the people who run this group can open this page</Text>
          <Button onPress={() => router.back()} variant="secondary" size="sm">Back</Button>
        </View>
      </Container>
    );
  }

  const field = {
    backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
  };
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={{ gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
      <Text variant="label" color={colors.textMuted}>{title}</Text>
      {children}
    </View>
  );

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title={`Manage ${community.name}`} />
      <RightRailLayout context="community">
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {(loadError || membersUnavailable || requestsUnavailable || bansUnavailable) && (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              marginBottom: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.errorMuted,
            }}
          >
            <Ionicons name="cloud-offline-outline" size={18} color={colors.error} />
            <Text variant="body" color={colors.error} style={{ flex: 1 }}>
              Some group management data could not be loaded.
            </Text>
            <Button onPress={load} variant="secondary" size="sm">Retry</Button>
          </View>
        )}
        {pictureUploadFailed === '1' && (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              padding: spacing.md,
              marginBottom: spacing.md,
              borderRadius: radius.md,
              backgroundColor: colors.errorMuted,
            }}
          >
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text variant="body" color={colors.error} style={{ flex: 1 }}>
              Your group was created, but its picture could not be added. Choose the group picture below to try again.
            </Text>
          </View>
        )}
        <Section title="Look">
          <Pressable onPress={() => pickAndUpload('banner')} accessibilityRole="button" accessibilityLabel="Change the banner"
            style={{ aspectRatio: 3, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            {community.banner ? <Image source={{ uri: community.banner }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
            <View style={{ position: 'absolute', bottom: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Ionicons name="image-outline" size={14} color="#fff" />
              <Text variant="caption" color="#fff">{busy === 'banner' ? 'Uploading' : community.banner ? 'Change banner' : 'Add a banner'}</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => pickAndUpload('image')} accessibilityRole="button" accessibilityLabel="Change the group picture" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={community.image} name={community.name} size="lg" />
            <Text variant="body" color={colors.accent}>{busy === 'image' ? 'Uploading' : 'Change group picture'}</Text>
          </Pressable>
        </Section>

        <Section title="About">
          <TextInput placeholder="Group name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} style={field} />
          <TextInput placeholder="What this group is for" placeholderTextColor={colors.textMuted} value={description} onChangeText={setDescription} multiline style={{ ...field, minHeight: 90, textAlignVertical: 'top' }} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button onPress={saveDetails} size="sm" loading={busy === 'save'} disabled={!name.trim()}>Save</Button>
          </View>
        </Section>

        <Section title="Who can join">
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {(['public', 'private'] as const).map((p) => {
              const active = community.privacy === p;
              return (
                <Pressable key={p} onPress={() => !active && isAdmin && setPrivacy(p)} accessibilityRole="radio" accessibilityState={{ selected: active }}
                  style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.accent : colors.border, backgroundColor: active ? colors.accentSubtle : 'transparent', opacity: isAdmin ? 1 : 0.6 }}>
                  <Text variant="bodyMedium" color={active ? colors.accent : colors.textSecondary}>{p === 'public' ? 'Anyone' : 'Approved people'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="caption" color={colors.textMuted}>
            {community.privacy === 'public' ? 'Anyone on Isle of Wight can join and see the posts.' : 'People ask to join. Admins approve them, and only members see the posts.'}
          </Text>
        </Section>

        <Section title="Invite">
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button onPress={makeInvite} size="sm" loading={busy === 'invite'} variant="secondary">
              {Platform.OS === 'web' ? 'Copy invite link' : 'Share invite link'}
            </Button>
            {inviteLink ? <Text variant="caption" color={colors.textMuted} selectable>{inviteLink}</Text> : null}
          </View>
          <Text variant="caption" color={colors.textMuted}>Anyone with the link joins as a member{community.privacy === 'private' ? ', with no approval step' : ''}.</Text>
        </Section>

        {requestsUnavailable && (
          <Section title="Waiting to join">
            <Text variant="caption" color={colors.error}>Join requests are unavailable.</Text>
          </Section>
        )}

        {!requestsUnavailable && requests.length > 0 && (
          <Section title={`Waiting to join (${requests.length})`}>
            {requests.map((r) => (
              <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar uri={r.image} name={r.name} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>{r.name || r.username}</Text>
                  {r.username ? <Text variant="caption" color={colors.textMuted}>@{r.username}</Text> : null}
                </View>
                {isAdmin ? (
                  <>
                    <Button size="sm" loading={busy === `approve:${r.id}`} onPress={() => act(`approve:${r.id}`, (a) => a.approve(community.id, r.id), `${r.name || r.username} joined`)}>Approve</Button>
                    <Button size="sm" variant="ghost" loading={busy === `decline:${r.id}`} onPress={() => act(`decline:${r.id}`, (a) => a.decline(community.id, r.id), 'Declined')}>Decline</Button>
                  </>
                ) : <Text variant="caption" color={colors.textMuted}>Admins approve</Text>}
              </View>
            ))}
          </Section>
        )}

        {isAdmin && bansUnavailable && (
          <Section title="Banned people">
            <Text variant="caption" color={colors.error}>Banned people are unavailable.</Text>
          </Section>
        )}

        {isAdmin && !bansUnavailable && bannedMembers.length > 0 && (
          <Section title={`Banned people (${bannedMembers.length})`}>
            {bannedMembers.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar uri={m.image} name={m.name} size="sm" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodyMedium" numberOfLines={1}>{m.name || m.username}</Text>
                  <Text variant="caption" color={colors.textMuted} numberOfLines={2}>
                    {m.banned_reason || (m.username ? `@${m.username}` : 'Banned from this group')}
                  </Text>
                </View>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === `unban:${m.id}`}
                  onPress={() => confirm(
                    'Lift ban',
                    `${m.name || m.username} will rejoin the group and its group chat.`,
                    () => act(`unban:${m.id}`, (a) => a.unban(community.id, m.id), 'Ban lifted'),
                  )}
                >
                  Lift ban
                </Button>
              </View>
            ))}
          </Section>
        )}

        <Section title={`Members (${(community.member_count || members.length || 0).toLocaleString()})`}>
          {membersUnavailable ? (
            <Text variant="caption" color={colors.error}>Members are unavailable.</Text>
          ) : members.map((m) => {
            const items = memberActions(m);
            const open = openMenu === m.id;
            return (
              <View key={m.id} style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Pressable onPress={() => router.push(`/${m.username || m.id}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Avatar uri={m.image} name={m.name} size="sm" />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>{m.name || m.username}</Text>
                        {roleLabel(m.role) ? (
                          <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.accentSubtle }}>
                            <Text variant="caption" color={colors.accent}>{roleLabel(m.role)}</Text>
                          </View>
                        ) : null}
                      </View>
                      {m.username ? <Text variant="caption" color={colors.textMuted}>@{m.username}</Text> : null}
                    </View>
                  </Pressable>
                  {items.length > 0 && (
                    <Pressable onPress={() => setOpenMenu(open ? null : m.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Actions for ${m.name || m.username}`} style={{ padding: spacing.xs }}>
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
                {open && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingLeft: 44 }}>
                    {items.map((it) => (
                      <Pressable key={it.label} onPress={() => { setOpenMenu(null); it.onPress(); }} style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: it.danger ? colors.error : colors.border }}>
                        <Text variant="caption" color={it.danger ? colors.error : colors.text}>{it.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          {!membersUnavailable && members.length === 0 ? <Text variant="caption" color={colors.textMuted}>No members loaded.</Text> : null}
        </Section>

        {isOwner && (
          <Section title="Danger">
            <Button onPress={deleteGroup} variant="ghost" size="sm" accentColor={colors.error} loading={busy === 'delete'}>Delete group</Button>
          </Section>
        )}
      </ScrollView>
      </RightRailLayout>
    </Container>
  );
}
