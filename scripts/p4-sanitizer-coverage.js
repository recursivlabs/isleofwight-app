#!/usr/bin/env node
// P4(5) reproducer — re-derives docs/p4-staging-data-provenance.md from source.
//
//   git -C ../recursiv show origin/main:packages/server/src/db/schema.ts > /tmp/schema.ts
//   git -C ../recursiv show origin/main:scripts/sanitize-staging-data.sql > /tmp/sanitize.sql
//   node scripts/p4-sanitizer-coverage.js /tmp/schema.ts /tmp/sanitize.sql
//
// Exits 0 when every column below is covered, 1 when any is not. Today it exits 1.
//
// Both inputs are parsed, never assumed: an empty parse of either side aborts rather
// than reporting "nothing uncovered". A renamed script, a wrong ref or a missing -C all
// produce an empty side, and an empty side is what makes a bare zero meaningless.

const fs = require('fs');

const [schemaPath, sanitizePath] = process.argv.slice(2);
// The argv check lives in the CLI block below, not here: this file is also
// require()d by confirm-selftest.sh to build its fixtures, and exiting at import
// time would take the caller down with it.

// ---- parse schema.ts into (table, column) pairs -----------------------------
function parseSchema(src) {
  const pairs = [];
  const table = /pgTable\(\s*'([^']+)'\s*,\s*\{/g;
  let m;
  while ((m = table.exec(src))) {
    let depth = 0, end = -1;
    const open = table.lastIndex - 1;
    for (let j = open; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) { end = j; break; }
    }
    if (end < 0) continue;
    const body = src.slice(open + 1, end);
    const col = /(\w+)\s*:\s*[a-zA-Z]+\(\s*'([^']+)'/g;
    let c;
    while ((c = col.exec(body))) pairs.push([m[1], c[2]]);
  }
  return pairs;
}

// ---- parse the sanitizer into what it actually clears ------------------------
function parseSanitizer(sql) {
  const deleted = new Set();
  for (const m of sql.matchAll(/DELETE\s+FROM\s+"?(\w+)"?/gi)) deleted.add(m[1]);

  const updated = {};
  // UPDATE <table> SET <assignments> up to the terminating WHERE/;
  for (const m of sql.matchAll(/UPDATE\s+"?(\w+)"?\s+SET\b([\s\S]*?)(?=\bWHERE\b|;)/gi)) {
    const t = m[1];
    (updated[t] ||= new Set());
    for (const a of m[2].matchAll(/(?:^|,)\s*"?([a-z_]+)"?\s*=/gi)) updated[t].add(a[1]);
  }
  return { deleted, updated };
}

// Reading happens only in the CLI block at the bottom. Importing this file must
// not touch the filesystem or exit — confirm-selftest.sh require()s it purely to
// read the column lists when building its fixtures.
let pairs, deleted, updated, have, covered;

function load() {
  pairs = parseSchema(fs.readFileSync(schemaPath, 'utf8'));
  ({ deleted, updated } = parseSanitizer(fs.readFileSync(sanitizePath, 'utf8')));

  // Neither side may be empty — an empty side yields a meaningless zero.
  if (pairs.length === 0) { console.error('ABORT: schema parse produced 0 columns'); process.exit(2); }
  if (deleted.size === 0 && Object.keys(updated).length === 0) {
    console.error('ABORT: sanitizer parse produced 0 cleared columns'); process.exit(2);
  }

  have = new Set(pairs.map(([t, c]) => `${t}.${c}`));
  covered = (t, c) => deleted.has(t) || (updated[t] && updated[t].has(c));
}

// ---- the columns this row asserts must be cleared ---------------------------
// Hand-classified. A name-pattern sweep is not used as the answer: it swept in
// counters (ai_usage.input_tokens) and missed real ones (project_env_var.encrypted_value).
const CREDENTIALS = {
  organization_settings: ['gitlab_token', 'linear_api_key', 'jira_api_token', 'slack_bot_token',
    'asana_token', 'sync_webhook_secret', 'resend_api_key', 'stripe_secret_key',
    'stripe_webhook_secret', 'oauth_google_client_secret', 'oauth_github_client_secret',
    'posthog_api_key', 'custom_api_keys', 'coolify_api_token'],
  oauth_access_token: ['access_token', 'refresh_token'],
  encryption_user_device: ['encrypted_private_bundle', 'prf_salt', 'identity_public_key',
    'device_public_key', 'signing_public_key', 'credential_id'],
  oauth_application: ['client_secret'],
  account: ['password'],
  inbound_webhook: ['secret'],
  webhook_subscription: ['secret'],
  slack_installation: ['bot_token'],
  scim_token: ['token_hash', 'token_prefix'],
  ai_provider_config: ['api_key_encrypted'],
  project_env_var: ['encrypted_value'],
  push_notification_token: ['token'],
  email_unsubscribe_token: ['token'],
  pending_email_change: ['verification_token_hash'],
  slack_oauth_state: ['state_hash'],
  passkey: ['credential_id'],
};

