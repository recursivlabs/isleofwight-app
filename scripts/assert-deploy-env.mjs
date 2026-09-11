const STAGING_API_URL = 'https://api.staging.recursiv.io/api/v1';
const STAGING_ORG_ID = '019fd8e0-e381-728f-9565-f16dacf27b4f';
const STAGING_PROJECT_ID = '019fd8e0-e4e9-703a-b259-8cbb8519d9cb';

function isStagingHost(value = '') {
  return /(^|[./-])staging([./-]|$)/i.test(value);
}

/**
 * Fail the web build when a staging deployment would silently bake production
 * API or tenant defaults into its public bundle.
 */
export function assertDeployEnv(env = process.env) {
  const hostSignals = [env.COOLIFY_FQDN, env.COOLIFY_URL, env.EXPO_PUBLIC_SITE_URL]
    .filter(Boolean)
    .join(' ');

  if (!isStagingHost(hostSignals)) return;

  const expected = {
    EXPO_PUBLIC_RECURSIV_API_URL: STAGING_API_URL,
    EXPO_PUBLIC_RECURSIV_ORG_ID: STAGING_ORG_ID,
    EXPO_PUBLIC_RECURSIV_PROJECT_ID: STAGING_PROJECT_ID,
    EXPO_PUBLIC_SITE_URL: 'https://staging.terrapin.minds.com',
  };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => env[key] !== value)
    .map(([key, value]) => `${key} must be ${value}`);

  if (mismatches.length > 0) {
    throw new Error(`Refusing staging build with unsafe environment:\n- ${mismatches.join('\n- ')}`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  assertDeployEnv();
}
