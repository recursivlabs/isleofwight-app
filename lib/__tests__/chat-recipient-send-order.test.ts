import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CHAT = readFileSync(join(__dirname, '..', '..', 'app', '(tabs)', 'chat.tsx'), 'utf8');
const SEND_START = CHAT.indexOf('const handleSend = async (');
const SEND_END = CHAT.indexOf('const prepareChatSendRef = React.useRef', SEND_START);
const SEND = CHAT.slice(SEND_START, SEND_END);
const PREPARE_POINT = 'const prepared = preparedSend || await prepareChatSend()';
// Busy UI reflects admission before lookup, but draft/reply/message mutations
// and transport still wait for recipient validation. The rendered pending-
// attachment tests cover preflight controls and release after failed lookup.
const SEND_MUTATIONS = [
  "setText(current =>",
  'setReplyingToState(current =>',
  'setMessages(prev => sortThread',
  'publishLocalChat(',
  'prepared.sdkIdentity.chat.send(',
  'agentSdk.agents.chatStream(',
  'agentSdk.agents.chatStreamText(',
];

function outOfOrderMutations(source: string): string[] {
  const validated = source.indexOf('validate: (prepared) =>');
  return SEND_MUTATIONS.filter((mutation) => {
    const index = source.indexOf(mutation);
    return index === -1 || index <= validated;
  });
}

describe('cold-conversation send ordering', () => {
  it('finds the guarded send implementation', () => {
    expect(SEND_START).toBeGreaterThan(-1);
    expect(SEND_END).toBeGreaterThan(SEND_START);
    expect(SEND).toContain('runPreparedChatDelivery<PreparedChatSend, ReadyChatSend>({');
    expect(SEND).toContain(PREPARE_POINT);
  });

  it('resolves and validates the recipient before local or remote send mutations', () => {
    const resolved = SEND.indexOf(PREPARE_POINT);
    const validated = SEND.indexOf('validate: (prepared) =>');

    expect(validated).toBeGreaterThan(resolved);
    expect(outOfOrderMutations(SEND)).toEqual([]);
    for (const mutation of SEND_MUTATIONS) {
      expect(SEND.indexOf(mutation), mutation).toBeGreaterThan(validated);
    }
  });

  it('the ordering guard detects a draft-clear mutation moved ahead of validation', () => {
    const mutated = SEND.replace(
      PREPARE_POINT,
      `setText(current => current);\n      ${PREPARE_POINT}`,
    );
    expect(outOfOrderMutations(mutated)).toContain('setText(current =>');
  });

  it('does not infer the route from nullable screen partner state', () => {
    expect(SEND).not.toMatch(/partnerInfo\?\./);
    expect(SEND).toContain('runPreparedChatDelivery<PreparedChatSend, ReadyChatSend>({');
    expect(SEND).toContain('const otherId = prepared.recipient.id');
  });

  it('uses one agent generation request path with no automatic second endpoint', () => {
    expect(SEND.match(/agentSdk\.agents\.chatStream\(/g)).toHaveLength(1);
    expect(SEND.match(/agentSdk\.agents\.chatStreamText\(/g)).toHaveLength(1);
    expect(SEND).not.toMatch(/\.agents\.chat\(otherId/);
  });

  it('binds late stream mutations and failed persistence to the prepared send token', () => {
    expect(SEND).toContain("const sendToken = Symbol('chat-send')");
    expect(SEND).toContain('activeSendTokenRef.current === sendToken');
    expect(SEND).toContain('if (!ownsStream()) continue');
    expect(SEND).toContain('let agentBaselineMessageIds: ReadonlySet<string> | null = null');
    expect(SEND).toContain('const baselineMessageIds = prepared.agentBaselineMessageIds ?? null');
    expect(SEND).toContain('acceptedUserMessageId = metadata.message_id');
    expect(SEND).toContain('&& chunk.delta.length > 0');
    expect(SEND).toContain('persistedUserTurn = hasNewPersistedUserTurn({');
    expect(SEND).toContain("new Error('Agent stream returned no content and persisted no matching user turn')");
    expect(SEND).toContain('return turnAccepted');
    expect(SEND).toContain("if (delivery === 'agent' || delivery === 'human') return 'confirmed'");
    expect(SEND).toContain("return transportStarted ? 'unknown' : 'not-started'");
    expect(SEND).not.toContain('persistedReply');
    expect(SEND).toContain('prepared.sdkIdentity.chat.send({');
  });

  it('preflights deferred writes before upload, voice stop, or retry removal', () => {
    const refs = CHAT.indexOf('const prepareChatSendRef = React.useRef');
    const attach = CHAT.slice(CHAT.indexOf('const handleAttach', refs), CHAT.indexOf('const handleSendVoice', refs));
    const pendingVoice = CHAT.slice(CHAT.indexOf('const attemptPendingVoiceNote', refs), CHAT.indexOf('const handleSendVoice', refs));
    const voice = CHAT.slice(CHAT.indexOf('const handleSendVoice', refs), CHAT.indexOf('const retryMessage', refs));
    const retry = CHAT.slice(CHAT.indexOf('const retryMessage', refs), CHAT.indexOf('const reportRequestSpam', refs));

    expect(attach.indexOf('await prepareChatSendRef.current()')).toBeLessThan(attach.indexOf('uploadMediaBlob('));
    expect(voice.indexOf('await prepareChatSendRef.current()')).toBeLessThan(voice.indexOf('voice.stop()'));
    expect(voice.indexOf('const note = saveVoiceRecording(rec, origin)')).toBeLessThan(voice.indexOf('attemptPendingVoiceNote(note, prepared)'));
    expect(pendingVoice).toContain('Voice note upload failed. Keep Minds open');
    expect(pendingVoice).toContain('updatePendingChatVoiceNote(note');
    expect(pendingVoice).toContain('const attemptToken = beginChatVoiceAttempt(note)');
    expect(pendingVoice).toContain('resolveUniqueUserContentPersistence({');
    expect(pendingVoice.indexOf('if (note.deliveryAttemptedAt)')).toBeLessThan(
      pendingVoice.indexOf('handleSendRef.current(publicUrl'),
    );
    expect(pendingVoice).toContain('uniqueContentRetryDecision(true, priorStatus)');
    expect(pendingVoice).toContain("priorStatus === 'unknown'");
    expect(pendingVoice).toContain('No duplicate was sent');
    expect(pendingVoice).toContain("'voice-outbox'");
    expect(retry).toContain('await prepareChatSendRef.current()');
    expect(retry).not.toContain('setMessages(prev => prev.filter');
  });

  it('reserves microphone startup before assigning recording ownership', () => {
    const start = CHAT.indexOf('const handleStartVoice = React.useCallback');
    const end = CHAT.indexOf('const handleCancelVoice', start);
    const handler = CHAT.slice(start, end);

    expect(handler).toContain('|| voiceOriginRef.current !== null');
    expect(handler).toContain('const startToken = beginChatVoiceStart(user.id)');
    expect(handler.indexOf('beginChatVoiceStart(user.id)')).toBeLessThan(
      handler.indexOf('voiceOriginRef.current = origin'),
    );
    expect(handler).toContain('endChatVoiceStart(origin.userId, startToken)');
  });
});
