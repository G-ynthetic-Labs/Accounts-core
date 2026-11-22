// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The document exports: every document a person reads, as Word (.docx, which Google Docs opens), PDF and plain text.
 *
 * Spec: POL-DOCS-002 (PDF, Word, Google Docs and plain text)
 * Source of truth: repo.json → documents
 * @feature accounts-tools
 *
 * How it works. For each Markdown document listed in `repo.json` → `documents` it runs pandoc to write
 * `docs/export/<name>.docx` and `<name>.txt`, then LibreOffice (headless) to turn the .docx into `<name>.pdf`, so the
 * PDF and the Word file have the same layout. It drops the HTML comment lines at the top (the legal notice stays in
 * each file's own words below the title). A missing tool or a failed step stops with its name, never a guess.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const repo = JSON.parse(readFileSync(join(ROOT, 'repo.json'), 'utf8'));
const OUT = join(ROOT, 'docs', 'export');
mkdirSync(OUT, { recursive: true });

function run(tool, args) {
  try {
    execFileSync(tool, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (e) {
    console.error(`docs: ${tool} failed: ${String(e.stderr ?? e.message).trim().split('\n')[0]}`);
    process.exit(1);
  }
}

const NOTICE = 'Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved. Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited.';

for (const doc of repo.documents) {
  const name = basename(doc, '.md');
  const body = readFileSync(join(ROOT, doc), 'utf8').split('\n').filter((l) => !l.startsWith('<!--')).join('\n');
  const source = join(OUT, `${name}.src.md`);
  writeFileSync(source, `${body.trim()}\n\n---\n\n${NOTICE}\n`);
  run('pandoc', [source, '-f', 'gfm', '-o', join(OUT, `${name}.docx`)]);
  run('pandoc', [source, '-f', 'gfm', '-t', 'plain', '--wrap=auto', '--columns=100', '-o', join(OUT, `${name}.txt`)]);
  run('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', OUT, join(OUT, `${name}.docx`)]);
  run('rm', [source]);
  console.log(`docs: ${doc} → docs/export/${name}.{docx,pdf,txt}`);
}
