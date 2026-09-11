import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const recorder = vi.hoisted(() => ({
  prepareToRecordAsync: vi.fn(),
  record: vi.fn(),
  stop: vi.fn(),
  getStatus: vi.fn(() => ({ durationMillis: 900, url: 'blob:https://minds.example/voice' })),
  uri: 'blob:https://minds.example/voice' as string | null,
}));
const requestPermission = vi.hoisted(() => vi.fn());
const setAudioModeAsync = vi.hoisted(() => vi.fn());

vi.mock('expo-audio', () => ({
  AudioModule: { requestRecordingPermissionsAsync: requestPermission },
  RecordingPresets: { HIGH_QUALITY: { extension: '.m4a' } },
  setAudioModeAsync,
  useAudioRecorder: () => recorder,
}));

import { useVoiceRecorder, voiceRecordingMime } from '../useVoiceRecorder';

describe('voiceRecordingMime', () => {
  it('trusts an audio MIME reported by the recorder', () => {
    expect(voiceRecordingMime('audio/ogg;codecs=opus', 'blob:https://minds.example/abc', 'android')).toBe('audio/ogg');
  });

  it('maps native m4a recordings to the upload type the server accepts', () => {
    expect(voiceRecordingMime('audio/x-m4a', 'file:///cache/note.m4a', 'ios')).toBe('audio/mp4');
  });

  it('falls back to webm for browser recordings without a reported type', () => {
    expect(voiceRecordingMime(undefined, 'blob:https://minds.example/abc', 'web')).toBe('audio/webm');
  });
});

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestPermission.mockResolvedValue({ granted: true });
    setAudioModeAsync.mockResolvedValue(undefined);
    recorder.prepareToRecordAsync.mockResolvedValue(undefined);
    recorder.stop.mockResolvedValue(undefined);
    recorder.getStatus.mockReturnValue({ durationMillis: 900, url: 'blob:https://minds.example/voice' });
    recorder.uri = 'blob:https://minds.example/voice';
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: class MediaRecorder {} });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('voice bytes')));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('requests permission lazily, records, returns a typed blob, and restores playback mode', async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    expect(requestPermission).not.toHaveBeenCalled();
    expect(result.current.supported).toBe(true);

    await act(async () => {
      await expect(result.current.start()).resolves.toBe(true);
    });

    expect(requestPermission).toHaveBeenCalledOnce();
    expect(setAudioModeAsync).toHaveBeenNthCalledWith(1, {
      allowsRecording: true,
      playsInSilentMode: true,
    });
    expect(recorder.prepareToRecordAsync).toHaveBeenCalledOnce();
    expect(recorder.record).toHaveBeenCalledOnce();
    expect(result.current.recording).toBe(true);

    const recording = await act(async () => result.current.stop());

    // Response-to-Blob byte accounting differs between the Node and jsdom
    // implementations used locally and on GitHub. The product contract is a
    // non-empty recording with the normalized upload MIME, not one synthetic
    // fixture's exact byte count.
    expect(recording?.blob.size).toBeGreaterThan(0);
    expect(recording?.blob.type).toBe('audio/webm');
    expect(recording?.mime).toBe('audio/webm');
    expect(recording?.durationMs).toEqual(expect.any(Number));
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    expect(result.current.recording).toBe(false);
  });

  it('does not prepare a recorder when microphone permission is denied', async () => {
    requestPermission.mockResolvedValueOnce({ granted: false });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await expect(result.current.start()).resolves.toBe(false);
    });

    expect(recorder.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
  });

  it('releases a prepared recorder when native startup fails so retry stays possible', async () => {
    recorder.record.mockImplementationOnce(() => { throw new Error('native recorder failed'); });
    const { result } = renderHook(() => useVoiceRecorder());

    await act(async () => {
      await expect(result.current.start()).resolves.toBe(false);
    });

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    expect(result.current.recording).toBe(false);
  });

  it('stops and discards a cancelled recording', async () => {
    const { result } = renderHook(() => useVoiceRecorder());
    await act(async () => { await result.current.start(); });

    act(() => { result.current.cancel(); });
    await act(async () => { await Promise.resolve(); });

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(setAudioModeAsync).toHaveBeenLastCalledWith({ allowsRecording: false });
    expect(result.current.recording).toBe(false);
  });

  it('captures the only recording copy when its owning view unmounts', async () => {
    const onInterrupted = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceRecorder({ onInterrupted }));
    await act(async () => { await result.current.start(); });

    unmount();
    await act(async () => {
      await vi.waitFor(() => expect(onInterrupted).toHaveBeenCalledOnce());
    });

    const interrupted = onInterrupted.mock.calls[0][0];
    expect(interrupted.blob.size).toBeGreaterThan(0);
    expect(interrupted.mime).toBe('audio/webm');
    expect(recorder.stop).toHaveBeenCalledOnce();
  });

  it('does not start a recorder when permission resolves after unmount', async () => {
    let grantPermission!: (value: { granted: boolean }) => void;
    requestPermission.mockReturnValueOnce(new Promise(resolve => { grantPermission = resolve; }));
    const onInterrupted = vi.fn();
    const { result, unmount } = renderHook(() => useVoiceRecorder({ onInterrupted }));

    let startPromise!: Promise<boolean>;
    act(() => { startPromise = result.current.start(); });
    unmount();
    grantPermission({ granted: true });

    await expect(startPromise).resolves.toBe(false);
    expect(recorder.prepareToRecordAsync).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
    expect(onInterrupted).not.toHaveBeenCalled();
  });
});
