// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * How a sign-in email leaves the computer: through a mail sender the product plugs in. The accounts module sends
 * nothing itself. A real sender is a connector in connectors-lib, chosen and turned on by the owner; until then the
 * SIMULATED outbox keeps messages in memory.
 *
 * Spec: docs/design.md § Email sign-in › Sending · repo map (connectors to outside services live in connectors-lib)
 * Source of truth: the product's wiring; docs/owner-items.md (which mail service, its secretRef)
 * @feature accounts-email
 * @address email.mail.port
 *
 * How it works. `MailSender.send(message)` resolves to a result: `ok(true)` once the service has taken the message,
 * or a failure the flow reports as E200 without its detail (a service's own words never reach a screen). A sender
 * never retries. `SimulatedOutbox` keeps each message, says `SIMULATED` in `name`, and can be told to fail the next
 * send, so the flow's handling of a failed send is tested. `lastLink` reads the link from the newest message, the way
 * a person would click it.
 */
import { type Result, ok, refuse } from '@accounts/core';

/** One sign-in email: plain text only, to one address. */
export interface LinkMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** The product's way to send email (a connectors-lib connector, or the simulated outbox). */
export interface MailSender {
  readonly name: string;
  send(message: LinkMessage): Promise<Result<true>>;
}

/** SIMULATED: keeps sent messages in memory. */
export class SimulatedOutbox implements MailSender {
  readonly name = 'SIMULATED outbox';
  readonly #sent: LinkMessage[] = [];
  #failNext = false;

  async send(message: LinkMessage): Promise<Result<true>> {
    if (this.#failNext) {
      this.#failNext = false;
      return refuse('E200', '', 'simulated failure');
    }
    this.#sent.push(Object.freeze({ ...message }));
    return ok(true);
  }

  /** Every message sent, oldest first. */
  sent(): readonly LinkMessage[] {
    return [...this.#sent];
  }

  /** The link in the newest message, as a person would click it. */
  lastLink(): string | undefined {
    const m = this.#sent.at(-1);
    return m?.text.split('\n').find((l) => l.includes('#t='))?.trim();
  }

  /** Makes the next send fail. */
  failNext(): void {
    this.#failNext = true;
  }
}
