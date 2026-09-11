#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const sdk = await import(pathToFileURL('packages/sdk/dist/index.js'));
if (typeof sdk.Minds !== 'function') throw new Error('@minds/sdk did not export Minds at runtime');

const api = await import(pathToFileURL('packages/api/dist/index.js'));
if (api.MINDS_API_ORIGIN !== 'https://api.minds.com') {
  throw new Error('@minds/api loaded with the wrong default origin');
}

const canonicalApiBaseUrl = `${api.MINDS_API_ORIGIN}/api/v1`;
const appClientSource = readFileSync('lib/recursiv.ts', 'utf8');
if (!appClientSource.includes(`'${canonicalApiBaseUrl}'`)) {
  throw new Error('Minds app fallback and @minds/api default origin diverged');
}

const agentOnboarding = readFileSync('AGENTS.md', 'utf8');
if (!agentOnboarding.includes(`Canonical Minds production API host: \`${api.MINDS_API_ORIGIN}\``)) {
  throw new Error('AGENTS.md does not name the canonical Minds production API origin');
}
if (!agentOnboarding.includes(`Verify the Minds production commit at \`${api.MINDS_API_ORIGIN}/health\``)) {
  throw new Error('AGENTS.md deploy verification does not use the canonical Minds API origin');
}

const overlay = await import(pathToFileURL('packages/tenant-overlay/dist/index.js'));
if (overlay.defaults?.authMethods !== 'email' || typeof overlay.renderLanding !== 'function') {
  throw new Error('@minds/tenant-overlay did not load its runtime exports');
}

const cliEnv = { ...process.env };
delete cliEnv.MINDS_API_URL;
delete cliEnv.RECURSIV_API_URL;
const cli = spawnSync(process.execPath, ['packages/cli/dist/bin/minds.js', 'info'], {
  cwd: process.cwd(),
  env: cliEnv,
  encoding: 'utf8',
});
if (cli.status !== 0 || !cli.stdout.includes('https://api.minds.com/api/v1')) {
  throw new Error(`@minds/cli runtime smoke failed: ${cli.stderr || cli.stdout}`);
}

console.log('Minds package runtime smoke PASS');
