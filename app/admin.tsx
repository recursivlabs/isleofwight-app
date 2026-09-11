import * as React from 'react';
import { View, ScrollView, Pressable, Platform, TextInput } from 'react-native';
import { showToast } from '../components/Toast';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, Button, Input, Card, Skeleton, Divider, Avatar, PostCard } from '../components';
import { Container } from '../components/Container';
import { ScreenHeader } from '../components/ScreenHeader';
import { TabBar } from '../components/TabBar';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { spacing, radius, typography } from '../constants/theme';
import { useColors } from '../lib/theme';
import { communityDescription, profileFollowerCount, profileFollowingCount, profilePostCount } from '../lib/models';
import { formatApiSuccess, normalizeAdminStats } from '../lib/adminStats';

type Tab = 'dashboard' | 'users' | 'content' | 'reports' | 'communities';

const BUSINESS_AI_AGENT_ID = '411ac3a9-dfbc-4463-8963-2e26a645211e';

function AITab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [messages, setMessages] = React.useState<{ role: 'user' | 'agent'; text: string }[]>([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setSending(true);
    try {
      const res = await sdk.agents.chat(BUSINESS_AI_AGENT_ID, { message: msg });
      const data = res?.data || res;
      const reply = data?.content || data?.message || data?.response || (typeof data === 'string' ? data : 'No response');
      setMessages(prev => [...prev, { role: 'agent', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'agent', text: 'Failed to get response from AI.' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, gap: spacing.md }}>
      <View style={{ flex: 1, gap: spacing.sm }}>
        {messages.length === 0 && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
            <Ionicons name="sparkles" size={32} color={colors.textMuted} />
            <Text variant="body" color={colors.textSecondary} align="center">Minds Business AI</Text>
            <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>
              Ask anything about your network, analytics, or strategy.
            </Text>
          </View>
        )}
        {messages.map((m, i) => (
          <View
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              backgroundColor: m.role === 'user' ? colors.accent : colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              maxWidth: '80%' as any,
              borderWidth: m.role === 'agent' ? 0.5 : 0,
              borderColor: colors.glassBorder,
            }}
          >
            <Text variant="body" color={m.role === 'user' ? colors.textInverse : colors.text}>
              {m.text}
            </Text>
          </View>
        ))}
        {sending && (
          <View style={{ alignSelf: 'flex-start', padding: spacing.md }}>
            <Text variant="caption" color={colors.textMuted}>Thinking...</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          placeholder="Ask the AI..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            color: colors.text,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: input.trim() ? colors.accent : colors.surfaceHover,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="send" size={16} color={input.trim() ? '#fff' : colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.accentMuted : 'transparent',
      }}
    >
      <Text variant="caption" color={active ? colors.accent : colors.textMuted}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  const colors = useColors();
  return (
    <Card style={{ flex: 1, minWidth: 100 }}>
      <Text variant="h2" color={colors.accent}>{value}</Text>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>{label}</Text>
    </Card>
  );
}

