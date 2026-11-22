// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * SIMULATED stand-ins for tests and demonstrations: a store that keeps items in memory (it seals nothing, so it is
 * never used for a person's real account) and a hash-chained audit log in memory.
 *
 * Spec: docs/design.md § The store on the computer · § Simulated parts
 * Source of truth: this file; a product's real store is its own vault
 * @feature accounts-core
 * @address core.local.memory
 *
 * How it works. `MemoryVault` copies every item in and out, refuses a name outside `ITEM_NAME` (A401) and an
 * unknown item (A400), and lends bytes through `MemorySecretValue`, which wipes its copy after each use. `failNext` makes
 * the next put fail, for tests of what happens when the disk does. `MemoryAuditLog` keeps each entry with the SHA-256
 * of the previous entry's hash and the entry's canonical JSON (sorted members), so `verify` finds any entry changed
 * after it was written: tamper-evident, not tamper-proof. `canonicalJson` is that canonical form.
 */
import { createHash } from 'node:crypto';
import { AccountsError, type Result, ok, refuse } from '../base/result.ts';
import { type AuditEvent, ITEM_NAME, type SecretValue, type Vault } from './port.ts';

/** Bytes lent out and wiped. */
export class MemorySecretValue implements SecretValue {
  readonly #bytes: Buffer;
  #wiped = false;

  constructor(bytes: Buffer) {
    this.#bytes = Buffer.from(bytes);
  }

  use<T>(fn: (bytes: Buffer) => T): T {
    if (this.#wiped) throw new AccountsError('A-BYTES-WIPED', 'these bytes were wiped');
    const copy = Buffer.from(this.#bytes);
    try {
      return fn(copy);
    } finally {
      copy.fill(0);
    }
  }

  wipe(): void {
    this.#bytes.fill(0);
    this.#wiped = true;
  }

  toString(): string {
    return '[sealed]';
  }

  toJSON(): string {
    return '[sealed]';
  }
}

/** SIMULATED: an in-memory store. It does not seal; it is for tests only. */
export class MemoryVault implements Vault {
  readonly #items = new Map<string, Buffer>();
  #failNext = false;

  put(name: string, bytes: Buffer): Result<true> {
    if (!ITEM_NAME.test(name)) return refuse('A401', '/name');
    if (this.#failNext) {
      this.#failNext = false;
      return refuse('A400', '/name');
    }
    this.#items.get(name)?.fill(0);
    this.#items.set(name, Buffer.from(bytes));
    return ok(true);
  }

  get(name: string): Result<SecretValue> {
    if (!ITEM_NAME.test(name)) return refuse('A401', '/name');
    const b = this.#items.get(name);
    return b === undefined ? refuse('A400', '/name') : ok(new MemorySecretValue(b));
  }

  remove(name: string): Result<true> {
    if (!ITEM_NAME.test(name)) return refuse('A401', '/name');
    const b = this.#items.get(name);
    if (b === undefined) return refuse('A400', '/name');
    b.fill(0);
    this.#items.delete(name);
    return ok(true);
  }

  names(): string[] {
    return [...this.#items.keys()].sort();
  }

  /** Makes the next `put` fail, as a full disk would. */
  failNext(): void {
    this.#failNext = true;
  }

  /** The raw text of an item, so a test can show what would be on disk. */
  peek(name: string): string | undefined {
    return this.#items.get(name)?.toString('utf8');
  }
}

/** JSON with object members sorted at every level, so equal values give equal text. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new AccountsError('A-JSON', 'not a JSON number');
    if (value === undefined || typeof value === 'function' || typeof value === 'bigint') throw new AccountsError('A-JSON', 'not a JSON value');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

export interface ChainedEntry<B> {
  readonly seq: number;
  readonly prev: string;
  readonly hash: string;
  readonly body: B;
}

/** SIMULATED: a hash-chained audit log in memory. Takes accounts entries and any other product entries. */
export class MemoryAuditLog<B = AuditEvent> {
  readonly #entries: ChainedEntry<B>[] = [];
  #refuse = false;

  append(body: B): ChainedEntry<B> {
    if (this.#refuse) throw new AccountsError('A-RECORD-DOWN', 'the audit log is down');
    const prev = this.#entries.at(-1)?.hash ?? '0'.repeat(64);
    const seq = this.#entries.length;
    const entry = Object.freeze({ seq, prev, hash: sha256(`${prev}\n${seq}\n${canonicalJson(body)}`), body });
    this.#entries.push(entry);
    return entry;
  }

  entries(): readonly ChainedEntry<B>[] {
    return [...this.#entries];
  }

  /** The sequence number of the first entry that does not match its hash, or -1 when the chain holds. */
  verify(): number {
    let prev = '0'.repeat(64);
    for (const e of this.#entries) {
      if (e.prev !== prev || e.hash !== sha256(`${prev}\n${e.seq}\n${canonicalJson(e.body)}`)) return e.seq;
      prev = e.hash;
    }
    return -1;
  }

  /** Makes every later append throw, as an audit log that cannot be written would. */
  goDown(): void {
    this.#refuse = true;
  }
}
