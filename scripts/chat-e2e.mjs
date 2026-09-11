// End-to-end chat correctness harness. Drives the REAL chat system through the
// SDK against production with two real accounts + a live agent, and asserts the
// invariants that have been breaking. Run: node scripts/chat-e2e.mjs
// Exits non-zero on any failure so it can gate deploys / run as a monitor.
import { Recursiv } from '@recursiv/sdk';

const BASE_URL = process.env.EXPO_PUBLIC_RECURSIV_API_URL || 'https://api.recursiv.io/api/v1';
const PROJECT_ID = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const ORG_ID = '019d517b-bb87-744d-92db-b3801dc15927';
const SCOPES = ['posts:read','posts:write','users:read','users:write','communities:read','communities:write','chat:read','chat:write','agents:read','agents:write','notifications:read','notifications:write','settings:read','tags:read','uploads:write'];

const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
const ki = (n) => ({ name: n, scopes: SCOPES, projectId: PROJECT_ID });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = {};
const mark = (k, ok, detail='') => { results[k] = `${ok ? 'PASS' : 'FAIL'} ${detail}`; if (!ok) console.log(`  ✗ ${k}: ${detail}`); };

const norm = (m) => ({
  id: m.id,
  content: (m.content ?? m.text ?? '').trim(),
  senderId: m.sender?.id ?? m.senderId ?? m.sender_id,
  isAi: !!(m.sender?.is_ai ?? m.sender?.isAi),
});
const preview = (c) => (c.last_message?.content ?? c.lastMessage?.content ?? '').trim();

