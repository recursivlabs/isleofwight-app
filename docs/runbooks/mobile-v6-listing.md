# Mobile: ship Minds 2.0 as v6.0 of the existing store listings

Decision (Jack, 2026-09-08): the new app ships as version 6.0 of the existing Minds listings, not as
a new app. That keeps every install, rating and review, and it lets the update inherit the legacy
app's stored session so members land signed in (see `docs/runbooks/cutover.md`, gate G3, and
recursivlabs/minds#809).

## Facts

| | Legacy (today) | Minds 2.0 (today) | Minds 2.0 (target) |
|---|---|---|---|
| iOS bundle id | `com.minds.mobile` | `com.minds.app` | `com.minds.mobile` |
| App Store record | 961771928, "Minds.com", v5.5.2, last release 2025-05-09, seller MINDS.ORG, INC. | 6793750469, never published, TestFlight only | 961771928 |
| Android package | `com.minds.mobile` | `com.minds.app` | `com.minds.mobile` |
| Play record | exists (Jack: account and legacy app exist, with a moderation history) | none | the legacy record |
| Version | 5.5.2 | 2.0.1 | 6.0.0 |
| EAS project | 7a92bc49 (the legacy repo's tenant.json points at the same project) | 7a92bc49 | 7a92bc49 |
| OTA runtime | n/a | `appVersion` policy, runtime `2.0.1` | runtime `6.0.0`; the 2.0.1 TestFlight installs stop receiving OTA and must update |

## Changes in the repo (agent work, one PR)

1. `app.json`: `ios.bundleIdentifier` and `android.package` to `com.minds.mobile`; `version` to `6.0.0`.
   `associatedDomains` and `intentFilters` stay. Push entitlement stays (the APNs key moves with the
   Apple team, see below).
2. `eas.json`: `submit.production.ios.ascAppId` to `961771928`; `submit.production.android` keeps
   the internal track (recursivlabs/minds#808) and gains the legacy package.
3. Sentry and PostHog project keys stay; the privacy declarations must match what ships.
4. The build number must be higher than any build ever uploaded to 961771928 and the Android
   `versionCode` higher than legacy 5.5.2's. `appVersionSource: remote` on EAS handles iOS if the
   remote counter is seeded above the legacy build number; Android needs the same seed.

## Credentials and console work (Jack, before that PR can build)

1. **Apple.** In App Store Connect for MINDS.ORG, INC.: confirm Jack is Account Holder (transfer
   case 102907978488 closed 2026-07-20), create an App Store Connect API key for CI, and make sure
   a distribution certificate and an App Store provisioning profile exist for `com.minds.mobile`,
   plus the APNs key. Then `eas credentials --platform ios` on project 7a92bc49 to sync them. If the
   legacy repo already stored them in this EAS project, this is a check, not a setup.
2. **Google Play.** Open the legacy Play Console: read the policy status of the `com.minds.mobile`
   record (the moderation history), fix any open policy issue before uploading anything, create a
   service account with release permission and download its JSON as `play-service-account.json`
   (gitignored), and note the current `versionCode`. Play App Signing means the upload key must be
   the legacy upload key; find it (legacy CI variables or the previous release machine) or start
   the upload-key reset in the console, which takes days.
3. **TestFlight.** Testers on the unpublished 6793750469 record must be re-invited on 961771928;
   TestFlight groups do not move between records.
4. **Seed the build counters** on EAS above the legacy numbers (iOS build number, Android
   versionCode).

## Order

1. Console work above (Jack).
2. The repo PR (bundle ids, version, ascAppId).
3. `native-release.yml` production build for both platforms from `main`.
4. TestFlight and Play internal track. Proof for P3b: a physical-iPhone launch recording with the
   build number in frame; for G3: the handoff recording from a device that had 5.5.2 signed in.
5. Store submission is human-only (P12): `eas submit` for both platforms, the compliance forms,
   and Apple review. Allow two weeks for review of a materially different app on an old listing.

## What this does not solve

- Members who never update stay on 5.5.2 against a frozen API. The cutover runbook's status post and
  a compat responder on the old API paths are the only answers; a forced-update mechanism does not
  exist in the legacy app.
- The unpublished 6793750469 record can be left as is or removed after the v6.0 build is live.
