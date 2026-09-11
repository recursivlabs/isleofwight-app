# Does account deletion delete? (§10.30, and Apple 5.1.1(v) / P12(6))

**ANSWER: it REQUESTS deletion and schedules it. Nothing in the codebase executes the schedule.**
Established 2026-08-01 against engine `origin/main`. §10.30 recorded this as *"never checked
server-side"*; this is that check.

## What the app calls

```
$ git show origin/main:app/settings.tsx | sed -n '460,478p'
  const deleteAccount = async () => {
    …
    await sdk.settings.requestDeletion({ password: deletePw, reason: 'User requested' });
```

## What the server does with it

The REST handler does **not** delete a user. It writes a row:

```
$ git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/api-keys/rest/routes/settings.ts \
    | sed -n '640,690p'
  const existing = await db.query.accountDeletionRequest.findFirst({ … })   # idempotency guard
  await db.insert(accountDeletionRequest).values({ … })
  return c.json({ data: { success: true, scheduled_at: scheduledDeletionAt.toISOString() } });
```

So the user's account still exists after a successful call. What exists is a **pending request with a
`scheduledDeletionAt`**, and the client's `'Account deletion requested.'` toast is accurate — the
controller flagged that wording as suspicious, and it turns out to be the honest part.

## The finding: nothing consumes the schedule

Every file in the engine that touches `accountDeletionRequest` or `scheduledDeletionAt`:

```
$ git -C /home/bill/dev/recursiv grep -ln "accountDeletionRequest" origin/main -- 'packages/server/src'
db/schema.ts                                   # the table definition
features/admin/admin.router.ts                 # findMany — LISTS pending requests for an admin
features/api-keys/rest/routes/admin.ts         # the same, over REST
features/api-keys/rest/routes/settings.ts      # CREATES the request
features/settings/accountSecurity.router.ts    # the same, over tRPC
…/__tests__/*                                  # tests
```

And repo-wide, outside `packages/server/src`, the only hits are `docs/DATABASE.md` and the drizzle
migration snapshots — **schema, not behaviour**:

```
$ git -C /home/bill/dev/recursiv grep -ln "accountDeletionRequest\|account_deletion_request" origin/main \
    | grep -vE "packages/server/src|__tests__"
docs/DATABASE.md  drizzle/0000_workable_paper_doll.sql  drizzle/meta/*.json
```

**There is no worker, no cron, and no scheduled job that reads pending requests and deletes the
account when `scheduledDeletionAt` passes.** The admin routers only *read* the queue. Deletion
therefore completes only if a human acts on that list.

## What this means for P12(6) and Apple 5.1.1(v)

**The initiation half is fine.** Apple 5.1.1(v) requires that a user can start account deletion
**from inside the app**, without being sent to a website or told to email support. They can.

**The completion half is not evidenced.** P12(6)'s exit is a paired transcript — the profile endpoint
returning `200` with the account's user id **before**, and `404`/`410` with a zero-row query
**after**, elapsed time pasted. **That pair cannot currently pass on its own**, because no automated
path moves the account from requested to deleted. Any run of P12(6) today would either sit at the
grace period forever or require an admin to intervene mid-transcript — and an artifact that needs a
human to step into the middle of it is not the artifact P12(6) describes.

**This is a finding about a gap, not a defect report.** A deliberate grace period with an
admin-reviewed queue is a legitimate design — it is how many services prevent rash or coerced
deletions. What is missing is the executor at the end of it, and **§10.30 asked precisely whether one
exists.** It does not.

## What this does NOT establish

- **Nothing was executed.** This is source analysis; no account was created, requested for deletion,
  or observed through the grace period. P12(6) still closes on a live paired transcript against a
  disposable account, and that remains undone.
- **The grace-period length was not read.** `scheduledDeletionAt` is computed in the handler; this
  document does not state the interval, because P12(6)'s transcript must paste the elapsed time
  anyway and a number quoted here would decay (§1.2 clause 3).
- **An out-of-repo executor is not excluded.** A platform-level scheduled task, a database job, or a
  manual runbook outside `recursivlabs/recursiv` would not appear in these greps. The claim is
  bounded to the repository: **no in-repo consumer exists.**
- **Whether admin-gated completion satisfies Apple** is a review judgement, not a code fact, and this
  document does not make it.
