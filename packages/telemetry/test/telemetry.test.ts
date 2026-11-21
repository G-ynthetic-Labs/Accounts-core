// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Tests of accounts telemetry with adapter-lib's real sign-in probe, a SIMULATED vault, audit log and exporter, and
 * synthetic `.test` people only: settings, the registry, disclosure, consent, the meter, suppression and export.
 *
 * Source of truth: docs/design.md § Telemetry
 * @feature accounts-telemetry
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type AuditEvent, Documents, MemoryAuditLog, MemoryVault, PERSON, type Result, steppingClock } from '@accounts/core';
import { signInProbe } from 'adapter-lib/telemetry';
import { Consent, Meter, ProbeRegistry, SimulatedExporter, TELEMETRY_CODES, TelemetryExport, disclosureOf, disclosureText, intervalOf, readTelemetrySettings } from '../src/index.ts';

const T0 = Date.parse('2026-11-21T12:00:00Z');
const DAY = 86_400_000;
const ON = { telemetry: { enabled: true, exportIntervalDays: 7, suppressionThreshold: 2 } };
const ASSISTANT = { kind: 'assistant' } as const;
const A = 'acct-00000000000000000000000000000001';
const B = 'acct-00000000000000000000000000000002';
const IN = { type: 'sign-in', method: 'google', outcome: 'done', email: 'ada@example.test' };

function setup(settings: Readonly<Record<string, unknown>> = ON) {
  const store = new MemoryVault();
  const auditLog = new MemoryAuditLog<AuditEvent>();
  const clock = steppingClock(T0, 0);
  const docs = new Documents(store, auditLog, clock);
  const probes = new ProbeRegistry();
  value(probes.register(signInProbe));
  const consent = new Consent(docs);
  const meter = new Meter({ docs, probes, consent, settings });
  const exporter = new SimulatedExporter();
  const out = new TelemetryExport({ docs, probes, settings, exporter });
  return { store, auditLog, clock, docs, probes, consent, meter, exporter, out };
}
const value = <T>(r: Result<T>): T => {
  if (!r.ok) assert.fail(`expected ok, got ${JSON.stringify(r.issues)}`);
  return r.value;
};
const codes = (r: Result<unknown>): string[] => (r.ok ? [] : r.issues.map((i) => i.code));

test('TEL-T001 telemetry is off until the owner turns it on and sets every number; every code has plain words', () => {
  assert.deepEqual(codes(readTelemetrySettings({})), ['T110']);
  assert.deepEqual(codes(readTelemetrySettings({ telemetry: { enabled: 'yes', exportIntervalDays: 7, suppressionThreshold: 2 } })), ['T110']);
  assert.deepEqual(codes(readTelemetrySettings({ telemetry: { enabled: true } })), ['A100']);
  assert.deepEqual(codes(readTelemetrySettings({ telemetry: { enabled: true, exportIntervalDays: 0, suppressionThreshold: 2 } })), ['A101']);
  for (const m of Object.values(TELEMETRY_CODES)) assert.ok(m.says.endsWith('.'));
  const { meter, consent } = setup({});
  value(consent.grant(A, signInProbe, PERSON));
  assert.deepEqual(codes(meter.record(A, IN)), ['T110']);
});

test('TEL-T002 only probes that meet the contract are run, once each', () => {
  const r = new ProbeRegistry();
  assert.deepEqual(codes(r.register({ id: 'Bad Id', metrics: {} })).every((c) => c === 'T100'), true);
  value(r.register(signInProbe));
  assert.deepEqual(codes(r.register(signInProbe)), ['T101']);
  assert.deepEqual(codes(r.get('nope')), ['T102']);
});

test('TEL-T003 the disclosure is the probe\'s own words and every count it can make, also as plain text', () => {
  const d = disclosureOf(signInProbe);
  assert.equal(d.collects, signInProbe.disclosure.collects);
  assert.deepEqual(d.never, signInProbe.disclosure.never);
  assert.deepEqual(d.metrics.map((m) => m.name), ['sign-ins', 'refusals']);
  const text = disclosureText(d);
  for (const n of signInProbe.disclosure.never) assert.ok(text.includes(`- ${n}`));
  assert.ok(text.includes('magic-link'));
  assert.ok(text.endsWith(`Probe sign-in, version ${signInProbe.version}.\n`));
});

test('TEL-T004 nothing is counted before a person says yes; an assistant cannot say yes or no', () => {
  const { meter, consent, auditLog } = setup();
  assert.deepEqual(value(meter.record(A, IN)), { added: 0, dropped: [] });
  assert.deepEqual(codes(consent.grant(A, signInProbe, ASSISTANT)), ['A110']);
  assert.equal(consent.hasConsent(A, signInProbe), false);
  value(consent.grant(A, signInProbe, PERSON));
  assert.equal(consent.hasConsent(A, signInProbe), true);
  assert.equal(consent.hasConsent(A, { ...signInProbe, version: signInProbe.version + 1 }), false);
  assert.deepEqual(codes(consent.revoke(A, 'sign-in', ASSISTANT)), ['A110']);
  assert.ok(auditLog.entries().some((e) => e.body.action === 'telemetry-consent-grant' && e.body.stage === 'done'));
});

