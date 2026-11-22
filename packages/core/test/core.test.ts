// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Tests of the accounts core: results, settings, who acts, the store and its check, the record, accounts, sessions
 * and passwords. SIMULATED: a memory store and synthetic people under `.test` only.
 *
 * Spec: docs/design.md § Results and codes, § The store on the computer, § Accounts
 * Source of truth: packages/core/src
 * @feature accounts-core
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACCOUNT_CODES, Accounts, MemoryAuditLog, MemoryVault, PERSON, accountMeaning, canonicalJson, checkIdentity,
  maskEmail, personOnly, vaultProblems, steppingClock, wholeNumbers,
} from '../src/index.ts';
import type { AuditEvent, Actor, Result } from '../src/index.ts';

const T0 = Date.parse('2026-11-21T12:00:00Z');
const PASS = { cost: 16, blockSize: 8, parallelization: 1, minLength: 8, lockoutThreshold: 3, lockoutMinutes: 15 };
const SETTINGS = { sessions: { sessionMinutes: 60 }, password: PASS };
const ASSISTANT: Actor = { kind: 'assistant' };
const ada = { provider: 'google', sub: 'sim-sub-1001', email: 'ada@example.test', email_verified: true } as const;
const ada2 = { provider: 'github', sub: '424242', email: 'ada@work.example.test', email_verified: true } as const;
const bob = { provider: 'email', sub: 'bob@example.test', email: 'bob@example.test', email_verified: true } as const;

function setup(settings: Readonly<Record<string, unknown>> = SETTINGS) {
  const store = new MemoryVault();
  const auditLog = new MemoryAuditLog<AuditEvent>();
  const clock = steppingClock(T0, 0);
  return { store, auditLog, clock, accounts: new Accounts({ store, auditLog, settings, clock }) };
}
const value = <T>(r: Result<T>): T => {
  if (!r.ok) assert.fail(`expected ok, got ${JSON.stringify(r.issues)}`);
  return r.value;
};
const codes = (r: Result<unknown>): string[] => (r.ok ? [] : r.issues.map((i) => i.code));

test('ACC-T001 every code has plain words and an unknown code is a bug', () => {
  for (const [code, m] of Object.entries(ACCOUNT_CODES)) assert.ok(m.says.endsWith('.'), code);
  assert.throws(() => accountMeaning('A999'));
});

test('ACC-T002 owner settings: unset refuses and names every missing number; nothing is assumed', () => {
  const r = wholeNumbers({ a: 1 }, ['a', 'b', 'c'], '/x');
  assert.deepEqual(codes(r), ['A100']);
  assert.match(r.ok ? '' : r.issues[0]?.detail ?? '', /b, c/);
  assert.deepEqual(codes(wholeNumbers({ a: 0, b: 1.5 }, ['a', 'b'])), ['A101', 'A101']);
  assert.deepEqual(value(wholeNumbers({ a: 3 }, ['a'])), { a: 3 });
});

test('ACC-T003 only a person changes an account; an assistant or an unnamed actor is refused', () => {
  assert.ok(personOnly(PERSON).ok);
  assert.deepEqual(codes(personOnly(ASSISTANT)), ['A110']);
  assert.deepEqual(codes(personOnly({ kind: 'robot' })), ['A111']);
  const { accounts, store } = setup();
  assert.deepEqual(codes(accounts.signIn(ada, ASSISTANT, { create: true })), ['A110']);
  assert.deepEqual(store.names(), []);
});

test('ACC-T004 the memory store passes the store check that a product runs on its own vault', () => {
  assert.deepEqual(vaultProblems(new MemoryVault()), []);
  const leaky = new MemoryVault();
  const broken = { put: leaky.put.bind(leaky), get: leaky.get.bind(leaky), remove: leaky.remove.bind(leaky), names: () => [] };
  assert.ok(vaultProblems(broken).includes('names did not list every item'));
});

test('ACC-T005 the record is hash-chained: an entry changed afterwards is found', () => {
  const r = new MemoryAuditLog<{ n: number }>();
  r.append({ n: 1 });
  r.append({ n: 2 });
  assert.equal(r.verify(), -1);
  (r.entries()[0]?.body as { n: number }).n = 9;
  assert.equal(r.verify(), 0);
  assert.equal(canonicalJson({ b: 1, a: [2, { d: 1, c: 0 }] }), '{"a":[2,{"c":0,"d":1}],"b":1}');
});

