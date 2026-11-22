// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Each person's counts: what the meter added for them, by export interval and probe, kept in the vault until it is
 * exported or they say no.
 *
 * Spec: docs/design.md § Telemetry › Counting
 * Source of truth: the product's vault (`telemetry-counts-<account>` items)
 * @feature accounts-telemetry
 * @address telemetry.consent.counts
 *
 * How it works. One item per person, `telemetry-counts-<account>`, holds interval start (YYYY-MM-DD) → probe key
 * (`id@version`) → series (`metric` or `metric/attribute`) → count. An absent item reads as empty, and writing an
 * empty set removes the item, so a person with nothing counted has nothing kept.
 */
import { type Documents, type Result, anyObject, ok } from '@accounts/core';

export const COUNTS_PREFIX = 'telemetry-counts-';

/** Counts kept for one person: interval start (YYYY-MM-DD) → probe key (`id@version`) → series → count. */
export type CountsByInterval = Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>>;

/** Reads one person's counts document; an absent one is empty. */
export function readCounts(docs: Documents, account: string): Result<CountsByInterval> {
  const name = `${COUNTS_PREFIX}${account}`;
  if (!docs.has(name)) return ok({});
  const r = docs.read(name, anyObject);
  return r.ok ? ok((r.value['intervals'] ?? {}) as CountsByInterval) : r;
}

/** Writes one person's counts, removing the item when nothing is left. */
export function writeCounts(docs: Documents, account: string, intervals: CountsByInterval): Result<true> {
  const name = `${COUNTS_PREFIX}${account}`;
  if (Object.keys(intervals).length === 0) return docs.has(name) ? docs.remove(name) : ok(true);
  return docs.write(name, { format: 'accounts-telemetry-counts/1', account, intervals });
}
