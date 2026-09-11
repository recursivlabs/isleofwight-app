import { Platform } from 'react-native';

/**
 * Inject global CSS for web-only hover, transition, scrollbar, and
 * selection styles. Reads its colors from CSS custom properties that
 * the theme provider sets on <body>, so they flip live with light/dark
 * mode.
 *
 * The theme provider is responsible for keeping the variables in sync;
 * see lib/theme.tsx → applyWebCssVars().
 */
export function injectWebStyles() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = `
    :root {
      --scrollbar-thumb: rgba(255,255,255,0.08);
      --scrollbar-thumb-hover: rgba(255,255,255,0.15);
      --selection-bg: rgba(212,168,68,0.3);
      --row-hover: rgba(255,255,255,0.04);
    }

    /* CSS-driven hover for list rows (Discover results + landing). Driving the
       tint in CSS means hovering a row fires NO React re-render — the theme
       provider keeps --row-hover in sync with the palette. */
    [data-hover-row]:hover { background-color: var(--row-hover); }

    /* Smooth transitions on all interactive elements */
    [role="button"], [data-focusable="true"], a {
      transition: opacity 0.1s ease, background-color 0.15s ease, transform 0.1s ease !important;
    }
    [role="button"]:hover, [data-focusable="true"]:hover {
      opacity: 0.85;
    }

    /* Smooth page transitions */
    [data-testid="screen-container"], main, [role="main"] {
      animation: fadeIn 0.15s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0.7; }
      to { opacity: 1; }
    }

    /* Scrollbar styling — themed via CSS variables */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: var(--scrollbar-thumb);
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }

    /* The overlay scrollbar (components/WebScrollbar) marks whichever element it
       has adopted. Without this the page shows two bars for one scroll: the
       overlay at the window edge and the native one at the column edge. Only the
       adopted element is hidden, so dropdowns and chat lists keep theirs. */
    .has-overlay-scrollbar { scrollbar-width: none; }
    .has-overlay-scrollbar::-webkit-scrollbar { width: 0; height: 0; display: none; }

    /* Remove focus outlines on interactive elements (we handle focus visually) */
    *:focus { outline: none; }

    /* Smooth font rendering */
    body {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Selection color — themed */
    ::selection { background: var(--selection-bg); }
  `;
  document.head.appendChild(style);
}