test('ACC-T006 a checked identity is required, and an email is shown masked', () => {
  assert.ok(checkIdentity(ada).ok);
  assert.deepEqual(codes(checkIdentity({ provider: 'myspace', sub: 'x', email_verified: true })), ['A205']);
  assert.deepEqual(codes(checkIdentity({ provider: 'google', sub: 'a b', email_verified: 'yes' })), ['A205', 'A205']);
  assert.equal(maskEmail('ada@example.test'), 'a•••@example.test');
});

test('ACC-T007 the first sign-in makes an account and a session; the next finds it', () => {
  const { accounts } = setup();
  const first = value(accounts.signIn(ada, PERSON, { create: true }));
  assert.equal(first.created, true);
  assert.equal(value(accounts.sessions.validate(first.session.token)), first.account.id);
  const again = value(accounts.signIn(ada, PERSON, { create: true }));
  assert.equal(again.created, false);
  assert.equal(again.account.id, first.account.id);
  assert.equal(value(accounts.list()).length, 1);
  assert.deepEqual(codes(accounts.signIn(bob, PERSON, { create: false })), ['A206']);
});

test('ACC-T008 the store keeps no provider subject, no session token and only an email account its address', () => {
  const { accounts, store } = setup();
  const a = value(accounts.signIn(ada, PERSON, { create: true }));
  const b = value(accounts.signIn(bob, PERSON, { create: true }));
  const all = store.names().map((n) => store.peek(n) ?? '').join('\n');
  assert.ok(!all.includes('sim-sub-1001'));
  assert.ok(!all.includes('ada@example.test'));
  assert.ok(all.includes('bob@example.test'));
  assert.ok(!all.includes(a.session.token) && !all.includes(b.session.token));
  assert.deepEqual(value(accounts.view(a.session.token)).signIns.map((s) => s.emailHint), ['a•••@example.test']);
});

test('ACC-T009 sessions need the owner\'s length, end on time and close on sign-out', () => {
  const { accounts: unset } = setup({});
  assert.deepEqual(codes(unset.signIn(ada, PERSON, { create: true })), ['A100']);
  const { accounts, clock } = setup();
  const s = value(accounts.signIn(ada, PERSON, { create: true })).session;
  clock.advance(59 * 60_000);
  assert.ok(accounts.sessions.validate(s.token).ok);
  clock.advance(60_000);
  assert.deepEqual(codes(accounts.sessions.validate(s.token)), ['A301']);
  assert.deepEqual(codes(accounts.sessions.validate(s.token)), ['A300']);
  const t = value(accounts.signIn(ada, PERSON, { create: true })).session;
  assert.ok(accounts.signOut(t.token).ok);
  assert.deepEqual(codes(accounts.view(t.token)), ['A300']);
  assert.deepEqual(codes(accounts.view('not a token')), ['A300']);
});

test('ACC-T010 a second sign-in is joined only by the signed-in person, never to two accounts', () => {
  const { accounts } = setup();
  const a = value(accounts.signIn(ada, PERSON, { create: true }));
  const b = value(accounts.signIn(bob, PERSON, { create: true }));
  assert.deepEqual(codes(accounts.link(a.session.token, ada2, ASSISTANT)), ['A110']);
  const v = value(accounts.link(a.session.token, ada2, PERSON));
  assert.deepEqual(v.signIns.map((s) => s.provider), ['google', 'github']);
  assert.deepEqual(codes(accounts.link(b.session.token, ada2, PERSON)), ['A202']);
  assert.equal(value(accounts.signIn(ada2, PERSON, { create: true })).account.id, a.account.id);
});

test('ACC-T011 a sign-in is removed by its ref, but never the last one', () => {
  const { accounts } = setup();
  const a = value(accounts.signIn(ada, PERSON, { create: true })).session.token;
  const v = value(accounts.link(a, ada2, PERSON));
  const [g, h] = v.signIns;
  assert.deepEqual(codes(accounts.unlink(a, 'ffffffffffffffff', PERSON)), ['A203']);
  assert.deepEqual(value(accounts.unlink(a, g?.ref ?? '', PERSON)).signIns.map((s) => s.provider), ['github']);
  assert.deepEqual(codes(accounts.unlink(a, h?.ref ?? '', PERSON)), ['A204']);
});

