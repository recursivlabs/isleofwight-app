# PR — Multi-tenant isolation verified for the Minds tenant (2/4, honest states per sub-artifact)

Verification-only row (§1.9a): this loop proves, the RLS loop builds. Run 2026-08-06.

## PR(2) — cross-tenant read DENIED, positively controlled: DONE

Stronger than the cell's zero-count form: the denied target's EXISTENCE is proven in the same
transcript — its content was read under the OTHER tenant's identity (Recursiv-org MCP session,
`list_posts`) seconds before the probe, so the 404 cannot be a broken query or a dead id.

```
$ curl -H "Authorization: Bearer $MINDS_KEY" "https://api.minds.com/api/v1/posts?limit=2"
count: 2, first author: tay_tweets_reborn            ← the key returns real Minds rows (control)

$ curl -w 'HTTP %{http_code}' -H "Authorization: Bearer $MINDS_KEY" \
    "https://api.minds.com/api/v1/posts/019fd4c6-a86a-74fc-b165-9c22d4233858"
HTTP 404 {"error":{"type":"not_found","code":"post_not_found"}}   ← a LIVE Recursiv-tenant post, denied
```

Why no `network_id` query-parameter form: the route derives the tenant from the KEY and exposes no
such parameter — every read is scoped server-side (`eq(post.networkId, user.networkId!)`), so the
cell's byte-identical-query-with-foreign-network_id form is INEXPRESSIBLE through this surface.
That is itself an isolation property, and the id-targeted probe above is the honest equivalent.

## PR(4) — app-code scoping is load-bearing and present on main: DONE

```
$ git -C ~/dev/recursiv grep -c "user.networkId" origin/main -- packages/server/src/features/api-keys/rest/routes/posts.ts
31
$ git -C ~/dev/recursiv grep -l "networkId" origin/main -- packages/server/src/features/api-keys/rest/routes/ | wc -l
72
```

## PR(1) — pg_policies over the tenant tables: CANNOT-VERIFY from this loop's surface

`run_sql_query` reaches the Minds PROJECT database (10 tables: community, conversation,
curation_*, post, user, …) — NOT the platform's multi-tenant database where RLS policies would
live. Measuring pg_policies there would be an accurate measurement of the wrong database — the
same trap P4(5)(b) refused, refused here too. Needs platform-db access (the RLS loop's side).

## PR(3) — the other loop's completion, re-fetched: NOT DONE (their state, honestly re-fetched)

```
$ get_task proj-goal-fully-complete-rls-security-rollout-and-migration-handoff-elkn1ri9  (Recursiv org)
Status: pending    (updated 2026-07-31)
```

Not a terminal state. Consistent with that controller's own "rollout frozen / zero tables enabled".
PR closes when Jack's loop finishes and (1) can be run against the platform db.
