# P4(5) — Staging data provenance

**Row:** P4, sub-artifact (5). **Written:** 2026-08-09. **Author loop:** `bill`.
**State:** `done` as of `recursiv@1ae5ffc02a99` (2026-08-09T08:11:29Z) — see
[Resolution](#resolution) at the end. The body below is the comparison **as first
measured**, when it FAILED with 65 uncovered columns. It is kept in the failing tense
deliberately: the gap is the reason the check now exists, and a document rewritten to
describe only the fixed state would leave the next reader unable to see what the
sanitizer had been missing or why the predicate asserts what it does.

P4(5) closes on a COMPARISON with both sides printed, never on a bare zero. Below is
(a), (b) and (c) in that order, plus a finding about the workflow that changes what
the result means.

---

## (a) The sanitizer's assigned-column list — NON-EMPTY

Guard first, per §1.2 clause 5:

```
$ git -C /home/bill/dev/recursiv cat-file -e origin/main:scripts/sanitize-staging-data.sql && echo PATH-OK
PATH-OK
```

```
$ git -C /home/bill/dev/recursiv show origin/main:scripts/sanitize-staging-data.sql \
    | grep -oE '^ +[a-z_]+ ='
  email =
  name =
  key_hash =
  prefix =
  access_token =
  refresh_token =
  id_token =
  github_token =
  github_token =
  composio_connected_account_id =
  claim_token =
```

**11 lines, 10 distinct names** — matching the count the controller recorded on
2026-07-29, so the script has not been renamed or gutted since.

Column names alone are not coverage. A `email` cleaned on `user` says nothing about
`email` on another table, so the real (table, column) coverage is:

| table | treatment | columns |
|---|---|---|
| `user` | UPDATE | `email`, `name` |
| `api_key` | UPDATE | `key_hash`, `prefix`, `claim_token` |
| `account` | UPDATE | `access_token`, `refresh_token`, `id_token` |
| `organization_settings` | UPDATE | `github_token` |
| `user_settings` | UPDATE | `github_token` |
| `user_integration` | UPDATE | `composio_connected_account_id` |
| `two_factor` | DELETE | (whole table) |
| `session` | DELETE | (whole table) |
| `verification` | DELETE | (whole table) |
| `pending_integration` | DELETE | (whole table) |

**10 tables touched.**

---

## (b) The current schema's PII columns — SOURCE SUBSTITUTED, and why

P4(5)(b) prescribes "a `run_sql_query` over `information_schema.columns`". **That
command cannot satisfy this cell, and running it as written would manufacture a false
pass.**

`run_sql_query` requires a `project_id` and executes against **that project's own
provisioned database** — not the platform control-plane database where `user`,
`api_key`, `session` and `organization_settings` live. Proof:

```
run_sql_query(project_id: 019fd356-c394-736f-9a7f-b2975e73ffae /* Radar */,
  sql: "SELECT table_schema, table_name FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog','information_schema')")
→ rowCount: 8
  public.ingest_run, public.next_step, public.opportunity, public.person,
  public.proposal, public.quote, public.target, public.touch
```

Radar's eight application tables. No `user`, no `api_key`, no `account`. Every project
returns its own schema, so **no `project_id` reaches the tables the sanitizer targets.**

This matters more than a broken command. P4(5)(b) asks for PII columns and a stated
non-zero row count; a query for `user`/`api_key` columns against any project database
returns **zero rows**, and zero rows on side (b) with a non-empty side (a) reads as
"nothing uncovered". That is the precise failure the cell's own paired-result rule
exists to prevent — and the prescribed command walks into it. This is the same class as
the `/orgs/` → `/organizations/` correction already recorded against P4(2) at §5.54:
an exit command that cannot return its own DONE value.

**Substituted source:** `origin/main:packages/server/src/db/schema.ts` in
`recursivlabs/recursiv` — the authority the sanitizer's own header names:

> `-- Table/column names match Drizzle pgTable definitions in`
> `-- packages/server/src/db/schema.ts (snake_case DB column names).`

```
$ git -C /home/bill/dev/recursiv cat-file -e origin/main:packages/server/src/db/schema.ts && echo PATH-OK
PATH-OK
$ git -C /home/bill/dev/recursiv show origin/main:packages/server/src/db/schema.ts | wc -l
4745
```

Parsed mechanically (brace-matched `pgTable('<name>', { … })`, then
`<field>: <type>('<db_column>')` within each body):

**144 tables, 1811 columns — both non-zero.**

This source is strictly better on §1.3's own terms: a second party re-fetches it with
`git show` at a named ref and gets byte-identical input, whereas a live query is
reproducible only by whoever holds the credential.

**Known limit of (b), stated rather than hidden:** this is the schema as committed, not
as deployed. If production has drifted from `schema.ts`, drifted columns are invisible
here. Detecting that needs control-plane database access, which no tool in this session
has.

---

## (c) Columns present in (b) and absent from (a) — listed by name

A name-pattern sweep returned 128 candidates, but that number is not trustworthy in
either direction: it swept in false positives (`ai_usage.input_tokens` is an LLM
counter, `sandbox_pool.claimed_at` is a timestamp, `project_env_var.is_secret` is a
boolean flag) and it missed real ones (`project_env_var.encrypted_value` and the
`encryption_user_device` key material match no obvious pattern). The list below is
hand-classified, and every column named was verified to exist in `schema.ts` — the
classifier fails loudly on any name it cannot find, and reported none.

### Tier 1 — live credentials and key material (36 columns)

| table | uncovered columns |
|---|---|
| `organization_settings` | `gitlab_token`, `linear_api_key`, `jira_api_token`, `slack_bot_token`, `asana_token`, `sync_webhook_secret`, `resend_api_key`, `stripe_secret_key`, `stripe_webhook_secret`, `oauth_google_client_secret`, `oauth_github_client_secret`, `posthog_api_key`, `custom_api_keys`, `coolify_api_token` |
| `oauth_access_token` | `access_token`, `refresh_token` |
| `encryption_user_device` | `encrypted_private_bundle`, `prf_salt`, `identity_public_key`, `device_public_key`, `signing_public_key`, `credential_id` |
| `oauth_application` | `client_secret` |
| `account` | `password` |
| `inbound_webhook` | `secret` |
| `webhook_subscription` | `secret` |
| `slack_installation` | `bot_token` |
| `scim_token` | `token_hash`, `token_prefix` |
| `ai_provider_config` | `api_key_encrypted` |
| `project_env_var` | `encrypted_value` |
| `push_notification_token` | `token` |
| `email_unsubscribe_token` | `token` |
| `pending_email_change` | `verification_token_hash` |
| `slack_oauth_state` | `state_hash` |
| `passkey` | `credential_id` |

### Tier 2 — personal data (29 columns)

| table | uncovered columns |
|---|---|
| `user` | `legacy_email`, `wallet_address`, `ban_reason` |
| `organization_settings` | `jira_email`, `preferred_contact_email`, `branded_email_address` |
| `login_history` | `ip_address`, `user_agent` |
| `share` | `ip_address`, `user_agent` |
| `network_lead` | `email`, `source_email_subject` |
| `person_profile` | `phone`, `geo` |
| `email_send` | `recipient_email` |
| `email_suppression` | `email` |
| `email_campaign` | `from_email` |
| `email_unsubscribe_token` | `email` |
| `invite_waitlist` | `email` |
| `invite_code` | `invited_email` |
| `business_transaction` | `customer_email` |
| `pending_email_change` | `new_email` |
| `user_settings` | `preferred_contact_email` |
| `project_identity` | `sender_address` |
| `bounty_escrow` | `funder_wallet_address`, `recipient_wallet` |
| `bounty_wallet` | `wallet_address` |
| `treasury_transaction` | `payer_wallet_address`, `recipient_wallet_address` |

**Total uncovered: 65.** Not zero. **P4(5) does not pass.**

Three of these deserve naming individually, because they are misses inside work the
sanitizer already does:

1. **`user.legacy_email`** — the sanitizer hashes `user.email` in an `UPDATE "user"`
   statement and leaves `legacy_email` beside it. Real addresses survive in the one
   table the script most obviously set out to clean.
2. **`organization_settings`** — the script clears `github_token` from this table and
   stops. Fourteen further credential columns in the *same row* are untouched,
   including `stripe_secret_key` and `coolify_api_token`.
3. **`oauth_access_token`** — `account.access_token` / `refresh_token` are cleaned;
   this second table holding the same class of token is not. The concept is understood
   and applied to one of the two places it occurs.

---

## The finding that changes what this means

**The refresh has never actually run.** `staging-db-refresh.yml` reports success every
night, and every substantive step inside it is skipped:

```
$ gh run view 31294347178 --repo recursivlabs/recursiv --json jobs \
    -q '.jobs[].steps[] | "\(.conclusion)\t\(.name)"'
success   Set up job
success   Run actions/checkout@v4
success   Preflight — required secrets present?
skipped   Install PostgreSQL client
skipped   Authenticate to GCS
skipped   Download latest prod backup
skipped   Restore to staging DB
skipped   Sanitize PII
skipped   Apply latest schema
skipped   Verify
success   Post Run actions/checkout@v4
success   Complete job
```

The five most recent scheduled runs took **9–17 seconds** each — a real
restore-plus-sanitize cannot complete in that time. The workflow's preflight is
deliberate and documented in its own comment: it skips when `GCP_SA_KEY`,
`GCS_BACKUP_BUCKET` and `STAGING_DB_URL` are unset so the job "stays green" rather than
failing daily.

Two consequences, and they point in opposite directions:

- **The exposure is latent, not active.** No production data is sitting in staging
  today, because nothing has been copied. Nothing needs emergency rotation on account
  of this document.
- **It is armed to fire on the exact action P4 exists to perform.** The day someone
  sets those three secrets to wire up staging — P4's own goal — the nightly copy
  begins, and 65 uncovered columns of live credentials and personal data land in a
  lower-trust environment on the first run. The gap and its trigger are the same task.

`Sanitize PII` reporting `skipped` under a green check is also the third instance this
cycle of the class logged at CYCLE bill/106–107: a step that reports success while
doing nothing. Here the green check is what would let P4 be closed by someone who read
the status and not the steps.

---

## What P4(5) needs before it can pass

1. Extend `scripts/sanitize-staging-data.sql` to cover the 65 columns in (c), or record
   a per-column decision for any deliberately retained.
2. Make the sanitizer's coverage checkable, so this document does not have to be
   rewritten by hand each time the schema moves — the parse in (b) is mechanical and
   belongs in CI against `schema.ts`.
3. Replace P4(5)(b)'s prescribed command in `docs/goal-prompt.md`. As written it names
   a tool that cannot reach the tables in question and whose failure mode is a silent
   false pass.
4. Re-run this comparison and get zero, with both sides printed non-empty.

Filed against the engine: recursivlabs/recursiv (sanitizer gaps + the green-while-skipped
workflow). This document is the minds-side artifact for P4(5).

---

## Resolution

`recursivlabs/recursiv#2319` landed as `1ae5ffc02a99` on 2026-08-09T08:11:29Z and clears
all 65. Re-running the comparison against that ref, **both sides non-empty**:

```
$ git -C /home/bill/dev/recursiv show origin/main:packages/server/src/db/schema.ts > /tmp/schema.ts
$ git -C /home/bill/dev/recursiv show origin/main:scripts/sanitize-staging-data.sql > /tmp/sanitize.sql
$ node scripts/p4-sanitizer-coverage.js /tmp/schema.ts /tmp/sanitize.sql
schema:    144 tables, 1811 columns
sanitizer: 12 tables DELETEd, 26 tables UPDATEd

TIER 1 — live credentials and key material: 0 uncovered
TIER 2 — personal data: 0 uncovered

TOTAL UNCOVERED: 0
STALE TOTAL: 0
P4(5): PASS
```

`(a)` 12 + 26 tables cleared, up from 10. `(b)` 144 tables / 1811 columns. `(c)` **zero**
— and it is a paired zero, not a bare one: both sides are printed and both are non-zero.

The engine carries its own checker (`scripts/check-sanitizer-coverage.js`, `pnpm
sanitizer:check`) which parses the same two files independently and agrees. It shares
lineage with this one, so the agreement is a consistency check, not two independent
witnesses.

### What re-executes this, and the vacuous zero it had to be taught to reject

`confirm-artifacts.sh` gained a **P4.5** predicate, so the second party re-derives the
result in CI from the engine's `origin/main` rather than reading this document.

Its assertion is a **triple** — positive schema table count, zero uncovered, **zero
stale** — because writing it exposed a hole in the reproducer itself. A named column
that no longer exists in the schema contributes **zero to the uncovered count**. So a
wholesale rename would have reported `TOTAL UNCOVERED: 0` and passed while comparing
nothing at all: a green assembled out of an empty list. That is the same vacuous zero
this cell's paired-result rule was written to reject, reappearing one level up in the
checker meant to enforce it. Both now gate on stale.

Three cases in `confirm-selftest.sh` hold the predicate to it (30 total, all passing):

| case | asserts |
|---|---|
| positive control | a fully covered synthetic schema **confirms** |
| vacuous zero | a schema where every named column was renamed **does not confirm**, despite 0 uncovered |
| uncovered column | one uncleared `legacy_email` **does not confirm** |

The positive control is what makes the other two mean anything — without it, both would
pass simply because P4.5 never confirms against a synthetic engine. It failed twice
while being written, for exactly that reason, before the fixture was generated from the
reproducer's own lists.

These are the first fidelity cases in this file to mangle the **artifact** rather than
the environment. That was previously recorded as impossible here — live git, `gh` and
HTTP state have no copy to corrupt. P4.5 is the exception, and structurally so: its
evidence is a git repository reached through `$ENGINE`, and a git repository can be
synthesised.

### Still open from this document

The finding that P4(5)(b)'s prescribed command cannot reach the platform database is
**unaddressed in the controller**. `docs/goal-prompt.md` still instructs a `run_sql_query`
whose failure mode is this cell's own false pass. Editing a P4 exit is a §1.7 controller
change and is not the worker's to make; it is raised here and on the PR.

The green-while-skipped `staging-db-refresh.yml` is also unfixed — tracked in
recursivlabs/recursiv#2318, and deliberately left out of #2319.