test('TEL-T005 the meter counts only declared counts, per export interval, and keeps nothing else', () => {
  const { meter, consent, store } = setup();
  value(consent.grant(A, signInProbe, PERSON));
  assert.deepEqual(value(meter.record(A, IN)), { added: 1, dropped: [] });
  value(meter.record(A, { type: 'sign-in', method: 'password', outcome: 'refused', reason: 'locked-out' }));
  value(meter.record(A, { type: 'page-view' }));
  const kept = store.peek(`telemetry-counts-${A}`) ?? '';
  const start = intervalOf(T0, 7).start;
  assert.deepEqual(JSON.parse(kept).intervals, { [start]: { 'sign-in@1': { 'sign-ins/google': 1, 'refusals/locked-out': 1 } } });
  assert.ok(!kept.includes('ada@example.test'));
  assert.deepEqual(intervalOf(Date.parse('2026-11-21T00:00:00Z'), 7), intervalOf(Date.parse('2026-11-25T23:59:59Z'), 7));
  assert.equal(intervalOf(T0, 1).start, '2026-11-21');
});

test('TEL-T006 saying no deletes what that probe counted for the person, and only that', () => {
  const { meter, consent, store } = setup();
  value(consent.grant(A, signInProbe, PERSON));
  value(consent.grant(B, signInProbe, PERSON));
  value(meter.record(A, IN));
  value(meter.record(B, IN));
  value(consent.revoke(A, 'sign-in', PERSON));
  assert.equal(store.peek(`telemetry-counts-${A}`), undefined);
  assert.equal(store.peek(`telemetry-consent-${A}`), undefined);
  assert.ok(store.peek(`telemetry-counts-${B}`) !== undefined);
  assert.deepEqual(value(meter.record(A, IN)), { added: 0, dropped: [] });
});

test('TEL-T007 only ended intervals are exported, added up across people, with small counts suppressed', async () => {
  const { meter, consent, out, exporter, clock } = setup();
  for (const who of [A, B]) value(consent.grant(who, signInProbe, PERSON));
  value(meter.record(A, IN));
  value(meter.record(B, IN));
  value(meter.record(A, { type: 'sign-in', method: 'github', outcome: 'done' }));
  assert.deepEqual(value(out.preview()), []);
  assert.deepEqual(codes(await out.export(PERSON)), ['T201']);
  clock.advance(7 * DAY);
  const [batch] = value(out.preview());
  assert.deepEqual(batch?.dataPoints, [{ series: 'sign-ins/google', count: 2 }]);
  assert.equal(batch?.suppressedSeries, 1);
  assert.deepEqual(Object.keys(batch ?? {}).sort(), ['dataPoints', 'interval', 'probe', 'schema', 'suppressedSeries', 'version']);
  assert.ok(!JSON.stringify(batch).includes('acct-'));
  assert.equal(exporter.batches.length, 0);
});

test('TEL-T008 only a person exports; what is sent is kept in the history and removed from everyone\'s counts', async () => {
  const { meter, consent, out, exporter, clock, store, auditLog } = setup();
  for (const who of [A, B]) value(consent.grant(who, signInProbe, PERSON));
  value(meter.record(A, IN));
  value(meter.record(B, IN));
  clock.advance(7 * DAY);
  assert.deepEqual(codes(await out.export(ASSISTANT)), ['A110']);
  assert.equal(exporter.batches.length, 0);
  assert.equal(value(await out.export(PERSON)), 1);
  assert.deepEqual(exporter.batches.map((b) => b.dataPoints), [[{ series: 'sign-ins/google', count: 2 }]]);
  assert.equal(value(out.history()).length, 1);
  assert.equal(store.peek(`telemetry-counts-${A}`), undefined);
  assert.equal(store.peek(`telemetry-counts-${B}`), undefined);
  assert.deepEqual(value(out.preview()), []);
  assert.ok(auditLog.entries().some((e) => e.body.action === 'telemetry-export' && e.body.stage === 'done'));
});

test('TEL-T009 when the exporter fails nothing is lost; a batch with every series suppressed is dropped, never sent', async () => {
  const { meter, consent, out, exporter, clock } = setup();
  value(consent.grant(A, signInProbe, PERSON));
  value(consent.grant(B, signInProbe, PERSON));
  value(meter.record(A, IN));
  value(meter.record(B, IN));
  clock.advance(7 * DAY);
  exporter.failNext();
  assert.deepEqual(codes(await out.export(PERSON)), ['T200']);
  assert.equal(value(out.preview()).length, 1);
  assert.equal(value(await out.export(PERSON)), 1);
  value(meter.record(A, IN));
  clock.advance(7 * DAY);
  assert.equal(value(out.preview())[0]?.dataPoints.length, 0);
  assert.equal(value(await out.export(PERSON)), 0);
  assert.equal(exporter.batches.length, 1);
  assert.deepEqual(value(out.preview()), []);
});
