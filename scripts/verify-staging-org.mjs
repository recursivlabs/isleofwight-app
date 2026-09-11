#!/usr/bin/env node
// P4.2 verifier: prove the org compiled into the staging app resolves on the
// staging API itself. This is an artifact command, not application transport;
// the product continues to use @recursiv/sdk exclusively.
import { pathToFileURL } from 'node:url';
import { Recursiv } from '@recursiv/sdk';
import { retryRateLimitedAuth } from './auth-rate-limit-retry.mjs';

const REQUIRED_ENV = [
  'STAGING_QA_EMAIL',
  'STAGING_QA_PASSWORD',
  'STAGING_ORG_ID',
  'STAGING_PROJECT_ID',
];

export function safeErrorSummary(error, secrets = []) {
  const record = error && typeof error === 'object' ? error : {};
  const redact = (value) => {
    let output = String(value ?? '');
    for (const secret of secrets) {
      if (secret) output = output.replaceAll(String(secret), '<redacted>');
    }
    return output.replace(/[\r\n]+/g, ' ').slice(0, 500);
  };
  const fields = [];
  const name = redact(record.name || (error instanceof Error ? error.name : 'Error'));
  const message = redact(record.message || (typeof error === 'string' ? error : ''));
  if (name) fields.push(`name=${name}`);
  if (Number.isFinite(record.status)) fields.push(`status=${record.status}`);
  if (record.code) fields.push(`code=${redact(record.code)}`);
  if (Number.isFinite(record.retryAfter)) fields.push(`retry_after=${record.retryAfter}`);
  if (message) fields.push(`message=${message}`);
  return fields.join(' ') || 'name=Error message=<unavailable>';
}

export async function verifyStagingOrg({
  env = process.env,
  RecursivImpl = Recursiv,
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(`missing required environment: ${missing.join(', ')}`);
  }

  const baseUrl = env.STAGING_BASE_URL || 'https://api.staging.recursiv.io/api/v1';
  const parsedBase = new URL(baseUrl);
  if (parsedBase.protocol !== 'https:' || parsedBase.hostname !== 'api.staging.recursiv.io') {
    throw new Error(`refusing non-staging API origin: ${parsedBase.origin}`);
  }

  const orgId = env.STAGING_ORG_ID;
  const requestUrl = `${baseUrl.replace(/\/$/, '')}/organizations/${orgId}`;
  const anonymous = new RecursivImpl({ baseUrl, timeout: 30_000, allowNoKey: true });
  const auth = await retryRateLimitedAuth(
    () => anonymous.auth.signInAndCreateKey(
      { email: env.STAGING_QA_EMAIL, password: env.STAGING_QA_PASSWORD },
      {
        name: `p4-org-proof-${Date.now()}`,
        scopes: ['organizations:read'],
        projectId: env.STAGING_PROJECT_ID,
      },
    ),
    {
      log: (message) => log(`::warning::${message}`),
    },
  );
  const scoped = new RecursivImpl({ apiKey: auth.apiKey, baseUrl, timeout: 30_000 });
  let row;
  try {
    const authenticatedUserId = auth.user?.id;
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(authenticatedUserId ?? '')) {
      throw new Error('staging sign-in did not return a valid authenticated user id');
    }
    // A user UUID is not a credential. Printing it binds the staging proof to
    // the exact secret-backed identity without exposing the email or password,
    // and lets an independent DB operation select that row without guessing.
    log(`authenticated.user.id=${authenticatedUserId}`);

    const response = await fetchImpl(requestUrl, {
      headers: { Authorization: `Bearer ${auth.apiKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    row = payload?.data ?? payload;

    log(`$ GET ${requestUrl} (Authorization: Bearer <redacted>)`);
    log(`HTTP ${response.status}`);
    log(`configured.id=${orgId}`);
    log(`response.id=${row?.id ?? '<missing>'}`);

    if (response.status !== 200) {
      throw new Error(`staging organization lookup returned HTTP ${response.status}`);
    }
    if (row?.id !== orgId) {
      throw new Error(`staging organization id mismatch: expected ${orgId}, received ${row?.id ?? '<missing>'}`);
    }
  } finally {
    // A proof that leaks one persistent key per run is not a passing proof.
    // Keep PASS after this call so cleanup failure cannot spoof the predicate.
    await scoped.auth.revokeCurrentKey();
  }
  log('P4.2 STAGING ORG BINDING PASS');
  return row;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  verifyStagingOrg().catch((error) => {
    console.error(
      `P4.2 STAGING ORG BINDING FAIL: ${safeErrorSummary(error, [
        process.env.STAGING_QA_EMAIL,
        process.env.STAGING_QA_PASSWORD,
      ])}`,
    );
    process.exitCode = 1;
  });
}
