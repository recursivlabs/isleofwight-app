/**
 * Resolve the signed-in user's single personal agent (e.g. Santiago).
 *
 * Why this exists: agents are listed owner-scoped + newest-first, and a heavy
 * Recursiv user can own hundreds of agents across projects. The personal agent
 * is often OLDER than a full page of them, so the old pattern —
 * `agents.list({ limit: 50 }).find(a => a.agent_type === 'personal')` —
 * silently returned nothing and every caller dead-ended to the *create agent*
 * screen even though a personal agent existed. (This was the "Santiago routes
 * to setup" bug.)
 *
 * The fix is an exact, pagination-proof lookup via the server-side
 * `agent_type=personal` filter, with a wider-scan fallback for any API that
 * predates the filter. Returns the agent object, or null if none exists.
 *
 * REQUEST-STORM FIX: this is called on mount by SEVERAL components at once
 * (the chat back-fill, the SideNav intro back-fill, the feed's CTA check, the
 * command palette, askAgent) — and the wider-scan fallback hits the heavy
 * `/agents?limit=100` endpoint. Un-deduped, a single web load fired that
 * endpoint 4-6× in parallel; each got 429'd, the SDK retried each, and the
 * retries stacked into a self-amplifying storm that tipped the per-minute API
 * key limit and made messages vanish into the "bug zone".
 *
 * Two layers stop that here:
 *   1. A short-lived in-memory CACHE of the resolved agent (per session). The
 *      personal agent effectively never changes within a session, so once one
 *      caller resolves it the rest read the cache — zero extra requests.
 *   2. fetchDeduped: concurrent callers that miss the cache SHARE one in-flight
 *      promise (one `/agents` request, one possible 429-retry sequence), instead
 *      of N independent requests racing each other.
 */
import { fetchDeduped } from './cache';

const isPersonal = (a: any): boolean =>
  a?.agent_type === 'personal' || a?.agentType === 'personal';

// Session cache of the resolved personal agent. `null` is a valid resolved
// value ("user has no personal agent") and is cached too, so the negative
// answer doesn't re-fan-out the heavy scan on every mount either.
let cached: { agent: any | null; at: number } | null = null;
// 5 minutes: long enough to cover the burst of mount-time lookups across a whole
// session of navigation, short enough that a freshly-created agent shows up
// without a reload. Explicit invalidation (below) covers the create path.
const PERSONAL_AGENT_TTL_MS = 5 * 60_000;

/**
 * Drop the cached personal agent so the next resolve re-fetches. Call after
 * creating / deleting the user's personal agent so callers pick it up without a
 * full reload. Also called by auth on user switch (see lib/auth.tsx).
 */
export function invalidatePersonalAgent(): void {
  cached = null;
}

async function doResolve(sdk: any): Promise<any | null> {
  // Preferred: exact server-side filter. CRITICAL: we still verify agent_type
  // client-side, because an older API that doesn't know the filter silently
  // IGNORES it and returns the newest agent instead (newest-first ordering).
  // Trusting that blindly hands back e.g. a freshly-created project agent and
  // opens a DM with the wrong agent. Only accept it if it's genuinely personal.
  try {
    const res = await sdk.agents.list({ agent_type: 'personal', limit: 1 });
    const first = (res?.data || [])[0];
    if (first && isPersonal(first)) return first;
  } catch {
    // Older API without the filter — fall through to the wider scan.
  }

  // Fallback: scan a large page and match client-side. NOTE: we deliberately do
  // NOT catch here. If this call fails (e.g. the API is rate-limiting / 429),
  // that's a transient LOOKUP FAILURE — not proof the user has no personal
  // agent. Returning null here would make callers route an existing-agent user
  // to the "create agent" screen. Let it throw so callers (all wrapped in
  // try/catch) treat it as "couldn't resolve right now" and no-op instead.
  const res = await sdk.agents.list({ limit: 100 });
  return (res?.data || []).find(isPersonal) ?? null;
}

export async function resolvePersonalAgent(sdk: any): Promise<any | null> {
  if (!sdk?.agents?.list) return null;

  // 1) Serve the session cache — covers the storm of concurrent mount-time
  // lookups after the first one resolves, at zero request cost.
  if (cached && Date.now() - cached.at < PERSONAL_AGENT_TTL_MS) {
    return cached.agent;
  }

  // 2) Coalesce concurrent cache-misses into ONE shared request. Every caller
  // racing on the same tick awaits the same promise, so the API sees a single
  // `/agents` lookup (and at most one SDK 429-retry sequence) instead of N.
  const agent = await fetchDeduped('req:personal-agent', () => doResolve(sdk));

  // Only cache a definitive answer (the resolve resolved, possibly to null).
  // Throws (transient 429/network) propagate to the caller and are NOT cached,
  // so a failed lookup never poisons the session into "no agent".
  cached = { agent, at: Date.now() };
  return agent;
}
