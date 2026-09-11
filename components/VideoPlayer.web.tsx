// Web video player: <video> + hls.js for HLS streams; native <video src> for
// progressive files (the local blob/mp4 shown in the composer preview). Sizes
// to the video's real aspect ratio (letterboxed on black, capped by maxHeight).
//
// Encoding lifecycle: a freshly-uploaded Bunny video isn't playable until it
// finishes encoding. Instead of showing a black/broken box, we detect the load
// failure, check the video status, and if it's still "processing" we show a
// "Processing" overlay and poll until it's ready, then load and play. Status is
// only checked when a load actually fails, so already-ready videos cost nothing.
import React, { useEffect, useRef, useState } from 'react';
import type HlsJs from 'hls.js';
import { getVideoStatus, extractVideoGuid } from '../lib/video';

export interface VideoPlayerProps {
  uri: string;
  poster?: string;
  autoplay?: boolean;
  accessibilityLabel?: string;
  /** Max rendered height in px. Default 480. */
  height?: number;
  onPlaybackReady?: () => void;
  onPlaybackError?: () => void;
}

const isHlsUri = (uri: string) => /\.m3u8(\?|$)/i.test(uri) || uri.includes('/playlist');
type State = 'loading' | 'ready' | 'processing' | 'failed';

/**
 * Some Chromium shells report "maybe" for native HLS but never buffer it.
 * Apple WebKit clients genuinely support HLS; everyone else should use hls.js.
 */
export function shouldUseNativeHls(
  video: Pick<HTMLVideoElement, 'canPlayType'>,
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  if (!video.canPlayType('application/vnd.apple.mpegurl')) return false;
  const appleMobile = /\b(iPhone|iPad|iPod)\b/i.test(userAgent);
  const desktopSafari = /Safari/i.test(userAgent)
    && !/(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|FxiOS)/i.test(userAgent);
  return appleMobile || desktopSafari;
}

