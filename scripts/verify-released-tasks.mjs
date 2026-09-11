#!/usr/bin/env node
// Second-party verifier for released dispatcher rows.
//
// The controller (docs/goal-prompt.md §1.3) says a worker never closes its own
// task: it releases with evidence, and a different party re-fetches that
// evidence and calls done. In practice nobody did. On 2026-08-26, 67 rows that
// Bill's agents had released with merged PRs behind them sat in_progress for
// days, and the launch ladder counter could not move.
//
// This script is that different party, on a schedule. For every in_progress
// task whose last claim was released as "completed" with PR URLs attached, it
// proves three things from live sources, then claims the row as the verifier
// agent and marks it done with the evidence in the notes:
//
//   1. every PR is merged;
//   2. every merge commit is an ancestor of main in its repo;
//   3. the live surface serves a commit that contains that merge
//      (minds repo -> the web origin's /healthz, recursiv repo -> the
//      dedicated API's /health).
//
// Anything short of that is left alone with a printed reason. This is an
// artifact-level check, not a product check: it never opens a browser.
import { pathToFileURL } from 'node:url';

export const DEFAULTS = Object.freeze({
  origin: 'https://api.minds.com',
  orgId: '019d517b-bb87-744d-92db-b3801dc15927',
  agent: 'verifier-ci',
  webHealthz: 'https://minds.on.minds.io/healthz',
  apiHealth: 'https://api.minds.com/health',
  maxPerRun: 20,
});

const PR_URL = /^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)\/?$/;

