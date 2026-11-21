// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The private-email way in without links: an account named by the person's email address and kept by a password,
 * on this computer only. The address is not verified this way, and the account says so; opening a magic link for
 * the same address later reaches the same account.
 *
 * Spec: docs/design.md § Email sign-in › Password
 * Source of truth: the core's registry and passwords (owner-set password settings)
 * @feature accounts-email
 * @address email.flow.password
 *
 * How it works. `createUserWithEmailAndPassword` checks the actor, the address and the password settings first, so nothing is
 * made when any is wrong; then it makes the account with an unverified email identity and sets the password on the
 * new session. A taken address is A202, so a second account is never made for one address. `signInWithEmailAndPassword`
 * finds the account by the address's email identity and tries the password; an unknown address and a wrong password
 * are both refused, and the codes differ only as much as a local list of accounts already shows.
 */
import { type Accounts, type Actor, type Result, type SignedIn, hashPassword, ok, personOnly, readPasswordSettings, refuse } from '@accounts/core';
import type { RawSettings } from '@accounts/core';
import { normalizeAddress } from '../link/address.ts';

/** Makes an email account kept by a password. */
export function createUserWithEmailAndPassword(accounts: Accounts, settings: RawSettings, rawAddress: unknown, password: string, actor: Actor): Result<SignedIn> {
  const who = personOnly(actor);
  if (!who.ok) return who;
  const address = normalizeAddress(rawAddress);
  if (!address.ok) return address;
  const s = readPasswordSettings(settings);
  if (!s.ok) return s;
  const fp = hashPassword(password, s.value);
  if (!fp.ok) return fp;
  const taken = accounts.findByIdentity('email', address.value);
  if (taken.ok) return refuse('A202', '/address');
  if (taken.issues.some((i) => i.code !== 'A206')) return taken;
  const made = accounts.signIn({ provider: 'email', sub: address.value, email: address.value, email_verified: false }, actor, { create: true });
  if (!made.ok) return made;
  const kept = accounts.setPassword(made.value.session.token, password, actor);
  return kept.ok ? ok(Object.freeze({ ...made.value, account: kept.value })) : kept;
}

/** Signs in to an email account with its password. */
export function signInWithEmailAndPassword(accounts: Accounts, rawAddress: unknown, password: string, actor: Actor): Result<SignedIn> {
  const who = personOnly(actor);
  if (!who.ok) return who;
  const address = normalizeAddress(rawAddress);
  if (!address.ok) return address;
  const id = accounts.findByIdentity('email', address.value);
  if (!id.ok) return id;
  return accounts.signInWithPassword(id.value, password, actor);
}
