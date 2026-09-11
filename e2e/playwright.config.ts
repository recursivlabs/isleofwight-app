import { defineConfig, devices } from '@playwright/test';

// Browser E2E smoke against the DEPLOYED staging web surface.
//
// Why not a locally exported bundle: the staging API's CORS allowlist answers
// the preflight for https://staging.terrapin.minds.com but returns no
// access-control-allow-origin for a localhost origin, so a locally served
// dist/ cannot sign in. Running against the deployed staging origin also
// tests the artifact users actually get.
const BASE_URL = process.env.E2E_BASE_URL || 'https://staging.terrapin.minds.com';

export default defineConfig({
  testDir: '.',
  // The journeys are one serial story (sign in once, then browse), so a
  // single worker. Retries re-run the whole serial group.
  workers: 1,
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]],
  outputDir: '../test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
