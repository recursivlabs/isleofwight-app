import * as React from 'react';
import { View, Pressable, Modal, TextInput, FlatList, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useConversations } from '../lib/hooks';
import { useColors } from '../lib/theme';
import { spacing, radius, typography } from '../constants/theme';
import { ORG_ID, SITE_URL } from '../lib/recursiv';
import { resolvePersonalAgent } from '../lib/resolvePersonalAgent';
import { buildPostContextPrompt } from '../lib/askAgent';
import { isAiActor } from '../lib/models';
import { useToast } from './Toast';
import { chatConversationHref } from '../lib/chatNavigation';
import { conversationParticipantId } from '../lib/chatRequests';

/**
 * "Send post" sheet — share a Minds post into a DM (X/IG style). Your personal
 * AI is the default recipient; sending to it seeds a "give me basic context"
 * prompt. Any other recipient just receives the post as a rich embed.
 */
export function SharePostSheet({ visible, post, onClose }: { visible: boolean; post: any; onClose: () => void }) {
  const colors = useColors();
  const router = useRouter();
  const toast = useToast();
  const { sdk, user } = useAuth();
  const { conversations } = useConversations();
  const [query, setQuery] = React.useState('');
  const [people, setPeople] = React.useState<any[]>([]);
  const [searchState, setSearchState] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [searchAttempt, setSearchAttempt] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setQuery('');
      setPeople([]);
      setSearchState('idle');
    }
  }, [visible]);

  // People search when typing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: searchAttempt intentionally re-runs the same query after the user taps Retry.
  React.useEffect(() => {
    const trimmedQuery = query.trim();
    if (!visible || !sdk || !trimmedQuery) {
      setPeople([]);
      setSearchState('idle');
      return;
    }
    let cancelled = false;
    // Results belong to an exact query. Leaving Alice's matches visible while
    // a Bob request fails makes the share sheet offer the wrong recipients.
    setPeople([]);
    setSearchState('loading');
    const t = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: trimmedQuery, limit: 8, organization_id: ORG_ID || undefined } as any);
        if (!cancelled) {
          setPeople(res.data || []);
          setSearchState('success');
        }
      } catch {
        if (!cancelled) {
          setPeople([]);
          setSearchState('error');
        }
      }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [visible, query, sdk, searchAttempt]);

  const searchEmpty = query.trim() ? (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}>
      {searchState === 'error' ? (
        <>
          <Text variant="bodyMedium" color={colors.textSecondary}>Couldn&apos;t search people</Text>
          <Pressable
            onPress={() => setSearchAttempt(attempt => attempt + 1)}
            accessibilityRole="button"
            accessibilityLabel="Retry people search"
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: colors.errorMuted,
              opacity: pressed ? 0.7 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text variant="bodyMedium" color={colors.error}>Retry</Text>
          </Pressable>
        </>
      ) : searchState === 'success' ? (
        <Text variant="bodyMedium" color={colors.textMuted}>No people found</Text>
      ) : (
        <Text variant="bodyMedium" color={colors.textMuted}>Searching people…</Text>
      )}
    </View>
  ) : null;

  const postId = post?.id;
  const postUrl = `${SITE_URL}/post/${postId}`;
  const canShareExternally = Platform.OS !== 'web'
    || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');

  const copyPostLink = React.useCallback(async () => {
    try {
      await Clipboard.setStringAsync(postUrl);
      toast.show('Link copied');
    } catch {
      toast.show('Could not copy link', 'error');
    }
  }, [postUrl, toast]);

  const sharePostExternally = React.useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: post?.title || 'Post on Minds', url: postUrl });
      } else {
        await Share.share({ message: postUrl, url: postUrl });
      }
      onClose();
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') {
        toast.show('Could not share post', 'error');
      }
    }
  }, [onClose, post?.title, postUrl, toast]);

  const sendToUser = React.useCallback(async (userId: string, label: string) => {
    if (!sdk || !userId || busy) return;
    setBusy(userId);
    try {
      const dm: any = await (sdk as any).chat.dm({ user_id: userId, organization_id: ORG_ID || undefined });
      const convoId = dm?.data?.id;
      if (!convoId) throw new Error('Conversation creation returned no id');
      await sdk.chat.send({ conversation_id: convoId, content: postUrl } as any);
      onClose();
      router.push(chatConversationHref(convoId, { focused: '1' }) as any);
    } catch {
      // Keep the sheet open so the same recipient remains a one-tap retry.
      // This used to clear the spinner with no explanation, which looked like
      // the row had simply ignored the tap.
      toast.show(`Could not send post to ${label}. Try again.`, 'error');
    } finally { setBusy(null); }
  }, [sdk, busy, postUrl, onClose, router, toast]);

  const sendToAi = React.useCallback(async () => {
    if (!sdk || busy) return;
    setBusy('ai');
    try {
      const agent = await resolvePersonalAgent(sdk);
      if (!agent) throw new Error('Personal agent is unavailable');
      const dm: any = await (sdk as any).chat.dm({ user_id: agent.id, organization_id: ORG_ID || undefined });
      const convoId = dm?.data?.id;
      if (!convoId) throw new Error('Conversation creation returned no id');
      const author = post?.author?.username || post?.author?.name || 'someone';
      const prompt = buildPostContextPrompt({ author, content: post?.content || post?.body || '', url: postUrl });
      await sdk.chat.send({ conversation_id: convoId, content: prompt } as any);
      onClose();
      router.push(chatConversationHref(convoId, { focused: '1' }) as any);
    } catch {
      toast.show('Could not send post to Minds AI. Try again.', 'error');
    } finally { setBusy(null); }
  }, [sdk, busy, post, postUrl, onClose, router, toast]);

  // This sheet sends to a person, not to the listed conversation. Never turn
  // a group title into a one-tap private send to its first member.
  const recentDms = React.useMemo(() => {
    const viewerId = user?.id;
    if (!viewerId) return [];
    return (conversations || [])
      .map((c: any) => {
        const declaredType = c?.type ?? c?.conversation_type;
        if (declaredType != null && declaredType !== 'one_on_one') return null;
        const members: any[] = [c?.participants, c?.members]
          .find(value => Array.isArray(value) && value.length > 0) || [];
        if (members.some(member => !conversationParticipantId(member))) return null;
        const others = members.filter(member => conversationParticipantId(member) !== viewerId);
        if (others.length !== 1) return null;
        const other = others[0];
        const id = conversationParticipantId(other);
        const ou = other.user || other;
        return { id, name: ou.name || ou.username || 'Conversation', avatar: ou.image || null, isAi: isAiActor(ou) };
      })
      .filter(Boolean)
      .slice(0, 20);
  }, [conversations, user?.id]);

  if (!visible) return null;

  const Row = ({ id, name, avatar, subtitle, onPress, ai }: any) => (
    <Pressable
      onPress={onPress}
      disabled={!!busy}
      accessibilityRole="button"
      accessibilityLabel={`Send post to ${name}`}
      style={({ pressed, hovered }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: pressed || hovered ? colors.surfaceHover : 'transparent', opacity: busy && busy !== id ? 0.5 : 1, ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}>
      {ai ? (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
      ) : <Avatar uri={avatar} name={name} size="md" />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
        {subtitle ? <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {busy === id ? <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} /> : <Ionicons name="send" size={16} color={colors.accent} />}
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', paddingBottom: spacing.xl, ...(Platform.OS === 'web' ? { maxWidth: 560, width: '100%', alignSelf: 'center', borderRadius: radius.xl, marginBottom: spacing.xl } as any : {}) }}>
          <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderSubtle }} />
          </View>
          <Text variant="h3" style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.md }}>Share post</Text>
          <View style={{ flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
            <Pressable
              onPress={copyPostLink}
              accessibilityRole="button"
              accessibilityLabel="Copy post link"
              style={({ pressed, hovered }: any) => ({
                flex: 1,
                minHeight: 72,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.glassBorder,
                backgroundColor: pressed || hovered ? colors.surfaceHover : colors.surface,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="link-outline" size={22} color={colors.accent} />
              <Text variant="bodyMedium">Copy link</Text>
            </Pressable>
            {canShareExternally ? (
              <Pressable
                onPress={sharePostExternally}
                accessibilityRole="button"
                accessibilityLabel="Share post with another app"
                style={({ pressed, hovered }: any) => ({
                  flex: 1,
                  minHeight: 72,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: spacing.xs,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.glassBorder,
                  backgroundColor: pressed || hovered ? colors.surfaceHover : colors.surface,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Ionicons name="share-outline" size={22} color={colors.accent} />
                <Text variant="bodyMedium">Share elsewhere</Text>
              </Pressable>
            ) : null}
          </View>
          {sdk ? (
            <>
              <Text variant="bodyMedium" style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
                Send in Minds
              </Text>
              <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput placeholder="Search people…" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery}
                    style={{ flex: 1, color: colors.text, ...typography.input, paddingVertical: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }} />
                </View>
              </View>
              <FlatList
                data={query.trim() ? people : recentDms}
                keyExtractor={(item: any, i) => String(item.id ?? i)}
                keyboardShouldPersistTaps="always"
                ListHeaderComponent={!query.trim() ? (
                  <Row id="ai" name="Minds AI" ai subtitle="Get context about this post — your default" onPress={sendToAi} />
                ) : null}
                ListEmptyComponent={searchEmpty}
                renderItem={({ item }: any) => (
                  <Row id={item.id} name={item.name || item.username || 'Unknown'} avatar={item.image || item.avatar}
                    subtitle={item.username ? `@${item.username}` : (item.isAi ? 'Agent' : undefined)}
                    onPress={() => sendToUser(item.id, item.name || item.username || 'this person')} />
                )}
              />
            </>
          ) : (
            <Text variant="caption" color={colors.textMuted} style={{ paddingHorizontal: spacing.xl }}>
              Anyone with this link can open the post.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