test('ACC-T012 passwords: owner settings, minimum length, right and wrong, and a pause after too many wrong', () => {
  const { accounts: unset } = setup({ sessions: { sessionMinutes: 60 } });
  const u = value(unset.signIn(bob, PERSON, { create: true }));
  assert.deepEqual(codes(unset.setPassword(u.session.token, 'long enough', PERSON)), ['A100']);
  const { accounts, store, clock } = setup();
  const s = value(accounts.signIn(bob, PERSON, { create: true }));
  const id = s.account.id;
  assert.deepEqual(codes(accounts.signInWithPassword(id, 'whatever1', PERSON)), ['A313']);
  assert.deepEqual(codes(accounts.setPassword(s.session.token, 'short', PERSON)), ['A310']);
  assert.equal(value(accounts.setPassword(s.session.token, 'correct horse', PERSON)).hasPassword, true);
  assert.ok(!(store.peek(id) ?? '').includes('correct horse'));
  assert.ok(accounts.signInWithPassword(id, 'correct horse', PERSON).ok);
  assert.deepEqual(codes(accounts.signInWithPassword(id, 'wrong one', PERSON)), ['A311']);
  assert.deepEqual(codes(accounts.signInWithPassword(id, 'wrong two', PERSON)), ['A311']);
  assert.deepEqual(codes(accounts.signInWithPassword(id, 'wrong three', PERSON)), ['A312']);
  assert.deepEqual(codes(accounts.signInWithPassword(id, 'correct horse', PERSON)), ['A312']);
  clock.advance(15 * 60_000);
  assert.ok(accounts.signInWithPassword(id, 'correct horse', PERSON).ok);
  assert.deepEqual(codes(accounts.signInWithPassword(id, 'correct horse', ASSISTANT)), ['A110']);
});

test('ACC-T013 removing an account ends its sessions and deletes it; only by a person', () => {
  const { accounts, store } = setup();
  const a = value(accounts.signIn(ada, PERSON, { create: true }));
  const second = value(accounts.signIn(ada, PERSON, { create: true })).session;
  const b = value(accounts.signIn(bob, PERSON, { create: true }));
  assert.deepEqual(codes(accounts.remove(a.session.token, ASSISTANT)), ['A110']);
  assert.ok(accounts.remove(a.session.token, PERSON).ok);
  assert.deepEqual(codes(accounts.view(second.token)), ['A300']);
  assert.ok(!store.names().includes(a.account.id));
  assert.equal(value(accounts.view(b.session.token)).id, b.account.id);
});

test('ACC-T014 every change is recorded first; when the record is down nothing changes', () => {
  const { accounts, auditLog, store } = setup();
  value(accounts.signIn(ada, PERSON, { create: true }));
  const stages = auditLog.entries().map((e) => `${e.body.action}:${e.body.stage}`);
  assert.deepEqual(stages, ['pepper-create:asked', 'pepper-create:done', 'account-create:asked', 'account-create:done', 'session-create:asked', 'session-create:done']);
  assert.ok(!JSON.stringify(auditLog.entries()).includes('example.test'));
  const before = store.names();
  auditLog.goDown();
  assert.deepEqual(codes(accounts.signIn(bob, PERSON, { create: true })), ['A402']);
  assert.deepEqual(store.names(), before);
});

test('ACC-T015 a damaged account file refuses sign-in rather than making a second account', () => {
  const { accounts, store } = setup();
  const a = value(accounts.signIn(ada, PERSON, { create: true }));
  store.put(a.account.id, Buffer.from('{"format":"accounts-account/1"}'));
  assert.deepEqual(codes(accounts.signIn(ada, PERSON, { create: true })), ['A200']);
  assert.equal(store.names().filter((n) => n.startsWith('acct-')).length, 1);
  const fresh = setup();
  fresh.store.failNext();
  assert.deepEqual(codes(fresh.accounts.signIn(ada, PERSON, { create: true })), ['A400']);
  assert.deepEqual(fresh.store.names(), []);
});

test('ACC-T016 a person may name an account; control characters and long names are refused', () => {
  const { accounts } = setup();
  const t = value(accounts.signIn(ada, PERSON, { create: true })).session.token;
  assert.equal(value(accounts.rename(t, '  Ada at home ', PERSON)).label, 'Ada at home');
  assert.deepEqual(codes(accounts.rename(t, 'x'.repeat(81), PERSON)), ['A205']);
  assert.deepEqual(codes(accounts.rename(t, 'bad\u0007name', PERSON)), ['A205']);
  assert.equal(value(accounts.rename(t, null, PERSON)).label, null);
});
