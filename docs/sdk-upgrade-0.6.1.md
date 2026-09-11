# Is `@recursiv/sdk` 0.5.6 → 0.6.1 safe? (§10.5)

**ANSWER: YES — additive only. No method was removed, and no surviving method changed signature,
across all 48 resources.** Established 2026-08-01 by diffing the published packages.

§10.5 recorded the risk precisely: *"Only the `appSubscriptions` surface was diffed; the other 47
resources were not."* This diffs all of them, mechanically, so the answer does not rest on anyone
having read carefully.

## Method surface, both versions

Both packages installed from npm into empty directories, then every `.d.ts` under `dist/resources/`
parsed for method declarations:

```
$ for v in a b; do find $v/node_modules/@recursiv/sdk/dist/resources -name '*.d.ts' | while read f; do
    r=$(basename $f .d.ts); grep -oE "^\s+[a-zA-Z0-9_]+\(" "$f" | tr -d ' (' | sed "s|^|$r.|"
  done | sort -u > /tmp/api-$v.txt; done

0.5.6 methods: 437
0.6.1 methods: 442
```

**Removed in 0.6.1 — the set that would break callers:**

```
$ comm -23 /tmp/api-a.txt /tmp/api-b.txt
(empty)
```

**Added in 0.6.1:**

```
admin.dismissReport
admin.listReports
admin.resolveReport
app-subscriptions.status
organization-settings.setAuthEmailBrandName
```

## Signatures, because a name surviving is not the same as a contract surviving

A method can keep its name and change its parameters, which breaks callers just as hard and is
invisible to the name-level diff above. Re-run with full declarations, then filtered to methods that
exist in **both** versions:

```
$ comm -23 /tmp/sig-a.txt /tmp/sig-b.txt | (methods still present in 0.6.1)
(empty)
```

**Every surviving method kept its exact declared signature.** The only differences in the signature
diff are the five additions listed above.

## Worth noticing: three of the five additions are moderation

`admin.listReports`, `admin.resolveReport` and `admin.dismissReport` did not exist in the pinned
version. **P8(6) requires an appeals path demonstrated end to end** — a false-positive block appealed,
visible to a reviewer, and the reversal landing in the same audit trail as the original action. That
is the shape of a report queue with resolve and dismiss transitions.

**This does not mean P8(6) is closer than it was**, and the row should not be re-scored on it: P8(6)
closes on three `run_sql_query` row ids in one audit table, and the existence of SDK methods says
nothing about whether the rows are written or linked. **It does mean the pinned SDK cannot even
express the calls P8(6) will need**, which is a concrete reason to take the bump rather than defer it.

## What this does NOT establish

- **Type-level compatibility only.** The diff is over `.d.ts` declarations. A method whose *runtime*
  behaviour changed — a different default, a changed error shape, a new required field the types
  declare as optional — is invisible here. `pnpm typecheck` passing after the bump is necessary and
  not sufficient.
- **Nothing was executed against 0.6.1 in this app.** PSDK's clean-environment run did call
  `users.me()` successfully on 0.6.1, which is one method of 442.
- **The five new methods are unexercised.** Their presence is asserted from typings, not from a call.
- **This says nothing about `@minds/sdk`**, which pins `@recursiv/sdk@0.5.6` and would need the same
  bump to benefit — see the PSDK(3) naming question, still open.
