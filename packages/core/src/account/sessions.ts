// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Sessions: once a person has signed in, the product holds a session token so they are not asked again until it
 * ends. The token is shown to the product once; the store keeps only its SHA-256, so the sealed file cannot be used
 * to sign in.
 *
 * Spec: docs/design.md § Accounts › Sessions
 * Source of truth: the deployment's settings (`sessions.sessionMinutes`, owner-set; unset refuses)
 * @feature accounts-core
 * @address core.account.sessions
 *
 * How it works. `verify(account)` reads `sessionMinutes` first (A100 when unset), makes 32 random bytes as base64url,
 * and keeps `sess-<first 40 hex of its digest>` holding the account id, the whole digest and when it ends. `check`
 * finds the item by the digest, compares the whole digest in constant time, and refuses an unknown (A300) or ended
 * (A301) session; an ended one is removed as it is found. `close` removes one, `closeAll` every session of an account
 * (signing out everywhere, or removing the account). Opening and closing are recorded; checking is not, because it
 * happens on every screen.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { iso } from '../base/actor.ts';
import { type Result, ok, refuse } from '../base/result.ts';
import { type RawSettings, section, wholeNumbers } from '../base/settings.ts';
import { type Documents, anyObject } from '../local/documents.ts';

const FORMAT = 'accounts-session/1';
const PREFIX = 'sess-';

export interface OpenedSession {
  readonly token: string;
  readonly account: string;
  readonly endsAt: string;
}

interface SessionDoc {
  readonly format: typeof FORMAT;
  readonly account: string;
  readonly digest: string;
  readonly openedAt: string;
  readonly endsAt: string;
}

const digestOf = (token: string): string => createHash('sha256').update(`accounts session\n${token}`, 'utf8').digest('hex');
const nameOf = (digest: string): string => `${PREFIX}${digest.slice(0, 40)}`;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function parseSession(raw: unknown): Result<SessionDoc> {
  const o = anyObject(raw);
  if (!o.ok) return o;
  const v = o.value;
  const good = v['format'] === FORMAT && typeof v['account'] === 'string' && typeof v['digest'] === 'string' && /^[0-9a-f]{64}$/.test(v['digest'])
    && typeof v['openedAt'] === 'string' && typeof v['endsAt'] === 'string' && !Number.isNaN(Date.parse(v['endsAt']));
  return good ? ok(v as unknown as SessionDoc) : refuse('A200');
}

export class Sessions {
  readonly #docs: Documents;
  readonly #settings: RawSettings;

  constructor(docs: Documents, settings: RawSettings) {
    this.#docs = docs;
    this.#settings = settings;
  }

  /** Opens a session for an account; the token is given back once and never kept. */
  create(account: string): Result<OpenedSession> {
    const s = wholeNumbers(section(this.#settings, 'sessions'), ['sessionMinutes'], '/sessions');
    if (!s.ok) return this.#docs.refused('session-create', account, s);
    return this.#docs.change('session-create', account, () => {
      const token = randomBytes(32).toString('base64url');
      const digest = digestOf(token);
      const now = this.#docs.clock.now();
      const endsAt = iso(now + s.value.sessionMinutes * 60_000);
      const w = this.#docs.write(nameOf(digest), { format: FORMAT, account, digest, openedAt: iso(now), endsAt });
      return w.ok ? ok(Object.freeze({ token, account, endsAt })) : w;
    });
  }

  #find(token: unknown): Result<{ name: string; doc: SessionDoc }> {
    if (typeof token !== 'string' || !TOKEN.test(token)) return refuse('A300', '/session');
    const digest = digestOf(token);
    const name = nameOf(digest);
    if (!this.#docs.has(name)) return refuse('A300', '/session');
    const doc = this.#docs.read(name, parseSession);
    if (!doc.ok) return doc;
    const a = Buffer.from(doc.value.digest, 'hex');
    const b = Buffer.from(digest, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return refuse('A300', '/session');
    return ok({ name, doc: doc.value });
  }

  /** The account a session is for, while it is open. */
  validate(token: unknown): Result<string> {
    const f = this.#find(token);
    if (!f.ok) return f;
    if (Date.parse(f.value.doc.endsAt) <= this.#docs.clock.now()) {
      this.#docs.remove(f.value.name);
      return refuse('A301', '/session');
    }
    return ok(f.value.doc.account);
  }

  /** Ends one session (signing out). */
  revoke(token: unknown): Result<true> {
    const f = this.#find(token);
    if (!f.ok) return f;
    return this.#docs.change('session-revoke', f.value.doc.account, () => this.#docs.remove(f.value.name));
  }

  /** Ends every session of an account; gives how many ended. */
  revokeAll(account: string): Result<number> {
    return this.#docs.change('session-revoke-all', account, () => {
      let n = 0;
      for (const name of this.#docs.list(PREFIX)) {
        const d = this.#docs.read(name, parseSession);
        if (d.ok && d.value.account === account && this.#docs.remove(name).ok) n += 1;
      }
      return ok(n);
    });
  }
}
