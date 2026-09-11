import { beforeEach, describe, expect, it, vi } from 'vitest';

// signals.ts holds two module-level containers that outlive a sign-out:
//
//   queue       — buffered events. flush() intentionally KEEPS them when nobody
//                 is signed in ("keep for after login"), and reads the API key
//                 at flush time — so after the next user signs in, the previous
//                 user's events post under THEIR credentials.
//   viewedPosts — the dedupe set. It only cleared at a 5000-entry size cap, so
//                 the next user's view events were suppressed for every post the
//                 previous user had already seen.
//
// Both are exercised through the injectable SDK rather than by reaching into
// private state, so these tests describe the observable contract.

async function freshModule() {
  vi.resetModules();
  localStorage.clear();
  return await import('../signals');
}

/**
 * Records what actually reaches the wire.
 *
 * The shape matters and is not obvious: flush() resolves its transport as
 * `sdk?.posts?.client || sdk?.notifications?.client`, so a mock that merely
 * exposes `post()` at the top level is never called — and a test asserting an
 * absence against it passes trivially. That is exactly how the first draft of
 * this file produced a false PASS.
 */
function recordingSdk() {
  const sent: any[] = [];
  const client = {
    post: vi.fn(async (path: string, body: any) => { sent.push({ path, body }); return {}; }),
  };
  return { sent, sdk: { posts: { client } } };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('clearSignals — buffered events must not follow a user out', () => {
  it('drops queued events so they cannot flush under the next account', async () => {
    const m = await freshModule();
    const rec = recordingSdk();
    m.setSignalsSdk(rec.sdk);
    localStorage.setItem('minds:api_key', 'alice-key');

    m.logSignal('view', { postId: 'alice-read-this' });

    // POSITIVE CONTROL: prove the transport works at all before asserting an
    // absence through it. Without this the test below passes against a mock
    // that is never called, which proves nothing.
    m.logSignal('view', { postId: 'control-post' });
    await m.flushSignals();
    expect(JSON.stringify(rec.sent)).toContain('control-post');
    rec.sent.length = 0;
    m.logSignal('view', { postId: 'alice-read-this-again' });

    // Sign-out.
    m.clearSignals();
    localStorage.removeItem('minds:api_key');

    // Bob signs in and something triggers a flush.
    localStorage.setItem('minds:api_key', 'bob-key');
    await m.flushSignals();

    const sent = JSON.stringify(rec.sent);
    expect(sent).not.toContain('alice-read-this');
  });
});

describe('the 401/403 circuit breaker must not outlive the key that tripped it', () => {
  it('a fresh sign-in re-arms telemetry after an unauthorized key killed it', async () => {
    const m = await freshModule();

    // Alice's key is dead: every post answers 401, so the breaker trips.
    const rejecting = {
      posts: { client: { post: vi.fn(async () => { throw { status: 401 }; }) } },
    };
    m.setSignalsSdk(rejecting);
    m.logSignal('view', { postId: 'alice-post' });
    await m.flushSignals();

    // CONTROL: prove the breaker actually tripped — with the dead SDK still
    // registered, new events never reach the wire (logSignal is a no-op).
    rejecting.posts.client.post.mockClear();
    m.logSignal('view', { postId: 'alice-post-2' });
    await m.flushSignals();
    expect(rejecting.posts.client.post).not.toHaveBeenCalled();

    // Sign-out, then Bob signs in with a working key. Registering the new SDK
    // must re-arm the breaker; otherwise telemetry stays dark for the rest of
    // the process even though the 401 verdict belonged to Alice's key.
    m.clearSignals();
    m.setSignalsSdk(null);
    const rec = recordingSdk();
    m.setSignalsSdk(rec.sdk);
    localStorage.setItem('minds:api_key', 'bob-key');

    m.logSignal('view', { postId: 'bob-post' });
    await m.flushSignals();
    expect(JSON.stringify(rec.sent)).toContain('bob-post');
  });
});

describe('clearSignals — the dedupe set must not suppress the next user', () => {
  it('a post the previous user viewed is still logged for the new user', async () => {
    const m = await freshModule();
    const rec = recordingSdk();
    m.setSignalsSdk(rec.sdk);
    localStorage.setItem('minds:api_key', 'alice-key');

    // Alice views a post, then it is flushed away.
    m.logSignal('view', { postId: 'shared-post' });
    await m.flushSignals();
    expect(JSON.stringify(rec.sent)).toContain('shared-post');   // control
    rec.sent.length = 0;

    // Without clearSignals(), viewedPosts still contains shared-post and Bob's
    // identical view is silently dropped.
    m.clearSignals();

    m.logSignal('view', { postId: 'shared-post' });
    await m.flushSignals();

    expect(JSON.stringify(rec.sent)).toContain('shared-post');
  });
});
