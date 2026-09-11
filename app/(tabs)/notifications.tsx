import * as React from 'react';
import { View, FlatList, Pressable, Platform, Image, AppState, RefreshControl, Linking } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Text, Avatar, Skeleton, RightRailLayout } from '../../components';
import { ScreenHeader } from '../../components/ScreenHeader';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth';
import { loadSocialPage, markCategoryRead, type NotifCategory } from '../../lib/socialNotifications';
import { captureException } from '../../lib/monitoring';
import { ORG_ID } from '../../lib/recursiv';
import { formatTimestamp } from '../../lib/time';
import { invalidate } from '../../lib/cache';
import { spacing } from '../../constants/theme';
import { useColors } from '../../lib/theme';

// Unified app-wide format (see lib/time): <24h relative, older = date only.
const timeAgo = (dateStr: string) => formatTimestamp(dateStr);

// The Notifications feed is SOCIAL only. Because this account operates agents,
// the dispatcher/orchestration emits task/agent activity ("Working on: …",
// target_type `task_claimed` etc.) into the same notification stream — those must
// never show here. Keep everything that isn't clearly agent/build/task activity.

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk } = useAuth();
  const colors = useColors();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const loadingMoreRef = React.useRef(false);
  // Social is the stream. Builds is the same account's agent and task activity
  // from Minds Build; it stays one tap away instead of burying replies.
  const [category, setCategory] = React.useState<NotifCategory>('social');
  // Cursor into the RAW stream. Paging must advance past operator rows too, or
  // the next request re-fetches the ones we just discarded.
  const cursorRef = React.useRef<string | undefined>(undefined);

  const loadNotifications = React.useCallback(async () => {
      if (!sdk) { setLoading(false); return; }
      try {
        const { items, cursor, hasMore: more } = await loadSocialPage(
          (args) => sdk.notifications.list({ ...args, organization_id: ORG_ID || undefined } as any),
          { want: 20, category },
        );
        cursorRef.current = cursor;
        setNotifications(items);
        setHasMore(more);
      } catch (err) { captureException(err, { where: 'notifications.load', category }); }
      finally { setLoading(false); setLoadedOnce(true); }
  }, [sdk, category]);

  // Endless history, feed-style: page older notifications in by cursor as you
  // scroll (the API paginates on the last row's id).
  const loadMore = React.useCallback(async () => {
    if (!sdk || loadingMoreRef.current || !hasMore || notifications.length === 0) return;
    loadingMoreRef.current = true;
    try {
      const { items, cursor, hasMore: more } = await loadSocialPage(
        (args) => sdk.notifications.list({ ...args, organization_id: ORG_ID || undefined } as any),
        { want: 20, cursor: cursorRef.current, category },
      );
      cursorRef.current = cursor;
      setNotifications(prev => {
        const seen = new Set(prev.map((n: any) => n.id));
        return [...prev, ...items.filter((n: any) => !seen.has(n.id))];
      });
      setHasMore(more);
    } catch (err) { captureException(err, { where: 'notifications.loadMore', category }); }
    finally { loadingMoreRef.current = false; }
  }, [sdk, hasMore, notifications, category]);

  React.useEffect(() => {
    setLoading(true);
    setNotifications([]);
    cursorRef.current = undefined;
    loadNotifications();
  }, [loadNotifications]);

  // Live updates: refetch when a notification lands over the socket, so a new
  // reply/follow/vote shows up here without a manual refresh (X parity).
  // Debounced with per-client jitter: fan-out events (a popular post getting
  // 20 likes, an org announcement) hit every online recipient at the same
  // instant, and an immediate refetch per event turns that into a
  // synchronized request spike proportional to audience size.
  React.useEffect(() => {
    if (!sdk) return;
    let cleanup: (() => void) | undefined;
    let pending: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock) return;
        const onNotif = () => {
          if (pending) return; // burst-coalesce: one refetch per window
          pending = setTimeout(() => {
            pending = null;
            loadNotifications();
          }, 1000 + Math.random() * 2000);
        };
        sock.on('notification', onNotif);
        cleanup = () => sock.off?.('notification', onNotif);
      } catch {}
    })();
    return () => {
      cleanup?.();
      if (pending) clearTimeout(pending);
    };
  }, [sdk, loadNotifications]);

  // Group similar notifications targeting the same post / user within
  // the last 24h so the list reads "Sarah and 2 others reacted" instead
  // of three separate rows. Reduces visual noise and matches what good
  // notification surfaces (Instagram, X) ship.
  const groupedNotifications = React.useMemo(() => {
    // A reply that @mentions you produced BOTH a reply and a mention row for
    // one event (server now suppresses this; this pass cleans history): drop
    // the mention when a reply row exists for the same post by the same actor.
    const replyKeys = new Set(
      notifications
        .filter((n: any) => ((n.targetType || n.target_type) || '').includes('reply'))
        .map((n: any) => `${n.targetId || n.target_id}:${n.actor?.id || ''}`),
    );
    const deduped = notifications.filter((n: any) => {
      const t = ((n.targetType || n.target_type) || '');
      if (!t.includes('mention')) return true;
      return !replyKeys.has(`${n.targetId || n.target_id}:${n.actor?.id || ''}`);
    });
    const buckets = new Map<string, any[]>();
    const result: any[] = [];
    const DAY = 24 * 3600 * 1000;
    for (const n of deduped) {
      const key = `${n.type || ''}-${n.targetType || n.target_type}-${n.targetId || n.target_id}`;
      const ts = new Date(n.createdAt || n.created_at || 0).getTime();
      if (Date.now() - ts < DAY && (n.targetType || n.target_type) && (n.targetId || n.target_id)) {
        const arr = buckets.get(key) || [];
        arr.push(n);
        buckets.set(key, arr);
      } else {
        result.push(n);
      }
    }
    for (const [, arr] of buckets) {
      if (arr.length === 1) {
        result.push(arr[0]);
      } else {
        const newest = arr[0];
        // X-style aggregate: "<Actor> and N others <action>", carrying every
        // member's actor (stacked avatar row) and id (group mark-read).
        const actors = arr
          .map((n: any) => n.actor)
          .filter(Boolean)
          .filter((a: any, i: number, all: any[]) => all.findIndex((b: any) => b.id === a.id) === i);
        const lead = newest.actor?.name || (newest.title || '').split(' ')[0] || 'Someone';
        const action = (newest.title || '').replace(/^.*? (reacted|replied|reposted|followed|mentioned)/, '$1') || 'engaged';
        result.push({
          ...newest,
          _groupedCount: arr.length,
          _groupedIds: arr.map((n: any) => n.id),
          _groupedActors: actors,
          _groupedTitle: `${lead} and ${arr.length - 1} other${arr.length - 1 !== 1 ? 's' : ''} ${action.startsWith(lead) ? 'engaged with your post' : action} `.replace(/ +$/, ''),
        });
      }
    }
    result.sort((a, b) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
    return result;
  }, [notifications]);

  const handlePress = (notif: any) => {
    // Mark as read — the WHOLE aggregate when tapping a grouped row.
    const ids: string[] = notif._groupedIds || (notif.id ? [notif.id] : []);
    if (ids.length && notif.status === 'unread' && sdk) {
      for (const nid of ids) sdk.notifications.markAsRead(nid).catch(() => {});
      invalidate('notifications'); // nudge the tab badge now, not in 60s
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, status: 'read' } : n));
    }

    const url = notif.actionUrl || notif.action_url || '';
    const targetType = notif.targetType || notif.target_type || '';
    const targetId = notif.targetId || notif.target_id || '';

    if (url.includes('/post/') || targetType === 'post') {
      const postId = url.includes('/post/') ? url.split('/post/').pop() : targetId;
      if (postId) router.push(`/post/${postId}` as any);
    } else if (url.includes('/user/') || url.includes('/profile/') || targetType === 'user' || targetType === 'follow') {
      const username = url.includes('/') ? url.split('/').pop() : targetId;
      if (username) router.push(`/${username}` as any);
    } else if (url.includes('/community/') || targetType === 'community') {
      const commId = url.includes('/community/') ? url.split('/community/').pop() : targetId;
      if (commId) router.push(`/community/${commId}` as any);
    } else if (url.includes('/chat') || targetType === 'message' || targetType === 'chat') {
      const chatId = targetId;
      if (chatId) router.push(`/chat/${chatId}` as any);
      else router.push('/(tabs)/chat');
    }
  };

  const markAllRead = async () => {
    if (!sdk) return;
    // Backlog item 23: the optimistic update used to be applied first and the
    // failure swallowed, so a server error left every row showing READ while
    // the server still had them unread — and the next load silently undid it.
    // The user sees their notifications "come back" with no explanation, which
    // is indistinguishable from a bug in the badge.
    //
    // Snapshot first, apply optimistically, roll back and SAY SO on failure.
    const before = notifications;
    setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
    try {
      // Scoped to the tab being looked at: clearing Social must not also clear
      // the operator's unread Builds rows (the server honours ?category=).
      await markCategoryRead(sdk.notifications, category);
      invalidate('notifications'); // nudge the tab badge now, not in 60s
    } catch {
      setNotifications(before);
      showToast('Could not mark all as read. Please try again.', 'error');
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  // X behavior: OPENING the tab clears the badge immediately — no timer, no
  // "mark all read" button. Rows keep their unread tint for this visit so
  // "what's new" stays scannable; only the counter resets.
  useFocusEffect(React.useCallback(() => {
    if (unreadCount > 0 && sdk) {
      // Clear only the tab being looked at. Unscoped, this wiped the Builds
      // tab's unread state the moment the (default) Social tab opened — rows
      // nobody had seen were marked read server-side.
      markCategoryRead(sdk.notifications, category)
        .then(() => invalidate('notifications'))
        .catch(() => {});
    }
    // The tab stays mounted between visits, so without this the list only
    // ever showed its FIRST fetch — new notifications needed an app restart.
    loadNotifications();
    // Home-screen icon badge follows the in-app rule: opening the tab
    // zeroes it (pushes re-set it server-side with the live unread count).
    if (Platform.OS !== 'web') {
      try { require('expo-notifications').setBadgeCountAsync(0); } catch {}
    }
  }, [unreadCount > 0, sdk, category, loadNotifications]));

  // Also refetch when the app returns to foreground while this tab is up —
  // the socket refetch below can't fire for events missed while backgrounded.
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') loadNotifications();
    });
    return () => sub.remove();
  }, [loadNotifications]);

  // Compose the display line from the enriched actor + type. Historical rows
  // were created with "Someone ..." titles when the event lacked the actor's
  // name — the read-time actor enrichment lets us say WHO, always.
  const VERBS: Record<string, string> = {
    post_reaction: 'reacted to your post',
    post_reply: 'replied to you',
    post_mention: 'mentioned you',
    post_repost: 'reminded your post',
    follow: 'followed you',
  };
  const displayLine = (n: any): string => {
    const t = (n.targetType || n.target_type || '') as string;
    const verb = VERBS[t];
    const name = n.actor?.name || n.actor?.username;
    if (name && verb) {
      if (n._groupedCount > 1) return `${name} and ${n._groupedCount - 1} other${n._groupedCount - 1 !== 1 ? 's' : ''} ${verb.replace('you', 'you')}`;
      return `${name} ${verb}`;
    }
    return n._groupedTitle || n.title || 'New notification';
  };

  const getIcon = (type: string): string => {
    const t = (type || '').toLowerCase();
    if (t.includes('mention')) return 'at';
    if (t.includes('reply') || t.includes('comment')) return 'chatbubble';
    if (t.includes('follow')) return 'person-add';
    if (t.includes('repost') || t.includes('reshare')) return 'repeat';
    if (t.includes('like') || t.includes('reaction') || t.includes('vote')) return 'heart';
    if (t.includes('community')) return 'people';
    if (t.includes('message') || t.includes('chat') || t.includes('dm')) return 'mail';
    return 'notifications';
  };

  // X-style type badge (small colored circle overlaid on the actor avatar):
  // a glanceable indicator of WHAT happened, color-coded like X/Instagram.
  const getTypeVisual = (type: string): { icon: string; color: string } => {
    const t = (type || '').toLowerCase();
    if (t.includes('follow')) return { icon: 'person', color: colors.accent };
    if (t.includes('repost') || t.includes('reshare') || t.includes('remind')) return { icon: 'repeat', color: '#00ba7c' };
    if (t.includes('like') || t.includes('reaction') || t.includes('vote') || t.includes('react')) return { icon: 'heart', color: '#f91880' };
    if (t.includes('reply') || t.includes('comment')) return { icon: 'chatbubble', color: colors.accent };
    if (t.includes('mention')) return { icon: 'at', color: colors.accent };
    if (t.includes('message') || t.includes('chat') || t.includes('dm')) return { icon: 'mail', color: colors.accent };
    return { icon: 'notifications', color: colors.accent };
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Header />
      <RightRailLayout context="notifications">
      {/* Root tab — no back chevron (X shows a plain title on tab roots). */}
      <ScreenHeader title="Notifications" showBack={false} />
      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[1, 2, 3, 4, 5].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width="80%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : loadedOnce && notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={34} color={colors.accent} />
          </View>
          <Text variant="h2" color={colors.text} align="center">
            {category === 'system' ? 'Nothing from Minds Build yet' : 'Nothing here yet'}
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 24 }}>
            {category === 'system'
              ? 'Minds Build is where you run your own AI agents. Their updates land here. Pro members get more agents and more runs.'
              : 'Create a post or reply to others to start receiving notifications. Likes, replies, follows, and mentions all show up here.'}
          </Text>
          {category === 'system' ? (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              <Pressable
                onPress={() => { Linking.openURL('https://build.minds.com').catch(() => {}); }}
                accessibilityRole="link"
                accessibilityLabel="Open Minds Build"
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                  paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
                  borderRadius: 999, backgroundColor: colors.accent,
                  opacity: pressed ? 0.85 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="construct-outline" size={17} color={colors.textOnAccent} />
                <Text variant="bodyMedium" color={colors.textOnAccent}>Open Minds Build</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/upgrade' as any)}
                accessibilityRole="link"
                accessibilityLabel="See Plus and Pro"
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                  paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
                  borderRadius: 999, borderWidth: 1, borderColor: colors.borderSubtle,
                  opacity: pressed ? 0.7 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="star-outline" size={17} color={colors.text} />
                <Text variant="bodyMedium" color={colors.text}>See Plus &amp; Pro</Text>
              </Pressable>
            </View>
          ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
            <Pressable
              onPress={() => router.push('/(tabs)/create')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
                borderRadius: 999, backgroundColor: colors.accent,
                opacity: pressed ? 0.85 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="create-outline" size={17} color={colors.textOnAccent} />
              <Text variant="bodyMedium" color={colors.textOnAccent}>Create a post</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/discover')}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
                borderRadius: 999, borderWidth: 1, borderColor: colors.borderSubtle,
                opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="compass-outline" size={17} color={colors.text} />
              <Text variant="bodyMedium" color={colors.text}>Find people</Text>
            </Pressable>
          </View>
          )}
        </View>
      ) : (
        <FlatList
          data={groupedNotifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const t = (item.targetType || item.target_type || '').toLowerCase();
            // Visual hierarchy: high-signal alerts (mentions, replies,
            // agent-sourced, DMs) get full padding + emphasis; low-signal
            // (likes/reactions) collapse to a slimmer row.
            const highSignal = t.includes('mention') || t.includes('reply') || t.includes('comment') || t.includes('message') || t.includes('dm');

            // Swipe-left → dismiss. Optimistic UI: remove from list
            // immediately, mark-as-read on the server in the background
            // (best-effort).
            const renderRightAction = () => (
              <View style={{
                width: 80,
                backgroundColor: colors.error || '#ef4444',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="close-circle" size={22} color="#fff" />
              </View>
            );
            const handleDismiss = () => {
              setNotifications(prev => prev.filter(n => n.id !== item.id));
              if (sdk && item.id && item.status === 'unread') {
                sdk.notifications.markAsRead(item.id).catch(() => {});
              }
            };
            const notificationAccessibilityLabel = `${[
              `Open notification: ${displayLine(item)}`,
              item.post_preview?.excerpt?.trim()
                ? item.post_preview.excerpt.trim().slice(0, 180)
                : null,
              item.status === 'unread' ? 'Unread' : 'Read',
              timeAgo(item.createdAt || item.created_at || new Date().toISOString()),
            ].filter(Boolean).join('. ')}.`;

            return (
            <Swipeable
              renderRightActions={renderRightAction}
              onSwipeableRightOpen={handleDismiss}
              overshootRight={false}
            >
            <Pressable
              onPress={() => handlePress(item)}
              accessibilityRole="button"
              accessibilityLabel={notificationAccessibilityLabel}
              accessibilityHint="Opens the related item"
              style={({ pressed }) => ({
                flexDirection: 'row',
                gap: spacing.md,
                paddingHorizontal: spacing.xl,
                paddingVertical: highSignal ? spacing.lg : spacing.md + 2,
                backgroundColor: pressed ? colors.surfaceHover
                  : item.status === 'unread' ? colors.accentSubtle : 'transparent',
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
              })}
            >
              {highSignal ? (
                // ── Reply / mention / DM: X renders these as post-like cells —
                // actor avatar, bold name + time, their words, then a subtle
                // quote of the post they engaged with.
                <>
                  <Avatar uri={item.actor?.image || item.imageUrl || item.image_url} name={item.actor?.name || item.title} size="md" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* Header: who + what + when — the scan line. */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 14, flexShrink: 1 }}>
                        {displayLine(item)}
                      </Text>
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                        {timeAgo(item.createdAt || item.created_at || new Date().toISOString())}
                      </Text>
                      {item.status === 'unread' && (
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                      )}
                    </View>
                    {/* THE CONTENT: their reply / the mentioning post, full body
                        size — this is what tells you whether it's worth the tap. */}
                    {item.post_preview?.excerpt ? (
                      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: 3, alignItems: 'flex-start' }}>
                        <Text variant="body" numberOfLines={3} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
                          {item.post_preview.excerpt}
                        </Text>
                        {item.post_preview.media_url ? (
                          <Image source={{ uri: item.post_preview.media_url }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                        ) : null}
                      </View>
                    ) : (
                      <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>
                        Tap to view
                      </Text>
                    )}
                  </View>
                </>
              ) : (
                // ── Engagement (reactions / reposts / follows): X anatomy —
                // colored type glyph column, stacked engaging-user avatars,
                // aggregate line, muted hint of the referenced post, media thumb.
                <>
                  {(() => {
                    const tv = getTypeVisual(item.targetType || item.target_type);
                    return (
                      <View style={{ width: 32, alignItems: 'center', paddingTop: 2 }}>
                        <Ionicons name={tv.icon as any} size={26} color={tv.color} />
                      </View>
                    );
                  })()}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {(() => {
                      const actors = (item._groupedActors?.length
                        ? item._groupedActors
                        : item.actor ? [item.actor] : []).slice(0, 6);
                      if (actors.length === 0) return null;
                      return (
                        <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
                          {actors.map((a: any, i: number) => (
                            <View key={a.id || i} style={{ marginLeft: i === 0 ? 0 : -8, borderWidth: 2, borderColor: colors.bg, borderRadius: 999 }}>
                              <Avatar uri={a.image} name={a.name} size="xs" />
                            </View>
                          ))}
                          {item._groupedCount > 6 && (
                            <View style={{ marginLeft: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                              <Text variant="caption" style={{ fontSize: 9, fontWeight: '700' }}>+{item._groupedCount - 6}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })()}
                    <Text variant="body" numberOfLines={2} style={{ fontSize: 14 }}>
                      {displayLine(item)}
                    </Text>
                    {item.post_preview?.excerpt ? (
                      <Text variant="caption" color={colors.textMuted} numberOfLines={2} style={{ marginTop: 2 }}>
                        {item.post_preview.excerpt}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
                    <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                      {timeAgo(item.createdAt || item.created_at || new Date().toISOString())}
                    </Text>
                    {item.post_preview?.media_url ? (
                      <Image source={{ uri: item.post_preview.media_url }} style={{ width: 40, height: 40, borderRadius: 6 }} />
                    ) : null}
                    {item.status === 'unread' && (
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
                    )}
                  </View>
                </>
              )}
            </Pressable>
            </Swipeable>
            );
          }}
          ListEmptyComponent={null}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try { await loadNotifications(); } finally { setRefreshing(false); }
              }}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
        />
      )}
      </RightRailLayout>
    </View>
  );
}

// #187: contain a crash to this screen so the tab bar and navigation survive.
// expo-router renders this instead of the route when it throws.
export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
