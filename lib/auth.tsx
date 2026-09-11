import * as React from 'react';
import { router } from 'expo-router';
import { Minds } from '@minds/sdk';
import { BASE_URL, BASE_ORIGIN, PROJECT_ID, createAuthedSdk } from './recursiv';
import { Platform } from 'react-native';
import { pickLegacyToken } from './legacySessionParse';
import { readLegacySessionData } from './legacySessionStore';
import { legacySessionExchange } from './legacySessionExchange';
import { shouldDiscardStoredAuth } from './authBoot';
import { bootstrapMindsAI } from './mindsAI';
import * as storage from './storage';
import { captureMessage } from './monitoring';
import { captureRefFromUrl, getPendingRef, clearPendingRef } from './referral';
import { registerPushToken, registerTokenWithServer, unregisterTokenWithServer } from './notifications';
import { clearBookmarks } from './bookmarks';
import { clearMuted } from './muted';
import { clearPreferences } from './preferences';
import { clearSignals } from './signals';
import { clearDrafts } from './drafts';
import { clearChatComposerSession } from './chatComposerSession';
import { captureException } from './monitoring';
import { clearAll as clearCacheAll, setCacheUser } from './cache';
import { clearAllDownloads } from './audio/downloads';
import { invalidatePersonalAgent } from './resolvePersonalAgent';
import { setSignalsSdk } from './signals';
import { sendSignInOtp } from './sendSignInOtp';
import { revokeStoredCredentials } from './authRevocation';

function registerPushTokenBackground(sdk: Minds) {
  registerPushToken().then(token => {
    if (token) registerTokenWithServer(sdk, token);
  }).catch(() => {});
}

const KEYS = {
  apiKey: 'minds:api_key',
  // Better Auth's session token, which is NOT the API key. The API key
  // authenticates /api/v1; Better Auth's own endpoints (2FA, passkeys) accept
  // only this. Sign-in has always returned it and the app has always thrown it
  // away, which is why the 2FA screen could never complete. Cleared on sign-out
  // alongside the API key -- it is a credential of equal weight.
  sessionToken: 'minds:session_token',
  user: 'minds:user',
  projectId: 'minds:project_id',
  version: 'minds:auth_version',
};

// Bump when scopes change OR when the auth model changes to force re-auth.
// 5: added uploads:read/write scope (legacy, pre-Project Membership)
// 6: Project Membership rollout — api keys are now project-scoped (not
//    org-scoped). Customers become project_members of the Minds app, not
//    organization_members of the owning Minds org. Bumping forces existing
//    customers to re-auth so their stored key gets reissued with the new binding.
// 7: added wallet:read/wallet:write so the in-app wallet stops 403-ing
//    ("Couldn't load your wallet"). Existing keys lack the scope; re-auth reissues.
// 8: added the admin scope for live-admin-gated dashboard routes.
// 9: one-time repair for sessions minted while the app requested projectId but
//    production did not yet persist that binding. Those keys still pass normal
//    settings writes, but app-scoped content preferences correctly reject them.
//    Re-auth mints the project-bound key required by every current sign-in path.
const AUTH_VERSION = '9';

const API_KEY_SCOPES = [
  'posts:read', 'posts:write',
  'users:read', 'users:write',
  'communities:read', 'communities:write',
  'chat:read', 'chat:write',
  'agents:read', 'agents:write',
  'organizations:read', 'organizations:write',
  'memory:read', 'memory:write',
  'tags:read', 'tags:write',
  'databases:read', 'databases:write',
  'storage:read', 'storage:write',
  'settings:read', 'settings:write',
  'billing:read', 'billing:write',
  'notifications:read', 'notifications:write',
  'wallet:read', 'wallet:write',
  'uploads:write',
  // Admin dashboard. The scope is necessary-but-not-sufficient: every admin
  // route also enforces a LIVE admin role (requireLiveAdminRole), so a
  // non-admin's key carrying this scope still cannot use admin endpoints.
  // Requesting 'admin' here is harmless and does NOT grant it. The server
  // treats the scope as not self-serve — verified at
  // packages/server/src/features/api-keys/rest/middleware/auth.ts, whose own
  // comment reads: "The 'admin' scope is intentionally not self-serve (you
  // can't mint an admin key from the dashboard)". Admin access instead comes
  // from a role lookup that runs ONLY on admin-gated endpoints, and excludes
  // agent-scoped keys.
  //
  // This replaces a TODO asking the server to strip 'admin' at mint for
  // non-admins. The server already declines to grant it, so the TODO described
  // work that does not exist — and #188 records the related "every user gets
  // admin scope" claim as explicitly REFUTED. Do not re-litigate.
  'admin',
] as const;

