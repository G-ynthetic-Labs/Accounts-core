// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The export part of telemetry: the exporter port, the batches and the person-approved export.
 *
 * Source of truth: the parts it re-exports
 * @feature accounts-telemetry
 */
export { SimulatedExporter } from './exporter.ts';
export type { ExportBatch, ExportedDataPoint, MetricExporter } from './exporter.ts';
export { buildBatches } from './batches.ts';
export type { PendingBatch } from './batches.ts';
export { TelemetryExport } from './telemetry-export.ts';
export type { ExportRecord } from './telemetry-export.ts';
