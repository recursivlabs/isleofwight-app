// End-to-end verification of the social notification pipeline with two real
// accounts. Account B follows / votes / reposts on Account A's content, then we
// read Account A's notifications to confirm each one actually fired.
import { Recursiv } from '@recursiv/sdk';

const BASE_URL = 'https://api.recursiv.io/api/v1';
const PROJECT_ID = '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const ORG_ID = '019d517b-bb87-744d-92db-b3801dc15927';
const SCOPES = [
  'posts:read', 'posts:write', 'users:read', 'users:write',
  'communities:read', 'communities:write', 'chat:read', 'chat:write',
  'agents:read', 'agents:write', 'notifications:read', 'notifications:write',
  'settings:read', 'tags:read', 'uploads:write',
];

const QA_EMAIL = process.env.QA_EMAIL;
const QA_PASSWORD = process.env.QA_PASSWORD;
const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
const keyInput = (name) => ({ name, scopes: SCOPES, projectId: PROJECT_ID });
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // 1. Account A (existing QA account)
  const a = await anon.auth.signInAndCreateKey({ email: QA_EMAIL, password: QA_PASSWORD }, keyInput('verify-A-' + Date.now()));
  const sdkA = new Recursiv({ apiKey: a.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meA = (await sdkA.profiles.me()).data;
  log('A =', meA.username, meA.id);

  // 2. Account B (fresh signup)
  const bEmail = `qa+verify${Date.now()}@recursiv.io`;
  const b = await anon.auth.signUpAndCreateKey(
    { email: bEmail, password: 'QaVerify12345!x', name: 'Verify B' },
    keyInput('verify-B-' + Date.now()),
  );
  const sdkB = new Recursiv({ apiKey: b.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  const meB = (await sdkB.profiles.me()).data;
  log('B =', meB.username, meB.id);

  // 3. A posts something for B to act on
  const post = (await sdkA.posts.create({ content: `realtime verify ${Date.now()}`, organization_id: ORG_ID })).data;
  log('A posted', post.id);
  await sleep(500);

  // 4. B follows A, votes on A's post, reposts A's post
  await sdkB.profiles.follow(meA.id); log('B followed A');
  await sdkB.posts.react(post.id, 'upvote'); log('B upvoted A post');
  const repost = (await sdkB.posts.create({ content: '', reposted_from_id: post.id, organization_id: ORG_ID })).data;
  log('B reposted A post ->', repost.id);

  // 5. Poll A's notifications over ~12s (async Redis-stream consumer).
  let notifs = [];
  let notifsNoOrg = [];
  for (let i = 0; i < 6; i++) {
    await sleep(2000);
    notifs = (await sdkA.notifications.list({ limit: 30, organization_id: ORG_ID })).data || [];
    notifsNoOrg = (await sdkA.notifications.list({ limit: 30 })).data || [];
    log(`poll ${i}: withOrg=${notifs.length} noOrg=${notifsNoOrg.length}`);
    if (notifsNoOrg.length > 0) break;
  }
  log('\n--- raw notifications (no org filter) ---');
  for (const n of notifsNoOrg.slice(0, 6)) {
    log(JSON.stringify({ type: n.targetType || n.target_type || n.type, org: n.organizationId || n.organization_id, status: n.status, title: n.title }));
  }
  const types = notifsNoOrg.map((n) => (n.targetType || n.target_type || n.type || '').toLowerCase());
  log('\nA notifications types:', JSON.stringify(types));

  const has = (kw) => types.some((t) => t.includes(kw));
  const followN = has('follow');
  const reactN = has('reaction') || has('vote') || has('like');
  const repostN = has('repost');

  const meAafter = (await sdkA.profiles.getByUsername(meA.username)).data;
  const followers = meAafter.followers_count ?? meAafter.followersCount ?? '?';
  const postAfter = (await sdkA.posts.get(post.id)).data;
  const repostsCount = postAfter.reposts_count ?? postAfter.repostsCount ?? '?';
  const isFollowing = (await sdkB.profiles.isFollowing(meA.id)).data?.is_following;

  log('\n==== RESULTS ====');
  log('follow notification :', followN ? 'PASS' : 'FAIL');
  log('vote notification   :', reactN ? 'PASS' : 'FAIL');
  log('repost notification :', repostN ? 'PASS' : 'FAIL');
  log('A followers_count   :', followers, followers >= 1 ? '(PASS)' : '(FAIL)');
  log('post reposts_count  :', repostsCount, repostsCount >= 1 ? '(PASS)' : '(FAIL)');
  log('B isFollowing A     :', isFollowing ? 'PASS' : 'FAIL');

  // Cleanup: B unfollows + delete repost + A deletes post (best effort)
  try { await sdkB.profiles.unfollow(meA.id); } catch {}
  try { await sdkB.posts.delete(repost.id); } catch {}
  try { await sdkA.posts.delete(post.id); } catch {}
} catch (err) {
  console.error('VERIFY ERROR:', err?.message || err, err?.status || '', err?.body || '');
  process.exit(1);
}