/**
 * The key input every sign-in path mints its session key with.
 *
 * The rate limits matter: the server's defaults (60/min, 1000/hour, 10000/day)
 * are sized for server-to-server integrations. This app is an interactive
 * client — one cold start fans out across feed + conversations + agents +
 * communities + notifications + a realtime reconnect, which clears 60/min on
 * its own, and an hour of ordinary browsing clears 1000/hour. Both used to end
 * in the same place: a 429 dead state where chats and posts never load.
 *
 * These are the per-key maximums the server accepts (1000 / 10000 / 100000).
 * Layer 2, the per-user tier cap, is the next ceiling above this.
 */
function sessionKeyInput() {
  return {
    name: `minds-${Date.now()}`,
    scopes: [...API_KEY_SCOPES],
    projectId: PROJECT_ID,
    rateLimitPerMinute: 1000,
    rateLimitPerHour: 10_000,
    rateLimitPerDay: 100_000,
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  image: string | null;
  bio: string;
  /**
   * Account creation time from /users/me. Optional because older cached user
   * JSON predates this field — and code reading it MUST treat absence as "not
   * new" (#189): the safe default is never to route someone to a screen that
   * can rename their account.
   */
  created_at?: string;
  // Network-level role from /users/me. Gates the admin nav + badge. Optional
  // because older cached user JSON (pre-this-field) won't have it.
  role?: 'user' | 'admin';
  // Membership tiers from /users/me, so the signed-in user's OWN badges
  // (Minds+/Pro/Founder) render in the sidebar/account menu.
  plus?: boolean;
  pro?: boolean;
  founder?: boolean;
}

interface AuthContextValue {
  user: User | null;
  sdk: Minds | null;
  projectId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** A live enforcement state that still permits the dedicated appeal path. */
  accountRestriction: 'banned' | 'suspended' | null;
  /** Email recovered from the legacy app when automatic handoff cannot finish. */
  legacySignInEmail: string | null;
  refreshUser: () => Promise<void>;
  switchAccount: (targetUserId: string) => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

function creationTimestamp(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * Keep the fields that drive account routing, permissions, and tier badges
 * when /users/me replaces the partial Better Auth response. These fields are
 * all optional on old cached sessions, but dropping a present value is not a
 * safe fallback: it makes a new account look established and an admin/member
 * look unprivileged immediately after sign-in.
 */
function canonicalUser(me: any, fallback: User, image = me?.image ?? fallback.image): User {
  const role = me?.role === 'admin' || me?.role === 'user'
    ? me.role
    : me?.is_admin === true
      ? 'admin'
      : fallback.role;

  return {
    id: me?.id || fallback.id,
    name: me?.name || fallback.name,
    email: me?.email || fallback.email,
    username: me?.username || fallback.username,
    image,
    bio: me?.bio || me?.briefdescription || fallback.bio,
    created_at: creationTimestamp(me?.created_at ?? me?.createdAt) || fallback.created_at,
    role,
    plus: typeof me?.plus === 'boolean'
      ? me.plus
      : typeof me?.is_plus === 'boolean' ? me.is_plus : fallback.plus,
    pro: typeof me?.pro === 'boolean'
      ? me.pro
      : typeof me?.is_pro === 'boolean' ? me.is_pro : fallback.pro,
    founder: typeof me?.founder === 'boolean'
      ? me.founder
      : typeof me?.is_founder === 'boolean' ? me.is_founder : fallback.founder,
  };
}

// Anonymous SDK for auth operations (signUp/signIn don't need an API key)
const anonSdk = new Minds({ apiKey: 'anonymous', baseUrl: BASE_URL, timeout: 30_000 } as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authedSdk, setAuthedSdk] = React.useState<Minds | null>(null);
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [accountRestriction, setAccountRestriction] = React.useState<'banned' | 'suspended' | null>(null);
  const [legacySignInEmail, setLegacySignInEmail] = React.useState<string | null>(null);

  // Capture a referral code (?ref=) from the landing URL before anything else,
  // so a friend who arrives via an invite link gets attributed on signup.
  React.useEffect(() => { void captureRefFromUrl(); }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const [storedVersion, storedApiKey, storedUser, storedProjectId] = await Promise.all([
          storage.getItem(KEYS.version),
          storage.getItem(KEYS.apiKey),
          storage.getItem(KEYS.user),
          storage.getItem(KEYS.projectId),
        ]);
        if (shouldDiscardStoredAuth(
          storedVersion,
          AUTH_VERSION,
          [storedApiKey, storedUser, storedProjectId],
        )) {
          await clearStorage();
          setIsLoading(false);
          return;
        }

        if (storedApiKey && storedUser) {
          const sdk = createAuthedSdk(storedApiKey);
          const bootUser = JSON.parse(storedUser);
          // Restore the session optimistically — the stored user is what gets
          // rendered anyway, and blocking first paint on a users.me() round
          // trip (with the SDK's 120s timeout) meant a slow API at cutover
          // holds the entire migrated user base on the splash screen at once.
          // Point the cache at THIS user's namespace before anything renders,
          // so a previous account's cached data can't flash through.
          //
          // AWAITED on purpose. On native the cache restores from AsyncStorage,
          // which is async, and finishing it here — inside the window we're
          // already holding the splash for — is the difference between the feed
          // painting from cache on the first frame and the user watching
          // skeletons until a network round trip returns. It's a single small
          // read, and the boot below is going to render immediately after.
          await setCacheUser(bootUser?.id ?? null);
          setAuthedSdk(sdk);
          setSignalsSdk(sdk);
          setUser(bootUser);
          setProjectId(storedProjectId);
          registerPushTokenBackground(sdk);
          // Validate in the background; only a definitive auth rejection
          // (401/403) tears the session down — not billing (402) or 5xx.
          void (async () => {
            try {
              const meRes = await sdk.users.me();
              setAccountRestriction(null);
              const me = (meRes as any).data || meRes;
              // The API KEY decides who the server treats us as — the stored
              // user JSON is just a display copy, and the two CAN drift (e.g.
              // multi-account storage races). If they disagree, adopt the
              // server's identity everywhere: stored JSON, rendered user, and
              // the cache namespace. Without this, the chip says one account
              // while every fetch acts as another — the "identity changed /
              // groups I never joined / my own profile 404s" bug.
              if (me?.id) {
                if (me.id !== bootUser?.id) {
                  captureException(new Error('auth identity mismatch: stored user differs from key owner'), {
                    phase: 'auth_boot_validate', storedId: bootUser?.id, keyOwnerId: me.id,
                  });
                }
                // Always adopt the server's canonical user — not only on an
                // identity MISMATCH. The cached bootUser is a stale display copy
                // and can be missing fields the server now returns (notably
                // `role`, which gates the admin UI). Without syncing on the
                // normal same-account path, a role change never reaches the
                // client and the admin nav stays hidden forever.
                const fallback: User = bootUser && typeof bootUser === 'object'
                  ? bootUser
                  : { id: me.id, name: '', email: '', username: '', image: null };
                const canonical = canonicalUser(me, fallback);
                if (JSON.stringify(canonical) !== JSON.stringify(bootUser)) {
                  await storage.setItem(KEYS.user, JSON.stringify(canonical));
                  setCacheUser(me.id);
                  setUser(canonical);
                }
              }
            } catch (err: any) {
              const status = err?.statusCode || err?.status || 0;
              if (status === 403 && (err?.code === 'account_banned' || err?.code === 'account_suspended')) {
                // Keep the valid key and cached identity: /appeals/* is the one
                // intentionally reachable API surface for a restricted user.
                // Clearing the credential here made an appeal impossible at
                // exactly the moment it was needed.
                setAccountRestriction(err.code === 'account_banned' ? 'banned' : 'suspended');
                return;
              }
              if (status === 401 || status === 403) {
                await clearStorage();
                setCacheUser(null);
                setAuthedSdk(null);
                setSignalsSdk(null);
                setUser(null);
                setProjectId(null);
              }
            }
          })();
        } else if (Platform.OS !== 'web' && process.env.EXPO_PUBLIC_LEGACY_HANDOFF !== '0') {
          // Minds 2.0 ships as an update of the legacy app (same bundle id),
          // so the legacy app's session store is still on the device. Exchange
          // its token once, so a returning member lands signed in with no OTP.
          // Any failure means the normal sign-in screen, nothing else.
          const legacy = pickLegacyToken(await readLegacySessionData());
          if (legacy) {
            try {
              const handoff = await legacySessionExchange(BASE_ORIGIN, PROJECT_ID, legacy.token);
              const key = await anonSdk.auth.createApiKey(sessionKeyInput(), handoff.sessionToken);
              await persistSession(key.key, {
                id: handoff.user.id,
                name: handoff.user.name || '',
                email: handoff.user.email || '',
                username: handoff.user.username || legacy.username || '',
                image: handoff.user.image ?? null,
                bio: '',
                created_at: undefined,
              }, handoff.sessionToken);
              captureMessage('auth: legacy session handed off', { authType: legacy.authType });
            } catch (err: any) {
              // The stored profile is not a credential. Reuse its email only
              // to spare a returning member from retyping it on the OTP form.
              // The OTP still goes through the normal server verification.
              if (legacy.email) setLegacySignInEmail(legacy.email);
              captureException(err, { phase: 'legacy_handoff', authType: legacy.authType, code: err?.code, status: err?.status });
            }
          }
        }
      } catch (err) {
        // An unexpected error during boot logs the user out — make it visible
        // so we can tell a real failure from an expected token expiry.
        captureException(err, { phase: 'auth_boot' });
        await clearStorage();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function clearStorage() {
    // Backlog item 11: the user-data keys below used to survive
    // sign-out, so the next person on a shared device inherited them.
    //   bookmarks   — what the previous user saved
    //   muted       — who they muted
    //   drafts      — unsent posts, i.e. their words in the next user's composer
    //   preferences — showNsfw/aiEnabled/defaultFeed AND the per-conversation
    //                 mute/archive/forced-unread maps, which is DM metadata:
    //                 it reveals which threads that person kept and hid.
    // The comment on clearCacheAll() below already makes exactly this
    // argument for cached feed data. Local storage was simply missed.
    // Every removal is attempted regardless of what any other one does, and each
    // is now checked. This was `Promise.all([...]).catch(() => {})`, which
    // discarded the outcome wholesale — and on web `removeItem` swallowed its own
    // failure and resolved anyway, so the outer catch could not have seen it even
    // in principle.
    //
    // A remove that fails here is the mechanism by which one person's bookmarks,
    // mutes, DM mute/archive metadata and unsent drafts reach the next person who
    // signs in on this device. That is the same class of consequence persistSession
    // below already reports, and for the same reason: not being able to see it is
    // worse than it happening.
    //
    // Deliberate survivors: `minds:pendingRef` is pre-auth referral attribution
    // that must remain until a successful redemption; `minds:archived_accounts`
    // is a device preference over globally unique account ids so a returning
    // account keeps its switcher cleanup; `minds:theme-mode` is a device display
    // preference. None is previous-account content presented as the next user.
    //
    // Each call is written out rather than looped over a key array, because
    // signout-completeness.test.ts reads THIS FILE to prove the wiring — a loop
    // hides `removeItem('minds:drafts:v2')` from the guard that exists precisely
    // because #304 shipped a clear for the wrong key.
    const removals = await Promise.all([
      storage.removeItem(KEYS.apiKey),
      storage.removeItem(KEYS.sessionToken),
      storage.removeItem(KEYS.user),
      storage.removeItem(KEYS.projectId),
      storage.removeItem(KEYS.version),
      storage.removeItem('minds:bookmarks'),
      storage.removeItem('minds:muted'),
      storage.removeItem('minds:preferences'),
      storage.removeItem('minds:drafts:v2'),   // #304 removed 'drafts' — a key nothing uses
      storage.removeItem('minds:onboarding:complete'),
      storage.removeItem('minds:onboarding:preferences'),
      storage.removeItem('minds:lastCurateAt'),
      storage.removeItem('minds:onboarding:usernamePicked'),
      storage.removeItem('minds:agent:setUp'),
      storage.removeItem('minds:agent:ctaDismissed'),
      storage.removeItem('minds.audio.downloads.v1'),
    ]);
    const removalNames = [
      KEYS.apiKey, KEYS.sessionToken, KEYS.user, KEYS.projectId, KEYS.version,
      'minds:bookmarks', 'minds:muted', 'minds:preferences', 'minds:drafts:v2',
      'minds:onboarding:complete', 'minds:onboarding:preferences',
      'minds:lastCurateAt', 'minds:onboarding:usernamePicked',
      'minds:agent:setUp', 'minds:agent:ctaDismissed',
      'minds.audio.downloads.v1',
    ];
    const failed = removalNames.filter((_, i) => !removals[i]);

    // Clearing the KEYS is only half of it. bookmarks.ts and muted.ts hold
    // their sets in module-level variables that outlive a sign-out, so without
    // these the next user in the same session sees the previous user's
    // bookmarks and mutes — and their first write persists them back under the
    // new account. #304 fixed the storage half; this is the half it missed.
    //
    // Each stays individually guarded so one throw cannot skip the rest, but a
    // throw is now recorded rather than dropped: the in-memory copy surviving is
    // the same leak as the stored copy surviving.
    try { clearBookmarks(); } catch { failed.push('memory:bookmarks'); }
    try { clearMuted(); } catch { failed.push('memory:muted'); }
    try { clearPreferences(); } catch { failed.push('memory:preferences'); }
    try { clearSignals(); } catch { failed.push('memory:signals'); }
    try { clearDrafts(); } catch { failed.push('memory:drafts'); }
    try { clearChatComposerSession(); } catch { failed.push('memory:chat-composer'); }
    try { await clearAllDownloads(); } catch { failed.push('downloads:index-files-memory'); }

    if (failed.length > 0) {
      captureMessage('auth: sign-out failed to clear local user data', {
        failed,
        consequence: 'previous user data can persist for the next account on this device',
      });
    }
  }

  async function persistSession(apiKey: string, authUser: User, sessionToken?: string | null) {
    setAccountRestriction(null);
    setLegacySignInEmail(null);
    // Point the cache at this user's namespace. Switching accounts in the same
    // browser loads the new user's own (or empty) cache — the previous user's
    // audience-scoped data (profile, conversations, communities) can never bleed
    // in, since each account reads/writes only its own namespaced key.
    setCacheUser(authUser.id);
    const sdk = createAuthedSdk(apiKey);
    const [keyWritten] = await Promise.all([
      storage.setItem(KEYS.apiKey, apiKey),
      storage.setItem(KEYS.user, JSON.stringify(authUser)),
      sessionToken
        ? storage.setItem(KEYS.sessionToken, sessionToken)
        : storage.removeItem(KEYS.sessionToken),
      storage.setItem(KEYS.projectId, PROJECT_ID),
      storage.setItem(KEYS.version, AUTH_VERSION),
    ]);
    // The API key is the one write whose silent failure is indistinguishable
    // from success until the user reloads and finds themselves signed out with
    // no explanation. storage.setItem used to swallow it; it now reports.
    //
    // Reported to monitoring rather than shown to the user, because this module
    // imports only from lib/ and pulling in a UI component would break that
    // layering. SURFACING IT TO THE USER IS THE FOLLOW-UP AND IS NOT DONE — the
    // person affected still finds out by being signed out. What changes here is
    // that we stop being unable to see it at all.
    //
    // The session itself continues: the in-memory sdk is valid for this run.
    if (!keyWritten) {
      captureMessage('auth: session key failed to persist', {
        consequence: 'user appears signed in until reload, then signed out',
      });
    }
    setAuthedSdk(sdk);
    setSignalsSdk(sdk);
    setUser(authUser);
    setProjectId(PROJECT_ID);
    registerPushTokenBackground(sdk);

    // Re-fetch the user record from the server. Sign-up/sign-in responses
    // can return an incomplete user (e.g. server hasn't assigned the
    // slugified username yet; client falls back to email-prefix which
    // contains `+` or other URL-unsafe chars). Fetching `users.me()`
    // overwrites with the canonical username so profile navigation works.
    try {
      const res = await sdk.users.me();
      const me = (res as any).data || res;
      if (me) {
        const canonical = canonicalUser(me, authUser);
        setUser(canonical);
        await storage.setItem(KEYS.user, JSON.stringify(canonical));
      }
    } catch {
      // Non-fatal — the half-baked user still works for most flows;
      // refreshUser() will rehydrate on next manual trigger.
    }
  }

  const refreshUser = React.useCallback(async () => {
    if (!authedSdk) return;
    try {
      const res = await authedSdk.users.me();
      const me = (res as any).data || res;
      if (me) {
        // Cache-bust the avatar so React Native / the browser treat a new
        // upload as a new resource. Server typically returns a stable URL
        // per user (e.g. /avatars/<id>), so without the query param the
        // <Image> layer reuses the cached blob and the old avatar keeps
        // showing until a hard reload.
        const rawImage = me.image ?? user?.image ?? null;
        const cachedBusted = rawImage
          ? `${rawImage}${rawImage.includes('?') ? '&' : '?'}v=${Date.now()}`
          : null;
        const updated = canonicalUser(me, user || {
          id: '', name: '', email: '', username: '', image: null, bio: '',
        }, cachedBusted);
        setUser(updated);
        await storage.setItem(KEYS.user, JSON.stringify(updated));
      }
    } catch {}
  }, [authedSdk, user]);

  // Switch to a SIBLING account on the same real email (legacy multi-account
  // support — one email can own many accounts). The server mints a fresh api key
  // for the target user; persistSession swaps the active identity (key + user +
  // cache namespace + authed SDK), then refreshUser() loads the canonical
  // profile. Throws with the server's error message on failure.
  const switchAccount = React.useCallback(async (targetUserId: string) => {
    const [apiKeyRead, sessionRead] = await Promise.allSettled([
      storage.getItem(KEYS.apiKey),
      storage.getItem(KEYS.sessionToken),
    ]);
    const apiKey = apiKeyRead.status === 'fulfilled' ? apiKeyRead.value : null;
    const sessionToken = sessionRead.status === 'fulfilled' ? sessionRead.value : null;
    if (!apiKey) throw new Error('Not signed in');

    const outgoingSdk = createAuthedSdk(apiKey);
    const result = (await outgoingSdk.accounts.switchAccount(targetUserId)).data;
    const newKey = result?.api_key;
    const newUser = result?.user;
    if (!newKey || !newUser?.id) throw new Error('Could not switch accounts');

    // Release the OUTGOING account's push binding before the new one takes
    // over. #203 names switchAccount as having the same hole as sign-out, and
    // it does — but a narrower one, so it is worth being precise about what
    // this changes.
    //
    // persistSession below re-registers this token under the new user, and the
    // server upserts with the token as conflict target, so a SUCCESSFUL switch
    // already rebinds. The hole is the failure path: registerPushTokenBackground
    // is fire-and-forget and registerTokenWithServer swallows its errors, so if
    // that registration never lands — offline, permission revoked since, request
    // dropped — the binding silently stays on the PREVIOUS account and their
    // DMs keep arriving on this device.
    //
    // Unregistering first inverts which way that fails: worst case nobody gets
    // notifications here until the next registration, instead of the account
    // the user just left continuing to get them. For a privacy bug that is the
    // right direction to fail in.
    //
    // Placed AFTER the switch succeeds so a failed switch does not cost the
    // user their notifications, and it uses the outgoing key, which is still
    // the credential this device holds at this point.
    try {
      const token = await registerPushToken();
      if (token) await unregisterTokenWithServer(outgoingSdk, token);
    } catch {
      // Never block the switch. Degrades to the previous behaviour: the binding
      // survives until the next registration rebinds it.
    }

    // The switch endpoint mints the replacement key; it does not retire either
    // credential for the account being left. Revoke both before dropping them
    // from storage so account switching cannot accumulate usable old logins.
    const failedRevocations = await revokeStoredCredentials({
      apiKey,
      sessionToken,
      revokeApiKey: () => outgoingSdk.auth.revokeCurrentKey(),
      revokeSession: token => anonSdk.auth.signOut(token),
    });
    if (failedRevocations.length > 0) {
      captureMessage('auth: account switch could not revoke every outgoing credential', {
        failed: failedRevocations,
        consequence: 'a credential for the previous account may remain usable after switching',
      });
    }

    // No session token: the one held belongs to the account being left, and
    // carrying it over would hand the new identity the old one's credential.
    // persistSession clears it when none is passed.
    await persistSession(newKey, {
      id: newUser.id,
      name: newUser.name || '',
      // The switch response intentionally exposes only picker-safe profile
      // fields. persistSession immediately hydrates canonical email/bio through
      // users.me() with the replacement key.
      email: '',
      username: newUser.username || '',
      image: newUser.image ?? null,
      bio: '',
    });
    // NOTE: do NOT call refreshUser() here. persistSession already fetched the
    // canonical user with the NEW api key. refreshUser closes over the previous
    // render's `authedSdk` (state updates are async), so it would re-fetch the
    // OLD account and clobber the just-switched identity — the exact bug where
    // the feeds/inbox switched but the profile stayed on the original account.
  }, []);

  const sendOtp = React.useCallback(async (email: string) => {
    await sendSignInOtp(email);
  }, []);

  const verifyOtp = React.useCallback(async (email: string, otp: string) => {
    const result = await anonSdk.auth.verifyOtpAndCreateKey(
      { email, otp },
      sessionKeyInput(),
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || '',
      email: result.user?.email || email,
      username: (result.user as any)?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
      created_at: creationTimestamp((result.user as any)?.created_at ?? (result.user as any)?.createdAt),
    }, result.session?.token);
  }, []);

  const signUp = React.useCallback(async (name: string, email: string, password: string) => {
    const result = await anonSdk.auth.signUpAndCreateKey(
      { name, email, password },
      sessionKeyInput(),
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || name,
      email: result.user?.email || email,
      username: (result.user as any)?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
      created_at: creationTimestamp((result.user as any)?.created_at ?? (result.user as any)?.createdAt),
    }, result.session?.token);

    // Credit the referrer: if this person arrived via an invite link (?ref=),
    // redeem that code now that they have an account, attributing the signup.
    try {
      const ref = await getPendingRef();
      if (ref) {
        // Only clear the pending code once redemption actually SUCCEEDED.
        //
        // This used to swallow the failure and clear unconditionally, so a
        // transient error — offline at signup, a 500, an expired session —
        // permanently destroyed the referrer's credit: the code was gone from
        // storage, the redemption never happened, and no later sign-in could
        // retry it. Nobody found out, because the failure was discarded and the
        // person who lost the credit was not the person on the screen.
        //
        // Keeping it on failure means the next sign-in retries. Redemption is
        // server-side idempotent per code (it sets usedById once), so a retry
        // after a partial success is safe.
        let redeemed = false;
        try {
          await createAuthedSdk(result.apiKey).inviteCodes.redeem(ref);
          redeemed = true;
        } catch {
          captureMessage('referral: redeem failed, keeping code for retry', { ref });
        }
        // Awaited, and the result read. A failed clear leaves the code on the
        // device to be re-attempted by whoever signs up next; redemption is
        // idempotent so that is harmless, but silently not knowing is not.
        if (redeemed && !(await clearPendingRef())) {
          captureMessage('referral: redeemed but could not clear the pending code', { ref });
        }
      }
    } catch {}

    // Greet the new user: ensure their "Minds AI" personal agent + welcome DM.
    // Fire-and-forget — onboarding must never block or fail sign-up.
    void bootstrapMindsAI(createAuthedSdk(result.apiKey), {
      id: result.user?.id,
      name: result.user?.name || name,
    });
  }, []);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const result = await anonSdk.auth.signInAndCreateKey(
      { email, password },
      sessionKeyInput(),
    );

    await persistSession(result.apiKey, {
      id: result.user?.id || '',
      name: result.user?.name || '',
      email: result.user?.email || email,
      username: (result.user as any)?.username || email.split('@')[0],
      image: result.user?.image ?? null,
      bio: '',
      created_at: creationTimestamp((result.user as any)?.created_at ?? (result.user as any)?.createdAt),
    }, result.session?.token);

    // Returning users (incl. pre-imported die-hards logging in for the first
    // time on 2.0) also get their Minds AI + welcome DM. Idempotent, so it
    // no-ops for anyone who has already been greeted. Fire-and-forget.
    void bootstrapMindsAI(createAuthedSdk(result.apiKey), {
      id: result.user?.id,
      name: result.user?.name,
    });
  }, []);

  // State setters, router, cache invalidators, and storage helpers are stable
  // boundaries; keeping this callback stable keeps the public sign-out methods
  // stable without capturing user/auth state.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only stable boundaries are captured
  const clearLocalAuthState = React.useCallback(async () => {
    await clearStorage();
    // Drop all cached data so the next user in this browser doesn't
    // inherit the previous user's personal feed / conversations /
    // messages / profile. Without this jack signs out, jacktest1
    // signs in, and sees jack's audience-scoped Discover posts +
    // 404s when clicking them.
    // Awaited, and its result read. On native this was fire-and-forget from a
    // synchronous function, so sign-out could finish before the persisted cache
    // was actually removed — and on web the failure was swallowed outright.
    // Cached feed/conversation/profile data outliving a sign-out is the very
    // thing the comment above says this call exists to prevent.
    if (!(await clearCacheAll())) {
      captureMessage('auth: sign-out failed to clear the cached data namespace', {
        consequence: 'this account\'s cached feed/conversations/profile stay on the device after sign-out',
      });
    }
    invalidatePersonalAgent(); // drop the cached personal agent so the next user re-resolves their own
    setCacheUser(null); // reset to the anon namespace
    setUser(null);
    setAccountRestriction(null);
    setLegacySignInEmail(null);
    setAuthedSdk(null);
    setSignalsSdk(null);
    setProjectId(null);
    // Storage + auth state are cleared above. On web a SOFT nav left the authed
    // tab shell half-mounted (you'd be stuck "half logged out" until a manual
    // refresh), so force a hard reload to '/' — it boots fresh with no session
    // and lands straight on the logged-out auth screen. Native re-renders fine
    // off the state reset via router.replace.
    if (typeof window !== 'undefined' && window.location) {
      window.location.replace('/');
    } else {
      router.replace('/');
    }
  }, []);

  const signOut = React.useCallback(async () => {
    // Read both stored credential classes instead of closing over auth state:
    // captured auth state here would be the first render's null forever.
    // allSettled salvages either credential
    // if one storage read fails; local erasure below still always runs.
    const [apiKeyRead, sessionRead] = await Promise.allSettled([
      storage.getItem(KEYS.apiKey),
      storage.getItem(KEYS.sessionToken),
    ]);
    const apiKey = apiKeyRead.status === 'fulfilled' ? apiKeyRead.value : null;
    const sessionToken = sessionRead.status === 'fulfilled' ? sessionRead.value : null;
    const sdk = apiKey ? createAuthedSdk(apiKey) : null;

    // Release the push binding independently. A notification-permission error
    // must not skip either credential revocation, which the old shared try block
    // allowed. It runs concurrently to keep sign-out latency bounded.
    const pushUnbind = (async () => {
      if (!sdk) return;
      try {
        const token = await registerPushToken();
        if (token) await unregisterTokenWithServer(sdk, token);
      } catch {
        // Never block sign-out. The next successful registration rebinds it.
      }
    })();

    // #188 / #364 / P7: sign-in creates an API key AND a Better Auth session.
    // Forgetting either one locally is not server-side sign-out. Revoke both,
    // but never let a network failure prevent the user leaving this device.
    const failedRevocations = await revokeStoredCredentials({
      apiKey,
      sessionToken,
      revokeApiKey: key => createAuthedSdk(key).auth.revokeCurrentKey(),
      revokeSession: token => anonSdk.auth.signOut(token),
    });
    await pushUnbind;
    if (failedRevocations.length > 0) {
      captureMessage('auth: sign-out could not revoke every server credential', {
        failed: failedRevocations,
        consequence: 'a copied credential may remain usable after local sign-out',
      });
    }

    await clearLocalAuthState();
  }, [clearLocalAuthState]);

  const signOutEverywhere = React.useCallback(async () => {
    const apiKey = await storage.getItem(KEYS.apiKey);
    if (!apiKey) {
      await signOut();
      return;
    }

    const sdk = createAuthedSdk(apiKey);
    // The global revoke kills this key too, so release the push binding while
    // the credential can still authenticate. Calling ordinary signOut after
    // the revoke would race a guaranteed 401 and report two false failures.
    try {
      const token = await registerPushToken();
      if (token) await unregisterTokenWithServer(sdk, token);
    } catch {
      captureMessage('auth: sign out everywhere could not release the push binding', {
        consequence: 'this device may receive notifications until its token is rebound or expires',
      });
    }

    // API-key clients have no preservable "current session". This endpoint
    // atomically revokes every API key and Better Auth session for the user;
    // its success response is the final authenticated response on this device.
    await sdk.settings.revokeAllSessions();
    await clearLocalAuthState();
  }, [clearLocalAuthState, signOut]);

  const value = React.useMemo(
    () => ({
      user,
      sdk: authedSdk,
      projectId,
      isLoading,
      isAuthenticated: !!user,
      accountRestriction,
      legacySignInEmail,
      refreshUser,
      switchAccount,
      sendOtp,
      verifyOtp,
      signUp,
      signIn,
      signOut,
      signOutEverywhere,
    }),
    [user, authedSdk, projectId, isLoading, accountRestriction, legacySignInEmail, refreshUser, switchAccount, sendOtp, verifyOtp, signUp, signIn, signOut, signOutEverywhere],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
