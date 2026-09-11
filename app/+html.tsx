import { ScrollViewStyleReset } from 'expo-router/html';

// NOTE: this file is DEAD CODE under web.output "single" — Expo Router only
// renders +html.tsx for "static" output. The shipped equivalents live in
// scripts/inject-boot-shell.mjs (build-time default meta block) and
// scripts/meta-server.mjs (per-URL OG injection at request time). Kept in sync
// so a future switch back to "static" output starts from the right values.
const SITE_ORIGIN = 'https://isleofwight.on.minds.io'; // minds.com = legacy until cutover
const OG_IMAGE = `${SITE_ORIGIN}/og-invite.png`; // 1200x630, served from /public
const OG_TITLE = 'Join me on Isle of Wight';
const OG_DESCRIPTION = 'Local news, events, groups and chat for the Isle of Wight.'; // no em dashes in descriptions

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Isle of Wight</title>
        <meta name="description" content={OG_DESCRIPTION} />
        <link rel="icon" href="/favicon.ico" />

        {/* PW(2) deploy discriminator. §2 requires BOTH strings committed BEFORE
            the deploy, because a worker who picks the string afterwards chooses
            the very thing the rollback verifier greps for. "Minds" appears in
            every build and is non-diagnostic in both directions (§5.20) — this
            is not. Candidate: the marker below. Previous: the bundle hash
            index-07628618e137db722807402c1c649219, live as of 2026-07-31. */}
        <meta name="minds-build-marker" content="minds-build-2026-07-31-pw2" />

        {/* Open Graph — Signal, iMessage, Slack, Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Isle of Wight" />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:url" content={SITE_ORIGIN} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Isle of Wight, you're invited" />

        {/* Twitter / X Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={OG_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        <meta name="theme-color" content="#08080a" />
        <ScrollViewStyleReset />
      </head>
      {/* NOTE: web.output is "single", so Expo Router does NOT render this file
          for the served HTML — the instant boot shell is injected into the built
          dist/index.html by scripts/inject-boot-shell.mjs (run from the build
          script), and removed on first paint by app/_layout.tsx (#minds-boot). */}
      <body>{children}</body>
    </html>
  );
}
