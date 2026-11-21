// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * Passwords: a person may give an account a password, so they can sign in on this computer without a provider or an
 * magic link (the private-email way in). Only a scrypt password hash is kept, and wrong tries pause sign-in for a
 * while. How hard the hash is to make, how long a password must be, how many wrong tries pause it and for how
 * long are all the owner's numbers.
 *
 * Spec: docs/design.md § Accounts › Passwords · RFC 7914 (scrypt) · POL-INTEGRITY-001
 * Source of truth: the deployment's settings (`password`: cost, blockSize, parallelization, minLength, lockoutThreshold,
 * lockoutMinutes; unset refuses)
 * @feature accounts-core
 * @address core.account.password
 *
 * How it works. `readPasswordSettings` needs every number (A100/A101) and a cost that is a power of two above 1.
 * `hashPassword` normalises the password to NFC, refuses one shorter than `minLength` code points (A310), and keeps
 * `scrypt$N$r$p$salt$hash` with a fresh 16-byte salt. `verifyPassword` refuses while paused (A312) without running
 * scrypt, re-runs scrypt with the numbers stored in the hash (so changing the settings never locks anyone
 * out), compares in constant time, and gives the new state: failures reset on success; on a wrong one they count up,
 * and reaching `lockoutThreshold` pauses sign-in for `lockoutMinutes` and starts the count again.
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { iso } from '../base/actor.ts';
import { type Result, ok, refuse } from '../base/result.ts';
import { type RawSettings, section, wholeNumbers } from '../base/settings.ts';
import type { PasswordState } from './model.ts';

const NAMES = ['cost', 'blockSize', 'parallelization', 'minLength', 'lockoutThreshold', 'lockoutMinutes'] as const;
export type PasswordSettings = Readonly<Record<(typeof NAMES)[number], number>>;
const KEY_BYTES = 32;

/** The owner's password settings, or every reason they cannot be used. */
export function readPasswordSettings(settings: RawSettings): Result<PasswordSettings> {
  const s = wholeNumbers(section(settings, 'password'), NAMES, '/password');
  if (!s.ok) return s;
  const c = s.value.cost;
  if (c < 2 || (c & (c - 1)) !== 0) return refuse('A101', '/password/cost', 'a power of two above 1');
  return s;
}

const maxmem = (n: number, r: number, p: number): number => 128 * n * r * (p + 2) + 1024 * 1024;
const codePoints = (s: string): number => [...s].length;

/** A new scrypt hash for a password. */
export function hashPassword(password: string, s: PasswordSettings): Result<string> {
  const text = password.normalize('NFC');
  if (codePoints(text) < s.minLength) return refuse('A310', '/password', `at least ${s.minLength} characters`);
  const salt = randomBytes(16);
  const hash = scryptSync(text, salt, KEY_BYTES, { N: s.cost, r: s.blockSize, p: s.parallelization, maxmem: maxmem(s.cost, s.blockSize, s.parallelization) });
  try {
    return ok(['scrypt', s.cost, s.blockSize, s.parallelization, salt.toString('base64url'), hash.toString('base64url')].join('$'));
  } finally {
    hash.fill(0);
  }
}

function matches(stored: string, password: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![n, r, p].every((x) => Number.isSafeInteger(x) && x > 0)) return false;
  const want = Buffer.from(parts[5] as string, 'base64url');
  if (want.length !== KEY_BYTES) return false;
  const got = scryptSync(password.normalize('NFC'), Buffer.from(parts[4] as string, 'base64url'), KEY_BYTES, { N: n, r, p, maxmem: maxmem(n, r, p) });
  try {
    return timingSafeEqual(got, want);
  } finally {
    got.fill(0);
  }
}

/** A fresh password state. */
export const newPasswordState = (fp: string): PasswordState => Object.freeze({ hash: fp, failures: 0, lockedUntil: null });

/** Tries a password: whether it was right (or why not), and the state to keep. */
export function verifyPassword(state: PasswordState, password: string, s: PasswordSettings, nowMs: number): { readonly result: Result<true>; readonly next: PasswordState } {
  if (state.lockedUntil !== null && Date.parse(state.lockedUntil) > nowMs) return { result: refuse('A312', '/password'), next: state };
  if (matches(state.hash, password)) return { result: ok(true), next: newPasswordState(state.hash) };
  const failures = state.failures + 1;
  if (failures >= s.lockoutThreshold) {
    return { result: refuse('A312', '/password'), next: Object.freeze({ hash: state.hash, failures: 0, lockedUntil: iso(nowMs + s.lockoutMinutes * 60_000) }) };
  }
  return { result: refuse('A311', '/password'), next: Object.freeze({ hash: state.hash, failures, lockedUntil: null }) };
}
