// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * What an account is, kept as little as works: a local id, an optional name the person chose, and the ways they
 * sign in. A provider's own id for the person is never kept as it came; it is kept as a keyed hashPassword, so the
 * sealed file can match a sign-in without holding who the person is at that provider.
 *
 * Spec: docs/design.md § Accounts › What is kept
 * Source of truth: this file (`ACCOUNT_FORMAT`, `PROVIDERS`)
 * @feature accounts-core
 * @address core.account.model
 *
 * How it works. A sign-in connector (connectors-lib identity kit) or the email flow hands over a `VerifiedIdentity`:
 * the provider, the provider's subject, and the email address only with whether the provider verified it.
 * `checkIdentity` checks its shape (A205). `identityKey` is HMAC-SHA256 under the store's own random pepper over the
 * provider and subject, in hex. A linked identity keeps that key, a masked email (`a•••@example.test`) to show the
 * person which sign-in it is, and whether the email was verified. Only an email account keeps its whole address,
 * because links are sent to it. `parseAccount` checks a stored account before anything trusts it.
 */
import { createHmac } from 'node:crypto';
import { type Result, issue, fail, ok, refuse } from '../base/result.ts';

export const PROVIDERS = Object.freeze(['google', 'apple', 'github', 'email'] as const);
export type Provider = (typeof PROVIDERS)[number];
export const ACCOUNT_FORMAT = 'accounts-account/1';

/** A sign-in that has been checked: by a connector against the provider, or by a consumed magic link. */
export interface VerifiedIdentity {
  readonly provider: Provider;
  readonly sub: string;
  readonly email?: string;
  readonly email_verified: boolean;
}

export interface LinkedIdentity {
  readonly provider: Provider;
  readonly key: string;
  readonly emailHint: string | null;
  readonly email_verified: boolean;
  readonly linkedAt: string;
}

export interface PasswordState {
  readonly hash: string;
  readonly failures: number;
  readonly lockedUntil: string | null;
}

export interface AccountDoc {
  readonly format: typeof ACCOUNT_FORMAT;
  readonly id: string;
  readonly createdAt: string;
  readonly label: string | null;
  readonly address: string | null;
  readonly identities: readonly LinkedIdentity[];
  readonly password: PasswordState | null;
}

const SUBJECT = /^[\x21-\x7e]{1,255}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}$/;
const KEY = /^[0-9a-f]{64}$/;
const ID = /^acct-[0-9a-f]{32}$/;
const isProvider = (v: unknown): v is Provider => typeof v === 'string' && (PROVIDERS as readonly string[]).includes(v);
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const textOrNull = (v: unknown, max: number): boolean => v === null || (typeof v === 'string' && v.length > 0 && v.length <= max);

/** Checks a sign-in handed over by a connector or the email flow. */
export function checkIdentity(raw: unknown): Result<VerifiedIdentity> {
  if (!isObj(raw)) return refuse('A205', '');
  const issues = [];
  if (!isProvider(raw['provider'])) issues.push(issue('A205', '/provider'));
  if (typeof raw['sub'] !== 'string' || !SUBJECT.test(raw['sub'])) issues.push(issue('A205', '/sub'));
  if (raw['email'] !== undefined && (typeof raw['email'] !== 'string' || raw['email'].length > 254 || !EMAIL.test(raw['email']))) issues.push(issue('A205', '/email'));
  if (typeof raw['email_verified'] !== 'boolean') issues.push(issue('A205', '/email_verified'));
  if (issues.length > 0) return fail(issues);
  const email = raw['email'] as string | undefined;
  return ok(Object.freeze({ provider: raw['provider'] as Provider, sub: raw['sub'] as string, ...(email === undefined ? {} : { email }), email_verified: raw['email_verified'] as boolean }));
}

/** The keyed hash (HMAC-SHA256) of a provider's subject. */
export const identityKey = (pepper: Buffer, provider: Provider, sub: string): string =>
  createHmac('sha256', pepper).update(`accounts identity\n${provider}\n${sub}`, 'utf8').digest('hex');

/** An email address with all but its first character before the `@` hidden. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '•••';
  return `${[...email.slice(0, at)][0]}•••${email.slice(at)}`;
}

function checkLinked(raw: unknown): boolean {
  return isObj(raw) && isProvider(raw['provider']) && typeof raw['key'] === 'string' && KEY.test(raw['key'])
    && textOrNull(raw['emailHint'], 260) && typeof raw['email_verified'] === 'boolean' && typeof raw['linkedAt'] === 'string';
}

function checkPassword(raw: unknown): boolean {
  if (raw === null) return true;
  return isObj(raw) && typeof raw['hash'] === 'string' && Number.isSafeInteger(raw['failures']) && (raw['failures'] as number) >= 0
    && (raw['lockedUntil'] === null || typeof raw['lockedUntil'] === 'string');
}

/** Checks a stored account before it is trusted. */
export function parseAccount(raw: unknown): Result<AccountDoc> {
  if (!isObj(raw)) return refuse('A200', '');
  const issues = [];
  if (raw['format'] !== ACCOUNT_FORMAT) issues.push(issue('A200', '/format'));
  if (typeof raw['id'] !== 'string' || !ID.test(raw['id'])) issues.push(issue('A200', '/id'));
  if (typeof raw['createdAt'] !== 'string') issues.push(issue('A200', '/createdAt'));
  if (!textOrNull(raw['label'], 80)) issues.push(issue('A200', '/label'));
  if (!textOrNull(raw['address'], 254)) issues.push(issue('A200', '/address'));
  const ids = raw['identities'];
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(checkLinked)) issues.push(issue('A200', '/identities'));
  if (!checkPassword(raw['password'])) issues.push(issue('A200', '/password'));
  return issues.length > 0 ? fail(issues) : ok(raw as unknown as AccountDoc);
}

/** What a screen may show about an account: no keys, no hashes, no whole addresses but the person's own. */
export interface AccountView {
  readonly id: string;
  readonly label: string | null;
  readonly createdAt: string;
  readonly signIns: readonly { readonly ref: string; readonly provider: Provider; readonly emailHint: string | null; readonly email_verified: boolean }[];
  readonly hasPassword: boolean;
}

/** The view of an account. A sign-in's `ref` is the first 16 characters of its key, to name it for removing. */
export const viewOf = (a: AccountDoc): AccountView => Object.freeze({
  id: a.id, label: a.label, createdAt: a.createdAt, hasPassword: a.password !== null,
  signIns: Object.freeze(a.identities.map((i) => Object.freeze({ ref: i.key.slice(0, 16), provider: i.provider, emailHint: i.emailHint, email_verified: i.email_verified }))),
});
