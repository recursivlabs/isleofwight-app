# Legacy subscription wind-down gate

**Status:** inventory and preparation only — no cancellation is authorized  
**Last audited:** 2026-08-24  
**Dispatcher row:** `call-legacy-winddown`

This runbook turns "cancel Sentry etc." into a checkable migration. A subscription or legacy service
may be retired only after its replacement is proven live, its retained data is accounted for, and a
named account owner approves the destructive action. A package disappearing from code, a missing
secret, or a successful copy job is not proof that the old service has no remaining readers.

## Current decision

Cancel **nothing yet**. Three independently load-bearing legacy paths remain:

1. Minds native Sentry exists in code but P6's live crash proof is only 2/4 complete.
2. Jack's legacy media/video copy jobs are still running, and their PR is open with merge conflicts
   (audited head `85fd4b9`).
3. Protected legacy audio still delegates authorization to the legacy origin; OCI scale-down is
   explicitly forbidden until Recursiv owns entitlement and authenticated delivery.

The current Minds Infisical project contains no Sentry or PostHog key name in `dev`, `staging`,
`prod`, or `production`. The Minds GitHub repository likewise has no Sentry/PostHog secret or
variable name. That proves configuration is not in those two stores; it does **not** prove that no
EAS environment, deploy runtime, or legacy account is active. EAS CLI/account access was unavailable
for this audit, so the account and billing inventory remains a named human input.

## Gate matrix

