// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * How many sign-in links one address may be sent in a while, so the product cannot be used to flood someone's
 * inbox. Both numbers are the owner's.
 *
 * Spec: docs/design.md § Email sign-in › Limits · POL-INTEGRITY-001
 * Source of truth: the deployment's settings (`emailLinks.maxSends`, `emailLinks.windowMinutes`; unset refuses)
 * @feature accounts-email
 * @address email.mail.rate-limit
 *
 * How it works. `RateLimiter` keeps, per address digest (never the address), the times links were sent in memory.
 * `allow(address, maxSends, windowMinutes)` drops times older than the window, refuses (E120) when `maxSends`
 * remain, and otherwise notes this send. It is in memory on purpose: it guards one running product, and a restart
 * clears it; the owner's numbers are what make it strict or loose.
 */
import { createHash } from 'node:crypto';
import { type Clock, type Result, ok, refuse } from '@accounts/core';

const keyOf = (address: string): string => createHash('sha256').update(`accounts email limit\n${address}`, 'utf8').digest('hex');

export class RateLimiter {
  readonly #clock: Clock;
  readonly #sent = new Map<string, number[]>();

  constructor(clock: Clock) {
    this.#clock = clock;
  }

  /** Notes one send, or refuses it when the address has had `maxSends` in the window. */
  tryAcquire(address: string, maxSends: number, windowMinutes: number): Result<true> {
    const now = this.#clock.now();
    const key = keyOf(address);
    const recent = (this.#sent.get(key) ?? []).filter((t) => t > now - windowMinutes * 60_000);
    if (recent.length >= maxSends) {
      this.#sent.set(key, recent);
      return refuse('E120', '/address');
    }
    recent.push(now);
    this.#sent.set(key, recent);
    return ok(true);
  }

  /** Gives back the newest send of an address, when its email could not be sent. */
  release(address: string): void {
    this.#sent.get(keyOf(address))?.pop();
  }
}
