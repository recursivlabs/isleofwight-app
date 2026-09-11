// Does posting to a public community auto-join you as a member?
import { Recursiv } from '@recursiv/sdk';
const BASE_URL = 'https://api.recursiv.io/api/v1';
const PROJECT_ID = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const ORG_ID = '019d517b-bb87-744d-92db-b3801dc15927';
const QA_COMMUNITY_ID = '386fd80a-0432-411f-8136-0518ba00f2c4'; // public
const SCOPES = ['posts:read','posts:write','users:read','users:write','communities:read','communities:write','chat:read','chat:write','agents:read','notifications:read','settings:read','tags:read','uploads:write'];
const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
const ki = (n) => ({ name: n, scopes: SCOPES, projectId: PROJECT_ID });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const isMember = async (sdk) => {
  const list = (await sdk.communities.list({ limit: 100 })).data || [];
  const c = list.find(x => x.id === QA_COMMUNITY_ID);
  return c?.is_member;
};
try {
  const c = await anon.auth.signUpAndCreateKey({ email: `qa+pj${Date.now()}@recursiv.io`, password: 'QaPost12345!x', name: 'PostJoin C' }, ki('pj-' + Date.now()));
  const sdk = new Recursiv({ apiKey: c.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  console.log('fresh account C, is_member(QA Community) BEFORE post:', await isMember(sdk));
  const post = (await sdk.posts.create({ content: 'autojoin test ' + Date.now(), community_id: QA_COMMUNITY_ID, organization_id: ORG_ID })).data;
  console.log('C posted to QA Community ->', post?.id);
  await sleep(1500);
  console.log('is_member(QA Community) AFTER post:', await isMember(sdk));
  // cleanup
  try { await sdk.posts.delete(post.id); } catch {}
  try { await sdk.communities.leave(QA_COMMUNITY_ID); } catch (e) { console.log('(leave after:', e?.message, ')'); }
} catch (err) {
  console.error('ERR:', err?.message || err, err?.status || '', JSON.stringify(err?.body||''));
  process.exit(1);
}