export function parsePrUrl(url) {
  const match = PR_URL.exec(String(url ?? '').trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}

/** Rows a second party can act on: released as completed, with PR evidence, no live claim. */
export function selectReleased(tasks) {
  return (tasks ?? []).filter(
    (task) =>
      task &&
      task.status === 'in_progress' &&
      task.claim_status === 'released' &&
      task.release_reason === 'completed' &&
      Array.isArray(task.pr_urls) &&
      task.pr_urls.length > 0 &&
      task.pr_urls.every((url) => parsePrUrl(url)),
  );
}

async function readJson(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

/** "HTTP 403 (Resource not accessible by personal access token)" beats a bare status. */
function httpFailure(result) {
  const message = typeof result.body?.message === 'string' ? result.body.message.replace(/\s+/g, ' ').slice(0, 120) : '';
  return `HTTP ${result.status}${message ? ` (${message})` : ''}`;
}

function githubHeaders(token) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'minds-verify-released' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** "identical" or "behind" from GitHub's compare means `sha` is already inside `base`. */
async function containedIn(fetchImpl, token, owner, repo, base, sha) {
  const result = await readJson(
    fetchImpl,
    `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${sha}`,
    { headers: githubHeaders(token) },
  );
  if (!result.ok) return { ok: false, reason: `compare ${base}...${sha.slice(0, 8)} -> ${httpFailure(result)}` };
  const status = result.body?.status;
  return { ok: status === 'identical' || status === 'behind', reason: `compare status=${status}` };
}

async function liveCommitFor(fetchImpl, url) {
  try {
    const result = await readJson(fetchImpl, url);
    const commit = result.body?.commit;
    return typeof commit === 'string' && /^[0-9a-f]{7,40}$/.test(commit) ? commit : null;
  } catch {
    return null;
  }
}

/**
 * Verify one PR: merged, on main, and contained in the live commit for its repo.
 * Returns { ok, evidence, reason }.
 */
export async function verifyPr(url, ctx) {
  const pr = parsePrUrl(url);
  if (!pr) return { ok: false, reason: `not a GitHub PR URL: ${url}` };
  const { fetchImpl, token } = ctx;
  const detail = await readJson(fetchImpl, `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`, {
    headers: githubHeaders(token),
  });
  if (!detail.ok) return { ok: false, reason: `${url}: ${httpFailure(detail)} reading the PR` };
  if (!detail.body?.merged) return { ok: false, reason: `${url}: not merged` };
  const mergeSha = detail.body.merge_commit_sha;
  if (!mergeSha) return { ok: false, reason: `${url}: merged but no merge commit reported` };

  const onMain = await containedIn(fetchImpl, token, pr.owner, pr.repo, 'main', mergeSha);
  if (!onMain.ok) return { ok: false, reason: `${url}: merge ${mergeSha.slice(0, 8)} not on main (${onMain.reason})` };

  const liveUrl = ctx.liveFor(pr.repo);
  if (!liveUrl) {
    return {
      ok: true,
      evidence: `${url} merged as ${mergeSha.slice(0, 8)}, on ${pr.repo} main (no live surface mapped for this repo)`,
    };
  }
  const live = await liveCommitFor(fetchImpl, liveUrl);
  if (!live) return { ok: false, reason: `${url}: merged, but ${liveUrl} reports no commit` };
  const deployed = await containedIn(fetchImpl, token, pr.owner, pr.repo, live, mergeSha);
  if (!deployed.ok) {
    return { ok: false, reason: `${url}: merged as ${mergeSha.slice(0, 8)}, awaiting deploy (${liveUrl} serves ${live.slice(0, 8)})` };
  }
  return {
    ok: true,
    evidence: `${url} merged as ${mergeSha.slice(0, 8)}, on main, live (${liveUrl} serves ${live.slice(0, 8)} which contains it)`,
  };
}

export async function verifyTask(task, ctx) {
  const evidence = [];
  for (const url of task.pr_urls) {
    const result = await verifyPr(url, ctx);
    if (!result.ok) return { ok: false, reason: result.reason };
    evidence.push(result.evidence);
  }
  return { ok: true, evidence };
}

function dispatcherHeaders(key) {
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

export async function run({ env = process.env, fetchImpl = fetch, log = console.log, now = () => new Date() } = {}) {
  const key = env.MINDS_NETWORK_API_KEY;
  if (!key) {
    log('MINDS_NETWORK_API_KEY is not set; nothing verified.');
    return { ok: false, verified: [], skipped: [], reason: 'missing MINDS_NETWORK_API_KEY' };
  }
  const origin = env.MINDS_ORIGIN || DEFAULTS.origin;
  const orgId = env.MINDS_ORG_ID || DEFAULTS.orgId;
  const agent = env.VERIFIER_AGENT || DEFAULTS.agent;
  const dryRun = env.VERIFY_DRY_RUN === '1' || env.VERIFY_DRY_RUN === 'true';
  const maxPerRun = Number(env.VERIFY_MAX || DEFAULTS.maxPerRun);
  const token = env.GH_TOKEN || env.GITHUB_TOKEN || '';
  const liveFor = (repo) => {
    if (repo === 'minds') return env.MINDS_WEB_HEALTHZ || DEFAULTS.webHealthz;
    if (repo === 'recursiv') return env.MINDS_API_HEALTH || DEFAULTS.apiHealth;
    return null;
  };
  const ctx = { fetchImpl, token, liveFor };
  log(`github token: ${token ? 'present' : 'absent'}`);

  const listUrl = `${origin}/api/v1/dispatcher/tasks?status=in_progress&limit=200&organization_id=${encodeURIComponent(orgId)}`;
  const listed = await readJson(fetchImpl, listUrl, { headers: dispatcherHeaders(key) });
  if (!listed.ok) {
    log(`dispatcher list failed: HTTP ${listed.status}`);
    return { ok: false, verified: [], skipped: [], reason: `dispatcher HTTP ${listed.status}` };
  }
  const tasks = Array.isArray(listed.body?.data) ? listed.body.data : [];
  // The list endpoint carries release_reason but not the claim status or the
  // PR URLs; only the per-task read does. Prefilter on what the list has,
  // then read each candidate in full before judging it.
  const prefiltered = tasks.filter((task) => task && task.status === 'in_progress' && task.release_reason === 'completed');
  const details = [];
  for (const task of prefiltered) {
    const detail = await readJson(fetchImpl, `${origin}/api/v1/dispatcher/tasks/${task.id}?organization_id=${encodeURIComponent(orgId)}`, {
      headers: dispatcherHeaders(key),
    });
    if (detail.ok && detail.body?.data) details.push(detail.body.data);
    else log(`SKIP ${task.id}: detail read -> HTTP ${detail.status}`);
  }
  const candidates = selectReleased(details);
  log(`${tasks.length} in_progress rows, ${prefiltered.length} released as completed, ${candidates.length} with PR evidence${dryRun ? ' (dry run)' : ''}`);

  const verified = [];
  const skipped = [];
  for (const task of candidates.slice(0, maxPerRun)) {
    const result = await verifyTask(task, ctx);
    if (!result.ok) {
      skipped.push({ id: task.id, reason: result.reason });
      log(`SKIP ${task.id}: ${result.reason}`);
      continue;
    }
    const notes = [
      `VERIFIED by ${agent} (second party, ${now().toISOString().slice(0, 10)}).`,
      ...result.evidence.map((line) => `- ${line}`),
      'Artifact-level check (merge on main + live commit contains it). No browser pass.',
    ].join('\n');
    if (dryRun) {
      verified.push({ id: task.id, notes, dryRun: true });
      log(`WOULD COMPLETE ${task.id}`);
      continue;
    }
    const claim = await readJson(fetchImpl, `${origin}/api/v1/dispatcher/tasks/${task.id}/claim`, {
      method: 'POST',
      headers: dispatcherHeaders(key),
      body: JSON.stringify({ agent, organization_id: orgId }),
    });
    if (!claim.ok) {
      skipped.push({ id: task.id, reason: `claim -> HTTP ${claim.status}` });
      log(`SKIP ${task.id}: claim -> HTTP ${claim.status}`);
      continue;
    }
    const done = await readJson(fetchImpl, `${origin}/api/v1/dispatcher/done/${task.id}`, {
      method: 'POST',
      headers: dispatcherHeaders(key),
      body: JSON.stringify({ agent, notes, organization_id: orgId }),
    });
    if (!done.ok) {
      skipped.push({ id: task.id, reason: `done -> HTTP ${done.status}` });
      log(`SKIP ${task.id}: done -> HTTP ${done.status} (claim left for a human)`);
      continue;
    }
    verified.push({ id: task.id, notes });
    log(`COMPLETED ${task.id}`);
  }
  if (candidates.length > maxPerRun) {
    log(`${candidates.length - maxPerRun} more released rows wait for the next run (VERIFY_MAX=${maxPerRun})`);
  }
  log(`verified=${verified.length} skipped=${skipped.length}`);
  return { ok: true, verified, skipped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().then((result) => {
    process.exit(result.ok ? 0 : 1);
  });
}
