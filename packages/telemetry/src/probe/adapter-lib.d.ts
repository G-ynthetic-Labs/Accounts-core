// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Types for the telemetry probe contract and the shared probes, which adapter-lib ships as plain JavaScript (no build
 * step, no types).
 *
 * Spec: vendor/adapter-lib/telemetry/contract.js (the contract this declares, unchanged)
 * Source of truth: adapter-lib, pinned as the submodule vendor/adapter-lib
 * @feature accounts-telemetry
 * @address telemetry.probe.types
 *
 * How it works. Declares only what the contract exports and the probe shape it checks; the checks themselves run in
 * adapter-lib's code, never copied here.
 */
declare module 'adapter-lib/telemetry-contract' {
  /** One metric: a counter with a description and at most one attribute of fixed values. */
  export interface ProbeMetric {
    readonly description: string;
    readonly attributes?: readonly string[];
  }

  /** What a probe tells the person before they choose. */
  export interface ProbeDisclosure {
    readonly collects: string;
    readonly why: string;
    readonly never: readonly string[];
  }

  /** A telemetry probe (the contract's shape). */
  export interface TelemetryProbe {
    readonly id: string;
    readonly version: number;
    readonly useCase: string;
    readonly title: string;
    readonly disclosure: ProbeDisclosure;
    readonly metrics: Readonly<Record<string, ProbeMetric>>;
    observe(event: unknown): unknown;
  }

  /** One increment a probe asked for, after the contract's check. */
  export interface Increment {
    readonly metric: string;
    readonly attribute: string | null;
  }

  export function probeProblems(probe: unknown): string[];
  export function readObservation(probe: TelemetryProbe, out: unknown): { readonly increments: Increment[]; readonly problems: string[] };
  export function dataPoints(probe: TelemetryProbe): Increment[];
  export function seriesKey(metric: string, attribute: string | null | undefined): string;
}

declare module 'adapter-lib/telemetry' {
  import type { TelemetryProbe } from 'adapter-lib/telemetry-contract';
  /** The sign-in probe: ways in and kinds of refusal. */
  export const signInProbe: TelemetryProbe;
  /** Every shared probe. */
  export const PROBES: readonly TelemetryProbe[];
}