export function VideoPlayer({
  uri,
  poster,
  autoplay = true,
  accessibilityLabel,
  height = 480,
  onPlaybackReady,
  onPlaybackError,
}: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState(16 / 9);
  const [state, setState] = useState<State>('loading');
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryPreferences = useRef<{
    uri: string;
    autoplay: boolean;
    muted: boolean;
    volume: number;
  } | null>(null);
  const readyCallback = useRef(onPlaybackReady);
  const errorCallback = useRef(onPlaybackError);

  useEffect(() => { readyCallback.current = onPlaybackReady; }, [onPlaybackReady]);
  useEffect(() => { errorCallback.current = onPlaybackError; }, [onPlaybackError]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryAttempt binds this effect to the fresh keyed media element.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const preferences = retryPreferences.current;
    if (preferences?.uri === uri && preferences.autoplay === autoplay) {
      video.muted = preferences.muted;
      video.volume = preferences.volume;
    }
    setState('loading');
    const guid = extractVideoGuid(uri);
    let hls: HlsJs | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const holdTimers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    let nativeSourceAttached = false;

    const fail = () => {
      if (cancelled) return;
      setState('failed');
      errorCallback.current?.();
    };

    // The source is attached after mount (and, for hls.js, after an async
    // import). Browsers do not consistently re-run declarative `autoPlay` when
    // that happens, leaving a fully buffered muted video paused at 0:00. An
    // explicit play request makes the prop truthful; controls remain available
    // when browser policy rejects it.
    const playIfRequested = () => {
      if (!autoplay || cancelled) return;
      try {
        const result = video.play();
        if (result) void result.catch(() => undefined);
      } catch {
        // Controls are the intentional fallback when a browser denies autoplay.
      }
    };

    const pollUntilReady = () => {
      setState('processing');
      let attempt = 0;
      const startedAt = Date.now();
      const tick = async () => {
        if (cancelled || !guid) return;
        const st = await getVideoStatus(guid).catch(() => null);
        if (cancelled) return;
        if (st?.status === 'ready') { void load(); }
        else if (st?.status === 'failed') { fail(); }
        else if (Date.now() - startedAt < 10 * 60_000) {
          // still processing — back off (4s → 60s cap) with a hard stop so a
          // lost encode webhook can't keep every viewer polling forever
          attempt += 1;
          pollTimer = setTimeout(tick, Math.min(4000 * 2 ** Math.min(attempt - 1, 4), 60_000));
        } else { fail(); }
      };
      pollTimer = setTimeout(tick, 3000);
    };

    const onFatalError = (type: string) => {
      // A network/manifest failure on a fresh upload usually means it's still
      // encoding. Check status; otherwise it's genuinely unavailable.
      if (hls) { hls.destroy(); hls = null; }
      if (!guid) { fail(); return; }
      getVideoStatus(guid)
        .then((st) => {
          if (cancelled) return;
          if (st?.status === 'processing') pollUntilReady();
          else fail();
        })
        .catch(fail);
    };

    // Progressive files and Safari's native HLS path do not involve hls.js, so
    // its error callback can never fire for them. Listen to the media element
    // itself, but only when this effect attached the source directly; hls.js
    // owns its own recovery path and reports fatal errors above.
    const onNativeError = () => {
      if (nativeSourceAttached) onFatalError('native');
    };
    video.addEventListener('error', onNativeError);

    async function load() {
      if (cancelled || !video) return;
      setState('loading');
      // Progressive file (local blob / mp4) or genuine Apple-native HLS → just
      // set src. Chromium shells that merely claim "maybe" support use hls.js.
      if (!isHlsUri(uri) || shouldUseNativeHls(video)) {
        nativeSourceAttached = true;
        video.src = uri;
        playIfRequested();
        return;
      }
      // hls.js is ~158 KB gzipped and ONLY adaptive-bitrate playback needs it.
      // It used to be a static import, so every first visit downloaded and
      // parsed it before the page was interactive — including the majority of
      // sessions that never play a video, and every Safari session, which
      // returns above on native HLS and could never have used it. #193.
      //
      // The import is awaited HERE rather than at module scope so the two early
      // returns above cost nothing at all.
      let Hls: typeof HlsJs;
      try {
        Hls = (await import('hls.js')).default;
      } catch {
        // The chunk failed to load (offline, blocked). Hand the URL to the
        // browser rather than leaving a dead player: Safari plays it, others
        // will fail the same way they would have with hls.js unsupported.
        if (!cancelled && video) {
          nativeSourceAttached = true;
          video.src = uri;
        }
        playIfRequested();
        return;
      }
      // The chunk download is async, so the component may have unmounted or the
      // uri changed while it was in flight. Without this the cleanup below has
      // already run and we would attach a player nobody destroys.
      if (cancelled || !video) return;
      if (Hls.isSupported()) {
        // capLevelToPlayerSize is intentionally OFF. It bounds ABR to the
        // rendered element size, but before the <video> has measured itself it
        // floors to the LOWEST rendition — and even after our first-segment seed,
        // ABR resumes and re-floors, so the opening 3-4s play blurry. A high
        // default bandwidth estimate makes hls.js pick a sharp level immediately;
        // we accept a little extra egress for a crisp open (re-add size capping
        // later via maxAutoLevel if Bunny egress becomes a problem).
        hls = new Hls({ enableWorker: true, abrEwmaDefaultEstimate: 12_000_000, startLevel: -1 });
        hls.loadSource(uri);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          playIfRequested();
          // Hold the opening at a sharp rendition (lowest level ≥720p, else the
          // top) for the first few segments so it never starts blurry, THEN hand
          // back to adaptive — setting startLevel + a short hold, not a permanent
          // pin, so ABR still adapts to real bandwidth afterward.
          const levels = (hls?.levels || []) as Array<{ height?: number }>;
          if (hls && levels.length > 1) {
            let target = levels.length - 1; // default: top rendition
            const hd = levels.map((l, i) => ({ i, h: l.height || 0 })).filter((x) => x.h >= 720);
            if (hd.length) target = hd[0].i; // lowest rendition that is still ≥720p
            hls.startLevel = target;
            hls.nextLevel = target;
            // Keep the sharp level for ~4s (covers the window the user complained
            // about), then resume auto ABR.
            const t = setTimeout(() => { if (hls) hls.nextLevel = -1; }, 4000);
            holdTimers.push(t);
          }
        });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) { hls?.recoverMediaError(); return; }
          onFatalError(data.type);
        });
        return;
      }
      nativeSourceAttached = true;
      video.src = uri; // last resort
      playIfRequested();
    }

    void load();
    return () => {
      cancelled = true;
      video.removeEventListener('error', onNativeError);
      if (pollTimer) clearTimeout(pollTimer);
      holdTimers.forEach(clearTimeout);
      if (hls) hls.destroy();
    };
  }, [uri, autoplay, retryAttempt]);

  const retryPlayback = () => {
    const video = ref.current;
    if (video) {
      retryPreferences.current = { uri, autoplay, muted: video.muted, volume: video.volume };
    }
    // A fresh media element and effect dispose the failed HLS instance and
    // its pending work. Do not leave stale media events attached to this try.
    setState('loading');
    setRetryAttempt((attempt) => attempt + 1);
  };

  const onLoadedMetadata = () => {
    const v = ref.current;
    if (v?.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
  };

  const onPlaybackReadyEvent = () => {
    setState('ready');
    readyCallback.current?.();
  };

  return (
    <div
      style={{
        // Transparent surround + left-justified video: any contain() letterbox
        // shows the card background instead of black bars, and the frame hugs
        // the leading edge rather than centering.
        width: '100%', aspectRatio: String(ratio), maxHeight: height, marginLeft: 0, marginRight: 'auto',
        background: 'transparent', borderRadius: 12, overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
      }}
    >
      <video
        key={`${uri}:${retryAttempt}`}
        ref={ref}
        aria-label={accessibilityLabel}
        poster={poster}
        muted={autoplay}
        autoPlay={autoplay}
        loop
        playsInline
        controls
        onLoadedMetadata={onLoadedMetadata}
        onLoadedData={onPlaybackReadyEvent}
        onCanPlay={onPlaybackReadyEvent}
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'left center', display: 'block', visibility: state === 'ready' ? 'visible' : 'hidden' }}
      />
      {/* A video that cannot play keeps its poster: a legacy video whose bytes
          have not moved over yet still shows what it is, with a line that
          says so, instead of a bare dark box. */}
      {state === 'failed' && poster && (
        <img src={poster} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45 }} />
      )}
      {(state === 'processing' || state === 'loading' || state === 'failed') && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#cfcfd6' }}>
          {state === 'failed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.55)' }}>
              <span role="alert" style={{ fontSize: 14, fontFamily: 'Roboto-Medium', color: '#f2f2f2' }}>Couldn't load this video</span>
              <span style={{ fontSize: 12, fontFamily: 'Roboto-Regular', color: '#cfcfd6' }}>Check your connection or try again later.</span>
              <button
                type="button"
                onClick={retryPlayback}
                aria-label={accessibilityLabel ? `${accessibilityLabel}, retry video` : 'Retry video'}
                style={{ marginTop: 8, padding: '8px 16px', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 8, background: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', fontFamily: 'Roboto-Medium', fontSize: 14 }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <style>{"@keyframes mindsVidSpin { to { transform: rotate(360deg); } }"}</style>
              <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.25)', borderTopColor: '#fff', animation: 'mindsVidSpin 0.8s linear infinite' }} />
              {state === 'processing' && <span style={{ fontSize: 13, fontFamily: 'Roboto-Regular' }}>Processing video…</span>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