function IconStat({ icon, label, value }: { icon: any; label: string; value: number | string }) {
  const colors = useColors();
  return (
    <Card style={{ flexGrow: 1, flexBasis: '46%' as any, minWidth: 130 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
        <Ionicons name={icon} size={15} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>{label}</Text>
      </View>
      <Text variant="h2" color={colors.text}>{value}</Text>
    </Card>
  );
}

// Compact number formatting for big metrics (1.2k, 3.4M).
function fmt(n: number | string | undefined): string {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return String(n ?? '—');
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function DashboardTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [stats, setStats] = React.useState<any>(null);
  const [signups, setSignups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    // Launch metrics are the dashboard's critical path. Load the signup chart
    // independently so a slow or unavailable time-series query never holds the
    // entire dashboard on its loading skeleton.
    sdk.admin.getLaunchStats()
      .then((statsRes: any) => {
        if (cancelled) return;
        const s = statsRes?.data || statsRes || {};
        setStats(normalizeAdminStats(s));
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    sdk.admin.getSignupsByDay(14)
      .then((signupsRes: any) => {
        if (cancelled) return;
        setSignups((signupsRes?.data || []).map((d: any) => ({
          date: d.day || d.date,
          count: d.signups ?? d.count ?? 0,
        })));
      })
      .catch(() => {
        // The chart is supplementary; the launch metrics remain useful alone.
      });

    return () => {
      cancelled = true;
    };
  }, [sdk]);

  if (loading) return <View style={{ gap: spacing.xl }}><Skeleton height={80} /><Skeleton height={120} /></View>;
  if (error) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
      <Ionicons name="bar-chart-outline" size={32} color={colors.textMuted} />
      <Text variant="body" color={colors.textSecondary} align="center">{error}</Text>
      <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>Check your admin permissions or try again later.</Text>
    </View>
  );

  const weekTotal = signups.slice(-7).reduce((a, d) => a + (d.count || 0), 0);
  const peak = Math.max(1, ...signups.map((d) => d.count || 0));
  const apiSuccess = stats ? formatApiSuccess(stats) : '—';

  return (
    <View style={{ gap: spacing.lg }}>
      {/* The number that matters during relaunch is use, not the imported
          account total. Older APIs gracefully retain the previous headline. */}
      <Card style={{ borderColor: colors.accentMuted }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: spacing.lg }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" color={colors.textMuted} style={{ letterSpacing: 1, textTransform: 'uppercase' as any }}>
              {stats?.hasLaunchActivity ? 'Active this week' : 'Total users'}
            </Text>
            <Text style={{ ...typography.hero, color: colors.accent, marginTop: spacing.xs } as any}>
              {fmt(stats?.hasLaunchActivity ? stats.activeWeek : stats?.totalUsers)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
              <Text variant="caption" color={colors.success || colors.accent}>
                {stats?.hasLaunchActivity ? `${fmt(stats.activeToday)} active today` : `↑ ${stats?.newToday ?? 0} today`}
              </Text>
              <Text variant="caption" color={colors.textMuted}>· {stats?.newWeek ?? weekTotal} joined this week</Text>
            </View>
          </View>
          {/* sparkline of recent signups */}
          {signups.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 44 }}>
              {signups.slice(-14).map((d, i) => (
                <View key={String(d.date)} style={{
                  width: 5,
                  height: Math.max(3, Math.round((d.count / peak) * 44)),
                  backgroundColor: i === signups.slice(-14).length - 1 ? colors.accent : colors.accentMuted,
                  borderRadius: 2,
                }} />
              ))}
            </View>
          )}
        </View>
      </Card>

      {/* Stat grid with icons */}
      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
        <IconStat icon="people-circle-outline" label="Total members" value={fmt(stats?.totalUsers)} />
        <IconStat icon="person-add-outline" label="New · 7 days" value={fmt(stats?.newWeek)} />
        <IconStat icon="document-text-outline" label="Posts · 7 days" value={fmt(stats?.postsWeek)} />
        <IconStat icon="chatbubbles-outline" label="Messages · 7 days" value={fmt(stats?.messagesWeek)} />
        {stats?.hasLaunchActivity && (
          <IconStat icon="pulse-outline" label="API success · 24h" value={apiSuccess} />
        )}
        <IconStat icon="people-outline" label="Groups" value={fmt(stats?.communities)} />
        <IconStat icon="ban-outline" label="Banned" value={fmt(stats?.banned)} />
      </View>

      {stats?.hasLaunchActivity && (
        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Past 24 hours</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
            <StatCard label="Active people" value={fmt(stats.activeToday)} />
            <StatCard label="Posts" value={fmt(stats.postsToday)} />
            <StatCard label="Messages" value={fmt(stats.messagesToday)} />
            <StatCard label="API requests" value={fmt(stats.apiRequests)} />
          </View>
        </Card>
      )}

      {/* Signups chart */}
      {signups.length > 0 && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <Text variant="label" color={colors.textMuted}>Signups</Text>
            <Text variant="caption" color={colors.textMuted}>last {signups.length} days</Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            {signups.map((d, i) => (
              <View key={String(d.date)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="caption" color={colors.textMuted} style={{ width: 52, fontSize: 10 }}>
                  {d.date ? new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : `Day ${i + 1}`}
                </Text>
                <View style={{ flex: 1, height: 16, backgroundColor: colors.glass, borderRadius: radius.xs, overflow: 'hidden' }}>
                  <View style={{ height: 16, width: `${Math.round((d.count / peak) * 100)}%` as any, backgroundColor: colors.accent, borderRadius: radius.xs }} />
                </View>
                <Text variant="caption" color={d.count ? colors.accent : colors.textMuted} style={{ width: 26, textAlign: 'right', fontSize: 11 }}>{d.count}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

// Only a status the server actually returned may become a permissions verdict.
// A transport or 5xx failure carries no verdict at all — rendering it as
// "requires admin access" tells an admin mid-outage that they lost their role.
function isAccessDenied(e: any): boolean {
  return e?.status === 401 || e?.status === 403;
}

type ListError = { message: string; retryable: boolean };

function listError(deniedMessage: string, outageMessage: string, ...errors: any[]): ListError {
  return errors.every(isAccessDenied)
    ? { message: deniedMessage, retryable: false }
    : { message: outageMessage, retryable: true };
}

function UsersTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [users, setUsers] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [actionId, setActionId] = React.useState('');
  const [error, setError] = React.useState<ListError | null>(null);
  const [fallback, setFallback] = React.useState(false);

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Admin endpoint returns { data: [...] } — scoped server-side.
      const res = await sdk.admin.listUsers({ search: q || undefined, limit: 50 });
      setUsers(Array.isArray(res) ? res : res?.data || []);
      setFallback(false);
    } catch (adminErr: any) {
      // Fallback to org members
      if (ORG_ID) {
        try {
          const res = await sdk.organizations.members(ORG_ID, { limit: 50 } as any);
          let members = (res.data || []).map((m: any) => m.user || m);
          // The members endpoint has no search parameter. An active query must
          // still mean something here — filter locally rather than presenting
          // 50 unrelated rows as the result of the admin's search.
          const needle = (q || '').trim().toLowerCase();
          if (needle) {
            members = members.filter((u: any) =>
              [u.username, u.name, u.email].some(
                (v: any) => typeof v === 'string' && v.toLowerCase().includes(needle),
              ),
            );
          }
          setUsers(members);
          setFallback(true);
        } catch (memberErr: any) {
          setError(listError(
            'Requires admin access to view users.',
            'Users could not be loaded.',
            adminErr,
            memberErr,
          ));
          setUsers([]);
          setFallback(false);
        }
      } else {
        setError(listError(
          'Requires admin access to view users.',
          'Users could not be loaded.',
          adminErr,
        ));
        setUsers([]);
        setFallback(false);
      }
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const doSearch = () => load(search);

  const banUser = async (id: string) => {
    setActionId(id);
    // SDK wants reason as a STRING, not an object — passing { reason } sent a
    // malformed body and the ban silently failed.
    try { await sdk.admin.banUser(id, 'Admin action'); await load(search); } catch { showToast('Failed to ban user.', 'error'); }
    setActionId('');
  };

  const unbanUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.unbanUser(id); await load(search); } catch { showToast('Failed to unban user.', 'error'); }
    setActionId('');
  };

  const deleteUser = async (id: string) => {
    setActionId(id);
    try { await sdk.admin.deleteUser(id); setUsers(us => us.filter(u => u.id !== id)); } catch { showToast('Failed to delete user.', 'error'); }
    setActionId('');
  };

  const setRole = async (id: string, role: string) => {
    setActionId(id);
    try { await sdk.admin.setUserRole(id, role); await load(search); } catch { showToast('Failed to set role.', 'error'); }
    setActionId('');
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Search users..." />
        </View>
        <Button onPress={doSearch} size="sm">Search</Button>
      </View>
      {/* Rows from the fallback lack the admin fields (ban state, role), so an
          admin acting on them must know they are not looking at the real list. */}
      {!loading && !error && fallback && (
        <Text variant="caption" color={colors.textMuted} align="center">
          The admin user list is unavailable — showing organization members instead. Ban and role details may be incomplete.
        </Text>
      )}
      {loading ? <Skeleton height={200} /> : error ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
          <Ionicons name={error.retryable ? 'cloud-offline-outline' : 'lock-closed-outline'} size={32} color={colors.textMuted} />
          <Text variant="body" color={colors.textMuted} align="center">{error.message}</Text>
          {error.retryable && (
            <Button onPress={() => load(search)} variant="secondary" size="sm">Try again</Button>
          )}
        </View>
      ) : users.length === 0 ? (
        <Text variant="caption" color={colors.textMuted} align="center">No users found.</Text>
      ) : users.map((u: any) => {
        const banned = !!(u.banned_at || u.banned);
        return (
        <Card key={u.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={u.image} name={u.name || u.username} size="md" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyMedium" numberOfLines={1}>{u.name || u.username || 'User'}</Text>
                {u.role === 'admin' && <Text variant="caption" color={colors.accent}>admin</Text>}
                {banned && <Text variant="caption" color={colors.error}>banned</Text>}
              </View>
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {u.username ? `@${u.username}` : ''}{u.email ? ` · ${u.email}` : ''}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {banned ? (
                <Button onPress={() => unbanUser(u.id)} variant="ghost" size="sm" loading={actionId === u.id}>Unban</Button>
              ) : (
                <Button onPress={() => banUser(u.id)} variant="ghost" size="sm" accentColor={colors.error} loading={actionId === u.id}>Ban</Button>
              )}
              {u.role !== 'admin' && (
                <Button onPress={() => setRole(u.id, 'admin')} variant="ghost" size="sm" loading={actionId === u.id}>Make admin</Button>
              )}
              <Pressable onPress={() => deleteUser(u.id)} disabled={actionId === u.id} hitSlop={8} style={{ opacity: actionId === u.id ? 0.4 : 1, padding: spacing.xs }}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          </View>
        </Card>
        );
      })}
    </View>
  );
}

function ContentTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState('');
  const [error, setError] = React.useState<ListError | null>(null);
  const [fallback, setFallback] = React.useState(false);

  const load = React.useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Admin endpoint returns { data: [...] } — scoped server-side.
      const res = await sdk.admin.listPosts({ search: q || undefined, limit: 50 });
      setPosts(Array.isArray(res) ? res : res?.data || []);
      setFallback(false);
    } catch (adminErr: any) {
      // Fallback to org posts
      try {
        const res = await sdk.posts.list({ limit: 50, organization_id: ORG_ID || undefined });
        let rows = res.data || [];
        // The plain listing has no search parameter — honor an active query
        // locally instead of presenting unrelated posts as its results.
        const needle = (q || '').trim().toLowerCase();
        if (needle) {
          rows = rows.filter((p: any) =>
            [p.title, p.content].some(
              (v: any) => typeof v === 'string' && v.toLowerCase().includes(needle),
            ),
          );
        }
        setPosts(rows);
        setFallback(true);
      } catch (postsErr: any) {
        setError(listError(
          'Requires admin access to view content.',
          'Content could not be loaded.',
          adminErr,
          postsErr,
        ));
        setPosts([]);
        setFallback(false);
      }
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const deletePost = async (id: string) => {
    setDeletingId(id);
    try {
      // Try SDK posts.delete first (works for own posts and with proper scope)
      try { await sdk.posts.delete(id); } catch {
        // Fallback to admin endpoint
        await sdk.admin.deletePost(id);
      }
      setPosts(p => p.filter(x => x.id !== id));
    } catch { showToast('Failed to delete post. Check your permissions.', 'error'); }
    setDeletingId('');
  };

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Input value={search} onChangeText={setSearch} placeholder="Search posts..." />
        </View>
        <Button onPress={() => load(search)} size="sm">Search</Button>
      </View>
      {!loading && !error && fallback && (
        <Text variant="caption" color={colors.textMuted} align="center">
          The admin content list is unavailable — showing recent posts instead.
        </Text>
      )}
      {loading ? <Skeleton height={200} /> : error ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
          <Ionicons name={error.retryable ? 'cloud-offline-outline' : 'lock-closed-outline'} size={32} color={colors.textMuted} />
          <Text variant="body" color={colors.textMuted} align="center">{error.message}</Text>
          {error.retryable && (
            <Button onPress={() => load(search)} variant="secondary" size="sm">Try again</Button>
          )}
        </View>
      ) : posts.length === 0 ? (
        <Text variant="caption" color={colors.textMuted} align="center">No posts found.</Text>
      ) : posts.map((p: any) => (
        <Card key={p.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium" numberOfLines={2}>{p.title || p.content?.slice(0, 100) || 'Untitled'}</Text>
              <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                {p.author?.name || 'Unknown'} {(p.created_at || p.createdAt) ? `- ${new Date(p.created_at || p.createdAt).toLocaleDateString()}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => deletePost(p.id)} disabled={deletingId === p.id} hitSlop={8} style={{ opacity: deletingId === p.id ? 0.5 : 1, padding: spacing.sm }}>
              <Ionicons name="trash-outline" size={18} color={colors.error} />
            </Pressable>
          </View>
        </Card>
      ))}
    </View>
  );
}

// Transparent, heuristic risk read on a reported user — the "rap sheet" that
// admins used to assemble by hand. Pure client-side from the profile + the
// loaded report queue; no server scoring needed.
function assessUser(profile: any, reportsAgainst: number) {
  let score = 0;
  const flags: string[] = [];
  const created = profile?.created_at || profile?.createdAt;
  const ageDays = created ? Math.floor((Date.now() - new Date(created).getTime()) / 86_400_000) : null;
  const followers = profileFollowerCount(profile);
  const following = profileFollowingCount(profile);
  const posts = profilePostCount(profile);
  if (reportsAgainst >= 2) { score += 3; flags.push(`${reportsAgainst} open reports`); }
  if (ageDays != null && ageDays < 7) { score += 2; flags.push('account < 1wk old'); }
  if (followers < 3) { score += 1; flags.push('few followers'); }
  if (following > 50 && followers < 5) { score += 2; flags.push('follow-spam pattern'); }
  if (profile?.banned_at || profile?.bannedAt) { score += 5; flags.push('previously banned'); }
  const level = score >= 6 ? 'High' : score >= 3 ? 'Medium' : 'Low';
  return { level, score, flags, ageDays, followers, following, posts };
}

function UserRapSheet({ user, sdk, allReports }: { user: any; sdk: any; allReports: any[] }) {
  const colors = useColors();
  const [profile, setProfile] = React.useState<any>(null);
  React.useEffect(() => {
    let alive = true;
    const handle = user?.username;
    if (handle) {
      sdk.profiles.getByUsername(handle)
        .then((r: any) => { if (alive) setProfile(r?.data || r); })
        .catch(() => { if (user?.id) sdk.profiles.get(user.id).then((r: any) => { if (alive) setProfile(r?.data || r); }).catch(() => {}); });
    }
    return () => { alive = false; };
  }, [user?.username, user?.id]);

  if (!user) return null;
  // Reports in the queue that target this user directly (best-effort rap sheet).
  const reportsAgainst = (allReports || []).filter((r: any) => r.target_type === 'user' && r.target_id === user.id).length;
  const a = assessUser(profile || user, reportsAgainst);
  const riskColor = a.level === 'High' ? colors.error : a.level === 'Medium' ? (colors.warning || colors.accent) : (colors.success || colors.textMuted);

  return (
    <View style={{ gap: 4, padding: spacing.sm, backgroundColor: colors.surfaceRaised, borderRadius: radius.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="label" color={colors.textMuted}>USER SUMMARY</Text>
        <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: radius.full, backgroundColor: `${riskColor}22` }}>
          <Text variant="caption" color={riskColor}>{a.level} risk</Text>
        </View>
      </View>
      <Text variant="caption" color={colors.textSecondary}>
        {a.ageDays != null ? `${a.ageDays}d old` : 'age —'} · {a.followers} followers · {a.following} following · {a.posts} posts
      </Text>
      {a.flags.length > 0 && <Text variant="caption" color={riskColor}>⚑ {a.flags.join(' · ')}</Text>}
    </View>
  );
}

// A fully self-contained moderation card: hydrates the reported post inline (so
// the admin never has to click through), shows who reported it + why, surfaces
// the offending user, and offers the three concrete actions that exist today.
function ReportCard({ report, sdk, onResolved, allReports }: { report: any; sdk: any; onResolved: (id: string, status: string) => void; allReports: any[] }) {
  const colors = useColors();
  const router = useRouter();
  const [post, setPost] = React.useState<any>(null);
  const [reporter, setReporter] = React.useState<any>(null);
  const [loadingPost, setLoadingPost] = React.useState(report.target_type === 'post');
  const [busy, setBusy] = React.useState('');
  const isAppeal = report.target_type === 'moderation_action';
  const appealedAction = report.moderation_action;
  const targetType = report.target_type;
  const targetId = report.target_id;
  const reporterId = report.reporter_id;
  const postsResource = sdk.posts;
  const profilesResource = sdk.profiles;

  React.useEffect(() => {
    let alive = true;
    if (targetType === 'post' && targetId) {
      postsResource.get(targetId)
        .then((r: any) => { if (alive) setPost(r?.data || r); })
        .catch(() => {})
        .finally(() => { if (alive) setLoadingPost(false); });
    }
    if (reporterId && !isAppeal) {
      profilesResource.get(reporterId).then((r: any) => { if (alive) setReporter(r?.data || r); }).catch(() => {});
    }
    return () => { alive = false; };
  }, [isAppeal, postsResource, profilesResource, reporterId, targetId, targetType]);

  // Offending user = the reported user, or (for post reports) the post's author.
  const targetUser = isAppeal ? null : report.target_type === 'user'
    ? { id: report.target_id, username: report.target_username, image: undefined }
    : post?.author;

  const act = async (kind: 'dismiss' | 'remove' | 'ban' | 'uphold' | 'overturn') => {
    setBusy(kind);
    try {
      if (kind === 'dismiss') {
        await sdk.reports.dismiss(report.id);
        showToast('Report dismissed — no action taken.', 'success');
        onResolved(report.id, 'dismissed');
      } else if (kind === 'remove') {
        await sdk.reports.resolve(report.id, { action: 'remove', reason: report.reason || 'Policy violation' });
        showToast('Post removed.', 'success');
        onResolved(report.id, 'resolved');
      } else if (kind === 'ban') {
        if (report.target_type === 'post' && targetUser?.id) {
          await sdk.moderation.apply({
            target_type: 'user',
            target_id: targetUser.id,
            action: 'ban',
            reason: report.reason || 'Policy violation',
            source_report_id: report.id,
          });
          await sdk.reports.resolve(report.id, { action: 'none' });
        } else {
          await sdk.reports.resolve(report.id, { action: 'ban', reason: report.reason || 'Policy violation' });
        }
        showToast(`@${targetUser?.username || 'user'} banned.`, 'success');
        onResolved(report.id, 'resolved');
      } else if (kind === 'uphold' || kind === 'overturn') {
        await sdk.moderation.resolveAppeal(report.id, {
          outcome: kind === 'overturn' ? 'overturned' : 'upheld',
        });
        showToast(kind === 'overturn' ? 'Decision overturned and enforcement reversed.' : 'Decision upheld.', 'success');
        onResolved(report.id, 'resolved');
      }
    } catch {
      const verb = kind === 'ban' ? 'ban user'
        : kind === 'remove' ? 'remove post'
          : kind === 'uphold' ? 'uphold decision'
            : kind === 'overturn' ? 'overturn decision'
              : 'dismiss';
      showToast(`Could not ${verb}.`, 'error');
    }
    setBusy('');
  };

  return (
    <Card key={report.id}>
      <View style={{ gap: spacing.md }}>
        {/* Why it was reported */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="flag" size={15} color={colors.error} />
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{isAppeal ? 'Moderation appeal' : (report.reason || 'Reported')}</Text>
          <Text variant="caption" color={colors.textMuted}>{report.created_at ? new Date(report.created_at).toLocaleDateString() : ''}</Text>
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          {isAppeal
            ? 'The affected person asked for this decision to be reviewed.'
            : `${report.target_type === 'post' ? 'Post' : 'User'} reported${reporter?.username ? ` by @${reporter.username}` : ''}${report.details ? ` — "${report.details}"` : ''}`}
        </Text>

        {/* The reported content, inline — no click-through needed */}
        {isAppeal ? (
          <View style={{ gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surfaceRaised, borderRadius: radius.md }}>
            <Text variant="label" color={colors.textMuted}>ORIGINAL DECISION</Text>
            <Text variant="bodyMedium">
              {appealedAction?.action?.replace(/_/g, ' ') || 'Moderation action'} · {appealedAction?.target_type || 'content'}
            </Text>
            {appealedAction?.reason ? <Text variant="caption" color={colors.textSecondary}>{appealedAction.reason}</Text> : null}
            <Divider />
            <Text variant="label" color={colors.textMuted}>APPEAL</Text>
            <Text variant="body" color={colors.textSecondary}>{report.details || 'No additional context was provided.'}</Text>
          </View>
        ) : report.target_type === 'post' ? (
          loadingPost ? <Skeleton height={120} />
          : post ? (
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }}>
              <PostCard post={post} compact />
            </View>
          ) : <Text variant="caption" color={colors.textMuted}>Post unavailable — it may already be deleted.</Text>
        ) : (
          <Pressable
            onPress={() => targetUser?.username && router.push(`/${targetUser.username}` as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surfaceRaised, borderRadius: radius.md }}
          >
            <Avatar uri={targetUser?.image} name={targetUser?.username} size="md" />
            <Text variant="bodyMedium">@{targetUser?.username || String(report.target_id).slice(0, 8)}</Text>
          </Pressable>
        )}

        {/* The offending user (author of a reported post) */}
        {report.target_type === 'post' && post?.author && (
          <Pressable onPress={() => router.push(`/${post.author.username}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Avatar uri={post.author.image} name={post.author.username} size="xs" />
            <Text variant="caption" color={colors.textSecondary}>Posted by @{post.author.username}</Text>
          </Pressable>
        )}

        {/* Quick risk read on the offending user — the "rap sheet" */}
        {targetUser && <UserRapSheet user={targetUser} sdk={sdk} allReports={allReports} />}

        {/* The three actions that exist today: do nothing / remove post / ban */}
        {isAppeal ? (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs }}>
            <Button onPress={() => act('uphold')} variant="secondary" size="sm" loading={busy === 'uphold'}>Uphold</Button>
            <Button onPress={() => act('overturn')} size="sm" loading={busy === 'overturn'}>Overturn & reverse</Button>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs }}>
            <Button onPress={() => act('dismiss')} variant="ghost" size="sm" loading={busy === 'dismiss'}>Do nothing</Button>
            {report.target_type === 'post' && (
              <Button onPress={() => act('remove')} variant="secondary" size="sm" loading={busy === 'remove'}>Remove post</Button>
            )}
            {targetUser && (
              <Button onPress={() => act('ban')} size="sm" accentColor={colors.error} loading={busy === 'ban'}>Ban user</Button>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}

function ReportsTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const [reports, setReports] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [showResolved, setShowResolved] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await sdk.admin.listReports({ limit: 100 });
      setReports(Array.isArray(res) ? res : res?.data || []);
    } catch {
      setLoadError('The moderation queue could not be loaded.');
    }
    setLoading(false);
  }, [sdk]);
  React.useEffect(() => { load(); }, [load]);

  const onResolved = React.useCallback((id: string, status: string) => {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status } : r));
  }, []);

  if (loading) return <Skeleton height={200} />;
  if (loadError) {
    return (
      <Card>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
          <Ionicons name="warning-outline" size={28} color={colors.error} />
          <Text variant="bodyMedium" color={colors.error}>{loadError}</Text>
          <Button onPress={load} variant="secondary" size="sm">Try again</Button>
        </View>
      </Card>
    );
  }

  const pending = reports.filter(r => (r.status || 'pending') === 'pending');
  const visible = showResolved ? reports : pending;

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" color={colors.textMuted}>{pending.length} open · {reports.length} total</Text>
        <Button onPress={() => setShowResolved(s => !s)} variant="ghost" size="sm">
          {showResolved ? 'Hide resolved' : 'Show all'}
        </Button>
      </View>
      {visible.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="shield-checkmark-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text}>All clear</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
            No open reports. When users report content, it appears here for review.
          </Text>
        </View>
      ) : visible.map((r: any) => (
        (r.status || 'pending') === 'pending'
          ? <ReportCard key={r.id} report={r} sdk={sdk} onResolved={onResolved} allReports={reports} />
          : (
            <Card key={r.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
                <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                  {r.reason || 'Reported'} · {r.target_type}
                </Text>
                <Text variant="caption" color={colors.textMuted}>{r.status}</Text>
              </View>
            </Card>
          )
      ))}
    </View>
  );
}

