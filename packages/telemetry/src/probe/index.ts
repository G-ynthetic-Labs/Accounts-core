// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The probe part of telemetry: the registry, the owner's settings, the codes and the disclosure.
 *
 * Source of truth: the parts it re-exports
 * @feature accounts-telemetry
 */
export { ProbeRegistry, TELEMETRY_CODES, probeKey, readTelemetrySettings } from './registry.ts';
export type { TelemetryCode, TelemetrySettings } from './registry.ts';
export { disclosureOf, disclosureText } from './disclosure.ts';
export type { DisclosedMetric, Disclosure } from './disclosure.ts';
