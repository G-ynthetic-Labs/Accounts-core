// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The key check: every test name starts with its key (one of repo.json → testKeyPrefixes), every key is listed once in
 * the key registry against the file that holds it, and every listed key is still a test.
 *
 * Spec: CLAUDE.md (every test name starts with its key, listed in the registry in the same commit)
 * Source of truth: repo.json → keyRegistry (key-registry/accounts-keys.json)
 * @feature accounts-tools
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const repo = JSON.parse(readFileSync(join(ROOT, 'repo.json'), 'utf8'));
const reg = JSON.parse(readFileSync(join(ROOT, repo.keyRegistry), 'utf8'));
const prefixes = repo.testKeyPrefixes;
const listed = new Map(reg.keys.map((k) => [k.key, k.test]));
const problems = [];
const seen = new Set();
const keyPattern = new RegExp(`^((?:${prefixes.join('|')})\\d{3}) `);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const packages = readdirSync(join(ROOT, 'packages')).filter((p) => existsSync(join(ROOT, 'packages', p, 'test')));
for (const p of packages) {
  for (const abs of walk(join(ROOT, 'packages', p, 'test')).filter((x) => x.endsWith('.test.ts'))) {
    const rel = abs.slice(ROOT.length + 1);
    const text = readFileSync(abs, 'utf8');
    for (const m of text.matchAll(/\btest\(\s*'([^']*)/g)) {
      const key = m[1].match(keyPattern)?.[1];
      if (key === undefined) { problems.push(`${rel}: "${m[1].slice(0, 40)}" does not start with its key`); continue; }
      if (seen.has(key)) problems.push(`${key} is used twice`);
      seen.add(key);
      if (listed.get(key) !== rel) problems.push(`${key} is not listed against ${rel}`);
    }
  }
}
for (const k of listed.keys()) if (!seen.has(k)) problems.push(`${k} is listed but no test carries it`);
if (reg.keys.length !== listed.size) problems.push('a key is listed twice');
for (const p of problems) console.error(`keys: ${p}`);
console.log(`keys: ${seen.size} key(s), ${problems.length} problem(s)`);
process.exit(problems.length > 0 ? 1 : 0);
