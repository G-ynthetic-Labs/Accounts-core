// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Sign-in link tokens and the links that carry them: a link opens the product on the person's own computer, where
 * the token is redeemed once. Where links open is the owner's setting, and only places an app on the person's
 * computer may be opened at are allowed.
 *
 * Spec: docs/design.md § Email sign-in › Links · RFC 8252 §7 (where a native app may be opened) · RFC 4648 §5
 * Source of truth: the deployment's settings (`emailLinks.linkBase`, owner-set; unset refuses)
 * @feature accounts-email
 * @address email.link.token
 *
 * How it works. A token is 32 random bytes in base64url; only its SHA-256 (labelled) is kept. `allowedBase` takes
 * the owner's base address: a private-use scheme in reverse-domain form (`com.example.app:/sign-in`), the loopback
 * address with a port (`http://127.0.0.1:<port>/…`, never `localhost`), or plain https; never one with a user name,
 * a password, a query or a fragment. `buildLink` puts the token in the fragment (`#t=…`), so it is not sent to a
 * server when the link opens over https and does not land in a web server's log. `readLink` takes the address the
 * product was opened at and gives the token only when the address starts with the base exactly (E112).
 */
import { createHash, randomBytes } from 'node:crypto';
import { type Result, ok, refuse } from '@accounts/core';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const PRIVATE_SCHEME = /^[a-z][a-z0-9+.-]*\.[a-z0-9+.-]+$/;

/** A new link token. */
export const newLinkToken = (): string => randomBytes(32).toString('base64url');

/** What is kept of a token. */
export const digestToken = (token: string): string => createHash('sha256').update(`accounts email link\n${token}`, 'utf8').digest('hex');

/** True for a token's form. */
export const isLinkToken = (v: unknown): v is string => typeof v === 'string' && TOKEN.test(v);

/** The owner's base address, when it is a place links may open (see the header). */
export function allowedBase(raw: unknown): Result<URL> {
  if (typeof raw !== 'string') return refuse('E102', '/emailLinks/linkBase');
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return refuse('E102', '/emailLinks/linkBase');
  }
  if (u.username !== '' || u.password !== '' || u.search !== '' || u.hash !== '') return refuse('E102', '/emailLinks/linkBase');
  if (u.protocol === 'https:') return ok(u);
  if (u.protocol === 'http:') return (u.hostname === '127.0.0.1' || u.hostname === '[::1]') && u.port !== '' ? ok(u) : refuse('E102', '/emailLinks/linkBase');
  return PRIVATE_SCHEME.test(u.protocol.slice(0, -1)) ? ok(u) : refuse('E102', '/emailLinks/linkBase');
}

/** The link that carries a token. */
export const buildLink = (base: URL, token: string): string => `${base.toString()}#t=${token}`;

/** The token in the address the product was opened at, when it is this product's link. */
export function readLink(base: URL, opened: unknown): Result<string> {
  if (typeof opened !== 'string') return refuse('E112', '/link');
  const prefix = `${base.toString()}#t=`;
  if (!opened.startsWith(prefix)) return refuse('E112', '/link');
  const token = opened.slice(prefix.length);
  return isLinkToken(token) ? ok(token) : refuse('E112', '/link');
}
