/**
 * Identity for an audio track whose caller has no id of its own to give.
 *
 * `AudioTrack.id` is load-bearing in two places that outlive the component that
 * produced it: the provider answers "is this the current track?" with
 * `current.id === id`, and the native downloads index keys the cached FILE on
 * it. A caller that could not tell which audio it was holding used to fall back
 * to `audio-<index>` — unique inside one MediaViewer and identical across every
 * other one, so every DM voice note in the app carried the id `audio-0`.
 *
 * The URL is the one thing that does identify the audio, so derive from that.
 * The query string and fragment are dropped: the same object re-signed with a
 * fresh token is the same audio and must not orphan its download. The result is
 * hashed rather than used raw because the native downloader turns the id into a
 * filename, where a full URL risks the filesystem's name-length limit.
 *
 * Two empty URLs collide, which is correct — neither identifies any audio, and
 * a track with no URL cannot play.
 */

/**
 * 64 bits from two independent 32-bit lanes, so the fallback ids of one
 * person's downloads do not collide in practice. Deliberately not a crypto
 * hash: this is an identity, not a secret, and it must be cheap on every
 * render.
 */
function hash64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13);
  }
  const lo = (h1 >>> 0).toString(16).padStart(8, '0');
  const hi = (h2 >>> 0).toString(16).padStart(8, '0');
  return lo + hi;
}

/** Stable, filename-safe track id derived from the audio's own URL. */
export function audioTrackIdFromUrl(url: string): string {
  const canonical = (url || '').split('#')[0].split('?')[0];
  return `audio:${hash64(canonical)}`;
}
