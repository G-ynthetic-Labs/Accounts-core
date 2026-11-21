// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The probes a product runs, each checked against the probe contract before it is taken, and the telemetry codes.
 *
 * Spec: docs/design.md § Telemetry › Probes · adapter-lib telemetry/contract.js
 * Source of truth: the product's list of probes (from adapter-lib); the deployment's settings (`telemetry`)
 * @feature accounts-telemetry
 * @address telemetry.probe.registry
 *
 * How it works. `ProbeRegistry.register` runs the contract's `probeProblems` and refuses a probe that fails it (T100)
 * or whose id is taken (T101), so a product can never run a probe the contract would refuse. `readTelemetrySettings`
 * needs `enabled: true` (T110 otherwise: telemetry is off and nothing is counted) and the owner's whole numbers
 * `exportIntervalDays` and `suppressionThreshold` (A100/A101). `probeKey` names a probe at its version, because a
 * new version is asked for again.
 */
import { type RawSettings, type Result, fail, issue, ok, refuse, section, wholeNumbers } from '@accounts/core';
import { probeProblems, type TelemetryProbe } from 'adapter-lib/telemetry-contract';

/** What a telemetry code tells the person. */
export const TELEMETRY_CODES = Object.freeze({
  T100: { says: 'That probe does not meet the telemetry contract, so it is not run.' },
  T101: { says: 'A probe with that name is already running.' },
  T102: { says: 'There is no probe with that name.' },
  T110: { says: 'Telemetry is turned off here, so nothing is counted or sent.' },
  T200: { says: 'The counts could not be sent; they are kept and nothing was lost.' },
  T201: { says: 'There is nothing to send yet.' },
} as const);

export type TelemetryCode = keyof typeof TELEMETRY_CODES;

/** The owner's telemetry settings. */
export interface TelemetrySettings {
  readonly exportIntervalDays: number;
  readonly suppressionThreshold: number;
}

/** The owner's settings, or every reason they cannot be used. */
export function readTelemetrySettings(settings: RawSettings): Result<TelemetrySettings> {
  const t = section(settings, 'telemetry');
  if (t['enabled'] !== true) return refuse('T110', '/telemetry/enabled');
  return wholeNumbers(t, ['exportIntervalDays', 'suppressionThreshold'] as const, '/telemetry');
}

/** A probe at its version: `<id>@<version>`. */
export const probeKey = (p: TelemetryProbe): string => `${p.id}@${p.version}`;

/** The probes this product runs. */
export class ProbeRegistry {
  readonly #probes = new Map<string, TelemetryProbe>();

  /** Takes a probe that meets the contract. */
  register(probe: unknown): Result<TelemetryProbe> {
    const problems = probeProblems(probe);
    if (problems.length > 0) return fail(problems.map((p) => issue('T100', '/probe', p)));
    const p = probe as TelemetryProbe;
    if (this.#probes.has(p.id)) return refuse('T101', '/probe/id');
    this.#probes.set(p.id, p);
    return ok(p);
  }

  /** One probe by id. */
  get(id: string): Result<TelemetryProbe> {
    const p = this.#probes.get(id);
    return p === undefined ? refuse('T102', '/probe') : ok(p);
  }

  /** Every probe, by id. */
  list(): TelemetryProbe[] {
    return [...this.#probes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
