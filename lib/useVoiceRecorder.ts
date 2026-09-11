import * as React from 'react';
import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';

/**
 * WhatsApp/Signal-style voice notes for web, iOS, and Android. Expo owns the
 * platform recorder; this hook keeps the small Blob contract chat already
 * uploads through @recursiv/sdk.
 */
export interface VoiceRecording {
  blob: Blob;
  /** base content type (no codecs), e.g. "audio/webm" or "audio/mp4" */
  mime: string;
  durationMs: number;
}

type VoicePlatform = 'web' | 'ios' | 'android' | 'windows' | 'macos';

/** Resolve the upload MIME even when a native file response has no type. */
export function voiceRecordingMime(
  blobType: string | undefined,
  uri: string,
  platform: VoicePlatform,
): string {
  const path = uri.toLowerCase().split(/[?#]/)[0];
  if (path.endsWith('.m4a') || path.endsWith('.mp4')) return 'audio/mp4';
  if (path.endsWith('.webm')) return 'audio/webm';
  if (path.endsWith('.ogg') || path.endsWith('.oga')) return 'audio/ogg';
  if (path.endsWith('.wav')) return 'audio/wav';
  if (path.endsWith('.mp3')) return 'audio/mpeg';

  const reported = blobType?.split(';')[0]?.trim().toLowerCase();
  if (reported?.startsWith('audio/')) return reported;
  return platform === 'web' ? 'audio/webm' : 'audio/mp4';
}

function webRecorderAvailable(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;
}

async function leaveRecordingMode() {
  try {
    // On iOS, leaving allowsRecording enabled can route later playback through
    // the earpiece. Restore the normal playback session after every exit path.
    await setAudioModeAsync({ allowsRecording: false });
  } catch {}
}

export function useVoiceRecorder(options: {
  /** Capture an active recording when its owning view unmounts. */
  onInterrupted?: (recording: VoiceRecording) => void;
} = {}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const supported = Platform.OS === 'web' ? webRecorderAvailable() : true;
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  const activeRef = React.useRef(false);
  const startingRef = React.useRef(false);
  const stoppingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const startRef = React.useRef(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const onInterruptedRef = React.useRef(options.onInterrupted);
  onInterruptedRef.current = options.onInterrupted;

  const resetUi = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    activeRef.current = false;
    setRecording(false);
    setElapsed(0);
  }, []);

  const start = React.useCallback(async (): Promise<boolean> => {
    if (!supported || activeRef.current || startingRef.current || stoppingRef.current) return false;
    startingRef.current = true;
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted || !mountedRef.current) return false;

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      if (!mountedRef.current) {
        await leaveRecordingMode();
        return false;
      }
      await recorder.prepareToRecordAsync();
      if (!mountedRef.current) {
        await recorder.stop().catch(() => {});
        await leaveRecordingMode();
        return false;
      }
      recorder.record();

      activeRef.current = true;
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
      return true;
    } catch {
      // A prepared recorder can block the next attempt even when record()
      // itself throws. Stop best-effort so a transient native failure retries.
      await recorder.stop().catch(() => {});
      resetUi();
      await leaveRecordingMode();
      return false;
    } finally {
      startingRef.current = false;
    }
  }, [recorder, resetUi, supported]);

  const capture = React.useCallback(async (updateUi: boolean): Promise<VoiceRecording | null> => {
    if (!activeRef.current || stoppingRef.current) return null;
    stoppingRef.current = true;

    const statusDuration = recorder.getStatus().durationMillis || 0;
    const durationMs = Math.max(statusDuration, Date.now() - startRef.current);
    // Claim the recorder synchronously so stop, unmount, and a fast second tap
    // cannot race one another into two stop/fetch operations.
    activeRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (updateUi) {
      setRecording(false);
      setElapsed(0);
    }
    try {
      await recorder.stop();
      const uri = recorder.uri || recorder.getStatus().url;
      if (!uri) return null;

      const response = await fetch(uri);
      if (response.ok === false) return null;
      let blob = await response.blob();
      if (!blob.size) return null;

      const mime = voiceRecordingMime(blob.type, uri, Platform.OS);
      if (blob.type.split(';')[0].toLowerCase() !== mime) {
        blob = new Blob([blob], { type: mime });
      }
      return { blob, mime, durationMs };
    } catch {
      return null;
    } finally {
      await leaveRecordingMode();
      stoppingRef.current = false;
    }
  }, [recorder]);

  // Stop and resolve the recording. Returns null if nothing was captured.
  const stop = React.useCallback(
    (): Promise<VoiceRecording | null> => capture(true),
    [capture],
  );

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      // Native thread navigation unmounts the composer. Capture rather than
      // discard the only copy and hand it to the conversation-owned outbox.
      void capture(false).then((interrupted) => {
        if (interrupted) onInterruptedRef.current?.(interrupted);
      });
    };
  }, [capture]);

  // Discard the in-progress recording without producing a note.
  const cancel = React.useCallback(() => {
    if (!activeRef.current || stoppingRef.current) {
      resetUi();
      return;
    }

    stoppingRef.current = true;
    resetUi();
    void recorder.stop()
      .catch(() => {})
      .finally(async () => {
        await leaveRecordingMode();
        stoppingRef.current = false;
      });
  }, [recorder, resetUi]);

  return { supported, recording, elapsed, start, stop, cancel };
}
