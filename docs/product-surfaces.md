# Minds product surfaces

This is the route-complete source inventory for the Minds app. It answers “what surface exists in
this repository?” It does **not** claim that every route is usable in production: a source file is a
positive implementation anchor, not device proof, deployment proof, or permission proof.

Re-run `pnpm docs:check` after adding, removing, or renaming a route. The check walks `app/`, excludes
Expo layout/HTML files, and requires every page source below to remain listed.

## Entry and account lifecycle

| Source route | Public path | Access / purpose |
|---|---|---|
| `app/index.tsx` | `/` | Signed-out landing plus the primary OTP/sign-in state machine; redirects an authenticated account into the app. |
| `app/login.tsx` | `/login` | Conventional login alias for the primary OTP-first landing, kept out of the dynamic username route. |
| `app/(tabs)/index.tsx` | `/` in the signed-in tab group | For You / Following home feed. Authentication decides which `/` implementation renders. |
| `app/(auth)/sign-in.tsx` | `/sign-in` | Compatibility entry into the canonical login state, including recovery and OTP fallback. |
| `app/(auth)/sign-up.tsx` | `/sign-up` | Compatibility sign-up route. |
| `app/signin.tsx` | `/signin` | Conventional alias for the canonical login state, including recovery and OTP fallback. |
| `app/signup.tsx` | `/signup` | Conventional alias for the supported account-creation screen. |
| `app/register.tsx` | `/register` | Registration alias for the supported account-creation screen. |
| `app/auth/index.tsx` | `/auth` | Auth compatibility entry and redirect. |
| `app/auth/sign-in.tsx` | `/auth/sign-in` | Unique OTP-first handoff for signed-out private deep links, preserving the requested return route. |
| `app/auth/pick-username.tsx` | `/auth/pick-username` | Fresh-account handle selection. |
| `app/reset-password.tsx` | `/reset-password` | Password-reset link completion. |
| `app/verify-email-change.tsx` | `/verify-email-change` | Signed-in completion of an expiring, single-use email-change link. |
| `app/settings.tsx` | `/settings` | Signed-in account, privacy, notification, appearance, security, and deletion settings. |
| `app/switch-account.tsx` | `/switch-account` | Signed-in network/account switching. |
| `app/moderation.tsx` | `/moderation` | Public principles plus account-bound restriction, decision, sign-out, and appeal handling. |
| `app/privacy.tsx` | `/privacy` | Public in-app privacy disclosure. |

## Social graph, publishing, and discovery

| Source route | Public path | Access / purpose |
|---|---|---|
| `app/(tabs)/create.tsx` | `/create` | Signed-in post, reply, media, article, community, agent, and app composer modes. |
| `app/post/[id].tsx` | `/post/:id` | Public share/detail read with signed-in interactions. |
| `app/[username].tsx` | `/:username` | Root-profile compatibility route. |
| `app/user/[username].tsx` | `/user/:username` | Profile, follow, report, avatar, and owner controls. |
| `app/profile.tsx` | `/profile` | Redirect to the signed-in account's canonical profile URL. |
| `app/groups.tsx` | `/groups` | Community directory and creation. |
| `app/communities.tsx` | `/communities` | Compatibility redirect to `/groups`. |
| `app/community/[id].tsx` | `/community/:id` | Community detail, membership, and content. |
| `app/community/manage/[id].tsx` | `/community/manage/:id` | Running a group: banner and picture, name and description, who can join, invite link, join requests, members and roles, bans, delete. Owners, admins and moderators only. |
| `app/(tabs)/discover/index.tsx` | `/discover` | Discover landing; signed-out visitors get explicit OTP/password entry instead of an empty data surface. |
| `app/(tabs)/discover/posts.tsx` | `/discover/posts` | Ranked/semantic post discovery. |
| `app/(tabs)/discover/people.tsx` | `/discover/people` | People search/discovery. |
| `app/(tabs)/discover/communities.tsx` | `/discover/communities` | Community search/discovery. |
| `app/(tabs)/discover/agents.tsx` | `/discover/agents` | Agent search/discovery. |
| `app/(tabs)/explore.tsx` | `/explore` | Search compatibility redirect into Discover. |
| `app/bookmarks.tsx` | `/bookmarks` | Signed-in saved posts. |
| `app/blocked.tsx` | `/blocked` | Signed-in block-list management. |
| `app/muted.tsx` | `/muted` | Signed-in mute-list management. |

