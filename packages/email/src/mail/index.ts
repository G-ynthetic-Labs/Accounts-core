// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The mail part of email sign-in: the mail sender port and the SIMULATED outbox, the words of the email, the send
 * limit.
 *
 * Spec: docs/design.md § Email sign-in
 * Source of truth: the files it re-exports
 * @feature accounts-email
 */
export { SimulatedOutbox } from './port.ts';
export type { LinkMessage, MailSender } from './port.ts';
export { linkMessage, safeProductName } from './message.ts';
export { RateLimiter } from './rate-limit.ts';
