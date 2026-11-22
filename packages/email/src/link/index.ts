// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The link part of email sign-in: addresses and the code catalogue, link tokens and where links open, the store of
 * links sent.
 *
 * Spec: docs/design.md § Email sign-in
 * Source of truth: the files it re-exports
 * @feature accounts-email
 */
export { EMAIL_CODES, emailMeaning, normalizeAddress } from './address.ts';
export { allowedBase, buildLink, digestToken, isLinkToken, newLinkToken, readLink } from './token.ts';
export { MagicLinkStore } from './store.ts';
export type { IssuedMagicLink } from './store.ts';
