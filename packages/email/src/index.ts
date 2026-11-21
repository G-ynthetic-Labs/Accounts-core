// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Email sign-in: the private-email way in, by password on this computer or by optional one-time links.
 *
 * Spec: docs/design.md § Email sign-in
 * Source of truth: the parts it re-exports
 * @feature accounts-email
 */
export * from './link/index.ts';
export * from './mail/index.ts';
export * from './flow/index.ts';
