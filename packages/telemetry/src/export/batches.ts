// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Builds export batches: the counts of every ended export interval, added up across everyone on this computer, with
 * small counts suppressed so that no one person's behaviour can be read from a batch.
 *
 * Spec: docs/design.md § Telemetry › Export (suppression below the owner's threshold)
 * Source of truth: the people's counts in the vault; the deployment's settings (`telemetry.suppressionThreshold`)
 * @feature accounts-telemetry
 * @address telemetry.export.batches
 *
 * How it works. `buildBatches(docs, probes, settings, nowMs)` reads every `telemetry-counts-…` item, keeps only
 * intervals that have ended (their end day is at or before today), and only for probes still registered at that
 * version, then adds the counts up by interval, probe and series. A series whose total is below
 * `suppressionThreshold` is left out and counted in `suppressedSeries`. A batch whose every series was suppressed is
 * still made, so the person can see that nothing would be sent for it. Batches come sorted by interval, then probe.
 */
import type { Documents, Result } from '@accounts/core';
import { ok } from '@accounts/core';
import { COUNTS_PREFIX, readCounts } from '../consent/counts.ts';
import { type ProbeRegistry, type TelemetrySettings, probeKey } from '../probe/registry.ts';
import { intervalOf } from '../consent/meter.ts';
import type { ExportBatch } from './exporter.ts';

const DAY_MS = 86_400_000;

/** A batch and the people's counts it came from. */
export interface PendingBatch {
  readonly batch: ExportBatch;
  /** `<interval start>|<probe key>`: what to remove from each person's counts once sent. */
  readonly source: string;
}

/** The batches ready to export (see the header). */
export function buildBatches(docs: Documents, probes: ProbeRegistry, settings: TelemetrySettings, nowMs: number): Result<PendingBatch[]> {
  const live = new Map(probes.list().map((p) => [probeKey(p), p]));
  const totals = new Map<string, Map<string, number>>();
  for (const name of docs.list(COUNTS_PREFIX)) {
    const counts = readCounts(docs, name.slice(COUNTS_PREFIX.length));
    if (!counts.ok) return counts;
    for (const [start, byProbe] of Object.entries(counts.value)) {
      if (Date.parse(`${start}T00:00:00Z`) + settings.exportIntervalDays * DAY_MS > nowMs) continue;
      for (const [key, series] of Object.entries(byProbe)) {
        if (!live.has(key)) continue;
        const t = totals.get(`${start}|${key}`) ?? new Map<string, number>();
        for (const [s, n] of Object.entries(series)) t.set(s, (t.get(s) ?? 0) + n);
        totals.set(`${start}|${key}`, t);
      }
    }
  }
  const out: PendingBatch[] = [];
  for (const source of [...totals.keys()].sort()) {
    const [start = '', key = ''] = source.split('|');
    const p = live.get(key);
    if (p === undefined) continue;
    const all = [...(totals.get(source) ?? new Map<string, number>()).entries()].sort(([a], [b]) => a.localeCompare(b));
    const kept = all.filter(([, n]) => n >= settings.suppressionThreshold);
    const interval = intervalOf(Date.parse(`${start}T00:00:00Z`), settings.exportIntervalDays);
    out.push(Object.freeze({
      source,
      batch: Object.freeze({
        schema: 'accounts-telemetry-batch/1', probe: p.id, version: p.version, interval: Object.freeze({ start: interval.start, end: interval.end }),
        dataPoints: Object.freeze(kept.map(([series, count]) => Object.freeze({ series, count }))), suppressedSeries: all.length - kept.length,
      }) as ExportBatch,
    }));
  }
  return ok(out);
}
