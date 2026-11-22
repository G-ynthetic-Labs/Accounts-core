// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The consent part of telemetry: consent per person per probe, and the meter that counts only with it.
 *
 * Source of truth: the parts it re-exports
 * @feature accounts-telemetry
 */
export { Consent } from './consent.ts';
export type { ConsentGiven } from './consent.ts';
export { COUNTS_PREFIX } from './counts.ts';
export type { CountsByInterval } from './counts.ts';
export { Meter, intervalOf } from './meter.ts';
export type { ExportInterval, Recorded } from './meter.ts';
