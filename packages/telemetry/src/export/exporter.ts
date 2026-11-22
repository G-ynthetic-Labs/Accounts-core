// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The metric exporter port, where an export batch goes, and the simulated exporter that stands in for it. A product
 * plugs in its own exporter (the owner's choice of service, through a connector); until then nothing leaves.
 *
 * Spec: docs/design.md § Telemetry › Export · OpenTelemetry metrics (MetricExporter, in name only)
 * Source of truth: the product's exporter (an owner item)
 * @feature accounts-telemetry
 * @address telemetry.export.exporter
 *
 * How it works. A batch holds one probe at one version, one export interval, and the counts added up across every
 * person on this computer who said yes, with every series below the owner's suppression threshold left out (and only
 * how many were left out said). It holds no account, no person, no time but the interval's days. `MetricExporter`
 * takes one batch and resolves true, or false when it could not take it. `SimulatedExporter` keeps what it was given
 * in memory and can be told to fail the next one.
 */

/** One count in a batch. */
export interface ExportedDataPoint {
  readonly series: string;
  readonly count: number;
}

/** One export batch (see the header). */
export interface ExportBatch {
  readonly schema: 'accounts-telemetry-batch/1';
  readonly probe: string;
  readonly version: number;
  readonly interval: { readonly start: string; readonly end: string };
  readonly dataPoints: readonly ExportedDataPoint[];
  readonly suppressedSeries: number;
}

/** Where batches go. */
export interface MetricExporter {
  export(batch: ExportBatch): Promise<boolean>;
}

/** SIMULATED: keeps batches in memory; nothing leaves the computer. */
export class SimulatedExporter implements MetricExporter {
  readonly batches: ExportBatch[] = [];
  #failNext = false;

  async export(batch: ExportBatch): Promise<boolean> {
    if (this.#failNext) {
      this.#failNext = false;
      return false;
    }
    this.batches.push(structuredClone(batch));
    return true;
  }

  /** Makes the next export fail. */
  failNext(): void {
    this.#failNext = true;
  }
}
