# X Design Parity — Minds Mobile

**Goal:** the app matches X's design and feel surface-for-surface, in Minds
branding (palette, wordmark, gold accent where X uses blue). X-level is the
floor. Same functionality, same motion quality, same speed.

**Rules of the pass**
- When in doubt, do what X does. Deviations need a reason written here.
- Monochrome iconography; fill state = active. Accent gold only where X uses
  brand blue (CTAs, links, badges, active tab underline).
- Every interactive element: pressed state + haptic per `lib/haptics.ts`
  vocabulary (tap / select / success / warn).
- Motion is spring-based (Reanimated), 150–300ms, never linear-slide-slow.

## Status legend
✅ shipped · 🔨 in progress · ⬜ open

## Pass 1 — engagement feel (shipped)
- ✅ Bottom bar: X-exact flat bar, hairline top border, monochrome fill/outline
  icons, badge in accent (replaced glow pill)
- ✅ Haptics vocabulary + wiring: vote, repost, bookmark, tab selects
- ✅ Vote burst micro-animation (spring pop on cast, quiet on retract)
- ✅ Keyboard: composers track keyboard 1:1 (keyboard-controller, iOS)
- ✅ Header: wordmark centered, avatar-left drawer, logo tap = home/top

## Pass 2 — scroll & navigation motion
- ✅ Feed header collapses on scroll down, returns on scroll up; tabs pinned
- ⬜ For You ⇄ Following: real horizontal pager (swipe pages WITH finger,
  animated underline follows) — current swipe is gesture-then-switch
- ⬜ Screen push transitions: stack slide + parallax matching X timing
- ✅ Pull-to-refresh haptic on trigger (branded spinner ⬜)
- ⬜ Drawer: match X's width/velocity/dim curve exactly

## Pass 3 — post surfaces
- ⬜ Post cell layout audit vs X: avatar 40, name/@handle/·time one-line rules,
  action row spacing/order (reply, repost, like, views?, bookmark+share right)
- ✅ Reply threading rails on the post page's ancestor chain
- ✅ Media grids (1/2/3/4 + '+N') and lightbox already shipped in MediaViewer
  (pinch-zoom + swipe-down dismiss ⬜ — viewer is tap-to-close today)
- ⬜ Quote posts render X-style (compact bordered card)
- ✅ Vote counter rolls directionally on change
- ⬜ Long-press on action buttons → context previews where X has them

## Pass 4 — profiles & detail screens
- ✅ Profile banner (3:1) + overlapping ringed avatar (collapsing mini-header
  + sticky tabs ⬜)
- ⬜ Follow button states + haptic success; counts row exact format
- ⬜ Post detail: focal post enlarged typography, engagement stats row,
  reply composer inline at bottom (already attached to keyboard)
- ⬜ Filters/sort affordances match X's pill-chip patterns everywhere
  (Discover already close; audit Notifications' All/Mentions split)

## Pass 5 — polish & speed
- ⬜ Skeletons everywhere content loads >150ms (no spinner-only screens)
- ⬜ Image caching/prefetch audit (feed scroll must never pop-in above fold)
- ⬜ List perf: getItemLayout/recycling audit; 60fps scroll on mid devices
- ⬜ Dark/light theme QA pass per surface
- ⬜ App icon/badge/splash consistency check

## Known deliberate deviations
- Voting is up/down (Minds identity) where X has like — keep, but with
  X-quality motion. Revisit only if Jack calls it.
- Agent chat is a Minds-only surface — its bar is Claude/iMessage parity
  (see chat UX work), not X DMs.

## Notifications (full X parity — shipped)
- ✅ All | Mentions filter tabs; auto-mark-read on view (badge clears by visiting)
- ✅ Live tab badge via socket (was 60s poll); live list refresh already existed
- ✅ Grouping by (type,target) with actor collection; tapping marks whole group read
- ✅ X-anatomy rows: type-glyph column, stacked engaging-user avatars (+N),
  aggregate lines, referenced-post excerpt + media thumbnail
- ✅ Reply/mention rows render post-like (avatar, name, time, quoted post hint)
- ✅ Server payload enriched: actor + post_preview at read time (PR #1964)
- Server aggregates reaction notifications per post per 5 min (anti-firehose)

## Navigation architecture — ✅ SHIPPED (root Stack)
Detail screens (post, profile, community, chat thread) currently live INSIDE
the Tabs navigator (hidden tab routes). Navigating to them is a TAB SWITCH,
not a stack push — so there is no native push animation, no iOS interactive
swipe-back, and "back" depends on the custom useSmartBack heuristic, which is
why backing out sometimes lands somewhere surprising.

X parity requires the standard architecture:
- Root becomes a native Stack; `(tabs)` is one stack screen
- post/[id], user/[username], community/[id], chat thread, settings move to
  root-stack screens → native push/pop transitions + edge-swipe-back for free
- Back always pops to the EXACT screen (and scroll position) you came from
- Tab state preserved under the stack; deep links unchanged (route paths keep
  working via redirects)
- Kill useSmartBack once real stack history exists

Shipped: root native Stack installed; 22 detail/utility screens moved out of
the Tabs navigator to stack routes (/post, /user, /community, /settings, …);
all route references rewritten; native push/pop + iOS edge-swipe-back active;
useSmartBack retained for deep-link cold-start fallback only.

Known X-delta (follow-up): the bottom tab bar hides on pushed detail screens.
X keeps it visible via per-tab stacks (shared route groups). Migrate later via
expo-router shared groups — (feed,search,alerts)/post/[id] — sized ~half day.
Desktop web detail pages currently render without the SideNav shell — restore
with a web-only layout wrapper when web ships this tree.
