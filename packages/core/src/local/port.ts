// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The two things the accounts module needs from the product it runs in: a sealed store on the person's computer,
 * and an audit log to append to. The module seals nothing itself; it uses the product's own vault, so there is one way
 * keys are kept, not two.
 *
 * Spec: docs/design.md § The store on the computer · POL-SECURITY-003 (sealed at rest; secrets never print)
 * Source of truth: the product's vault (Poly: `@poly/vault` `Vault`, which fits `Vault` as it is)
 * @feature accounts-core
 * @address core.local.port
 *
 * How it works. `Vault` is four methods with the same names and results as Poly's `Vault`: `put` seals and
 * keeps bytes under a name, `get` gives back a `SecretValue` (a value that lends its bytes to a function and wipes
 * the copy, like the vault's `SecretValue`), `remove` deletes, `names` lists. A store must keep a copy of what it is
 * given and refuse a name it cannot hold; `conformance.ts` checks both. `AuditLog` is one `append`; the
 * product's tamper-evident record fits it. Entries carry kinds, ids and codes only.
 */
import type { Result } from '../base/result.ts';

/** Bytes the store gave back, lent out and wiped (Poly's `SecretValue` fits). */
export interface SecretValue {
  use<T>(fn: (bytes: Buffer) => T): T;
  wipe(): void;
}

/** The product's sealed store on the person's computer (Poly's `Vault` fits). */
export interface Vault {
  put(name: string, bytes: Buffer): Result<true>;
  get(name: string): Result<SecretValue>;
  remove(name: string): Result<true>;
  names(): string[];
}

/** What an accounts entry in the audit log holds: never an address, a subject, a token or a password. */
export interface AuditEvent {
  readonly kind: 'account-change';
  readonly action: string;
  readonly account: string | null;
  readonly stage: 'asked' | 'done' | 'refused';
  readonly codes: readonly string[];
  readonly at: string;
}

/** The one thing the module needs from the product's record. */
export interface AuditLog {
  append(body: AuditEvent): unknown;
}

/**
 * The names the module gives items: lower-case words of letters and digits joined by single hyphens, a letter first,
 * at most 64. That is what Poly's vault both writes and opens again (its file names allow more than its envelopes).
 */
export const ITEM_NAME = /^(?=.{1,64}$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
