/**
 * Settings audit — flip every control, reload, and check it survived.
 *
 *   npm i -D playwright && npx playwright install chromium   # once
 *   QA_MINDS_EMAIL=... QA_MINDS_PASSWORD=... node scripts/settings-audit.mjs
 *
 * Playwright is deliberately NOT a dependency of this app: this runs by hand
 * before a settings change ships, not in the app's install.
 *
 * WHY A RELOAD IS THE WHOLE TEST. The bug that prompted this reported success
 * and then reverted -- the request 200'd and wrote nothing, because the client
 * sent field names the API drops rather than rejects. Any check that stops at
 * the click passes while the setting is silently broken. So every row here
 * flips the control, reloads the screen, and then reads what the ACCOUNT holds
 * straight from the API, never grading the screen against itself.
 *
 * "NOT ON ACCOUNT" means the API has no field for that setting yet, so it can
 * only be device-local. That is a real result, not a skip.
 */
import { chromium } from 'playwright';

const URL = process.env.APP_URL || 'http://localhost:8081';
const API = 'https://api.minds.com/api/v1';
const OUT = process.env.OUT || '.';

const b = await chromium.launch({ args: ['--disable-web-security'] });
const p = await (await b.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();

await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await p.waitForTimeout(20000);
const link = p.getByText('Log in with password', { exact: false }).first();
if (await link.count()) { await link.click(); await p.waitForTimeout(2500); }
await p.locator('input[type="email"], input[placeholder*="mail" i]').first().fill(process.env.QA_MINDS_EMAIL);
const pw = p.locator('input[type="password"]').first();
await pw.fill(process.env.QA_MINDS_PASSWORD);
await pw.press('Enter');
await p.waitForTimeout(15000);

const openTab = async (name) => {
  await p.goto(`${URL}/settings`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(6000);
  const all = p.getByText(name, { exact: true });
  for (let i = 0; i < await all.count(); i++) {
    const box = await all.nth(i).boundingBox();
    if (box && box.x > 380) { await all.nth(i).click(); break; }  // skip the SideNav copy
  }
  await p.waitForTimeout(3500);
};

// Read straight from the API so the check never grades the screen against itself.
const account = () => p.evaluate(async (api) => {
  const k = localStorage.getItem('minds:api_key');
  const key = (() => { try { return JSON.parse(k); } catch { return k; } })();
  const r = await fetch(`${api}/settings/preferences`, { headers: { Authorization: `Bearer ${key}` } });
  return (await r.json())?.data;
}, API);

const rows = [];
const record = (name, before, after, stored, note = '') =>
  rows.push({ name, pass: before !== after && after === stored, before, after, stored, note });

// ── switches, addressed by their row label ──
const flipSwitch = async (tab, label, read) => {
  await openTab(tab);
  const row = p.locator('[role="switch"]');
  const n = await row.count();
  let idx = -1;
  for (let i = 0; i < n; i++) {
    const box = await row.nth(i).boundingBox();
    // exact: the AI row's label is also a substring of the row above it
    // ("Set up your personal AI agent"), which anchored the search at the
    // wrong y and reported the control missing.
    const near = await p.getByText(label, { exact: true }).first().boundingBox().catch(() => null);
    if (box && near && Math.abs(box.y - near.y) < 30) { idx = i; break; }
  }
  if (idx < 0) { rows.push({ name: label, pass: false, note: 'control not found' }); return; }
  const state = async () => (await p.locator('[role="switch"]').nth(idx).getAttribute('aria-checked')) === 'true';
  const before = await state();
  await p.locator('[role="switch"]').nth(idx).click();
  await p.waitForTimeout(4500);
  const after = await state();
  await openTab(tab);
  const reloaded = await p.locator('[role="switch"]').nth(idx).getAttribute('aria-checked') === 'true';
  const acct = await account();
  const stored = read ? read(acct) : reloaded;
  record(label, before, after, stored, reloaded === after ? '' : 'screen disagrees after reload');
};

await flipSwitch('Privacy', 'Public profile', (a) => a?.privacy?.profile_visibility === 'public');
await flipSwitch('Privacy', 'Show email on profile', (a) => a?.privacy?.show_email);
await flipSwitch('Notifications', 'In-app notifications', (a) => a?.notifications?.in_app);
await flipSwitch('Notifications', 'Push notifications', (a) => a?.notifications?.push);
await flipSwitch('Notifications', 'Email notifications', (a) => a?.notifications?.email);
await flipSwitch('Feed & content', 'Show NSFW content', (a) => a?.content?.show_nsfw);
await flipSwitch('Feed & content', 'Autoplay videos', (a) => a?.content?.autoplay_video);
await flipSwitch('AI agent', 'Personal AI agent', (a) => a?.content?.ai_enabled);

// ── theme, a three-way picker rather than a switch ──
await openTab('Appearance');
const beforeTheme = (await account())?.appearance?.theme;
const target = beforeTheme === 'dark' ? 'light' : 'dark';
const opt = p.getByText(target, { exact: true }).first();   // DOM text is lowercase; CSS capitalises it
if (await opt.count()) { await opt.click(); await p.waitForTimeout(5000); }
const storedTheme = (await account())?.appearance?.theme;
record('Theme', beforeTheme, target, storedTheme);

// ── default feed, a two-way picker ──
await openTab('Feed & content');
const beforeFeed = (await account())?.content?.default_feed;
const wantFeed = beforeFeed === 'following' ? 'For you' : 'Following';
const fopt = p.getByText(wantFeed, { exact: true }).first();
if (await fopt.count()) { await fopt.click(); await p.waitForTimeout(4500); }
const storedFeed = (await account())?.content?.default_feed;
record('Default feed', beforeFeed, wantFeed.toLowerCase().replace(' ', ''), storedFeed);

console.log('\n  SETTING                        FLIPPED   ACCOUNT HOLDS   RESULT');
console.log('  ' + '-'.repeat(68));
for (const r of rows) {
  const res = r.pass ? 'PASS' : (r.stored === undefined ? 'NOT ON ACCOUNT' : 'FAIL');
  console.log(`  ${String(r.name).padEnd(30)} ${String(r.before)}->${String(r.after)}`.padEnd(48)
    + `${String(r.stored).padEnd(15)} ${res} ${r.note}`);
}
const passed = rows.filter(r => r.pass).length;
console.log(`\n  ${passed}/${rows.length} settings persist to the account\n`);
await p.screenshot({ path: `${OUT}/settings-audit.png` });
await b.close();
