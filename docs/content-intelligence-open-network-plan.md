# Minds 2.0 Content Intelligence and Open-Network Plan

## Mission

Build Minds 2.0 into the best place to discover, understand and interact with the most important people, creators, communities and stories across Minds and the open web.

Minds must selectively ingest high-value content, moderate it before distribution, preserve its provenance, control processing costs and support genuine two-way participation wherever the underlying protocol allows it.

External popularity is a discovery signal—not automatic permission to enter Minds feeds.

## Platform architecture

Implement this as a shared Recursiv platform capability consumed by the Minds project through typed SDK interfaces.

Separate four layers:

1. **Connector layer:** Communicates with external networks and sources.
2. **Content Intelligence layer:** Normalizes identities, content, events and engagement.
3. **Trust layer:** Moderates, verifies, scores and quarantines.
4. **Minds product layer:** Channels, feeds, discussions, expert agents, notifications and protocol interactions.

Minds remains the product and editorial authority. Recursiv provides the scalable engine.

## Unified adapter contract

Replace the current read-only `collect()` contract with capability-declared adapters supporting applicable operations:

- `discover`
- `stream`
- `backfill`
- `search`
- `resolveIdentity`
- `fetchProfile`
- `fetchThread`
- `publish`
- `reply`
- `react`
- `repost`
- `follow`
- `delete`
- `health`
- `checkpoint`

Not every adapter supports every operation. Unsupported capabilities must be explicit rather than simulated.

## Include every existing Recursiv adapter

### ActivityPub

Preserve the legacy Minds federation estate: actor URLs, WebFinger records, private keys, followers and URI mappings. Support signed inbox/outbox delivery, follows, mentions, replies, boosts, reactions, edits, blocks, deletes and tombstones.

This work must coordinate with the existing legacy federation-identity lane. Never regenerate identities or casually export private keys.

### Bluesky / AT Protocol

Use durable repository streams or Jetstream with cursors instead of shallow keyword search. Preserve DIDs, handles, collections, reply roots, parent relationships and deletions. Support authenticated follows, posts, replies, reposts, likes and mentions.

### Nostr

Consume configurable relays with durable checkpoints and signature verification. Preserve event IDs, pubkeys, kinds, tags, threads, reactions and deletion events. Support Minds-controlled signed identities, notes, replies, reactions and appropriate discovery/list operations.

### RSS / Atom

Support tenant-, channel- and user-managed subscriptions rather than one global feed list. Discover feed URLs, use conditional requests, preserve GUIDs and canonical URLs, and monitor feed health. Generate RSS/Atom feeds for Minds creators and AI channels as the outbound equivalent.

### Hacker News

Ingest stories, comments, authors and thread structure with durable IDs and incremental checkpoints. Treat outbound submissions or comments as user-authorized integrations only where permitted; do not automate interaction through unsupported authentication.

### Email and newsletters

Ingest newsletters into user- or channel-scoped sources with sender authentication results and unsubscribe metadata. Support consented Minds newsletters, digests and reply handling through the suppression and consent ledger. Never bulk-send before the P10 protections exist.

### Web Search

Use Brave and other approved discovery providers to identify candidate URLs and sources. Search is discovery-only; it has no meaningful outbound social capability. Cache queries, budget requests and avoid treating rank position as truth.

### Podcasts

Discover and ingest podcast feeds, episodes, transcripts, chapters and media metadata. Preserve podcast and episode GUIDs. Let creators publish Minds-hosted podcast feeds and distribute them through open RSS. Do not rehost third-party audio without permission.

### Music

Ingest permitted public listening activity and music metadata through sources such as ListenBrainz. Preserve recording, artist and release identifiers where available. Support sharing and discovery inside Minds; only write externally where a provider exposes an authorized write capability.

## Canonical Content Graph

Normalize all adapter output into shared entities:

- `external_identity`
- `source`
- `source_subscription`
- `source_item`
- `content_event`
- `event_cluster`
- `claim`
- `claim_source`
- `media_asset`
- `engagement_snapshot`
- `story_revision`
- `protocol_thread`
- `delivery`
- `correction`
- `tombstone`

