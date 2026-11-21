// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * A result and its issues: every expected failure is returned, never thrown, so a caller sees every problem at once.
 * The shape is the same as Poly's kernel (`{ ok, value }` or `{ ok, issues }`), so a product's own store or record
 * that returns Poly results fits the ports here without a wrapper.
 *
 * Spec: docs/design.md § Results and codes
 * Source of truth: this file
 * @feature accounts-core
 * @address core.base.result
 *
 * How it works. `ok` and `fail` build the two shapes; `fail` refuses an empty list, so a failure always says why.
 * An `Issue` is a stable code (its meaning is in `codes.ts`), a JSON Pointer to where it is, and an optional plain
 * detail that never holds a secret, a token, an address or a password. `AccountsError` is thrown only for a bug.
 */

export interface Issue {
  readonly code: string;
  readonly path: string;
  readonly detail?: string;
}

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Fail = { readonly ok: false; readonly issues: readonly Issue[] };
export type Result<T> = Ok<T> | Fail;

/** A success. */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/** A failure; at least one issue is required. */
export function fail(issues: readonly Issue[]): Fail {
  if (issues.length === 0) throw new AccountsError('A-BUG', 'a failure needs at least one issue');
  return { ok: false, issues: Object.freeze([...issues]) };
}

/** One issue. */
export function issue(code: string, path: string, detail?: string): Issue {
  return Object.freeze(detail === undefined ? { code, path } : { code, path, detail });
}

/** A failure of one issue. */
export const refuse = (code: string, path = '', detail?: string): Fail => fail([issue(code, path, detail)]);

/** The codes of a result, empty on success; what the audit log keeps. */
export const codesOf = (r: Result<unknown>): readonly string[] => (r.ok ? [] : [...new Set(r.issues.map((i) => i.code))]);

/** Thrown only for a programming error, never for an expected refusal. */
export class AccountsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${code}: ${message}`);
    this.name = 'AccountsError';
    this.code = code;
  }
}
