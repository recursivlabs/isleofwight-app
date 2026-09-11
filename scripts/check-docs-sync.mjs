#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = process.cwd();
const productDocPath = 'docs/product-surfaces.md';
const developerDocPath = 'docs/developer-surfaces.md';
const productDoc = read(productDocPath);
const developerDoc = read(developerDocPath);
const rootReadme = read('README.md');
const failures = [];

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function check(value, message) {
  if (!value) failures.push(message);
}

function walk(path) {
  return readdirSync(join(root, path), { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory() ? walk(child) : [child];
  });
}

const routeFiles = walk('app')
  .filter((path) => path.endsWith('.tsx'))
  .filter((path) => !['_layout.tsx', '+html.tsx'].includes(basename(path)))
  .sort();

for (const route of routeFiles) {
  check(productDoc.includes(`\`${route}\``), `${productDocPath} omits route ${route}`);
}

const documentedRoutes = new Set(
  [...productDoc.matchAll(/`(app\/[^`]+\.tsx)`/g)].map((match) => match[1]),
);
for (const route of documentedRoutes) {
  check(existsSync(join(root, route)), `${productDocPath} cites missing route ${route}`);
}

const packageDirs = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join('packages', entry.name))
  .filter((dir) => existsSync(join(root, dir, 'package.json')))
  .sort();

for (const packageDir of packageDirs) {
  const manifestPath = join(packageDir, 'package.json');
  const readmePath = join(packageDir, 'README.md');
  const manifest = JSON.parse(read(manifestPath));
  const packageReadme = read(readmePath);

  check(rootReadme.includes(`\`${manifest.name}\``), `README.md omits package ${manifest.name}`);
  check(developerDoc.includes(`\`${manifest.name}\``), `${developerDocPath} omits package ${manifest.name}`);
  check(developerDoc.includes(`\`${manifestPath}\``), `${developerDocPath} omits source ${manifestPath}`);
  check(developerDoc.includes(`\`${readmePath}\``), `${developerDocPath} omits ${readmePath}`);
  check(
    developerDoc.includes(`| \`${manifest.name}\` | \`${manifestPath}\` | \`${readmePath}\` | \`${manifest.version}\` |`),
    `${developerDocPath} version row is stale for ${manifest.name}@${manifest.version}`,
  );
  check(packageReadme.startsWith(`# ${manifest.name}\n`), `${readmePath} heading does not match ${manifest.name}`);
  check(packageReadme.includes(manifest.license), `${readmePath} omits manifest license ${manifest.license}`);
  check(
    packageReadme.includes(`npm install ${manifest.name}`) || packageReadme.includes(`npm install -g ${manifest.name}`),
    `${readmePath} has no install command for ${manifest.name}`,
  );
}

const sdkClient = read('packages/sdk/src/client.ts');
const sdkResources = [...sdkClient.matchAll(/^  readonly ([A-Za-z0-9_]+):/gm)].map((match) => match[1]);
for (const resource of sdkResources) {
  check(developerDoc.includes(`\`${resource}\``), `${developerDocPath} omits SDK resource ${resource}`);
}

const mindsTools = read('packages/mcp/src/minds-tools.ts');
const mindsToolNames = [...mindsTools.matchAll(/registry\.tool\(\s*["']([^"']+)["']/g)]
  .map((match) => match[1]);
const mcpReadme = read('packages/mcp/README.md');
for (const tool of mindsToolNames) {
  check(developerDoc.includes(`\`${tool}\``), `${developerDocPath} omits Minds MCP tool ${tool}`);
  check(mcpReadme.includes(`\`${tool}\``), `packages/mcp/README.md omits Minds MCP tool ${tool}`);
}

for (const envName of [
  'MINDS_API_KEY_SCOPES',
  'MINDS_MCP_ENABLE_WRITES',
  'MINDS_MCP_ENABLE_PLATFORM_TOOLS',
]) {
  check(mcpReadme.includes(envName), `packages/mcp/README.md omits ${envName}`);
  check(developerDoc.includes(envName), `${developerDocPath} omits ${envName}`);
}

const cliSource = read('packages/cli/src/bin/minds.ts');
const cliReadme = read('packages/cli/README.md');
const groupByVariable = new Map(
  [...cliSource.matchAll(/const\s+(\w+)\s*=\s*program\.command\('([^']+)'\)/g)]
    .map((match) => [match[1], commandName(match[2])]),
);
const directCommands = [...cliSource.matchAll(/program\s*\.command\('([^']+)'\)/g)]
  .map((match) => commandName(match[1]));
const groupCommands = [];
for (const [variable, group] of groupByVariable) {
  const childPattern = new RegExp(`${variable}\\s*\\.command\\('([^']+)'\\)`, 'g');
  for (const match of cliSource.matchAll(childPattern)) {
    groupCommands.push(`${group} ${commandName(match[1])}`);
  }
}
const groupNames = new Set(groupByVariable.values());
const leafCommands = [...new Set([
  ...directCommands.filter((command) => !groupNames.has(command)),
  ...groupCommands,
])].sort();

for (const command of leafCommands) {
  check(cliReadme.includes(`\`minds ${command}\``), `packages/cli/README.md omits command minds ${command}`);
  check(developerDoc.includes(`\`minds ${command}\``), `${developerDocPath} omits command minds ${command}`);
}

for (const staleClaim of [
  'main` is **red today',
  'which is open, not merged',
  'Native crash telemetry does not exist yet',
  'Internal builds currently share an OTA channel with production',
  '#201](https://github.com/recursivlabs/minds/issues/201)',
  '#202](https://github.com/recursivlabs/minds/issues/202)',
  '#203](https://github.com/recursivlabs/minds/issues/203)',
]) {
  check(!rootReadme.includes(staleClaim), `README.md retains stale claim: ${staleClaim}`);
}

check(rootReadme.includes(productDocPath), `README.md does not link ${productDocPath}`);
check(rootReadme.includes(developerDocPath), `README.md does not link ${developerDocPath}`);

if (failures.length > 0) {
  console.error(`docs sync FAIL (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `docs sync PASS: ${routeFiles.length} routes, ${packageDirs.length} packages, ` +
  `${sdkResources.length} SDK resources, ${mindsToolNames.length} Minds MCP tools, ` +
  `${leafCommands.length} CLI leaf commands`,
);

function commandName(signature) {
  return signature.trim().split(/\s+/)[0];
}
