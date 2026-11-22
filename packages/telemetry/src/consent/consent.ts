// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Consent, per person and per probe: off until the person turns it on, for that probe's version only, and turning it
 * off deletes what was counted for them. Only a person changes it.
 *
 * Spec: docs/design.md § Telemetry › Consent · D-145, D-208 (only a person decides)
 * Source of truth: the product's vault (`telemetry-consent-<account>` items; counts in counts.ts)
 * @feature accounts-telemetry
 * @address telemetry.consent.consent
 *
 * How it works. `grant(account, probe, actor)` is person only (A110/A111) and keeps the probe's id, version and when
 * consent was given, recorded in the audit log as `telemetry-consent-grant`. `hasConsent` is true only for the same
 * version, so a probe that changes what it counts is asked for again. `revoke` is person only, removes the consent
 * and deletes that probe's counts for the person in the same change (`telemetry-consent-revoke`). An account with no
 * consent item has said yes to nothing.
 */
import { type Actor, type Documents, type Result, anyObject, iso, ok, personOnly } from '@accounts/core';
import type { TelemetryProbe } from 'adapter-lib/telemetry-contract';
import { readCounts, writeCounts } from './counts.ts';

const FORMAT = 'accounts-telemetry-consent/1';
export const CONSENT_PREFIX = 'telemetry-consent-';

/** One consent given. */
export interface ConsentGiven {
  readonly version: number;
  readonly grantedAt: string;
}

interface ConsentDoc {
  readonly format: typeof FORMAT;
  readonly account: string;
  readonly probes: Readonly<Record<string, ConsentGiven>>;
}

/** Consent per person per probe (see the header). */
export class Consent {
  readonly #docs: Documents;

  constructor(docs: Documents) {
    this.#docs = docs;
  }

  /** What the person has said yes to. */
  given(account: string): Result<Readonly<Record<string, ConsentGiven>>> {
    const name = `${CONSENT_PREFIX}${account}`;
    if (!this.#docs.has(name)) return ok({});
    const r = this.#docs.read(name, anyObject);
    return r.ok ? ok((r.value['probes'] ?? {}) as Readonly<Record<string, ConsentGiven>>) : r;
  }

  /** True only when the person said yes to this probe at this version. */
  hasConsent(account: string, probe: TelemetryProbe): boolean {
    const g = this.given(account);
    return g.ok && g.value[probe.id]?.version === probe.version;
  }

  /** The person says yes to one probe. */
  grant(account: string, probe: TelemetryProbe, actor: Actor): Result<ConsentGiven> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused('telemetry-consent-grant', account, who);
    const g = this.given(account);
    if (!g.ok) return g;
    const given: ConsentGiven = Object.freeze({ version: probe.version, grantedAt: iso(this.#docs.clock.now()) });
    const doc: ConsentDoc = { format: FORMAT, account, probes: { ...g.value, [probe.id]: given } };
    const kept = this.#docs.change('telemetry-consent-grant', account, () => this.#docs.write(`${CONSENT_PREFIX}${account}`, doc));
    return kept.ok ? ok(given) : kept;
  }

  /** The person says no to one probe; what was counted for them by it is deleted. */
  revoke(account: string, probeId: string, actor: Actor): Result<true> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused('telemetry-consent-revoke', account, who);
    const g = this.given(account);
    if (!g.ok) return g;
    const counts = readCounts(this.#docs, account);
    if (!counts.ok) return counts;
    const rest = Object.fromEntries(Object.entries(g.value).filter(([id]) => id !== probeId));
    const kept: Record<string, Record<string, Readonly<Record<string, number>>>> = {};
    for (const [start, byProbe] of Object.entries(counts.value)) {
      const left = Object.fromEntries(Object.entries(byProbe).filter(([key]) => !key.startsWith(`${probeId}@`)));
      if (Object.keys(left).length > 0) kept[start] = left;
    }
    return this.#docs.change('telemetry-consent-revoke', account, () => {
      const c = writeCounts(this.#docs, account, kept);
      if (!c.ok) return c;
      const name = `${CONSENT_PREFIX}${account}`;
      if (Object.keys(rest).length === 0) return this.#docs.has(name) ? this.#docs.remove(name) : ok(true);
      return this.#docs.write(name, { format: FORMAT, account, probes: rest });
    });
  }
}
