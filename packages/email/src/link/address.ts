// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Email addresses for the private-email way in: one form for every address, so the same person typing their
 * address twice, in two cases, reaches one account. And the email package's code catalogue.
 *
 * Spec: docs/design.md § Email sign-in › Addresses · RFC 5321 §4.5.3.1 (length limits)
 * Source of truth: this file (`EMAIL_CODES`)
 * @feature accounts-email
 * @address email.link.address
 *
 * How it works. `normalizeAddress` trims, normalises to NFC and lower-cases the whole address (case in the part
 * before the `@` is almost never meaningful, and treating it as meaningful would split one person into two
 * accounts). It then needs one `@`, a local part of 1 to 64 characters and a domain of up to 253 with a dot and no
 * empty label, no spaces or control characters, at most 254 in all; anything else is E101. It never looks the
 * address up anywhere. E1xx is a link or an address, E2xx the mail sender.
 */
import { AccountsError, type Result, ok, refuse } from '@accounts/core';

export const EMAIL_CODES = Object.freeze({
  E100: { says: 'Signing in with an email link is not turned on here.' },
  E101: { says: 'That does not look like an email address.' },
  E102: { says: 'The owner has not set where sign-in links open, or it is not a place this app can open.' },
  E110: { says: 'That sign-in link is not known here, or it was already used.' },
  E111: { says: 'That sign-in link has ended; please ask for a new one.' },
  E112: { says: 'That is not a sign-in link for this app.' },
  E120: { says: 'Too many sign-in links were asked for this address; please wait a while.' },
  E200: { says: 'The sign-in email could not be sent, so no link was made.' },
  E201: { says: 'No way to send email is set up here, so links cannot be sent.' },
} satisfies Record<string, { readonly says: string }>);

/** The meaning of an email code; an unknown code is a bug. */
export function emailMeaning(code: string): { readonly says: string } {
  const m = (EMAIL_CODES as Readonly<Record<string, { readonly says: string }>>)[code];
  if (m === undefined) throw new AccountsError('E-CODE-UNKNOWN', `unknown email code ${code}`);
  return m;
}

const CONTROL = /[\p{Cc}\p{Cf}\s]/u;

/** The one form of an address, or E101. */
export function normalizeAddress(raw: unknown): Result<string> {
  if (typeof raw !== 'string') return refuse('E101', '/address');
  const a = raw.trim().normalize('NFC').toLowerCase();
  if (a.length === 0 || a.length > 254 || CONTROL.test(a)) return refuse('E101', '/address');
  const at = a.lastIndexOf('@');
  if (at < 1 || a.indexOf('@') !== at) return refuse('E101', '/address');
  const local = a.slice(0, at);
  const domain = a.slice(at + 1);
  if ([...local].length > 64 || domain.length > 253 || !domain.includes('.')) return refuse('E101', '/address');
  if (domain.split('.').some((label) => label.length === 0 || label.startsWith('-') || label.endsWith('-'))) return refuse('E101', '/address');
  return ok(a);
}
