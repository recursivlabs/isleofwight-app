// Failure context for the production parity monitor (verify-parity.mjs).
//
// The monitor used to die with `PARITY ERROR: HTTP 500: Internal Server Error
// 500 ""` — no phase, no endpoint, no deployed commit. Root-causing the
// 2026-08-24..26 outage (minds#212 → recursiv#2580 → recursiv#2597) required
// correlating deploy timelines by hand each time, because a red run said
// nothing about WHICH of the ~16 calls failed or WHAT build answered it.
// A red run must be a self-contained artifact: phase + status + body +
// the /health commit of the exact host under test.

/** `https://api.minds.com/api/v1` → `https://api.minds.com/api/v1/health` */
export const healthUrl = (baseUrl) => `${baseUrl.replace(/\/+$/, '')}/health`;

/**
 * Health routes to try, most-specific first. The versioned route answers 200
 * on the dedicated Minds host but WITHOUT a `commit` field (observed in run
 * 32971196667), while the root route is the one the estate's countersign
 * checks read `commit` from — so fall back to the origin's `/health` when the
 * versioned body doesn't carry a commit.
 */
export const healthUrls = (baseUrl) => {
  const urls = [healthUrl(baseUrl)];
  const rootBase = baseUrl.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '');
  if (rootBase && rootBase !== baseUrl.replace(/\/+$/, '')) {
    urls.push(`${rootBase}/health`);
  }
  return urls;
};

/**
 * Best-effort read of the deployed commit from the host under test. Never
 * throws: the monitor is already failing when this runs, and a health probe
 * that breaks the error report would hide the original failure.
 */
export async function fetchDeployedCommit(baseUrl, fetchImpl = fetch) {
  let first = null;
  for (const url of healthUrls(baseUrl)) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
      let commit = null;
      try {
        commit = (await res.json())?.commit ?? null;
      } catch {
        // non-JSON health body — status alone still tells us the host answered
      }
      if (commit) return { status: res.status, commit };
      first ??= { status: res.status, commit: null };
    } catch (err) {
      first ??= { status: null, commit: null, error: err?.message || String(err) };
    }
  }
  return first ?? { status: null, commit: null, error: 'no health url derived' };
}

/**
 * One line naming everything a reader needs to act on a red run without
 * reconstructing it: the phase that threw, the error, and the build that
 * answered. Keeps the `PARITY ERROR` prefix existing log greps match.
 */
export function formatParityError({ phase, err, health }) {
  const status = err?.status ?? err?.statusCode ?? '';
  const body = JSON.stringify(err?.body ?? '');
  let deployed = 'deployed-commit=unknown';
  if (health) {
    if (health.commit) {
      deployed = `deployed-commit=${health.commit}`;
    } else if (health.status !== null && health.status !== undefined) {
      // The host answered but its health body names no commit — that is a
      // reporting gap on the host, not unreachability (run 32971196667
      // printed 'health-unreachable (status=200)', which misled).
      deployed = `deployed-commit=unreported (health status=${health.status})`;
    } else {
      deployed = `health-unreachable (${health.error})`;
    }
  }
  return `PARITY ERROR at phase [${phase}]: ${err?.message || err} ${status} ${body} ${deployed}`;
}
