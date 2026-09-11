import * as React from 'react';
import { View, FlatList, Pressable, TextInput, Platform, useWindowDimensions, StyleSheet, ActivityIndicator } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { KeyboardAvoid } from '../../components/KeyboardAvoid';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Text, Avatar, Skeleton, ChatBubble, Button, Badge, getBadges } from '../../components';
import { MessageActions } from '../../components/MessageActions';
import { ChatSettingsSheet } from '../../components/ChatSettingsSheet';
import { NewChatModal } from '../../components/NewChatModal';
import { formatTimestamp, formatDayLabel, isNewDay } from '../../lib/time';
import { useVoiceRecorder, type VoiceRecording } from '../../lib/useVoiceRecorder';
import { uploadMediaBlob } from '../../lib/mediaUpload';
import { showToast } from '../../components/Toast';
import * as Clipboard from 'expo-clipboard';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useConversations } from '../../lib/hooks';
import { haptics } from '../../lib/haptics';
import {
  getPreference,
  isConversationMuted,
  toggleConversationMuteConfirmed,
  isConversationArchived,
  archiveConversationConfirmed,
  isForcedUnread,
  setForcedUnreadConfirmed,
} from '../../lib/preferences';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { getCached, setCache, invalidate } from '../../lib/cache';
import { useSetActiveConvoId } from '../../lib/activeConvo';
import { ThinkingPill } from '../../components/ThinkingPill';
import { ensureIntroDM } from '../../lib/agentIntro';
import { captureException } from '../../lib/monitoring';
import { connectRealtime } from '../../lib/realtime';
import { conversationUnreadCount, isAiActor } from '../../lib/models';
import { stripMarkdown } from '../../lib/text';
import { resolvePersonalAgent } from '../../lib/resolvePersonalAgent';
import { publishLocalChat } from '../../lib/chatEvents';
import { sortThread, isOptimisticRow } from '../../lib/chatOrdering';
import { normalizeChatMessage, normalizeChatMessagePage, resolveChatMessageQuote } from '../../lib/chatMessages';
import { useInputKeyboardProps } from '../../lib/theme';
import { useKeyboardVisible } from '../../lib/useKeyboardVisible';
import { blockUser } from '../../lib/moderation';
import {
  belongsInChatInbox,
  conversationRecipient,
  conversationRequestStatus,
  hasNewPersistedUserTurn,
  resolveUniqueUserContentPersistence,
  runPreparedChatDelivery,
  uniqueContentRetryDecision,
  type ConversationRecipient,
} from '../../lib/chatRequests';
import {
  beginChatVoiceAttempt,
  beginChatVoiceStart,
  endChatVoiceAttempt,
  endChatVoiceStart,
  getChatComposerSessionEpoch,
  getChatComposerSessionVersion,
  getChatDraft,
  getPendingChatVoiceNote,
  removePendingChatVoiceNote,
  savePendingChatVoiceNote,
  subscribeChatComposerSession,
  updateChatDraft,
  updatePendingChatVoiceNote,
  type PendingChatVoiceNote,
} from '../../lib/chatComposerSession';
import { otpSignInPath } from '../../lib/authRedirect';
import { chatConversationHref, usesWideChatPane } from '../../lib/chatNavigation';
import {
  persistConversationDeletion,
  persistChatReaction,
  reportConversationSpam,
  setOwnChatReactionPresence,
} from '../../lib/chatActions';

type ChatInboxView = 'primary' | 'requests';
type PreparedChatSend = {
  conversationId: string;
  userId: string;
  sdkIdentity: any;
  recipient: ConversationRecipient;
  agentBaselineMessageIds?: ReadonlySet<string> | null;
};
type ReadyChatSend = {
  tempId: string;
  replyId?: string;
};
type ChatSendOutcome = 'confirmed' | 'not-started' | 'unknown';
type ChatMediaOperation = Pick<PreparedChatSend, 'conversationId' | 'userId' | 'sdkIdentity'> & {
  token: symbol;
};
type VoiceRecordingOrigin = {
  conversationId: string;
  userId: string;
  sdkIdentity: any;
  sessionEpoch: number;
};

