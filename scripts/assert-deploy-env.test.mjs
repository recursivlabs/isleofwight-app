import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDeployEnv } from './assert-deploy-env.mjs';

const stagingEnv = {
  COOLIFY_FQDN: 'minds-staging.on.minds.io',
  EXPO_PUBLIC_RECURSIV_API_URL: 'https://api.staging.recursiv.io/api/v1',
  EXPO_PUBLIC_RECURSIV_ORG_ID: '019fd8e0-e381-728f-9565-f16dacf27b4f',
  EXPO_PUBLIC_RECURSIV_PROJECT_ID: '019fd8e0-e4e9-703a-b259-8cbb8519d9cb',
  EXPO_PUBLIC_SITE_URL: 'https://staging.terrapin.minds.com',
};

test('accepts the staging host only with staging API and tenant bindings', () => {
  assert.doesNotThrow(() => assertDeployEnv(stagingEnv));
});

test('rejects staging builds that would use production fallbacks', () => {
  assert.throws(
    () => assertDeployEnv({ COOLIFY_FQDN: 'minds-staging.on.minds.io' }),
    /Refusing staging build with unsafe environment/,
  );
});

test('does not change the existing production fallback contract', () => {
  assert.doesNotThrow(() => assertDeployEnv({ COOLIFY_FQDN: 'minds.on.minds.io' }));
});
