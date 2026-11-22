// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The internal-words check: none of the words in `repo.json` → `internalMarkers` appears in anything a person can
 * read, which here is every code's plain words (`says: '…'`), every package's description and every document.
 *
 * Spec: D-166 (internal words never reach a client)
 * Source of truth: repo.json → internalMarkers, documents
 * @feature accounts-tools
 *
 * How it works. It reads the `says` text of every source file under packages/*\/src, each package.json description
 * and each listed document, drops the legal notice lines (the company's notice, not content, as Agent-desktop's check
 * does) and reports every marker found, case-insensitively and as a whole word or word start.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const repo = JSON.parse(readFileSync(join(ROOT, 'repo.json'), 'utf8'));
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const LEGAL = /^.*(All rights reserved|Trade secret of G-ynthetic Labs LLC).*$/gm;
const texts = [];
for (const p of readdirSync(join(ROOT, 'packages'))) {
  texts.push([`packages/${p}/package.json`, JSON.parse(readFileSync(join(ROOT, 'packages', p, 'package.json'), 'utf8')).description ?? '']);
  for (const f of walk(join(ROOT, 'packages', p, 'src')).filter((x) => x.endsWith('.ts'))) {
    const said = [...readFileSync(f, 'utf8').matchAll(/says: '((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]).join('\n');
    texts.push([f.slice(ROOT.length + 1), said]);
  }
}
for (const d of repo.documents) texts.push([d, readFileSync(join(ROOT, d), 'utf8').replace(LEGAL, '')]);
const problems = [];
for (const marker of repo.internalMarkers) {
  const re = new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  for (const [where, text] of texts) if (re.test(text)) problems.push(`${where}: "${marker}"`);
}
for (const p of problems) console.error(`markers: ${p}`);
console.log(`markers: ${texts.length} text(s) read, ${problems.length} problem(s)`);
process.exit(problems.length > 0 ? 1 : 0);
