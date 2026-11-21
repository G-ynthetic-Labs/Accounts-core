// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The code map: `codemap.json` holds one map per code file (description, features, address, keys, imports, exports,
 * classes with their methods, interfaces, types, functions, constants, tests and dependencies); the feature map
 * (`feature-map.json`, which files carry each feature and which address each holds) and its readable twin
 * (`features.md`). `--check` fails when any of the three is out of date, a code file has no `@feature` or one not in
 * `repo.json`, a file is longer than `repo.json` → `maxLines`, or a package breaks the 1x3xn shape.
 *
 * Spec: POL-CODE-001 (file size: 300 lines, give or take 30; owner 21 Nov 2026), POL-CODE-002 (1x3xn modules,
 * `module.part.sub`), POL-CODE-004 (code and feature maps)
 * Source of truth: repo.json
 * @feature accounts-tools
 */
/*
 * How it works. It lists every file git tracks or would track under `repo.json` → `codeDirs` with a code extension.
 * TypeScript and JavaScript are read with the TypeScript 6 compiler's parser, installed as `typescript-api` (no type
 * checking; TypeScript 7, which type-checks the code, has no stable parser API yet). The description is the
 * header's first paragraph; `@feature`, `@address` and `@keys` are read from the header. A source file under
 * `packages/<m>/src/<part>/` other than a barrel must carry `@address <m>.<part>.<sub>`; each module in
 * `repo.json` → `modules` must have exactly its parts, each with exactly n addresses.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import ts from 'typescript-api';
import { featuresMarkdown } from './features-md.mjs';

const ROOT = join(import.meta.dirname, '..');
const repo = JSON.parse(readFileSync(join(ROOT, 'repo.json'), 'utf8'));
const CODE = new Set(['.ts', '.mjs', '.js']);
const check = process.argv.includes('--check');

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  .split('\n').filter((f) => f !== '' && existsSync(join(ROOT, f)) && CODE.has(extname(f)) && repo.codeDirs.some((d) => f.startsWith(`${d}/`))).sort();

function header(text) {
  const m = text.match(/\/\*\*([\s\S]*?)\*\//g) ?? [];
  const block = m.map((b) => b.replace(/^\/\*\*|\*\/$/g, '').split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join('\n'))
    .find((b) => /@feature/.test(b)) ?? '';
  const features = [...block.matchAll(/@feature\s+([a-z0-9-]+)/g)].map((x) => x[1]);
  const address = block.match(/@address\s+([a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+)/)?.[1] ?? null;
  const keys = [...block.matchAll(/@keys\s+([^\n]+)/g)].flatMap((x) => x[1].split(/[\s,]+/).filter(Boolean));
  const para = block.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p !== '') ?? '';
  const description = para.split('\n').filter((l) => !/^(Spec:|Source of truth:|@feature|@address|@keys)/.test(l.trim())).join(' ').replace(/\s+/g, ' ').trim();
  return { description, features: [...new Set(features)], address, keys };
}

const txt = (node, sf) => (node ? node.getText(sf) : null);
const params = (fn, sf) => fn.parameters.map((p) => ({ name: p.name.getText(sf), type: txt(p.type, sf) }));
const flag = (n, f) => (ts.getCombinedModifierFlags(n) & f) !== 0;
const isExported = (n) => flag(n, ts.ModifierFlags.Export);
const isAsync = (n) => flag(n, ts.ModifierFlags.Async);
const isStatic = (n) => flag(n, ts.ModifierFlags.Static);

function scan(rel, text) {
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const out = { imports: [], exports: [], classes: [], interfaces: [], types: [], functions: [], constants: [], tests: [] };
  const fnOf = (name, f) => ({ name, exported: isExported(f), params: params(f, sf), returns: txt(f.type, sf), async: isAsync(f) });
  for (const s of sf.statements) {
    if (ts.isImportDeclaration(s)) {
      const c = s.importClause;
      const names = [];
      if (c?.name) names.push(c.name.text);
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) names.push(...c.namedBindings.elements.map((e) => e.name.text));
      if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) names.push(`* as ${c.namedBindings.name.text}`);
      out.imports.push({ from: s.moduleSpecifier.text, names, typeOnly: Boolean(c?.isTypeOnly) });
    } else if (ts.isExportDeclaration(s)) {
      const names = s.exportClause && ts.isNamedExports(s.exportClause) ? s.exportClause.elements.map((e) => e.name.text) : ['*'];
      out.exports.push(...names);
      if (s.moduleSpecifier) out.imports.push({ from: s.moduleSpecifier.text, names, typeOnly: Boolean(s.isTypeOnly), reexport: true });
    } else if (ts.isClassDeclaration(s) && s.name) {
      const heritage = (k) => (s.heritageClauses ?? []).filter((h) => h.token === k).flatMap((h) => h.types.map((t) => t.getText(sf)));
      out.classes.push({ name: s.name.text, exported: isExported(s), extends: heritage(ts.SyntaxKind.ExtendsKeyword), implements: heritage(ts.SyntaxKind.ImplementsKeyword),
        methods: s.members.filter((m) => ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m) || ts.isGetAccessor(m)).map((m) => ({
          name: m.name ? m.name.getText(sf) : 'constructor', params: params(m, sf), returns: txt(m.type, sf), async: isAsync(m), static: isStatic(m), kind: ts.SyntaxKind[m.kind] })) });
      if (isExported(s)) out.exports.push(s.name.text);
    } else if (ts.isInterfaceDeclaration(s)) {
      out.interfaces.push({ name: s.name.text, exported: isExported(s), members: s.members.map((m) => m.name?.getText(sf) ?? '(call)') });
      if (isExported(s)) out.exports.push(s.name.text);
    } else if (ts.isTypeAliasDeclaration(s)) {
      out.types.push({ name: s.name.text, exported: isExported(s) });
      if (isExported(s)) out.exports.push(s.name.text);
    } else if (ts.isFunctionDeclaration(s) && s.name) {
      out.functions.push(fnOf(s.name.text, s));
      if (isExported(s)) out.exports.push(s.name.text);
    } else if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        const name = d.name.getText(sf);
        if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) out.functions.push({ ...fnOf(name, d.initializer), exported: isExported(s) });
        else out.constants.push({ name, exported: isExported(s), type: txt(d.type, sf) });
        if (isExported(s)) out.exports.push(name);
      }
    }
  }
  const visit = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'test' && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0])) out.tests.push(n.arguments[0].text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  out.exports = [...new Set(out.exports)].sort();
  return out;
}

const problems = [];
const maps = {};
const featureMap = {};
const addresses = {};
for (const rel of files) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (lines > repo.maxLines) problems.push(`${rel}: ${lines} lines, more than ${repo.maxLines}`);
  const h = header(text);
  if (h.features.length === 0) problems.push(`${rel}: no @feature`);
  for (const f of h.features) {
    if (!repo.features.includes(f)) problems.push(`${rel}: @feature ${f} is not in repo.json`);
    (featureMap[f] ??= { files: [], addresses: [] }).files.push(rel);
    if (h.address) featureMap[f].addresses.push(h.address);
  }
  const where = rel.match(/^packages\/([a-z0-9-]+)\/src\/([a-z0-9-]+)\/[^/]+$/);
  if (where && basename(rel) !== 'index.ts') {
    const want = `${where[1]}.${where[2]}.`;
    if (!h.address) problems.push(`${rel}: no @address (want ${want}<sub>)`);
    else if (!h.address.startsWith(want)) problems.push(`${rel}: @address ${h.address} does not start with ${want}`);
    else if (Object.values(addresses).includes(h.address)) problems.push(`${rel}: @address ${h.address} is used twice`);
    else addresses[rel] = h.address;
  }
  const code = scan(rel, text);
  const dependencies = [...new Set(code.imports.map((i) => i.from))].sort();
  maps[rel] = { file: rel, lines, description: h.description, features: h.features, address: h.address, keys: h.keys, ...code, dependencies };
}
for (const [mod, shape] of Object.entries(repo.modules ?? {})) {
  const parts = {};
  for (const a of Object.values(addresses)) { const [m, p] = a.split('.'); if (m === mod) (parts[p] ??= []).push(a); }
  const names = Object.keys(parts);
  if (names.length !== shape.parts) problems.push(`module ${mod}: ${names.length} part(s), want ${shape.parts} (${names.join(', ') || 'none'})`);
  for (const p of names) if (parts[p].length !== shape.n) problems.push(`module ${mod}.${p}: ${parts[p].length} sub(s), want ${shape.n}`);
}
for (const a of Object.values(addresses)) if (!(a.split('.')[0] in (repo.modules ?? {}))) problems.push(`address ${a}: module not in repo.json → modules`);
const sortedFeatures = Object.fromEntries(Object.entries(featureMap).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, { files: v.files, addresses: v.addresses.sort() }]));
const fm = `${JSON.stringify({ note: 'Generated by tools/code-map.mjs from file headers (@feature, @address, @keys). Do not edit by hand.', features: sortedFeatures }, null, 2)}\n`;

const cm = `${JSON.stringify({ note: 'Generated by tools/code-map.mjs: one map per code file. Do not edit by hand.', files: maps }, null, 2)}\n`;
const md = featuresMarkdown(repo, sortedFeatures, maps);
const outputs = [[repo.codeMap, cm], [repo.featureMap, fm], [repo.featuresDoc, md]];
if (check) {
  for (const [name, text] of outputs) if (!existsSync(join(ROOT, name)) || readFileSync(join(ROOT, name), 'utf8') !== text) problems.push(`${name} is out of date`);
  for (const p of problems) console.error(`map: ${p}`);
  console.log(`map: ${files.length} code file(s), ${problems.length} problem(s)${problems.length > 0 ? ' (run npm run map)' : ''}`);
  process.exit(problems.length > 0 ? 1 : 0);
}
for (const [name, text] of outputs) writeFileSync(join(ROOT, name), text);
for (const p of problems) console.error(`map: ${p}`);
console.log(`map: ${files.length} file(s) mapped into ${outputs.map(([n]) => n).join(', ')}; ${problems.length} problem(s)`);
process.exit(problems.length > 0 ? 1 : 0);
