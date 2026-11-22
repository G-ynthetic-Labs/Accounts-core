// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The local part of the accounts core: the ports to the product's vault and audit log, documents in the store,
 * the store check a product runs on its own vault, and the SIMULATED stand-ins.
 *
 * Spec: docs/design.md § The store on the computer
 * Source of truth: the files it re-exports
 * @feature accounts-core
 */
export { ITEM_NAME } from './port.ts';
export type { AuditEvent, AuditLog, SecretValue, Vault } from './port.ts';
export { Documents, anyObject } from './documents.ts';
export { MemorySecretValue, MemoryAuditLog, MemoryVault, canonicalJson } from './memory.ts';
export type { ChainedEntry } from './memory.ts';
export { vaultProblems } from './conformance.ts';