// Swipe quick-actions on chat list rows (iMessage-grade list hygiene).
// Swipe LEFT → read/unread toggle. Swipe RIGHT → Mute | Archive | Delete;
// archive/delete morph into an in-row confirm with a "+ Report spam" option,
// and always remove the row instantly on confirm.
function SwipeableConvoRow({ children, unread, muted, onToggleRead, onMute, onArchive, onDelete, onReportSpam }: {
  children: React.ReactElement;
  unread: number;
  muted: boolean;
  onToggleRead: () => void | Promise<void>;
  onMute: () => void | Promise<void>;
  onArchive: () => void | Promise<void>;
  onDelete: () => void;
  onReportSpam: () => Promise<boolean>;
}) {
  const colors = useColors();
  const swipeRef = React.useRef<any>(null);
  const [confirm, setConfirm] = React.useState<null | 'archive' | 'delete'>(null);
  const [reporting, setReporting] = React.useState(false);
  const close = React.useCallback(() => { swipeRef.current?.close(); setConfirm(null); }, []);
  if (Platform.OS === 'web') return children;

  const Btn = ({ icon, label, bg, fg, onPress, width = 76, disabled = false }: any) => (
    <Pressable disabled={disabled} onPress={onPress} style={{ width, alignItems: 'center', justifyContent: 'center', backgroundColor: bg, gap: 3, opacity: disabled ? 0.65 : 1 }}>
      <Ionicons name={icon} size={20} color={fg} />
      <Text variant="caption" color={fg} style={{ fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  const leftActions = () => confirm ? (
    <View style={{ flexDirection: 'row' }}>
      <Btn icon="close" label="Cancel" bg={colors.surfaceHover} fg={colors.text} onPress={close} />
      <Btn
        icon={confirm === 'delete' ? 'trash' : 'archive'}
        label={confirm === 'delete' ? 'Delete' : 'Archive'}
        bg={confirm === 'delete' ? colors.error : colors.surfaceRaised}
        fg={confirm === 'delete' ? '#fff' : colors.text}
        onPress={() => { void (confirm === 'delete' ? onDelete : onArchive)(); close(); }}
      />
      <Btn
        icon="alert-circle"
        label={reporting ? 'Reporting…' : '+ Spam'}
        bg="#7a2020"
        fg="#fff"
        width={84}
        disabled={reporting}
        onPress={async () => {
          if (reporting) return;
          setReporting(true);
          let reported = false;
          try {
            reported = await onReportSpam();
          } finally {
            setReporting(false);
          }
          // A failed report must leave the row available to retry. Previously
          // the conversation vanished regardless, making failure look exactly
          // like success and removing the only in-context report action.
          if (reported) (confirm === 'delete' ? onDelete : onArchive)();
          close();
        }}
      />
    </View>
  ) : (
    <View style={{ flexDirection: 'row' }}>
      <Btn icon={muted ? 'notifications' : 'notifications-off'} label={muted ? 'Unmute' : 'Mute'}
        bg={colors.surfaceHover} fg={colors.text} onPress={() => { void onMute(); close(); }} />
      <Btn icon="archive-outline" label="Archive" bg={colors.surfaceRaised} fg={colors.text}
        onPress={() => setConfirm('archive')} />
      <Btn icon="trash-outline" label="Delete" bg={colors.error} fg="#fff"
        onPress={() => setConfirm('delete')} />
    </View>
  );

  const rightActions = () => (
    <Btn
      icon={unread > 0 ? 'mail-open-outline' : 'mail-unread-outline'}
      label={unread > 0 ? 'Read' : 'Unread'}
      bg={colors.accent} fg={colors.textOnAccent}
      onPress={() => { void onToggleRead(); close(); }}
      width={86}
    />
  );

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      renderLeftActions={leftActions}
      renderRightActions={rightActions}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableClose={() => setConfirm(null)}
      friction={1.6}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

export default function ChatScreen() {
  const { user, isLoading } = useAuth();

  // Chat is private. A signed-out deep link previously mounted the full inbox,
  // left its conversation hook in a permanent loading state, and exposed inert
  // "New message" controls. Gate before the chat tree mounts so visitors enter
  // the existing OTP flow and return to Chat after authentication.
  if (isLoading) return null;
  if (!user) return <Redirect href={otpSignInPath('/chat') as any} />;

  return <AuthenticatedChatScreen />;
}

function AuthenticatedChatScreen() {
  const { sdk, user } = useAuth();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; focused?: string; userId?: string }>();
  const { width } = useWindowDimensions();
  const { conversations, loading, refresh } = useConversations();
  // Two-pane (list + open thread, X/iMessage-style) only on wide web. `focused`
  // is set when you deep-link a thread from the sidebar inbox — that inbox WAS
  // the list, so a second list column is redundant; show the thread full-bleed.
  const isWide = usesWideChatPane({ platform: Platform.OS, width });
  const focusedMode = !!params.focused && !!params.id;
  const [activeConvoId, setActiveConvoId] = React.useState<string | null>(params.id || null);
  const [showNewChat, setShowNewChat] = React.useState(false);
  const [convoSearch, setConvoSearch] = React.useState('');
  const [inboxView, setInboxView] = React.useState<ChatInboxView>('primary');
  // Conversations opened this session → their list unread badge clears
  // immediately (the open thread also marks read server-side; this bridges the
  // gap until the refetch, so a thread you're actively in never shows unread).
  const [readConvos, setReadConvos] = React.useState<Set<string>>(new Set());
  // Swipe quick-actions state. Archived/deleted rows vanish INSTANTLY —
  // easy to clean the list out — and archive/mute/forced-unread persist
  // device-side via preferences.
  const [, bumpSwipe] = React.useReducer((x: number) => x + 1, 0);
  const removedIdsRef = React.useRef<Set<string>>(new Set());
  const archiveAndRemove = React.useCallback(async (id: string) => {
    if (!(await archiveConversationConfirmed(id))) {
      showToast('Conversation not archived. Try again.', 'error');
      return;
    }
    removedIdsRef.current.add(id);
    haptics.success();
    bumpSwipe();
  }, []);
  const deleteAndRemove = React.useCallback(async (id: string) => {
    const result = await persistConversationDeletion({
      sdk: sdk as any,
      conversationId: id,
    });
    if (!result.ok) {
      captureException(result.error, { action: 'chat-delete-conversation', conversationId: id });
      showToast('Conversation not deleted. Try again.', 'error');
      return false;
    }

    removedIdsRef.current.add(id);
    haptics.success();
    bumpSwipe();
    showToast('Conversation deleted', 'success');
    return true;
  }, [sdk]);
  const reportConvoSpam = React.useCallback(async (item: any) => {
    const reported = await reportConversationSpam({
      sdk: sdk as any,
      conversation: item,
      currentUserId: user?.id,
    });
    showToast(reported ? 'Spam report sent' : 'Could not report spam', reported ? 'success' : 'error');
    return reported;
  }, [sdk, user?.id]);
  const toggleReadState = React.useCallback(async (id: string, currentlyUnread: boolean) => {
    if (currentlyUnread) {
      // Marking ONE thread read used to call notifications.markAllAsRead(),
      // which clears the user's ENTIRE notification state server-side —
      // mentions, replies, everything, from a swipe on a single conversation.
      // The per-conversation endpoint exists (POST /chat/conversations/:id/read,
      // sdk.chat.markAsRead) and takes the last message read, so use it and
      // leave the rest of the user's notifications alone.
      const convo: any = conversations.find((c: any) => c.id === id);
      const lastMsg = convo?.lastMessage || convo?.last_message;
      const lastMsgId = lastMsg?.id;
      if (lastMsgId) {
        try {
          await sdk?.chat?.markAsRead?.(id, { message_id: lastMsgId });
        } catch {
          showToast('Conversation not marked read. Try again.', 'error');
          return;
        }
      }
      if (!(await setForcedUnreadConfirmed(id, false))) {
        showToast('Conversation read state was not saved. Try again.', 'error');
        return;
      }
      setReadConvos(prev => new Set(prev).add(id));
    } else {
      if (!(await setForcedUnreadConfirmed(id, true))) {
        showToast('Conversation unread state was not saved. Try again.', 'error');
        return;
      }
      setReadConvos(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
    haptics.select();
    bumpSwipe();
    // `conversations` is read above to find the last message id, so it MUST
    // be a dependency — with [sdk] alone this callback would close over
    // whatever list existed when sdk last changed and mark a stale message
    // read. Same shape as the sign-out bug fixed in #301 and as #190.
  }, [sdk, conversations]);
  const openConvo = React.useCallback((id: string) => {
    setReadConvos((prev) => prev.has(id) ? prev : new Set(prev).add(id));
    // Native (and narrow web): the thread is a PUSHED stack screen — the
    // bottom bar disappears (X hides it in DMs too) and back is a native
    // pop/edge-swipe. Wide web keeps the X-style 2-pane in place.
    if (isWide) {
      setActiveConvoId(id);
    } else {
      router.push(chatConversationHref(id, {}, { platform: Platform.OS, width }) as any);
    }
  }, [isWide, router, width]);
  const profileDmStartedRef = React.useRef<string | null>(null);

  // A signed-out visitor can start from a public profile's Message button.
  // After OTP, preserve that intent by creating/reusing the direct conversation
  // and opening it once. The user id is public profile context; it is removed
  // from the URL as soon as the canonical conversation id is available.
  React.useEffect(() => {
    const userId = params.userId;
    if (!sdk || !userId || profileDmStartedRef.current === userId) return;

    profileDmStartedRef.current = userId;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.chat.dm({
          user_id: userId,
          organization_id: ORG_ID || undefined,
        } as any);
        const conversationId = res.data?.id;
        if (!conversationId) throw new Error('Direct message did not return a conversation');
        if (cancelled) return;
        if (isWide) setActiveConvoId(conversationId);
        router.replace(chatConversationHref(
          conversationId,
          { focused: '1' },
          { platform: Platform.OS, width },
        ) as any);
      } catch {
        if (cancelled) return;
        profileDmStartedRef.current = null;
        showToast('Could not start chat', 'error');
      }
    })();

    return () => { cancelled = true; };
  }, [isWide, params.userId, router, sdk, width]);

  const requestCount = React.useMemo(
    () => (conversations || []).filter((conversation: any) => (
      conversationRequestStatus(conversation) === 'pending'
    )).length,
    [conversations],
  );
  const inboxConversations = React.useMemo(
    () => (conversations || []).filter((conversation: any) => (
      belongsInChatInbox(conversation, inboxView)
    )),
    [conversations, inboxView],
  );

  // Open conversation from route params.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeConvoId is read only as a redundant-write guard and must NOT be a dependency. This effect reacts to the ROUTE changing; depending on the selection would re-open the route's conversation every time you picked a different one locally.
  React.useEffect(() => {
    if (params.id && params.id !== activeConvoId) {
      setActiveConvoId(params.id);
    }
  }, [params.id]);

  // Any active conversation counts as locally read (deep-link or selection).
  React.useEffect(() => {
    if (activeConvoId) setReadConvos((p) => p.has(activeConvoId) ? p : new Set(p).add(activeConvoId));
  }, [activeConvoId]);

  // Conversation-list live updates. The active-conversation view already
  // subscribes to realtime for its own messages, but the LIST view used
  // to be poll-only — so previews / unread badges didn't move until you
  // pulled to refresh. Subscribe globally here so every incoming message
  // bumps the list immediately.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      try {
        await connectRealtime(sdk);
        if (cancelled) return;
        let lastRefresh = 0;
        unsub = sdk.realtime.onMessage(() => {
          // Re-fetch the conversations list so previews + unread counts move.
          // Throttle to once / 1.5s: a busy thread fires many messages, and we
          // don't want one refetch per message hammering the list endpoint.
          const now = Date.now();
          if (now - lastRefresh < 1500) return;
          lastRefresh = now;
          refresh();
        });
      } catch {
        // Realtime unavailable; fall back to refresh-on-focus behavior.
      }
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [sdk]);

  // Returning from a thread must show fresh previews/order. Agent replies
  // arrive over the SSE stream (no WS fan-out), so the socket listener above
  // never fires for them — without a focus refetch the list froze at whatever
  // it showed before you opened the thread.
  useFocusEffect(React.useCallback(() => {
    invalidate('conversations');
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  // Back-fill DM with the user's personal agent IF one already exists.
  // Do NOT silently auto-create one — provisioning a personal agent is
  // now an explicit opt-in step via /agent setup. Auto-creating here
  // produced ghost agents named "Minds" right after signup before the
  // user had ever gone through setup. Skip if AI is off in Settings.
  React.useEffect(() => {
    if (!sdk) return;
    if (!getPreference('aiEnabled')) return;
    let cancelled = false;
    (async () => {
      try {
        const personal = await resolvePersonalAgent(sdk);
        if (!personal || cancelled) return;
        // Open the DM AND post the intro if the thread is empty.
        // Covers accounts whose original /agent setup swallowed the
        // sendAsAgent failure, so Samson's thread is still blank.
        await ensureIntroDM(sdk, personal.id, user?.name);
        if (cancelled) return;
        invalidate('conversations');
        refresh();
      } catch (err) {
        console.warn('[chat back-fill] failed', err);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk]);

  // Unread count for a conversation at open time — feeds the thread's
  // "unread messages" divider + scroll-to-last-read. 0 once locally read.
  const unreadFor = React.useCallback((cid: string | null) => {
    if (!cid || readConvos.has(cid)) return 0;
    const conv = (conversations || []).find((c: any) => c.id === cid);
    return conv ? conversationUnreadCount(conv) : 0;
  }, [conversations, readConvos]);

  // Full-bleed single thread when deep-linked from the sidebar inbox
  // (focusedMode), or on mobile/narrow where a 2-pane layout doesn't fit. On
  // wide web without `focused`, fall through to the 2-pane list+thread below.
  if (activeConvoId && (focusedMode || !isWide)) {
    return (
      <ConversationView
        conversationId={activeConvoId}
        initialUnread={unreadFor(activeConvoId)}
        initialRequestStatus={conversationRequestStatus(
          (conversations || []).find((conversation: any) => conversation.id === activeConvoId),
        )}
        onBack={() => {
          // From a sidebar deep-link, "back" opens the full 2-pane list; on
          // mobile it just returns to the list in place.
          if (focusedMode) router.push('/(tabs)/chat' as any);
          setActiveConvoId(null);
          refresh();
        }}
      />
    );
  }

  const listBody = (
    <>
      {showNewChat ? (
        <NewChatModal visible onClose={() => setShowNewChat(false)} />
      ) : null}
      <Header />
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Text variant="h3">Messages</Text>
        <Pressable
          onPress={() => setShowNewChat(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="New message"
        >
          <Ionicons name="create-outline" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {/* Search / filter the conversation list */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        {/* Fixed 38px row — TextInput vertical padding renders inconsistently
            on native and made the field look oddly tall. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, height: 38 }}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            placeholder="Search messages"
            placeholderTextColor={colors.textMuted}
            value={convoSearch}
            onChangeText={setConvoSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            {...kbProps}
            style={{ flex: 1, height: '100%', color: colors.text, ...typography.input, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
          />
          {convoSearch ? (
            <Pressable onPress={() => setConvoSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm }}>
          {(['primary', 'requests'] as ChatInboxView[]).map((view) => {
            const selected = inboxView === view;
            const label = view === 'primary' ? 'Primary' : 'Requests';
            return (
              <Pressable
                key={view}
                onPress={() => setInboxView(view)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  backgroundColor: selected ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Text variant="caption" color={selected ? colors.accent : colors.textMuted} style={{ fontWeight: '700' }}>
                  {label}
                </Text>
                {view === 'requests' && requestCount > 0 ? (
                  <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised }}>
                    <Text variant="caption" color={colors.text} style={{ fontSize: 10, fontWeight: '700' }}>{requestCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          {[1, 2, 3].map(i => (
            <View key={i} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Skeleton width={48} height={48} borderRadius={24} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width={140} height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : inboxConversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name={inboxView === 'requests' ? 'shield-checkmark-outline' : 'chatbubbles-outline'} size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">
            {inboxView === 'requests' ? 'No message requests' : 'Messages'}
          </Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {inboxView === 'requests'
              ? 'Messages from people you do not follow will appear here.'
              : 'Start a conversation with someone on the island.'}
          </Text>
          {inboxView === 'primary' ? (
            <>
              <Text variant="caption" color={colors.textMuted}>
                Direct messages and group chats
              </Text>
              <Button onPress={() => setShowNewChat(true)} size="sm" style={{ marginTop: spacing.md }}>
                Start a conversation
              </Button>
            </>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={inboxConversations.filter((c: any) => {
            // Swipe-archived / just-removed rows stay gone.
            if (removedIdsRef.current.has(c.id) || isConversationArchived(c.id)) return false;
            // Match the SideNav orphan filter: skip one-on-ones with
            // no resolvable other participant (ghost-agent leftovers).
            const participants: any[] = c.participants || c.members || [];
            const others = participants.filter((p: any) => (p?.id ?? p?.userId) && (p?.id ?? p?.userId) !== user?.id);
            const type = c.type || (others.length <= 1 ? 'one_on_one' : 'group');
            if (type === 'one_on_one' && others.length === 0) return false;
            // Filter by the search box (matches the resolved DM/group name).
            if (convoSearch.trim()) {
              const om = participants.find((p: any) => (p?.user?.id ?? p?.id ?? p?.userId) !== user?.id);
              const nm = (c.name || om?.user?.name || om?.name || om?.user?.username || om?.username || '').toLowerCase();
              if (!nm.includes(convoSearch.trim().toLowerCase())) return false;
            }
            return true;
          })}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            // Participants nest the real user under `.user` (id/name/image live
            // there). Match on the nested id too — otherwise a participant whose
            // top-level id is undefined can match the current user, picking the
            // wrong "other" and showing no avatar.
            // The conversations API returns `members` (flat {id,image}); older
            // shapes use `participants`. Read either, else no "other" resolves
            // and the avatar/name fall back to nothing.
            const members = item.participants || item.members || [];
            const other = members.find((p: any) => (p?.user?.id ?? p?.id ?? p?.userId) !== user?.id) || members[0];
            const ou = other?.user || other || {};
            const name = item.name || ou.name || other?.name || ou.username || other?.username || 'Conversation';
            const avatar = ou.image || other?.image || ou.avatar || other?.avatar || ou.profile?.image || item.image || item.avatar || null;
            const isAgentConvo = isAiActor(ou) || isAiActor(other);
            const lastMsg = item.lastMessage || item.last_message;
            const lastText = stripMarkdown(lastMsg?.content || lastMsg?.text || '');
            const time = lastMsg?.createdAt || lastMsg?.created_at || item.updatedAt || '';
            const forced = isForcedUnread(item.id);
            const unread = forced
              ? Math.max(1, conversationUnreadCount(item))
              : readConvos.has(item.id) ? 0 : conversationUnreadCount(item);
            const muted = isConversationMuted(item.id);
            const conversationAccessibilityLabel = `${[
              `Open conversation with ${name}`,
              unread > 0
                ? `${unread} unread ${unread === 1 ? 'message' : 'messages'}`
                : 'No unread messages',
              muted ? 'Muted' : null,
              lastText ? `Last message: ${lastText.slice(0, 160)}` : 'No messages yet',
              time ? formatTimestamp(time) : null,
            ].filter(Boolean).join('. ')}.`;

            return (
              <SwipeableConvoRow
                unread={unread}
                muted={muted}
                onToggleRead={() => toggleReadState(item.id, unread > 0)}
                onMute={async () => {
                  const result = await toggleConversationMuteConfirmed(item.id);
                  if (!result.persisted) {
                    showToast('Conversation mute was not saved. Try again.', 'error');
                    return;
                  }
                  bumpSwipe();
                }}
                onArchive={() => archiveAndRemove(item.id)}
                onDelete={() => deleteAndRemove(item.id)}
                onReportSpam={() => reportConvoSpam(item)}
              >
              <Pressable
                onPress={() => openConvo(item.id)}
                accessibilityRole="button"
                accessibilityLabel={conversationAccessibilityLabel}
                accessibilityHint="Opens this conversation"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.lg,
                  // In the 2-pane view, highlight the thread you're actively
                  // viewing with a soft background tint only — no hard accent
                  // bar, so the list stays clean and borderless.
                  // Opaque default (not transparent): swipe actions render
                  // BEHIND the row, and a transparent row lets them bleed through.
                  backgroundColor: (isWide && item.id === activeConvoId)
                    ? colors.accentSubtle
                    : pressed ? colors.surfaceHover : colors.bg,
                })}
              >
                <Avatar uri={avatar} name={name} size="lg" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Text>
                      {getBadges(ou).map((b) => <Badge key={b} type={b} size="sm" />)}
                    </View>
                    {time ? (
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                        {formatTimestamp(time)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                      {lastText || 'No messages yet'}
                    </Text>
                    {muted ? (
                      // Muted: no attention-grabbing accent badge — a quiet bell
                      // glyph, and an unread count only as a subdued pill.
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="notifications-off-outline" size={14} color={colors.textMuted} />
                        {unread > 0 && (
                          <View style={{ backgroundColor: colors.surfaceHover, borderRadius: radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11, fontWeight: '700' }}>{unread}</Text>
                          </View>
                        )}
                      </View>
                    ) : unread > 0 ? (
                      <View
                        style={{
                          backgroundColor: colors.accent,
                          borderRadius: radius.full,
                          minWidth: 20,
                          height: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: 6,
                        }}
                      >
                        <Text variant="caption" color={colors.textOnAccent} style={{ fontSize: 11, fontWeight: '700' }}>{unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
              </SwipeableConvoRow>
            );
          }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        />
      )}
    </>
  );

  // Wide web: two-pane layout — conversation list on the left, the open thread
  // (or a prompt to pick one) on the right. Selecting a row just swaps the right
  // pane, so the list stays put (no navigation, X/iMessage feel).
  if (isWide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
        <View style={{ width: 360, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.borderSubtle, backgroundColor: colors.bg }}>
          <Container safeTop padded={false} style={{ flex: 1 }}>{listBody}</Container>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          {activeConvoId ? (
            <ConversationView
              conversationId={activeConvoId}
              initialUnread={unreadFor(activeConvoId)}
              initialRequestStatus={conversationRequestStatus(
                (conversations || []).find((conversation: any) => conversation.id === activeConvoId),
              )}
              onBack={() => { setActiveConvoId(null); refresh(); }}
              hideBack
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing.md, backgroundColor: colors.bg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
                <Ionicons name="chatbubbles-outline" size={30} color={colors.accent} />
              </View>
              <Text variant="h3" color={colors.text} align="center">Your messages</Text>
              <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 280, lineHeight: 20 }}>
                Select a conversation from the list, or start a new one.
              </Text>
              <Button onPress={() => { setShowNewChat(true); }} size="sm" style={{ marginTop: spacing.md }}>
                New message
              </Button>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <Container safeTop padded={false}>{listBody}</Container>
  );
}

export function ConversationView({
  conversationId,
  onBack,
  hideBack,
  initialUnread = 0,
  initialRequestStatus = 'accepted',
}: {
  conversationId: string;
  onBack: () => void;
  hideBack?: boolean;
  initialUnread?: number;
  initialRequestStatus?: 'accepted' | 'pending' | 'declined';
}) {
  const insets = useSafeAreaInsets();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();
  const keyboardVisible = useKeyboardVisible();
  const setActiveConvoId = useSetActiveConvoId();
  // Track focus. Two things hang off it: (1) marking this conversation active so
  // the SideNav suppresses its unread dot only for the thread you're reading, and
  // (2) gating mark-as-read below. Expo-router keeps tab screens mounted, so an
  // unmount-based cleanup never fired on a tab switch — focus/blur is the correct
  // signal for "am I actually looking at this thread right now."
  const [screenFocused, setScreenFocused] = React.useState(true);
  useFocusEffect(
    React.useCallback(() => {
      setScreenFocused(true);
      setActiveConvoId(conversationId);
      return () => { setScreenFocused(false); setActiveConvoId(null); };
    }, [conversationId, setActiveConvoId])
  );
  const cachedMsgs = getCached(`messages:${conversationId}`);
  const cachedSorted = React.useMemo(() => {
    return normalizeChatMessagePage(cachedMsgs);
  }, [cachedMsgs]);
  const [messages, setMessages] = React.useState<any[]>(cachedSorted);
  // Tap-and-hold message actions + reply state.
  const [actionMsg, setActionMsg] = React.useState<any>(null);
  const [actionPos, setActionPos] = React.useState<{ x: number; y: number } | null>(null);
  const reactionAttemptsRef = React.useRef(new Map<string, symbol>());
  const openActions = React.useCallback((m: any, pos?: { x: number; y: number }) => { setActionMsg(m); setActionPos(pos || null); }, []);
  const [replyingToState, setReplyingToState] = React.useState<{
    conversationId: string;
    message: any;
  } | null>(null);
  const replyingTo = replyingToState?.conversationId === conversationId
    ? replyingToState.message
    : null;
  // Toggle a reaction optimistically, but never leave an unsaved reaction on
  // screen. A per-message/emoji attempt token prevents an older failed request
  // from rolling back a newer tap, and the rollback touches only this user's
  // selected emoji so concurrent reactions from other people survive.
  const handleReact = React.useCallback((msg: any, emoji: string) => {
    if (!sdk || !user?.id || !msg?.id || String(msg.id).startsWith('temp-')) return;
    const reactions: any[] = msg.reactions || [];
    const previousReaction = reactions.find(
      reaction =>
        (reaction.type || reaction.emoji) === emoji &&
        (reaction.user_id ?? reaction.userId) === user.id,
    );
    const shouldBePresent = !previousReaction;
    const attemptKey = `${msg.id}:${emoji}`;
    const attempt = Symbol(attemptKey);
    reactionAttemptsRef.current.set(attemptKey, attempt);

    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      return {
        ...m,
        reactions: setOwnChatReactionPresence({
          reactions: m.reactions || [],
          emoji,
          userId: user.id,
          userName: user.name,
          present: shouldBePresent,
        }),
      };
    }));

    void persistChatReaction({ sdk: sdk as any, messageId: msg.id, emoji }).then(result => {
      if (reactionAttemptsRef.current.get(attemptKey) !== attempt) return;
      reactionAttemptsRef.current.delete(attemptKey);
      if (result.ok) return;

      setMessages(prev => prev.map(m => {
        if (m.id !== msg.id) return m;
        return {
          ...m,
          reactions: setOwnChatReactionPresence({
            reactions: m.reactions || [],
            emoji,
            userId: user.id,
            userName: user.name,
            present: !!previousReaction,
            reaction: previousReaction,
          }),
        };
      }));
      captureException(result.error, { action: 'chat-reaction', messageId: msg.id, emoji });
      showToast('Reaction not saved. Try again.', 'error');
    });
  }, [sdk, user?.id, user?.name]);
  const handleCopyMsg = React.useCallback((msg: any) => {
    Clipboard.setStringAsync(String(msg?.content || msg?.text || '')).catch(() => {});
  }, []);
  // Resolve the quoted message for a reply, from the loaded thread.
  const resolveQuoted = React.useCallback((m: any) => {
    return resolveChatMessageQuote(m, messages, user?.id);
  }, [messages, user?.id]);
  const [loading, setLoading] = React.useState(cachedSorted.length === 0);
  // A failed history fetch is an outage statement, not a brand-new thread.
  // Rendering "Start the conversation" over an unreachable history tells a
  // user their messages are gone — the wallet/boost dishonest-empty class.
  const [initialLoadFailed, setInitialLoadFailed] = React.useState(false);
  const [initialLoadNonce, setInitialLoadNonce] = React.useState(0);
  const retryInitialLoad = React.useCallback(() => {
    setInitialLoadFailed(false);
    // Only fall back to the skeleton when there is nothing on screen; a
    // thread already showing live-arrived messages reloads in place.
    if (messageIdsRef.current.size === 0) setLoading(true);
    setInitialLoadNonce(n => n + 1);
  }, []);
  // Text and stopped voice notes belong to an exact account + conversation.
  // The external session store survives native thread unmounts and returns B's
  // empty composer synchronously when wide web switches away from A.
  React.useSyncExternalStore(
    subscribeChatComposerSession,
    getChatComposerSessionVersion,
    getChatComposerSessionVersion,
  );
  const composerUserId = user?.id || null;
  const text = getChatDraft(composerUserId, conversationId);
  const setText = React.useCallback((update: React.SetStateAction<string>) => {
    updateChatDraft(composerUserId, conversationId, update);
  }, [composerUserId, conversationId]);
  const [sending, setSending] = React.useState(false);
  const [attaching, setAttaching] = React.useState(false);
  const voiceOriginRef = React.useRef<VoiceRecordingOrigin | null>(null);
  const saveVoiceRecording = React.useCallback((
    recording: VoiceRecording,
    origin: VoiceRecordingOrigin | null,
  ): PendingChatVoiceNote | null => {
    if (!origin || recording.durationMs < 700) return null;
    const note: PendingChatVoiceNote = {
      id: `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: origin.conversationId,
      userId: origin.userId,
      sessionEpoch: origin.sessionEpoch,
      recording,
    };
    return savePendingChatVoiceNote(note) ? note : null;
  }, []);
  const saveInterruptedVoice = React.useCallback((recording: VoiceRecording) => {
    const origin = voiceOriginRef.current;
    voiceOriginRef.current = null;
    saveVoiceRecording(recording, origin);
  }, [saveVoiceRecording]);
  const voice = useVoiceRecorder({ onInterrupted: saveInterruptedVoice });
  // A stopped note survives navigation within this app session, but is visible
  // in the exact account/thread that owns it. Raw private audio is not written
  // to general app storage.
  const pendingVoiceNote = getPendingChatVoiceNote(composerUserId, conversationId);
  // Prompt handed in via route params by the "Ask my agent" button / command
  // palette. We send it from HERE (via handleSend → agents.chatStream), not
  // from askAgent(), because that path used chat.send which only inserts the
  // message and never triggers the agent (no reply, not visible until refresh).
  const routeParams = useLocalSearchParams<{ id?: string; prompt?: string }>();
  const router = useRouter();
  const autoSentPromptRef = React.useRef<string | null>(null);
  const routePromptOwnerRef = React.useRef<{
    prompt: string;
    routeId: string | null;
    conversationId: string;
    userId: string | null;
    sdkIdentity: any;
    sessionEpoch: number;
    wasActive: boolean;
    cancelled: boolean;
  } | null>(null);
  const composerSessionEpoch = getChatComposerSessionEpoch();
  const [agentTyping, setAgentTyping] = React.useState(false);
  const [agentStatus, setAgentStatus] = React.useState<'thinking' | 'generating' | 'done' | null>(null);
  // True while a local stream is revealing text on screen — server
  // agent_thinking events must not re-raise the pill over streaming text.
  const streamRevealingRef = React.useRef(false);
  // ONE WRITER AT A TIME. While an agent turn is
  // active — from send until the post-turn reconcile — the stream owns the
  // thread and every other writer (WS echoes, polls) is ignored outright.
  // When the turn ends, ONE authoritative refetch replaces optimistic rows
  // with server truth. Between turns: server truth. During turns: stream
  // truth. No merging, no echo adoption, no three-writer races — the old
  // echo-adoption path could capture YOUR OWN message's server echo and
  // re-insert it at the end of the thread as a "reply".
  const generationActiveRef = React.useRef(false);
  const [humanTyping, setHumanTyping] = React.useState<{ userId: string; userName: string } | null>(null);
  const flatListRef = React.useRef<FlatList>(null);
  // Newest-first copy for the inverted FlatList (render origin = latest row).
  const invertedMessages = React.useMemo(() => [...messages].reverse(), [messages]);

  // Scroll-to-last-read: place an "Unread messages" divider before the first
  // unread message and land the view there on open, instead of jamming you to
  // the very bottom. The unread messages are the last `initialUnread` messages
  // from OTHER members (own messages are always read). Computed once per open.
  const [unreadAnchorId, setUnreadAnchorId] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const anchorComputedRef = React.useRef(false);
  React.useEffect(() => { anchorComputedRef.current = false; setUnreadAnchorId(null); }, [conversationId]);
  React.useEffect(() => {
    if (anchorComputedRef.current || !messages.length) return;
    anchorComputedRef.current = true;
    const n = Math.min(initialUnread, messages.length);
    if (n <= 0) return;
    const myId = user?.id;
    let count = 0;
    let anchorIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const sid = messages[i].sender?.id || messages[i].senderId || messages[i].sender_id;
      if (sid && sid !== myId) { count++; if (count >= n) { anchorIdx = i; break; } }
    }
    // Only worth a divider/scroll if we're not already essentially at the top.
    if (anchorIdx <= 0) return;
    setUnreadAnchorId(messages[anchorIdx].id);
    // Position at the unread boundary (inverted index), divider near the
    // visual top like Signal. atBottomRef=false so incoming rows don't yank.
    atBottomRef.current = false;
    const invIdx = messages.length - 1 - anchorIdx;
    requestAnimationFrame(() => {
      try { flatListRef.current?.scrollToIndex({ index: invIdx, animated: false, viewPosition: 0.75 }); } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, initialUnread, conversationId]);
  // Throttle outbound chat_typing events. Fires every 3s while the
  // user is actively typing, not on every keystroke (which would
  // hammer the WS and the other side's UI).
  const lastTypingEmitRef = React.useRef(0);
  // Try to get partner info from cached conversation list for instant name
  const cachedConvo = React.useMemo(() => {
    const convos = getCached('conversations') || [];
    return convos.find((c: any) => c.id === conversationId);
  }, [conversationId]);
  const cachedRecipient = React.useMemo(
    () => conversationRecipient(cachedConvo, user?.id),
    [cachedConvo, user?.id],
  );
  const cachedOther = cachedRecipient?.raw || null;
  const [partnerName, setPartnerName] = React.useState<string>(
    cachedConvo?.name || cachedRecipient?.name || 'Conversation'
  );
  const [partnerInfo, setPartnerInfo] = React.useState<any>(cachedOther || null);
  // A recipient is valid only for the conversation id it was resolved from.
  // ConversationView intentionally survives thread switches, so a bare
  // partnerInfo ref can otherwise route a new send to the previous thread's
  // participant while the new detail request is still in flight.
  const activeConversationIdRef = React.useRef(conversationId);
  activeConversationIdRef.current = conversationId;
  const activeSdkRef = React.useRef(sdk);
  activeSdkRef.current = sdk;
  const activeUserIdRef = React.useRef(user?.id || null);
  activeUserIdRef.current = user?.id || null;
  const activeMediaOperationRef = React.useRef<ChatMediaOperation | null>(null);
  const conversationViewMountedRef = React.useRef(true);
  React.useEffect(() => {
    conversationViewMountedRef.current = true;
    return () => {
      conversationViewMountedRef.current = false;
      activeMediaOperationRef.current = null;
    };
  }, []);
  const recipientRef = React.useRef<{
    conversationId: string;
    userId: string | null;
    sdkIdentity: any;
    recipient: ConversationRecipient | null;
  }>({
    conversationId,
    userId: user?.id || null,
    sdkIdentity: sdk,
    recipient: cachedRecipient,
  });
  const recipientPromiseRef = React.useRef<{
    conversationId: string;
    userId: string | null;
    sdkIdentity: any;
    promise: Promise<{ conversation: any; recipient: ConversationRecipient }>;
  } | null>(null);
  if (
    recipientRef.current.conversationId !== conversationId
    || recipientRef.current.userId !== (user?.id || null)
    || recipientRef.current.sdkIdentity !== sdk
  ) {
    recipientRef.current = {
      conversationId,
      userId: user?.id || null,
      sdkIdentity: sdk,
      recipient: cachedRecipient,
    };
    recipientPromiseRef.current = null;
  }
  const [requestStatus, setRequestStatus] = React.useState(initialRequestStatus);
  const [reportingRequest, setReportingRequest] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const messageIdsRef = React.useRef<Set<string>>(new Set(cachedSorted.map((m: any) => m.id)));
  const pollInFlightRef = React.useRef(false);
  // Synchronous send guard. `sending` state is async — a fast double-tap or a
  // web Enter keypress could start a SECOND handleSend before React re-rendered
  // the disabled button, double-sending the message (and, in agent chats,
  // kicking off two concurrent streams whose replies interleaved). A ref flips
  // atomically in the same tick.
  const sendInFlightRef = React.useRef(false);
  // A send may outlive the conversation render that started it (especially an
  // agent SSE stream). Only the token that still owns the active thread may
  // mutate UI or clear the next send's guards.
  const activeSendTokenRef = React.useRef<symbol | null>(null);
  // Picking/uploading media reserves the composer before its first await.
  // Only that exact owner may hand the resulting URL to handleSend; ordinary
  // sends/retries leave their text and failed rows untouched in the meantime.
  const beginMediaOperation = React.useCallback((): ChatMediaOperation | null => {
    if (
      !conversationViewMountedRef.current
      || !activeSdkRef.current
      || !activeUserIdRef.current
      || sendInFlightRef.current
      || activeMediaOperationRef.current
    ) return null;
    const operation = {
      token: Symbol('chat-media'),
      conversationId: activeConversationIdRef.current,
      userId: activeUserIdRef.current,
      sdkIdentity: activeSdkRef.current,
    };
    activeMediaOperationRef.current = operation;
    setAttaching(true);
    return operation;
  }, []);
  const ownsMediaOperation = React.useCallback((operation: ChatMediaOperation) => (
    conversationViewMountedRef.current
    && activeMediaOperationRef.current?.token === operation.token
    && activeConversationIdRef.current === operation.conversationId
    && activeUserIdRef.current === operation.userId
    && activeSdkRef.current === operation.sdkIdentity
  ), []);
  const endMediaOperation = React.useCallback((operation: ChatMediaOperation) => {
    if (activeMediaOperationRef.current?.token !== operation.token) return;
    activeMediaOperationRef.current = null;
    if (conversationViewMountedRef.current) setAttaching(false);
  }, []);
  React.useEffect(() => {
    const operation = activeMediaOperationRef.current;
    if (operation && !ownsMediaOperation(operation)) endMediaOperation(operation);
  }, [conversationId, sdk, user?.id, endMediaOperation, ownsMediaOperation]);
  // Monotonic local ordering for optimistic rows (see sortThread).
  const seqRef = React.useRef(0);

  // One reconcile fetch: pull the latest server messages and MERGE them into
  // state by id. Merging (not replacing) matters: a wholesale setMessages used
  // to truncate visible history from 50 to the poll's 20 and delete optimistic
  // temp-*/streaming-* rows mid-send. Shared by the fallback poll interval and
  // the socket-reconnect catch-up.
  const fetchLatest = React.useCallback(async () => {
    if (!sdk || pollInFlightRef.current) return;
    // Never reconcile mid-turn — the stream is the only writer until finalize.
    if (generationActiveRef.current) return;
    const requestedConversationId = conversationId;
    const requestedSdk = sdk;
    const requestedUserId = user?.id || null;
    pollInFlightRef.current = true;
    try {
      const msgRes = await requestedSdk.chat.messages(requestedConversationId, { limit: 20 });
      // ConversationView survives thread and auth changes. A response for the
      // previous render must never paint the newly visible conversation.
      if (
        !conversationViewMountedRef.current
        || activeConversationIdRef.current !== requestedConversationId
        || activeSdkRef.current !== requestedSdk
        || activeUserIdRef.current !== requestedUserId
      ) return;
      const rawMessages = msgRes.data || [];
      for (const m of rawMessages) messageIdsRef.current.add(m.id);
      const incoming = normalizeChatMessagePage(rawMessages);
      setMessages(prev => {
        // Drop optimistic placeholders once the real server row with the same
        // sender + content has arrived. The WS path already does this, but the
        // poll/catch-up merge did not — so in AGENT chats (where the user's
        // temp row is never id-reconciled, because chat.send is skipped) the
        // temp/streaming row and the reconciled server row BOTH rendered: the
        // transient double-send that cleared only on refresh. Keyed by sender
        // too so a same-text message from the OTHER party can't swallow your
        // still-pending row.
        const senderContentKey = (m: any) =>
          `${m.sender?.id ?? m.senderId ?? ''}\n${(m.content || '').trim()}`;
        const incomingKeys = new Set(incoming.map(senderContentKey));
        const byId = new Map<string, any>();
        for (const m of prev) {
          if (isOptimisticRow(m) && incomingKeys.has(senderContentKey(m))) continue;
          byId.set(m.id, m);
        }
        for (const m of incoming) byId.set(m.id, m);
        return sortThread(Array.from(byId.values()));
      });
      // Keep the remount cache in step with the server — it was only written
      // on the INITIAL load, so navigating away and back seeded the thread
      // with a stale page (old rows + no reconcile of optimistic ids).
      setCache(`messages:${requestedConversationId}`, msgRes.data || []);
    } catch {} finally { pollInFlightRef.current = false; }
  }, [conversationId, sdk, user?.id]);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = React.useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(fetchLatest, 5000);
  }, [fetchLatest]);

  // Scroll-position handling. We only auto-stick to the bottom when the user
  // is already there — so an incoming message or a streaming reply never yanks
  // them away from history they're reading. When they're scrolled up we surface
  // a "jump to latest" affordance instead (Claude / iMessage behaviour).
  const atBottomRef = React.useRef(true);
  const [showJump, setShowJump] = React.useState(false);
  // INVERTED list: offset 0 is the visual bottom (latest message). Opening a
  // thread therefore starts AT the latest message with no scroll calls at all —
  // the Signal architecture. New/streaming content at offset 0 stays pinned
  // automatically; scrolled-up readers are never yanked.
  const stickToBottom = React.useCallback((animated = false) => {
    atBottomRef.current = true;
    setShowJump(false);
    requestAnimationFrame(() => flatListRef.current?.scrollToOffset({ offset: 0, animated }));
  }, []);
  const handleScroll = React.useCallback((e: any) => {
    const { contentOffset } = e.nativeEvent;
    const near = contentOffset.y < 120;
    atBottomRef.current = near;
    setShowJump(prev => (prev === !near ? prev : !near));
  }, []);

  // This component is intentionally NOT remounted on thread switch (no key) —
  // remounting churned the socket subscription + re-flipped the agent styling +
  // re-scrolled, which read as nasty bugs when navigating quickly. Instead,
  // reset the view from the NEW thread's cache here so we never linger on the
  // previous thread's messages. The network load effect below then reconciles.
  const convoIdRef = React.useRef(conversationId);
  React.useEffect(() => {
    if (convoIdRef.current === conversationId) return;
    convoIdRef.current = conversationId;
    // Invalidate every callback owned by the previous thread. The old network
    // request may still finish, but it can no longer mutate this thread or
    // release a guard now owned by a newer send.
    activeSendTokenRef.current = null;
    sendInFlightRef.current = false;
    generationActiveRef.current = false;
    setSending(false);
    setMessages(cachedSorted);
    messageIdsRef.current = new Set(cachedSorted.map((m: any) => m.id));
    setLoading(cachedSorted.length === 0);
    setInitialLoadFailed(false);
    setPartnerName(cachedConvo?.name || cachedRecipient?.name || 'Conversation');
    setPartnerInfo(cachedOther || null);
    setReplyingToState(null);
    setRequestStatus(
      cachedConvo ? conversationRequestStatus(cachedConvo) : initialRequestStatus,
    );
    atBottomRef.current = true;
    setShowJump(false);
    // Indicators belong to the previous thread — never carry them across.
    streamRevealingRef.current = false;
    setAgentTyping(false);
    setAgentStatus(null);
    setHumanTyping(null);
  }, [conversationId, cachedSorted, cachedConvo, cachedOther, cachedRecipient, initialRequestStatus]);

  // Agent conversations render Claude-style (full-width assistant text);
  // human DMs keep iMessage bubbles on both sides.
  const activeRecipient = recipientRef.current.conversationId === conversationId
    && recipientRef.current.userId === (user?.id || null)
    && recipientRef.current.sdkIdentity === sdk
    ? recipientRef.current.recipient
    : null;
  const isAgentChat = activeRecipient?.isAgent === true;

  const resolveConversationRecipientForActiveThread = React.useCallback(async (
    refresh = false,
  ): Promise<ConversationRecipient> => {
    if (!sdk) throw new Error('Chat is not ready');
    const requestedConversationId = conversationId;
    const requestedUserId = user?.id || null;
    const requestedSdk = sdk;
    const cached = recipientRef.current;
    if (
      !refresh
      && cached.conversationId === requestedConversationId
      && cached.userId === requestedUserId
      && cached.sdkIdentity === requestedSdk
      && cached.recipient
    ) {
      return cached.recipient;
    }

    const existing = recipientPromiseRef.current;
    if (
      existing?.conversationId === requestedConversationId
      && existing.userId === requestedUserId
      && existing.sdkIdentity === requestedSdk
    ) {
      return (await existing.promise).recipient;
    }

    const promise = (async () => {
      const convoRes = await sdk.chat.conversation(requestedConversationId);
      const conversation = convoRes?.data as any;
      if (conversation?.id !== requestedConversationId) {
        throw new Error(`Conversation lookup returned the wrong id for ${requestedConversationId}`);
      }
      const recipient = conversationRecipient(conversation, requestedUserId);
      if (!recipient) {
        throw new Error(`Conversation ${requestedConversationId} has no resolvable recipient`);
      }
      // The component remains mounted while threads change. Never publish a
      // late lookup into the next thread, and never let the old send continue.
      if (
        !conversationViewMountedRef.current
        || activeConversationIdRef.current !== requestedConversationId
        || activeSdkRef.current !== requestedSdk
        || activeUserIdRef.current !== requestedUserId
      ) {
        throw new Error('Conversation changed while resolving its recipient');
      }

      recipientRef.current = {
        conversationId: requestedConversationId,
        userId: requestedUserId,
        sdkIdentity: requestedSdk,
        recipient,
      };
      setPartnerInfo(recipient.raw);
      setPartnerName(
        recipient.name !== 'Conversation'
          ? recipient.name
          : conversation?.name || 'Conversation',
      );
      setRequestStatus(conversationRequestStatus(conversation));
      return { conversation, recipient };
    })();

    recipientPromiseRef.current = {
      conversationId: requestedConversationId,
      userId: requestedUserId,
      sdkIdentity: requestedSdk,
      promise,
    };
    try {
      return (await promise).recipient;
    } finally {
      if (recipientPromiseRef.current?.promise === promise) {
        recipientPromiseRef.current = null;
      }
    }
  }, [conversationId, sdk, user?.id]);

  // Details and messages load in parallel; sequential was a visible lag on
  // every thread open.
  React.useEffect(() => {
    if (!sdk) return;
    // The nonce is this effect's reload trigger: the empty-state retry bumps
    // it so a failed initial load can be re-run in place, with the same
    // cancellation guard a thread switch gets.
    void initialLoadNonce;
    let cancelled = false;

    const detailsPromise = resolveConversationRecipientForActiveThread(true).catch(() => null);
    const messagesPromise = sdk.chat.messages(conversationId, { limit: 50 }).catch((err: any) => {
      captureException(err, { screen: 'chat', step: 'load-messages', conversationId });
      return null;
    });

    Promise.all([detailsPromise, messagesPromise]).then(([, msgRes]) => {
      if (cancelled) return;

      // A 200 whose body carries no list is as unusable as a failed fetch.
      const rawMessages = Array.isArray(msgRes?.data) ? msgRes.data : null;
      if (rawMessages) {
        setCache(`messages:${conversationId}`, rawMessages);
        const sorted = normalizeChatMessagePage(rawMessages);
        setMessages(sorted);
        messageIdsRef.current = new Set(sorted.map((m: any) => m.id));
        setInitialLoadFailed(false);
      } else {
        if (msgRes) {
          captureException(new Error('chat_messages_response_not_a_list'), {
            screen: 'chat', step: 'load-messages', conversationId,
          });
        }
        setInitialLoadFailed(true);
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [conversationId, initialLoadNonce, resolveConversationRecipientForActiveThread, sdk]);

  // Real-time messages via WebSocket, fall back to polling
  const wsConnectedRef = React.useRef(false);

  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let socket: any = null;
    let onSocketDisconnect: (() => void) | undefined;
    let onSocketConnect: (() => void) | undefined;

    // ONE stable subscription per conversation. Previously this effect also
    // depended on `loading`, so it tore down and rebuilt the socket listener
    // every time a load started/finished — the churn that made the chat feel
    // like it might break on every click. Messages arriving during the initial
    // load are deduped by id, so subscribing immediately is safe.
    (async () => {
      try {
        socket = await connectRealtime(sdk);
        sdk.realtime.joinConversation(conversationId);
        wsConnectedRef.current = true;

        // A drop must re-arm the polling fallback (the 2s boot check runs
        // once and never again), and a reconnect must re-join the server-side
        // conversation room — membership died with the old socket session —
        // then reconcile whatever arrived while offline.
        onSocketDisconnect = () => {
          wsConnectedRef.current = false;
          startPolling();
        };
        onSocketConnect = () => {
          wsConnectedRef.current = true;
          stopPolling();
          sdk.realtime.joinConversation(conversationId);
          fetchLatest();
        };
        socket?.on('disconnect', onSocketDisconnect);
        socket?.on('connect', onSocketConnect);

        unsub = sdk.realtime.onMessage((msg: any) => {
          if (msg.conversationId !== conversationId) return;
          const senderId = msg.sender?.id || msg.senderId || msg.sender_id;

          // Skip the echo of your OWN messages. The server fans every message to
          // both the conversation room and each member's user room, and your
          // socket is in both — so your own send echoes back, sometimes with an
          // id that doesn't match the optimistic/reconciled row, producing a
          // duplicate. Your sent message is already shown optimistically and
          // reconciled from the send response; the WS path is only for inbound.
          if (senderId && senderId === user?.id) return;
          // NEVER render a row whose sender can't be resolved. An event with a
          // missing/differently-shaped sender field fails the own-echo guard
          // above and then renders YOUR text styled as the agent — the "the
          // agent just repeated me" bug. Unknown-sender events are dropped; if
          // the message is real it arrives again via the reconcile fetch with
          // a hydrated sender.
          if (!senderId) {
            captureException(new Error('chat_ws_unresolvable_sender'), {
              keys: Object.keys(msg || {}).join(','), conversationId,
            });
            return;
          }

          const newMsg = normalizeChatMessage(msg);
          if (!newMsg) return; // Skip blank tool calls; keep structured media-only messages.
          if (messageIdsRef.current.has(newMsg.id)) return;
          messageIdsRef.current.add(newMsg.id);

          // Only clear typing indicator for non-own messages (agent replied)
          if (senderId !== user?.id) {
            setAgentTyping(false);
          }

          // Active agent turn → the stream is the ONLY writer. Every inbound
          // row in this window is an echo of the turn itself (your message or
          // the agent's reply, both already on screen); the post-turn
          // reconcile brings the server rows in with real ids.
          if (generationActiveRef.current) return;

          setMessages(prev => {
            // If a streaming row from this same sender is still ACTIVELY
            // revealing (streaming: true), it's the in-progress smooth-reveal of
            // THIS very message — let it finish typing out and skip the WS echo
            // (which carries the full text and would snap it to the end). Once
            // the reveal finalizes (streaming: false) echoes flow through again
            // and the content-dedupe below swaps the placeholder for the real
            // server row — previously the skip matched finalized rows too, so
            // the server id was never adopted until the next refetch.
            if (prev.some(m => m.streaming === true && (m.sender?.id) === newMsg.sender?.id)) {
              return prev;
            }
            // Drop any optimistic row whose content matches the
            // incoming server row. Covers two cases:
            //   - `agent-*` ids from the SSE fallback when a user
            //     was chatting with an agent and WS wasn't yet ready.
            //   - `temp-*` ids from the user's own send-side
            //     optimistic insert (added today for snappy feel).
            //     Without this filter the temp row sticks around and
            //     the WS row gets added too → message renders twice.
            const incomingContent = newMsg.content?.trim();
            const incomingSenderId = newMsg.sender?.id;
            const filtered = prev.filter(m => {
              // Optimistic placeholders: 'temp-*' (user send), 'agent-*'
              // (SSE fallback append), 'streaming-*' (live agent stream).
              // Drop any whose content matches the WS-arrived row.
              const isOptimistic = m.id.startsWith('temp-')
                || m.id.startsWith('agent-')
                || m.id.startsWith('streaming-');
              if (!isOptimistic) return true;
              if (m.content?.trim() !== incomingContent) return true;
              const optimisticSenderId = m.sender?.id;
              if (!optimisticSenderId || !incomingSenderId) return false;
              return optimisticSenderId !== incomingSenderId;
            });
            const byId = new Map<string, any>();
            for (const m of filtered) byId.set(m.id, m);
            byId.set(newMsg.id, newMsg);
            return sortThread(Array.from(byId.values()));
          });
        });
      } catch {
        // WebSocket failed — fall back to polling
        wsConnectedRef.current = false;
      }
    })();

    return () => {
      unsub?.();
      if (onSocketDisconnect) socket?.off('disconnect', onSocketDisconnect);
      if (onSocketConnect) socket?.off('connect', onSocketConnect);
      if (wsConnectedRef.current) {
        sdk.realtime.leaveConversation(conversationId);
      }
    };
  }, [conversationId, sdk, startPolling, stopPolling, fetchLatest]);

  // Rich agent thinking state. Server emits `agent_thinking` events
  // with status ('thinking' | 'generating' | 'done') during a stream.
  // Surface them in the ThinkingPill below the message list.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let stuckTimer: ReturnType<typeof setTimeout> | null = null;
    const clearStuckTimer = () => { if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; } };
    (async () => {
      try {
        await connectRealtime(sdk);
        unsub = sdk.realtime.onAgentThinking?.((evt: any) => {
          if (evt?.conversationId && evt.conversationId !== conversationId) return;
          if (evt?.status === 'done' || evt?.status === 'error') {
            setAgentStatus('done');
            setAgentTyping(false);
            clearStuckTimer();
          } else if (streamRevealingRef.current) {
            // Text is already typing out on screen — keep the status fresh but
            // never bring the pill back over it.
            setAgentStatus(evt?.status ?? 'generating');
          } else {
            setAgentStatus(evt?.status ?? 'thinking');
            setAgentTyping(true);
            // Safety net: best-in-class typing indicators always auto-expire.
            // If the server dies mid-stream or hits an error path that never
            // emits a terminal event, this clears the indicator instead of
            // letting it spin forever. Reset on each new activity event.
            clearStuckTimer();
            stuckTimer = setTimeout(() => setAgentTyping(false), 30000);
          }
        });
      } catch {}
    })();
    return () => { unsub?.(); clearStuckTimer(); };
  }, [conversationId, sdk]);

  // Bidirectional human typing indicator.
  // Subscribe to `chat_typing` events for THIS conversation and render
  // a "X is typing…" pill below the list. Emit our own on debounced
  // user input below.
  React.useEffect(() => {
    if (!sdk) return;
    let unsub: (() => void) | undefined;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        await connectRealtime(sdk);
        unsub = sdk.realtime.onTyping?.((evt: any) => {
          if (evt?.conversationId !== conversationId) return;
          if (evt?.userId === user?.id) return;
          if (evt?.isTyping) {
            setHumanTyping({ userId: evt.userId, userName: evt.userName || 'Someone' });
            if (clearTimer) clearTimeout(clearTimer);
            // Auto-clear after 5s of no further typing events.
            clearTimer = setTimeout(() => setHumanTyping(null), 5000);
          } else {
            setHumanTyping(null);
          }
        });
      } catch {}
    })();
    return () => {
      unsub?.();
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [conversationId, sdk, user?.id]);

  // Fallback polling — only if WebSocket didn't connect. Stable per
  // conversation (no `loading` dep, which used to restart the interval on every
  // load transition).
  React.useEffect(() => {
    if (!sdk) return;

    // Wait a moment for WS to connect before starting poll. This is only the
    // BOOT decision — the socket's own disconnect/connect handlers above
    // re-arm and stop polling for the rest of the conversation's life.
    const startTimer = setTimeout(() => {
      if (wsConnectedRef.current) return; // WS connected, no need to poll
      startPolling();
    }, 2000);

    return () => {
      clearTimeout(startTimer);
      stopPolling();
    };
  }, [conversationId, sdk, startPolling, stopPolling]);

  // The id of the last message we sent a markAsRead for — dedupes the effect
  // below so a streaming reply (which mutates `messages` rapidly) can't spam
  // /read. Reset when the open conversation changes so the new thread marks.
  const lastMarkedReadIdRef = React.useRef<string | null>(null);
  React.useEffect(() => { lastMarkedReadIdRef.current = null; }, [conversationId]);

  // Mark as read — ONLY while the screen is actually focused. If the agent's
  // reply streams in while you're on another tab (this screen stays mounted),
  // marking it read in the background would advance the server cursor and the
  // unread dot would vanish on the next refresh. Gating on focus keeps the
  // thread genuinely unread until you come back and look at it.
  React.useEffect(() => {
    if (!screenFocused) return;
    if (sdk && messages.length > 0) {
      // Mark read up to the latest PERSISTED message. Scan back past optimistic/
      // streaming temp rows (agent replies stream in with temp ids) — if we only
      // checked the very last row and it was a temp, we'd skip marking entirely
      // and the thread would pop back to unread after a refresh once that reply
      // persisted with a real id. When the temp later resolves to a real id, this
      // effect re-runs and advances the cursor onto it.
      let lastReal: any = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.id && !m.id.startsWith('temp-') && !m.id.startsWith('agent-') && !m.id.startsWith('streaming-')) {
          lastReal = m;
          break;
        }
      }
      // CRITICAL: `messages` mutates many times per second during an agent reply
      // (each streaming token re-renders). Only fire markAsRead when the newest
      // real message id ACTUALLY CHANGES — else we spam /read dozens of times per
      // conversation, burn the API rate limit (429), and the 429 (which drops CORS
      // headers) surfaces as a "CORS error" that breaks the whole chat. Dedupe by
      // the last id we marked so it fires at most once per genuinely-new message.
      if (lastReal?.id && lastReal.id !== lastMarkedReadIdRef.current) {
        lastMarkedReadIdRef.current = lastReal.id;
        sdk.chat.markAsRead(conversationId, { message_id: lastReal.id }).catch(() => {});
      }
    }
  }, [conversationId, sdk, messages, screenFocused]);

  const prepareChatSend = async (): Promise<PreparedChatSend | null> => {
    const requestedConversationId = conversationId;
    const requestedUserId = user?.id;
    try {
      if (!requestedUserId || !sdk) throw new Error('Chat is not ready');
      const recipient = await resolveConversationRecipientForActiveThread();
      if (
        activeConversationIdRef.current !== requestedConversationId
        || activeSdkRef.current !== sdk
        || activeUserIdRef.current !== requestedUserId
      ) {
        throw new Error('Conversation changed while preparing the send');
      }
      return {
        conversationId: requestedConversationId,
        userId: requestedUserId,
        sdkIdentity: sdk,
        recipient,
      };
    } catch (resolutionError) {
      showToast('Could not identify the recipient. Your message was not sent — try again.', 'error');
      captureException(resolutionError, {
        action: 'chat_resolve_recipient',
        conversationId: requestedConversationId,
      });
      return null;
    }
  };

  const handleSend = async (
    overrideText?: string,
    preparedSend?: PreparedChatSend,
    retryMessageId?: string,
    retryOwner: 'message-row' | 'voice-outbox' = 'message-row',
    mediaOperation?: ChatMediaOperation,
  ): Promise<ChatSendOutcome> => {
    const messageText = (typeof overrideText === 'string' ? overrideText : text).trim();
    const replyTargetAtSend = replyingTo;
    if (!messageText || !sdk) return 'not-started';
    if (mediaOperation
      ? !ownsMediaOperation(mediaOperation)
      : activeMediaOperationRef.current !== null
    ) return 'not-started';
    // Synchronous re-entrancy guard — state-based disabling is too slow for a
    // double-tap or the web Enter path, which used to double-send (and run two
    // agent streams at once → interleaved/out-of-order replies).
    if (sendInFlightRef.current) return 'not-started';
    const sendToken = Symbol('chat-send');
    activeSendTokenRef.current = sendToken;
    sendInFlightRef.current = true;
    // Recipient lookup is part of the reserved send, not an idle composer.
    // Reflect the ref guard immediately so controls do not silently ignore taps.
    setSending(true);
    let tempId: string | null = null;
    let transportStarted = false;
    let preparedForDelivery: PreparedChatSend | null = null;
    let attemptedConversationId = conversationId;
    const isPreparedThreadActive = (prepared: PreparedChatSend) => (
      conversationViewMountedRef.current
      && activeConversationIdRef.current === prepared.conversationId
      && activeUserIdRef.current === prepared.userId
      && activeSdkRef.current === prepared.sdkIdentity
    );
    const ownsPreparedSend = (prepared: PreparedChatSend) => (
      activeSendTokenRef.current === sendToken
      && isPreparedThreadActive(prepared)
      && (!mediaOperation || ownsMediaOperation(mediaOperation))
    );

    try {
      const delivery = await runPreparedChatDelivery<PreparedChatSend, ReadyChatSend>({
        // Fail closed on a cold/new conversation. Recipient type controls
        // which endpoint persists the message, so it must be known for this
        // exact active thread before clearing the draft or making any write.
        prepare: async () => {
          const prepared = preparedSend || await prepareChatSend();
          if (!prepared || !prepared.recipient.isAgent) return prepared;
          if (!isPreparedThreadActive(prepared)) return prepared;

          // Capture server ids BEFORE local commit and BEFORE generation. The
          // no-content path can then prove this request created a new exact
          // user row without mistaking an unrelated recent reply for success.
          let agentBaselineMessageIds: ReadonlySet<string> | null = null;
          try {
            const baseline = await prepared.sdkIdentity.chat.messages(
              prepared.conversationId,
              { limit: 20 },
            );
            agentBaselineMessageIds = new Set(
              (baseline?.data || [])
                .map((message: any) => message?.id)
                .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0),
            );
          } catch (baselineError) {
            // Streaming content can still prove success. The no-content path
            // fails closed when this baseline was unavailable.
            console.warn('[chat] could not capture agent-turn baseline', baselineError);
          }
          return { ...prepared, agentBaselineMessageIds };
        },
        validate: (prepared) => {
          preparedForDelivery = prepared;
          attemptedConversationId = prepared.conversationId;
          const valid = prepared.conversationId === conversationId
            && prepared.userId === user?.id
            && prepared.sdkIdentity === sdk
            && ownsPreparedSend(prepared);
          if (valid) return true;
          const changedError = new Error('Conversation changed before send');
          showToast('The conversation changed before the message could be sent. Try again.', 'error');
          captureException(changedError, {
            action: 'chat_validate_prepared_send',
            conversationId,
            preparedConversationId: prepared.conversationId,
          });
          return false;
        },
        onReady: (prepared) => {
          if (!ownsPreparedSend(prepared)) {
            throw new Error('Conversation changed before local send state was committed');
          }
          setSending(true);

          // Only now is it safe to commit local send state. Failed preparation
          // leaves the typed draft, reply target, and failed retry row intact.
          const replyId = replyTargetAtSend?.id && !String(replyTargetAtSend.id).startsWith('temp-')
            ? replyTargetAtSend.id
            : undefined;
          if (typeof overrideText !== 'string') {
            // Do not erase text added while recipient lookup was in flight.
            setText(current => current.trim() === messageText ? '' : current);
          }
          setReplyingToState(current => {
            if (!replyTargetAtSend || current?.conversationId !== prepared.conversationId) return current;
            return current.message === replyTargetAtSend || current.message?.id === replyTargetAtSend.id
              ? null
              : current;
          });
          if (retryMessageId) {
            setMessages(prev => prev.filter(m => m.id !== retryMessageId));
          }
          stickToBottom(true);

          const nextTempId = `temp-${Date.now()}`;
          tempId = nextTempId;
          const optimisticCreatedAt = new Date().toISOString();
          setMessages(prev => sortThread([...prev, {
            id: nextTempId,
            content: messageText,
            sender: { id: user?.id, name: user?.name },
            createdAt: optimisticCreatedAt,
            reply_to_id: replyId,
            pending: true,
            seq: seqRef.current++,
          }]));
          publishLocalChat({
            conversationId: prepared.conversationId,
            content: messageText,
            createdAt: optimisticCreatedAt,
          });
          return { tempId: nextTempId, replyId };
        },
        sendHuman: async (prepared, ready) => {
          transportStarted = true;
          const sendRes = await prepared.sdkIdentity.chat.send({
            conversation_id: prepared.conversationId,
            content: messageText,
            reply_to_id: ready.replyId,
          } as any);
          // A successful response is persistence proof even if navigation won
          // the race immediately afterward. Only the UI mutations require the
          // prepared thread to remain active.
          if (ownsPreparedSend(prepared)) {
            if (requestStatus === 'pending') setRequestStatus('accepted');
            const serverMsgId = sendRes?.data?.id;
            if (serverMsgId) {
              messageIdsRef.current.add(serverMsgId);
              setMessages(prev => prev.map(m => m.id === ready.tempId
                ? { ...m, id: serverMsgId, pending: false }
                : m));
            } else {
              setMessages(prev => prev.map(m => m.id === ready.tempId ? { ...m, pending: false } : m));
            }
          }
          return true;
        },
        sendAgent: async (prepared, ready) => {
          const otherId = prepared.recipient.id;
          const otherName = prepared.recipient.name;
          const agentSdk = prepared.sdkIdentity;
          const ownsStream = () => ownsPreparedSend(prepared);
          const markTurnAccepted = () => {
            if (!ownsStream()) return;
            setMessages(prev => prev.map(m => m.id === ready.tempId
              ? { ...m, pending: false }
              : m));
          };
          if (!ownsStream()) return false;
          // chatStream persists the user turn; chat.send must never also run.
          const baselineMessageIds = prepared.agentBaselineMessageIds ?? null;

      // Agent reply path. The server's POST /chat/messages does NOT
      // auto-trigger an agent response — the client is responsible
      // for kicking off /agents/:id/chat/stream when the recipient
      // is an agent.
      //
      // Streaming render: insert a placeholder bubble immediately
      // ('streaming: true') and append text_delta chunks to it as
      // they arrive. The bubble shows a blinking caret while
      // streaming. Net effect: Claude-style typed-out reply instead
      // of a long pause followed by a paste.
      {
        // Thinking pill turns on LOCALLY the moment the request leaves — the
        // old code waited for a server `agent_thinking` socket event that
        // sometimes never arrived, which is why the indicator felt unreliable.
        // Server events still enrich the status text; this owns the lifecycle.
        setAgentStatus('thinking');
        setAgentTyping(true);
        // From here until finalize, the stream owns the thread.
        generationActiveRef.current = true;

        const streamingId = `streaming-${Date.now()}`;
        // The streaming bubble is inserted lazily on the FIRST text delta (not
        // up front) so an empty bubble never sits next to the thinking pill.
        let inserted = false;
        const ensureStreamingRow = () => {
          if (inserted) return;
          inserted = true;
          streamRevealingRef.current = true;
          setAgentTyping(false); // pill hands off to the streaming text
          setMessages(prev => sortThread([...prev, {
            id: streamingId,
            content: '',
            sender: { id: otherId, name: otherName, is_ai: true },
            createdAt: new Date().toISOString(),
            streaming: true,
            seq: seqRef.current++,
          }]));
        };
        // SMOOTH STREAMING (Claude-style). The network delivers tokens in
        // irregular bursts; rendering each burst as it lands shows the network's
        // chunkiness. Instead we accumulate into `received` and reveal it via a
        // requestAnimationFrame loop that advances a `displayed` cursor toward
        // `received` at a smooth, eased cadence — fast catch-up when far behind,
        // gentle when close — so the text types out at a calm steady pace no
        // matter how bursty the stream is.
        let received = '';
        let displayed = 0;
        let streamedAny = false;
        let acceptedUserMessageId: string | null = null;
        let turnAccepted = false;
        let streamDone = false;
        let rafId: ReturnType<typeof requestAnimationFrame> | null = null;
        let revealSettled = false;
        let settleReveal!: () => void;
        const revealFinished = new Promise<void>((resolve) => { settleReveal = resolve; });
        const finishRevealWait = () => {
          if (revealSettled) return;
          revealSettled = true;
          settleReveal();
        };
        const finalizeStream = () => {
          if (!ownsStream()) {
            finishRevealWait();
            return;
          }
          streamRevealingRef.current = false;
          generationActiveRef.current = false;
          setAgentTyping(false);
          setAgentStatus('done');
          // Turn is over — ONE authoritative reconcile. The merge swaps the
          // finalized placeholder (and your temp row) for server rows by
          // content, adopts real ids, and refreshes the remount cache.
          setTimeout(() => {
            if (isPreparedThreadActive(prepared)) void fetchLatest();
          }, 400);
          finishRevealWait();
        };
        const renderTo = (n: number, final = false) => {
          if (!ownsStream()) {
            finishRevealWait();
            return;
          }
          ensureStreamingRow();
          setMessages(prev => prev.map(m => m.id === streamingId
            ? { ...m, content: received.slice(0, n), ...(final ? { streaming: false } : {}) }
            : m));
          if (final) finalizeStream();
        };
        const tick = () => {
          rafId = null;
          if (!ownsStream()) {
            finishRevealWait();
            return;
          }
          const gap = received.length - displayed;
          if (gap > 0) {
            displayed = Math.min(received.length, displayed + Math.max(2, Math.ceil(gap * 0.2)));
            renderTo(displayed);
          }
          if (displayed < received.length) {
            rafId = requestAnimationFrame(tick);     // more to reveal
          } else if (streamDone) {
            renderTo(received.length, true);          // caught up + done → finalize
          }
          // else: caught up but stream still open → stop; the next chunk re-kicks
        };
        const kick = () => {
          if (!ownsStream()) {
            finishRevealWait();
            return;
          }
          if (rafId == null) rafId = requestAnimationFrame(tick);
        };

        // THE two-day bug, root-caused: sdk.agents.chatStream reads the SSE
        // body with a streaming reader React Native's fetch DOES NOT support
        // (the SDK's own docs say "For React Native, use chatStreamText()").
        // On native the stream call always threw AFTER the server had already
        // stored the message and generated a reply — then the fallback ran the
        // whole turn AGAIN: duplicate user rows, double generations, and a
        // model context ending [Q, A, Q] that made it echo the prompt back.
        // Native now makes exactly ONE call and lets the RAF reveal type the
        // reply out Claude-style; web keeps true token streaming.
        let streamFailure: unknown = null;
        if (Platform.OS === 'web') {
          try {
            transportStarted = true;
            const stream = agentSdk.agents.chatStream(otherId, {
              message: messageText,
              conversation_id: prepared.conversationId,
            });
            for await (const chunk of stream) {
              const metadata = chunk as typeof chunk & {
                conversation_id?: string;
                message_id?: string;
              };
              if (
                metadata.conversation_id
                && metadata.conversation_id !== prepared.conversationId
              ) {
                throw new Error('Agent stream returned metadata for the wrong conversation');
              }
              if (typeof metadata.message_id === 'string' && metadata.message_id) {
                acceptedUserMessageId = metadata.message_id;
                turnAccepted = true;
                markTurnAccepted();
              }
              if (
                chunk?.type === 'text_delta'
                && typeof chunk.delta === 'string'
                && chunk.delta.length > 0
              ) {
                // A non-empty response proves the one generation request was
                // accepted even if the user changed threads before it painted.
                turnAccepted = true;
                // Continue consuming the sole request after a thread switch,
                // but never let its late chunks paint the new conversation.
                if (!ownsStream()) continue;
                received += chunk.delta;
                streamedAny = true;
                markTurnAccepted();
                kick();
              }
              if (chunk?.type === 'error') {
                streamFailure = new Error(chunk.error || 'Agent streaming failed');
              }
            }
          } catch (streamErr) {
            streamFailure = streamErr;
            console.warn('[chat] web stream failed', streamErr);
          }
        } else {
          try {
            transportStarted = true;
            const result = await agentSdk.agents.chatStreamText(otherId, {
              message: messageText,
              conversation_id: prepared.conversationId,
            });
            if (result?.content) turnAccepted = true;
            if (result?.content && ownsStream()) {
              received = result.content;
              streamedAny = true;
              markTurnAccepted();
              kick();
            }
          } catch (err) {
            streamFailure = err;
            console.warn('[chat] chatStreamText failed', err);
          }
        }
        if (!ownsStream()) {
          if (rafId != null) cancelAnimationFrame(rafId);
          finishRevealWait();
          return turnAccepted;
        }
        if (!streamedAny) {
          // No-content path: the one stream request may have failed client-side
          // after the server accepted it. Never fire a second generation on
          // either web or native. Prove that this exact conversation gained a
          // new matching user turn after our baseline before reporting success.
          generationActiveRef.current = false; // gate open: WS may deliver it
          let persistedUserTurn = acceptedUserMessageId !== null;
          let reconcileFailure: unknown = null;
          for (let i = 0; i < 36 && !persistedUserTurn; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            if (!ownsStream()) return turnAccepted;
            try {
              const msgRes = await agentSdk.chat.messages(prepared.conversationId, { limit: 20 });
              if (!ownsStream()) return turnAccepted;
              const rawMessages = msgRes?.data || [];
              const incoming = normalizeChatMessagePage(rawMessages);
              persistedUserTurn = hasNewPersistedUserTurn({
                messages: incoming,
                baselineMessageIds,
                userId: prepared.userId,
                content: messageText,
              });

              // Reconcile only into the still-active prepared thread. This is
              // the same merge policy as the normal poll, but unlike the old
              // state-probe it cannot mistake conversation B's rows for A's.
              for (const m of rawMessages) messageIdsRef.current.add(m.id);
              setMessages(prev => {
                const senderContentKey = (m: any) =>
                  `${m.sender?.id ?? m.senderId ?? ''}\n${(m.content || '').trim()}`;
                const incomingKeys = new Set(incoming.map(senderContentKey));
                const byId = new Map<string, any>();
                for (const m of prev) {
                  if (isOptimisticRow(m) && incomingKeys.has(senderContentKey(m))) continue;
                  byId.set(m.id, m);
                }
                for (const m of incoming) byId.set(m.id, m);
                return sortThread(Array.from(byId.values()));
              });
              setCache(`messages:${prepared.conversationId}`, rawMessages);
            } catch (reconcileError) {
              reconcileFailure = reconcileError;
            }
          }
          if (!ownsStream()) return turnAccepted;
          if (!persistedUserTurn) {
            if (rafId != null) cancelAnimationFrame(rafId);
            finishRevealWait();
            const deliveryError = streamFailure instanceof Error
              ? streamFailure
              : reconcileFailure instanceof Error
                ? reconcileFailure
                : new Error('Agent stream returned no content and persisted no matching user turn');
            throw deliveryError;
          }
          turnAccepted = true;
          markTurnAccepted();
        }
        // Stream is closed. Let the reveal loop type out the rest and finalize.
        // If nothing was produced (tool-only/errored turn), remove the empty
        // placeholder — any real reply/error the server stored arrives via the
        // WS echo as its own row.
        streamDone = true;
        if (streamedAny) {
          // The reveal loop finishes typing and calls finalizeStream() (which
          // owns clearing streamRevealingRef) — clearing it here, while the
          // tail was still revealing, let the WS echo render as a SECOND full
          // row next to the half-typed one.
          kick();
          await revealFinished;
        } else {
          if (rafId != null) cancelAnimationFrame(rafId);
          if (!ownsStream()) {
            finishRevealWait();
            return turnAccepted;
          }
          setMessages(prev => prev.filter(m => m.id !== streamingId));
          streamRevealingRef.current = false;
          generationActiveRef.current = false;
          setAgentStatus('done');
          setAgentTyping(false);
          finishRevealWait();
          // Whatever the server DID store for this turn, show it.
          setTimeout(() => {
            if (isPreparedThreadActive(prepared)) void fetchLatest();
          }, 400);
        }
        if (ownsStream()) setAgentTyping(false);
        return turnAccepted;
      }
        },
      });
      if (delivery === 'agent' || delivery === 'human') return 'confirmed';
      return transportStarted ? 'unknown' : 'not-started';
    } catch (err) {
      // A previous thread's late failure cannot overwrite the new thread or a
      // newer send's indicators. The active owner gets a retryable failed row.
      if (preparedForDelivery && ownsPreparedSend(preparedForDelivery)) {
        generationActiveRef.current = false;
        streamRevealingRef.current = false;
        setAgentTyping(false);
        setAgentStatus(null);
        if (tempId) {
          if (retryOwner === 'voice-outbox') {
            // The saved note is the sole retry authority. Exposing a second
            // failed ChatBubble retry would let either path resend the URL.
            setMessages(prev => prev.filter(m => m.id !== tempId));
          } else {
            setMessages(prev => prev.map(m => m.id === tempId
              ? { ...m, pending: false, failed: true }
              : m));
            showToast('Message not sent. Tap it to retry.', 'error');
          }
        }
      }
      captureException(err, {
        action: 'chat_send',
        conversationId: attemptedConversationId,
      });
      return transportStarted ? 'unknown' : 'not-started';
    } finally {
      // A stale send must never release the guard belonging to a newer send.
      if (activeSendTokenRef.current === sendToken) {
        activeSendTokenRef.current = null;
        sendInFlightRef.current = false;
        setSending(false);
      }
    }
  };

  // Retry a failed send: drop the failed optimistic row and re-run handleSend
  // with its original text. Mirrors iMessage's tap-to-retry on a "Not
  // delivered" bubble.
  // Attachment: pick image/video → upload to R2 → send the URL as the message.
  // The bubble detects the media URL and renders it inline (like the feed).
  // #190 — the wrong-conversation bug. The memoized handlers below (attach /
  // voice / retry) deliberately carry sparse deps so they don't re-create on
  // every keystroke — but that meant each closed over the handleSend of the
  // render it was created in, and handleSend closes over conversation-scoped
  // state. ConversationView is intentionally NOT remounted on thread
  // switch (see the key-less render at the call site), so an attach, voice
  // note or retry issued after a switch delivered into the PREVIOUS thread
  // while painting the bubble in the current one. Resolve through the latest
  // ref, bind that conversation in a prepared token, and reject the send if
  // the screen changes before the deferred work finishes.
  const prepareChatSendRef = React.useRef(prepareChatSend);
  prepareChatSendRef.current = prepareChatSend;
  const handleSendRef = React.useRef(handleSend);
  handleSendRef.current = handleSend;

  const handleAttach = React.useCallback(async () => {
    const operation = beginMediaOperation();
    if (!operation) return;
    try {
      // Resolve and bind the destination before opening an upload path. If the
      // thread is cold/unresolvable, there is no storage write and no lost pick.
      const prepared = await prepareChatSendRef.current();
      if (!prepared || !ownsMediaOperation(operation)) return;
      const picker: any = await import('expo-image-picker');
      if (!ownsMediaOperation(operation)) return;
      const res = await picker.launchImageLibraryAsync({ mediaTypes: picker.MediaTypeOptions.All, quality: 0.85 });
      if (res.canceled || !res.assets?.length) return;
      if (!ownsMediaOperation(operation)) {
        if (conversationViewMountedRef.current) showToast('The conversation changed before the attachment could be sent. Try again.', 'error');
        return;
      }
      const asset = res.assets[0];
      const contentType = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
      const blob = await (await fetch(asset.uri)).blob();
      if (
        !ownsMediaOperation(operation)
        || activeConversationIdRef.current !== prepared.conversationId
        || activeSdkRef.current !== prepared.sdkIdentity
        || activeUserIdRef.current !== prepared.userId
      ) {
        showToast('The conversation changed before the attachment could be sent. Try again.', 'error');
        return;
      }
      // A failed upload used to `return` from here with no feedback at all —
      // the spinner just stopped and the attachment went nowhere. #191's rule,
      // applied to chat: a failure the user isn't told about reads as a send.
      const publicUrl = await uploadMediaBlob({
        blob,
        contentType,
        sdk: prepared.sdkIdentity,
        onError: (m) => { if (ownsMediaOperation(operation)) showToast(m, 'error'); },
      });
      if (!publicUrl) return;
      if (!ownsMediaOperation(operation)) {
        if (conversationViewMountedRef.current) showToast('The conversation changed before the attachment could be sent. Try again.', 'error');
        return;
      }
      const outcome = await handleSendRef.current(publicUrl, prepared, undefined, 'message-row', operation);
      if (outcome === 'not-started' && ownsMediaOperation(operation)) {
        showToast('Attachment not sent. Pick it again to retry.', 'error');
      }
    } catch {
      // Picker import or reading the picked file failed. handleSend's own
      // failures never reach here — it marks the message row failed itself.
      if (ownsMediaOperation(operation)) showToast('The attachment could not be read.', 'error');
    }
    finally { endMediaOperation(operation); }
  }, [beginMediaOperation, endMediaOperation, ownsMediaOperation]);

  // Voice notes (Expo recorder on web + native). `voice.stop()` consumes the
  // recorder, so the resulting Blob becomes a small local outbox item. It is
  // removed only after the message transport succeeds; a completed upload URL
  // is retained too, avoiding duplicate storage writes on retry.
  const attemptPendingVoiceNote = React.useCallback(async (
    note: PendingChatVoiceNote,
    prepared: PreparedChatSend,
  ): Promise<boolean> => {
    if (activeMediaOperationRef.current || sendInFlightRef.current) return false;
    if (
      note.conversationId !== prepared.conversationId
      || note.userId !== prepared.userId
      || activeConversationIdRef.current !== prepared.conversationId
      || activeSdkRef.current !== prepared.sdkIdentity
      || activeUserIdRef.current !== prepared.userId
    ) {
      showToast('Voice note kept for this session. Return to its conversation to retry.', 'error');
      return false;
    }

    // State-based button disabling lands on the next render. Reserve the note
    // synchronously so a double tap or remount cannot start two uploads/sends.
    const attemptToken = beginChatVoiceAttempt(note);
    if (!attemptToken) return false;
    const operation = beginMediaOperation();
    if (!operation) {
      endChatVoiceAttempt(note, attemptToken);
      return false;
    }
    try {
      let publicUrl = note.publicUrl;
      if (!publicUrl) {
        publicUrl = await uploadMediaBlob({
          blob: note.recording.blob,
          contentType: note.recording.mime,
          sdk: prepared.sdkIdentity,
          onError: () => showToast('Voice note upload failed. Keep Minds open and tap Send to retry.', 'error'),
        }) || undefined;
        if (!publicUrl) return false;

        updatePendingChatVoiceNote(note, current => ({ ...current, publicUrl }));
      }

      // Upload can outlive the render that started it. Retain the Blob and the
      // uploaded URL rather than delivering into whichever thread is visible
      // when it finishes.
      if (
        !ownsMediaOperation(operation)
        || activeConversationIdRef.current !== prepared.conversationId
        || activeSdkRef.current !== prepared.sdkIdentity
        || activeUserIdRef.current !== prepared.userId
      ) {
        showToast('Voice note kept for this session. Return to its conversation to retry.', 'error');
        return false;
      }

      // A chat.send response can time out after the server committed. Because
      // this uploaded URL uniquely identifies the note, inspect the largest
      // history page before handling an uncertain prior attempt; a failed/truncated
      // lookup stays unknown and MUST NOT become another POST.
      const persistenceStatus = () => resolveUniqueUserContentPersistence({
        fetchPage: async ({ limit, offset }) => {
          if (
            !ownsMediaOperation(operation)
            || activeConversationIdRef.current !== prepared.conversationId
            || activeSdkRef.current !== prepared.sdkIdentity
            || activeUserIdRef.current !== prepared.userId
          ) throw new Error('Conversation changed during voice-note reconciliation');
          return prepared.sdkIdentity.chat.messages(
            prepared.conversationId,
            { limit, offset },
          );
        },
        userId: prepared.userId,
        uniqueContent: publicUrl,
      });

      if (note.deliveryAttemptedAt) {
        const priorStatus = await persistenceStatus();
        const retryDecision = uniqueContentRetryDecision(true, priorStatus);
        if (retryDecision === 'confirmed') {
          removePendingChatVoiceNote(note.userId, note.conversationId, note.id);
          void fetchLatest();
          return true;
        }
        // Once a transport started without a definitive response, even a
        // currently-absent row could still commit late. Without platform
        // idempotency, both absent and unknown must fail closed forever for
        // this exact note instead of risking a duplicate POST.
        showToast(
          priorStatus === 'unknown'
            ? 'Could not verify the earlier send. No duplicate was sent; keep Minds open and check again later.'
            : 'The earlier send is not visible, but may still finish. No duplicate was sent.',
          'error',
        );
        return false;
      }

      const deliveryAttemptedAt = new Date().toISOString();
      updatePendingChatVoiceNote(note, current => ({
        ...current,
        publicUrl,
        deliveryAttemptedAt,
      }));

      const outcome = await handleSendRef.current(publicUrl, prepared, undefined, 'voice-outbox', operation);
      if (outcome === 'confirmed') {
        removePendingChatVoiceNote(note.userId, note.conversationId, note.id);
        return true;
      }
      if (outcome === 'not-started') {
        updatePendingChatVoiceNote(note, current => ({
          ...current,
          deliveryAttemptedAt: undefined,
        }));
        showToast('Voice note not sent. Keep Minds open and tap Send to retry.', 'error');
        return false;
      }

      // An unknown transport result may still mean the server committed and the
      // response was lost. Poll for exact proof, but never auto-resend here.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 400));
        const status = await persistenceStatus();
        if (status === 'found') {
          removePendingChatVoiceNote(note.userId, note.conversationId, note.id);
          void fetchLatest();
          return true;
        }
      }
      showToast('Voice note outcome is unconfirmed. No duplicate was sent; keep Minds open and retry later.', 'error');
      return false;
    } catch {
      showToast('Voice note not sent. Keep Minds open and tap Send to retry.', 'error');
      return false;
    } finally {
      endChatVoiceAttempt(note, attemptToken);
      endMediaOperation(operation);
    }
  }, [beginMediaOperation, endMediaOperation, fetchLatest, ownsMediaOperation]);

  const handleStartVoice = React.useCallback(async () => {
    if (
      !voice.supported
      || voice.recording
      || !sdk
      || !user?.id
      || pendingVoiceNote
      || voiceOriginRef.current !== null
      || activeMediaOperationRef.current !== null
      || sendInFlightRef.current
    ) return;
    // The hook has its own recorder guard, but ownership lives here. Reserve
    // that ownership synchronously so a second tap cannot replace/clear A's
    // origin while the first permission/start promise is still pending.
    const startToken = beginChatVoiceStart(user.id);
    if (!startToken) return;
    const origin: VoiceRecordingOrigin = {
      conversationId,
      userId: user.id,
      sdkIdentity: sdk,
      sessionEpoch: getChatComposerSessionEpoch(),
    };
    try {
      voiceOriginRef.current = origin;
      const started = await voice.start();
      if (!started) {
        if (voiceOriginRef.current === origin) voiceOriginRef.current = null;
        if (!conversationViewMountedRef.current) return;
        showToast('Allow microphone access to record a voice note.', 'error');
        return;
      }

      // Permission and recorder startup are asynchronous. If navigation won
      // that race, immediately retain A's recording under A for this session.
      if (
        !conversationViewMountedRef.current
        || activeConversationIdRef.current !== origin.conversationId
        || activeUserIdRef.current !== origin.userId
        || activeSdkRef.current !== origin.sdkIdentity
      ) {
        const recording = await voice.stop();
        if (voiceOriginRef.current === origin) voiceOriginRef.current = null;
        if (recording && saveVoiceRecording(recording, origin)) {
          showToast('Voice note kept in its original conversation while Minds stays open.', 'error');
        }
      }
    } finally {
      endChatVoiceStart(origin.userId, startToken);
    }
  }, [conversationId, pendingVoiceNote, saveVoiceRecording, sdk, user?.id, voice]);

  const handleCancelVoice = React.useCallback(() => {
    voiceOriginRef.current = null;
    voice.cancel();
  }, [voice]);

  React.useEffect(() => {
    const origin = voiceOriginRef.current;
    if (!voice.recording || !origin) return;
    if (
      origin.conversationId === conversationId
      && origin.userId === user?.id
      && origin.sdkIdentity === sdk
    ) return;

    // Wide web reuses ConversationView, so selecting B does not unmount A's
    // recorder. Stop it once and save the Blob under A before B can touch it.
    void voice.stop().then((recording) => {
      if (voiceOriginRef.current === origin) voiceOriginRef.current = null;
      if (recording && saveVoiceRecording(recording, origin)) {
        showToast('Voice note kept in its original conversation while Minds stays open.', 'error');
      }
    });
  }, [conversationId, saveVoiceRecording, sdk, user?.id, voice]);

  const handleSendVoice = React.useCallback(async () => {
    if (!sdk || activeMediaOperationRef.current || sendInFlightRef.current) return;

    if (pendingVoiceNote) {
      if (
        pendingVoiceNote.conversationId !== activeConversationIdRef.current
        || pendingVoiceNote.userId !== activeUserIdRef.current
      ) {
        showToast('This voice note is waiting in another conversation.', 'error');
        return;
      }
      // Re-prepare on every retry so an auth/SDK refresh cannot reuse stale
      // routing authority even though the Blob itself remains safe locally.
      const prepared = await prepareChatSendRef.current();
      if (!prepared) return;
      await attemptPendingVoiceNote(pendingVoiceNote, prepared);
      return;
    }

    const origin = voiceOriginRef.current;
    if (
      !origin
      || origin.conversationId !== conversationId
      || origin.userId !== user?.id
      || origin.sdkIdentity !== sdk
    ) {
      const recording = await voice.stop();
      voiceOriginRef.current = null;
      if (recording && saveVoiceRecording(recording, origin)) {
        showToast('Voice note kept in its original conversation while Minds stays open.', 'error');
      }
      return;
    }

    // A failed lookup leaves the live recorder untouched.
    const prepared = await prepareChatSendRef.current();
    if (!prepared) return;
    if (
      prepared.conversationId !== origin.conversationId
      || prepared.userId !== origin.userId
      || prepared.sdkIdentity !== origin.sdkIdentity
    ) return;
    const rec = await voice.stop();
    if (voiceOriginRef.current === origin) voiceOriginRef.current = null;
    if (!rec || rec.durationMs < 700) return; // ignore accidental sub-second taps

    const note = saveVoiceRecording(rec, origin);
    if (!note) return;
    // Retain in the conversation-owned session outbox before the first
    // post-stop await/write.
    await attemptPendingVoiceNote(note, prepared);
  }, [attemptPendingVoiceNote, conversationId, pendingVoiceNote, saveVoiceRecording, sdk, user?.id, voice]);

  const retryMessage = React.useCallback(async (msg: any) => {
    const body = (msg?.content || '').trim();
    if (!body) return;
    // Never drop the failed row while another send is in flight — handleSend
    // would refuse to run and the message text would vanish.
    if (sendInFlightRef.current || activeMediaOperationRef.current) return;
    const prepared = await prepareChatSendRef.current();
    if (!prepared || sendInFlightRef.current || activeMediaOperationRef.current) return;
    await handleSendRef.current(body, prepared, msg.id);
    // Empty deps are now CORRECT rather than merely convenient: the send goes
    // through handleSendRef, which is reassigned every render, so this stable
    // callback can never deliver into a previous conversation (#190).
  }, []);

  const reportRequestSpam = React.useCallback(async () => {
    const otherId = partnerInfo?.id || partnerInfo?.user?.id || partnerInfo?.userId;
    if (!sdk || !otherId || reportingRequest) return;
    setReportingRequest(true);
    let reported = false;
    try {
      await sdk.reports.create({
        target_type: 'user',
        target_id: otherId,
        reason: 'spam',
        details: `Reported from message requests (conversation ${conversationId})`,
      });
      reported = true;
      await blockUser(otherId);
      showToast('Reported and blocked', 'success');
      setRequestStatus('declined');
      invalidate('conversations');
      onBack();
    } catch {
      showToast(
        reported ? 'Reported, but could not block this account' : 'Could not report spam',
        'error',
      );
    } finally {
      setReportingRequest(false);
    }
  }, [conversationId, onBack, partnerInfo, reportingRequest, sdk]);

  // Fire a route-param prompt once the recipient is resolved (so agent
  // detection + agents.chatStream work). Runs once per distinct prompt, then
  // clears it from the URL so navigating back / remounting doesn't resend.
  React.useEffect(() => {
    const p = typeof routeParams.prompt === 'string' ? routeParams.prompt : null;
    if (!p) {
      routePromptOwnerRef.current = null;
      return;
    }
    const routeId = typeof routeParams.id === 'string' ? routeParams.id : null;
    if (routePromptOwnerRef.current?.prompt !== p || routePromptOwnerRef.current.routeId !== routeId) {
      const intendedConversation = routeId || conversationId;
      routePromptOwnerRef.current = {
        prompt: p,
        routeId,
        conversationId: intendedConversation,
        userId: user?.id || null,
        sdkIdentity: sdk,
        sessionEpoch: composerSessionEpoch,
        wasActive: conversationId === intendedConversation,
        cancelled: false,
      };
    }
    const owner = routePromptOwnerRef.current;
    // Wide-web selection changes the active pane without changing route params.
    // A deferred prompt must not follow that pane, even if it later returns to A.
    if (!owner.cancelled && (
      owner.userId !== (user?.id || null)
      || owner.sdkIdentity !== sdk
      || owner.sessionEpoch !== composerSessionEpoch
      || (owner.wasActive && owner.conversationId !== conversationId)
    )) {
      owner.cancelled = true;
      // The URL outlives this owner ref. Remove the abandoned intent so a
      // remount or reload cannot treat it as a new prompt in another session.
      try { router.setParams({ prompt: undefined } as any); } catch {}
    }
    if (owner.cancelled || owner.conversationId !== conversationId) return;
    owner.wasActive = true;
    if (!partnerInfo || !user?.id || !sdk) return;
    // A picker/upload owns admission until it finishes. Keep the route prompt
    // intact and retry this effect when the composer becomes available.
    if (sendInFlightRef.current || activeMediaOperationRef.current) return;
    if (autoSentPromptRef.current === p) return;
    autoSentPromptRef.current = p;
    void handleSend(p);
    try { router.setParams({ prompt: undefined } as any); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeParams.id, routeParams.prompt, conversationId, user?.id, sdk, composerSessionEpoch, partnerInfo, sending, attaching]);

  return (
    <KeyboardAvoid style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        {!hideBack && (
          <Pressable onPress={onBack} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        )}
        {/* Tapping the name/avatar opens per-chat settings (Signal-style). */}
        <Pressable onPress={() => setShowSettings(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) }}>
          <Avatar uri={partnerInfo?.image || partnerInfo?.user?.image} name={partnerName} size="sm" />
          <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>{partnerName}</Text>
        </Pressable>
        <Pressable onPress={() => setShowSettings(true)} hitSlop={10} style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ChatSettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        conversationId={conversationId}
        partner={{
          id: partnerInfo?.id || partnerInfo?.user?.id || partnerInfo?.userId,
          name: partnerName,
          username: partnerInfo?.username || partnerInfo?.user?.username,
          image: partnerInfo?.image || partnerInfo?.user?.image,
          isAgent: isAgentChat,
        }}
        onDeleted={onBack}
      />

      {/* Messages */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton width={200} height={14} />
        </View>
      ) : (
        <>
        {initialLoadFailed ? (
          // Rendered OUTSIDE the list so it survives the list becoming
          // non-empty: a socket-delivered or freshly sent message must not
          // take the only recovery control for the missing history with it
          // (Codex review finding on #764).
          <Pressable
            onPress={retryInitialLoad}
            accessibilityRole="button"
            accessibilityLabel="Retry loading messages"
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'center',
              marginTop: spacing.md, marginBottom: spacing.sm,
              paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
              backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Ionicons name="cloud-offline-outline" size={13} color={colors.error} />
            <Text variant="caption" color={colors.error}>Couldn&apos;t load messages · Tap to retry</Text>
          </Pressable>
        ) : null}
        <FlatList
          ref={flatListRef}
          data={invertedMessages}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            const senderId = item.sender?.id || item.senderId || item.sender_id;
            // Inverted data: the chronologically-previous message is the NEXT
            // inverted index. Row internals render un-flipped (double scaleY),
            // so the day/unread separators still sit above the bubble.
            const prev = index < invertedMessages.length - 1 ? invertedMessages[index + 1] : null;
            const ts = item.createdAt || item.created_at;
            // Day separator when the calendar day changes — Today / Yesterday /
            // "Jun 3", best-in-class chat history legibility.
            const showDay = isNewDay(ts, prev?.createdAt || prev?.created_at);
            return (
              <>
                {showDay ? (
                  <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                    <View style={{ backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.full }}>
                      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11, fontWeight: '600' }}>{formatDayLabel(ts)}</Text>
                    </View>
                  </View>
                ) : null}
                {item.id === unreadAnchorId ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md }}>
                    <View style={{ flex: 1, height: 0.5, backgroundColor: colors.accent, opacity: 0.5 }} />
                    <Text variant="caption" color={colors.accent} style={{ fontSize: 11, fontWeight: '700' }}>Unread messages</Text>
                    <View style={{ flex: 1, height: 0.5, backgroundColor: colors.accent, opacity: 0.5 }} />
                  </View>
                ) : null}
                <ChatBubble message={item} isOwn={senderId === user?.id} agentChat={isAgentChat} onRetry={retryMessage} onLongPress={openActions} onReactPill={handleReact} quoted={resolveQuoted(item)} myUserId={user?.id} />
              </>
            );
          }}
          contentContainerStyle={{
            paddingVertical: spacing.xl,
            // Inset the message column to line up with the input field's TEXT
            // (input row xl + input inner lg = 36), so the full-width agent reply
            // doesn't cram against the sidebar on the left or bleed to the far
            // right edge — it reads in the same column you type in.
            paddingHorizontal: spacing.xl + spacing.lg,
            flexGrow: 1,
            // Inverted coords: 'flex-start' = visual bottom.
            justifyContent: messages.length === 0 ? 'center' : 'flex-start',
            // Constrain to a Claude-like reading column on web so the thread
            // isn't stretched edge-to-edge on wide screens. Centered, and the
            // input row below uses the same width so they stay aligned.
            ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
          }}
          onScroll={handleScroll}
          // 16ms (~60fps) so the at-bottom test tracks fast streaming growth
          // instead of lagging behind it at 100ms.
          scrollEventThrottle={16}
          // iMessage/X keyboard feel: drag the thread down to interactively
          // dismiss the keyboard (iOS), plain on-drag dismiss on Android; and
          // taps on messages/actions register first-tap while the keyboard is
          // up instead of only dismissing it.
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          // Only follow new content when the user is already at the bottom, so
          // streaming tokens / incoming messages never interrupt scroll-back.
          // On web we set scrollTop synchronously in the same layout pass the
          // content grew (no animated post-paint catch-up frame) — that catch-up
          // is exactly what read as a jump. Native keeps scrollToEnd.
          // Inverted list keeps offset 0 (the latest message) pinned as content
          // grows — belt-and-braces re-pin for platforms where a large layout
          // change can drift a few px.
          onContentSizeChange={() => {
            if (!atBottomRef.current) return;
            flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
          }}
          // Variable-height rows mean an unread-anchor index may not be measured
          // yet; approximate by offset then retry once laid out.
          onScrollToIndexFailed={(info) => {
            flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => {
              try { flatListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.25 }); } catch {}
            }, 140);
          }}
          ListHeaderComponent={
            <>
              <ThinkingPill
                visible={agentTyping}
                status={agentStatus}
                agentName={partnerInfo?.name || partnerInfo?.user?.name || 'Agent'}
              />
              {humanTyping ? (
                <View style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                  <Text variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
                    {humanTyping.userName} is typing…
                  </Text>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            // Inverted containers flip their children; un-flip the empty state.
            // The failed-load case renders no invitation: the retry banner
            // above the list owns that state, and "Start the conversation"
            // over an unfetchable history would be a lie.
            initialLoadFailed ? null : (
              <View style={{ alignItems: 'center', transform: [{ scaleY: -1 }] }}>
                <Text variant="body" color={colors.textMuted}>Start the conversation</Text>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
        </>
      )}

      {/* Jump to latest — appears only when scrolled up, so streaming/incoming
          messages never force the viewport down while you're reading back. */}
      {showJump && !loading && (
        <Pressable
          onPress={() => stickToBottom(true)}
          style={({ pressed }) => ({
            position: 'absolute',
            alignSelf: 'center',
            bottom: 84,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            backgroundColor: colors.surfaceRaised,
            borderWidth: 0.5,
            borderColor: colors.borderSubtle,
            opacity: pressed ? 0.85 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' } as any : {}),
          })}
        >
          <Ionicons name="arrow-down" size={15} color={colors.text} />
          <Text variant="caption" color={colors.text}>Latest</Text>
        </Pressable>
      )}

      {/* Slash-command suggestions — only shown in agent conversations
          when the user has typed "/" at the start. The commands route to
          natural-language prompt prefixes the agent can handle today.
          Real first-class actions (true /save, /find with structured
          handlers) are next-session work. */}
      {(() => {
        if (!isAgentChat) return null;
        if (!text.startsWith('/')) return null;
        const COMMANDS: { name: string; hint: string; prompt: string }[] = [
          { name: '/find', hint: 'Find anything you\'ve seen before or want to know about', prompt: '/find ' },
          { name: '/summarize', hint: 'Summarize a URL, article, or recent thread', prompt: '/summarize ' },
          { name: '/save', hint: 'Save the last thing you sent for later', prompt: '/save ' },
          { name: '/today', hint: 'What did your agent find for you today', prompt: '/today' },
          { name: '/read', hint: 'Read me my morning brief', prompt: '/read' },
        ];
        const q = text.slice(1).toLowerCase();
        const filtered = q.length === 0 ? COMMANDS : COMMANDS.filter(c => c.name.slice(1).startsWith(q));
        if (filtered.length === 0) return null;
        return (
          <View style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xs,
            borderTopWidth: 0.5,
            borderTopColor: colors.borderSubtle,
            backgroundColor: colors.surface,
            gap: 2,
          }}>
            {filtered.map((cmd) => (
              <Pressable
                key={cmd.name}
                onPress={() => setText(cmd.prompt)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Text variant="bodyMedium" color={colors.accent} style={{ minWidth: 84 }}>{cmd.name}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>{cmd.hint}</Text>
              </Pressable>
            ))}
          </View>
        );
      })()}

      {/* Tap-and-hold action menu */}
      <MessageActions
        visible={!!actionMsg}
        isOwn={!!actionMsg && (actionMsg.sender?.id || actionMsg.senderId || actionMsg.sender_id) === user?.id}
        myReaction={(actionMsg?.reactions || []).find((r: any) => (r.user_id ?? r.userId) === user?.id)?.type || null}
        anchor={actionPos}
        onClose={() => { setActionMsg(null); setActionPos(null); }}
        onReact={(emoji) => handleReact(actionMsg, emoji)}
        onReply={() => setReplyingToState({ conversationId, message: actionMsg })}
        onCopy={() => handleCopyMsg(actionMsg)}
      />

      {/* Reply banner — the message you're replying to, with a cancel. */}
      {replyingTo ? (
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: spacing.md,
          paddingHorizontal: spacing.xl, paddingVertical: spacing.sm,
          borderTopWidth: 0.5, borderTopColor: colors.borderSubtle,
          ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
        }}>
          <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.accent }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" color={colors.accent} style={{ fontWeight: '700' }} numberOfLines={1}>
              Replying to {(replyingTo.sender?.id || replyingTo.senderId) === user?.id ? 'yourself' : (replyingTo.sender?.name || replyingTo.senderName || '')}
            </Text>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{String(replyingTo.content || replyingTo.text || '').slice(0, 100)}</Text>
          </View>
          <Pressable onPress={() => setReplyingToState(null)} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      {requestStatus === 'pending' ? (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          backgroundColor: colors.surface,
          ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
        }}>
          <Ionicons name="shield-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium" color={colors.text}>Message request</Text>
            <Text variant="caption" color={colors.textMuted}>Reply to accept this conversation.</Text>
          </View>
          <Button
            onPress={reportRequestSpam}
            disabled={reportingRequest}
            size="sm"
            variant="secondary"
          >
            {reportingRequest ? 'Reporting…' : 'Report spam'}
          </Button>
        </View>
      ) : null}

      {/* Input */}
      <View
        style={{
          flexDirection: 'row',
          // Center the send button vertically against the input (iMessage/Signal)
          // instead of pinning it to the bottom line of a 2-line field.
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          // The home-indicator inset only matters while the keyboard is DOWN —
          // with it up, keeping that 34px strip left a dead gap between the
          // composer and the keyboard (iMessage/Claude collapse it too).
          paddingBottom: keyboardVisible ? spacing.sm : (insets.bottom || spacing.md),
          // Match the message column width on web so the composer sits in the
          // same centered Claude-width column instead of stretching full-bleed.
          ...(Platform.OS === 'web' ? { maxWidth: 760, width: '100%', alignSelf: 'center' } as any : {}),
        }}
      >
        {pendingVoiceNote ? (
          // Conversation-owned session voice outbox. It remains visible until
          // prepared conversation accepts it or the user explicitly discards.
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}>
            <Pressable
              onPress={() => removePendingChatVoiceNote(
                pendingVoiceNote.userId,
                pendingVoiceNote.conversationId,
                pendingVoiceNote.id,
              )}
              disabled={attaching}
              accessibilityRole="button"
              accessibilityLabel="Discard voice note waiting to retry"
              hitSlop={10}
              style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error || '#ef4444'} />
            </Pressable>
            <View style={{
              flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm,
              backgroundColor: colors.surface, borderRadius: radius.lg,
              paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
              borderWidth: 0.5, borderColor: colors.glassBorder,
            }}>
              <Ionicons name="mic" size={18} color={colors.accent} />
              <Text variant="body" color={colors.text} style={{ fontVariant: ['tabular-nums'] as any }}>
                {`${Math.floor(pendingVoiceNote.recording.durationMs / 60000)}:${String(Math.floor(pendingVoiceNote.recording.durationMs / 1000) % 60).padStart(2, '0')}`}
              </Text>
              <Text variant="caption" color={colors.textMuted}>
                Ready to retry
              </Text>
            </View>
            <Pressable
              onPress={handleSendVoice}
              disabled={attaching || sending}
              accessibilityRole="button"
              accessibilityLabel="Send voice note waiting to retry"
              accessibilityState={{ disabled: attaching || sending, busy: attaching }}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: pressed ? colors.accentHover : colors.accent,
                alignItems: 'center', justifyContent: 'center',
                opacity: attaching || sending ? 0.45 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              {attaching
                ? <ActivityIndicator size="small" color={colors.textOnAccent} />
                : <Ionicons name="send" size={18} color={colors.textOnAccent} />}
            </Pressable>
          </View>
        ) : voice.recording ? (
          // Recording bar — WhatsApp/Signal style: discard, live timer, send.
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md }}>
            <Pressable
              onPress={handleCancelVoice}
              accessibilityRole="button"
              accessibilityLabel="Discard voice note"
              hitSlop={10}
              style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error || '#ef4444'} />
            </Pressable>
            <View style={{
              flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm,
              backgroundColor: colors.surface, borderRadius: radius.lg,
              paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
              borderWidth: 0.5, borderColor: colors.glassBorder,
            }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.error || '#ef4444' }} />
              <Text variant="body" color={colors.text} style={{ fontVariant: ['tabular-nums'] as any }}>
                {`${Math.floor(voice.elapsed / 60000)}:${String(Math.floor(voice.elapsed / 1000) % 60).padStart(2, '0')}`}
              </Text>
              <Text variant="caption" color={colors.textMuted}>Recording…</Text>
            </View>
            <Pressable
              onPress={handleSendVoice}
              disabled={attaching || sending}
              accessibilityRole="button"
              accessibilityLabel="Send voice note"
              accessibilityState={{ disabled: attaching || sending, busy: attaching }}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: pressed ? colors.accentHover : colors.accent,
                alignItems: 'center', justifyContent: 'center', opacity: attaching || sending ? 0.6 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="send" size={18} color={colors.textOnAccent} />
            </Pressable>
          </View>
        ) : (
          <>
            {/* Attach media (image / video). Same 44x44 circular button as the
                mic + send controls so all composer actions are uniformly sized
                (it was a bare icon with no button chrome, so it read smaller). */}
            <Pressable
              onPress={handleAttach}
              disabled={attaching || sending}
              accessibilityRole="button"
              accessibilityLabel="Attach media"
              accessibilityState={{ disabled: attaching || sending, busy: attaching }}
              hitSlop={8}
              style={({ pressed }) => ({
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderWidth: 0.5, borderColor: colors.glassBorder,
                alignItems: 'center', justifyContent: 'center',
                opacity: attaching || sending ? 0.5 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              {/* A spinner, not an ellipsis. The ellipsis was static, so an
                  upload in progress looked identical to an idle button that
                  had simply ignored the tap. */}
              {attaching
                ? <ActivityIndicator size="small" color={colors.accent} />
                : <Ionicons name="add-circle-outline" size={20} color={colors.accent} />}
            </Pressable>
            <TextInput
              placeholder="Type a message..."
              placeholderTextColor={colors.textMuted}
              value={text}
              {...kbProps}
              onChangeText={(t) => {
                setText(t);
                // Emit chat_typing at most once every 3s while the user is
                // actively typing. Other members see "X is typing…" below
                // the message list.
                if (sdk && conversationId && t.trim().length > 0) {
                  const now = Date.now();
                  if (now - lastTypingEmitRef.current > 3000) {
                    lastTypingEmitRef.current = now;
                    try { sdk.realtime.sendTyping?.(conversationId); } catch {}
                  }
                }
              }}
              multiline
              onKeyPress={(e: any) => {
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 0.5,
                borderColor: colors.glassBorder,
                borderRadius: radius.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                color: colors.text,
                maxHeight: 100,
                ...typography.input,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            {text.trim() ? (
              // Text present → send button. Dimmed while a send/stream is in
              // flight (the ref guard is what actually blocks re-entry — this
              // is just the visual affordance).
              <Pressable
                onPress={() => handleSend()}
                disabled={sending || attaching}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: sending || attaching, busy: sending }}
                style={({ pressed }) => ({
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: pressed ? colors.accentHover : colors.accent,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: sending || attaching ? 0.45 : 1,
                })}
              >
                <Ionicons name="send" size={18} color={colors.textOnAccent} />
              </Pressable>
            ) : voice.supported ? (
              // Empty input → hold-free tap-to-record mic on web and native.
              <Pressable
                onPress={handleStartVoice}
                disabled={sending || attaching}
                accessibilityRole="button"
                accessibilityLabel="Record a voice note"
                accessibilityState={{ disabled: sending || attaching }}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                  borderWidth: 0.5, borderColor: colors.glassBorder,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: sending || attaching ? 0.5 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="mic-outline" size={20} color={colors.accent} />
              </Pressable>
            ) : (
              // No browser MediaRecorder support → inert send.
              <Pressable
                onPress={() => handleSend()}
                disabled
                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceHover, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="send" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </>
        )}
      </View>
    </KeyboardAvoid>
  );
}

// #187: contain a crash to this screen so the tab bar and navigation survive.
// expo-router renders this instead of the route when it throws.
export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
