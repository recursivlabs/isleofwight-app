// Comprehensive X/Bluesky basic real-time social parity check, two real
// accounts against production. Exercises the full loop and prints a scorecard.
import { Recursiv } from '@recursiv/sdk';
import { retryRateLimitedAuth } from './auth-rate-limit-retry.mjs';
import { fetchDeployedCommit, formatParityError } from './parity-failure-context.mjs';
// Post instance-split (2026-06-24), Minds prod = the DEDICATED api.minds.com,
// not the shared platform API. Overridable for ad-hoc runs.
const BASE_URL = process.env.PARITY_BASE_URL
  || process.env.EXPO_PUBLIC_RECURSIV_API_URL
  || 'https://api.minds.com/api/v1';
// Production remains the default for the existing production smoke. Staging
// MUST provide both ids: a staging URL with production tenant ids is not a
// staging test and can either false-fail or touch the wrong tenant.
const PROJECT_ID = process.env.EXPO_PUBLIC_RECURSIV_PROJECT_ID || '019d5190-f0c0-717e-a1bd-ef9c335292b9';
const ORG_ID = process.env.EXPO_PUBLIC_RECURSIV_ORG_ID || '019d517b-bb87-744d-92db-b3801dc15927';
const SCOPES = ['posts:read','posts:write','users:read','users:write','communities:read','communities:write','chat:read','chat:write','agents:read','agents:write','notifications:read','notifications:write','settings:read','tags:read','uploads:write'];
const anon = new Recursiv({ baseUrl: BASE_URL, timeout: 120000, allowNoKey: true });
const ki = (n) => ({ name: n, scopes: SCOPES, projectId: PROJECT_ID });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = {};
const mark = (k, ok, detail='') => { results[k] = ok ? `PASS ${detail}` : `FAIL ${detail}`; };
// Which call is in flight. On any throw the error report names it, so a red
// run says WHERE it died instead of a bare `HTTP 500 ""` (see 2026-08-25/26,
// where each of three distinct production faults produced the same blank line).
let phase = 'init';
const step = (name) => { phase = name; };

