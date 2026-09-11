// Two voice notes in one conversation are two tracks, and the app has to be
// able to tell them apart.
//
// MediaViewer gives every audio attachment an AudioTrack.id. ChatBubble renders
// DM attachments with no `audioMeta`, because a DM has no post behind it, and
// the fallback id was `audio-${idx}` — the index WITHIN one MediaViewer, which
// is always 0 for a single attachment. So every voice note in the app shared
// the id `audio-0`, and AudioTrack.id is compared globally: the provider's
// `isCurrent` marked all of them active at once, and on native the downloads
// index (keyed on the same id) served the first downloaded file in place of
// every other voice note — including one left behind by the previous account on
// a shared device.
//
// This renders the symptom rather than the id, so it fails on the real defect
// and not merely on a changed implementation.
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChatBubble } from '../../components/ChatBubble';
import { AudioPlayerProvider } from '../../lib/audioPlayer';

const VOICE_A = 'https://pub-abc.r2.dev/uploads/voice-alice.m4a';
const VOICE_B = 'https://pub-abc.r2.dev/uploads/voice-bob.m4a';

function thread(urls: string[]) {
  return (
    <AudioPlayerProvider>
      {urls.map((url, i) => (
        <ChatBubble key={i} message={{ id: `m${i}`, content: '', media: [url] }} isOwn={false} />
      ))}
    </AudioPlayerProvider>
  );
}

const icons = (root: HTMLElement, name: string) =>
  root.querySelectorAll(`[data-icon="${name}"]`).length;

/** The play/pause control is the pressable wrapping the transport icon. */
function transport(root: HTMLElement, nth: number): HTMLElement {
  const found = root.querySelectorAll('[data-icon="play"], [data-icon="pause"], [data-icon="ellipsis-horizontal"]');
  const icon = found[nth];
  if (!icon) throw new Error(`no transport control at index ${nth} (found ${found.length})`);
  return icon.parentElement as HTMLElement;
}

describe('DM voice notes', () => {
  it('renders one audio player per attachment', () => {
    // Positive control. Every assertion below is about how many players are in
    // which state; if the attachments never became players at all, they would
    // all pass by counting zero.
    const { container } = render(thread([VOICE_A, VOICE_B]));
    expect(icons(container, 'play')).toBe(2);
  });

  it('starting one voice note does not make the other one active', async () => {
    const user = userEvent.setup();
    const { container } = render(thread([VOICE_A, VOICE_B]));

    await user.click(transport(container, 0));

    // The second voice note is untouched: still idle, still showing `play`.
    // With the shared `audio-0` id both bubbles read as the current track and
    // this count was 0.
    expect(icons(container, 'play')).toBe(1);
    expect(icons(container, 'pause') + icons(container, 'ellipsis-horizontal')).toBe(1);
  });

  it('the same audio attached twice is one track', async () => {
    // The rejected alternative, tested. Giving ChatBubble the MESSAGE id would
    // also separate the two voice notes above, but it identifies the wrong
    // thing: a forwarded voice note is the same audio, and keying on the
    // message would download and cache it a second time. Identity follows the
    // audio, so playing one copy plays both.
    const user = userEvent.setup();
    const { container } = render(thread([VOICE_A, VOICE_A]));

    await user.click(transport(container, 0));

    expect(icons(container, 'play')).toBe(0);
  });
});
