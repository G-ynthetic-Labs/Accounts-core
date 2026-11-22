// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Accounts telemetry: disclosed, aggregate-only counts from probes (adapter-lib), kept only for people who said yes
 * and sent only when a person sends them.
 *
 * Source of truth: the parts it re-exports
 * @feature accounts-telemetry
 */
export * from './probe/index.ts';
export * from './consent/index.ts';
export * from './export/index.ts';
