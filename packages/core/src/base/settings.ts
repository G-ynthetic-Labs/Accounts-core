// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The owner's settings: every number the accounts module needs (how long a session lasts, how hard a password is
 * to guess, how many wrong tries pause sign-in) comes from the deployment. Nothing is chosen here; unset refuses.
 *
 * Spec: docs/design.md § Owner settings · POL-INTEGRITY-001 (no invented numbers; unset refuses)
 * Source of truth: the deployment's settings (docs/owner-items.md lists every name)
 * @feature accounts-core
 * @address core.base.settings
 *
 * How it works. `wholeNumbers(raw, names, path)` reads the named members of a settings object and gives them back
 * only when every one is a safe whole number above zero: a missing one is A100 (the detail lists every missing
 * name, so the owner sees them all at once), a wrong one A101. `section` picks a nested settings object, giving an
 * empty object when it is absent so the missing names are still listed. Settings are read when they are used, so a
 * deployment that never turns on a part never has to set its numbers.
 */
import { type Issue, type Result, fail, issue, ok } from './result.ts';

/** A plain settings object, as the deployment wrote it. */
export type RawSettings = Readonly<Record<string, unknown>>;

const isObject = (v: unknown): v is RawSettings => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The nested settings object `name`, or an empty one. */
export function section(raw: unknown, name: string): RawSettings {
  const r = isObject(raw) ? raw[name] : undefined;
  return isObject(r) ? r : {};
}

/** The named whole numbers, or every reason they cannot be used. */
export function wholeNumbers<const K extends string>(raw: unknown, names: readonly K[], path = ''): Result<Readonly<Record<K, number>>> {
  const r = isObject(raw) ? raw : {};
  const missing = names.filter((n) => r[n] === undefined || r[n] === null);
  const wrong = names.filter((n) => !missing.includes(n) && !(typeof r[n] === 'number' && Number.isSafeInteger(r[n]) && (r[n] as number) > 0));
  const issues: Issue[] = [];
  if (missing.length > 0) issues.push(issue('A100', path, `not set: ${missing.join(', ')}`));
  for (const n of wrong) issues.push(issue('A101', `${path}/${n}`));
  if (issues.length > 0) return fail(issues);
  return ok(Object.freeze(Object.fromEntries(names.map((n) => [n, r[n] as number]))) as Readonly<Record<K, number>>);
}

/** True when a setting is a non-empty string. */
export const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
