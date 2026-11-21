<!-- Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved. -->
<!-- Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE. -->
# Accounts-core

G-ynthetic Labs, internal. **SIMULATED**: no real mail service, sign-in provider, telemetry service or credential is
reached until the owner's word.

The user accounts module every G-ynthetic Labs product pins. Accounts are kept on the person's own computer, sealed by
the product's vault. Poly (Agent-Advocate-core and its editions) is the first product to use it.

| Package | Shape | Job |
|---|---|---|
| `@accounts/core` | 3×4 | the vault and audit log ports, documents, accounts and linked sign-ins, sessions, password hashes |
| `@accounts/email` | 3×3 | email and password; optional magic links through a mail sender port, with a rate limit per address |
| `@accounts/telemetry` | 3×3 | probes from adapter-lib, consent per person per probe, the meter, person-approved aggregate export |

Where the rest lives (POL-REPO-001):

- **Sign in with Google, Apple and GitHub:** connectors-lib (`sign-in-google`, `sign-in-apple`, `sign-in-github`).
  A connector proves who the person is and hands over `{ provider, sub, email?, email_verified }`. Accounts-core keeps
  the account.
- **The telemetry probe contract and the probes:** adapter-lib (`telemetry/`, `domains/<product>/`), pinned here as
  `vendor/adapter-lib`.
- **Sealing secrets at rest:** the product's own vault, such as Poly's `@poly/vault`. Accounts-core seals nothing.

## Run and check

Node.js 26 (26.13 or later) and TypeScript 7.

```
git submodule update --init
npm install
npm run check
```

`npm run check` runs the type check, the code map (`codemap.json`, `feature-map.json`, `features.md`; line limit and
1×3×n shape), the legal notice, the test keys, the internal-words check and every test. `npm run docs` exports each
document in `docs/` as Word, PDF and plain text into `docs/export/` (needs pandoc and LibreOffice).

## Read next
- `docs/design.md`: the design note every code file refers to.
- `docs/owner-items.md`: every registration, number and decision that waits for the owner.
- `GOALS.md`: goals, what is built, next steps.

## Status
- The three packages are built, with 37 keyed tests on a simulated vault, audit log, outbox and exporter.
- Sign-in connectors are merged in connectors-lib; the probe contract and sign-in probe are merged in adapter-lib.
- Every number is the owner's and refuses until set. Next: Agent-Advocate-core pins this repository and runs the vault
  conformance check against Poly's vault.
