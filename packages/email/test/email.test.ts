// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Tests of email sign-in: addresses, where links open, the email's words, the send limit, the link store, signing
 * in by link and by email with a password. SIMULATED: the outbox keeps messages in memory; synthetic `.test` people.
 *
 * Spec: docs/design.md § Email sign-in
 * Source of truth: packages/email/src
 * @feature accounts-email
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Accounts, type AuditEvent, Documents, MemoryAuditLog, MemoryVault, PERSON, type Result, steppingClock } from '@accounts/core';
import { EMAIL_CODES, MagicLinks, SimulatedOutbox, allowedBase, emailMeaning, linkMessage, normalizeAddress, readLinkSettings, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../src/index.ts';

const T0 = Date.parse('2026-11-21T12:00:00Z');
const LINKS = { enabled: true, linkBase: 'com.example.accounts:/sign-in', productName: 'Example App', linkMinutes: 15, maxSends: 2, windowMinutes: 60 };
const SETTINGS = { sessions: { sessionMinutes: 60 }, password: { cost: 16, blockSize: 8, parallelization: 1, minLength: 8, lockoutThreshold: 3, lockoutMinutes: 15 }, emailLinks: LINKS };

function setup(settings: Readonly<Record<string, unknown>> = SETTINGS, sender: SimulatedOutbox | null = new SimulatedOutbox()) {
  const store = new MemoryVault();
  const auditLog = new MemoryAuditLog<AuditEvent>();
  const clock = steppingClock(T0, 0);
  const accounts = new Accounts({ store, auditLog, settings, clock });
  const links = new MagicLinks({ accounts, docs: new Documents(store, auditLog, clock), settings, sender });
  return { store, auditLog, clock, accounts, links, outbox: sender };
}
const value = <T>(r: Result<T>): T => {
  if (!r.ok) assert.fail(`expected ok, got ${JSON.stringify(r.issues)}`);
  return r.value;
};
const codes = (r: Result<unknown>): string[] => (r.ok ? [] : r.issues.map((i) => i.code));

test('EML-T001 every email code has plain words; addresses have one form', () => {
  for (const code of Object.keys(EMAIL_CODES)) assert.ok(emailMeaning(code).says.endsWith('.'));
  assert.equal(value(normalizeAddress('  Bob@Example.TEST ')), 'bob@example.test');
  for (const bad of ['bob', '@example.test', 'bob@example', 'b ob@example.test', 'bob@@example.test', 'bob@example..test', 'bob@-x.test', 7]) {
    assert.deepEqual(codes(normalizeAddress(bad)), ['E101'], String(bad));
  }
});

test('EML-T002 links open only where an app on the computer may be opened', () => {
  for (const good of ['com.example.app:/sign-in', 'http://127.0.0.1:47001/sign-in', 'https://example.test/sign-in']) assert.ok(allowedBase(good).ok, good);
  for (const bad of ['http://localhost:47001/x', 'http://127.0.0.1/x', 'http://example.test/x', 'myapp:/x', 'https://u:p@example.test/x', 'https://example.test/x?a=1', 3]) {
    assert.deepEqual(codes(allowedBase(bad)), ['E102'], String(bad));
  }
});

test('EML-T003 email links are off until the owner turns them on and sets every value', () => {
  assert.deepEqual(codes(readLinkSettings({})), ['E100']);
  assert.deepEqual(codes(readLinkSettings({ emailLinks: { enabled: 'yes' } })), ['E100']);
  assert.deepEqual(codes(readLinkSettings({ emailLinks: { enabled: true } })), ['A100', 'E102', 'E102']);
  assert.ok(readLinkSettings(SETTINGS).ok);
});

test('EML-T004 the email is plain words with one link, its end, and no word on whether an account exists', () => {
  const m = value(linkMessage('bob@example.test', 'Example App', 'com.example.accounts:/sign-in#t=abc', 15));
  assert.equal(m.subject, 'Your sign-in link for Example App');
  assert.match(m.text, /works once and ends in 15 minutes/);
  assert.doesNotMatch(m.text, /account (exists|already)|welcome back|<img|http/i);
  assert.deepEqual(codes(linkMessage('b@example.test', 'Evil\r\nBcc: x@example.test', 'l', 15)), ['E102']);
});

test('EML-T005 a link signs in once, makes the account the first time, and finds it after', async () => {
  const { links, outbox, accounts } = setup();
  value(await links.send('Bob@Example.test', PERSON));
  const link = outbox?.lastLink() ?? '';
  assert.match(link, /^com\.example\.accounts:\/sign-in#t=[A-Za-z0-9_-]{43}$/);
  const first = value(links.verify(link, PERSON));
  assert.equal(first.created, true);
  assert.deepEqual(codes(links.verify(link, PERSON)), ['E110']);
  value(await links.send('bob@example.test', PERSON));
  const again = value(links.verify(outbox?.lastLink(), PERSON));
  assert.equal(again.account.id, first.account.id);
  assert.equal(value(accounts.list()).length, 1);
});

test('EML-T006 a link ends on time and is gone once tried; another app\'s link is refused', async () => {
  const { links, outbox, clock, store } = setup();
  value(await links.send('bob@example.test', PERSON));
  clock.advance(15 * 60_000);
  assert.deepEqual(codes(links.verify(outbox?.lastLink(), PERSON)), ['E111']);
  assert.ok(!store.names().some((n) => n.startsWith('link-')));
  assert.deepEqual(codes(links.verify('com.other.app:/sign-in#t=' + 'a'.repeat(43), PERSON)), ['E112']);
  assert.deepEqual(codes(links.verify('com.example.accounts:/sign-in#t=' + 'a'.repeat(43), PERSON)), ['E110']);
});

test('EML-T007 the send limit is the owner\'s; a failed send leaves no link and costs no send', async () => {
  const { links, outbox, store } = setup();
  outbox?.failNext();
  assert.deepEqual(codes(await links.send('bob@example.test', PERSON)), ['E200']);
  assert.ok(!store.names().some((n) => n.startsWith('link-')));
  value(await links.send('bob@example.test', PERSON));
  value(await links.send('bob@example.test', PERSON));
  assert.deepEqual(codes(await links.send('BOB@example.test', PERSON)), ['E120']);
  value(await links.send('ada@example.test', PERSON));
  assert.equal(outbox?.sent().length, 3);
});

test('EML-T008 no sender, an assistant, or links turned off: nothing is sent and nothing is kept', async () => {
  const none = setup(SETTINGS, null);
  assert.deepEqual(codes(await none.links.send('bob@example.test', PERSON)), ['E201']);
  const { links, outbox, store } = setup();
  assert.deepEqual(codes(await links.send('bob@example.test', { kind: 'assistant' })), ['A110']);
  const off = setup({ ...SETTINGS, emailLinks: { ...LINKS, enabled: false } });
  assert.deepEqual(codes(await off.links.send('bob@example.test', PERSON)), ['E100']);
  assert.equal(outbox?.sent().length, 0);
  assert.deepEqual(store.names(), []);
});

test('EML-T009 the store and the audit log keep no link token; the audit log keeps no address', async () => {
  const { links, outbox, store, auditLog } = setup();
  value(await links.send('bob@example.test', PERSON));
  const token = (outbox?.lastLink() ?? '').split('#t=')[1] ?? '';
  const kept = store.names().map((n) => store.peek(n) ?? '').join('\n');
  assert.ok(token.length === 43 && !kept.includes(token));
  assert.ok(!JSON.stringify(auditLog.entries()).includes('bob@'));
});

test('EML-T010 private email with a password: made once per address, unverified, and signed in by password', () => {
  const { accounts } = setup();
  assert.deepEqual(codes(createUserWithEmailAndPassword(accounts, SETTINGS, 'bob@example.test', 'short', PERSON)), ['A310']);
  assert.deepEqual(value(accounts.list()), []);
  const made = value(createUserWithEmailAndPassword(accounts, SETTINGS, 'Bob@example.test', 'correct horse', PERSON));
  assert.equal(made.account.signIns[0]?.email_verified, false);
  assert.equal(made.account.hasPassword, true);
  assert.deepEqual(codes(createUserWithEmailAndPassword(accounts, SETTINGS, 'bob@example.test', 'another one', PERSON)), ['A202']);
  assert.equal(value(signInWithEmailAndPassword(accounts, 'bob@example.test', 'correct horse', PERSON)).account.id, made.account.id);
  assert.deepEqual(codes(signInWithEmailAndPassword(accounts, 'bob@example.test', 'wrong horse', PERSON)), ['A311']);
  assert.deepEqual(codes(signInWithEmailAndPassword(accounts, 'ada@example.test', 'correct horse', PERSON)), ['A206']);
});

test('EML-T011 a link for an address someone signed up with a password verifies it and clears that password', async () => {
  const { accounts, links, outbox } = setup();
  const made = value(createUserWithEmailAndPassword(accounts, SETTINGS, 'bob@example.test', 'set by someone', PERSON));
  value(await links.send('bob@example.test', PERSON));
  const opened = value(links.verify(outbox?.lastLink(), PERSON));
  assert.equal(opened.account.id, made.account.id);
  assert.equal(opened.account.signIns[0]?.email_verified, true);
  assert.equal(opened.account.hasPassword, false);
  assert.deepEqual(codes(signInWithEmailAndPassword(accounts, 'bob@example.test', 'set by someone', PERSON)), ['A313']);
});

test('EML-T012 ended links are swept when the product starts', async () => {
  const { links, clock, store } = setup();
  value(await links.send('bob@example.test', PERSON));
  value(await links.send('ada@example.test', PERSON));
  assert.equal(links.store.purgeExpired(), 0);
  clock.advance(16 * 60_000);
  assert.equal(links.store.purgeExpired(), 2);
  assert.ok(!store.names().some((n) => n.startsWith('link-')));
});
