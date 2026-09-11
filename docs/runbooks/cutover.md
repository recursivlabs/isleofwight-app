# Cutover runbook: legacy minds.com to Minds 2.0

Status: draft for review by Jack and Bill. Nothing in this document authorizes the flip. The flip
happens when every gate in section 2 names a green artifact and the two owners sign the sitting.

The goal of the flip is retention. Every paying and daily member must come through it without
noticing a loss. Section 2 is the list of things they would notice. Section 6 is what we do if
they do.

## 1. Roles and channels

| Role | Person | Duty |
|------|--------|------|
| Operator | Jack | Runs each step, owns Cloudflare, App Store Connect, Stripe, Neon. |
| Observer | Bill | Reads every artifact a second time before the next step starts. Signs the sitting. |
| Engine driver | one named agent session | Runs the scripts the operator authorizes. Never touches legacy with a write. |
| Status channel | a public status page plus one pinned post on Minds | Every step change is posted before the step, not after. |

Single-writer rule: one person changes DNS, one person changes Coolify, one person runs a loader at
a time. A hand-off names the step number and the artifact of the last completed step.

## 2. Pre-flight gates

Each gate names the artifact the observer re-fetches. A gate without its artifact is red.

| # | Gate | Artifact | State on 2026-09-08 |
|---|------|----------|---------------------|
| G1 | App in the stores as v6.0 of the existing listing | ASC build in review on record 961771928; Play internal-track release id | Red. Bundle id change unbuilt. |
| G2 | Returning member signs in by email | Staging OTP sign-in recording as a placeholder-email user; `auth_otp_sends_last_hour` visible on `/metrics` | Yellow. recursiv#3014. |
| G3 | Legacy session handoff on mobile | The v6.0 build reads the legacy token and lands signed in, recording | Red. Not built. |
| G4 | Money parity | Plus and Pro status route agrees with the badge; Stripe inventory decision recorded; ledger tail watermark within one day | Red. |
| G5 | Data parity | Monthly post counts within sync lag; notifications imported at freeze; blocks 948,691 live; video attach run; banners repaired | Red. See section 4. |
| G6 | Legacy URLs | Redirect Worker deployed; sitemap sample returns 301 or 410, zero 200-unmatched | Red. |
| G7 | Media serving | `cdn.minds.com` Worker live; origin fallback count at zero for 24 hours | Red. Copy done, serving not moved. |
| G8 | Capacity | Load test numbers committed for feed, profile, permalink, search at 500 virtual users; Neon compute sized; scratch tables dropped | Red. |
| G9 | Rollback anchor | Neon branch `pre-cutover-<date>` created after the freeze, restore drill run once on staging | Red. |
| G10 | Deploy outage | Coolify rolling cutover enabled, or the 5 to 6 minute API gap stated in the status post | Red. |
| G11 | The "what did not come over" page | Live URL, linked from settings and the status post | Red. |
| G12 | Account deletion executes | recursiv#3013 merged and the before/after transcript committed | Yellow. |
| G13 | The John test | Goal 8c1c4e83 closed with the parity report at zero mismatches | Red. |

## 3. The sequence

Times are relative to T, the DNS change. TTLs on `minds.com`, `www.minds.com` and `api.minds.com`
are lowered to 60 seconds at T minus 48 hours.

### T minus 7 days: announce

1. Post the date and the read-only window on Minds and by in-app banner. Legacy users see it on
   legacy. No email.
2. Publish the "what did not come over" page.
3. Lower TTLs at T minus 48 hours.

### T minus 2 hours: freeze legacy writes

Legacy has no read-only switch in its own code. The freeze is a Cloudflare rule on `www.minds.com`
and its API paths: block every method except GET, HEAD and OPTIONS, and the sign-in and OTP
paths, with a 503 and a JSON body that says Minds is moving. The rule is one toggle, so it is also
the rollback of the freeze.

4. Operator enables the freeze rule. Observer confirms with one POST that returns 503 and one GET
   that returns 200.
5. Status post: "Minds is read-only for the move."

### T minus 90 minutes: final sync and anchor

6. Engine driver runs the post tail (`sync-delta.php`), the comment tail to its ceiling, the
   notification extract (legacy keeps 30 days, so this run is the only one that counts), the block
   delta, and the entitlement and ledger extracts. Each run prints its watermark and count.
7. Reconcile gate runs against the freeze-time legacy counts. Every in-scope entity within the
   agreed tolerance, or abort (section 5).
8. Operator creates the Neon branch `pre-cutover-<date>` from production. Observer records the
   branch id. This is the rollback anchor for written data.

### T: flip

