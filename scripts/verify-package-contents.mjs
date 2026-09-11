#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageDirs = process.argv.slice(2);

if (packageDirs.length === 0) {
  console.error('usage: verify-package-contents.mjs <package-dir> [...]');
  process.exit(2);
}

let failed = false;

for (const inputDir of packageDirs) {
  const packageDir = resolve(inputDir);
  const manifest = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf8'));
  const packed = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageDir,
    encoding: 'utf8',
  });

  if (packed.status !== 0) {
    console.error(`${manifest.name}: npm pack failed\n${packed.stderr || packed.stdout}`);
    failed = true;
    continue;
  }

  let result;
  try {
    [result] = JSON.parse(packed.stdout);
  } catch (error) {
    console.error(`${manifest.name}: could not parse npm pack output: ${error}`);
    failed = true;
    continue;
  }

  const files = new Set((result?.files ?? []).map(({ path }) => path.replace(/^\.\//, '')));
  const declared = [manifest.main, manifest.module, manifest.types];
  const exportsRoot = manifest.exports?.['.'];
  if (typeof exportsRoot === 'string') declared.push(exportsRoot);
  if (exportsRoot && typeof exportsRoot === 'object') {
    declared.push(exportsRoot.import, exportsRoot.require, exportsRoot.default, exportsRoot.types);
  }
  if (typeof manifest.bin === 'string') declared.push(manifest.bin);
  if (manifest.bin && typeof manifest.bin === 'object') declared.push(...Object.values(manifest.bin));

  const targets = [...new Set(declared.filter(Boolean).map((path) => path.replace(/^\.\//, '')))];
  const missing = targets.filter((target) => !files.has(target));

  if (missing.length > 0) {
    console.error(`${manifest.name}@${manifest.version}: package is missing declared target(s): ${missing.join(', ')}`);
    failed = true;
    continue;
  }

  console.log(`${manifest.name}@${manifest.version}: verified ${targets.length} declared target(s) in ${files.size} packed file(s)`);
}

if (failed) process.exit(1);
