// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The base part of the accounts core: results, the code catalogue, owner settings, who is acting and the clock.
 *
 * Spec: docs/design.md § Results and codes
 * Source of truth: the files it re-exports
 * @feature accounts-core
 */
export { AccountsError, codesOf, fail, issue, ok, refuse } from './result.ts';
export type { Fail, Issue, Ok, Result } from './result.ts';
export { ACCOUNT_CODES, accountMeaning } from './codes.ts';
export type { AccountCode, AccountMeaning } from './codes.ts';
export { isText, section, wholeNumbers } from './settings.ts';
export type { RawSettings } from './settings.ts';
export { PERSON, fixedClock, iso, newId, personOnly, steppingClock, systemClock } from './actor.ts';
export type { Actor, ActorKind, Clock } from './actor.ts';