Every normalized graph record is tenant-scoped unless it is explicitly stored as a separate globally public, immutable base object. For externally identified protocol-derived records, derive the canonical key from `(network_id, project_id, entity_type, protocol, protocol_native_key)`, where `protocol_native_key` includes the protocol's stable namespace—for example, an AT URI, ActivityPub object URL, Nostr event ID, or RSS feed identity plus GUID. For records without a native protocol identity, derive a deterministic ID from `(network_id, project_id, entity_type, stable_scoped_parent_or_input_keys)`.

Use the corresponding scoped canonical key for database uniqueness/conflict targets, idempotency keys, upserts and lookups. Alias records and alias resolution carry the same network/project scope; no tenant-owned identity or mutable record may be keyed or merged on a protocol-global identifier alone.

A protocol-global object may be deduplicated only as a separate cryptographically content- or version-addressed base object containing globally public immutable payload; a URL or native identifier alone does not qualify. Every tenant still owns distinct scoped authorization, membership, subscription, provenance, moderation, revision, delivery, deletion, correction and tombstone state.

Within each network/project scope, a public channel publishes one canonical event story. Personal agents reference and annotate it through delivery records instead of creating duplicate private posts for every user.

## Scalable ingestion data plane

Use stateless, horizontally scalable workers around a durable queue or event bus:

`adapter → raw envelope → normalization → deduplication → moderation → scoring → enrichment → publication`

Required properties:

- At-least-once delivery with idempotent writes.
- Durable per-source and per-account checkpoints.
- Partitioning by protocol and the scoped identity/source key.
- Transactional outbox for outbound protocol actions.
- Dead-letter queues and replay tooling.
- Backpressure and bounded concurrency.
- Per-provider token buckets and circuit breakers.
- Exponential retry with jitter.
- Conditional fetches and content hashing.
- Separate real-time and historical-backfill worker pools.
- No LLM calls inside connector workers.
- Project/network scoping on every normalized record.
- Secrets isolated by tenant, adapter and external account.
- Immutable provenance with deletion/tombstone propagation.
- Search, vector and media indexes treated as rebuildable projections.

Do not promise exactly-once delivery across external networks. Provide effectively-once behavior through stable idempotency keys and reconciliations.

## Progressive-cost Content Intelligence

Never apply expensive AI to an entire stream.

1. Collect inexpensive metadata.
2. Reject malformed, blocked, duplicated and stale candidates.
3. Calculate heuristic momentum and authority scores.
4. Run fail-closed multimodal moderation.
5. Extract source content only for candidates crossing a value threshold.
6. Embed and cluster the strongest candidates.
7. Validate primary sources and contradictions.
8. Generate cited summaries only for publishable events.
9. Generate long-form articles only for exceptional, well-supported stories.
10. Distribute according to channel, user and notification thresholds.

Every protocol, provider and channel receives hourly and daily budgets. When constrained, reduce discovery depth and generation—not moderation.

## Ranking

Use an inspectable multi-objective score:

`value = momentum + authority + importance + relevance + novelty + source diversity + predicted community benefit − duplication − manipulation risk − safety risk − processing cost`

Measure:

- Engagement velocity and acceleration.
- Unique trusted participants.
- Cross-protocol and cross-source spread.
- Primary documents and direct evidence.
- Identity authenticity.
- Historical source reliability.
- Saves, meaningful replies and sustained reading.
- Emerging specialist authority.
- Coordinated amplification and spam patterns.
- Source, topic and viewpoint concentration.

Virality determines what deserves investigation. Trust and community benefit determine what Minds distributes.

## High-value people and interaction

Maintain dynamic watchlists for major creators, public figures, journalists, researchers, institutions and emerging topic experts.

Rank identities using protocol-native verification, follower-graph centrality, authentic engagement, cross-network references, community nominations and historical reliability.

Minds users and channel agents must be able to follow and interact with these identities across ActivityPub, Bluesky and Nostr. Outbound interactions must:

