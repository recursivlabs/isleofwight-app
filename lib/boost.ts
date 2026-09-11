// Boost impression/click reporting. The For You recommender marks served
// boosted entries with `boosted: true` + `boost_campaign_id`; the client posts
// the resulting events to POST /boosts/:id/events, which bills the campaign
// (server dedupes per viewer per UTC day, so re-reports are harmless no-ops).
// One report per campaign per app session keeps the client side quiet too.
const reported = new Set<string>();

/** Report one impression for a served boosted post. Fire-and-forget. */
export function reportBoostImpression(sdk: any, campaignId?: string | null): void {
  if (!sdk || !campaignId || reported.has(campaignId)) return;
  reported.add(campaignId);
  try {
    const http = sdk?.posts?.client;
    if (!http?.post) return;
    http.post(`/boosts/${campaignId}/events`, { kind: 'impression' }).catch(() => {
      // Never surface delivery accounting to the viewer; server dedupe makes
      // a retried report safe, so allow a later retry after transient failure.
      reported.delete(campaignId);
    });
  } catch {}
}