| Candidate | Evidence it is still load-bearing | Required proof before retirement | Current owner/blocker |
|---|---|---|---|
| Legacy Minds Sentry project/subscription | `@sentry/react-native` is installed and configured in `app.json`; `lib/nativeMonitoring.native.ts` enables it when `EXPO_PUBLIC_SENTRY_DSN` exists. [Issue #187](https://github.com/recursivlabs/minds/issues/187) records P6 as 2/4. | P6.3 real Android-hardware event id independently re-fetched; P6.4 negative control; identify the Sentry org/project, billing owner, retention/export needs, DSN source, and renewal date. Keep or migrate the project before cancellation. | Bill/account owner; `minds-ladder-p6` blocked pending live device/vendor proof. |
| OCI / legacy `cdn.minds.com` origin | [`recursiv/docs/MINDS.md`](https://github.com/recursivlabs/recursiv/blob/main/docs/MINDS.md) records legacy media dependencies. Jack's [Recursiv PR #2167](https://github.com/recursivlabs/recursiv/pull/2167) reports live jobs covering 16,356,616 media refs (~3.6 TB) and 191,256 entitled videos (~11.85 TB). | Copy jobs finished and reconciled; PR merged; sampled public playback proven from the new source; old-origin request rate bounded to zero for the retiring paths; rollback source retained for an agreed window. | Jack owns the running migration lane. PR #2167 is open and conflicted at audited head `85fd4b9`; do not modify or stop its jobs from this task. |
| Protected legacy audio origin | [`PROTECTED-MEDIA-DELIVERY.md`](https://github.com/recursivlabs/recursiv/blob/main/scripts/legacy-import/cdn-worker/PROTECTED-MEDIA-DELIVERY.md) says the Worker forwards the full protected-audio namespace to the legacy origin and fails closed if it is unavailable. | Durable project/network-scoped entitlement records; authenticated short-lived delivery; entitled and anonymous controls; 7,707 preservation objects quarantined to a private bucket; cache bypass/purge evidence. | Platform capability missing. OCI scale-down is explicitly blocked by the committed delivery policy. |
| Legacy Cloudflare Stream video | PR #2167 says entitled video is being copied from Stream and the remaining cohort is archived by policy. | Entitled-copy reconciliation, playback through the new path, archived-video disposition, and zero production reads from the retiring Stream resources. | Jack's migration lane and follow-ups PVARCH/PVRET. Cloudflare DNS/R2/edge services are target infrastructure and must not be cancelled with Stream. |
| Shared-DB rollback copy / legacy API | [`recursiv/docs/MINDS.md`](https://github.com/recursivlabs/recursiv/blob/main/docs/MINDS.md) says the shared Recursiv copy remains a rollback anchor, the full user cohort is not imported, and legacy extraction is read-only. `call-upgrade-flow` is blocked. | Signed cutover plan; full cohort and upgrade-flow reconciliation; rollback-retention decision; backup/restore proof; explicit data-deletion approval. | Missing committed cutover plan plus blocked upgrade-flow task. Database deletion is a separate hard-risk action. |
| Moniker / domain registrations | The separate `call-dns-cleanup` row has no inventory or completion evidence. Registrar transfer and DNS mutation have a different blast radius from vendor cancellation. | Zone export, record parity, TTL plan, renewal/lock/registrant inventory, monitored cutover, rollback, and named owner approval. | Separate task. Do not change DNS or transfer a domain from this runbook. |

## Current services that are not wind-down candidates

- **Cloudflare DNS/R2/edge:** target hosting and protected-media migration infrastructure.
- **Coolify:** current Recursiv deployment control plane; Minds deploys through the sanctioned platform
  path, never by deleting or editing Coolify directly.
- **Neon/Postgres:** canonical Minds data store plus an intentionally retained rollback copy.
- **Resend/email delivery:** `RESEND_API_KEY` exists as a Recursiv GitHub secret name and email/OTP is
  a live product path. It belongs to the consent-first outbound audit, not legacy cancellation.
- **PostHog:** web/client and platform monitoring code still references it. Missing configuration
  evidence means "unproven," not "unused."
- **npm/GitHub Actions:** active package-publishing infrastructure in Jack's reserved PKG lane.

## Required account inventory

The human account owner supplies an export containing only metadata, never credentials:

| Field | Required value |
|---|---|
| Provider and account/org id | Exact account being billed |
| Product/project/resource ids | What would be deleted or downgraded |
| Billing owner and renewal date | Who can approve and when cost changes |
| Current monthly/annual cost | Baseline for verified savings |
| Active credentials by **name and store only** | Infisical, EAS, deploy runtime, GitHub, or legacy vault |
| Last 30 days usage | Requests, events, bytes, users, jobs, or messages |
| Data retention/export requirement | What must survive cancellation |
| Replacement artifact | Re-fetchable event/request/playback/restore evidence |
| Rollback path and window | How service is restored if the replacement fails |

## Retirement procedure

For each candidate, use a separate change record. Do not batch unrelated providers.

1. Record the account inventory above and the exact cancellation/downgrade target.
2. Prove the replacement with a positive control and an old-path usage measurement over the same
   bounded window.
3. Export required configuration/data and verify the export can be read or restored.
4. Prefer a reversible canary disable or plan downgrade before account deletion.
5. Obtain named owner approval for the exact target and scheduled time.
6. Execute through the provider's supported account surface; never delete credentials first.
7. Re-run product smoke tests and observe error, traffic, and billing signals for the agreed window.
8. Revoke obsolete credentials only after the observation window, then record the verified savings.

## Re-runnable evidence commands

These commands reveal names and references, not secret values:

```bash
git grep -nE 'SENTRY|POSTHOG|RESEND|CLOUDFLARE|OCI' origin/main -- \
  package.json app.json eas.json lib .github docs

gh secret list --repo recursivlabs/minds
gh variable list --repo recursivlabs/minds
gh secret list --repo recursivlabs/recursiv
gh variable list --repo recursivlabs/recursiv

gh issue view 187 --repo recursivlabs/minds --comments
gh issue view 374 --repo recursivlabs/minds --comments
gh pr view 2167 --repo recursivlabs/recursiv --json state,mergeStateStatus,headRefOid,statusCheckRollup
```

When listing Infisical, pipe JSON directly to a key-only selector. Never paste raw output into a PR,
issue, terminal transcript, or evidence file.

## Exit from this dispatcher row

This row can close only when every subscription intended for retirement has its own completed change
record with replacement proof, owner approval, post-change smoke evidence, and verified savings. Until
then it releases `needs_human` with `minds-ladder-p6` and `call-upgrade-flow` as recorded dependencies;
the media and protected-audio conditions above remain external blockers even if those two rows close.
