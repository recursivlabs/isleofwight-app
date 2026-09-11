# The privacy policy's factual basis, and why the existing link does not satisfy P12(4)

P12(4) requires **"a published privacy-policy URL returning `200`, covering PostHog and whatever P6
adds, linked from both store listings and from in-app settings."** §10.31 recorded that no policy
page exists in this repo. That is true, and it is not the whole problem.

## The existing link returns 200 and still does not satisfy the row

`app/settings.tsx` already carries a **Privacy Policy** row. It opens
`https://minds.com/p/privacy`:

```
$ curl -s -o /tmp/pp.html -w '%{http_code}' -L https://minds.com/p/privacy
200
$ grep -c "expo-root\|_expo/static" /tmp/pp.html
0                      # ← the LEGACY network, not Minds 2.0 (§2's discriminator, §5.20)
$ curl -s -L https://minds.com/p/privacy | grep -ic posthog
0                      # ← says nothing about the analytics THIS app runs
```

**So a naive reading of P12(4) passes today and proves nothing.** `curl -o /dev/null -w '%{http_code}'`
→ `200` is satisfied by a policy written for a different product, on a different stack, that does not
mention the processor this app sends usernames and email addresses to. That is the unguarded-status-code
failure this ladder rejects everywhere else, sitting on a store-submission blocker.

The same is true of the Terms and Community Guidelines rows beside it — all three point at the legacy
network. Whether Minds 2.0 is legally covered by the legacy documents is **a question for a human**,
not an agent, and this document does not answer it.

## What the app actually does, read off the code

Every line below is a command, so the policy is written from behaviour rather than from intent.

**Only one analytics package ships, and it is web-only:**
```
$ git show origin/main:package.json | grep -nE "posthog|sentry|amplitude|mixpanel|firebase"
50:    "posthog-js": "^1.383.3",
```
No `posthog-react-native`, no `@sentry/*`. `lib/monitoring.ts` returns `null` unless
`Platform.OS === 'web'`, so **iOS and Android send no analytics or crash telemetry at all** today.

**Automatic capture is deliberately off:**
```
$ git show origin/main:lib/monitoring.ts | grep -nE "capture_pageview|autocapture"
23:      capture_pageview: false,
24:      autocapture: false,
```
PostHog therefore does not receive a general record of what a user views or clicks. What it receives
is explicit `$exception` events from `captureException`/`captureMessage`.

**The part users would not expect, and the reason this needed writing carefully:**
```
$ git show origin/main:lib/monitoring.ts | grep -n "identify"
66:  if (user) p.identify(user.id, { username: user.username, email: user.email });
```
**Username and email address are sent to PostHog** when a signed-in user is identified. That is
personal data going to a third-party processor, and it is what the store data-safety declarations
(P12(5)) must declare. A policy that omitted it would be false, and the declaration would not match
the code — which is a store-review problem, not a paperwork one.

**It is also gated on a key §10.1 says may not exist anywhere:**
```
$ git show origin/main:lib/monitoring.ts | grep -n "EXPO_PUBLIC_POSTHOG_KEY"
8:const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || '';
```
If the key is unprovisioned, nothing is sent at all. The policy describes what happens **when it is
configured**, because that is the state it must be honest about.

## What this does NOT establish

- **The page is not published yet**, so P12(4)'s `200` is not claimable from it. It serves at
  `/privacy` on the web build; the URL becomes real when that build deploys.
- **The store-listing half is untouched.** P12(4) needs the policy linked from *both* store listings,
  which needs console access (§10.28 records that the Play record's existence is unverified).
- **This is not legal review.** The page is factually accurate about the code as of the commands
  above. Whether it is *sufficient* — GDPR lawful basis, CCPA disclosures, the retention periods P8(5)
  will set — is a lawyer's call, and the page should not be linked as the operative policy until
  someone makes it.
- **The live Settings link is deliberately NOT re-pointed in this change.** Swapping a legal document
  users are currently served, for one that has had no review, is not an agent's call. The
  discrepancy is documented here so it is decided rather than discovered.
