// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The store of magic links sent and not yet used: each link works once, until it ends, and only for the address it
 * was sent to. How long a link lasts is the owner's number.
 *
 * Spec: docs/design.md § Email sign-in › Links
 * Source of truth: the product's sealed store (`link-…` items); the deployment's settings (`emailLinks.linkMinutes`)
 * @feature accounts-email
 * @address email.link.store
 *
 * How it works. `create(address, minutes)` keeps `link-<first 40 hex of the token's digest>` holding the whole digest,
 * the address and when it ends, recorded as `magic-link-create` (the audit log holds no address). `consume(token)` finds the
 * item, checks the whole digest, and removes it before it gives anything back, so a link can never be used twice,
 * even when what follows fails; an unknown or used link is E110, an ended one E111. `revoke` removes a link whose
 * email could not be sent. `purgeExpired` removes every ended link, for the product to run when it starts.
 */
import { type Documents, type Result, anyObject, iso, ok, refuse } from '@accounts/core';
import { digestToken, isLinkToken, newLinkToken } from './token.ts';

const FORMAT = 'accounts-email-link/1';
const PREFIX = 'link-';

interface LinkDoc {
  readonly format: typeof FORMAT;
  readonly digest: string;
  readonly address: string;
  readonly endsAt: string;
}

const nameOf = (digest: string): string => `${PREFIX}${digest.slice(0, 40)}`;

function parseLink(raw: unknown): Result<LinkDoc> {
  const o = anyObject(raw);
  if (!o.ok) return o;
  const v = o.value;
  const good = v['format'] === FORMAT && typeof v['digest'] === 'string' && /^[0-9a-f]{64}$/.test(v['digest'])
    && typeof v['address'] === 'string' && typeof v['endsAt'] === 'string' && !Number.isNaN(Date.parse(v['endsAt']));
  return good ? ok(v as unknown as LinkDoc) : refuse('A200');
}

export interface IssuedMagicLink {
  readonly token: string;
  readonly endsAt: string;
}

export class MagicLinkStore {
  readonly #docs: Documents;

  constructor(docs: Documents) {
    this.#docs = docs;
  }

  /** Makes and keeps one link for an address. */
  create(address: string, minutes: number): Result<IssuedMagicLink> {
    return this.#docs.change('magic-link-create', null, () => {
      const token = newLinkToken();
      const digest = digestToken(token);
      const endsAt = iso(this.#docs.clock.now() + minutes * 60_000);
      const w = this.#docs.write(nameOf(digest), { format: FORMAT, digest, address, endsAt });
      return w.ok ? ok(Object.freeze({ token, endsAt })) : w;
    });
  }

  /** Uses a link once: gives back the address it was sent to. */
  consume(token: unknown): Result<string> {
    if (!isLinkToken(token)) return refuse('E110', '/link');
    const digest = digestToken(token);
    const name = nameOf(digest);
    if (!this.#docs.has(name)) return this.#docs.refused('magic-link-consume', null, refuse('E110', '/link'));
    const doc = this.#docs.read(name, parseLink);
    if (!doc.ok) return doc;
    if (doc.value.digest !== digest) return refuse('E110', '/link');
    const gone = this.#docs.change('magic-link-consume', null, () => this.#docs.remove(name));
    if (!gone.ok) return gone;
    if (Date.parse(doc.value.endsAt) <= this.#docs.clock.now()) return refuse('E111', '/link');
    return ok(doc.value.address);
  }

  /** Removes a link that was never sent. */
  revoke(token: string): Result<true> {
    const name = nameOf(digestToken(token));
    return this.#docs.change('magic-link-revoke', null, () => this.#docs.remove(name));
  }

  /** Removes every ended link; gives how many. */
  purgeExpired(): number {
    let n = 0;
    for (const name of this.#docs.list(PREFIX)) {
      const d = this.#docs.read(name, parseLink);
      if (d.ok && Date.parse(d.value.endsAt) <= this.#docs.clock.now() && this.#docs.remove(name).ok) n += 1;
    }
    return n;
  }
}
