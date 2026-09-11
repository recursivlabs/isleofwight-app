# Minds 2.0 Design System

## Brand
- **Name**: Minds
- **Tagline**: Powered by AI. Owned by you.
  <!-- The former openness tagline is RETRACTED here per §5.7 and §8 of docs/goal-prompt.md:
       `gh repo view recursivlabs/minds --json isPrivate,licenseInfo` returns
       `{"isPrivate":true,"licenseInfo":null}` (re-run 2026-08-01), so the estate cannot
       currently back the claim. README.md states this honestly already; this file was the
       last place on `main` still asserting it unqualified. Which layer opens, and under which
       licence, is issue #195 — when that lands and a LICENSE file exists, restore the tagline
       rather than re-deriving it. The phrase itself is deliberately NOT repeated here: §8's
       exit artifact is a literal `grep -c`, and a retraction that quotes what it retracts
       fails that grep exactly as the original claim did. -->
- **Subtitle**: Powered by AI. Owned by you.

## Colors
- **Background**: `#08080a` (deep black)
- **Surface**: `#111113` (card backgrounds)
- **Accent**: `#d4a844` (Minds gold)
- **Accent Hover**: `#e6bc54` (lighter gold)
- **Boost**: `#e6bc54` (gold)
- **Token**: `#f0d060` (bright gold)

## Typography
Dark theme, high contrast white text on deep black backgrounds.
System font stack, no custom fonts required.

## Design Principles
1. **Dark first** — deep, near-black backgrounds for a futuristic feel
2. **Minimal chrome** — content is the focus, UI gets out of the way
3. **Gold accents** — warm gold for all interactive elements, CTAs, active states
4. **Gold for value** — boost, tokens, and tips all use the gold family
5. **Instant feedback** — optimistic updates everywhere
6. **Futuristic simplicity** — clean lines, generous spacing, no visual noise

## Key Components
- **PostCard**: The core content unit with votes, replies, boost, tip
- **VoteButtons**: Upvote/downvote arrows (gold up, red down)
- **BoostBadge**: Gold rocket badge on boosted posts
- **NSFWOverlay**: Blur overlay with tap-to-reveal
- **WalletCard**: Token balance display with diamond icon
- **Avatar**: Circular with fallback initials, deterministic colors

## Architecture
- Expo Router for navigation
- Recursiv SDK for all backend operations
- AuthProvider for session management
- Custom hooks for data fetching (usePosts, useProfile, etc.)
- Optimistic updates for votes, follows, messages
