// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The account part of the accounts core: what an account keeps, the registry, sessions and passwords.
 *
 * Spec: docs/design.md § Accounts
 * Source of truth: the files it re-exports
 * @feature accounts-core
 */
export { ACCOUNT_FORMAT, PROVIDERS, checkIdentity, identityKey, maskEmail, parseAccount, viewOf } from './model.ts';
export type { AccountDoc, AccountView, LinkedIdentity, PasswordState, Provider, VerifiedIdentity } from './model.ts';
export { Accounts } from './registry.ts';
export type { AccountsOptions, SignedIn } from './registry.ts';
export { Sessions } from './sessions.ts';
export type { OpenedSession } from './sessions.ts';
export { hashPassword, newPasswordState, readPasswordSettings, verifyPassword } from './password.ts';
export type { PasswordSettings } from './password.ts';