function CommunitiesTab({ sdk }: { sdk: any }) {
  const colors = useColors();
  const router = useRouter();
  const [communities, setCommunities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await sdk.communities.list({ limit: 100, organization_id: ORG_ID || undefined });
      setCommunities(res.data || []);
    } catch {
      // A failed listing is not an empty network — saying "No communities"
      // here invites the admin to recreate groups that already exist.
      setLoadError(true);
    }
    setLoading(false);
  }, [sdk]);

  React.useEffect(() => { load(); }, [load]);

  const deleteCommunity = async (id: string) => {
    setDeletingId(id);
    try {
      await sdk.communities.delete(id);
      setCommunities(c => c.filter(x => x.id !== id));
    } catch { showToast('Failed to delete community.', 'error'); }
    setDeletingId('');
  };

  if (loading) return <Skeleton height={200} />;
  if (loadError) {
    return (
      <Card>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg }}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.error} />
          <Text variant="bodyMedium" color={colors.error}>Communities could not be loaded.</Text>
          <Button onPress={load} variant="secondary" size="sm">Try again</Button>
        </View>
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" color={colors.textMuted}>{communities.length} communities</Text>
        <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create</Button>
      </View>
      {communities.length === 0 ? (
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text}>No communities</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300 }}>
            Create communities for users to post in.
          </Text>
        </View>
      ) : communities.map((c: any) => (
        <Card key={c.id}>
          <Pressable onPress={() => router.push(`/community/${c.id}` as any)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">{c.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                  <Text variant="caption" color={colors.textMuted}>{c.memberCount || c.member_count || 0} members</Text>
                  <Text variant="caption" color={colors.textMuted}>{c.privacy || 'public'}</Text>
                </View>
                {communityDescription(c) ? <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.xs }}>{communityDescription(c)}</Text> : null}
              </View>
            </View>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md }}>
            <Button onPress={() => router.push(`/community/${c.id}` as any)} variant="ghost" size="sm">View</Button>
            <Button onPress={() => deleteCommunity(c.id)} variant="ghost" size="sm" accentColor={colors.error} loading={deletingId === c.id}>Delete</Button>
          </View>
        </Card>
      ))}
    </View>
  );
}


import { withAdminGuard } from '../lib/guards';

function AdminScreen() {
  const colors = useColors();
  const router = useRouter();
  const { sdk } = useAuth();
  const [tab, setTab] = React.useState<Tab>('dashboard');

  if (!sdk) {
    return (
      <Container safeTop centered>
        <Text variant="body" color={colors.textMuted}>Sign in to access admin.</Text>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <View style={{ backgroundColor: colors.bg, zIndex: 1 }}>
        <ScreenHeader title="Admin" />
        <TabBar
          tabs={(['dashboard', 'users', 'content', 'reports', 'communities'] as const).map(t => ({ key: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
          active={tab}
          onChange={(k) => setTab(k as Tab)}
          scrollable
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, paddingBottom: spacing['5xl'] }}>
        {tab === 'dashboard' && <DashboardTab sdk={sdk} />}
        {tab === 'users' && <UsersTab sdk={sdk} />}
        {tab === 'content' && <ContentTab sdk={sdk} />}
        {tab === 'reports' && <ReportsTab sdk={sdk} />}
        {tab === 'communities' && <CommunitiesTab sdk={sdk} />}
      </ScrollView>
    </Container>
  );
}

export default withAdminGuard(AdminScreen);
