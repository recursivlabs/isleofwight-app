// Diagnose (1) conversation unread_count and (2) community is_member, using
// real accounts against production. Dumps RAW response fields (SDK types may
// be incomplete).
import { Recursiv } from '@recursiv/sdk';

const BASE_URL = 'https://api.recursiv.io/api/v1';
const PROJECT_ID = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const ORG_ID = '019d517b-bb87-744d-92db-b3801dc15927';
const SCOPES = ['posts:read','posts:write','users:read','users:write','communities:read','communities:write','chat:read','chat:write','agents:read','agents:write','notifications:read','notifications:write','settings:read','tags:read','uploads:write'];
const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
const keyInput = (n) => ({ name: n, scopes: SCOPES, projectId: PROJECT_ID });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const J = (o) => JSON.stringify(o);

try {
  const a = await anon.auth.signInAndCreateKey({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }, keyInput('diagA-' + Date.now()));
  const sdkA = new Recursiv({ apiKey: a.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meA = (await sdkA.profiles.me()).data;

  const bEmail = `qa+diag${Date.now()}@recursiv.io`;
  const b = await anon.auth.signUpAndCreateKey({ email: bEmail, password: 'QaDiag12345!x', name: 'Diag B' }, keyInput('diagB-' + Date.now()));
  const sdkB = new Recursiv({ apiKey: b.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meB = (await sdkB.profiles.me()).data;
  console.log('A=', meA.username, '  B=', meB.username);

  // ---- (1) DM unread ----
  // A opens a DM to B and sends a message; B should see unread on that convo.
  const dm = (await sdkA.chat.dm({ user_id: meB.id, organization_id: ORG_ID })).data;
  await sdkA.chat.send({ conversation_id: dm.id, content: 'unread test ' + Date.now() });
  await sleep(1500);
  const convosB = (await sdkB.chat.conversations({ limit: 20, organization_id: ORG_ID })).data || [];
  console.log('\n[1] B conversations count:', convosB.length);
  for (const c of convosB.slice(0, 3)) {
    console.log('   conv fields:', J(Object.keys(c)));
    console.log('   unread?:', { unread_count: c.unread_count, unreadCount: c.unreadCount, unread: c.unread });
  }
  // The dedicated unread endpoint for comparison
  if (convosB[0]) {
    try { console.log('   chat.unreadCount(conv0):', J((await sdkB.chat.unreadCount(convosB[0].id)).data)); } catch (e) { console.log('   unreadCount err', e?.message); }
  }

  // ---- (2) Community is_member for a brand-new account ----
  const comms = (await sdkB.communities.list({ limit: 50 })).data || [];
  console.log('\n[2] B sees', comms.length, 'communities (B joined NONE)');
  for (const c of comms.slice(0, 8)) {
    console.log('   ', J({ name: c.name, is_member: c.is_member, isMember: c.isMember, member_count: c.member_count }));
  }

  // cleanup
  try { await sdkA.chat.deleteConversation(dm.id); } catch {}
} catch (err) {
  console.error('DIAG ERROR:', err?.message || err, err?.status || '', J(err?.body || ''));
  process.exit(1);
}
