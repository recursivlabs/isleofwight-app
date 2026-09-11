import * as React from 'react';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatBubble } from '../../components/ChatBubble';
import { AudioPlayerProvider } from '../../lib/audioPlayer';
import engine from '../../lib/audio/engine.web';

// Exercise the real provider and web engine. Only the browser's media element
// is controlled: these tests never request a remote voice note.
const media = document.createElement('audio');
let mediaError: MediaError | null = null;
const load = vi.fn();
const play = vi.fn<() => Promise<void>>();
const VOICE_A = 'https://media.example/voice-a.m4a';
const VOICE_B = 'https://media.example/voice-b.m4a';

function thread() {
  return render(
    <AudioPlayerProvider>
      {[VOICE_A, VOICE_B].map((url, index) => (
        <div key={url} data-testid={`voice-${index}`}>
          <ChatBubble message={{ id: `message-${index}`, media: [url] }} isOwn={false} />
        </div>
      ))}
    </AudioPlayerProvider>,
  );
}

// The existing voice-note controls use icons rather than accessible labels.
// Find their actual pressable, as the existing chat-audio suite does.
function transport(row: HTMLElement) {
  const icon = row.querySelector('[data-icon="play"], [data-icon="pause"], [data-icon="ellipsis-horizontal"]');
  if (!icon?.parentElement) throw new Error('Voice-note transport is missing');
  return icon.parentElement;
}

function expectTransport(row: HTMLElement, icon: 'play' | 'pause' | 'ellipsis-horizontal') {
  expect(transport(row).querySelector('[data-icon]')).toHaveAttribute('data-icon', icon);
}

function failMedia() {
  mediaError = { code: 2, message: 'Voice note unavailable' } as MediaError;
  media.dispatchEvent(new Event('error'));
}

beforeEach(async () => {
  vi.stubGlobal('Audio', vi.fn(function AudioMock() { return media; }));
  Object.defineProperty(media, 'error', { configurable: true, get: () => mediaError });
  load.mockReset().mockImplementation(() => { mediaError = null; });
  play.mockReset().mockImplementation(async () => {
    await Promise.resolve(); // Browser playback events run after play() is called.
    media.dispatchEvent(new Event('play'));
    media.dispatchEvent(new Event('playing'));
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(load);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
    queueMicrotask(() => media.dispatchEvent(new Event('pause')));
  });
  // The production engine is a singleton. Reset it without retaining callbacks
  // from the preceding mounted provider, then count only this test's loads.
  engine.setHandlers({});
  await engine.stop();
  mediaError = null;
  load.mockClear();
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('web voice-note failure and retry', () => {
  const user = userEvent.setup({ delay: null });

  it('returns to Play after playback is rejected and accepts a later user retry', async () => {
    play.mockRejectedValueOnce(new DOMException('Playback needs a user gesture', 'NotAllowedError'));
    const page = thread();
    const voice = page.getByTestId('voice-0');

    await user.click(transport(voice));

    expectTransport(voice, 'play');
    expect(voice.querySelector('[data-icon="ellipsis-horizontal"]')).not.toBeInTheDocument();
    await user.click(transport(voice));
    expectTransport(voice, 'pause');
    expect(play).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('leaves buffering on a media error and reloads the failed source only when retried', async () => {
    play.mockResolvedValueOnce(undefined); // No playing/canplay event: still buffering.
    const page = thread();
    const voice = page.getByTestId('voice-0');
    await user.click(transport(voice));
    expectTransport(voice, 'ellipsis-horizontal');

    act(failMedia);

    expectTransport(voice, 'play');
    expect(load).toHaveBeenCalledTimes(1);
    await user.click(transport(voice));
    expectTransport(voice, 'pause');
    expect(load).toHaveBeenCalledTimes(2);
    expect(media.error).toBeNull();
  });

  it('stops showing Pause when an already-playing voice note fails', async () => {
    const page = thread();
    const voice = page.getByTestId('voice-0');
    await user.click(transport(voice));
    expectTransport(voice, 'pause');

    act(failMedia);

    expectTransport(voice, 'play');
    expect(load).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('ignores an older aborted play promise after another voice note starts', async () => {
    let rejectOldPlay!: (reason: Error) => void;
    play.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOldPlay = reject; }));
    const page = thread();
    const first = page.getByTestId('voice-0');
    const second = page.getByTestId('voice-1');
    await user.click(transport(first));
    expectTransport(first, 'ellipsis-horizontal');
    await user.click(transport(second));
    expectTransport(second, 'pause');

    await act(async () => { rejectOldPlay(new DOMException('A new source interrupted playback', 'AbortError')); });

    expectTransport(second, 'pause');
    expectTransport(first, 'play');
    expect(media.src).toBe(VOICE_B);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('ignores a queued media error once changing tracks has cleared the old error', async () => {
    const page = thread();
    await user.click(transport(page.getByTestId('voice-0')));
    mediaError = { code: 2, message: 'Previous source failed' } as MediaError;
    const second = page.getByTestId('voice-1');
    await user.click(transport(second));
    expect(media.error).toBeNull();
    expectTransport(second, 'pause');

    act(() => { media.dispatchEvent(new Event('error')); });

    expectTransport(second, 'pause');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('pauses and resumes healthy audio without reloading its source', async () => {
    const page = thread();
    const voice = page.getByTestId('voice-0');
    await user.click(transport(voice));
    expectTransport(voice, 'pause');
    await user.click(transport(voice));
    expectTransport(voice, 'play');
    await user.click(transport(voice));

    expectTransport(voice, 'pause');
    expect(load).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledTimes(2);
  });
});
