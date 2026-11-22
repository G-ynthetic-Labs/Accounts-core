// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Exporting counts: a person sees exactly what would be sent, sends it, and can read the history of every batch sent
 * from this computer. Only a person sends; an assistant cannot.
 *
 * Spec: docs/design.md § Telemetry › Export · D-145, D-208 (only a person approves)
 * Source of truth: the product's exporter; the vault (`telemetry-counts-…`, `telemetry-exports`)
 * @feature accounts-telemetry
 * @address telemetry.export.telemetry-export
 *
 * How it works. `preview()` builds the batches (T110 when telemetry is off) without changing anything. `export(actor)`
 * is person only; it builds the same batches (T201 when there are none) and hands each with at least one data point
 * to the exporter in order. For each one taken it writes the batch to the history and removes those counts from
 * every person's counts, in one recorded change (`telemetry-export`); a batch with every series suppressed is
 * dropped the same way, since it would never be sent. When the exporter cannot take a batch it stops: that batch and
 * the rest stay counted (T200), and nothing is lost. `history()` gives every batch sent, oldest first.
 */
import { type Actor, type Documents, type RawSettings, type Result, anyObject, iso, ok, personOnly, refuse } from '@accounts/core';
import { COUNTS_PREFIX, type CountsByInterval, readCounts, writeCounts } from '../consent/counts.ts';
import { type ProbeRegistry, readTelemetrySettings } from '../probe/registry.ts';
import { type PendingBatch, buildBatches } from './batches.ts';
import type { ExportBatch, MetricExporter } from './exporter.ts';

const HISTORY = 'telemetry-exports';

/** One batch in the history. */
export interface ExportRecord {
  readonly exportedAt: string;
  readonly batch: ExportBatch;
}

/** The export step (see the header). */
export class TelemetryExport {
  readonly #docs: Documents;
  readonly #probes: ProbeRegistry;
  readonly #settings: RawSettings;
  readonly #exporter: MetricExporter;

  constructor(o: { readonly docs: Documents; readonly probes: ProbeRegistry; readonly settings: RawSettings; readonly exporter: MetricExporter }) {
    this.#docs = o.docs;
    this.#probes = o.probes;
    this.#settings = o.settings;
    this.#exporter = o.exporter;
  }

  /** Exactly what would be sent now. */
  preview(): Result<ExportBatch[]> {
    const p = this.#pending();
    return p.ok ? ok(p.value.map((x) => x.batch)) : p;
  }

  /** Every batch sent from this computer, oldest first. */
  history(): Result<ExportRecord[]> {
    if (!this.#docs.has(HISTORY)) return ok([]);
    const r = this.#docs.read(HISTORY, anyObject);
    return r.ok ? ok([...((r.value['exports'] ?? []) as ExportRecord[])]) : r;
  }

  /** A person sends what is ready (see the header). Resolves to how many batches were sent. */
  async export(actor: Actor): Promise<Result<number>> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused('telemetry-export', null, who);
    const pending = this.#pending();
    if (!pending.ok) return pending;
    if (pending.value.length === 0) return refuse('T201');
    let sent = 0;
    for (const p of pending.value) {
      const send = p.batch.dataPoints.length > 0;
      if (send && !(await this.#exporter.export(p.batch))) return this.#docs.refused('telemetry-export', null, refuse('T200', '/exporter', `${sent} sent before it stopped`));
      const done = this.#docs.change('telemetry-export', null, () => this.#settle(p, send));
      if (!done.ok) return done;
      if (send) sent += 1;
    }
    return ok(sent);
  }

  #pending(): Result<PendingBatch[]> {
    const s = readTelemetrySettings(this.#settings);
    if (!s.ok) return s;
    return buildBatches(this.#docs, this.#probes, s.value, this.#docs.clock.now());
  }

  #settle(p: PendingBatch, sent: boolean): Result<true> {
    const [start = '', key = ''] = p.source.split('|');
    if (sent) {
      const h = this.history();
      if (!h.ok) return h;
      const kept = this.#docs.write(HISTORY, { format: 'accounts-telemetry-exports/1', exports: [...h.value, { exportedAt: iso(this.#docs.clock.now()), batch: p.batch }] });
      if (!kept.ok) return kept;
    }
    for (const name of this.#docs.list(COUNTS_PREFIX)) {
      const account = name.slice(COUNTS_PREFIX.length);
      const c = readCounts(this.#docs, account);
      if (!c.ok) return c;
      const byProbe = c.value[start];
      if (byProbe === undefined || byProbe[key] === undefined) continue;
      const left = Object.fromEntries(Object.entries(byProbe).filter(([k]) => k !== key));
      const next: Record<string, CountsByInterval[string]> = { ...c.value };
      if (Object.keys(left).length > 0) next[start] = left;
      else delete next[start];
      const w = writeCounts(this.#docs, account, next);
      if (!w.ok) return w;
    }
    return ok(true);
  }
}
