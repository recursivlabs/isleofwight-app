#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readBuildInfoIfPresent } from './write-build-info.mjs';

const WEB_JS_PATH = '_expo/static/js/web';
const JS_REFERENCE = /\/?_expo\/static\/js\/web\/([A-Za-z0-9_.\-\[\]]+\.js)/g;

/**
 * Inspect the web artifact that is actually present at process startup.
 *
 * Metro records lazy route and library chunks as literal public URLs inside
 * HTML or JavaScript. A build can therefore look healthy while its copied
 * runtime artifact omits files those URLs name. Scanning the final container
 * artifact catches that deployment boundary, not merely the source export.
 */
export function inspectWebArtifact(dist = process.env.EXPO_WEB_DIST || 'dist') {
  const webJsDir = join(dist, WEB_JS_PATH);
  const htmlPath = join(dist, 'index.html');
  if (!existsSync(htmlPath)) throw new Error(`web artifact is missing ${htmlPath}`);
  if (!existsSync(webJsDir)) throw new Error(`web artifact is missing ${webJsDir}`);

  const jsFiles = readdirSync(webJsDir).filter((file) => file.endsWith('.js'));
  if (jsFiles.length === 0) throw new Error(`web artifact has no JavaScript files in ${webJsDir}`);

  const sources = [htmlPath, ...jsFiles.map((file) => join(webJsDir, file))];
  const references = new Set();
  for (const source of sources) {
    const content = readFileSync(source, 'utf8');
    for (const match of content.matchAll(JS_REFERENCE)) references.add(match[1]);
  }

  const missing = [...references]
    .filter((file) => !existsSync(join(webJsDir, file)))
    .sort();
  const commit = readBuildInfoIfPresent(dist)?.commit || null;

  return {
    commit,
    files: jsFiles.length,
    references: references.size,
    missing,
  };
}

export function assertWebArtifact(dist = process.env.EXPO_WEB_DIST || 'dist') {
  const report = inspectWebArtifact(dist);
  if (report.missing.length > 0) {
    throw new Error(
      `refusing to start: web artifact references ${report.missing.length} missing JavaScript chunk(s): ` +
        report.missing.join(', '),
    );
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = assertWebArtifact();
    console.log(
      `[web-artifact] verified ${report.files} JavaScript files and ${report.references} internal references${report.commit ? ` for ${report.commit}` : ''}`,
    );
  } catch (error) {
    console.error(`[web-artifact] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
