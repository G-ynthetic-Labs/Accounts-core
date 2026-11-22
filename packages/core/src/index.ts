// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Accounts core: accounts kept on the person's own computer, sealed through the product's store, with sessions,
 * passwords and an audit log of every change. Only a person changes an account.
 *
 * Spec: docs/design.md
 * Source of truth: the parts it re-exports
 * @feature accounts-core
 */
export * from './base/index.ts';
export * from './local/index.ts';
export * from './account/index.ts';
