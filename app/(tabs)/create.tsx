import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
  Modal,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { haptics } from '../../lib/haptics';
import { uploadMediaBatch, uploadMediaBlob } from '../../lib/mediaUpload';
import { uploadVideo, VideoNotEntitledError } from '../../lib/video';
import { VideoPlayer } from '../../components/VideoPlayer';
const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;
const getDocumentPicker = () => Platform.OS !== 'web' ? require('expo-document-picker') : null;
import { Text } from '../../components';
import { Container } from '../../components/Container';
import { MentionPicker, useMentions } from '../../components/MentionPicker';
import { LinkPreview } from '../../components/LinkPreview';
import {
  getLatestDraft,
  saveDraftConfirmed,
  deleteDraftConfirmed,
  clearDraftConfirmed,
} from '../../lib/drafts';
import { showToast } from '../../components/Toast';
import { captureException } from '../../lib/monitoring';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../lib/auth';
import { communityDescription } from '../../lib/models';
import { useCommunities } from '../../lib/hooks';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography } from '../../constants/theme';
import { useColors, useInputKeyboardProps } from '../../lib/theme';
import { invalidate } from '../../lib/cache';
import { useKeyboardVisible } from '../../lib/useKeyboardVisible';
import { groupAdmin } from '../../lib/groupAdmin';

// Consumer Create surface: Post is the only first-class mode. Community
// stays as a reachable mode via ?mode=community deep-link from Discover's
// "+ Start a community" button — but the mode tab bar is hidden. Article /
// Agent / App authoring deferred to the Pro-tier upsell email campaign;
// those branches stay typed only to avoid touching too much during this
// pass.
type Mode = 'post' | 'article' | 'agent' | 'app' | 'community';

const MODES: { key: Mode; label: string }[] = [
  { key: 'post', label: 'Post' },
];

const MAX_IMAGES = 10; // matches the server media_urls cap
const MAX_TAGS = 10; // matches the server tag_names cap

// X-style media grid geometry. X uses a 2px hairline gap between tiles and a
// single large-radius frame clipping the whole block.
const GRID_GAP = 2;
const GRID_RADIUS = radius.xl; // ~16px outer frame radius, matching X
const GRID_HEIGHT = 200; // fixed frame height — compact so media never overtakes the text area

/**
 * Small circular remove control overlaid on a media tile (X-style): a
 * semi-transparent dark disc with a white ×, top-right of the tile.
 */
function RemoveMediaButton({
  onPress,
  small,
}: {
  onPress: () => void;
  small?: boolean;
}) {
  const dim = small ? 28 : 30;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }: any) => ({
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: dim,
        height: dim,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        opacity: pressed ? 0.7 : 1,
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer', backdropFilter: 'blur(6px)' } as any) : {}),
      })}
    >
      <Ionicons name="close" size={small ? 16 : 18} color="#ffffff" />
    </Pressable>
  );
}

/** Format seconds → m:ss for the video duration pill. */
function fmtDuration(secs?: number | null): string | null {
  if (secs == null || !Number.isFinite(secs) || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Round, accent-tinted icon button for the composer toolbar. Goes gold-tinted
 * when its feature is active (media attached, tags present, etc.).
 */
function ToolbarIconButton({
  icon,
  onPress,
  colors,
  active,
  accessibilityLabel,
  expanded,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  active?: boolean;
  accessibilityLabel: string;
  expanded?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      {...(Platform.OS === 'web' && expanded !== undefined ? { 'aria-expanded': expanded } as any : {})}
      style={({ pressed }: any) => ({
        width: 36,
        height: 36,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.accentMuted : pressed ? colors.surfaceHover : 'transparent',
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
      })}
    >
      <Ionicons name={icon} size={21} color={active ? colors.accent : colors.textSecondary} />
    </Pressable>
  );
}

/**
 * X-style character counter. Below ~20% remaining it reveals the live count;
 * otherwise just a tiny dot ring. Goes gold near the limit and red over it.
 */
function CharCounterRing({
  used,
  limit,
  colors,
}: {
  used: number;
  limit: number;
  colors: ReturnType<typeof useColors>;
}) {
  const remaining = limit - used;
  const near = remaining <= 240;
  const over = remaining < 0;
  const color = over ? colors.error : remaining <= 60 ? colors.accent : colors.textMuted;
  if (!near) {
    // Just a small progress dot until you approach the limit.
    return (
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: colors.borderSubtle,
        }}
      />
    );
  }
  return (
    <Text
      variant="caption"
      color={color}
      style={{ fontSize: 13, fontVariant: ['tabular-nums'] as any }}
    >
      {remaining}
    </Text>
  );
}