const PERSONAL = {
  user: ['legacy_email', 'wallet_address', 'ban_reason'],
  organization_settings: ['jira_email', 'preferred_contact_email', 'branded_email_address'],
  login_history: ['ip_address', 'user_agent'],
  share: ['ip_address', 'user_agent'],
  network_lead: ['email', 'source_email_subject'],
  person_profile: ['phone', 'geo'],
  email_send: ['recipient_email'],
  email_suppression: ['email'],
  email_campaign: ['from_email'],
  email_unsubscribe_token: ['email'],
  invite_waitlist: ['email'],
  invite_code: ['invited_email'],
  business_transaction: ['customer_email'],
  pending_email_change: ['new_email'],
  user_settings: ['preferred_contact_email'],
  project_identity: ['sender_address'],
  bounty_escrow: ['funder_wallet_address', 'recipient_wallet'],
  bounty_wallet: ['wallet_address'],
  treasury_transaction: ['payer_wallet_address', 'recipient_wallet_address'],
};

// Exported so confirm-selftest.sh can synthesise a schema containing every named
// column. A hand-written fixture cannot serve as the positive control: any column
// it omits is reported stale, so the smallest honest fixture is the full list.
module.exports = { CREDENTIALS, PERSONAL };

function audit(group, label) {
  const missing = [], uncovered = [];
  for (const [t, cs] of Object.entries(group)) {
    for (const c of cs) {
      if (!have.has(`${t}.${c}`)) missing.push(`${t}.${c}`);
      else if (!covered(t, c)) uncovered.push(`${t}.${c}`);
    }
  }
  console.log(`\n${label}: ${uncovered.length} uncovered`);
  for (const u of uncovered) console.log(`  UNCOVERED  ${u}`);
  // A name that no longer exists means the schema moved under this list — that is a
  // reason to re-read it, not to quietly drop the column and shrink the count.
  if (missing.length) {
    console.log(`  STALE (not in schema — re-check, do not drop): ${missing.join(', ')}`);
  }
  return { uncovered: uncovered.length, missing: missing.length };
}

if (require.main !== module) {
  // Imported for its column lists only — nothing below should run.
  return;
}

if (!schemaPath || !sanitizePath) {
  console.error('usage: p4-sanitizer-coverage.js <schema.ts> <sanitize-staging-data.sql>');
  process.exit(2);
}
load();

const tables = new Set(pairs.map(([t]) => t));
console.log(`schema:    ${tables.size} tables, ${pairs.length} columns`);
console.log(`sanitizer: ${deleted.size} tables DELETEd, ${Object.keys(updated).length} tables UPDATEd`);

const a = audit(CREDENTIALS, 'TIER 1 — live credentials and key material');
const b = audit(PERSONAL, 'TIER 2 — personal data');

const total = a.uncovered + b.uncovered;
const stale = a.missing + b.missing;
console.log(`\nTOTAL UNCOVERED: ${total}`);
// Stale gates the exit as hard as uncovered does. A column this list names that
// no longer exists in the schema means the comparison silently stopped covering
// it — and since a stale entry contributes 0 to the uncovered count, a wholesale
// rename would otherwise report "0 uncovered" and PASS while checking nothing.
// That is the vacuous zero this cell exists to reject.
console.log(`STALE TOTAL: ${stale}`);
if (stale) console.log('  schema has moved under this list — re-read it; do not drop entries to shrink the count');
console.log(total === 0 && stale === 0 ? 'P4(5): PASS' : 'P4(5): NOT-DONE');
process.exit(total === 0 && stale === 0 ? 0 : 1);
