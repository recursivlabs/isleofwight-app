# Does a real consent ledger with a single enforcement path exist? (§10.6 — P10's first question)

**ANSWER: YES, on both halves.** A suppression table exists, and every path that actually sends mail
goes through one gate that consults it before dispatch. Established 2026-08-01 against engine
`origin/main` = `89612a9d`. §10.6 said this was *"the first thing P10 establishes"*; this is that.

**Why it needed establishing rather than assuming:** §10.6 carried four file counts and §5.35
already retracted an earlier version of them for being printed with no command. **File counts are
not evidence of a ledger** — a matching filename proves a word appears, nothing more, which is why
P10(1) closes on rows and ids rather than on greps. This file goes past the counts to the schema and
the call graph.

## The counts re-run first, per §1.2 — and they reproduce at a NEW SHA

```
$ for p in consent suppression unsubscribe marketing_email; do printf '%s: ' "$p"
    git -C /home/bill/dev/recursiv grep -l "$p" origin/main -- 'packages/server/**' | wc -l; done
consent: 6      suppression: 9      unsubscribe: 17      marketing_email: 0
```

Identical to the values §10.6 recorded at `24e4ca0f`, now reproduced at `89612a9d`. **A count that
survives a SHA change is worth more than one that was merely re-typed**, and this is the first time
these four have been re-run rather than quoted.

## Half one — the ledger is real, and it is a table

```
$ git -C /home/bill/dev/recursiv grep -n "emailSuppression" origin/main -- 'packages/server/src/db/schema.ts'
3809: export const emailSuppression = pgTable('email_suppression', {
3818:   uniqueIndex('email_suppression_email_unique').on(table.networkId, table.email),
3819:   index('email_suppression_reason_idx').on(table.reason),
```

A real table with a **uniqueness constraint on `(networkId, email)`** — so suppression is
tenant-scoped and cannot be duplicated — and an index on `reason`, so *why* an address was
suppressed is queryable rather than inferred. That is the shape P10(1) needs: its exit closes on a
`run_sql_query` row **with its id**, and rows with ids are exactly what this provides.

## Half two — the enforcement path is single, and the gate precedes dispatch

`EmailService.send()` is the gate, and it checks **first**:

```
$ git -C /home/bill/dev/recursiv show origin/main:packages/server/src/features/email/EmailService.ts | sed -n '99,105p'
  async send(params: SendEmailParams): Promise<SendResult> {
    // Check suppression list
    const suppressed = await this.isSuppressed(params.to, params.networkId);
    if (suppressed) {
      return { messageId: '', success: false, error: 'Email is suppressed' };
    }
```

**It returns before any provider is called.** That is the difference between a suppression list and a
suppression *control*: the block happens at the platform layer, which is precisely what P10(1)
demands ("blocked at the platform layer, not at the ESP").

Every sending caller routes through it — including the three inside `InboundEmailService`, which
were the most likely bypass candidates because they are private methods with their own `send…`
names:

```
$ git -C /home/bill/dev/recursiv grep -c "emailService.send" origin/main -- 'packages/server/src'
auth/index.ts:2 · api-keys/rest/routes/organizations.ts:1 · billing/BillingService.ts:3
brain/agentCapabilityTools.ts:1 · email/CampaignService.ts:1 · email/ConciergeService.ts:1
email/InboundEmailService.ts:3 · notifications/DailyBriefService.ts:1
$ git -C /home/bill/dev/recursiv show origin/main:…/InboundEmailService.ts | grep -c "suppress"
0                      # ← it never mentions suppression, and does not need to: it delegates
```

## The bypass I looked for and did NOT find — recorded because the wrong version of this was one command away

Five modules import the provider adapters directly, which reads like five ways around the gate:

```
ConciergeService · EmailProvisioningService · NetworkLeadService · email.router.ts · email.routes.ts
```

**An import is not a send.** Checked each for an actual dispatch:

```
ConciergeService        → await emailService.send({ …      # through the gate
NetworkLeadService      → (no .send( at all)
EmailProvisioningService→ (no .send( at all)
email.router.ts         → (no provider.send / emailService.send)
email.routes.ts         → (no provider.send / emailService.send)
```

They import for types and provider configuration, not to dispatch. **Reporting "five modules bypass
the suppression gate" would have been the fourth false finding of the §5.51 class this week** — an
accurate measurement of the wrong thing. The rule that caught it is the same one every time: read
the definition of the surface before reporting it broken.

## What this does NOT establish

- **Nothing here was executed against a database.** This is source and call-graph analysis. P10(1)
  still closes on a live `run_sql_query` suppression row, a real send attempt against that address,
  and the rejection recorded as a second row — none of which is possible before staging.
- **`isSuppressed()`'s own correctness is not proved.** The gate is *positioned* correctly; whether
  its query matches the right rows (network scoping, case sensitivity, plus-addressing) is untested
  and is a real place for a false negative to hide.
- **No ESP is configured anywhere**, so the negative control P10(1)(d) requires — proving the ESP was
  never called — has no live pipe to prove itself against yet. §11 still lists an ESP as an unpriced
  future cost.
- **This says nothing about P10(4)**, the legacy-cohort GDPR basis. That is a §10 decision owned by
  Bill with a decide-by of **2026-08-25** and is not agent-workable.
