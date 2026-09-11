import * as React from 'react';
import { Platform } from 'react-native';

/**
 * X-style overlay scrollbar for web.
 *
 * TWO THINGS THE NATIVE SCROLLBAR CANNOT DO HERE.
 *
 * 1. POSITION. The app shell is a centred column capped at 1280px, and the feed
 *    scrolls inside it. A native scrollbar therefore draws at the right edge of
 *    that column -- a few pixels from the edge on a laptop, hundreds on a wide
 *    monitor. X scrolls the document, so its bar is always pinned to the far
 *    right of the window. This draws a fixed overlay bar at the window edge and
 *    drives the inner scroller from it, which gets X's placement without moving
 *    the app onto document scroll.
 *
 * 2. AUTO-HIDE. There is no CSS for "fade the thumb out when scrolling stops".
 *    Overlay scrollbars do it natively on macOS with a trackpad, but not with a
 *    mouse, and not on Windows or Linux at all. So it is done here on a timer.
 *
 * WHY IT LATCHES ONTO THE SCROLLING ELEMENT RATHER THAN A FIXED SELECTOR.
 * Every screen builds its own ScrollView / FlatList, and they mount and unmount
 * as routes change. Rather than tag each one and keep them all in sync, this
 * listens for scroll in the capture phase and adopts whatever is scrolling.
 *
 * The size guard below is what keeps this from hijacking small scrollers. A
 * dropdown or a chat list that scrolls must NOT paint a full-height bar down
 * the side of the window, so a candidate has to be tall enough, and positioned
 * enough like a page, to count as the page scroller.
 */

/** A scroller must fill this much of the window height to count as the page. */
const MIN_VIEWPORT_RATIO = 0.6;
/** Idle time before the bar fades out, matched to X by eye. */
const HIDE_AFTER_MS = 900;

const TRACK_WIDTH = 10; // pointer target
const THUMB_WIDTH = 6;  // painted width
const MIN_THUMB = 32;

export function WebScrollbar() {
  if (Platform.OS !== 'web') return null;
  return <WebScrollbarImpl />;
}

function WebScrollbarImpl() {
  const [metrics, setMetrics] = React.useState<{ top: number; height: number } | null>(null);
  const [visible, setVisible] = React.useState(false);

  const scrollerRef = React.useRef<HTMLElement | null>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = React.useRef<{ startY: number; startScroll: number } | null>(null);

  // Reading layout is cheap here but happens on every scroll event, so it is
  // rAF-batched: without it a fast trackpad flick lays out dozens of times a
  // frame and the bar visibly lags the content it is describing.
  const frame = React.useRef<number | null>(null);

  const measure = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const winH = window.innerHeight;
    const { scrollHeight, clientHeight, scrollTop } = el;

    // Nothing to scroll: drop the bar rather than draw a full-height thumb.
    if (scrollHeight <= clientHeight + 1) { setMetrics(null); return; }

    const ratio = clientHeight / scrollHeight;
    const height = Math.max(MIN_THUMB, Math.round(winH * ratio));
    const maxTop = winH - height;
    const progress = scrollTop / (scrollHeight - clientHeight);
    setMetrics({ top: Math.round(maxTop * Math.min(1, Math.max(0, progress))), height });
  }, []);

  const show = React.useCallback(() => {
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // While dragging the bar must stay put even though scroll events keep
    // firing; hiding the thing under the cursor would be absurd.
    hideTimer.current = setTimeout(() => {
      if (!draggingRef.current) setVisible(false);
    }, HIDE_AFTER_MS);
  }, []);

  React.useEffect(() => {
    const isPageScroller = (el: HTMLElement) => {
      if (el.clientHeight < window.innerHeight * MIN_VIEWPORT_RATIO) return false;
      const r = el.getBoundingClientRect();
      // Must start near the top of the window and run most of its height --
      // this is what separates the page from a tall-but-inset panel.
      return r.top <= window.innerHeight * 0.35 && r.bottom >= window.innerHeight * 0.6;
    };

    const onScroll = (e: Event) => {
      const t = e.target;
      const el: HTMLElement | null =
        t === document || t === document.documentElement || t === window
          ? document.scrollingElement as HTMLElement
          : (t as HTMLElement);
      if (!el || !el.getBoundingClientRect) return;
      if (!isPageScroller(el)) return;

      // Hide this element's own scrollbar so the overlay does not sit beside a
      // second, differently-placed bar describing the same scroll.
      el.classList.add('has-overlay-scrollbar');
      scrollerRef.current = el;

      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => { measure(); show(); });
    };

    // Capture: scroll does not bubble, so a listener on document only sees these
    // events on the way down.
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', measure);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', measure);
      if (frame.current) cancelAnimationFrame(frame.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [measure, show]);

  // ---- drag the thumb ----
  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = draggingRef.current;
      const el = scrollerRef.current;
      if (!drag || !el || !metrics) return;
      const winH = window.innerHeight;
      const travel = winH - metrics.height;
      if (travel <= 0) return;
      // Map pointer travel down the track onto the scrollable distance, so the
      // thumb stays under the cursor instead of drifting away from it.
      const delta = (e.clientY - drag.startY) / travel;
      el.scrollTop = drag.startScroll + delta * (el.scrollHeight - el.clientHeight);
      e.preventDefault();
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      show();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [metrics, show]);

  if (!metrics) return null;

  return (
    <div
      onPointerEnter={show}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: TRACK_WIDTH,
        height: '100vh',
        // Above the app, below modals and their overlays.
        zIndex: 9998,
        // The track must never eat clicks meant for the page behind it; only the
        // thumb is interactive.
        pointerEvents: 'none',
      }}
    >
      <div
        onPointerDown={(e) => {
          const el = scrollerRef.current;
          if (!el) return;
          draggingRef.current = { startY: e.clientY, startScroll: el.scrollTop };
          setVisible(true);
          if (hideTimer.current) clearTimeout(hideTimer.current);
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          e.preventDefault();
        }}
        style={{
          position: 'absolute',
          top: metrics.top,
          right: (TRACK_WIDTH - THUMB_WIDTH) / 2,
          width: THUMB_WIDTH,
          height: metrics.height,
          borderRadius: THUMB_WIDTH / 2,
          background: 'var(--scrollbar-thumb-solid, rgba(255,255,255,0.28))',
          opacity: visible ? 1 : 0,
          // No transition on the way in: the bar must appear the instant the
          // content moves, then ease out once scrolling stops.
          transition: visible ? 'opacity 0.1s linear' : 'opacity 0.4s ease 0.15s',
          pointerEvents: 'auto',
          cursor: 'default',
        }}
      />
    </div>
  );
}