try {
  // ---- Setup: account A (QA), account B (fresh), and a live agent ----
  const a = await anon.auth.signInAndCreateKey({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }, ki('e2eA-'+Date.now()));
  const A = new Recursiv({ apiKey: a.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meA = (await A.profiles.me()).data;
  const b = await anon.auth.signUpAndCreateKey({ email:`qa+chat${Date.now()}@recursiv.io`, password:'QaChat12345!x', name:'Chat B' }, ki('e2eB-'+Date.now()));
  const B = new Recursiv({ apiKey: b.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meB = (await B.profiles.me()).data;

  const agents = (await A.agents.listDiscoverable({ limit: 50, organization_id: ORG_ID })).data || [];
  const agent = agents.find(x => x.username === 'minds_support') || agents[0];
  console.log(`Setup: A=${meA.username} B=${meB.username} agent=${agent?.username || 'NONE'}`);

  // ======================================================================
  // 1. AGENT CHAT — send a message, get a reply, verify message integrity
  // ======================================================================
  const agentTag = `agentq-${Date.now()}`;
  let agentReplyText = '';
  if (agent?.id) {
    const adm = (await A.chat.dm({ user_id: agent.id, organization_id: ORG_ID })).data;
    // Drive the same path the client uses for agents: the stream endpoint
    // persists the user message itself.
    try {
      const r = await A.agents.chatStreamText(agent.id, { message: agentTag, conversation_id: adm.id });
      agentReplyText = (r?.content || '').trim();
    } catch (e) { console.log('  agent stream error:', e.message); }
    await sleep(2500);
    const amsgs = ((await A.chat.messages(adm.id, { limit: 50 })).data || []).map(norm);

    // 1a. user's message stored EXACTLY once (no double-persist)
    const mine = amsgs.filter(m => m.content === agentTag);
    mark('agent_user_msg_once', mine.length === 1, `(found ${mine.length} copies of the sent message)`);
    // 1b. agent produced a non-empty reply
    mark('agent_reply_present', !!agentReplyText && amsgs.some(m => m.isAi && m.content), `(replyLen=${agentReplyText.length})`);
    // 1c. NO empty/blank messages returned by the API
    mark('agent_no_empty_msgs', amsgs.every(m => m.content.length > 0), `(${amsgs.filter(m=>!m.content.length).length} empty msgs returned)`);
    // 1d. no duplicate message ids
    mark('agent_no_dup_ids', new Set(amsgs.map(m=>m.id)).size === amsgs.length, '');
    A.__adm = adm;
  } else {
    mark('agent_user_msg_once', false, '(no discoverable agent to test)');
  }

  // ======================================================================
  // 2. HUMAN DM — delivery, unread, preview, notification, read-clears
  // ======================================================================
  const dmTag = `dmq-${Date.now()}`;
  const dm = (await A.chat.dm({ user_id: meB.id, organization_id: ORG_ID })).data;
  await A.chat.send({ conversation_id: dm.id, content: dmTag });
  await sleep(1800);

  const convosB = (await B.chat.conversations({ limit: 30, organization_id: ORG_ID })).data || [];
  const dmB = convosB.find(c => c.id === dm.id);
  mark('dm_appears_for_recipient', !!dmB, '(B sees the new DM)');
  mark('dm_unread', (dmB?.unread_count ?? 0) >= 1, `(unread=${dmB?.unread_count})`);
  mark('dm_preview_correct', preview(dmB) === dmTag, `(preview="${preview(dmB)}" expected="${dmTag}")`);

  // DMs intentionally do NOT pollute the notifications FEED (like Instagram/X/
  // Signal — DMs are a separate inbox + push). The in-app signal is the unread
  // indicator (tested above via dm_unread); push is the out-of-app signal.
  await sleep(1500);
  const feedTypes = ((await B.notifications.list({limit:30})).data||[]).map(n=>(n.targetType||n.target_type||n.type||'').toLowerCase());
  mark('dm_not_in_notif_feed', !feedTypes.some(t=>t.includes('chat_message')), '(DMs stay out of the activity feed)');

  // read clears unread — pass the last message id like the client does
  const bMsgs = (await B.chat.messages(dm.id, { limit: 5 })).data || [];
  const bLastId = bMsgs[0]?.id; // newest-first
  try { await B.chat.markAsRead(dm.id, bLastId ? { message_id: bLastId } : {}); } catch(e) { console.log('  markAsRead err:', e.message); }
  await sleep(1200);
  const dmB2 = ((await B.chat.conversations({ limit: 30, organization_id: ORG_ID })).data || []).find(c => c.id === dm.id);
  mark('dm_read_clears_unread', (dmB2?.unread_count ?? 0) === 0, `(unread after read=${dmB2?.unread_count})`);

  // ======================================================================
  // 3. PER-CONVERSATION PREVIEWS — the bug Jack hit: every preview showed
  //    the same (globally latest) message. Assert each preview is its OWN.
  // ======================================================================
  // A now has at least the agent DM + the human DM with distinct last msgs.
  const convosA = (await A.chat.conversations({ limit: 30, organization_id: ORG_ID })).data || [];
  const withPreview = convosA.filter(c => preview(c).length > 0);
  const previews = withPreview.map(preview);
  const allIdentical = previews.length > 1 && new Set(previews).size === 1;
  mark('previews_not_all_identical', !allIdentical, `(${previews.length} convos, ${new Set(previews).size} distinct previews)`);
  // the human DM preview specifically must be the dm message, not the agent's
  const dmA = convosA.find(c => c.id === dm.id);
  mark('preview_is_per_conversation', preview(dmA) === dmTag, `(DM-with-B preview="${preview(dmA)}")`);

  // ---- Scorecard ----
  console.log('\n==== CHAT E2E SCORECARD ====');
  for (const [k,v] of Object.entries(results)) console.log(`  ${v.startsWith('PASS')?'✅':'❌'} ${k.padEnd(28)} ${v}`);
  const fails = Object.values(results).filter(v=>v.startsWith('FAIL')).length;
  console.log(`\n  ${fails===0?'ALL PASS ('+Object.keys(results).length+' checks)':fails+' FAILED of '+Object.keys(results).length}`);

  // cleanup
  for (const fn of [()=>A.chat.deleteConversation(dm.id), ()=>A.__adm && A.chat.deleteConversation(A.__adm.id)]) { try{await fn();}catch{} }

  if (fails > 0) process.exit(1);
} catch (e) {
  console.error('HARNESS ERROR:', e?.message || e);
  process.exit(2);
}
