// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Signing in with a magic link: the person types their address, an email with a one-time link is sent, and
 * opening the link on this computer signs them in, making the account the first time. The answer to asking for a
 * link never says whether an account exists for the address.
 *
 * Spec: docs/design.md § Email sign-in › Links · D-145 (a person asks; an assistant cannot)
 * Source of truth: link/store.ts (the links), the core's registry (the accounts)
 * @feature accounts-email
 * @address email.flow.magic-links
 *
 * How it works. `send(address, actor)` checks the actor, the owner's settings and the address, then the rate limit;
 * it keeps a link, writes the email and hands it to the mail sender. If the sender fails, the link is revoked and
 * the send is released back to the rate limiter, so no link exists that was never sent (E200). It resolves to the link's end
 * time only. `verify(opened, actor)` reads the token from the address the product was opened at, uses the link once
 * and signs in with a verified email identity (`provider: 'email'`, the address as `sub`).
 */
import { type Accounts, type Actor, type Documents, type RawSettings, type Result, type SignedIn, ok, personOnly, refuse } from '@accounts/core';
import { normalizeAddress } from '../link/address.ts';
import { MagicLinkStore } from '../link/store.ts';
import { buildLink, readLink } from '../link/token.ts';
import { RateLimiter } from '../mail/rate-limit.ts';
import { linkMessage } from '../mail/message.ts';
import type { MailSender } from '../mail/port.ts';
import { readLinkSettings } from './settings.ts';

export interface MagicLinksOptions {
  readonly accounts: Accounts;
  readonly docs: Documents;
  readonly settings: RawSettings;
  readonly sender: MailSender | null;
}

export class MagicLinks {
  readonly #o: MagicLinksOptions;
  readonly store: MagicLinkStore;
  readonly #rateLimiter: RateLimiter;

  constructor(o: MagicLinksOptions) {
    this.#o = o;
    this.store = new MagicLinkStore(o.docs);
    this.#rateLimiter = new RateLimiter(o.docs.clock);
  }

  /** Sends a sign-in link to an address; gives when it ends. */
  async send(rawAddress: unknown, actor: Actor): Promise<Result<{ readonly endsAt: string }>> {
    const who = personOnly(actor);
    if (!who.ok) return who;
    const s = readLinkSettings(this.#o.settings);
    if (!s.ok) return s;
    if (this.#o.sender === null) return refuse('E201');
    const address = normalizeAddress(rawAddress);
    if (!address.ok) return address;
    const allowed = this.#rateLimiter.tryAcquire(address.value, s.value.maxSends, s.value.windowMinutes);
    if (!allowed.ok) return allowed;
    const link = this.store.create(address.value, s.value.linkMinutes);
    if (!link.ok) {
      this.#rateLimiter.release(address.value);
      return link;
    }
    const message = linkMessage(address.value, s.value.productName, buildLink(s.value.base, link.value.token), s.value.linkMinutes);
    let sent: Result<true>;
    try {
      sent = message.ok ? await this.#o.sender.send(message.value) : message;
    } catch {
      sent = refuse('E200');
    }
    if (!sent.ok) {
      this.store.revoke(link.value.token);
      this.#rateLimiter.release(address.value);
      return refuse('E200');
    }
    return ok(Object.freeze({ endsAt: link.value.endsAt }));
  }

  /** Signs in from the address the product was opened at. */
  verify(opened: unknown, actor: Actor): Result<SignedIn> {
    const who = personOnly(actor);
    if (!who.ok) return who;
    const s = readLinkSettings(this.#o.settings);
    if (!s.ok) return s;
    const token = readLink(s.value.base, opened);
    if (!token.ok) return token;
    const address = this.store.consume(token.value);
    if (!address.ok) return address;
    return this.#o.accounts.signIn({ provider: 'email', sub: address.value, email: address.value, email_verified: true }, actor, { create: true });
  }
}
