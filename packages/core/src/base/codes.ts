// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The accounts code catalogue: every code the core package gives, in plain words a person can read. A code never
 * carries an email address, a provider's subject, a session token or a password.
 *
 * Spec: docs/design.md § Results and codes
 * Source of truth: this file (`ACCOUNT_CODES`)
 * @feature accounts-core
 * @address core.base.codes
 *
 * How it works. A1xx is a setting or who is acting, A2xx an account or an identity, A3xx a session or a password,
 * A4xx the store or the audit log on the computer. `accountMeaning` looks a code up; an unknown code is a bug, so it
 * throws. Products show `says` to the person; they never show a code's detail unless it is plain.
 */
import { AccountsError } from './result.ts';

export interface AccountMeaning {
  readonly says: string;
}

export const ACCOUNT_CODES = Object.freeze({
  A100: { says: 'A setting this needs has not been set by the owner, so it is refused.' },
  A101: { says: 'A setting is not a whole number above zero.' },
  A110: { says: 'Only a person can do this; an assistant cannot.' },
  A111: { says: 'Who is asking was not named.' },
  A200: { says: 'An account kept on this computer would not open; it may be damaged.' },
  A201: { says: 'There is no account with that name on this computer.' },
  A202: { says: 'That sign-in is already joined to another account on this computer.' },
  A203: { says: 'That sign-in is not joined to this account.' },
  A204: { says: 'An account needs at least one way to sign in, so the last one cannot be removed.' },
  A205: { says: 'The sign-in details are not in the expected form.' },
  A206: { says: 'There is no account for that sign-in yet.' },
  A300: { says: 'That session is not open; please sign in.' },
  A301: { says: 'That session has ended; please sign in again.' },
  A302: { says: 'That session belongs to another account.' },
  A310: { says: 'The password is shorter than the owner allows.' },
  A311: { says: 'The password is not right.' },
  A312: { says: 'Too many wrong passwords; signing in with a password is paused for a while.' },
  A313: { says: 'This account has no password.' },
  A400: { says: 'The account store on this computer could not keep or give back an item.' },
  A401: { says: 'That name is not allowed for an item in the account store.' },
  A402: { says: 'The audit log of account changes could not be written, so nothing was changed.' },
} satisfies Record<string, AccountMeaning>);

export type AccountCode = keyof typeof ACCOUNT_CODES;

/** The meaning of an accounts code; an unknown code is a bug. */
export function accountMeaning(code: string): AccountMeaning {
  const m = (ACCOUNT_CODES as Readonly<Record<string, AccountMeaning>>)[code];
  if (m === undefined) throw new AccountsError('A-CODE-UNKNOWN', `unknown accounts code ${code}`);
  return m;
}
