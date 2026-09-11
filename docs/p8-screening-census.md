# P8(4) — what is NOT screened, with a mechanical denominator

**Status: this document is the CENSUS, not the close.** P8(4)(c) requires the positive
control — one route in the SCREENED column demonstrated by an audit-row id — and **that
column is empty**, so (c) has no referent. That is not an omission in this document; it
is the finding. Nothing screens content today, which is what P8 exists to change.

Every number below is a command and its output, run against engine `origin/main`
(§1.3's document-artifact clause). Re-run any line to check it.

## (a) The denominator — the full enumeration this document partitions

```
$ git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/api-keys/rest/index.ts \
    | grep -cE "api\.[a-z]+\('"
130                          ← mounts/middleware lines on the REST surface

$ for f in packages/server/src/features/api-keys/rest/routes/*.ts; do
    git show origin/main:$f | grep -cE "\.(get|post|put|patch|delete)\('"; done | paste -sd+ | bc
836                          ← total route handlers under rest/routes/
```

**A surface absent from this enumeration is not covered by this document.** Scope is the
REST route surface under `packages/server/src/features/api-keys/rest/`. Explicitly OUT of
scope and therefore unpartitioned here: the tRPC routers, the MCP tool surface, and
anything reached by federation or import pipelines.

## (b) The partition

### SCREENED — empty

```
$ git -C /home/bill/dev/recursiv grep -ln "moderationService" origin/main \
    -- packages/server/src/features/api-keys/rest/routes/
packages/server/src/features/api-keys/rest/routes/moderation.ts
packages/server/src/features/api-keys/rest/routes/reports.ts
```

Both are **after-the-fact** paths, not screening: `moderation.ts` applies an admin's
decision, `reports.ts` files a user's report. Neither runs before content is published,
and no other route in the 836 references the service at all.

`moderationService` is **123 lines** (`git show origin/main:packages/server/src/features/moderation/moderationService.ts | wc -l`) of apply/reverse — it has no classifier, no queue, and no pre-publish hook to call.

### UNSCREENED — every route that accepts user-generated content

41 write routes across six files. Each publishes or stores content with no automated
screening of any kind:

| file | write routes | what reaches users unscreened |
|---|---|---|
| `posts.ts` | 3 | `POST /` · `PATCH /:id` · `POST /:id/reactions` |
| `chat.ts` | 7 | `POST /messages` · `/messages/as-agent` · `/dm` · `/conversations/group` · `/messages/:id/react` · `/conversations/:id/read` · `PUT /messages/:id` |
| `uploads.ts` | 12 | every `*-url` / `*-confirm` pair — avatars, banners, **media**, chat images, org logos |
| `profiles.ts` | 4 | `PUT /me` (bio, display name) · follow · block · mute |
| `communities.ts` | 4 | `POST /` · `PUT /:id` (names and descriptions) · join · leave |
| `agents.ts` | 11 | agent creation and `POST /:id/chat`, `/chat/stream` — **agent-authored output is unscreened by the same gap** |

`uploads.ts` is the sharpest of these: the `-url` routes mint upload URLs and the
`-confirm` routes attach the object, so **binary media reaches storage without any
content check** — the surface where the cost of being wrong is highest.

## (c) The positive control — UNSATISFIABLE TODAY, and that is the point

P8(4)(c) asks for one SCREENED route demonstrated by P8(1)'s audit-row id. There is no
such route: the screened column above is empty, so there is nothing to point at. Recording
this rather than quietly dropping (c) — a census that silently omitted its own control
would read as complete when it is the opposite.

**This document closes P8(4) only once (1) lands and one route can be named here with its
audit-row id.** Until then it is the input P8 needs: you cannot build fail-closed
moderation without the list of surfaces that must fail closed, and this is that list.

## Correction (2026-08-08): tRPC is a SECOND unscreened surface, now counted

The partition above scoped itself to REST and named tRPC as out of scope. That
was honest but incomplete for P8's purpose: **P8 must fail closed on every path
that accepts content, and there are two.**

```
$ for f in $(git ls-tree -r origin/main --name-only packages/server/src/features/ \
      | grep '\.router\.ts$' | grep -iE 'posts|chat|message|profile|communit|inbox|media|upload'); do
    echo "$(basename $f .router.ts) $(git show origin/main:$f | grep -cE '^\s+[a-zA-Z]+: [a-zA-Z]*[Pp]rocedure')"; done

  posts        9      communities  9      moderation   9
  users       13      members      7      inbox        3
  TOTAL       50 procedures · 0 reference moderationService
```

**So the unscreened content surface is 41 REST routes AND ~50 tRPC procedures**,
not 41. Both paths are wide open, and a fix applied to one leaves the other.

Why the first pass missed it: the census grepped for `.post(`/`.put(` route
handlers, which is the REST idiom and matches nothing in a tRPC router. The
routers also use per-feature wrappers (`postsProtectedProcedure`, not
`protectedProcedure`), so even a procedure-name grep under-reports unless it
resolves the alias — `posts.router.ts:32` defines it as
`protectedProcedure.use(requireFeature('posts'))`.

**One thing this correction does NOT change:** authentication is fine on both.
Those wrappers derive from `protectedProcedure`, so they inherit the ban and
suspension guard (minds#362, minds#363). The gap here is screening, not auth.

**The MCP surface, now partitioned — and it needs no row of its own.** Named as
out of scope twice, so here it is measured rather than deferred a third time:

- MCP tools are **clients of the REST surface**, not an independent path.
  `create_post` calls `client.posts.create(...)` through the SDK
  (`packages/mcp/src/tools/social.ts`), so whatever screening REST gains,
  MCP inherits. Nothing here bypasses the routes counted above.
- MCP writes carry **more** gating than raw REST, not less: content-writing
  tools are RED-classified and routed through an approval gate that requires
  explicit admin approval before execution (`mcp/src/lib/approval-gate.ts`),
  and the call returns early when the gate refuses.

So the unscreened content surface is **two paths, not three**: the REST routes
and the tRPC procedures above. A worthwhile correction in the other direction —
the earlier caveat implied a third hole that does not exist.

*(Checked rather than assumed: the `classif` matches in the MCP tree are
RED-**classification** for approval, not content classification. A grep for
"classif" would have read as screening; it is not.)*

## What this document does NOT establish

- **That the 41 routes are the complete content surface.** They are the complete set
  *within the enumerated scope*. tRPC, MCP and federation ingest are unpartitioned above.
- **Anything about the app's client-side behaviour.** Screening is a server property; a
  client-side filter is not a control.
- **Any judgement about which surfaces matter most.** The ordering above is by file, not
  by risk. #196 (the upstream gate) and #197's scope decision own that call.
