// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The accounts on this computer: signing in with a checked identity or a password, making an account the first time,
 * joining and removing sign-ins, naming and removing an account. Everything is kept in the product's sealed store,
 * every change is recorded first, and only a person makes a change.
 *
 * Spec: docs/design.md § Accounts · D-145, D-208 (a person decides)
 * Source of truth: the product's sealed store (one `acct-…` item per account, `accounts-pepper` for the keys)
 * @feature accounts-core
 * @address core.account.registry
 *
 * How it works. Each changing call checks the actor first (`personOnly`). Calls on a signed-in account take its
 * session token and check it before anything else. Finding an account by a sign-in reads every account and refuses
 * (A200) if any will not open, so a damaged file can never lead to a second account for the same person. `signIn`
 * opens a session for the account that holds the identity's key, or, with `create`, makes one. When a verified
 * sign-in reaches an account whose matching sign-in was not verified (an email account made with a password), the
 * sign-in is marked verified and the password is cleared, because whoever set it may not own the address; the owner
 * of the address sets a new one. An identity is never
 * joined to an account because an email address matches: joining is `link`, by a person already signed in, and an
 * identity held elsewhere is A202. `unlink` refuses the last sign-in (A204). `remove` ends every session and deletes
 * the account. The pepper is 32 random bytes made the first time and kept sealed.
 */
import { randomBytes } from 'node:crypto';
import { type Actor, type Clock, iso, newId, personOnly, systemClock } from '../base/actor.ts';
import { type Result, ok, refuse } from '../base/result.ts';
import type { RawSettings } from '../base/settings.ts';
import { Documents, anyObject } from '../local/documents.ts';
import type { AuditLog, Vault } from '../local/port.ts';
import { ACCOUNT_FORMAT, type AccountDoc, type AccountView, type Provider, type VerifiedIdentity, checkIdentity, identityKey, maskEmail, parseAccount, viewOf } from './model.ts';
import { hashPassword, newPasswordState, readPasswordSettings, verifyPassword } from './password.ts';
import { type OpenedSession, Sessions } from './sessions.ts';

const PEPPER = 'accounts-pepper';
const PREFIX = 'acct-';

export interface AccountsOptions {
  readonly store: Vault;
  readonly auditLog: AuditLog;
  readonly settings: RawSettings;
  readonly clock?: Clock;
}

export interface SignedIn {
  readonly account: AccountView;
  readonly session: OpenedSession;
  readonly created: boolean;
}

export class Accounts {
  readonly #docs: Documents;
  readonly #settings: RawSettings;
  readonly sessions: Sessions;