## Conversation, AI, growth, and monetization

| Source route | Public path | Access / purpose |
|---|---|---|
| `app/(tabs)/chat.tsx` | `/chat` | Signed-in conversation list and active chat shell. |
| `app/chat/[id].tsx` | `/chat/:id` | Canonical conversation detail entry. |
| `app/(tabs)/notifications.tsx` | `/notifications` | Signed-in notifications and read state. |
| `app/live.tsx` | `/live` | Public Minds Live spectator stream, kept entirely inside the Minds experience with an adult-content notice. |
| `app/agent.tsx` | `/agent` | Personal-agent creation, model, and prompt controls. |
| `app/ai.tsx` | `/ai` | Signed-in AI conversation surface. |
| `app/invites.tsx` | `/invites` | Referral codes, invite sharing, and growth attribution. |
| `app/feedback.tsx` | `/feedback` | User feedback into the community-evolution/roadmap pipeline. |
| `app/boost.tsx` | `/boost` | Boost campaign creation/status for Jack's active Boost lane. |
| `app/wallet.tsx` | `/wallet` | MINDS balance and token ledger. |
| `app/upgrade.tsx` | `/upgrade` | Public paid-tier selection; signed-out intent is preserved through authentication before checkout. |
| `app/billing.tsx` | `/billing` | Billing/subscription status. |

## Admin and developer control plane

These routes are implementation anchors, not public-access promises. Every route wrapped with
`withAdminGuard` redirects a non-admin before rendering its hooks.

| Source route | Public path | Access / purpose |
|---|---|---|
| `app/admin.tsx` | `/admin` | Admin users, posts, reports, statistics, and moderation operations. |
| `app/apps.tsx` | `/apps` | Admin-gated Recursiv project creation/list/deploy. |
| `app/email.tsx` | `/email` | Admin email/campaign surface. |
| `app/jobs.tsx` | `/jobs` | Admin job management. |
| `app/org-settings.tsx` | `/org-settings` | Admin organization settings. |
| `app/protocols.tsx` | `/protocols` | Admin decentralized-protocol status/settings/refresh. |
| `app/webhooks.tsx` | `/webhooks` | Admin webhook management. |

## Cross-route capabilities

| Capability | Positive source anchors | What remains outside this inventory |
|---|---|---|
| Today / AI-curated stories | `components/FeedInserts.tsx`, `components/ArticleCard.tsx`, `lib/curator/` | Editorial quality, freshness, attribution, and live traffic. |
| Ranking and discovery | `lib/hooks.ts`, `lib/discover.tsx`, `components/FeedSidebar.tsx` | Server ranker behavior lives in Recursiv and needs live tenant-scoped proof. |
| Real-time chat/notifications | `lib/realtime.ts`, `lib/chatEvents.ts`, `lib/notifications.ts` | Device push receipt and long-running socket reliability. |
| Audio | `components/audio/`, `lib/audio/`, `lib/audioPlayer.tsx` | Device matrix and background playback evidence. |
| Live spectator video | `app/live.tsx`, `lib/live.ts`, `components/VideoPlayer.tsx` | Minds embeds the current public LL-HLS audience feed behind a product-neutral adapter; native participation controls remain future work. |
| Boost | `lib/boost.ts`, `components/BoostBadge.tsx`, `app/boost.tsx` | Jack owns approve → serve → impression → bill proof; this docs lane does not implement it. |
| Wallet/token | `lib/wallet.ts`, `components/WalletCard.tsx`, `app/wallet.tsx` | Token policy/evolution decisions and production financial reconciliation. |
| Monitoring | `lib/monitoring.ts`, `lib/nativeMonitoring.native.ts` | Live hardware-to-vendor receipt and negative-control evidence. |

The corresponding API/SDK/MCP/CLI surfaces are inventoried separately in
[`docs/developer-surfaces.md`](./developer-surfaces.md).
