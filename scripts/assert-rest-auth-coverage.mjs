// The assertion from rest-auth-coverage.test.ts, extracted verbatim so it can be
// run against an arbitrary index.ts. Same regexes, same guard-block logic.
import { readFileSync } from 'node:fs';
const SOURCE = process.argv[2];
const lines = readFileSync(SOURCE, 'utf8').split('\n');
const guarded = new Set(); const unguarded = []; let guardBlockSeen = false;
for (const line of lines) {
  const use = line.match(/^\s*api\.use\('(\/[a-z0-9-]+)(?:\/\*)?',\s*apiKeyAuth/);
  if (use) { guarded.add(use[1]); guardBlockSeen = true; continue; }
  const route = line.match(/^\s*api\.route\('(\/[a-z0-9-]+)'/);
  if (route && guardBlockSeen && !guarded.has(route[1])) unguarded.push(route[1]);
}
if (!guardBlockSeen) { console.log('FAIL: no guard block seen'); process.exit(1); }
if (unguarded.length) { console.log('RED — unguarded route groups: ' + JSON.stringify(unguarded)); process.exit(1); }
console.log('GREEN — every guarded-position api.route() has a matching api.use(apiKeyAuth)');
