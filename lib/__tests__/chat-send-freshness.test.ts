import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// #190: chat attach / voice-note / retry could deliver into the WRONG
// conversation. The mechanism is a stale closure — a handler created with an
// empty or narrow dependency array captures the conversation that was open when
// it was created, and keeps sending there after the user switches threads.
//
// The fix routes every deferred send through `handleSendRef.current`, which is
// reassigned on every render and therefore always current. That is invisible to
// types, invisible to lint, and one careless edit away from regressing — a
// direct `handleSend(...)` inside those handlers reintroduces the bug silently.
//
// THIS PATTERN HAS RECURRED THREE TIMES IN ONE DAY: #190 itself, the sign-out
// push unregister (closed over a [] callback's stale `authedSdk`), and chat's
// own toggleReadState (read `conversations` from a [sdk] closure). It is the
// house bug, so it gets a guard.
//
// This reads source rather than behaviour: vitest here covers lib/** with
// react-native stubbed, so the screen cannot be rendered. Weaker than proving
// delivery, and it is the check that would catch the regression.

const CHAT = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'chat.tsx'), 'utf8');

/** Body of a `const <name> = React.useCallback(...)` up to its dependency array. */
function callbackBody(name: string): string {
  const start = CHAT.indexOf(`const ${name} = React.useCallback(`);
  if (start === -1) return '';
  const end = CHAT.indexOf('}, [', start);
  return end === -1 ? CHAT.slice(start) : CHAT.slice(start, end);
}

// The deferred-send handlers #190 names: each awaits something (a picker, an
// upload, a recording) and only then sends, which is the window in which the
// user can switch threads.
const DEFERRED_SENDERS = ['handleAttach', 'handleSendVoice', 'retryMessage'];
const REF_SENDERS = ['handleAttach', 'attemptPendingVoiceNote', 'retryMessage'];

describe('#190 — deferred sends must not capture a stale conversation', () => {
  it('the ref indirection still exists', () => {
    // Positive control: if the ref is renamed or removed, every assertion below
    // would pass vacuously against handlers that no longer use it.
    expect(CHAT).toContain('const handleSendRef = React.useRef(handleSend)');
    expect(CHAT).toContain('handleSendRef.current = handleSend');
  });

  it('each deferred sender exists and is found by name', () => {
    for (const fn of DEFERRED_SENDERS) {
      expect(callbackBody(fn), `${fn} not found in chat.tsx`).not.toBe('');
    }
  });

  it('each transport helper sends through the ref, never a captured handleSend', () => {
    for (const fn of REF_SENDERS) {
      const body = callbackBody(fn);
      expect(body, `${fn} not found in chat.tsx`).not.toBe('');
      expect(body, `${fn} must send via handleSendRef.current`).toContain('handleSendRef.current');
      // A direct call is the regression: `handleSend(` not preceded by `Ref.current.`
      const direct = /(?<!Ref\.current)\bhandleSend\s*\(/.test(body);
      expect(direct, `${fn} calls handleSend directly — that is #190`).toBe(false);
    }
  });

  it('voice capture delegates to the ref-safe session-note helper', () => {
    const body = callbackBody('handleSendVoice');
    expect(body).toContain('await attemptPendingVoiceNote(');
    expect(/(?<!Ref\.current)\bhandleSend\s*\(/.test(body)).toBe(false);
  });
});
