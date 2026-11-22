// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Who is acting, and the clock. Every change to an account (making it, joining or removing a sign-in, removing the
 * account, turning telemetry on or off) is a person's: an in-app assistant may read and type, never decide.
 *
 * Spec: docs/design.md § People decide · D-145 (assistants never click), D-208 (people sign; agents don't)
 * Source of truth: the host's signed-in screen, which names the actor; never a request body or a document
 * @feature accounts-core
 * @address core.base.actor
 *
 * How it works. An `Actor` is `{ kind: 'person' }`, `{ kind: 'assistant' }` or `{ kind: 'system' }`. `personOnly`
 * gives A110 for anything but a person and A111 for a missing or malformed actor; every changing call checks it
 * first, before it reads or writes anything. A `Clock` gives milliseconds since 1970; `systemClock` is the real one,
 * `fixedClock` and `steppingClock` are for tests. `newId` gives a prefixed id of 16 random bytes in hex.
 */
import { randomBytes } from 'node:crypto';
import { type Result, ok, refuse } from './result.ts';

export type ActorKind = 'person' | 'assistant' | 'system';

export interface Actor {
  readonly kind: ActorKind;
}

const KINDS: readonly string[] = ['person', 'assistant', 'system'];

/** Refuses anyone but a person. */
export function personOnly(actor: unknown): Result<Actor> {
  const kind = actor !== null && typeof actor === 'object' ? (actor as { kind?: unknown }).kind : undefined;
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return refuse('A111', '/actor');
  if (kind !== 'person') return refuse('A110', '/actor', `asked by: ${kind}`);
  return ok(Object.freeze({ kind: 'person' }));
}

/** The person, for a host's signed-in screen to pass. */
export const PERSON: Actor = Object.freeze({ kind: 'person' });

export interface Clock {
  now(): number;
}

export const systemClock: Clock = Object.freeze({ now: () => Date.now() });

/** A clock that always says `at`. */
export const fixedClock = (at: number): Clock => Object.freeze({ now: () => at });

/** A clock that moves on by `stepMs` each time it is read, starting at `start`. */
export function steppingClock(start: number, stepMs: number): Clock & { advance(ms: number): void } {
  let t = start - stepMs;
  return { now: () => (t += stepMs), advance: (ms: number) => void (t += ms) };
}

/** A new id: `<prefix>-` and 32 hex characters (a name the store can hold). */
export const newId = (prefix: string): string => `${prefix}-${randomBytes(16).toString('hex')}`;

/** An instant as an ISO 8601 string. */
export const iso = (ms: number): string => new Date(ms).toISOString();
