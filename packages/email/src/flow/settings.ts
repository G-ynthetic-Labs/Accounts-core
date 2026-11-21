// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The owner's settings for magic links, read all at once so the owner sees every missing one together. Email
 * links are optional: they are off until the owner turns them on for a deployment, and a person may still choose
 * a password instead.
 *
 * Spec: docs/design.md § Email sign-in › Settings · POL-INTEGRITY-001
 * Source of truth: the deployment's settings (`emailLinks`: enabled, linkBase, productName, linkMinutes, maxSends,
 * windowMinutes)
 * @feature accounts-email
 * @address email.flow.settings
 *
 * How it works. `readLinkSettings` refuses with E100 unless `enabled` is exactly `true`; then it needs the three
 * numbers (A100/A101 from the core), a base address links may open at (E102) and a product name that is safe in a
 * subject line (E102). Every problem is listed in one failure.
 */
import { type Issue, type RawSettings, type Result, fail, issue, ok, section, wholeNumbers } from '@accounts/core';
import { safeProductName } from '../mail/message.ts';
import { allowedBase } from '../link/token.ts';

export interface LinkSettings {
  readonly base: URL;
  readonly productName: string;
  readonly linkMinutes: number;
  readonly maxSends: number;
  readonly windowMinutes: number;
}

/** The owner's magic link settings, or every reason they cannot be used. */
export function readLinkSettings(settings: RawSettings): Result<LinkSettings> {
  const s = section(settings, 'emailLinks');
  if (s['enabled'] !== true) return fail([issue('E100', '/emailLinks/enabled')]);
  const issues: Issue[] = [];
  const n = wholeNumbers(s, ['linkMinutes', 'maxSends', 'windowMinutes'], '/emailLinks');
  if (!n.ok) issues.push(...n.issues);
  const base = allowedBase(s['linkBase']);
  if (!base.ok) issues.push(...base.issues);
  if (!safeProductName(s['productName'])) issues.push(issue('E102', '/emailLinks/productName'));
  if (!n.ok || !base.ok || issues.length > 0) return fail(issues);
  return ok(Object.freeze({ base: base.value, productName: s['productName'] as string, ...n.value }));
}