try {
  step('sign-in A + mint key');
  const a = await retryRateLimitedAuth(
    () => anon.auth.signInAndCreateKey(
      { email: process.env.QA_EMAIL, password: process.env.QA_PASSWORD },
      ki('pA-'+Date.now()),
    ),
    { log: (message) => console.warn(`::warning::${message}`) },
  );
  const A = new Recursiv({ apiKey: a.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  step('profiles.me A');
  const meA = (await A.profiles.me()).data;
  step('sign-up B + mint key');
  const b = await anon.auth.signUpAndCreateKey({ email:`qa+par${Date.now()}@recursiv.io`, password:'QaParity12345!x', name:'Parity B' }, ki('pB-'+Date.now()));
  const B = new Recursiv({ apiKey: b.apiKey, baseUrl: BASE_URL, timeout: 120000 });
  step('profiles.me B');
  const meB = (await B.profiles.me()).data;

  // 1. FEED: A posts -> B can fetch it
  step('post.create A');
  const post = (await A.posts.create({ content:'parity '+Date.now(), organization_id: ORG_ID })).data;
  await sleep(800);
  step('posts.list B');
  const feed = (await B.posts.list({ limit: 30, organization_id: ORG_ID })).data || [];
  mark('feed_post_visible', feed.some(p => p.id === post.id), '(B sees A\'s post)');

  // 2-5. ENGAGEMENT from B on A
  step('follow B→A');
  await B.profiles.follow(meA.id);
  step('react B on post');
  await B.posts.react(post.id, 'upvote');
  step('reply B→A post');
  const reply = (await B.posts.create({ content:'nice', reply_to_id: post.id, organization_id: ORG_ID })).data;
  step('repost B of A post');
  const repost = (await B.posts.create({ content:'', reposted_from_id: post.id, organization_id: ORG_ID })).data;

  // REPLY visible on A's post
  await sleep(800);
  step('post.get A');
  const detail = (await A.posts.get(post.id)).data;
  mark('reply_visible', (detail.replies||[]).some(r => r.id === reply.id) || (detail.reply_count||0) >= 1, '(reply on post)');

  // COUNTS
  step('profiles.getByUsername A');
  const meAafter = (await A.profiles.getByUsername(meA.username)).data;
  mark('follower_count', (meAafter.followers_count ?? meAafter.followersCount ?? 0) >= 1);
  mark('repost_count', (detail.reposts_count ?? 0) >= 1);
  mark('vote_count', (detail.score ?? detail.vote_count ?? 0) >= 1);

  // 6. DM unread: A DMs B -> B's conversation list shows unread_count
  step('chat.dm A→B');
  const dm = (await A.chat.dm({ user_id: meB.id, organization_id: ORG_ID })).data;
  step('chat.send A');
  await A.chat.send({ conversation_id: dm.id, content: 'hey' });
  await sleep(1500);
  step('chat.conversations B');
  const convosB = (await B.chat.conversations({ limit: 20, organization_id: ORG_ID })).data || [];
  const dmConv = convosB.find(cv => cv.id === dm.id);
  mark('dm_unread', (dmConv?.unread_count ?? 0) >= 1, `(unread_count=${dmConv?.unread_count})`);

  // 7. NOTIFICATIONS: A should have follow + reaction + reply + repost
  let types = [];
  step('notifications.list A');
  for (let i=0;i<6;i++){ await sleep(2000); types = ((await A.notifications.list({limit:40})).data||[]).map(n=>(n.targetType||n.target_type||'').toLowerCase()); if (types.length>=3) break; }
  mark('notif_follow', types.some(t=>t.includes('follow')));
  mark('notif_vote', types.some(t=>t.includes('reaction')||t.includes('vote')));
  mark('notif_reply', types.some(t=>t.includes('reply')));
  mark('notif_repost', types.some(t=>t.includes('repost')));

  console.log('\n==== X/BLUESKY BASIC PARITY SCORECARD ====');
  for (const [k,v] of Object.entries(results)) console.log(`  ${v.startsWith('PASS')?'✅':'❌'} ${k.padEnd(20)} ${v}`);
  const fails = Object.values(results).filter(v=>v.startsWith('FAIL')).length;
  console.log(`\n  ${fails===0?'ALL PASS':fails+' FAILED'} (${Object.keys(results).length} checks)`);

  // cleanup
  step('cleanup');
  for (const fn of [()=>B.profiles.unfollow(meA.id),()=>B.posts.delete(reply.id),()=>B.posts.delete(repost.id),()=>A.posts.delete(post.id),()=>A.chat.deleteConversation(dm.id)]) { try{await fn();}catch{} }

  // Non-zero exit on any failed check, so CI / synthetic monitoring alerts.
  if (fails > 0) process.exit(1);
} catch (err) {
  const status = err?.status ?? err?.statusCode;
  const detail = `${err?.message || ''} ${JSON.stringify(err?.body || '')}`;
  // HTTP 402 is the QA account's billing running dry, not the product
  // breaking. This monitor spent time red on a 402 and the team read it as a
  // product outage. Report it as INFRA, distinctly, and do NOT alert.
  const isCreditExhaustion =
    status === 402 || /payment required|credit(s)? (used up|exhausted|balance)|out of credits/i.test(detail);
  if (isCreditExhaustion) {
    console.warn(`::warning::INFRA: QA account out of credits (billing), not a product failure`);
    console.warn(`PARITY SKIPPED (billing): ${err?.message || err} ${status || ''}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### PARITY-INFRA-BILLING\nQA account hit HTTP 402 (credits exhausted). Parity was **not** exercised; this is a billing outage, not a product failure. Top up the QA account.\n`,
      );
    }
    process.exit(0);
  }
  // Bind the failure to the build that answered it: fetch the commit from
  // the same BASE_URL the failing calls used (best-effort, never throws).
  const health = await fetchDeployedCommit(BASE_URL);
  console.error(formatParityError({ phase, err, health }));
  process.exit(1);
}
