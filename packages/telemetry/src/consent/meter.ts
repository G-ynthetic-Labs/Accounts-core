// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The meter: hands each local event to every probe the person said yes to, and adds what comes back to their counts
 * for the current export interval. Nothing is counted for a person who has not said yes, or while telemetry is off.
 *
 * Spec: docs/design.md § Telemetry › Counting · OpenTelemetry metrics (counter, attribute, export interval), in name
 * only; adapter-lib telemetry/contract.js (readObservation)
 * Source of truth: the deployment's settings (`telemetry`); the person's consent
 * @feature accounts-telemetry
 * @address telemetry.consent.meter
 *
 * How it works. `intervalOf(now, days)` gives the export interval a moment falls in: whole UTC days counted from
 * 1970-01-01, cut into blocks of the owner's `exportIntervalDays`; it is named by its first day (YYYY-MM-DD).
 * `record(account, event)` reads the settings (T110 when off), and for each registered probe with consent calls its
 * `observe`; a probe that throws counts nothing. What it gives back goes through the contract's `readObservation`,
 * which drops anything undeclared, and each increment adds one to `<metric>` or `<metric>/<attribute>`. The counts
 * are written without an audit entry (they are counts, not changes to the account) and the answer says how many
 * were added and what was dropped.
 */
import { type Documents, type RawSettings, type Result, ok } from '@accounts/core';
import { readObservation, seriesKey } from 'adapter-lib/telemetry-contract';
import { type ProbeRegistry, probeKey, readTelemetrySettings } from '../probe/registry.ts';
import type { Consent } from './consent.ts';
import { type CountsByInterval, readCounts, writeCounts } from './counts.ts';

const DAY_MS = 86_400_000;

/** An export interval: its first day and the first day after it, as YYYY-MM-DD. */
export interface ExportInterval {
  readonly start: string;
  readonly end: string;
  readonly endMs: number;
}

const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** The export interval a moment falls in (see the header). Pure. */
export function intervalOf(nowMs: number, days: number): ExportInterval {
  const startDay = Math.floor(Math.floor(nowMs / DAY_MS) / days) * days;
  const endMs = (startDay + days) * DAY_MS;
  return Object.freeze({ start: day(startDay * DAY_MS), end: day(endMs), endMs });
}

/** What one event added. */
export interface Recorded {
  readonly added: number;
  readonly dropped: readonly string[];
}

/** The meter (see the header). */
export class Meter {
  readonly #docs: Documents;
  readonly #probes: ProbeRegistry;
  readonly #consent: Consent;
  readonly #settings: RawSettings;

  constructor(o: { readonly docs: Documents; readonly probes: ProbeRegistry; readonly consent: Consent; readonly settings: RawSettings }) {
    this.#docs = o.docs;
    this.#probes = o.probes;
    this.#consent = o.consent;
    this.#settings = o.settings;
  }

  /** Counts one local event for one person (see the header). */
  record(account: string, event: unknown): Result<Recorded> {
    const s = readTelemetrySettings(this.#settings);
    if (!s.ok) return s;
    const probes = this.#probes.list().filter((p) => this.#consent.hasConsent(account, p));
    if (probes.length === 0) return ok({ added: 0, dropped: [] });
    const { start } = intervalOf(this.#docs.clock.now(), s.value.exportIntervalDays);
    const counts = readCounts(this.#docs, account);
    if (!counts.ok) return counts;
    const next: Record<string, Record<string, Record<string, number>>> = structuredClone(counts.value) as Record<string, Record<string, Record<string, number>>>;
    let added = 0;
    const dropped: string[] = [];
    for (const p of probes) {
      let out: unknown;
      try { out = p.observe(event); } catch { dropped.push(`${p.id}: observe() failed`); continue; }
      const { increments, problems } = readObservation(p, out);
      dropped.push(...problems.map((x) => `${p.id}: ${x}`));
      for (const inc of increments) {
        const byProbe = (next[start] ??= {});
        const series = (byProbe[probeKey(p)] ??= {});
        const key = seriesKey(inc.metric, inc.attribute);
        series[key] = (series[key] ?? 0) + 1;
        added += 1;
      }
    }
    if (added > 0) {
      const w = writeCounts(this.#docs, account, next as CountsByInterval);
      if (!w.ok) return w;
    }
    return ok(Object.freeze({ added, dropped: Object.freeze(dropped) }));
  }
}