9. Operator changes DNS: `www.minds.com` and `minds.com` to the Minds 2.0 web origin, keeping
   `api.minds.com` as is. The redirect Worker takes every legacy path.
10. Observer runs the discriminator checks from two resolvers: the new bundle string on `/`, the
    production commit on `api.minds.com/health`, a legacy `/newsfeed/<guid>` URL returning 301.
11. Status post: "The new Minds is live. Sign in with your email."

### T plus 30 minutes: watch

12. Watch for 60 minutes, then at 6 and 24 hours:
    - sign-in success rate and `auth_otp_sends_last_hour` against the Resend ceiling
    - API p95 and error rate
    - origin fallback count on the CDN Worker
    - support inbox and the status post replies
13. Each check is a number posted in the channel, with the command that produced it.

### T plus 7 days: settle

14. Keep the legacy freeze in place. Do not tear down OCI or Stream until the CDN fallback count
    has read zero for seven days and the notification extract is confirmed loaded.
15. Retire the redirect Worker only after legacy links stop arriving, measured, not assumed.

## 4. Data items and their rollback

| Item | Loader | Rollback |
|------|--------|----------|
| Posts and replies from the tail | `sync-delta.php` + `delta-checkpoint.php` | Idempotent by legacy guid; a bad run is re-run, not reverted |
| Notifications | `notification-load-ndjson.mjs` | `DELETE FROM notification WHERE import_batch_id = '00000000-0000-0000-0000-00000000a071'` |
| Blocks | `block-load-ndjson.js` | `DELETE FROM block WHERE import_batch_id = '00000000-0000-0000-0000-0000000b10c4'` |
| Plus and Pro entitlements | `paid-entitlement-load-ndjson.js` | The 0600 revert TSV the loader writes |
| Banners | `banner-load-ndjson.js` | Fill-only; nothing to revert |
| Video attach | `video-attach-execute.mjs` | Re-run with `--dry-run` first; rows carry the run fingerprint |
| Legacy bans | one UPDATE with `ban_reason = 'legacy-ban-replay-<date>'` | `UPDATE "user" SET banned_at = NULL, ban_reason = NULL WHERE ban_reason = '<that tag>'` |

Every loader refuses the pooler host and runs against the direct endpoint. No loader writes to
legacy.

## 5. Abort criteria

Abort means: disable the freeze rule, leave DNS where it is, post the status. No shame, no
debate. The observer calls it. Abort if any of these holds before T:

- The reconcile gate shows an in-scope entity outside tolerance.
- The Neon branch did not create, or the restore drill never ran.
- `api.minds.com/health` is not on the promoted commit.
- The App Store build is not in review, or the legacy app cannot reach the new API without an update
  and no handoff exists.
- The operator or observer is not available for the full watch window.

After T, roll back (section 6) if within the first 6 hours:

- sign-in success rate under 90 percent for 30 minutes
- API error rate over 2 percent for 15 minutes
- the CDN Worker falls back to origin for more than 5 percent of requests
- any sign that data written on the new stack is not durable

## 6. Rollback

There are two rollbacks, and they are not the same.

**Rollback of the flip (first 6 hours).** DNS back to legacy, freeze rule off, status post. Writes
made on the new stack in that window stay on the new stack: legacy never sees them, and the next
attempt imports them through the same tail. The users who posted in that window are told on the
status page. This is why the window is short and why we watch.

**Rollback of data (any time).** Restore the Neon branch `pre-cutover-<date>` as the new production
branch, then replay the loaders from section 4 against fresh extracts. The GCS dump is the last
resort with a 23-hour recovery point and is not the plan.

**Deploy rollback.** The web bundle rolls back by pointing the Coolify app at the previous branch
(`PATCH git_branch`, not `git_commit_sha`, per `docs/pw3-rollback-drill.md`). The API rolls back by
promoting the previous SHA. Until Coolify's rolling cutover is enabled (`docs/DEPLOYMENT.md`), each
of those drops the API for 5 to 6 minutes, and the status post says so before it starts.

## 7. Communication

- One status page with the step list from section 3 and a timestamp per step.
- One pinned post on Minds, updated at each step, plain language, no countdowns.
- In-app: the read-only banner on legacy during the freeze; the "what did not come over" link in
  settings on the new stack.
- No email. Email is not part of this cutover.

## 8. Open items this document depends on

- Freeze mechanism: the Cloudflare rule above is the proposal. Bill and Jack confirm it covers the
  legacy mobile app's write paths, or name the alternative.
- The legacy mobile app: users on 5.5.2 who do not update hit a frozen API. The v6.0 update and the
  status post are the answer; the App Store review timeline sets the date.
- The comment ceiling (2026-06-06) and the sync soft gap are accepted losses or fixed before the
  flip. Either way the gap page states it.
