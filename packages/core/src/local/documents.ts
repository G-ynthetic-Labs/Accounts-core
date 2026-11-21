// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Documents in the sealed store, and the audit log around every change: accounts, sessions and settings are kept as
 * JSON, one sealed item each, and every change is written to the audit log before it is made.
 *
 * Spec: docs/design.md § The store on the computer · POL-AGENTS-004 (every action recorded)
 * Source of truth: the product's sealed store (port.ts)
 * @feature accounts-core
 * @address core.local.documents
 *
 * How it works. `Documents.read(name, check)` gets an item, parses it inside the store's lending function (so the
 * plain bytes are wiped as soon as it is parsed) and runs `check` over the value: damage is A200. `write` turns a
 * value into JSON bytes, hands them to the store and zeroes the buffer. `has` and `list(prefix)` read the store's
 * names; a name outside `ITEM_NAME` is A401 before the store is asked. `change(action, account, step)` appends an
 * `asked` entry first; if the audit log will not take it the step never runs (A402). After the step it appends `done`
 * or `refused` with the codes, so the audit log shows every attempt and its outcome.
 */
import { iso, type Clock } from '../base/actor.ts';
import { type Result, codesOf, ok, refuse } from '../base/result.ts';
import { type AuditLog, ITEM_NAME, type Vault } from './port.ts';

export class Documents {
  readonly #store: Vault;
  readonly #auditLog: AuditLog;
  readonly #clock: Clock;

  constructor(store: Vault, auditLog: AuditLog, clock: Clock) {
    this.#store = store;
    this.#auditLog = auditLog;
    this.#clock = clock;
  }

  get clock(): Clock {
    return this.#clock;
  }

  /** True when an item of that name is kept. */
  has(name: string): boolean {
    return ITEM_NAME.test(name) && this.#store.names().includes(name);
  }

  /** Every kept name that starts with `prefix`, sorted. */
  list(prefix: string): string[] {
    return this.#store.names().filter((n) => n.startsWith(prefix)).sort();
  }

  /** Reads and checks one document. */
  read<T>(name: string, check: (raw: unknown) => Result<T>): Result<T> {
    if (!ITEM_NAME.test(name)) return refuse('A401', '/name');
    const got = this.#store.get(name);
    if (!got.ok) return got;
    let raw: unknown;
    try {
      raw = got.value.use((b) => JSON.parse(b.toString('utf8')) as unknown);
    } catch {
      return refuse('A200', '/name');
    } finally {
      got.value.wipe();
    }
    const checked = check(raw);
    return checked.ok ? checked : refuse('A200', '/name', checked.issues.map((i) => `${i.code}${i.path}`).join(' '));
  }

  /** Writes one document, replacing any of that name. */
  write(name: string, value: unknown): Result<true> {
    if (!ITEM_NAME.test(name)) return refuse('A401', '/name');
    const bytes = Buffer.from(JSON.stringify(value), 'utf8');
    try {
      return this.#store.put(name, bytes);
    } catch {
      return refuse('A400', '/name');
    } finally {
      bytes.fill(0);
    }
  }

  /** Deletes one document. */
  remove(name: string): Result<true> {
    if (!ITEM_NAME.test(name)) return refuse('A401', '/name');
    try {
      return this.#store.remove(name);
    } catch {
      return refuse('A400', '/name');
    }
  }

  #append(action: string, account: string | null, stage: 'asked' | 'done' | 'refused', codes: readonly string[]): boolean {
    try {
      this.#auditLog.append(Object.freeze({ kind: 'account-change', action, account, stage, codes: Object.freeze([...codes]), at: iso(this.#clock.now()) }));
      return true;
    } catch {
      return false;
    }
  }

  /** Records the attempt, runs the step only if the audit log took it, then records the outcome. */
  change<T>(action: string, account: string | null, step: () => Result<T>): Result<T> {
    if (!this.#append(action, account, 'asked', [])) return refuse('A402');
    const r = step();
    this.#append(action, account, r.ok ? 'done' : 'refused', codesOf(r));
    return r;
  }

  /** Records a refusal that happened before any step (who asked, or a setting). */
  refused<T>(action: string, account: string | null, r: Result<T>): Result<T> {
    if (!r.ok) this.#append(action, account, 'refused', codesOf(r));
    return r;
  }
}

/** A document check that accepts any object; for items whose shape the caller checks itself. */
export const anyObject = (raw: unknown): Result<Readonly<Record<string, unknown>>> =>
  raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? ok(raw as Readonly<Record<string, unknown>>) : refuse('A200');
