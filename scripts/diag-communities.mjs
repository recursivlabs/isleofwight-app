// Inspect QA/Support community membership to see HOW jack-minds-fresh got in.
import { Recursiv } from '@recursiv/sdk';
const BASE_URL = 'https://api.recursiv.io/api/v1';
const PROJECT_ID = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const SCOPES = ['posts:read','users:read','communities:read','communities:write','chat:read','agents:read','notifications:read','settings:read','tags:read'];
const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
try {
  const a = await anon.auth.signInAndCreateKey({ email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD }, { name: 'diagC-' + Date.now(), scopes: SCOPES, projectId: PROJECT_ID });
  const sdk = new Recursiv({ apiKey: a.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const comms = (await sdk.communities.list({ limit: 100 })).data || [];
  const targets = comms.filter(c => /QA Community|Support|QA Test/i.test(c.name));
  for (const c of targets) {
    console.log(`\n=== ${c.name} (${c.id}) ===`);
    console.log('  created_by:', c.created_by?.username || c.created_by?.name, '| member_count:', c.member_count, '| privacy:', c.privacy);
    try {
      const members = (await sdk.communities.members(c.id, { limit: 50 })).data || [];
      for (const m of members) {
        console.log(`   - @${m.username} (${m.name})  role=${m.role}  ai=${m.is_ai}  joined=${m.joined_at}`);
      }
    } catch (e) { console.log('   members err:', e?.message); }
  }
} catch (err) {
  console.error('ERR:', err?.message || err, err?.status || '');
  process.exit(1);
}
