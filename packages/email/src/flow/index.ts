// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The flow part of email sign-in: the owner settings, signing in by link, and email with a password.
 *
 * Spec: docs/design.md § Email sign-in
 * Source of truth: the files it re-exports
 * @feature accounts-email
 */
export { readLinkSettings } from './settings.ts';
export type { LinkSettings } from './settings.ts';
export { MagicLinks } from './magic-links.ts';
export type { MagicLinksOptions } from './magic-links.ts';
export { signInWithEmailAndPassword, createUserWithEmailAndPassword } from './password.ts';