export default function CreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ communityId?: string; communityName?: string; quote?: string; mode?: string; quotePostId?: string; quoteAuthor?: string; quoteContent?: string }>();
  // X-style quote post: when launched from a post's "Quote Post" action, the
  // composer is pre-seeded with the quoted post id (set as reposted_from_id on
  // submit) + a light author/content snippet to render the embedded card.
  const quotePostId = typeof params.quotePostId === 'string' ? params.quotePostId : undefined;
  const quoteAuthor = typeof params.quoteAuthor === 'string' ? params.quoteAuthor : '';
  const quoteContent = typeof params.quoteContent === 'string' ? params.quoteContent : '';
  const { sdk, user } = useAuth();
  const colors = useColors();
  const kbProps = useInputKeyboardProps();
  const keyboardVisible = useKeyboardVisible();
  const initialMode: Mode = (params.mode === 'community' || params.mode === 'article' || params.mode === 'agent' || params.mode === 'app') ? params.mode : 'post';
  const [mode, setMode] = React.useState<Mode>(initialMode);

  // Restore draft on mount
  const draftRef = React.useRef<string | null>(null);
  // The exact content we restored. Autosave compares against this and skips
  // while the field is untouched — otherwise restoring a draft would re-stamp
  // it with a fresh timestamp on every open, making it immortal (the old
  // "posted text keeps coming back" bug).
  const restoredContentRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const draft = getLatestDraft();
    // Skip draft restore when quoting — the composer is intentionally a fresh
    // comment on the quoted post, not a continuation of an old draft.
    if (draft && !params.communityId && !quotePostId) {
      setContent(draft.content);
      restoredContentRef.current = draft.content;
      if (draft.communityId) setSelectedCommunity({ id: draft.communityId, name: draft.communityName });
      draftRef.current = draft.id;
    }
  }, []);

  const [content, setContent] = React.useState(params.quote || '');
  const [draftSaveState, setDraftSaveState] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const draftSaveAttemptRef = React.useRef(0);
  const draftSavedHideRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Order this editor's storage operations without changing the shared draft
  // store's synchronous behavior or sign-out cleanup.
  const draftWriteQueue = React.useRef<Promise<void>>(Promise.resolve());
  const draftOwner = React.useRef(user?.id);
  draftOwner.current = user?.id;
  const queueDraftWrite = React.useCallback(<T,>(write: () => Promise<T>): Promise<T> => {
    const result = draftWriteQueue.current.then(write, write);
    draftWriteQueue.current = result.then(() => {}, () => {});
    return result;
  }, []);
  const editorFocused = React.useRef(true);
  const editorMounted = React.useRef(true);
  const navigationRevision = React.useRef(0);
  useFocusEffect(React.useCallback(() => {
    editorFocused.current = true;
    return () => {
      editorFocused.current = false;
      navigationRevision.current += 1;
    };
  }, []));
  const POST_CHAR_LIMIT = 5000;
  const charsRemaining = POST_CHAR_LIMIT - content.length;
  const [isNsfw, setIsNsfw] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);
  // Photo/video/audio consolidated behind one toolbar paperclip.
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [mediaUris, setMediaUris] = React.useState<string[]>([]);
  // Natural aspect ratio of a SINGLE selected image, captured on load, so the
  // preview shows the whole image (X-style) instead of a cropped fixed box.
  const [media1Aspect, setMedia1Aspect] = React.useState<number | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = React.useState(false);
  // Audio attachment (voice posts / "confessionals"). Mutually exclusive with
  // image/video; uploaded via the same media path (the .mp3/.m4a extension makes
  // the server store it as type='audio' → renders as the inline audio player).
  const [mediaIsAudio, setMediaIsAudio] = React.useState(false);
  const [audioMime, setAudioMime] = React.useState('audio/mpeg');
  const [audioName, setAudioName] = React.useState<string | null>(null);
  // Duration of the selected video, in seconds, for the X-style duration pill.
  const [videoDuration, setVideoDuration] = React.useState<number | null>(null);
  const mediaUri = mediaUris[0] ?? null; // first item — used for video + article cover
  const [videoPct, setVideoPct] = React.useState<number | null>(null);
  const { mentionQuery, showMentions, insertMention } = useMentions(content, setContent);
  const [selectedCommunity, setSelectedCommunity] = React.useState<any>(
    params.communityId ? { id: params.communityId, name: params.communityName || 'Group' } : null
  );
  const [showCommunityPicker, setShowCommunityPicker] = React.useState(false);
  const [communitySearch, setCommunitySearch] = React.useState('');
  const { communities } = useCommunities(30);

  const persistCurrentDraft = React.useCallback(async (attempt: number): Promise<boolean> => {
    if (draftSaveAttemptRef.current !== attempt) return false;
    setDraftSaveState('saving');
    const result = await queueDraftWrite(() => {
      // An old debounce may already be queued behind a slow device write.
      if (draftSaveAttemptRef.current !== attempt || draftOwner.current !== user?.id) return Promise.resolve(null);
      return saveDraftConfirmed(content, selectedCommunity?.id, selectedCommunity?.name);
    });
    if (!result || draftSaveAttemptRef.current !== attempt || draftOwner.current !== user?.id) return false;

    draftRef.current = result.id;
    if (draftSavedHideRef.current) clearTimeout(draftSavedHideRef.current);
    if (!result.persisted) {
      setDraftSaveState('failed');
      return false;
    }

    setDraftSaveState('saved');
    draftSavedHideRef.current = setTimeout(() => setDraftSaveState('idle'), 1500);
    return true;
  }, [content, selectedCommunity?.id, selectedCommunity?.name, queueDraftWrite, user?.id]);
  const persistLatestDraft = React.useRef(persistCurrentDraft);
  persistLatestDraft.current = persistCurrentDraft;

  React.useEffect(() => {
    editorMounted.current = true;
    return () => {
      editorMounted.current = false;
      draftSaveAttemptRef.current += 1;
      if (draftSavedHideRef.current) clearTimeout(draftSavedHideRef.current);
    };
  }, []);

  // Keep selectedCommunity in sync with incoming params. Expo Router reuses
  // the Create screen across navigations, so the initial useState above only
  // applies on first mount — subsequent "Create Post" from inside a community
  // wouldn't update the selection otherwise.
  // Debounced autosave: while the user types, save the draft every
  // ~1.2s of idle. Flashes a small "Saved" indicator so the user knows
  // their work is preserved even if they navigate away accidentally.
  React.useEffect(() => {
    const attempt = ++draftSaveAttemptRef.current;
    if (!content.trim()) {
      if (draftSavedHideRef.current) clearTimeout(draftSavedHideRef.current);
      setDraftSaveState('idle');
      // Emptying the composer is an INTENTIONAL discard — drop the stored draft
      // so abandoned text doesn't resurrect on the next open. (Previously this
      // just early-returned, leaving the old draft to restore forever, so you
      // couldn't get rid of it.) Guarded so the initial empty mount, before a
      // draft is restored, is a harmless no-op.
      if (draftRef.current) {
        const draftId = draftRef.current;
        void queueDraftWrite(() => {
          if (draftSaveAttemptRef.current !== attempt || draftRef.current !== draftId) return Promise.resolve(null);
          return deleteDraftConfirmed(draftId);
        }).then(discarded => {
          // Ignore a stale completion if the user resumed typing or another
          // save replaced this draft while device storage was responding.
          if (discarded === null || draftSaveAttemptRef.current !== attempt || draftRef.current !== draftId) return;
          if (discarded) {
            draftRef.current = null;
            restoredContentRef.current = null;
          } else {
            setDraftSaveState('failed');
            showToast('Draft not discarded. Try Cancel again.', 'error');
          }
        });
      }
      return;
    }
    // Don't re-save a draft we just restored and the user hasn't touched.
    if (content === restoredContentRef.current) return;
    const timer = setTimeout(() => {
      void persistCurrentDraft(attempt);
    }, 1200);
    return () => clearTimeout(timer);
  }, [content, persistCurrentDraft, queueDraftWrite]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedCommunity?.id is read only as a redundant-write guard and must NOT be a dependency. This reacts to the ROUTE naming a community; depending on the selection would snap the composer back to the route's community every time the author picked a different one.
  React.useEffect(() => {
    if (params.communityId && selectedCommunity?.id !== params.communityId) {
      setSelectedCommunity({ id: params.communityId, name: params.communityName || 'Group' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.communityId, params.communityName]);

  const [agentName, setAgentName] = React.useState('');
  const [agentBio, setAgentBio] = React.useState('');
  const [agentPrompt, setAgentPrompt] = React.useState('');
  const [agentModelIdx, setAgentModelIdx] = React.useState(0);
  const [showModelMenu, setShowModelMenu] = React.useState(false);
  const MODELS = [
    { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', provider: 'Anthropic' },
    { id: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6', provider: 'Anthropic' },
    { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', provider: 'Anthropic' },
    { id: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', provider: 'Google' },
    { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash', provider: 'Google' },
    { id: 'openai/gpt-5.4', label: 'GPT-5.4', provider: 'OpenAI' },
    { id: 'openai/o3', label: 'o3', provider: 'OpenAI' },
  ];

  const [articleTitle, setArticleTitle] = React.useState('');
  const [articleContent, setArticleContent] = React.useState('');

  const [appName, setAppName] = React.useState('');
  const [appDesc, setAppDesc] = React.useState('');

  const [communityName, setCommunityName] = React.useState('');
  const [bannerUri, setBannerUri] = React.useState<string | null>(null);
  const [communityDesc, setCommunityDesc] = React.useState('');
  const [communityPrivate, setCommunityPrivate] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const submitInFlight = React.useRef(false);
  const [cancelling, setCancelling] = React.useState(false);
  const cancelInFlight = React.useRef(false);
  const runCancel = async (close: () => Promise<void>) => {
    if (cancelInFlight.current) return;
    cancelInFlight.current = true;
    setCancelling(true);
    try {
      await close();
    } finally {
      cancelInFlight.current = false;
      setCancelling(false);
    }
  };
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  // Inline error banner. Alert.alert is a no-op on web (React Native Web),
  // so failures were silent — this surfaces them in-UI on every platform.
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Avatar state for agent/app/community creation
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);

  // A revision includes accepted edits, not upload progress or layout updates.
  // Reference identity also notices editing away and then back to the same text.
  const editorSnapshot = React.useMemo(() => ({
    content, mode, mediaUris, mediaIsVideo, mediaIsAudio, audioMime, audioName,
    tags, tagInput, isNsfw, communityId: selectedCommunity?.id,
    communityName: selectedCommunity?.name, quotePostId, userId: user?.id,
  }), [content, mode, mediaUris, mediaIsVideo, mediaIsAudio, audioMime, audioName,
    tags, tagInput, isNsfw, selectedCommunity?.id, selectedCommunity?.name, quotePostId, user?.id]);
  const latestEditor = React.useRef(editorSnapshot);
  latestEditor.current = editorSnapshot;
  const acceptedPostEditor = React.useRef<typeof editorSnapshot | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };
  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const handlePickAvatar = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) setAvatarUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setAvatarUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch (error) {
      captureException(error, { action: 'create', mode, step: 'pick-avatar' });
      showError('Could not open your image library. Try again.');
    }
  };

  const handlePickBanner = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [3, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) setBannerUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setBannerUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch (error) {
      captureException(error, { action: 'create', mode, step: 'pick-avatar' });
      showError('Could not open your image library. Try again.');
    }
  };

  // One place that turns web File objects into composer media, shared by the
  // file picker, paste and drag-and-drop. Keeping it in a single function is
  // what lets paste and drop behave exactly like picking a file, including the
  // video-duration probe -- three near-copies would drift.
  const acceptWebFiles = React.useCallback((files: File[], allowMulti: boolean) => {
    const usable = files.filter((f) => /^(image|video)\//.test(f.type || ''));
    if (!usable.length) return;
    setMediaIsAudio(false);
    setAudioName(null);
    const vid = usable.find((f) => (f.type || '').startsWith('video/'));
    if (vid) {
      const url = URL.createObjectURL(vid);
      setMediaUris([url]);
      setMediaIsVideo(true);
      setVideoDuration(null);
      // Pull duration off the video metadata for the duration pill.
      try {
        const probe = document.createElement('video');
        probe.preload = 'metadata';
        probe.onloadedmetadata = () => setVideoDuration(probe.duration || null);
        probe.src = url;
      } catch {}
    } else {
      const imgs = usable.filter((f) => (f.type || '').startsWith('image/'));
      setMediaUris(imgs.slice(0, allowMulti ? MAX_IMAGES : 1).map((f) => URL.createObjectURL(f)));
      setMediaIsVideo(false);
      setVideoDuration(null);
    }
  }, []);

  // Paste and drag-and-drop, web only. Both were simply absent: copying a
  // screenshot and hitting paste did nothing, and dragging a file onto the
  // window made the BROWSER navigate to it, losing whatever had been typed.
  //
  // These listen on the document rather than a single element because the
  // composer is a stack of nested views and a person aims at the general area,
  // not at the text box. The screen only mounts while composing, so there is no
  // risk of hijacking a paste elsewhere in the app.
  const [dropActive, setDropActive] = React.useState(false);
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const allowMulti = mode === 'post';

    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files || []);
      if (!files.length) return;
      // Only swallow the paste when it actually carries an image, so pasting
      // text into the composer still works normally.
      e.preventDefault();
      acceptWebFiles(files, allowMulti);
    };
    // dragover must be cancelled too, or the drop never fires and the browser
    // opens the file instead.
    const onDragOver = (e: DragEvent) => {
      if (!Array.from(e.dataTransfer?.types || []).includes('Files')) return;
      e.preventDefault();
      setDropActive(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget) return; // still inside the window
      setDropActive(false);
    };
    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files || []);
      setDropActive(false);
      if (!files.length) return;
      e.preventDefault();
      acceptWebFiles(files, allowMulti);
    };

    document.addEventListener('paste', onPaste);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, [acceptWebFiles, mode]);

  const handlePickImage = async (kind: 'image' | 'video' | 'all' = 'all') => {
    try {
      // Posts allow multiple images; a video is always single. Article cover is single.
      const allowMulti = mode === 'post' && kind !== 'video';
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: kind === 'video' ? picker.MediaTypeOptions.Videos
            : kind === 'image' ? picker.MediaTypeOptions.Images
            : picker.MediaTypeOptions.All,
          allowsMultipleSelection: allowMulti,
          selectionLimit: allowMulti ? MAX_IMAGES : 1,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.length) {
          const assets = result.assets;
          setMediaIsAudio(false);
          setAudioName(null);
          const vid = assets.find((a: any) => a.type === 'video');
          if (vid) {
            setMediaUris([vid.uri]);
            setMediaIsVideo(true);
            // expo-image-picker reports duration in milliseconds.
            setVideoDuration(vid.duration ? vid.duration / 1000 : null);
          } else {
            setMediaUris(assets.map((a: any) => a.uri).slice(0, allowMulti ? MAX_IMAGES : 1));
            setMediaIsVideo(false);
            setVideoDuration(null);
          }
        }
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = kind === 'video' ? 'video/*' : kind === 'image' ? 'image/*' : 'image/*,video/*';
        if (allowMulti) input.multiple = true;
        input.onchange = (e: any) => acceptWebFiles(Array.from(e.target?.files || []), allowMulti);
        input.click();
      }
    } catch (error) {
      captureException(error, { action: 'create', mode, step: 'pick-media', kind });
      const library = kind === 'video' ? 'video' : kind === 'image' ? 'photo' : 'media';
      showError(`Could not open your ${library} library. Try again.`);
    }
  };

  // Attach an audio file (voice post). Native uses the document picker; web a
  // file input. The audio mime drives the upload content-type so the stored URL
  // gets an audio extension (→ server type='audio' → inline audio player).
  const handlePickAudio = async () => {
    try {
      const dp = getDocumentPicker();
      if (dp) {
        const res = await dp.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true, multiple: false });
        const asset = res?.assets?.[0];
        if (asset) {
          setMediaUris([asset.uri]);
          setMediaIsAudio(true);
          setMediaIsVideo(false);
          setVideoDuration(null);
          setAudioMime(asset.mimeType || 'audio/mpeg');
          setAudioName(asset.name || 'Audio');
        }
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (e: any) => {
          const file: File | undefined = e.target?.files?.[0];
          if (!file) return;
          setMediaUris([URL.createObjectURL(file)]);
          setMediaIsAudio(true);
          setMediaIsVideo(false);
          setVideoDuration(null);
          setAudioMime(file.type || 'audio/mpeg');
          setAudioName(file.name || 'Audio');
        };
        input.click();
      }
    } catch (error) {
      captureException(error, { action: 'create', mode, step: 'pick-audio' });
      showError('Could not open your audio files. Try again.');
    }
  };

  const canSubmit = mode === 'post' ? (content.trim().length > 0 || !!mediaUri || !!quotePostId)
    : mode === 'article' ? (articleTitle.trim().length > 0 && articleContent.trim().length > 0)
    : mode === 'agent' ? (agentName.trim().length > 0 && agentBio.trim().length > 0)
    : mode === 'app' ? (appName.trim().length > 0 && appDesc.trim().length > 0)
    : (communityName.trim().length > 0 && communityDesc.trim().length > 0);

  const handleSubmit = async () => {
    // Keyboard submission must honor the same validation as the button. A ref
    // also blocks a second event before React renders the disabled state.
    if (!sdk || submitInFlight.current || cancelInFlight.current || !canSubmit || charsRemaining < 0) return;
    const submittedEditor = latestEditor.current;
    const submittedNavigation = navigationRevision.current;
    // Leaving a persistent tab revokes navigation, not cleanup of its unchanged
    // accepted post. A replaced/unmounted editor or newer revision is different.
    const ownsSubmittedEditor = () => editorMounted.current && latestEditor.current === submittedEditor;
    const canNavigateAfterSubmit = () => editorFocused.current
      && navigationRevision.current === submittedNavigation;
    const keepNewerDraft = async () => {
      if (!editorFocused.current || navigationRevision.current !== submittedNavigation
        || latestEditor.current.userId !== submittedEditor.userId) return;
      let persisted = true;
      if (latestEditor.current.mode === 'post' && latestEditor.current.content.trim()) {
        // In particular, a newer edit made during clearDraftConfirmed must be
        // saved AFTER that removal, not erased by its late completion.
        persisted = await persistLatestDraft.current(++draftSaveAttemptRef.current);
      }
      if (editorFocused.current && latestEditor.current.userId === submittedEditor.userId) {
        showToast(persisted
          ? 'Posted. Your newer edits are still in the composer.'
          : 'Posted. Newer edits are still here, but the draft was not saved.', persisted ? 'success' : 'error');
      }
    };
    submitInFlight.current = true;
    setSubmitting(true);
    try {
      if (mode === 'post') {
        // Community is optional. Default = global / public timeline,
        // matching legacy Minds behavior and modern social conventions
        // (Twitter, TikTok don't require communities). If a community
        // is selected, post goes there; otherwise it's public.
        // A quote post is valid even with empty content (the quoted post is the
        // payload); a normal post still needs content or media.
        if (!content.trim() && !mediaUri && !quotePostId) {
          setSubmitting(false);
          return;
        }
        let mediaUrls: string[] | undefined;
        if (!mediaIsVideo && mediaUris.length > 0) {
          const { urls, failed: mediaFailed } = await uploadMediaBatch({
            uris: mediaUris,
            sdk,
            // Audio: use the picked mime (native blobs often have an empty
            // type) so the upload key gets a .mp3/.m4a extension → type='audio'.
            contentTypeFor: (blob) => (mediaIsAudio ? audioMime : (blob.type || 'image/jpeg')),
            onError: showError,
          });
          // #191: this used to fall through and publish regardless. If every
          // image failed, `urls` is empty and the post shipped with NO media —
          // a blank or text-only post the user believed carried their photos,
          // already public and already in other people's feeds. A partial
          // failure was worse: it published a subset silently.
          //
          // Abort instead, exactly as the video path below already does. The
          // composer keeps its state, so the images are still attached and the
          // user can retry rather than re-picking them.
          if (mediaFailed) {
            setSubmitting(false);
            return;
          }
          if (urls.length) mediaUrls = urls;
        }
        if (mediaUri && mediaIsVideo) {
          try {
            setVideoPct(0);
            const { hlsUrl } = await uploadVideo({
              fileUri: mediaUri,
              title: content.trim().slice(0, 80) || 'Video',
              onProgress: setVideoPct,
            });
            mediaUrls = [...(mediaUrls || []), hlsUrl];
          } catch (err: any) {
            setVideoPct(null);
            setSubmitting(false);
            // Not entitled → send them to the upgrade flow instead of a dead-end error.
            if (err instanceof VideoNotEntitledError) {
              router.push('/upgrade' as any);
            } else {
              showError(err?.message || 'Video could not be uploaded.');
            }
            return;
          }
          setVideoPct(null);
        }
        await sdk.posts.create({
          // Quote posts may carry empty content (the embedded post is the
          // payload); only pad to a space for plain posts where the server
          // historically required non-empty content.
          content: content.trim() || (quotePostId ? '' : ' '),
          reposted_from_id: quotePostId || undefined,
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: mediaUrls,
          tag_names: tags.length > 0 ? tags : undefined,
          is_nsfw: isNsfw || undefined,
        } as any);
        acceptedPostEditor.current = submittedEditor;
        invalidate('posts:following:20');
        invalidate('posts:personal:20');
        if (!ownsSubmittedEditor()) {
          await keepNewerDraft();
          return;
        }
        // Drain earlier autosaves and fence debounces before clearing. Keep
        // the editor intact until storage answers so edits made during that
        // wait are detectable and can be saved after the removal.
        draftSaveAttemptRef.current += 1;
        const draftCleared = await queueDraftWrite(() => ownsSubmittedEditor()
          ? clearDraftConfirmed()
          : Promise.resolve(null));
        if (!ownsSubmittedEditor()) {
          await keepNewerDraft();
          return;
        }
        // Reset the composer — it's a persistent tab, so without this the old
        // text/media would still be sitting there next time you open it.
        setContent('');
        setMediaUris([]);
        setMediaIsVideo(false);
        setMediaIsAudio(false);
        setAudioName(null);
        setVideoDuration(null);
        setVideoPct(null);
        setIsNsfw(false);
        setTags([]);
        setTagInput('');
        setShowTags(false);
        draftRef.current = null;
        restoredContentRef.current = null;
        if (!draftCleared) {
          showToast('Posted, but the old draft could not be cleared and may reappear after restart.', 'error');
        }
        // Land on the Following feed with YOUR post at the top — drop the
        // cached page first so the feed refetches fresh instead of showing a
        // stale snapshot without your post.
        // `posted` timestamp forces the feed to scroll to top + pull the new
        // post in, even if you were 500 rows deep in Following when you hit
        // Post. The loop must FEEL like: post → see it land → watch engagement.
        if (canNavigateAfterSubmit()) {
          router.replace({ pathname: '/(tabs)', params: { tab: 'following', posted: String(Date.now()) } });
        }
      } else if (mode === 'article') {
        if (!articleTitle.trim() || !articleContent.trim()) {
          setSubmitting(false);
          return;
        }
        let articleMediaUrls: string[] | undefined;
        if (mediaUri) {
          // #191, article edition: a failed cover upload used to fall through
          // and publish the article anyway — cover silently gone, already in
          // other people's feeds. Same rule as the post path above: if the
          // media fails, NOTHING is published. The composer keeps its state,
          // so the user retries instead of re-writing.
          let coverUrl: string | null = null;
          try {
            const response = await fetch(mediaUri);
            const blob = await response.blob();
            const contentType = blob.type || 'image/jpeg';
            coverUrl = await uploadMediaBlob({ blob, contentType, sdk, onError: showError });
          } catch (err: any) {
            showError(err?.message || 'The cover image could not be read.');
          }
          if (!coverUrl) {
            setSubmitting(false);
            return;
          }
          articleMediaUrls = [coverUrl];
        }
        await sdk.posts.create({
          content: articleContent.trim(),
          title: articleTitle.trim(),
          content_format: 'markdown',
          organization_id: ORG_ID || undefined,
          community_id: selectedCommunity?.id || undefined,
          media_urls: articleMediaUrls,
        } as any);
        if (draftRef.current) {
          const draftCleared = await deleteDraftConfirmed(draftRef.current);
          if (!draftCleared) {
            showToast('Published, but the old draft could not be cleared and may reappear after restart.', 'error');
          }
        }
        router.back();
      } else if (mode === 'agent') {
        if (!agentName.trim()) { setSubmitting(false); return; }
        const username = `${agentName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).slice(2, 6)}`;
        await sdk.agents.create({
          name: agentName.trim(),
          username,
          bio: agentBio.trim() || undefined,
          system_prompt: agentPrompt.trim() || undefined,
          model: MODELS[agentModelIdx].id,
          organization_id: ORG_ID || undefined,
          social_mode: 'chat_only',
          tool_mode: 'chat_only',
        });
        try {
          await sdk.posts.create({
            content: `🤖 I just created a new AI agent: **${agentName.trim()}**${agentBio.trim() ? `\n\n${agentBio.trim()}` : ''}\n\nChat with them on Minds!`,
            organization_id: ORG_ID || undefined,
            community_id: selectedCommunity?.id || undefined,
          } as any);
        } catch {}
        setAgentName(''); setAgentBio(''); setAgentPrompt(''); setAvatarUri(null);
        showSuccess('Agent created');
        router.back();
      } else if (mode === 'app') {
        if (!appName.trim()) { setSubmitting(false); return; }
        await sdk.projects.create({
          name: appName.trim(),
          organization_id: ORG_ID || undefined,
        } as any);
        try {
          await sdk.posts.create({
            content: `🚀 I just launched a new app: **${appName.trim()}**${appDesc.trim() ? `\n\n${appDesc.trim()}` : ''}\n\nCheck it out on Minds!`,
            organization_id: ORG_ID || undefined,
            community_id: selectedCommunity?.id || undefined,
          } as any);
        } catch {}
        setAppName(''); setAppDesc(''); setAvatarUri(null);
        showSuccess('App created');
        router.back();
      } else if (mode === 'community') {
        if (!communityName.trim()) { setSubmitting(false); return; }
        const slug = `${communityName.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 6)}`;
        const created: any = await sdk.communities.create({
          name: communityName.trim(),
          slug,
          description: communityDesc.trim() || undefined,
          privacy: communityPrivate ? 'private' : 'public',
          organization_id: ORG_ID || undefined,
        } as any);
        const newId: string | undefined = created?.data?.id || created?.id;
        let pictureUploadFailed = false;
        // The picture picked above used to be thrown away. Upload it and set it
        // on the new group, so a group is whole the moment it exists.
        if (newId && (avatarUri || bannerUri)) {
          try {
            const upload = async (uri: string) => {
              const res = await fetch(uri);
              const blob = await res.blob();
              return uploadMediaBlob({ sdk: sdk as any, blob, contentType: blob.type || 'image/jpeg', onError: () => {} });
            };
            const [image, banner] = await Promise.all([
              avatarUri ? upload(avatarUri) : Promise.resolve(null),
              bannerUri ? upload(bannerUri) : Promise.resolve(null),
            ]);
            const updates: { image?: string; banner?: string } = {};
            if (image) updates.image = image;
            if (banner) updates.banner = banner;
            if (Object.keys(updates).length) await groupAdmin(sdk).update(newId, updates);
            if ((avatarUri && !image) || (bannerUri && !banner)) pictureUploadFailed = true;
          } catch (err) {
            pictureUploadFailed = true;
            captureException(err, { action: 'create', mode, step: 'community-pictures' });
          }
        }
        try {
          await sdk.posts.create({
            content: `🏘️ I just created a new community: **${communityName.trim()}**${communityDesc.trim() ? `\n\n${communityDesc.trim()}` : ''}\n\nJoin us on Minds!`,
            organization_id: ORG_ID || undefined,
          } as any);
        } catch {}
        setCommunityName(''); setCommunityDesc(''); setAvatarUri(null); setBannerUri(null);
        if (!pictureUploadFailed) showSuccess('Group created');
        // A group creation cannot be rolled back just because its optional
        // picture failed. Take the owner to the existing retry surface and say
        // exactly what remains, instead of celebrating a fully configured group.
        if (newId && pictureUploadFailed) router.replace(`/community/manage/${newId}?pictureUploadFailed=1` as any);
        else if (newId) router.replace(`/community/${newId}` as any);
        else router.back();
      }
    } catch (err: any) {
      captureException(err, { action: 'create', mode });
      const errMsg = err?.message || 'Something went wrong';
      setSuccessMsg(null);
      showError(errMsg);
    } finally {
      submitInFlight.current = false;
      setSubmitting(false);
    }
  };

  const submitLabel = mode === 'post' ? 'Post'
    : mode === 'article' ? 'Publish'
    : mode === 'agent' ? 'Create Agent'
    : mode === 'app' ? 'Create App'
    : 'Create Group';

  return (
    <Container safeTop padded={false}>
      {/* Tells the person the window will take the file. Without any cue a drag
          reads as "nothing is going to happen here" and they go back to the
          file picker. Pointer events stay off so it never blocks the composer. */}
      {dropActive ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.scrim,
            borderWidth: 2,
            borderColor: colors.accent,
            borderStyle: 'dashed',
            borderRadius: radius.lg,
          }}
        >
          <Ionicons name="cloud-upload-outline" size={40} color={colors.accent} />
          <Text variant="body" color={colors.text} style={{ marginTop: spacing.md }}>
            Drop to add
          </Text>
        </View>
      ) : null}
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
        <Pressable
          onPress={() => runCancel(async () => {
            // A late successful request must not pull the author back after
            // they explicitly left this submission's editor.
            navigationRevision.current += 1;
            const closingEditor = latestEditor.current;
            const closingAcceptedPost = () => latestEditor.current === closingEditor
              && acceptedPostEditor.current === closingEditor;
            // In a builder mode (community/article/agent/app), this is the persistent
            // Create tab — going "back" stranded you in that mode. Instead, return
            // to the default Post composer in-place.
            if (mode !== 'post') {
              setMode('post');
              try { router.setParams({ mode: undefined } as any); } catch {}
              return;
            }
            if (content.trim() && !closingAcceptedPost()) {
              // Closing immediately after typing is a second save path: wait
              // for durable storage and keep the composer open if it rejects.
              // Otherwise Cancel promises the work was kept while navigating
              // away with the only copy still in memory.
              const persisted = await persistCurrentDraft(++draftSaveAttemptRef.current);
              // Publication may have accepted this exact draft while the save
              // waited. It no longer needs preserving, but Cancel still owns
              // navigation after the accepted-draft cleanup finishes.
              if (!persisted && !closingAcceptedPost()) return;
            }
            if (closingAcceptedPost()) {
              // Do not re-save already-published text behind its pending clear,
              // or leave/unmount before that clear gets a chance to complete.
              await draftWriteQueue.current;
              if (latestEditor.current !== closingEditor) {
                // Only the normal accepted-post reset is safe to leave here.
                // New media/metadata edits matter even when their text is empty.
                const clearedEditor = {
                  ...closingEditor, content: '', mediaUris: [], mediaIsVideo: false,
                  mediaIsAudio: false, audioName: null, tags: [], tagInput: '', isNsfw: false,
                };
                if (JSON.stringify(latestEditor.current) !== JSON.stringify(clearedEditor)) return;
              }
            }
            // A loaded draft the user emptied out is a discard, not a keep.
            if (draftRef.current && !content.trim()) {
              const draftId = draftRef.current;
              const discarded = await queueDraftWrite(() => deleteDraftConfirmed(draftId));
              if (!discarded) {
                showError('Draft not discarded. Try again.');
                return;
              }
              draftRef.current = null;
            }
            router.back();
          })}
          disabled={cancelling}
          accessibilityState={{ disabled: cancelling, busy: cancelling }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={mode === 'post' ? 'Cancel' : 'New post'}
        >
          <Text variant="body" color={colors.textSecondary}>{mode === 'post' ? 'Cancel' : '‹ New post'}</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {/* Autosave indicator + character count, lighting up only
              when relevant. Saved-flash = 1.5s pulse after debounced
              save. Char count goes red below 0. */}
          {draftSaveState === 'saving' && mode === 'post' && (
            <Text variant="caption" color={colors.textMuted}>Saving…</Text>
          )}
          {draftSaveState === 'saved' && mode === 'post' && (
            <Text variant="caption" color={colors.textMuted}>Saved</Text>
          )}
          {draftSaveState === 'failed' && mode === 'post' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry saving draft"
              onPress={() => void persistCurrentDraft(++draftSaveAttemptRef.current)}
              hitSlop={8}
            >
              <Text variant="caption" color={colors.error}>Draft not saved · Retry</Text>
            </Pressable>
          )}
          {mode === 'post' && content.length > POST_CHAR_LIMIT - 240 && (
            <Text
              variant="caption"
              color={charsRemaining < 0 ? colors.error : charsRemaining < 60 ? colors.accent : colors.textMuted}
              style={{ fontVariant: ['tabular-nums'] as any }}
            >
              {charsRemaining}
            </Text>
          )}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || submitting || cancelling || charsRemaining < 0}
            accessibilityRole="button"
            accessibilityLabel={submitLabel}
            style={{
              paddingHorizontal: spacing.xl,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: (canSubmit && charsRemaining >= 0) ? colors.accent : colors.surfaceHover,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text variant="bodyMedium" color={(canSubmit && charsRemaining >= 0) ? colors.textInverse : colors.textMuted}>
                {submitLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {/*
        Mode switcher hidden on Create. Post is the only first-class mode here.
        Agent / App / Community creation moved to dedicated routes:
          - /agent (agent edit/create)
          - /apps (app catalog)
          - /communities (community discovery + create)
        Keep the modes list around so navigation by ?mode= deep-links still
        works, but don't surface a 5-tab kitchen sink at the top of compose.
      */}

      {/* Content area */}
      {(mode === 'post' || mode === 'article') ? (
        <View style={{ flex: 1, padding: spacing.xl }}>
          {/* The error/success banners below were only rendered in the
              agent/app/community branch, so a failed post submit showed
              NOTHING in post mode — the flagship action of the app. */}
          {errorMsg && (
            <Pressable onPress={() => setErrorMsg(null)} style={{ backgroundColor: colors.errorMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text variant="body" color={colors.error} style={{ flex: 1 }}>{errorMsg}</Text>
            </Pressable>
          )}
          {successMsg && (
            <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="body" color={colors.success}>{successMsg}</Text>
            </View>
          )}
          {/* Community picker — optional. Default audience is global,
              matching legacy Minds + modern social conventions. */}
          <View style={{ marginBottom: spacing.md, position: 'relative' }}>
            <Pressable
              onPress={() => { setCommunitySearch(''); setShowCommunityPicker(!showCommunityPicker); }}
              accessibilityRole="button"
              accessibilityLabel={`Post audience: ${selectedCommunity ? selectedCommunity.name : 'Global'}`}
              accessibilityState={{ expanded: showCommunityPicker }}
              {...(Platform.OS === 'web' ? { 'aria-expanded': showCommunityPicker } as any : {})}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                paddingLeft: spacing.md, paddingRight: spacing.sm, paddingVertical: spacing.sm,
                backgroundColor: selectedCommunity ? colors.accentSubtle : colors.surface,
                borderRadius: radius.full, alignSelf: 'flex-start',
                borderWidth: 0.5, borderColor: selectedCommunity ? `${colors.accent}40` : colors.glassBorder,
                opacity: pressed ? 0.75 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name={selectedCommunity ? 'people' : 'globe-outline'} size={15} color={selectedCommunity ? colors.accent : colors.textSecondary} />
              <Text variant="caption" color={selectedCommunity ? colors.accent : colors.text} style={{ fontSize: 13, fontFamily: 'Roboto-Medium' }}>
                {selectedCommunity ? selectedCommunity.name : 'Global'}
              </Text>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
              </View>
            </Pressable>

            <Modal
              visible={showCommunityPicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowCommunityPicker(false)}
            >
              {/* Native Modal renders into its own top-level layer so sibling
                  elements in the compose form can't bleed through. */}
              <Pressable
                onPress={() => setShowCommunityPicker(false)}
                style={{
                  flex: 1,
                  backgroundColor: colors.scrimStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: spacing.xl,
                }}
              >
                <Pressable
                  onPress={(e) => e.stopPropagation()}
                  accessibilityLabel="Choose post audience"
                  accessibilityViewIsModal
                  {...(Platform.OS === 'web' ? { role: 'dialog', 'aria-label': 'Choose post audience' } as any : {})}
                  style={{
                    width: '100%',
                    maxWidth: 420,
                    maxHeight: '80%' as any,
                    backgroundColor: colors.surfaceRaised,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    overflow: 'hidden',
                    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 64px rgba(0,0,0,0.8)' } as any : {}),
                  }}
                >
                  <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, gap: spacing.sm }}>
                    <Text variant="label" color={colors.textSecondary}>Post to</Text>
                    {/* Search — people can be in a lot of communities. */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.glassBorder, paddingHorizontal: spacing.md }}>
                      <Ionicons name="search" size={15} color={colors.textMuted} />
                      <TextInput
                        value={communitySearch}
                        onChangeText={setCommunitySearch}
                        placeholder="Search your communities"
                        placeholderTextColor={colors.textMuted}
                        autoCapitalize="none"
                        style={{ flex: 1, paddingVertical: spacing.sm, color: colors.text, fontFamily: 'Roboto-Regular', fontSize: 14, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
                      />
                      {communitySearch.length > 0 && (
                        <Pressable
                          onPress={() => setCommunitySearch('')}
                          accessibilityRole="button"
                          accessibilityLabel="Clear community search"
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  <ScrollView
                    style={{ maxHeight: 380 }}
                    keyboardShouldPersistTaps="handled"
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Post audience options"
                  >
                    {/* Global (default) — always available to switch back to. */}
                    <Pressable
                      onPress={() => { setSelectedCommunity(null); setShowCommunityPicker(false); }}
                      accessibilityRole="radio"
                      accessibilityLabel="Global"
                      accessibilityHint="Post to everyone on Minds"
                      accessibilityState={{ checked: !selectedCommunity }}
                      {...(Platform.OS === 'web' ? { 'aria-checked': !selectedCommunity } as any : {})}
                      style={({ pressed }) => ({
                        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                        backgroundColor: !selectedCommunity ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
                      })}
                    >
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="globe-outline" size={18} color={!selectedCommunity ? colors.accent : colors.textSecondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="body" color={!selectedCommunity ? colors.accent : colors.text}>Global</Text>
                        <Text variant="caption" color={colors.textMuted}>Everyone on the network</Text>
                      </View>
                      {!selectedCommunity && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                    </Pressable>

                    {(() => {
                      const q = communitySearch.trim().toLowerCase();
                      const list = (communities || []).filter((c: any) => !q || (c.name || '').toLowerCase().includes(q));
                      if ((communities || []).length === 0) {
                        return (
                          <View style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}>
                            <Text variant="body" color={colors.textMuted} align="center">You haven't joined any communities yet</Text>
                          </View>
                        );
                      }
                      if (list.length === 0) {
                        return (
                          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                            <Text variant="body" color={colors.textMuted} align="center">No matches for "{communitySearch}"</Text>
                          </View>
                        );
                      }
                      return list.map((c: any) => (
                        <Pressable
                          key={c.id}
                          onPress={() => { setSelectedCommunity(c); setShowCommunityPicker(false); }}
                          accessibilityRole="radio"
                          accessibilityLabel={c.name || 'Community'}
                          accessibilityHint={`Post to ${c.name || 'this community'}`}
                          accessibilityState={{ checked: selectedCommunity?.id === c.id }}
                          {...(Platform.OS === 'web' ? { 'aria-checked': selectedCommunity?.id === c.id } as any : {})}
                          style={({ pressed }) => ({
                            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                            paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                            backgroundColor: selectedCommunity?.id === c.id ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                            borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
                          })}
                        >
                          <Avatar uri={c.image || c.avatar} name={c.name} size="sm" />
                          <View style={{ flex: 1 }}>
                            <Text variant="body" color={selectedCommunity?.id === c.id ? colors.accent : colors.text} numberOfLines={1}>{c.name}</Text>
                            {communityDescription(c) ? <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{communityDescription(c)}</Text> : null}
                          </View>
                          {selectedCommunity?.id === c.id && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                        </Pressable>
                      ));
                    })()}
                  </ScrollView>
                  {/* Discover more communities. */}
                  <Pressable
                    onPress={() => { setShowCommunityPicker(false); router.push('/groups' as any); }}
                    accessibilityRole="button"
                    accessibilityLabel="Discover communities"
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
                      paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle,
                      backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                      ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                    })}
                  >
                    <Ionicons name="compass-outline" size={16} color={colors.accent} />
                    <Text variant="bodyMedium" color={colors.accent}>Discover communities</Text>
                  </Pressable>
                </Pressable>
              </Pressable>
            </Modal>
          </View>

          <MentionPicker query={mentionQuery} onSelect={insertMention} visible={showMentions} />

          {mode === 'article' && (
            <>
              {/* Cover leads as a full-width top banner (upload once), then the
                  title, then the body — the classic article layout. */}
              <Pressable
                onPress={() => handlePickImage()}
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: mediaUri ? 0 : 1,
                  borderColor: colors.glassBorder,
                  borderRadius: radius.md,
                  padding: mediaUri ? 0 : spacing.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.lg,
                  overflow: 'hidden',
                }}
              >
                {mediaUri ? (
                  <Image source={{ uri: mediaUri }} style={{ width: '100%', height: 200, borderRadius: radius.md }} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>Add cover image</Text>
                  </View>
                )}
              </Pressable>
              <TextInput
                placeholder="Article title"
                placeholderTextColor={colors.textMuted}
                value={articleTitle}
                onChangeText={setArticleTitle}
                style={{
                  color: colors.text,
                  fontFamily: 'Roboto-Medium',
                  fontSize: 22,
                  lineHeight: 28,
                  padding: 0,
                  marginBottom: spacing.md,
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
            </>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.lg, flex: 1 }}>
            {mode === 'post' && <Avatar uri={user?.image} name={user?.name} size="md" />}
            <View style={{
              flex: 1,
              // Avatar 'md' is 40px tall, line-height is 26px — shift the
              // first line ~6px down so placeholder/text reads centered with
              // the avatar instead of glued to the top.
              paddingTop: mode === 'post' ? 6 : 0,
            }}>
              <TextInput
                placeholder={mode === 'article' ? 'Write your article…  (markdown supported)' : quotePostId ? 'Add a comment' : "What's happening?"}
                placeholderTextColor={colors.textMuted}
                value={mode === 'article' ? articleContent : content}
                onChangeText={mode === 'article' ? setArticleContent : setContent}
                multiline
                {...kbProps}
                autoFocus={false}
                onKeyPress={(e: any) => {
                  if (mode !== 'article' && Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                style={{
                  color: colors.text,
                  ...typography.input,
                  fontSize: 19,
                  lineHeight: 26,
                  padding: 0,
                  flex: 1,
                  minHeight: 96,
                  textAlignVertical: 'top',
                  ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
                }}
              />
            </View>
          </View>

          {/* Embedded quoted post preview (X-style quote-tweet card). Shown when
              the composer is launched from a post's "Quote Post" action so the
              user sees exactly what they're quoting while they type. */}
          {mode === 'post' && quotePostId && (
            <View
              style={{
                marginTop: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.lg,
                padding: spacing.md,
                gap: spacing.xs,
              }}
            >
              {quoteAuthor ? (
                <Text variant="bodyMedium" numberOfLines={1} style={{ fontSize: 13 }}>{quoteAuthor}</Text>
              ) : null}
              {quoteContent ? (
                <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ lineHeight: 20 }}>
                  {quoteContent}
                </Text>
              ) : (
                <Text variant="caption" color={colors.textMuted}>Quoting a post</Text>
              )}
            </View>
          )}

          {/* Article mode shows its cover via the banner Pressable above; this
              general preview is post-only, else the cover renders twice and the
              big preview overlays the article editor. */}
          {mode !== 'article' && mediaUris.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              {mediaIsAudio ? (
                // Audio: a compact chip (music glyph + filename + remove). The
                // full inline player renders once the post is published.
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.borderSubtle, backgroundColor: colors.surface }}>
                  <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="musical-notes" size={22} color={colors.accent} />
                  </View>
                  <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{audioName || 'Audio'}</Text>
                  <Pressable onPress={() => { setMediaUris([]); setMediaIsAudio(false); setAudioName(null); }} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                  </Pressable>
                </View>
              ) : mediaIsVideo ? (
                // Video: one rounded frame (matching the image grid) holding the
                // player, a centered round play glyph, a duration pill bottom-left,
                // and the × remove control top-right — X-style.
                <View
                  style={{
                    position: 'relative',
                    height: GRID_HEIGHT,
                    borderRadius: GRID_RADIUS,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    borderWidth: 0.5,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <VideoPlayer uri={mediaUris[0]} autoplay={false} height={GRID_HEIGHT} />
                  {/* Centered play glyph. pointerEvents none so it doesn't
                      steal taps from the player's own mute toggle. */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.full,
                        backgroundColor: 'rgba(0,0,0,0.55)',
                        borderWidth: 1.5,
                        borderColor: 'rgba(255,255,255,0.85)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(4px)' } as any) : {}),
                      }}
                    >
                      <Ionicons name="play" size={26} color="#ffffff" style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                  {fmtDuration(videoDuration) && (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        bottom: spacing.sm,
                        left: spacing.sm,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 3,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                      }}
                    >
                      <Text variant="caption" style={{ color: '#ffffff', fontSize: 12, fontVariant: ['tabular-nums'] as any }}>
                        {fmtDuration(videoDuration)}
                      </Text>
                    </View>
                  )}
                  <RemoveMediaButton onPress={() => { setMediaUris([]); setMediaIsVideo(false); setMediaIsAudio(false); setAudioName(null); setVideoDuration(null); }} />
                </View>
              ) : (
                // Image grid — X-style, clipped into one rounded frame so the
                // whole block reads as a single cohesive card.
                //   1 → one large ~16:9 tile
                //   2 → two equal side-by-side tiles (full height)
                //   3 → one large left, two stacked right
                //   4 → clean 2×2 grid
                <View
                  style={{
                    // Single image renders at its NATURAL aspect (not a cropped
                    // fixed box); 2+ use the fixed-height X-style grid.
                    height: mediaUris.length === 1 ? undefined : GRID_HEIGHT,
                    flexDirection: 'row',
                    gap: GRID_GAP,
                    borderRadius: GRID_RADIUS,
                    overflow: 'hidden',
                    borderWidth: 0.5,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  {(() => {
                    const remove = (i: number) =>
                      setMediaUris((prev) => prev.filter((_, idx) => idx !== i));
                    const tile = (uri: string, i: number) => (
                      <View key={`${uri}-${i}`} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        <Image
                          source={{ uri }}
                          style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceHover }}
                          resizeMode="cover"
                        />
                        <RemoveMediaButton small onPress={() => remove(i)} />
                      </View>
                    );
                    const items = mediaUris.slice(0, 4);
                    const n = items.length;

                    if (n === 1) {
                      // Match the FEED exactly: box takes the image's natural
                      // aspect (clamped) and the image hugs the leading edge, so
                      // the composer is an accurate WYSIWYG preview — not a
                      // full-width cover-cropped box.
                      return (
                        <View style={{ width: '100%', aspectRatio: media1Aspect || 1.5, maxHeight: 440, position: 'relative', overflow: 'hidden', alignItems: 'flex-start', backgroundColor: 'transparent' }}>
                          <Image
                            source={{ uri: items[0] }}
                            style={{ height: '100%', aspectRatio: media1Aspect || 1.5, alignSelf: 'flex-start', backgroundColor: colors.surfaceHover }}
                            resizeMode="cover"
                            onLoad={(e: any) => {
                              const src = e?.source || e?.nativeEvent?.source;
                              if (src?.width && src?.height) setMedia1Aspect(src.width / src.height);
                            }}
                          />
                          <RemoveMediaButton small onPress={() => remove(0)} />
                        </View>
                      );
                    }
                    if (n === 2) return items.map((u, i) => tile(u, i));
                    if (n === 3) {
                      return (
                        <>
                          {tile(items[0], 0)}
                          <View style={{ flex: 1, gap: GRID_GAP }}>
                            {tile(items[1], 1)}
                            {tile(items[2], 2)}
                          </View>
                        </>
                      );
                    }
                    // 4-up: two columns, each two stacked tiles.
                    return (
                      <>
                        <View style={{ flex: 1, gap: GRID_GAP }}>
                          {tile(items[0], 0)}
                          {tile(items[2], 2)}
                        </View>
                        <View style={{ flex: 1, gap: GRID_GAP }}>
                          {tile(items[1], 1)}
                          {tile(items[3], 3)}
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
              {/* +N more indicator when over 4 selected (X caps the visible
                  grid at 4; the rest still upload). */}
              {!mediaIsVideo && mediaUris.length > 4 && (
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                  +{mediaUris.length - 4} more attached
                </Text>
              )}
            </View>
          )}

          {/* Live link preview as the user types a URL — mirrors how the
              post will render after submit. */}
          {mode === 'post' && !mediaUri && content ? (
            <LinkPreview content={content} />
          ) : null}

          {tags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md }}>
              {tags.map((tag) => (
                <Pressable key={tag} onPress={() => setTags((prev) => prev.filter((t) => t !== tag))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surfaceHover, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full }}>
                  <Text variant="caption" color={colors.accent}>#{tag}</Text>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          )}

          {showTags && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              <TextInput
                placeholder={tags.length >= MAX_TAGS ? '10 tag limit reached' : 'Add a tag...'}
                placeholderTextColor={colors.textMuted}
                value={tagInput}
                onChangeText={setTagInput}
                editable={tags.length < MAX_TAGS}
                onSubmitEditing={() => {
                  const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
                  if (tag && tags.length < MAX_TAGS && !tags.includes(tag)) setTags((current) => [...current, tag]);
                  setTagInput('');
                  setShowTags(false);
                }}
                autoFocus
                style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text, ...typography.input, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }}
              />
            </View>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
          {/* Banner for a group: 3:1, the shape the group page renders. */}
          {mode === 'community' && (
            <Pressable
              onPress={handlePickBanner}
              accessibilityRole="button"
              accessibilityLabel={bannerUri ? 'Change the banner' : 'Add a banner'}
              style={{ aspectRatio: 3, borderRadius: radius.md, backgroundColor: colors.surfaceHover, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder, alignItems: 'center', justifyContent: 'center' }}
            >
              {bannerUri ? (
                <Image source={{ uri: bannerUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <View style={{ alignItems: 'center', gap: spacing.xs }}>
                  <Ionicons name="image-outline" size={26} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted}>Add a banner</Text>
                </View>
              )}
            </Pressable>
          )}
          {/* Avatar picker for agent/app/community */}
          <Pressable
            onPress={handlePickAvatar}
            accessibilityRole="button"
            accessibilityLabel={mode === 'community' ? 'Add group picture' : 'Add avatar'}
            style={{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceHover, overflow: 'hidden', borderWidth: 1, borderColor: colors.glassBorder }}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={{ width: 80, height: 80, borderRadius: 40 }} />
            ) : (
              <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
            )}
          </Pressable>
          <Text variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: -spacing.sm }}>
            Tap to add avatar
          </Text>

          {successMsg && (
            <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' }}>
              <Text variant="body" color={colors.success}>{successMsg}</Text>
            </View>
          )}

          {errorMsg && (
            <Pressable onPress={() => setErrorMsg(null)} style={{ backgroundColor: colors.errorMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text variant="body" color={colors.error} style={{ flex: 1 }}>{errorMsg}</Text>
            </Pressable>
          )}

          {mode === 'agent' && (
            <>
              <TextInput placeholder="Agent name" placeholderTextColor={colors.textMuted} value={agentName} onChangeText={setAgentName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.input, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Short bio *" placeholderTextColor={colors.textMuted} value={agentBio} onChangeText={setAgentBio}
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.input, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="What should this agent do?" placeholderTextColor={colors.textMuted} value={agentPrompt} onChangeText={setAgentPrompt} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 100, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <View style={{ position: 'relative' }}>
                <Pressable
                  onPress={() => setShowModelMenu(!showModelMenu)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 0.5, borderColor: showModelMenu ? colors.accent : colors.glassBorder }}
                >
                  <Ionicons name="hardware-chip-outline" size={18} color={colors.accent} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" color={colors.text} style={{ fontSize: 14 }}>{MODELS[agentModelIdx].label}</Text>
                    <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{MODELS[agentModelIdx].provider}</Text>
                  </View>
                  <Ionicons name={showModelMenu ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                </Pressable>
                {showModelMenu && (
                  <>
                    <Pressable
                      onPress={() => setShowModelMenu(false)}
                      style={{ position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998 }}
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: spacing.xs,
                        backgroundColor: colors.bg,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        zIndex: 99999,
                        overflow: 'hidden',
                        ...(Platform.OS === 'web' ? { boxShadow: '0 8px 32px rgba(0,0,0,0.6)' } as any : {}),
                      }}
                    >
                      {MODELS.map((model, idx) => (
                        <Pressable
                          key={model.id}
                          onPress={() => { setAgentModelIdx(idx); setShowModelMenu(false); }}
                          style={({ pressed }) => ({
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.sm,
                            paddingHorizontal: spacing.lg,
                            paddingVertical: spacing.md,
                            backgroundColor: idx === agentModelIdx ? colors.accentSubtle : pressed ? colors.surfaceHover : 'transparent',
                            borderBottomWidth: idx < MODELS.length - 1 ? 0.5 : 0,
                            borderBottomColor: colors.borderSubtle,
                          })}
                        >
                          <View style={{ flex: 1 }}>
                            <Text variant="body" color={idx === agentModelIdx ? colors.accent : colors.text} style={{ fontSize: 14 }}>{model.label}</Text>
                            <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{model.provider}</Text>
                          </View>
                          {idx === agentModelIdx && (
                            <Ionicons name="checkmark" size={18} color={colors.accent} />
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </>
          )}
          {mode === 'app' && (
            <>
              <TextInput placeholder="App name" placeholderTextColor={colors.textMuted} value={appName} onChangeText={setAppName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.input, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Description *" placeholderTextColor={colors.textMuted} value={appDesc} onChangeText={setAppDesc} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
            </>
          )}
          {mode === 'community' && (
            <>
              <TextInput placeholder="Group name" placeholderTextColor={colors.textMuted} value={communityName} onChangeText={setCommunityName} autoFocus
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, ...typography.input, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <TextInput placeholder="Description *" placeholderTextColor={colors.textMuted} value={communityDesc} onChangeText={setCommunityDesc} multiline
                style={{ backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 13, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) }} />
              <Pressable onPress={() => setCommunityPrivate(!communityPrivate)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name={communityPrivate ? 'lock-closed' : 'lock-open-outline'} size={20} color={communityPrivate ? colors.accent : colors.textMuted} />
                <Text variant="body" color={colors.textSecondary}>{communityPrivate ? 'Private' : 'Public'}</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom toolbar (post and article mode) — X-style: a row of round,
          accent-tinted icon buttons on the left, then a character counter +
          prominent Post button on the right. */}
      {(mode === 'post' || mode === 'article') && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            // Constant padding — the KeyboardAvoid wrapper keeps this bar
            // riding the keyboard 1:1, so the gap must not change between
            // keyboard open and closed states.
            paddingVertical: spacing.sm + 2,
            borderTopWidth: 0.5,
            borderTopColor: colors.borderSubtle,
          }}
        >
          {/* Post ⇄ Article: switch to the long-form editor (title + cover +
              markdown body). Back-arrow in the header returns to Post. */}
          <ToolbarIconButton
            icon="document-text-outline"
            active={mode === 'article'}
            onPress={() => setMode(mode === 'article' ? 'post' : 'article')}
            colors={colors}
            accessibilityLabel={mode === 'article' ? 'Switch to post composer' : 'Switch to article editor'}
          />
          {/* Single attach affordance — photo/video/audio consolidated behind
             one paperclip (three separate icons crowded the bar). The menu
             pops above the toolbar, anchored left. */}
          <View>
            <ToolbarIconButton
              icon={mediaIsAudio ? 'musical-notes' : mediaIsVideo ? 'videocam' : mediaUri ? 'image' : 'attach-outline'}
              active={!!mediaUri || showAttachMenu}
              onPress={() => { haptics.select(); setShowAttachMenu(v => !v); }}
              colors={colors}
              accessibilityLabel="Add media"
              expanded={showAttachMenu}
            />
            {showAttachMenu && (
              <View
                accessibilityRole="menu"
                accessibilityLabel="Media attachment options"
                style={{
                  position: 'absolute',
                  bottom: 44,
                  left: 0,
                  minWidth: 150,
                  backgroundColor: colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: 0.5,
                  borderColor: colors.borderSubtle,
                  paddingVertical: spacing.xs,
                  zIndex: 30,
                  ...(Platform.OS === 'web'
                    ? ({ boxShadow: '0 6px 24px rgba(0,0,0,0.35)' } as any)
                    : { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }),
                }}
              >
                {([
                  { icon: 'image-outline', label: 'Photo', act: () => handlePickImage('image') },
                  { icon: 'videocam-outline', label: 'Video', act: () => handlePickImage('video') },
                  { icon: 'musical-notes-outline', label: 'Audio', act: handlePickAudio },
                ] as const).map((opt) => (
                  <Pressable
                    key={opt.label}
                    onPress={() => { setShowAttachMenu(false); opt.act(); }}
                    accessibilityRole="menuitem"
                    accessibilityLabel={`Add ${opt.label.toLowerCase()}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                      paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
                      backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                    })}
                  >
                    <Ionicons name={opt.icon as any} size={20} color={colors.text} />
                    <Text variant="body">{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <ToolbarIconButton
            icon="pricetag-outline"
            active={tags.length > 0}
            onPress={() => setShowTags(!showTags)}
            colors={colors}
            accessibilityLabel="Add tags"
            expanded={showTags}
          />
          <Pressable
            onPress={() => setIsNsfw(!isNsfw)}
            accessibilityRole="switch"
            accessibilityLabel="Mark post as NSFW"
            accessibilityState={{ checked: isNsfw }}
            {...(Platform.OS === 'web' ? { 'aria-checked': isNsfw } as any : {})}
            style={{
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: spacing.md, height: 36,
              borderRadius: radius.full,
              backgroundColor: isNsfw ? colors.errorMuted : 'transparent',
              borderWidth: isNsfw ? 0 : 0.5,
              borderColor: colors.borderSubtle,
              marginLeft: spacing.xs,
            }}
          >
            <Text variant="caption" color={isNsfw ? colors.error : colors.textMuted} style={{ fontSize: 12 }}>NSFW</Text>
          </Pressable>

          {videoPct !== null && (
            <Text variant="caption" color={colors.accent} style={{ marginLeft: spacing.sm }}>{`Uploading ${videoPct}%`}</Text>
          )}

          <View style={{ flex: 1 }} />

          {/* Character counter — only surfaces once you start typing.
              Stays muted, goes gold near the limit, red over it. */}
          {(mode === 'article' ? articleContent : content).length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: spacing.md }}>
              <CharCounterRing
                used={(mode === 'article' ? articleContent : content).length}
                limit={POST_CHAR_LIMIT}
                colors={colors}
              />
            </View>
          )}

          {/* Escape hatch: the editor fills the screen, so there's no scroll
              surface to drag-dismiss with — this chevron always collapses the
              keyboard. You must never be stuck inside it. */}
          {keyboardVisible && (
            <ToolbarIconButton
              icon="chevron-down"
              onPress={() => Keyboard.dismiss()}
              colors={colors}
              accessibilityLabel="Dismiss keyboard"
            />
          )}

        </View>
      )}
    </Container>
  );
}

// #187: contain a crash to this screen so the tab bar and navigation survive.
// expo-router renders this instead of the route when it throws.
export { ScreenErrorBoundary as ErrorBoundary } from '../../components/ScreenErrorBoundary';
