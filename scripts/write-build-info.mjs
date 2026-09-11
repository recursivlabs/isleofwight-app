#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const COMMIT_RE = /^[0-9a-f]{40}$/;

export function normalizedCommit(value) {
  const commit = String(value || '').trim().toLowerCase();
  return COMMIT_RE.test(commit) ? commit : null;
}

export function resolveBuildCommit({
  env = process.env,
  runGit = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }),
} = {}) {
  try {
    const commit = normalizedCommit(runGit());
    if (commit) return commit;
  } catch {
    // Some image builders omit .git from the build context. Fall through to
    // provider-supplied commit variables, but still require a complete SHA.
  }

  for (const key of ['RECURSIV_DEPLOY_COMMIT', 'SOURCE_COMMIT', 'GITHUB_SHA', 'COMMIT_SHA']) {
    const commit = normalizedCommit(env[key]);
    if (commit) return commit;
  }

  throw new Error(
    'cannot resolve a complete build commit from git or a supported provider variable',
  );
}

export function writeBuildInfo({
  dist = process.env.EXPO_WEB_DIST || 'dist',
  commit,
  optional = false,
  env = process.env,
  runGit,
} = {}) {
  mkdirSync(dist, { recursive: true });
  const file = join(dist, 'build-info.json');
  let resolvedCommit = commit;
  if (resolvedCommit === undefined) {
    try {
      resolvedCommit = resolveBuildCommit({ env, ...(runGit ? { runGit } : {}) });
    } catch (error) {
      if (!optional) throw error;
      rmSync(file, { force: true });
      return null;
    }
  }
  const normalized = normalizedCommit(resolvedCommit);
  if (!normalized) {
    if (!optional) throw new Error('refusing to write build info with an invalid commit');
    rmSync(file, { force: true });
    return null;
  }
  writeFileSync(file, `${JSON.stringify({ commit: normalized })}\n`);
  return { file, commit: normalized };
}

export function readBuildInfoIfPresent(dist = process.env.EXPO_WEB_DIST || 'dist') {
  const file = join(dist, 'build-info.json');
  return existsSync(file) ? readBuildInfo(dist) : null;
}

export function readBuildInfo(dist = process.env.EXPO_WEB_DIST || 'dist') {
  const file = join(dist, 'build-info.json');
  if (!existsSync(file)) throw new Error(`web artifact is missing ${file}`);
  let value;
  try {
    value = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`web artifact has invalid JSON in ${file}`);
  }
  const commit = normalizedCommit(value?.commit);
  if (!commit) throw new Error(`web artifact has an invalid commit in ${file}`);
  return { commit };
}

export function resolveServedCommit({
  dist = process.env.EXPO_WEB_DIST || 'dist',
  env = process.env,
} = {}) {
  const runtimeValues = ['RECURSIV_DEPLOY_COMMIT', 'SOURCE_COMMIT']
    .map((key) => [key, String(env[key] || '').trim()])
    .filter(([, value]) => value !== '');
  const runtimeCommits = runtimeValues.map(([key, value]) => {
    const commit = normalizedCommit(value);
    if (!commit) throw new Error(`${key} does not contain a complete commit`);
    return commit;
  });
  if (new Set(runtimeCommits).size > 1) {
    throw new Error('runtime deployment commit variables disagree');
  }

  const runtimeCommit = runtimeCommits[0] || null;
  const buildCommit = readBuildInfoIfPresent(dist)?.commit || null;
  if (runtimeCommit && buildCommit && runtimeCommit !== buildCommit) {
    throw new Error('runtime and build commit provenance disagree');
  }
  const commit = runtimeCommit || buildCommit;
  if (!commit) throw new Error('no exact deployment commit provenance is available');
  return commit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const optional = process.argv.includes('--optional');
    const result = writeBuildInfo({ optional });
    if (result) console.log(`[build-info] wrote ${result.commit} to ${result.file}`);
    else console.log('[build-info] no build-time commit available; deferring to runtime provenance');
  } catch (error) {
    console.error(`[build-info] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
