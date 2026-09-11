# Minds API — error and rate-limit contract (PAPI sub-artifact 4)

**Every line below is the pasted output of the command beside it, run 2026-07-31 against
`https://api.minds.com`. Re-run them rather than trusting this file** — §1.2. This is what a
consumer codes against.

```
deployed commit : curl -s https://api.minds.com/health → .commit
```

## Rate limits — three windows, advertised in the response headers

An **authenticated** request carries a policy header naming all three windows:

```
$ curl -sI -H "Authorization: Bearer $KEY" https://api.minds.com/api/v1/users/me | grep -i ratelimit
x-ratelimit-limit: 60
x-ratelimit-policy: 60;w=60, 1000;w=3600, 10000;w=86400
x-ratelimit-remaining: 58
x-ratelimit-reset: 1785463680
```

So: **60/minute, 1 000/hour, 10 000/day** per key. `x-ratelimit-reset` is a Unix epoch second.

**Unauthenticated requests are metered separately and more loosely** — the same header block on a
credential-free call reads `x-ratelimit-limit: 300`. Do not infer one from the other.

**A consumer should read `x-ratelimit-remaining` and back off before exhausting it**, rather than
discovering the limit by hitting it. The headers are present on **every** response including
errors, which is what makes pre-emptive backoff possible.

## Error bodies — one shape, with one documented exception

Authenticated and unauthenticated errors alike return:

```json
{ "error": { "type": "...", "message": "...", "code": "...", "details": { } } }
```

`type` is the class, `code` is the machine-readable discriminator, `message` is for humans, and
`details` appears on validation failures. Observed today:

| Status | Command | Body |
|---|---|---|
| `401` | `curl -X GET https://api.minds.com/api/v1/users/me` | `{"error":{"type":"authentication_error","message":"Missing or invalid Authorization header","code":"missing_api_key"}}` |
| `400` | `curl -X POST -H "Authorization: Bearer $KEY" -d '{}' .../posts` | `{"error":{"type":"validation_error","message":"Invalid request body","code":"invalid_input","details":{"fieldErrors":{"content":["Post must have content, media, or reposted_from_id"]}}}}` |
| `404` | `curl -H "Authorization: Bearer $KEY" .../posts/00000000-0000-7000-8000-000000000000` | `{"error":{"type":"not_found","message":"Post not found","code":"post_not_found"}}` |

**Code against `error.code`, not against `message`.** The messages are prose and will change.

### The exception, and it will break a naive parser

**An unrouted path returns a bare string, not the object:**

```
$ curl -s https://api.minds.com/api/v1/nonexistent-route
{"error":"Not Found"}
```

`error` is a **string** here and an **object** everywhere else. A consumer doing
`err.error.code` throws on this one. Until it is fixed, parse defensively:

```js
const code = typeof body.error === 'string' ? 'not_found' : body.error?.code;
```

This is a real inconsistency in the public contract, not a documentation quirk — filed upstream
alongside the other two API-surface defects this sweep found (`recursivlabs/recursiv#2038`,
`#2039`).

## What this document does NOT establish

- Error shapes were sampled on `/users/me`, `/posts` and an unrouted path. Other route groups may
  carry other `type` values; the shape is what is claimed, not the enumeration of codes.
- **The `429` below was produced on STAGING, not production.** The two hosts advertise the same
  unauthenticated `x-ratelimit-limit: 300`, but staging's limiter is not proven byte-identical to
  production's. Re-running this burst against production remains undone deliberately — it is a
  self-inflicted load test on a live service.
- **The authenticated 429 is still unobserved.** The burst below was credential-free, so it
  exercised the 300/min unauthenticated bucket, not the 60/min per-key one. A consumer's own
  backoff will most often be triggered by the authenticated limit, whose body is assumed — not
  shown — to match.

_Regenerate the observations: the commands are inline. `scripts/gen-api-endpoints.sh` produces the
companion status sweep across all 403 endpoints._

---

## The `429`, demonstrated — and it breaks the object shape a second time

**Produced 2026-08-01 13:35:15Z against `https://api.staging.recursiv.io` `[staging]`**, by 420
credential-free `GET /api/v1/health` requests issued 25-at-a-time so the burst landed inside one
60-second window. Sequential issuance does **not** reproduce it: an earlier run of 400 requests
spanned 90 seconds, crossed the window boundary and never exceeded 300-in-60s — the parallelism is
part of the repro, not an optimisation.

```
$ seq 1 420 | xargs -P 25 -I{} curl -s -o /dev/null -w '%{http_code}\n' \
    https://api.staging.recursiv.io/api/v1/health | sort | uniq -c
    132 200
    288 429
```

The full response, captured from inside the burst (a later single request reads `200` again — the
window resets in under a minute, so a capture taken after the fact records nothing):

```
HTTP/2 429
content-type: application/json
retry-after: 46
x-ratelimit-limit: 300
x-ratelimit-remaining: 0
x-ratelimit-reset: 1785591362
x-request-id: 8c07c7cf-946b-494d-9055-2814f8038a5a

{"error":"Too many requests"}
```

**`Retry-After` IS present** — `46`, in seconds, agreeing with `x-ratelimit-reset` (epoch
`1785591362`) to the second. A consumer should prefer `Retry-After`: it is a duration and needs no
clock agreement, while `x-ratelimit-reset` is an absolute epoch and a client with a skewed clock
will compute the wrong delay from it.

### The consequential finding: `error` is a STRING here, not an object

The exception documented above for unrouted paths is **not a single edge case**. The `429` body is
`{"error":"Too many requests"}` — `error` as a bare string, exactly like `{"error":"Not Found"}`,
and nothing like the `{"error":{"type","message","code"}}` object every other error returns.

**This one matters more than the unrouted-path case**, and the difference is worth stating plainly:
a request to a route that does not exist is a bug in the consumer's code, found once in
development. **A `429` is the normal, expected response of a healthy client under load** — it is
precisely the path where retry and backoff logic runs. So the shape inconsistency lands on the code
path that must not fail, in software written by someone who read the contract above and coded
against `error.code`:

```js
// Reads the documented shape. Returns undefined on 429, so the backoff branch never runs.
if (body.error?.code === 'rate_limited') backoff(res.headers.get('retry-after'))
```

There is no `code` to match — `body.error.code` is `undefined` on a string — so a consumer that
follows this document's own "code against `error.code`, not against `message`" advice silently
fails to back off, and hammers the endpoint until the limiter's window rolls. **Until the shape is
unified, branch on the HTTP status for `429`, not on the body**, and treat `typeof body.error` as
untrusted everywhere:

```js
const code = typeof body.error === 'string' ? null : body.error?.code;
const rateLimited = res.status === 429;   // the reliable discriminator
```

Filed upstream with the other API-surface findings from this sweep. **The fix is server-side —
emit `{"error":{"type":"rate_limit_error","code":"rate_limited","message":"Too many requests"}}`
— and it is backward-compatible for anyone already branching on status.**
