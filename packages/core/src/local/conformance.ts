// Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved.
// Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE.
/**
 * The store check a product runs against its own vault before it hands it to the accounts module: it proves the
 * store keeps a copy, gives back exactly what it was given, replaces whole, lists and removes, and refuses what it
 * cannot hold, without the module ever seeing how the store seals.
 *
 * Spec: docs/design.md § The store on the computer › Checking a product's store
 * Source of truth: port.ts (`Vault`)
 * @feature accounts-core
 * @address core.local.conformance
 *
 * How it works. `vaultProblems(store)` takes a fresh, empty store and runs every step in order, collecting a
 * plain sentence for each way the store falls short; an empty list means it fits. It writes only items named
 * `conformance-*` and removes them all before it returns. A product calls it in its own tests (Poly: against a
 * `Vault` over a temporary folder), so the check travels with the module and the store stays the product's.
 */
import type { Vault } from './port.ts';

const read = (store: Vault, name: string): string | undefined => {
  const r = store.get(name);
  if (!r.ok) return undefined;
  try {
    return r.value.use((b) => b.toString('utf8'));
  } finally {
    r.value.wipe();
  }
};

/** Every way a store falls short of `Vault` (empty when it fits). */
export function vaultProblems(store: Vault): string[] {
  const p: string[] = [];
  const given = Buffer.from('first value', 'utf8');
  if (!store.put('conformance-one', given).ok) p.push('put refused a plain item');
  given.fill(0);
  if (read(store, 'conformance-one') !== 'first value') p.push('the store did not keep its own copy, or gave back other bytes');
  if (!store.put('conformance-one', Buffer.from('second', 'utf8')).ok || read(store, 'conformance-one') !== 'second') p.push('put did not replace an item whole');
  store.put('conformance-two', Buffer.from('two', 'utf8'));
  const names = store.names();
  if (!names.includes('conformance-one') || !names.includes('conformance-two')) p.push('names did not list every item');
  const lent = store.get('conformance-two');
  if (lent.ok) {
    let kept: Buffer | undefined;
    lent.value.use((b) => void (kept = b));
    if (kept !== undefined && kept.some((x) => x !== 0)) p.push('get lent bytes that were not wiped after use');
    lent.value.wipe();
  } else p.push('get refused an item that was kept');
  if (store.get('conformance-none').ok) p.push('get gave back an item that was never kept');
  if (store.put('Not A Name/..', Buffer.from('x')).ok) p.push('put took a name that could point outside the store');
  if (!store.remove('conformance-one').ok || store.names().includes('conformance-one')) p.push('remove did not delete an item');
  if (store.remove('conformance-one').ok) p.push('remove said it deleted an item that was not there');
  store.remove('conformance-two');
  if (store.names().some((n) => n.startsWith('conformance-'))) p.push('items were left behind');
  return p;
}