  constructor(o: AccountsOptions) {
    this.#docs = new Documents(o.store, o.auditLog, o.clock ?? systemClock);
    this.#settings = o.settings;
    this.sessions = new Sessions(this.#docs, o.settings);
  }

  #pepper(): Result<Buffer> {
    if (this.#docs.has(PEPPER)) {
      const r = this.#docs.read(PEPPER, anyObject);
      if (!r.ok) return r;
      const hex = r.value['pepper'];
      return typeof hex === 'string' && /^[0-9a-f]{64}$/.test(hex) ? ok(Buffer.from(hex, 'hex')) : refuse('A200', `/${PEPPER}`);
    }
    return this.#docs.change('pepper-create', null, () => {
      const p = randomBytes(32);
      const w = this.#docs.write(PEPPER, { format: 'accounts-pepper/1', pepper: p.toString('hex') });
      return w.ok ? ok(p) : w;
    });
  }

  #all(): Result<AccountDoc[]> {
    const out: AccountDoc[] = [];
    for (const name of this.#docs.list(PREFIX)) {
      const a = this.#docs.read(name, parseAccount);
      if (!a.ok) return a;
      out.push(a.value);
    }
    return ok(out);
  }

  #byKey(key: string): Result<AccountDoc | null> {
    const all = this.#all();
    return all.ok ? ok(all.value.find((a) => a.identities.some((i) => i.key === key)) ?? null) : all;
  }

  #load(id: string): Result<AccountDoc> {
    return this.#docs.has(id) ? this.#docs.read(id, parseAccount) : refuse('A201', '/account');
  }

  #opened(account: AccountDoc, created: boolean): Result<SignedIn> {
    const s = this.sessions.create(account.id);
    return s.ok ? ok(Object.freeze({ account: viewOf(account), session: s.value, created })) : s;
  }

  #withSession(token: unknown): Result<AccountDoc> {
    const id = this.sessions.validate(token);
    return id.ok ? this.#load(id.value) : id;
  }

  #linkedOf(pepper: Buffer, id: VerifiedIdentity) {
    return Object.freeze({
      provider: id.provider, key: identityKey(pepper, id.provider, id.sub),
      emailHint: id.email === undefined ? null : maskEmail(id.email), email_verified: id.email_verified, linkedAt: iso(this.#docs.clock.now()),
    });
  }

  /** Every account on this computer, as a screen may show them. */
  list(): Result<AccountView[]> {
    const all = this.#all();
    return all.ok ? ok(all.value.map(viewOf)) : all;
  }

  /** The id of the account that holds a sign-in, or A206. */
  findByIdentity(provider: Provider, sub: string): Result<string> {
    const pepper = this.#pepper();
    if (!pepper.ok) return pepper;
    const a = this.#byKey(identityKey(pepper.value, provider, sub));
    if (!a.ok) return a;
    return a.value === null ? refuse('A206', '/identity') : ok(a.value.id);
  }

  /** Signs in with a checked identity; with `create`, makes the account the first time. */
  signIn(raw: unknown, actor: Actor, opts: { readonly create: boolean }): Result<SignedIn> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused('sign-in', null, who);
    const id = checkIdentity(raw);
    if (!id.ok) return this.#docs.refused('sign-in', null, id);
    const pepper = this.#pepper();
    if (!pepper.ok) return pepper;
    const linked = this.#linkedOf(pepper.value, id.value);
    const found = this.#byKey(linked.key);
    if (!found.ok) return found;
    if (found.value !== null) {
      const held = found.value.identities.find((i) => i.key === linked.key);
      if (held === undefined || held.email_verified || !linked.email_verified) return this.#opened(found.value, false);
      const verified: AccountDoc = { ...found.value, password: null, identities: found.value.identities.map((i) => (i.key === linked.key ? { ...i, email_verified: true } : i)) };
      const kept = this.#docs.change('verify-email', verified.id, () => this.#docs.write(verified.id, verified));
      return kept.ok ? this.#opened(verified, false) : kept;
    }
    if (!opts.create) return this.#docs.refused('sign-in', null, refuse('A206', '/identity'));
    const doc: AccountDoc = Object.freeze({
      format: ACCOUNT_FORMAT, id: newId('acct'), createdAt: linked.linkedAt, label: null,
      address: id.value.provider === 'email' ? (id.value.email ?? id.value.sub) : null, identities: Object.freeze([linked]), password: null,
    });
    const made = this.#docs.change('account-create', doc.id, () => this.#docs.write(doc.id, doc));
    return made.ok ? this.#opened(doc, true) : made;
  }

  /** Signs in to one account on this computer with its password. */
  signInWithPassword(accountId: string, password: string, actor: Actor): Result<SignedIn> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused('sign-in-password', null, who);
    const s = readPasswordSettings(this.#settings);
    if (!s.ok) return this.#docs.refused('sign-in-password', accountId, s);
    const a = this.#load(accountId);
    if (!a.ok) return a;
    const state = a.value.password;
    if (state === null) return this.#docs.refused('sign-in-password', accountId, refuse('A313', '/password'));
    const t = verifyPassword(state, password, s.value, this.#docs.clock.now());
    if (t.next !== state) {
      const kept = this.#docs.change('password-verify', accountId, () => this.#docs.write(accountId, { ...a.value, password: t.next }));
      if (!kept.ok) return kept;
    }
    if (!t.result.ok) return this.#docs.refused('sign-in-password', accountId, t.result);
    return this.#opened(a.value, false);
  }

  /** The signed-in account. */
  view(token: unknown): Result<AccountView> {
    const a = this.#withSession(token);
    return a.ok ? ok(viewOf(a.value)) : a;
  }

  #update(action: string, token: unknown, actor: Actor, edit: (a: AccountDoc) => Result<AccountDoc>): Result<AccountView> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused(action, null, who);
    const a = this.#withSession(token);
    if (!a.ok) return a;
    const next = edit(a.value);
    if (!next.ok) return this.#docs.refused(action, a.value.id, next);
    const w = this.#docs.change(action, a.value.id, () => this.#docs.write(a.value.id, next.value));
    return w.ok ? ok(viewOf(next.value)) : w;
  }

  /** Gives the signed-in account a password, or a new one. */
  setPassword(token: unknown, password: string, actor: Actor): Result<AccountView> {
    return this.#update('password-set', token, actor, (a) => {
      const s = readPasswordSettings(this.#settings);
      if (!s.ok) return s;
      const fp = hashPassword(password, s.value);
      return fp.ok ? ok({ ...a, password: newPasswordState(fp.value) }) : fp;
    });
  }

  /** Removes the signed-in account's password (its other sign-ins stay). */
  clearPassword(token: unknown, actor: Actor): Result<AccountView> {
    return this.#update('password-clear', token, actor, (a) => ok({ ...a, password: null }));
  }

  /** Names the signed-in account (or clears the name). */
  rename(token: unknown, label: string | null, actor: Actor): Result<AccountView> {
    return this.#update('rename', token, actor, (a) => {
      const l = label === null ? null : label.normalize('NFC').trim();
      if (l !== null && (l.length === 0 || [...l].length > 80 || /[\p{Cc}]/u.test(l))) return refuse('A205', '/label');
      return ok({ ...a, label: l });
    });
  }

  /** Joins another checked sign-in to the signed-in account. */
  link(token: unknown, raw: unknown, actor: Actor): Result<AccountView> {
    return this.#update('link', token, actor, (a) => {
      const id = checkIdentity(raw);
      if (!id.ok) return id;
      const pepper = this.#pepper();
      if (!pepper.ok) return pepper;
      const linked = this.#linkedOf(pepper.value, id.value);
      const holder = this.#byKey(linked.key);
      if (!holder.ok) return holder;
      if (holder.value !== null) return refuse(holder.value.id === a.id ? 'A205' : 'A202', '/identity', holder.value.id === a.id ? 'already joined' : undefined);
      return ok({ ...a, identities: Object.freeze([...a.identities, linked]) });
    });
  }

  /** Removes one sign-in (named by its `ref` in the view) from the signed-in account. */
  unlink(token: unknown, ref: string, actor: Actor): Result<AccountView> {
    return this.#update('unlink', token, actor, (a) => {
      const keep = a.identities.filter((i) => i.key.slice(0, 16) !== ref);
      if (keep.length === a.identities.length) return refuse('A203', '/ref');
      if (keep.length === 0) return refuse('A204', '/ref');
      return ok({ ...a, identities: Object.freeze(keep) });
    });
  }

  /** Signs out of one session. */
  signOut(token: unknown): Result<true> {
    return this.sessions.revoke(token);
  }

  /** Removes the signed-in account from this computer, with every session it has. */
  remove(token: unknown, actor: Actor): Result<true> {
    const who = personOnly(actor);
    if (!who.ok) return this.#docs.refused('account-remove', null, who);
    const a = this.#withSession(token);
    if (!a.ok) return a;
    const closed = this.sessions.revokeAll(a.value.id);
    if (!closed.ok) return closed;
    return this.#docs.change('account-remove', a.value.id, () => this.#docs.remove(a.value.id));
  }
}