- Preserve the correct Minds human or agent identity.
- Clearly identify AI agents.
- Be relevant, rate-limited and non-spammy.
- Begin in approval mode.
- Respect blocks, deletes and protocol policies.
- Maintain complete inbound/outbound thread structure.

## Minds AI expert channels

Each channel is a Minds Community with:

- A public feed.
- A clearly labeled specialist agent.
- A linked discussion and Ask-the-Expert experience.
- Defined sources and protocol watchlists.
- A publication budget and cadence.
- A risk and autonomy policy.
- Source-grounded memory.
- Visible citations, uncertainty and corrections.

Start with Breaking/World News, Machine State and Skywatch. Publish one evolving event hub instead of repeated posts for every covering article.

## Safety and control

No item reaches Minds distribution without platform moderation.

Require fail-closed screening, quarantine, multimodal coverage, prompt-injection isolation, source reputation, appeals, immutable audit records and granular kill switches.

High-risk politics, elections, health, crime, active violence and allegations require human review. Source deletion or retraction must propagate through stories, feeds, search indexes, embeddings, agent memory and outbound protocol copies.

## Capability dependency map — not a claim queue

This list defines dependency and safety relationships, not execution priority or a second backlog. `scripts/loop-status.sh`, its `AVAILABLE NOW` rows and the live dispatcher score are authoritative. Safely independent prepublication work may land in any dispatcher-selected order. P8 alone is not a blocker for those foundations, but it must exit before any later step activates serving, high-volume ingestion, outbound action or autonomy.

1. Repair protocol uniqueness constraints, cursors, health and observability.
2. Introduce the capability-based adapter interface.
3. Build the Content Graph and Source Registry.
4. Add the durable ingestion data plane and cost controls.
5. Upgrade all nine existing adapters for collect-only candidate ingestion.
6. Integrate Event Registry and Openverse into the scoped unpublished candidate plane.
7. Run three channels in unpublished shadow mode.
8. Complete P8 moderation and quarantine before publication, serving, high-volume ingestion, outbound action or autonomy.
9. Validate quality, moderation, latency and cost.
10. Publish under human approval.
11. Enable inbound protocol follows and conversations.
12. Enable approved outbound ActivityPub, Bluesky and Nostr interaction.
13. Expand autonomy, channels and sources only from measured success.
14. Feed every workstream into the existing controller and prioritization queue without colliding with Jack-owned federation, discovery or Boost lanes.

Success means Minds delivers a clean, fresh and diverse stream of the open web’s most important people and events—with real interoperability, sustainable costs, strong moderation and architecture that can scale horizontally without turning into a garbage fire.

## Owner sequencing decision — 2026-08-27

This plan creates no separate P8 deferral, queue or release test. While `scripts/loop-status.sh` does not render `minds-ladder-p8` under `AVAILABLE NOW`, claim the highest-scoring row it does render. Once P8 appears there, the live dispatcher score governs. No agent may block or skip P8 by citing the dependency map or this section. This does not weaken, remove, complete or re-count P8.

Until P8 exits, every externally collected item must remain **unpublished** in a project- and network-scoped raw/candidate/quarantine plane. External content must be unreachable from feeds, search, event hubs, agent memory, notifications, public delivery and outbound/autonomous actions. No popularity score, shadow-channel result or missing provider may bypass this boundary.

Continue now with reversible prepublication foundations: explicit opt-in, tenant/project isolation, deterministic identity and uniqueness, raw envelopes and canonical candidates, checkpoints, idempotency, provenance, tombstones, outbox/DLQ/replay, backpressure, provider budgets and circuit breakers, capability-declared adapters, and typed API/SDK/MCP/CLI surfaces. Simulation and missing-provider modes are no-write. Use synthetic two-network/two-project fixtures and fake providers; do not inspect or refresh production tenant rows for development evidence.

P8 remains the launch and publication gate for feeds, search, event hubs, agent memory, notifications, public delivery, high-volume ingestion and autonomy. Complete it when it enters `AVAILABLE NOW` and before any of those surfaces activate.
