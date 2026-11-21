// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The words of a sign-in email: plain text, no images, no tracking, no links but the one sign-in link, and the time
 * it ends. The product's name is the owner's setting, so no product is named here.
 *
 * Spec: docs/design.md § Email sign-in › The message · no tracking (telemetry only as disclosed, aggregate)
 * Source of truth: the deployment's settings (`emailLinks.productName`, owner-set; unset refuses)
 * @feature accounts-email
 * @address email.mail.message
 *
 * How it works. `linkMessage(to, productName, link, minutes)` checks the product name (1 to 60 printable
 * characters with no line break, so it cannot add a header or a line; E102 otherwise) and gives the subject and the
 * text. The text says what the link does, how long it lasts, that it works once, and what to do if the person did
 * not ask for it. Nothing in it says whether an account already exists for the address.
 */
import { type Result, ok, refuse } from '@accounts/core';
import type { LinkMessage } from './port.ts';

const NAME = /^[\x20-\x7e -￿]{1,60}$/u;

/** A product name that is safe in a subject line. */
export const safeProductName = (v: unknown): v is string => typeof v === 'string' && NAME.test(v) && !/[\r\n]/.test(v) && v.trim() === v;

/** The sign-in email for one link. */
export function linkMessage(to: string, productName: unknown, link: string, minutes: number): Result<LinkMessage> {
  if (!safeProductName(productName)) return refuse('E102', '/emailLinks/productName');
  return ok(Object.freeze({
    to,
    subject: `Your sign-in link for ${productName}`,
    text: [
      `Someone asked to sign in to ${productName} on their computer with this email address.`,
      '',
      'To sign in, open this link on that computer:',
      '',
      link,
      '',
      `The link works once and ends in ${minutes} minutes.`,
      'If you did not ask for it, you can ignore this email; nothing changes until the link is opened.',
    ].join('\n'),
  }));
}
