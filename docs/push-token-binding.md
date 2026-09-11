# Does the server rebind or accumulate Expo push tokens? (§10.7)

**ANSWER: it REBINDS.** A device token is bound to exactly one user, and re-registering it moves the
binding. Established 2026-08-01 against engine `origin/main`.

§10.7 framed the stakes precisely: the answer *"changes backlog item 12's blast radius from 'wrong
notifications' to 'cross-account delivery on one device'."* **The worse of the two is refuted** — but
a narrower window survives, and it is worth stating because the good answer makes it easy to stop
reading.

## The mechanism

`PushNotificationService.registerToken` upserts, and the conflict target is the **token**:

```ts
await db.insert(pushNotificationToken)
  .values({ userId, token, service, deviceName })
  .onConflictDoUpdate({
    target: pushNotificationToken.token,
    set: { userId, service, deviceName, updatedAt: new Date() },
  });
```

**`userId` is in the `set`.** So when a second account registers the same device token, the row's
owner is overwritten rather than a second row being added. There is no path by which one token maps
to two users, which is exactly the accumulation §10.7 was worried about.

**Backlog item 12's blast radius therefore stays at "wrong notifications" and does NOT escalate to
cross-account delivery.**

## The residual window, which the rebind does not close

Rebinding happens **when the next user registers** — not when the previous one leaves. And sign-out
does not clear the binding:

```
$ git grep -n "deleteToken\|unregisterPush\|removePushToken" -- lib/ app/
(no output)
```

`signOut` in `lib/auth.tsx` clears storage, cache and auth state; it never calls the server's
`deleteToken`, which exists (`PushNotificationService.deleteToken`) and is simply never invoked from
the app. Registration happens in the other direction only — `registerPushTokenBackground` on sign-in
and on session restore.

**So between user A signing out and user B registering, the token remains bound to A.** If B declines
the push permission prompt, or never reaches a foreground state that triggers registration, **A's
notifications continue arriving on a device A no longer holds**, indefinitely.

That is a narrower fault than accumulation — it needs a shared device, a sign-out, and a second user
who never registers — but it is the same *class* of harm, and it is not closed by the rebind.

**The fix is small and is not made here:** call `deleteToken` on sign-out. It is a one-line addition
to a code path this document did not want to change while only reading. Filing it as work rather than
doing it, because a sign-out change is user-visible and belongs in a PR of its own with a device test.

## What this does NOT establish

- **Nothing was executed.** This is source analysis: no token was registered, no sign-out observed, no
  notification delivered. A device test with two accounts is what would prove the window empirically.
- ~~The uniqueness constraint was inferred, not read.~~ **RESOLVED in the same sitting — the
  constraint is real**, and the finding no longer rests on an assumption:

  ```
  $ git -C /home/bill/dev/recursiv show origin/main:packages/server/src/db/schema.ts | sed -n '2322,2336p'
  export const pushNotificationToken = pgTable('push_notification_token', {
    …
    token: text('token').notNull(),
  }, (table) => [
    index('push_notification_token_user_id_idx').on(table.userId),
    uniqueIndex('push_notification_token_token_unique').on(table.token),
  ]);
  ```

  **`uniqueIndex(...).on(table.token)` is declared**, so `onConflictDoUpdate` genuinely fires and the
  rebind conclusion holds. *Why the first pass missed it, recorded because it is a repeatable
  mistake: I grepped `pushToken|push_token`, and the table is `push_notification_token` — the pattern
  was a substring of what I was looking for in my head, not of what is written. **An empty grep is
  evidence about the pattern before it is evidence about the code**, which is the same lesson §5.51
  keeps teaching from a different angle.*
- **`SandboxService.ts` also references push tokens** and was not read. Whether it registers by a
  different path, and whether that path shares the same conflict behaviour, is unknown.
